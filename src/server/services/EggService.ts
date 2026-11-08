import { Players, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { formatNumber } from "shared/format";
import { Lifecycle } from "shared/framework";
import { EggHatch, getRemoteEvent } from "shared/network";
import { EGG_TYPES, EggType, getEggPrice, HATCH_REVEAL_TIME, rollEgg } from "shared/types/eggs";
import { canBuyEggs, isOnboardingEggStep, ONBOARDING_FISH } from "shared/types/onboarding";
import {
	getCrabLuck,
	getCrabShare,
	getFishAndEggs,
	getHatchedVariant,
	getIncubating,
	getPlayerGalaxyLuck,
	getPlayerVariantLuck,
	getTotalFish,
	hasFreeIncubator,
	isEggUnlocked,
	syncIncubationCrab,
	syncIncubationSpeed,
} from "shared/types/playerData";
import { HERMIT_CRAB_FULL_SHARE } from "shared/types/companions";
import { FishType, isEasterEgg } from "shared/types/fish";
import { rollStarVariant } from "shared/types/stars";
import { FishVariant, rollVariant } from "shared/types/variants";
import { rollSize } from "shared/types/size";
import { getTestSpeed } from "../playerStats";
import { DataService } from "./DataService";
import { FishService } from "./FishService";
import { QuestService } from "./QuestService";

const isEggType = t.keyOf(EGG_TYPES);
/** Seconds of clock drift allowed between the client's "ready" display and the server's check. */
const READY_TOLERANCE = 0.25;

/**
 * Egg shop: the player buys an egg, it incubates for the egg's hatch time, then waits in its
 * shop slot until the player opens it (up to PlayerData.incubators eggs of a type at once, the soonest opens first), hatching into a fish drawn from the egg's odds. Price,
 * timer and draw are all server-side; the client only sends the "BuyEgg" / "OpenEgg" intents
 * and plays the reveal it is told about.
 */
class EggServiceSingleton implements Lifecycle {
	private rng = new Random();
	private hatchRemote = getRemoteEvent("EggHatched");
	/** os.clock() when the player's last queued reveal ends: the client plays reveals one after another. */
	private revealsEndAt = new Map<Player, number>();
	/** Fish the player's next egg hatches into, whatever its odds (Studio test command, see DevCommandService). */
	private forcedHatch = new Map<Player, FishType>();

	public onInit() {
		DataService.registerAction("BuyEgg", isEggType, (player, eggType) => this.buyEgg(player, eggType));
		DataService.registerAction("OpenEgg", isEggType, (player, eggType) => this.openEgg(player, eggType));
		Players.PlayerRemoving.Connect((player) => {
			this.revealsEndAt.delete(player);
			this.forcedHatch.delete(player);
		});
	}

	public onStart() {
		print("[Server] EggService started.");
	}

	/** The player's next opened egg (after the onboarding's) hatches into this fish. Studio tests only. */
	public forceNextHatch(player: Player, fishType: FishType) {
		this.forcedHatch.set(player, fishType);
	}

	/** An opened egg's reveal is still playing: its fish is counted but not in the tank yet. */
	public isRevealing(player: Player): boolean {
		return (this.revealsEndAt.get(player) ?? 0) > os.clock();
	}

	private buyEgg(player: Player, eggType: EggType) {
		const data = DataService.getData(player);
		// As many eggs of a type at a time as the player has incubators (the shop slot shows them)
		if (!data || !hasFreeIncubator(data, eggType)) return;
		// Hidden behind a closed gate until an egg of the previous rarity has been bought
		if (!isEggUnlocked(data, eggType)) return;

		// Onboarding: no purchase before the 2.5D view, then only the first egg until it is done
		if (!canBuyEggs(data.onboarding)) {
			const reason =
				data.onboarding === "EnterView" ? "Walk up to your aquarium first!" : "Finish the tutorial first!";
			DataService.notify(player, reason, "info");
			return;
		}

		// No population check here: a full aquarium can still buy eggs, it just can't open them (see openEgg)
		// Price always comes from the server-side config, never from the client
		// (the starter egg is free when the player has nothing, so they can never get stuck)
		const price = getEggPrice(eggType, getFishAndEggs(data));
		if (!DataService.trySpend(player, price)) {
			DataService.notify(player, `Not enough money! (${formatNumber(price)}$ needed)`);
			return;
		}

		// At the current hatch speed (the Water Hen's): the timers already running were rescaled to it, so the
		// new egg is too, and later changes rescale them all (syncIncubationSpeed)
		const now = Workspace.GetServerTimeNow();
		syncIncubationSpeed(data, now);
		const hatchTime =
			(EGG_TYPES[eggType].hatchTime * data.incubationMultiplier) /
			getTestSpeed(DataService.getSave(player)?.stats);
		DataService.startIncubation(player, eggType, now + hatchTime);
		if (data.onboarding === "BuyEgg") DataService.setOnboardingStep(player, "Hatching");
	}

	/** The player opens an egg whose incubation is over (eggs never open by themselves). */
	private openEgg(player: Player, eggType: EggType) {
		const data = DataService.getData(player);
		// The soonest egg of the type (the list is sorted): the one the shop slot shows as ready
		const hatchAt = data && getIncubating(data, eggType)[0];
		if (!data || hatchAt === undefined || Workspace.GetServerTimeNow() + READY_TOLERANCE < hatchAt) return;

		// The new fish needs room: the egg waits (it stays ready) until a fish leaves the aquarium.
		// hatchEgg counts the fish right away, so opening several eggs at once can't overflow it.
		if (getTotalFish(data) >= data.capacity) {
			DataService.notify(player, `Aquarium full! (${data.capacity} fish max)`);
			return;
		}

		// The onboarding egg always hatches into the same fish, the odds (and the hidden easter eggs, see
		// getDrawOdds) apply to every later egg
		const onboardingEgg = isOnboardingEggStep(DataService.getOnboardingStep(player));
		const forced = onboardingEgg ? undefined : this.forcedHatch.get(player);
		const fishType = onboardingEgg ? ONBOARDING_FISH : (forced ?? rollEgg(eggType, this.rng));
		// Then its variant (the tutorial's fish is always a normal one, so it looks like the tutorial says;
		// an easter egg fish has none, and leaves the star power for the next egg)
		// The Hermit Crab (ROADMAP_V1.2 §8): its luck by the share of this egg's incubation spent with it, credited
		// up to now (equipping it only to open a ready egg gives nothing)
		const now = Workspace.GetServerTimeNow();
		syncIncubationCrab(data, now);
		const crabShare = getCrabShare(data, eggType, 0, now);
		const crabLuck = getCrabLuck(data, eggType, 0, now);
		const luck = getPlayerVariantLuck(data) * crabLuck;
		const galaxyLuck = getPlayerGalaxyLuck(data) * crabLuck;
		const plain = onboardingEgg || isEasterEgg(fishType);
		const starPowered = !plain && data.starPower > 0;
		const variant: FishVariant = plain
			? "Normal"
			: starPowered
				? rollStarVariant(this.rng, data.starPower, luck, galaxyLuck)
				: rollVariant(this.rng, luck, galaxyLuck);
		const firstTime = getHatchedVariant(data, fishType, variant) === 0;
		// Its Size score (shared/types/size): every fish of an egg, the tutorial's included; a special fish has none
		const size = isEasterEgg(fishType) ? undefined : rollSize(this.rng);
		const best = data.bestSize[fishType];
		const newBestSize = size !== undefined && (best === undefined || size > best);
		if (!DataService.hatchEgg(player, eggType, fishType, variant, size)) return;
		this.forcedHatch.delete(player);
		if (starPowered) {
			data.starPower = 0; // spent (a starfall running now still fills its own gauge)
			DataService.sync(player);
		}
		QuestService.addProgress(player, "EggsOpened", 1, { fishType, variant });
		QuestService.addProgress(player, "VariantHatched", 1, { fishType, variant });
		if (size !== undefined) QuestService.addProgress(player, "SizeHatched", 1, { fishType, variant, size });
		// The Water Hen's line counts the eggs opened with it equipped
		if (data.equippedCompanions.includes("WaterHen"))
			QuestService.addProgress(player, "CompanionStat", 1, { companion: "WaterHen" });
		// The Hermit Crab's line counts the eggs that got its full bonus (incubated with it all the way)
		if (crabShare >= HERMIT_CRAB_FULL_SHARE)
			QuestService.addProgress(player, "CompanionStat", 1, { companion: "HermitCrab" });

		// The fish joins the tank once its reveal has played, after any reveal still queued
		const clock = os.clock();
		const revealEnd = math.max(clock, this.revealsEndAt.get(player) ?? 0) + HATCH_REVEAL_TIME;
		this.revealsEndAt.set(player, revealEnd);

		const hatch: EggHatch = { eggType, fishType, variant, firstTime, size, newBestSize, starPowered };
		this.hatchRemote.FireClient(player, hatch);
		task.delay(revealEnd - clock, () =>
			FishService.spawnFish(player, fishType, undefined, variant, undefined, false, size),
		);
	}
}

export const EggService = new EggServiceSingleton();
