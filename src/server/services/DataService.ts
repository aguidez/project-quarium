import ProfileStore from "@rbxts/profile-store";
import { Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, NotifyKind } from "shared/network";
import { CosmeticId } from "shared/types/cosmetics";
import { EggType } from "shared/types/eggs";
import { Feature } from "shared/types/features";
import { FishType } from "shared/types/fish";
import { OnboardingStep } from "shared/types/onboarding";
import { getTotalFish, MAX_MONEY, PlayerData } from "shared/types/playerData";
import { FishVariant } from "shared/types/variants";
import { SAVE_TEMPLATE, SaveData, sanitizeSave } from "../saveData";

type ActionHandler = (player: Player, payload: unknown) => void;
type SaveCallback = (player: Player, save: SaveData) => void;

/** Bump the suffix to start every player from scratch (old profiles stay in the old store). */
const STORE_NAME = "PlayerData_v1";
/** Seconds between two auto-saves of a profile (ProfileStore default: 300). Limits what a server crash can lose. */
const AUTO_SAVE_PERIOD = 60;

ProfileStore.SetConstant("AUTO_SAVE_PERIOD", AUTO_SAVE_PERIOD);
const PLAYER_STORE = ProfileStore.New(STORE_NAME, SAVE_TEMPLATE);

/** Deep copy of plain data (the save template), so a reset profile shares no table with it. */
function deepCopy<T>(value: T): T {
	if (!typeIs(value, "table")) return value;
	const copy: Record<string | number, unknown> = {};
	for (const [key, child] of pairs(value as Record<string | number, unknown>)) copy[key] = deepCopy(child);
	return copy as T;
}

function getProfileKey(player: Player): string {
	return `Player_${player.UserId}`;
}

/**
 * Single source of truth for money and fish inventory, saved with ProfileStore.
 * Every credit/debit goes through this service; clients only receive read-only snapshots.
 *
 * Saving: a profile is session-locked to this server (no duplication between servers), auto-saved
 * every AUTO_SAVE_PERIOD seconds, saved when the player leaves and when the server shuts down
 * (ProfileStore binds to close). Right before each save, the onSave callbacks write the runtime
 * state that lives outside PlayerData (the fish of the tank) into the profile.
 */
class DataServiceController implements Lifecycle {
	private profiles = new Map<Player, ProfileStore.Profile<SaveData>>();
	private loadedCallbacks = new Array<SaveCallback>();
	private saveCallbacks = new Array<SaveCallback>();
	private syncRemote = getRemoteEvent("SyncPlayerData");
	private notifyRemote = getRemoteEvent("Notify");
	private actionRemote = getRemoteEvent("RequestAction");
	private actionHandlers = new Map<string, ActionHandler>();
	/** Players whose profile was just wiped: their runtime state must not be written back into it. */
	private resetting = new Set<Player>();

	public onInit() {
		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.onPlayerRemoving(player));

		for (const player of Players.GetPlayers()) {
			task.spawn(() => this.onPlayerAdded(player));
		}

