import { Players, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { FishMessage, FishView, getRemoteEvent } from "shared/network";
import { SfxName } from "shared/sounds";
import { getSwimEnd, getSwimPose, holdSegment, SwimSegment } from "shared/swim";
import { TAGS } from "shared/tags";
import { CompanionType } from "shared/types/companions";
import {
	FISH_TYPES,
	FishConfig,
	FishType,
	getCoinValue,
	getGrowthStage,
	getGrowthStages,
	getIncomePerSecond,
	GrowthStage,
	HungerState,
	SPECIAL_COIN_MULTIPLIER,
	SPECIAL_COIN_ODDS,
} from "shared/types/fish";
import {
	FISH_VARIANTS,
	FishVariant,
	GHOST_COIN_MULTIPLIER,
	getSpecialCoinOdds,
	getVariantIncomeMultiplier,
} from "shared/types/variants";
import { isOnboardingDone } from "shared/types/onboarding";
import { getEventCoinMultiplier } from "shared/types/events";
import { getSatietyBonus } from "shared/types/perks";
import { getRebirthMultiplier } from "shared/types/rebirths";
import { getPassCoinMultiplier } from "shared/types/gamepasses";
import { QUEST_COIN_BOOST_MULTIPLIER } from "shared/types/quests";
import { SavedFish, SaveData } from "../saveData";
import { FishAssets } from "../fishAssets";
import { loadTemplates } from "../templates";
import { AquariumService, Bounds } from "./AquariumService";
import { CoinService } from "./CoinService";
import { DataService } from "./DataService";
import { FoodService } from "./FoodService";
import { LikeService } from "./LikeService";

const TICK = 0.25; // hunger & coin drop update rate (seconds)
const ASSET_SWEEP_PERIOD = 10; // seconds between two looks for fish templates no tank uses anymore (FishAssets)
const SWIM_MARGIN = 1.5;
const TURN_TIME = 0.6;
const CHASE_SPEED_MULTIPLIER = 2;
const CHASE_STEP_TIME = 0.25; // re-targets the (sinking) food this often: one message per step
const CHASE_LOOKAHEAD = 1; // seconds of swimming a chase segment covers, so it outlasts the next message's latency
const WEAK_SPEED_MULTIPLIER = 0.35; // weak with hunger: barely swims (it still rushes to food)
const INTERRUPT_CHECK = 0.1; // seconds between two "something to eat?" checks while gliding

// Clients render the tanks they watch (see FishView / FishRenderController)
const MAX_WATCHED = 6;
const WATCH_COOLDOWN = 0.25; // a client's watch list is applied at most this often

const WEAK_NOTICE_COOLDOWN = 30; // seconds between two "weak fish" notifications to a player
const FART_SFX_COOLDOWN = 2.5; // a tank full of weak fish doesn't turn into a fart concert

const RESTORE_TIMEOUT = 30; // seconds a loaded tank waits for its aquarium to be assigned

const isPlotList = t.array(t.integer);

/**
 * A fish exists only as data on the server: no 3D model, no tween. Its swimming is a chain of
 * SwimSegments the server decides (wander, chase food...) and evaluates itself when it needs a
 * position (coin drops, eating); the clients get the same segments and build / move the models.
 */
interface FishEntity {
	id: number;
	owner: Player;
	plot: number; // PlotIndex of the owner's tank
	fishType: FishType;
	config: FishConfig;
	variant: FishVariant;
	payoutInterval: number; // seconds between two coins: the species' interval, shortened by the variant
	scale: number; // adult scale, reached at the last growth stage
	adultSize: Vector3; // body size at that scale (template "Body", head toward -Z)
	bornAt: number; // os.clock() when it was dropped in the water, pushed back while the owner is AFK
	growth: readonly GrowthStage[]; // stages of its fish type
	growthStage: number; // index in `growth`
	speed: number;
	bounds: Bounds; // water of the owner's aquarium
	segment: SwimSegment;
	state: HungerState;
	stateEndsAt: number; // os.clock(); math.huge while weak (until fed)
	nextPayoutAt: number;
	paused: boolean; // owner AFK, as last told to the clients
	alive: boolean;
}

/** `byCompanion` (fed callbacks): the companion that gave the food (the Pelican, the Jellyfish), if any. */
type FishCallback = (owner: Player, fishType: FishType, byCompanion?: CompanionType) => void;
/** An easter egg fish left the tank on its own, from `position`. */
type FishLeftCallback = (owner: Player, fishType: FishType, position: Vector3) => void;

function now(): number {
	return Workspace.GetServerTimeNow();
}

/**
 * Owns every fish: swimming AI, hunger lifecycle, growth and coin drops, all server-side.
 * Fish never die of hunger: an unfed one turns weak (slow, farts 1$ bubbles instead of coins).
 * Only the tanks a client watches are sent to it ("WatchAquariums"), as FishMessages.
 */
class FishServiceSingleton implements Lifecycle {
	private rng = new Random();
	private sfxRemote = getRemoteEvent("PlaySfx");
	private fishRemote = getRemoteEvent("FishSync");
	private fishByOwner = new Map<Player, Set<FishEntity>>();
	private nextId = 0;
	private templates = new Map<FishType, Model>();
	/** Owners whose fish are frozen in time: AFK (see AquariumService.isTending) or still in the onboarding. */
	private frozenOwners = new Set<Player>();
	private spawnedCallbacks = new Array<FishCallback>();
	private fedCallbacks = new Array<FishCallback>();
	private leftCallbacks = new Array<FishLeftCallback>();
	private lastTickAt = os.clock();
	// Tanks each client renders (its requests are validated, debounced and only change what it receives)
	private watched = new Map<Player, Set<number>>();
	private pendingWatch = new Map<Player, number[]>();
	private watchAppliedAt = new Map<Player, number>();
	private weakNoticeAt = new Map<Player, number>();
	private fartSfxAt = new Map<Player, number>();

	public onInit() {
		const fishTypes = new Array<FishType>();
		for (const [fishType] of pairs(FISH_TYPES)) fishTypes.push(fishType);
		this.templates = loadTemplates(TAGS.FishTemplate, "FishType", fishTypes);
		FishAssets.init(this.templates);

		DataService.registerAction("WatchAquariums", isPlotList, (player, plots) => this.requestWatch(player, plots));

		// Saved fish come back grown and as hungry as they were (the count itself is PlayerData.fish)
		DataService.onLoaded((player, save) => this.restoreTank(player, save));
		DataService.onSave((player, save) => this.saveTank(player, save));

		Players.PlayerRemoving.Connect((player) => {
			// Written before the cleanup: DataService's final save may come before or after this handler
			const save = DataService.getSave(player);
			if (save) this.saveTank(player, save);
			const fishes = this.fishByOwner.get(player);
			if (fishes) {
				for (const fish of fishes) {
					fish.alive = false;
					this.send(fish.plot, { kind: "Remove", id: fish.id, cause: "Gone" });
				}
			}
			this.fishByOwner.delete(player);
			this.frozenOwners.delete(player);
			this.watched.delete(player);
			this.pendingWatch.delete(player);
			this.watchAppliedAt.delete(player);
			this.weakNoticeAt.delete(player);
			this.fartSfxAt.delete(player);
		});
	}

	public onStart() {
		print("[Server] FishService started.");

		let sweptAt = os.clock();
		while (true) {
			task.wait(TICK);
			const clock = os.clock();
			this.tick(clock);
			if (clock - sweptAt >= ASSET_SWEEP_PERIOD) {
				sweptAt = clock;
				this.sweepAssets();
			}
		}
	}

	// ---------------------------------------------------------------------
	// Replication to the clients watching each tank
	// ---------------------------------------------------------------------

	/** A client tells which tanks it renders; applied at most every WATCH_COOLDOWN seconds. */
	private requestWatch(player: Player, plots: number[]) {
		const first = !this.pendingWatch.has(player);
		this.pendingWatch.set(player, plots);
		if (!first) return; // already scheduled: it will use the latest list
		const wait = (this.watchAppliedAt.get(player) ?? -math.huge) + WATCH_COOLDOWN - os.clock();
		task.delay(math.max(wait, 0), () => this.applyWatch(player));
	}

	private applyWatch(player: Player) {
		const plots = this.pendingWatch.get(player);
		this.pendingWatch.delete(player);
		if (!plots || !player.IsDescendantOf(Players)) return;
		this.watchAppliedAt.set(player, os.clock());

		const previous = this.watched.get(player) ?? new Set<number>();
		const watching = new Set<number>();
		for (const plot of plots) {
			if (watching.size() >= MAX_WATCHED) break;
			if (AquariumService.isPlot(plot)) watching.add(plot);
		}
		this.watched.set(player, watching);
		// Full state of the tanks it just started to watch (it drops the others on its own)
		for (const plot of watching) {
			if (!previous.has(plot)) this.fishRemote.FireClient(player, this.getTankMessage(plot));
		}
	}

	private getTankMessage(plot: number): FishMessage {
		const fish = new Array<FishView>();
		for (const [, fishes] of this.fishByOwner) {
			for (const entity of fishes) {
				if (entity.alive && entity.plot === plot) fish.push(this.getView(entity));
			}
		}
		return { kind: "Tank", plot, fish };
	}

	private getView(fish: FishEntity): FishView {
		return {
			id: fish.id,
			plot: fish.plot,
			fishType: fish.fishType,
			variant: fish.variant,
			scale: fish.scale,
			growthStage: fish.growthStage,
			hunger: fish.state,
			paused: fish.paused,
			segment: fish.segment,
		};
	}

	/** Sends a message to every client watching the tank. */
	private send(plot: number, message: FishMessage) {
		for (const [player, plots] of this.watched) {
			if (plots.has(plot)) this.fishRemote.FireClient(player, message);
		}
	}

	private sendState(fish: FishEntity) {
		this.send(fish.plot, {
			kind: "State",
			id: fish.id,
			hunger: fish.state,
			growthStage: fish.growthStage,
			paused: fish.paused,
		});
	}

	// ---------------------------------------------------------------------
	// Hunger & coin drops (authoritative, server-side only)
	// ---------------------------------------------------------------------

	private tick(clock: number) {
		const elapsed = clock - this.lastTickAt;
		this.lastTickAt = clock;

		const leaving = new Array<FishEntity>();
		for (const [owner, fishes] of this.fishByOwner) {
			// AFK owner (back in the 3D lobby): their fish are frozen in time, so they don't get hungry,
			// don't grow and drop nothing until the owner is back in the 2.5D view. Eggs keep hatching.
			// During the onboarding they are held the same way: only its scripted coin / hunger happen.
			const paused = !AquariumService.isTending(owner);
			const frozen = paused || !isOnboardingDone(DataService.getOnboardingStep(owner));
			if (frozen) this.frozenOwners.add(owner);
			else this.frozenOwners.delete(owner);
			this.runCoinBoost(owner, frozen ? 0 : elapsed);

			for (const fish of fishes) {
				if (!fish.alive) continue;

				if (fish.paused !== paused) {
					fish.paused = paused;
					this.sendState(fish);
				}
				if (frozen) {
					fish.stateEndsAt += elapsed;
					fish.nextPayoutAt += elapsed;
					fish.bornAt += elapsed;
					continue;
				}

				if (clock >= fish.stateEndsAt) this.advanceHunger(fish, clock);

				const stage = getGrowthStage(fish.fishType, clock - fish.bornAt);
				if (stage > fish.growthStage) {
					fish.growthStage = stage;
					this.sendState(fish);
				}

				// An easter egg fish's time in the tank is its age: frozen offline and while paused, like growth
				const easterEgg = fish.config.easterEgg;
				if (easterEgg && clock - fish.bornAt >= easterEgg.lifetime) {
					leaving.push(fish);
					continue;
				}

				// Income is no longer passive: the fish drops a coin the owner has to click (a weak one only farts)
				if (clock >= fish.nextPayoutAt) {
					fish.nextPayoutAt += fish.payoutInterval;
					this.payout(owner, fish);
				}
			}
		}
		for (const fish of leaving) this.leaveTank(fish);
	}

	/**
	 * The quest coin boost (PlayerData.coinBoostSeconds) runs down only while the tank produces; its time left and
	 * whether it runs reach the owner's client as Player attributes (the HUD's boost chip), saved with the data.
	 */
	private runCoinBoost(owner: Player, elapsed: number) {
		const data = DataService.getData(owner);
		if (!data) return;
		if (elapsed > 0 && data.coinBoostSeconds > 0)
			data.coinBoostSeconds = math.max(data.coinBoostSeconds - elapsed, 0);
		const left = math.ceil(data.coinBoostSeconds);
		const running = left > 0 && elapsed > 0;
		if (owner.GetAttribute("CoinBoostSeconds") !== left) owner.SetAttribute("CoinBoostSeconds", left);
		if (owner.GetAttribute("CoinBoostRunning") !== running) owner.SetAttribute("CoinBoostRunning", running);
	}

	private payout(owner: Player, fish: FishEntity) {
		if (fish.state === HungerState.Weak) this.fart(owner, fish);
		else this.dropCoin(owner, fish);
	}

	/**
	 * Coin value follows the fish's growth, times the owner's rebirth multiplier (permanent), the +50% Coins
	 * pass, the like boost (doubled for a while), the quest coin boost (x2 while it lasts) and the running event's
	 * bonus (abyssal raid x1.5). One coin out
	 * of SPECIAL_COIN_ODDS is special (never a frozen one), one out of 5 for a shiny fish; a ghost
	 * fish's special coins are ghost coins instead, worth GHOST_COIN_MULTIPLIER special ones.
	 */
	private dropCoin(owner: Player, fish: FishEntity, frozen = false) {
		const special = !frozen && this.rng.NextNumber() * getSpecialCoinOdds(fish.variant) < 1;
		const ghost = special && FISH_VARIANTS[fish.variant].ghostCoins;
		const data = DataService.getData(owner);
		const multiplier =
			getRebirthMultiplier(data?.rebirths ?? 0) *
			getPassCoinMultiplier(data?.passes ?? []) *
			LikeService.getCoinMultiplier(owner) *
			((data?.coinBoostSeconds ?? 0) > 0 ? QUEST_COIN_BOOST_MULTIPLIER : 1) *
			getEventCoinMultiplier(owner) *
			(ghost ? GHOST_COIN_MULTIPLIER : 1);
		// An easter egg fish's coin (the French Fish's croissant) is worth a share of the tank's income
		const easterEgg = fish.config.easterEgg;
		const base = easterEgg
			? this.getTankIncomePerMinute(owner) * easterEgg.incomeShare * (special ? SPECIAL_COIN_MULTIPLIER : 1)
			: getCoinValue(fish.fishType, fish.growthStage, special);
		const value = math.max(math.round(base * multiplier), 1);
		const belly = this.getPose(fish).Position.sub(new Vector3(0, this.getSize(fish).Y / 2, 0));
		CoinService.spawnCoin(owner, fish.config.coin, value, belly, special && !ghost, frozen, ghost);
	}

	/**
	 * Theoretical income per minute of the owner's tank, easter egg fish aside: each fish's coins at its
	 * growth stage and variant, sparkling coins included on average, as if all were fed and collected.
	 * The rebirth, like and event multipliers are applied by dropCoin, as for any coin.
	 */
	public getTankIncomePerMinute(owner: Player): number {
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return 0;
		let perSecond = 0;
		for (const fish of fishes) {
			if (!fish.alive || fish.config.easterEgg) continue;
			perSecond +=
				getIncomePerSecond(fish.fishType) *
				fish.growth[fish.growthStage].coinMultiplier *
				getVariantIncomeMultiplier(fish.variant);
		}
		const sparkling = 1 + (SPECIAL_COIN_MULTIPLIER - 1) / SPECIAL_COIN_ODDS;
		return perSecond * sparkling * 60;
	}

	/** A weak fish lets out a bubble from its tail: it rises, worth FART_BUBBLE_VALUE when clicked. */
	private fart(owner: Player, fish: FishEntity) {
		const tail = this.getPose(fish).PointToWorldSpace(new Vector3(0, 0, this.getSize(fish).Z / 2));
		CoinService.spawnBubble(owner, tail);
		const clock = os.clock();
		if (clock - (this.fartSfxAt.get(owner) ?? -math.huge) < FART_SFX_COOLDOWN) return;
		this.fartSfxAt.set(owner, clock);
		this.playSizedSfx(fish, "WeakBubble");
	}

	/**
	 * Music event beat (see EventService): each living fish drops its coin (a weak one farts) with
	 * the given chance, on top of its regular ones. Frozen tanks (AFK owner, onboarding) get nothing.
	 */
	public dropBeatCoins(chance: number) {
		for (const [owner, fishes] of this.fishByOwner) {
			if (this.frozenOwners.has(owner)) continue;
			for (const fish of fishes) {
				if (fish.alive && this.rng.NextNumber() < chance) this.payout(owner, fish);
			}
		}
	}

	private advanceHunger(fish: FishEntity, clock: number) {
		if (fish.state === HungerState.Satiated) {
			this.setState(fish, HungerState.Hungry, clock + fish.config.hunger.hungryDuration);
		} else if (fish.state === HungerState.Hungry) {
			this.setState(fish, HungerState.Weak, math.huge); // until fed: fish never starve to death
			this.noticeWeak(fish);
		}
	}

	/** Tells the owner (now and then, not for every fish) that a fish turned weak and why it matters. */
	private noticeWeak(fish: FishEntity) {
		const clock = os.clock();
		if (clock - (this.weakNoticeAt.get(fish.owner) ?? -math.huge) < WEAK_NOTICE_COOLDOWN) return;
		this.weakNoticeAt.set(fish.owner, clock);
		const name = fish.config.displayName.lower();
		DataService.notify(fish.owner, `Your ${name} is weak with hunger: feed it to get its coins back!`);
		this.sfxRemote.FireClient(fish.owner, "FishWeak", 1);
	}

	private setState(fish: FishEntity, state: HungerState, endsAt: number) {
		fish.state = state;
		fish.stateEndsAt = endsAt;
		this.sendState(fish);
	}

	private feed(fish: FishEntity, sfx: SfxName, byCompanion?: CompanionType) {
		// The Hearty meals perk keeps it full longer
		const bonus = getSatietyBonus(DataService.getData(fish.owner)?.perks ?? []);
		this.setState(fish, HungerState.Satiated, os.clock() + fish.config.hunger.satiatedDuration + bonus);
		for (const callback of this.fedCallbacks) task.spawn(callback, fish.owner, fish.fishType, byCompanion);
		this.playSizedSfx(fish, sfx);
	}

	/** Heard by the owner wherever they are; the smaller the fish, the higher the pitch (cartoon feel). */
	private playSizedSfx(fish: FishEntity, sfx: SfxName) {
		const pitch = math.clamp(2.2 / math.sqrt(this.getSize(fish).Magnitude), 0.8, 1.4);
		this.sfxRemote.FireClient(fish.owner, sfx, pitch * this.rng.NextNumber(0.94, 1.06));
	}

	// ---------------------------------------------------------------------
	// Onboarding hooks (see OnboardingService)
	// ---------------------------------------------------------------------

	/** Registers a callback fired when a new fish is dropped in its owner's tank. */
	public onFishSpawned(callback: FishCallback) {
		this.spawnedCallbacks.push(callback);
	}

	/** Registers a callback fired when a fish eats (food or another fish). */
	public onFishFed(callback: FishCallback) {
		this.fedCallbacks.push(callback);
	}

	/** Registers a callback fired when an easter egg fish leaves the tank on its own (OceanService credits it). */
	public onFishLeft(callback: FishLeftCallback) {
		this.leftCallbacks.push(callback);
	}

	private getFirstLivingFish(owner: Player): FishEntity | undefined {
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return undefined;
		for (const fish of fishes) {
			if (fish.alive) return fish;
		}
		return undefined;
	}

	/** Drops a frozen coin (waits in the water until collected) from one of the owner's fish. */
	public dropFrozenCoin(owner: Player): boolean {
		const fish = this.getFirstLivingFish(owner);
		if (!fish) return false;
		this.dropCoin(owner, fish, true);
		return true;
	}

	/** Every fish of the owner instantly turns hungry. */
	public makeHungry(owner: Player) {
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return;
		for (const fish of fishes) {
			if (fish.alive) this.setState(fish, HungerState.Hungry, os.clock() + fish.config.hunger.hungryDuration);
		}
	}

	// ---------------------------------------------------------------------
	// Leaving the tank (eaten by a cannibal, released to the ocean)
	// ---------------------------------------------------------------------

	/** Removes the fish from the game right away; the watching clients play its exit. */
	private removeFish(fish: FishEntity, cause: "Eaten" | "Released", predator?: FishEntity) {
		if (!fish.alive) return;
		fish.alive = false;
		this.fishByOwner.get(fish.owner)?.delete(fish);
		DataService.removeFish(fish.owner, fish.fishType, fish.variant);
		this.send(fish.plot, { kind: "Remove", id: fish.id, cause, by: predator?.id });
		if (cause === "Eaten" && predator) {
			const name = fish.config.displayName.lower();
			DataService.notify(
				fish.owner,
				`A ${name} was eaten by your hungry ${predator.config.displayName.lower()}!`,
			);
		}
	}

	/**
	 * Releases one living fish of the type and variant back to the ocean (the player picks both in the
	 * Ocean panel): the one that earns the least (lowest growth stage, so smallest coins, then the
	 * smallest, then the youngest). The Ocean panel tells the player so. Returns where it was (for the points popup), or undefined if the owner has none.
	 */
	public releaseFish(owner: Player, fishType: FishType, variant: FishVariant): Vector3 | undefined {
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return undefined;
		let weakest: FishEntity | undefined;
		for (const fish of fishes) {
			if (!fish.alive || fish.fishType !== fishType || fish.variant !== variant) continue;
			if (!weakest || this.isLessValuable(fish, weakest)) weakest = fish;
		}
		if (!weakest) return undefined;
		const position = this.getPose(weakest).Position;
		this.removeFish(weakest, "Released");
		this.sfxRemote.FireClient(owner, "FishReleased", 1.3);
		return position;
	}

	/** Whether `fish` earns less than `other` (same type): commoner variant, smaller coins, smaller body, younger. */
	private isLessValuable(fish: FishEntity, other: FishEntity): boolean {
		const rank = FISH_VARIANTS[fish.variant].rank;
		const otherRank = FISH_VARIANTS[other.variant].rank;
		if (rank !== otherRank) return rank < otherRank;
		const coins = fish.growth[fish.growthStage].coinMultiplier;
		const otherCoins = other.growth[other.growthStage].coinMultiplier;
		if (coins !== otherCoins) return coins < otherCoins;
		const size = this.getSize(fish).Magnitude;
		const otherSize = this.getSize(other).Magnitude;
		if (size !== otherSize) return size < otherSize;
		return fish.bornAt > other.bornAt;
	}

	/** An easter egg fish's time is up (EasterEggConfig.lifetime): it swims off to the ocean by itself. */
	private leaveTank(fish: FishEntity) {
		if (!fish.alive) return;
		const position = this.getPose(fish).Position;
		this.removeFish(fish, "Released");
		this.sfxRemote.FireClient(fish.owner, "FishReleased", 1.3);
		for (const callback of this.leftCallbacks) task.spawn(callback, fish.owner, fish.fishType, position);
	}

	/** Releases every fish of the owner at once (rebirth: they all go back to the ocean). */
	public releaseAll(owner: Player) {
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return;
		for (const fish of [...fishes]) this.removeFish(fish, "Released");
		this.sfxRemote.FireClient(owner, "FishReleased", 1.1);
	}

	/** Whether one of the owner's fish is hungry (or weak). */
	public hasHungryFish(owner: Player): boolean {
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return false;
		for (const fish of fishes) if (fish.alive && fish.state !== HungerState.Satiated) return true;
		return false;
	}

	/** Where a hungry fish of the owner is (the weakest first), for the Pelican to aim its pellet. */
	public findHungryFishPosition(owner: Player): Vector3 | undefined {
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return undefined;
		let best: FishEntity | undefined;
		for (const fish of fishes) {
			if (!fish.alive || fish.state === HungerState.Satiated) continue;
			if (!best || (fish.state === HungerState.Weak && best.state !== HungerState.Weak)) best = fish;
		}
		return best && this.getPose(best).Position;
	}

	/** A weak cannibal swallows a smaller fish of the same owner. */
	private eatFish(predator: FishEntity, prey: FishEntity) {
		if (!predator.alive || !prey.alive) return;
		this.removeFish(prey, "Eaten", predator);
		this.feed(predator, "EatFish");
	}

	// ---------------------------------------------------------------------
	// Swimming AI (segments, see shared/swim)
	// ---------------------------------------------------------------------

	private getPose(fish: FishEntity): CFrame {
		return getSwimPose(fish.segment, now());
	}

	/** Body size at the current growth stage. */
	private getSize(fish: FishEntity): Vector3 {
		return fish.adultSize.mul(fish.growth[fish.growthStage].size);
	}

	private startSegment(fish: FishEntity, segment: SwimSegment) {
		fish.segment = segment;
		this.send(fish.plot, { kind: "Swim", id: fish.id, segment });
	}

	/** Nearest prey of a weak cannibal (FishConfig.cannibal): a smaller, non-cannibal fish of the same owner. */
	private findPrey(predator: FishEntity): FishEntity | undefined {
		if (!predator.config.cannibal || predator.state !== HungerState.Weak) return undefined;
		// A frozen tank (AFK / onboarding): its weak fish wait for the owner instead of hunting
		if (this.frozenOwners.has(predator.owner)) return undefined;
		const fishes = this.fishByOwner.get(predator.owner);
		if (!fishes) return undefined;

		const from = this.getPose(predator).Position;
		const predatorSize = this.getSize(predator).Magnitude;
		let nearest: FishEntity | undefined;
		let nearestDistance = math.huge;
		for (const other of fishes) {
			// Cannibals never eat each other, and only swallow smaller fish
			if (!other.alive || other.config.cannibal || this.getSize(other).Magnitude >= predatorSize) continue;
			const distance = this.getPose(other).Position.sub(from).Magnitude;
			if (distance < nearestDistance) {
				nearest = other;
				nearestDistance = distance;
			}
		}
		return nearest;
	}

	private wantsToEat(fish: FishEntity): boolean {
		if (fish.state === HungerState.Satiated) return false;
		if (FoodService.hasFood(fish.owner)) return true;
		return this.findPrey(fish) !== undefined;
	}

	private randomSwimPoint(fish: FishEntity): Vector3 {
		const bounds = fish.bounds;
		const size = this.getSize(fish);
		const horizontal = SWIM_MARGIN + size.Z / 2;
		const vertical = SWIM_MARGIN + size.Y / 2;
		return new Vector3(
			this.rng.NextNumber(bounds.min.X + horizontal, bounds.max.X - horizontal),
			this.rng.NextNumber(bounds.min.Y + vertical, bounds.max.Y - vertical),
			this.rng.NextNumber(bounds.min.Z + horizontal, bounds.max.Z - horizontal),
		);
	}

	/** Waits for the current segment to end; with `interruptToEat`, stops early when something to eat shows up. */
	private waitSegment(fish: FishEntity, interruptToEat: boolean) {
		const segment = fish.segment;
		const ends = getSwimEnd(segment);
		while (fish.alive && fish.segment === segment && now() < ends) {
			if (interruptToEat && this.wantsToEat(fish)) return; // the next step starts from the current pose
			task.wait(math.min(INTERRUPT_CHECK, math.max(ends - now(), 0.01)));
		}
	}

	private swimLoop(fish: FishEntity) {
		while (fish.alive) {
			if (fish.state !== HungerState.Satiated) {
				// The player's food always comes first
				const food = FoodService.findNearestFood(fish.owner, this.getPose(fish).Position);
				if (food) {
					this.chaseStep(fish, food.part.Position, 0, () => {
						if (FoodService.consume(food)) this.feed(fish, "EatFood", food.byCompanion);
					});
					continue;
				}

				// Last resort of a weak cannibal: hunt a smaller fish
				const prey = this.findPrey(fish);
				if (prey) {
					const reach = this.getSize(prey).Z / 4;
					this.chaseStep(fish, this.getPose(prey).Position, reach, () => this.eatFish(fish, prey));
					continue;
				}
			}

			this.wander(fish);

			// Idle pause, cut short if something to eat shows up while hungry
			const pauseEnd = os.clock() + this.rng.NextNumber(0.2, 1.5);
			while (fish.alive && os.clock() < pauseEnd && !this.wantsToEat(fish)) {
				task.wait(0.1);
			}
		}
	}

	private wander(fish: FishEntity) {
		const from = this.getPose(fish);
		const target = this.randomSwimPoint(fish);
		const distance = target.sub(from.Position).Magnitude;
		if (distance < 1) return;

		const speed = fish.speed * (fish.state === HungerState.Weak ? WEAK_SPEED_MULTIPLIER : 1);
		this.startSegment(fish, {
			from,
			target,
			start: now(),
			turnTime: TURN_TIME,
			moveTime: distance / speed,
			linear: false,
		});
		this.waitSegment(fish, true);
	}

	/**
	 * Swims toward a (possibly moving) target, calling `onReach` when close enough. The segment
	 * covers CHASE_LOOKAHEAD seconds at a constant speed but is replaced every CHASE_STEP_TIME:
	 * the clients, who get it a little late, never see the fish reach its end and stop.
	 */
	private chaseStep(fish: FishEntity, target: Vector3, extraReach: number, onReach: () => void) {
		const from = this.getPose(fish);
		const offset = target.sub(from.Position);
		const distance = offset.Magnitude;

		const eatDistance = this.getSize(fish).Z / 2 + 0.4 + extraReach;
		if (distance <= eatDistance) {
			onReach();
			task.wait();
			return;
		}

		const speed = fish.speed * CHASE_SPEED_MULTIPLIER;
		const step = math.min(distance - eatDistance * 0.5, speed * CHASE_LOOKAHEAD);
		this.startSegment(fish, {
			from: CFrame.lookAt(from.Position, target),
			target: from.Position.add(offset.Unit.mul(step)),
			start: now(),
			turnTime: 0,
			moveTime: step / speed,
			linear: true,
		});

		// Re-targets well before the end of the segment (or at its end, right next to the target)
		const segment = fish.segment;
		const retargetAt = math.min(getSwimEnd(segment), segment.start + CHASE_STEP_TIME);
		while (fish.alive && fish.segment === segment && now() < retargetAt) {
			task.wait(math.max(retargetAt - now(), 0.01));
		}
	}

	// ---------------------------------------------------------------------
	// Spawning
	// ---------------------------------------------------------------------

	/**
	 * Drops a new (baby) fish in the owner's aquarium. Called by EggService when an egg hatches (with
	 * the variant it drew), and with `saved` to bring back a fish of a saved tank (same size, age,
	 * hunger and variant).
	 */
	public spawnFish(owner: Player, fishType: FishType, saved?: SavedFish, hatchedVariant?: FishVariant) {
		if (!owner.IsDescendantOf(Players)) return;

		const config = FISH_TYPES[fishType];
		const aquarium = AquariumService.getAquarium(owner);
		const template = this.templates.get(fishType);
		if (!aquarium || !template) return;

		// Random adult size of the Studio template (ServerStorage.Assets.Fish): it starts as a
		// baby and grows over time (the clients scale their models from growthStage)
		const scale = saved
			? math.clamp(saved.scale, config.scaleMin, config.scaleMax)
			: this.rng.NextNumber(config.scaleMin, config.scaleMax);
		const age = saved?.age ?? 0;
		const variant = saved?.variant ?? hatchedVariant ?? "Normal";
		const payoutInterval = config.incomeInterval / FISH_VARIANTS[variant].coinRate;
		const clock = os.clock();
		const entity: FishEntity = {
			id: ++this.nextId,
			owner,
			plot: aquarium.index,
			fishType,
			config,
			variant,
			payoutInterval,
			scale,
			adultSize: template.PrimaryPart!.Size.mul(scale),
			bornAt: clock - age,
			growth: getGrowthStages(fishType),
			growthStage: getGrowthStage(fishType, age),
			speed: this.rng.NextNumber(config.speedMin, config.speedMax),
			bounds: aquarium.waterBounds,
			segment: holdSegment(new CFrame(), now()),
			state: HungerState.Satiated,
			stateEndsAt: clock + config.hunger.satiatedDuration,
			nextPayoutAt: clock + payoutInterval,
			paused: !AquariumService.isTending(owner),
			alive: true,
		};
		if (saved && saved.hunger === HungerState.Weak) {
			entity.state = HungerState.Weak;
			entity.stateEndsAt = math.huge;
		} else if (saved) {
			const duration =
				saved.hunger === HungerState.Hungry ? config.hunger.hungryDuration : config.hunger.satiatedDuration;
			entity.state = saved.hunger;
			entity.stateEndsAt = clock + math.min(saved.hungerLeft, duration);
		}

		// A new fish appears near the surface, a saved one anywhere in the water; facing a random point
		const spawnPoint = this.randomSwimPoint(entity);
		const surface = aquarium.waterBounds.max.Y - SWIM_MARGIN - this.getSize(entity).Y / 2;
		const position = saved ? spawnPoint : new Vector3(spawnPoint.X, surface, spawnPoint.Z);
		entity.segment = holdSegment(CFrame.lookAt(position, this.randomSwimPoint(entity)), now());

		let fishes = this.fishByOwner.get(owner);
		if (!fishes) {
			fishes = new Set();
			this.fishByOwner.set(owner, fishes);
		}
		fishes.add(entity);
		// Its model reaches the clients before the message that makes them build it
		FishAssets.require(fishType, variant);
		this.send(entity.plot, { kind: "Spawn", fish: this.getView(entity) });

		task.spawn(() => this.swimLoop(entity));
		// Also for restored fish: listeners are idempotent (onboarding step after a hatch, quest gauges)
		for (const callback of this.spawnedCallbacks) task.spawn(callback, owner, fishType);
	}

	/** Templates still worn by a fish of some tank stay on the clients, the others go after a while (FishAssets). */
	private sweepAssets() {
		const inUse = new Set<string>();
		for (const [, fishes] of this.fishByOwner) {
			for (const fish of fishes) {
				if (!fish.alive) continue;
				inUse.add(fish.fishType);
				inUse.add(`${fish.fishType}_${fish.variant}`);
			}
		}
		FishAssets.sweep(inUse);
	}

	// ---------------------------------------------------------------------
	// Saving (see DataService and server/saveData)
	// ---------------------------------------------------------------------

	/** Writes the living fish into the profile, right before it is saved. */
	private saveTank(owner: Player, save: SaveData) {
		// No entry yet (tank still being restored) or anymore (owner gone): the save keeps its last tank
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return;
		const clock = os.clock();
		const tank = new Array<SavedFish>();
		for (const fish of fishes) {
			if (!fish.alive) continue;
			tank.push({
				fishType: fish.fishType,
				scale: fish.scale,
				age: math.max(clock - fish.bornAt, 0),
				hunger: fish.state,
				hungerLeft: fish.state === HungerState.Weak ? 0 : math.max(fish.stateEndsAt - clock, 0),
				variant: fish.variant,
			});
		}
		save.tank = tank;
	}

	/** Brings back the fish of a joining owner: PlayerData.fish says how many, the saved tank how they were. */
	private restoreTank(owner: Player, save: SaveData) {
		// The tank is assigned on join, usually long before the profile is loaded
		const deadline = os.clock() + RESTORE_TIMEOUT;
		while (!AquariumService.getAquarium(owner)) {
			if (!owner.IsDescendantOf(Players) || os.clock() > deadline) return;
			task.wait(0.1);
		}
		if (!this.fishByOwner.has(owner)) this.fishByOwner.set(owner, new Set());

		const saved = [...save.tank];
		for (const [fishType, count] of pairs(save.player.fish)) {
			for (let i = 0; i < count; i++) {
				const index = saved.findIndex((fish) => fish.fishType === fishType);
				// More fish than saved ones (e.g. left during a hatch reveal): the extra ones are newborn
				this.spawnFish(owner, fishType, index >= 0 ? saved.remove(index) : undefined);
			}
		}
	}
}

export const FishService = new FishServiceSingleton();
