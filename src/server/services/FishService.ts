import { Players, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { FishMessage, FishView, getRemoteEvent, Reward } from "shared/network";
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
	isEasterEgg,
	SPECIAL_COIN_MULTIPLIER,
	SPECIAL_COIN_ODDS,
} from "shared/types/fish";
import { AdminTankFish } from "shared/types/admin";
import {
	FISH_VARIANTS,
	FishVariant,
	GHOST_COIN_MULTIPLIER,
	getSpecialCoinOdds,
	getVariantIncomeMultiplier,
	STAR_COIN_MULTIPLIER,
} from "shared/types/variants";
import { INCOME_ATTRIBUTES } from "shared/types/aquarium";
import { isOnboardingDone } from "shared/types/onboarding";
import { getEventCoinMultiplier } from "shared/types/events";
import { getSatietyBonus } from "shared/types/perks";
import { getRebirthMultiplier } from "shared/types/rebirths";
import { PlayerData } from "shared/types/playerData";
import { getSizeMultiplier, rollSize, toSize } from "shared/types/size";
import { getPassCoinMultiplier } from "shared/types/gamepasses";
import { QUEST_COIN_BOOST_MULTIPLIER } from "shared/types/quests";
import {
	FISH_EFFECT_COIN_MULTIPLIER,
	FISH_EFFECT_DURATION,
	FishEffect,
	getNextVariant,
	UfoOutcome,
} from "shared/types/ufo";
import { getTestSpeed } from "../playerStats";
import { SavedFish, SaveData } from "../saveData";
import { FishAssets } from "../fishAssets";
import { loadTemplates } from "../templates";
import { AquariumService, Bounds } from "./AquariumService";
import { CoinService } from "./CoinService";
import { DataService } from "./DataService";
import { FoodService } from "./FoodService";
import { LikeService } from "./LikeService";