		// Securely validate incoming client packets using @rbxts/t
		this.actionRemote.OnServerEvent.Connect((player, actionName, payload) => {
			if (!t.string(actionName)) return;
			this.handlePlayerAction(player, actionName, payload);
		});
	}

	public onStart() {
		print("[Server] DataService started.");
	}

	private onPlayerAdded(player: Player) {
		// Yields until the profile is loaded; gives up if the player leaves meanwhile
		const profile = PLAYER_STORE.StartSessionAsync(getProfileKey(player), {
			Cancel: () => player.Parent !== Players,
		});
		if (!profile) {
			// Never play on default data: it would not be saved, or worse, overwrite the real one later
			if (player.Parent === Players) player.Kick("Your data couldn't be loaded. Please rejoin!");
			return;
		}

		if (ProfileStore.DataStoreState !== "Access") {
			warn(`[Server] DataService: no DataStore access (${ProfileStore.DataStoreState}), data won't be saved.`);
		}
		profile.AddUserId(player.UserId); // GDPR erasure requests
		profile.Reconcile(); // fields added to the template since the last save
		sanitizeSave(profile.Data);

		profile.OnSave.Connect(() => {
			if (this.resetting.has(player)) return;
			for (const callback of this.saveCallbacks) callback(player, profile.Data);
		});
		profile.OnSessionEnd.Connect(() => {
			// Still in the map: the server is shutting down, or the session was taken over by another server
			if (this.profiles.get(player) !== profile) return;
			this.profiles.delete(player);
			if (!ProfileStore.IsClosing) player.Kick("Your data was loaded on another server. Please rejoin!");
		});

		if (player.Parent !== Players) {
			profile.EndSession(); // left while loading
			return;
		}
		this.profiles.set(player, profile);
		this.sync(player);
		for (const callback of this.loadedCallbacks) task.spawn(callback, player, profile.Data);
	}

	private onPlayerRemoving(player: Player) {
		const profile = this.profiles.get(player);
		if (!profile) return; // not loaded yet: onPlayerAdded ends the session itself
		this.profiles.delete(player);
		// Final save. OnSave fires synchronously first, while the other services still hold the player's state
		profile.EndSession();
		this.resetting.delete(player);
	}

	/**
	 * Wipes a player's save back to a brand new one and kicks them (DevCommandService, Studio only).
	 * The caller empties their tank first; nothing of the old run is written into the profile afterwards,
	 * and the final save of the kick stores the fresh data.
	 */
	public resetSave(player: Player, kickMessage: string): boolean {
		const profile = this.profiles.get(player);
		if (!profile) return false;
		this.resetting.add(player);
		profile.Data.player = deepCopy(SAVE_TEMPLATE.player);
		profile.Data.tank = [];
		player.Kick(kickMessage);
		return true;
	}

	/** Called with the loaded profile of a joining player (restores the runtime state saved in it). */
	public onLoaded(callback: SaveCallback) {
		this.loadedCallbacks.push(callback);
	}

	/** Called right before every save of a profile (auto-save, leaving, shutdown): write runtime state in it. */
	public onSave(callback: SaveCallback) {
		this.saveCallbacks.push(callback);
	}

	/** The profile of a player whose session is open (undefined before it loads and once saved for good). */
	public getSave(player: Player): SaveData | undefined {
		if (this.resetting.has(player)) return undefined; // wiped: nothing may be written into it anymore
		return this.profiles.get(player)?.Data;
	}

	public sync(player: Player) {
		const data = this.getData(player);
		if (data) this.syncRemote.FireClient(player, data);
	}

	public notify(player: Player, message: string, kind: NotifyKind = "warning") {
		this.notifyRemote.FireClient(player, message, kind);
	}

	/** Undefined until the player's profile is loaded (actions sent before are ignored). */
	public getData(player: Player): PlayerData | undefined {
		return this.profiles.get(player)?.Data.player;
	}

	public getFishTotal(player: Player): number {
		const data = this.getData(player);
		return data ? getTotalFish(data) : 0;
	}

	public addMoney(player: Player, amount: number) {
		const data = this.getData(player);
		if (!data || amount <= 0) return;

		// Clamped: the UI and the doubles stay exact up there (MAX_MONEY), far above the V1 economy
		data.money = math.min(data.money + amount, MAX_MONEY);
		this.sync(player);
	}

	/** Deducts `amount` if the player can afford it. Returns whether the payment succeeded. */
	public trySpend(player: Player, amount: number): boolean {
		const data = this.getData(player);
		if (!data || amount < 0 || data.money < amount) return false;

		data.money -= amount;
		this.sync(player);
		return true;
	}

	/** Called by FishService when a fish leaves the tank (released, eaten). */
	public removeFish(player: Player, fishType: FishType, variant: FishVariant) {
		const data = this.getData(player);
		if (!data) return;

		data.fish[fishType] = math.max(0, data.fish[fishType] - 1);
		const living = data.fishVariants[fishType];
		if (variant !== "Normal" && living) living[variant] = math.max(0, (living[variant] ?? 0) - 1);
		this.sync(player);
	}

	/** Starts incubating a bought egg (the caller has already charged its price). */
	public startIncubation(player: Player, eggType: EggType, hatchAt: number) {
		const data = this.getData(player);
		if (!data) return;

		const eggs = data.incubating[eggType] ?? [];
		eggs.push(hatchAt);
		eggs.sort((a, b) => a < b);
		data.incubating[eggType] = eggs;
		data.eggsBought[eggType] = (data.eggsBought[eggType] ?? 0) + 1;
		this.sync(player);
	}

	/**
	 * Turns the soonest incubating egg of the type into a fish of the inventory (the caller checked it is ready).
	 * Returns false if there was no such egg.
	 */
	public hatchEgg(player: Player, eggType: EggType, fishType: FishType, variant: FishVariant): boolean {
		const data = this.getData(player);
		const eggs = data?.incubating[eggType];
		if (!data || !eggs || eggs.size() === 0) return false;

		eggs.remove(0);
		if (eggs.size() === 0) data.incubating[eggType] = undefined;
		data.fish[fishType] += 1;
		data.hatched[fishType] = (data.hatched[fishType] ?? 0) + 1;
		if (variant !== "Normal") {
			const variants = data.hatchedVariants[fishType] ?? {};
			variants[variant] = (variants[variant] ?? 0) + 1;
			data.hatchedVariants[fishType] = variants;
			const living = data.fishVariants[fishType] ?? {};
			living[variant] = (living[variant] ?? 0) + 1;
			data.fishVariants[fishType] = living;
		}
		this.sync(player);
		return true;
	}

	/** Unlocks a feature (quest reward); its tutorial shows up on the client until finished. */
	public unlockFeature(player: Player, feature: Feature) {
		const data = this.getData(player);
		if (!data || data.features.includes(feature)) return;
		data.features.push(feature);
		this.sync(player);
	}

	public addOceanPoints(player: Player, points: number) {
		const data = this.getData(player);
		if (!data || points <= 0) return;
		data.oceanPoints += points;
		this.sync(player);
	}

	/** Gives a title, decor or finish (quest or Ocean reward), once. */
	public addCosmetic(player: Player, cosmetic: CosmeticId) {
		const data = this.getData(player);
		if (!data || data.cosmetics.includes(cosmetic)) return;
		data.cosmetics.push(cosmetic);
		this.sync(player);
	}

	/** Current onboarding step ("Done" for an unknown player, so nothing stays blocked). */
	public getOnboardingStep(player: Player): OnboardingStep {
		return this.getData(player)?.onboarding ?? "Done";
	}

	/** Called by OnboardingService (and EggService when the first egg is bought). */
	public setOnboardingStep(player: Player, step: OnboardingStep) {
		const data = this.getData(player);
		if (!data || data.onboarding === step) return;

		data.onboarding = step;
		this.sync(player);
	}

	/** Registers the handler of a RequestAction intent; the payload is validated with `check` first. */
	public registerAction<T>(actionName: string, check: t.check<T>, handler: (player: Player, payload: T) => void) {
		this.actionHandlers.set(actionName, (player, payload) => {
			if (check(payload)) handler(player, payload);
		});
	}

	private handlePlayerAction(player: Player, actionName: string, payload: unknown) {
		if (actionName === "RequestSync") {
			this.sync(player);
		} else {
			this.actionHandlers.get(actionName)?.(player, payload);
		}
	}
}

export const DataService = new DataServiceController();