const TICK = 0.25; // hunger & coin drop update rate (seconds)
const FIRST_COIN_SPREAD = 2; // on joining, a fish's first coin falls between 1 and this many of its intervals
const INCOME_PUBLISH_INTERVAL = 1; // seconds between two updates of the tanks' income attributes (publishIncome)
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
	/** Size score (shared/types/size): coins and body x getSizeMultiplier; 0 for the special fish. */
	size: number;
	payoutInterval: number; // seconds between two coins: the species' interval, shortened by the variant
	scale: number; // adult scale, reached at the last growth stage (the species' middle scale x its Size)
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
	/** Beamed up into a UFO (UfoService): out of the water and of the clients until it comes back, frozen meanwhile. */
	away: boolean;
	/** Moved by a UFO's beam: its swim loop waits and issues no segment of its own. */
	held: boolean;
	/** A UFO's mutation (shared/types/ufo) and the seconds of play it still lasts. */
	effect?: FishEffect;
	effectLeft: number;
	/** os.clock() of an alien fish's next scream (EasterEggConfig.screamInterval). */
	nextScreamAt: number;
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
	private rewardRemote = getRemoteEvent("Reward");
	private fishByOwner = new Map<Player, Set<FishEntity>>();
	private nextId = 0;
	private templates = new Map<FishType, Model>();
	/** Owners whose fish are frozen in time: AFK (see AquariumService.isTending) or still in the onboarding. */
	private frozenOwners = new Set<Player>();
	private spawnedCallbacks = new Array<FishCallback>();
	private fedCallbacks = new Array<FishCallback>();
	private leftCallbacks = new Array<FishLeftCallback>();
	private lastTickAt = os.clock();
	private lastIncomeAt = 0;
	// Tanks each client renders (its requests are validated, debounced and only change what it receives)
	private watched = new Map<Player, Set<number>>();
	private pendingWatch = new Map<Player, number[]>();
	private watchAppliedAt = new Map<Player, number>();
	private weakNoticeAt = new Map<Player, number>();
	private fartSfxAt = new Map<Player, number>();
	/** Owners whose PlayerData.tankSizes changed: one sync at the end of the frame (a joining tank spawns many fish). */
	private sizesToSync = new Set<Player>();

	public onInit() {
		const fishTypes = new Array<FishType>();
		for (const [fishType] of pairs(FISH_TYPES)) fishTypes.push(fishType);
		this.templates = loadTemplates(TAGS.FishTemplate, "FishType", fishTypes);
		FishAssets.init(this.templates);

		DataService.registerAction("WatchAquariums", isPlotList, (player, plots) => this.requestWatch(player, plots));

		// Saved fish come back grown and as hungry as they were (the count itself is PlayerData.fish)
		DataService.onLoaded((player, save) => this.restoreTank(player, save));
		DataService.onSave((player, save) => this.saveTank(player, save));
		LikeService.onLikeSent((giver, owner) => this.rollLikeGift(giver, owner));

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
				if (entity.alive && !entity.away && entity.plot === plot) fish.push(this.getView(entity));
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
			size: fish.size,
			scale: fish.scale,
			growthStage: fish.growthStage,
			hunger: fish.state,
			paused: fish.paused,
			segment: fish.segment,
			effect: fish.effect,
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
			effect: fish.effect,
		});
	}

	// ---------------------------------------------------------------------
	// Hunger & coin drops (authoritative, server-side only)
	// ---------------------------------------------------------------------

	private tick(clock: number) {
		const elapsed = clock - this.lastTickAt;
		this.lastTickAt = clock;

		const leaving = new Array<FishEntity>();
		const publishIncome = clock - this.lastIncomeAt >= INCOME_PUBLISH_INTERVAL;
		if (publishIncome) this.lastIncomeAt = clock;
		for (const [owner, fishes] of this.fishByOwner) {
			// AFK owner (back in the 3D lobby): their fish are frozen in time, so they don't get hungry,
			// don't grow and drop nothing until the owner is back in the 2.5D view. Eggs keep hatching.
			// During the onboarding they are held the same way: only its scripted coin / hunger happen.
			const paused = !AquariumService.isTending(owner);
			const frozen = paused || !isOnboardingDone(DataService.getOnboardingStep(owner));
			if (frozen) this.frozenOwners.add(owner);
			else this.frozenOwners.delete(owner);
			this.runCoinBoost(owner, frozen ? 0 : elapsed);
			if (publishIncome) this.publishIncome(owner, fishes, frozen);

			for (const fish of fishes) {
				if (!fish.alive) continue;

				if (fish.paused !== paused) {
					fish.paused = paused;
					this.sendState(fish);
				}
				// A UFO's mutation lasts a minute of play
				if (fish.effect !== undefined && !frozen && !fish.away) {
					fish.effectLeft -= elapsed;
					if (fish.effectLeft <= 0) {
						fish.effect = undefined;
						this.sendState(fish);
					}
				}
				// Frozen: AFK owner, onboarding, kidnapped by a UFO, or asleep (a UFO's mutation): no hunger, no growth, no coin
				if (frozen || fish.away || fish.effect === "Sleep") {
					fish.stateEndsAt += elapsed;
					fish.nextPayoutAt += elapsed;
					fish.bornAt += elapsed;
					fish.nextScreamAt += elapsed;
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
				if (easterEgg?.lifetime !== undefined && clock - fish.bornAt >= easterEgg.lifetime) {
					leaving.push(fish);
					continue;
				}
				// The alien fish's scream: the whole tank drops a coin
				if (easterEgg?.screamInterval !== undefined && clock >= fish.nextScreamAt) {
					fish.nextScreamAt = clock + easterEgg.screamInterval;
					this.scream(owner, fish);
				}
				// Sugar keeps the pace of the tank's best fish, whichever it is now
				if (easterEgg?.bestFishShare !== undefined) this.followBestFish(owner, fish);

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

	/**
	 * The tank's income on its aquarium model (INCOME_ATTRIBUTES), for every player to see: its theoretical income
	 * (getTankIncomePerMinute, plus the easter egg fish's shares) times what multiplies its coins now (rebirth, Coins
	 * pass, like boost, quest boost, event), not the owner's test speed nor the UFO mutations of single fish.
	 */
	private publishIncome(owner: Player, fishes: ReadonlySet<FishEntity>, frozen: boolean) {
		const model = AquariumService.getAquarium(owner)?.model;
		if (!model) return;
		const data = DataService.getData(owner);
		const multiplier =
			getRebirthMultiplier(data?.rebirths ?? 0) *
			getPassCoinMultiplier(data?.passes ?? []) *
			LikeService.getCoinMultiplier(owner) *
			((data?.coinBoostSeconds ?? 0) > 0 ? QUEST_COIN_BOOST_MULTIPLIER : 1) *
			getEventCoinMultiplier(owner);
		const perSecond = math.floor((this.getFullIncomePerMinute(owner, fishes) / 60) * multiplier + 0.5);
		const set = (name: string, value: number | boolean) => {
			if (model.GetAttribute(name) !== value) model.SetAttribute(name, value);
		};
		set(INCOME_ATTRIBUTES.perSecond, perSecond);
		set(INCOME_ATTRIBUTES.multiplier, multiplier);
		set(INCOME_ATTRIBUTES.paused, frozen);
	}

	/**
	 * The tank's theoretical income per minute, easter egg fish included: getTankIncomePerMinute times 1 plus each easter
	 * egg's share (the French Fish), plus what each fish copying the best one earns (Sugar: its share of that fish's).
	 * `lasting`: only the fish that stay (an easter egg with a lifetime, the French Fish, only passes through).
	 */
	private getFullIncomePerMinute(owner: Player, fishes: ReadonlySet<FishEntity>, lasting = false): number {
		let shares = 1;
		let copies = 0;
		for (const fish of fishes) {
			const easterEgg = fish.alive ? fish.config.easterEgg : undefined;
			if (!easterEgg || (lasting && easterEgg.lifetime !== undefined)) continue;
			shares += easterEgg.incomeShare;
			copies += easterEgg.bestFishShare ?? 0;
		}
		const best = copies > 0 ? this.getBestFish(owner) : undefined;
		const copied = best ? this.getFishIncomePerMinute(best) * copies : 0;
		return this.getTankIncomePerMinute(owner) * shares + copied;
	}

	/**
	 * The fish a copying easter egg (Sugar) follows: the owner's fish in the water with the highest income per second
	 * (species, growth stage, variant), easter eggs aside; undefined while there is none.
	 */
	public getBestFish(owner: Player): FishEntity | undefined {
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return undefined;
		let best: FishEntity | undefined;
		let bestIncome = 0;
		for (const fish of fishes) {
			if (!fish.alive || fish.away || fish.config.easterEgg) continue;
			const income = this.getFishIncomePerMinute(fish);
			if (best === undefined || income > bestIncome) {
				best = fish;
				bestIncome = income;
			}
		}
		return best;
	}

	/** A fish's theoretical coins per minute: its growth stage and variant, sparkling coins on average. */
	private getFishIncomePerMinute(fish: FishEntity): number {
		const sparkling = 1 + (SPECIAL_COIN_MULTIPLIER - 1) / SPECIAL_COIN_ODDS;
		return (
			getIncomePerSecond(fish.fishType) *
			fish.growth[fish.growthStage].coinMultiplier *
			getVariantIncomeMultiplier(fish.variant) *
			getSizeMultiplier(fish.size) *
			sparkling *
			60
		);
	}

	/**
	 * A copying easter egg (Sugar) drops its coin as often as the best fish: when that fish changes (or its variant),
	 * its next coin moves by the difference, so the time since its last coin counts toward the new interval.
	 */
	private followBestFish(owner: Player, fish: FishEntity) {
		const best = this.getBestFish(owner);
		const interval = best ? best.payoutInterval : fish.config.incomeInterval;
		if (interval === fish.payoutInterval) return;
		fish.nextPayoutAt += interval - fish.payoutInterval;
		fish.payoutInterval = interval;
	}

	/**
	 * The tank's lasting income per second (the lobby's income leaderboard): its theoretical income times the permanent
	 * multipliers only (rebirth, Coins pass; a future permanent bonus goes here too), without what only lasts a while
	 * (like, quest boost, event, a UFO's mutation, the French Fish passing through) nor the test speed.
	 */
	public getSteadyIncomePerSecond(owner: Player): number {
		const fishes = this.fishByOwner.get(owner);
		const data = DataService.getData(owner);
		if (!fishes || !data) return 0;
		const multiplier = getRebirthMultiplier(data.rebirths) * getPassCoinMultiplier(data.passes);
		return math.floor((this.getFullIncomePerMinute(owner, fishes, true) / 60) * multiplier + 0.5);
	}

	private payout(owner: Player, fish: FishEntity, plain = false) {
		// An easter egg without income (the alien fish) drops nothing
		const easterEgg = fish.config.easterEgg;
		if (easterEgg && easterEgg.incomeShare <= 0 && easterEgg.bestFishShare === undefined) return;
		if (fish.state === HungerState.Weak) this.fart(owner, fish);
		else this.dropCoin(owner, fish, false, plain);
	}

	/**
	 * Coin value follows the fish's growth and Size score, times the owner's rebirth multiplier (permanent), the +50% Coins
	 * pass, the like boost (doubled for a while), the quest coin boost (x2 while it lasts), a UFO's mutation (green x2,
	 * red x0.5) and the running event's bonus (abyssal raid x1.5). One coin out
	 * of SPECIAL_COIN_ODDS is special (never a frozen one), one out of 5 for a shiny fish; a ghost
	 * fish's special coins are ghost coins instead, worth GHOST_COIN_MULTIPLIER special ones.
	 */
	private dropCoin(owner: Player, fish: FishEntity, frozen = false, plain = false) {
		// Sugar copies the tank's best fish: alone, it has nothing to copy
		const easterEgg = fish.config.easterEgg;
		const copied = easterEgg?.bestFishShare !== undefined ? this.getBestFish(owner) : undefined;
		if (easterEgg?.bestFishShare !== undefined && !copied) return;
		// `plain`: never sparkling nor ghost (the alien fish's scream)
		const special = !frozen && !plain && this.rng.NextNumber() * getSpecialCoinOdds(fish.variant) < 1;
		const ghost = special && FISH_VARIANTS[fish.variant].ghostCoins;
		// A Galaxy fish's sparkling coins are star coins: the "Star" coin, worth STAR_COIN_MULTIPLIER plain coins
		const starCoin = special && !copied && !easterEgg && FISH_VARIANTS[fish.variant].starCoins === true;
		const data = DataService.getData(owner);
		const multiplier =
			getRebirthMultiplier(data?.rebirths ?? 0) *
			getPassCoinMultiplier(data?.passes ?? []) *
			LikeService.getCoinMultiplier(owner) *
			((data?.coinBoostSeconds ?? 0) > 0 ? QUEST_COIN_BOOST_MULTIPLIER : 1) *
			getEventCoinMultiplier(owner) *
			getTestSpeed(DataService.getSave(owner)?.stats) *
			(fish.effect !== undefined ? FISH_EFFECT_COIN_MULTIPLIER[fish.effect] : 1) *
			(ghost ? GHOST_COIN_MULTIPLIER : 1);
		// An easter egg fish's coin is worth a share of the tank's income (the French Fish's croissant) or of its best
		// fish's coin (Sugar's sugar cube)
		// Sugar's copy keeps the best fish's Size; a fish's own coin follows its Size
		const base = copied
			? getCoinValue(copied.fishType, copied.growthStage, special) *
				getSizeMultiplier(copied.size) *
				(easterEgg?.bestFishShare ?? 1)
			: easterEgg
				? this.getTankIncomePerMinute(owner) * easterEgg.incomeShare * (special ? SPECIAL_COIN_MULTIPLIER : 1)
				: starCoin
					? getCoinValue(fish.fishType, fish.growthStage, false) * STAR_COIN_MULTIPLIER * getSizeMultiplier(fish.size)
					: getCoinValue(fish.fishType, fish.growthStage, special) * getSizeMultiplier(fish.size);
		const value = math.max(math.round(base * multiplier), 1);
		const belly = this.getPose(fish).Position.sub(new Vector3(0, this.getSize(fish).Y / 2, 0));
		CoinService.spawnCoin(owner, starCoin ? "Star" : fish.config.coin, value, belly, special && !ghost, frozen, ghost);
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
				getVariantIncomeMultiplier(fish.variant) *
				getSizeMultiplier(fish.size);
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
	 * The alien fish screams (EasterEggConfig.screamInterval): a wave through the tank (the clients draw it) and every
	 * other fish in the water drops one plain coin (a weak one farts), on top of its own: their timers don't move.
	 */
	private scream(owner: Player, alien: FishEntity) {
		this.send(alien.plot, { kind: "Scream", id: alien.id });
		this.sfxRemote.FireClient(owner, "AlienScream", 1);
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return;
		for (const fish of fishes) {
			if (fish === alien || !fish.alive || fish.away || fish.effect === "Sleep") continue;
			this.payout(owner, fish, true);
		}
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

	/**
	 * Paced music event beat (see PacedBeatCoins): each living fish drops its coin with a chance of `seconds` / its own
	 * interval between two coins (variant included), i.e. on average `seconds` of its own income, whatever its pace.
	 */
	public dropPacedBeatCoins(seconds: number) {
		for (const [owner, fishes] of this.fishByOwner) {
			if (this.frozenOwners.has(owner)) continue;
			for (const fish of fishes) {
				const chance = math.min(seconds / fish.payoutInterval, 1);
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

	/**
	 * A like the player gives may bring an easter egg fish into their own tank (EasterEggConfig.likeChance: Sugar), one
	 * at most per like: it rewards liking, not being liked.
	 */
	private rollLikeGift(giver: Player, likedOwner: Player) {
		if (!isOnboardingDone(DataService.getOnboardingStep(giver))) return;
		for (const [fishType, config] of pairs(FISH_TYPES)) {
			const chance = config.easterEgg?.likeChance;
			if (chance === undefined || !this.canReceiveLikeGift(giver, fishType)) continue;
			if (this.rng.NextNumber() * 100 >= chance) continue;
			this.bringLikeGift(giver, fishType, likedOwner);
			return;
		}
	}

	/** One of each like gift per tank at most (Sugar stays: several would weigh too much in the late game). */
	public canReceiveLikeGift(player: Player, fishType: FishType): boolean {
		const data = DataService.getData(player);
		return data !== undefined && (data.fish[fishType] ?? 0) === 0;
	}

	/**
	 * An easter egg fish swims into the player's tank for a like they gave (or a Studio test command, no liked owner):
	 * even into a full tank (a gift is never refused; the player releases a fish to buy eggs again), never a second one.
	 * Celebrated like a reward. Returns whether it came.
	 */
	public bringLikeGift(player: Player, fishType: FishType, likedOwner?: Player): boolean {
		const config = FISH_TYPES[fishType];
		if (!AquariumService.getAquarium(player) || !this.templates.has(fishType)) return false;
		if (!this.canReceiveLikeGift(player, fishType)) return false;
		DataService.addFish(player, fishType);
		this.spawnFish(player, fishType, undefined, "Normal");
		const like = likedOwner ? `Your like to ${likedOwner.DisplayName}` : "Your like";
		const reward: Reward = {
			title: "SECRET FISH!",
			subtitle: `${like} brought ${config.displayName} to your aquarium. ${config.easterEgg?.perk ?? ""}!`,
			amount: 0,
			item: { icon: "", name: config.displayName, fishType },
		};
		this.rewardRemote.FireClient(player, reward);
		this.sfxRemote.FireClient(player, "FishObtained", 1);
		print(
			`[Server] ${player.Name} got ${fishType} ${likedOwner ? `by liking ${likedOwner.Name}'s aquarium` : "from a test command"}.`,
		);
		return true;
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
		this.refreshTankSizes(fish.owner); // before removeFish: its sync carries them
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
	 * Ocean panel): the smallest one (lowest Size score, the owner's rule), then the one that earns the least (lowest
	 * growth stage), then the youngest. The Ocean panel tells the player so. Returns where it was (for the points popup), or undefined if the owner has none.
	 */
	public releaseFish(owner: Player, fishType: FishType, variant: FishVariant): Vector3 | undefined {
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return undefined;
		let weakest: FishEntity | undefined;
		for (const fish of fishes) {
			if (!fish.alive || fish.away || fish.held || fish.fishType !== fishType || fish.variant !== variant)
				continue;
			if (!weakest || this.isLessValuable(fish, weakest)) weakest = fish;
		}
		if (!weakest) return undefined;
		const position = this.getPose(weakest).Position;
		this.removeFish(weakest, "Released");
		this.sfxRemote.FireClient(owner, "FishReleased", 1.3);
		return position;
	}

	/**
	 * Whether `fish` goes before `other` (same type): commoner variant, lower Size score (permanent: a Titan just hatched
	 * is never released before a Tiny adult), smaller coins (growth), smaller body, younger.
	 */
	private isLessValuable(fish: FishEntity, other: FishEntity): boolean {
		const rank = FISH_VARIANTS[fish.variant].rank;
		const otherRank = FISH_VARIANTS[other.variant].rank;
		if (rank !== otherRank) return rank < otherRank;
		if (fish.size !== other.size) return fish.size < other.size;
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

	// ---------------------------------------------------------------------
	// Admin panel (AdminService checks the right): see and change a player's tank
	// ---------------------------------------------------------------------

	/** The owner's fish (those away in a UFO included), for the admin panel: id, species, variant. */
	public getFishList(owner: Player): AdminTankFish[] {
		const list = new Array<AdminTankFish>();
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return list;
		for (const fish of fishes)
			if (fish.alive) list.push({ id: fish.id, fishType: fish.fishType, variant: fish.variant, size: fish.size });
		list.sort((a, b) => a.id < b.id);
		return list;
	}

	/** Takes one fish out of the owner's tank, no Ocean Points (not while a UFO holds it). Returns whether it was. */
	public adminRemoveFish(owner: Player, id: number): boolean {
		const fish = this.findById(id);
		if (!fish || fish.owner !== owner || !fish.alive || fish.away || fish.held) return false;
		this.removeFish(fish, "Released");
		return true;
	}

	/**
	 * Drops a new fish of the admin's choice in the owner's tank, even a full one (a newborn; an easter egg is always
	 * Normal), found in the Fish Index like a hatch. Returns whether it came.
	 */
	/** The admin panel's ADD: that variant and Size score (undefined: drawn like an egg's; a special fish has neither). */
	public adminAddFish(owner: Player, fishType: FishType, variant: FishVariant, size?: number): boolean {
		if (!AquariumService.getAquarium(owner) || !this.templates.has(fishType) || !DataService.getData(owner))
			return false;
		const kept = isEasterEgg(fishType) ? "Normal" : variant;
		DataService.addFish(owner, fishType, kept);
		const hatchedSize = size !== undefined ? toSize(size) : undefined;
		return this.spawnFish(owner, fishType, undefined, kept, undefined, false, hatchedSize) !== undefined;
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

	/** `force`: a UFO's beam moving a held fish (its own swim loop's segments are ignored meanwhile). */
	private startSegment(fish: FishEntity, segment: SwimSegment, force = false) {
		if (!force && (fish.held || fish.away)) return;
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
			if (!other.alive || other.away || other.held || other.config.cannibal) continue;
			if (this.getSize(other).Magnitude >= predatorSize) continue;
			const distance = this.getPose(other).Position.sub(from).Magnitude;
			if (distance < nearestDistance) {
				nearest = other;
				nearestDistance = distance;
			}
		}
		return nearest;
	}

	private wantsToEat(fish: FishEntity): boolean {
		if (fish.state === HungerState.Satiated || fish.held || fish.away || fish.effect === "Sleep") return false;
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
			// In a UFO's beam, away in a UFO, or asleep: it doesn't swim (nor eat) on its own
			if (fish.held || fish.away || fish.effect === "Sleep") {
				task.wait(0.2);
				continue;
			}
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
	// UFO night (UfoService)
	// ---------------------------------------------------------------------

	private findById(id: number): FishEntity | undefined {
		for (const [, fishes] of this.fishByOwner) for (const fish of fishes) if (fish.id === id) return fish;
		return undefined;
	}

	/** A living fish's species and the variant a UFO would give it (undefined for a Shiny). */
	public getFishInfo(id: number): { fishType: FishType; nextVariant?: FishVariant } | undefined {
		const fish = this.findById(id);
		if (!fish || !fish.alive) return undefined;
		return { fishType: fish.fishType, nextVariant: getNextVariant(fish.variant) };
	}

	/** A fish a UFO can take: in the water, not an easter egg, not already in `taken` (once per event). */
	public pickKidnapTarget(owner: Player, taken: ReadonlySet<number>): { id: number; position: Vector3 } | undefined {
		const candidates = new Array<FishEntity>();
		const fishes = this.fishByOwner.get(owner);
		if (!fishes) return undefined;
		for (const fish of fishes) {
			if (!fish.alive || fish.away || fish.held || fish.config.easterEgg || taken.has(fish.id)) continue;
			candidates.push(fish);
		}
		if (candidates.size() === 0) return undefined;
		const fish = candidates[this.rng.NextInteger(0, candidates.size() - 1)];
		return { id: fish.id, position: this.getPose(fish).Position };
	}

	/** Where a fish is now (undefined if it is gone). */
	public getFishPosition(id: number): Vector3 | undefined {
		const fish = this.findById(id);
		return fish?.alive && !fish.away ? this.getPose(fish).Position : undefined;
	}

	/**
	 * The fish rises in a UFO's beam to `to` over `time` (yields), then it is away: gone from the clients and frozen
	 * until beamDown. Returns false if it was gone meanwhile.
	 */
	public beamUp(id: number, to: Vector3, time: number): boolean {
		const fish = this.findById(id);
		if (!fish || !fish.alive || fish.away || fish.held) return false;
		fish.held = true;
		const from = this.getPose(fish);
		this.startSegment(fish, { from, target: to, start: now(), turnTime: 0.3, moveTime: time, linear: true }, true);
		task.wait(time);
		if (!fish.alive) return false;
		fish.away = true;
		this.send(fish.plot, { kind: "Remove", id: fish.id, cause: "Abducted" });
		return true;
	}

	/**
	 * Drops a kidnapped fish back from `from` (the UFO) over `time` (yields), changed by `outcome`. Returns what it
	 * really got (a Shiny can't get a better variant: green instead), undefined if the fish is gone.
	 */
	public beamDown(id: number, from: Vector3, outcome: UfoOutcome, time: number): UfoOutcome | undefined {
		const fish = this.findById(id);
		if (!fish || !fish.alive || !fish.away) return undefined;
		const owner = fish.owner;
		const better = getNextVariant(fish.variant);
		const applied = outcome === "Variant" && better === undefined ? "Green" : outcome;
		if (applied === "Alien") {
			// It becomes the alien fish: a new fish (an easter egg), the kidnapped one is gone for good
			fish.alive = false;
			this.fishByOwner.get(owner)?.delete(fish);
			this.refreshTankSizes(owner);
			DataService.changeFish(owner, fish.fishType, fish.variant, "AlienFish", "Normal");
			this.spawnFish(owner, "AlienFish", undefined, "Normal", { from, time });
			task.wait(time);
			return applied;
		}
		if (applied === "Variant") {
			if (better === undefined) return undefined; // (can't happen: a Shiny gets Green)
			const from = fish.variant;
			fish.variant = better;
			this.refreshTankSizes(owner); // the Size moves with its fish to the new variant
			DataService.changeFish(owner, fish.fishType, from, fish.fishType, better);
			fish.payoutInterval = fish.config.incomeInterval / FISH_VARIANTS[better].coinRate;
			FishAssets.require(fish.fishType, fish.variant);
		} else {
			fish.effect = applied;
			fish.effectLeft = FISH_EFFECT_DURATION;
		}
		fish.segment = this.getDropSegment(fish, from, time);
		fish.away = false;
		this.send(fish.plot, { kind: "Spawn", fish: this.getView(fish) });
		task.wait(time);
		fish.held = false;
		return applied;
	}

	/** Falls from `from` (a UFO) to a point in the upper half of the water, in `time` seconds. */
	private getDropSegment(fish: FishEntity, from: Vector3, time: number): SwimSegment {
		const point = this.randomSwimPoint(fish);
		const middle = (fish.bounds.min.Y + fish.bounds.max.Y) / 2;
		const target = new Vector3(point.X, math.max(point.Y, middle), point.Z);
		return { from: CFrame.lookAt(from, target), target, start: now(), turnTime: 0, moveTime: time, linear: true };
	}

	// ---------------------------------------------------------------------
	// Spawning
	// ---------------------------------------------------------------------

	/**
	 * Drops a new (baby) fish in the owner's aquarium. Called by EggService when an egg hatches (with
	 * the variant it drew), and with `saved` to bring back a fish of a saved tank (same size, age,
	 * hunger and variant). `arrival`: dropped by a UFO from that point (held in its beam for `time`
	 * seconds) instead of the usual spot. `joining`: brought back with the tank of a joining owner (restoreTank).
	 * `hatchedSize`: the Size score its egg drew (EggService); a saved fish keeps its own, a special fish has none, any
	 * other new fish (admin, a newborn added on join) draws one.
	 */
	public spawnFish(
		owner: Player,
		fishType: FishType,
		saved?: SavedFish,
		hatchedVariant?: FishVariant,
		arrival?: { from: Vector3; time: number },
		joining = false,
		hatchedSize?: number,
	): FishEntity | undefined {
		if (!owner.IsDescendantOf(Players)) return undefined;

		const config = FISH_TYPES[fishType];
		const aquarium = AquariumService.getAquarium(owner);
		const template = this.templates.get(fishType);
		if (!aquarium || !template) return undefined;

		// Adult size of the Studio template (ServerStorage.Assets.Fish): the species' middle scale x its Size score (a
		// special fish keeps a random one); it starts as a baby and grows (the clients scale their models from growthStage)
		const size = config.easterEgg ? 0 : saved ? toSize(saved.size) : (hatchedSize ?? rollSize(this.rng));
		const scale = config.easterEgg
			? saved
				? math.clamp(saved.scale, config.scaleMin, config.scaleMax)
				: this.rng.NextNumber(config.scaleMin, config.scaleMax)
			: ((config.scaleMin + config.scaleMax) / 2) * getSizeMultiplier(size);
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
			size,
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
			// A joining owner's fish all start together: their first coin falls at a random time between one and two
			// intervals, so fish of the same pace don't drop in chorus (nor too soon); then the usual interval
			nextPayoutAt:
				clock +
				(joining ? this.rng.NextNumber(payoutInterval, payoutInterval * FIRST_COIN_SPREAD) : payoutInterval),
			paused: !AquariumService.isTending(owner),
			alive: true,
			away: false,
			held: false,
			effectLeft: 0,
			nextScreamAt: clock + (config.easterEgg?.screamInterval ?? 0),
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
		if (arrival) {
			entity.segment = this.getDropSegment(entity, arrival.from, arrival.time);
			entity.held = true;
			task.delay(arrival.time, () => (entity.held = false));
		}

		let fishes = this.fishByOwner.get(owner);
		if (!fishes) {
			fishes = new Set();
			this.fishByOwner.set(owner, fishes);
		}
		fishes.add(entity);
		this.refreshTankSizes(owner);
		// Its model reaches the clients before the message that makes them build it
		FishAssets.require(fishType, variant);
		this.send(entity.plot, { kind: "Spawn", fish: this.getView(entity) });

		task.spawn(() => this.swimLoop(entity));
		// Also for restored fish: listeners are idempotent (onboarding step after a hatch, quest gauges)
		for (const callback of this.spawnedCallbacks) task.spawn(callback, owner, fishType);
		return entity;
	}

	/**
	 * Rewrites PlayerData.tankSizes from the owner's living fish (UFO passengers included: still theirs), smallest
	 * first, and syncs it at the end of the frame (once for a whole joining tank).
	 */
	private refreshTankSizes(owner: Player) {
		const data = DataService.getData(owner);
		const fishes = this.fishByOwner.get(owner);
		if (!data || !fishes) return;
		const sizes: PlayerData["tankSizes"] = {};
		for (const fish of fishes) {
			if (!fish.alive || fish.config.easterEgg) continue;
			const variants = sizes[fish.fishType] ?? {};
			const list = variants[fish.variant] ?? [];
			list.push(fish.size);
			variants[fish.variant] = list;
			sizes[fish.fishType] = variants;
		}
		for (const [, variants] of pairs(sizes)) for (const [, list] of pairs(variants)) list.sort((a, b) => a < b);
		data.tankSizes = sizes;
		if (this.sizesToSync.has(owner)) return;
		this.sizesToSync.add(owner);
		task.defer(() => {
			this.sizesToSync.delete(owner);
			if (owner.IsDescendantOf(Players)) DataService.sync(owner);
		});
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
				size: fish.size,
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
				this.spawnFish(
					owner,
					fishType,
					index >= 0 ? saved.remove(index) : undefined,
					undefined,
					undefined,
					true,
				);
			}
		}
	}
}

export const FishService = new FishServiceSingleton();
