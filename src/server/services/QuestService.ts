import { Players, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { formatNumber } from "shared/format";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, Reward } from "shared/network";
import { COMPANION_TYPES, CompanionType } from "shared/types/companions";
import { COSMETICS } from "shared/types/cosmetics";
import { FEATURES } from "shared/types/features";
import { FISH_TYPES, FishType, getFishIndexOrder, isEasterEgg } from "shared/types/fish";
import { PERKS } from "shared/types/perks";
import { getHatchedVariant, PlayerData } from "shared/types/playerData";
import { getRebirthMultiplier } from "shared/types/rebirths";
import { FishVariant, VARIANT_ORDER } from "shared/types/variants";
import {
	DAILY_QUEST_COUNT,
	DAILY_QUEST_POOL,
	GAUGE_STATS,
	getQuestConfig,
	isBoardUnlocked,
	isQuestLocked,
	QuestConfig,
	getQuestPeriod,
	isQuestComplete,
	QuestBoard,
	QuestBoardCategory,
	QuestProgress,
	QuestReward,
	QuestStat,
	QUEST_COIN_BOOST_MULTIPLIER,
	getActiveStoryQuests,
	getStoryLine,
	refreshStoryLines,
	STORY_LINES,
	WEEKLY_QUEST_COUNT,
	WEEKLY_QUEST_POOL,
} from "shared/types/quests";
import { CoinService } from "./CoinService";
import { CompanionService } from "./CompanionService";
import { DataService } from "./DataService";
import { FishService } from "./FishService";
import { LikeService } from "./LikeService";

/** Daily / weekly boards are redrawn this soon after a reset (or after joining). */
const BOARD_CHECK_INTERVAL = 5;

/** What a counted event is about: a quest with a `fishType` / `variant` / `companion` only counts its own. */
export interface QuestSubject {
	fishType?: FishType;
	variant?: FishVariant;
	companion?: CompanionType;
}

const BOARDS: Record<QuestBoardCategory, { pool: readonly string[]; count: number; seed: number }> = {
	Daily: { pool: DAILY_QUEST_POOL, count: DAILY_QUEST_COUNT, seed: 1 },
	Weekly: { pool: WEEKLY_QUEST_POOL, count: WEEKLY_QUEST_COUNT, seed: 2 },
};

/**
 * Quests: progress is counted here from server-side stats only (see addProgress), and the reward
 * is granted when the player claims a completed quest. Story quests follow each other; daily and
 * weekly boards are drawn from their pools at each reset, the same draw for every player.
 */
class QuestServiceSingleton implements Lifecycle {
	private rewardRemote = getRemoteEvent("Reward");
	private claimedCallbacks = new Array<(player: Player, questId: string, config: QuestConfig) => void>();

	/** Registers a callback fired after a quest's rewards are granted (StatsService). */
	public onQuestClaimed(callback: (player: Player, questId: string, config: QuestConfig) => void) {
		this.claimedCallbacks.push(callback);
	}

	public onInit() {
		DataService.registerAction("ClaimQuest", t.string, (player, questId) => this.claim(player, questId));
		// The frozen coin is the onboarding's: quests only count what the player earns afterwards
		CoinService.onCollected((player, frozen, value, companion) => {
			if (frozen) return;
			this.addProgress(player, "CoinMoney", value);
			this.addProgress(player, "CoinsCollected", 1);
			// The Snail's or the Swordfish's pickups
			if (companion) this.addProgress(player, "CompanionStat", 1, { companion });
			this.reportGauges(player);
		});
		FishService.onFishSpawned((owner) => this.reportGauges(owner));
		FishService.onFishFed((owner, _fishType, companion) => {
			// The Pelican's or the Jellyfish's feeds; the others are the player's own
			if (companion) this.addProgress(owner, "CompanionStat", 1, { companion });
			else this.addProgress(owner, "FishFed", 1);
		});
		LikeService.onLikeGiven((player) => this.addProgress(player, "LikesGiven", 1));
	}

	public onStart() {
		print("[Server] QuestService started.");

		while (true) {
			for (const player of Players.GetPlayers()) this.refreshBoards(player);
			task.wait(BOARD_CHECK_INTERVAL);
		}
	}

	// ---------------------------------------------------------------------
	// Daily / weekly boards
	// ---------------------------------------------------------------------

	private refreshBoards(player: Player) {
		const data = DataService.getData(player);
		if (!data) return;
		const now = Workspace.GetServerTimeNow();
		let changed = false;
		for (const [category, board] of [
			["Daily", data.quests.daily],
			["Weekly", data.quests.weekly],
		] as [QuestBoardCategory, QuestBoard][]) {
			// Not before rebirth 2 (dailies) / 3 (weeklies): an empty board, drawn the moment it opens
			if (!isBoardUnlocked(category, data.rebirths)) {
				if (board.quests.size() > 0) {
					board.quests = [];
					changed = true;
				}
				continue;
			}
			const period = getQuestPeriod(category, now);
			// An empty board of the current period was drawn while its pool was empty (before V0.46): drawn again
			if (board.period === period && (board.quests.size() > 0 || BOARDS[category].pool.size() === 0)) continue;
			board.period = period;
			board.quests = this.draw(category, period);
			changed = true;
		}
		// Lines opened by something else than a quest (a companion earned in the Ocean...)
		if (refreshStoryLines(data.quests.lines, data.companions)) changed = true;
		if (changed) DataService.sync(player);
		// Money also comes from elsewhere than coins (quest rewards...)
		this.reportGauges(player);
	}

	/** Quests of a period: seeded by the period, so every player gets the same ones. */
	private draw(category: QuestBoardCategory, period: number): QuestProgress[] {
		const { pool, count, seed } = BOARDS[category];
		const ids = [...pool];
		const rng = new Random(period * 10 + seed);
		const quests = new Array<QuestProgress>();
		while (quests.size() < count && ids.size() > 0) {
			const id = ids.remove(rng.NextInteger(0, ids.size() - 1))!;
			quests.push({ id, progress: 0, claimed: false });
		}
		return quests;
	}

	// ---------------------------------------------------------------------
	// Progress & rewards
	// ---------------------------------------------------------------------

	/**
	 * The player's quests in progress (one per open story line, then daily, then weekly), without the ones of a
	 * line whose gamepass they don't own (shown locked, never counted nor claimed).
	 */
	private getActiveQuests(player: Player): QuestProgress[] {
		const data = DataService.getData(player);
		if (!data) return [];
		const quests = data.quests;
		const active = new Array<QuestProgress>();
		for (const quest of getActiveStoryQuests(quests.lines)) {
			if (!isQuestLocked(quest.id, data.passes)) active.push(quest);
		}
		for (const quest of quests.daily.quests) active.push(quest);
		for (const quest of quests.weekly.quests) active.push(quest);
		return active;
	}

	/** Counts `amount` toward every unfinished quest of the player tracking `stat` (about `subject`, if it has one). */
	public addProgress(player: Player, stat: QuestStat, amount: number, subject: QuestSubject = {}) {
		if (amount <= 0) return;
		this.updateProgress(player, (config) => {
			if (config.stat !== stat) return undefined;
			if (config.fishType !== undefined && config.fishType !== subject.fishType) return undefined;
			if (config.variant !== undefined && config.variant !== subject.variant) return undefined;
			if (config.companion !== undefined && config.companion !== subject.companion) return undefined;
			return (progress) => progress + amount;
		});
	}

	/** Gauge stats (current values, e.g. fish in the tank): a quest keeps the best value seen while active. */
	public reportGauges(player: Player) {
		const data = DataService.getData(player);
		if (!data) return;
		this.updateProgress(player, (config) => {
			if (!GAUGE_STATS.includes(config.stat)) return undefined;
			const value = this.getGaugeValue(data, config);
			return (progress) => math.max(progress, value);
		});
	}

	/** Current value of a gauge stat for this quest. */
	private getGaugeValue(data: PlayerData, config: QuestConfig): number {
		if (config.stat === "FishInTank") {
			let total = 0;
			for (const [, count] of pairs(data.fish)) total += count;
			return total;
		}
		if (config.stat === "MoneyHeld") return data.money;
		if (config.stat === "SpeciesHatched") return config.fishType ? (data.hatched[config.fishType] ?? 0) : 0;
		if (config.stat === "Rebirths") return data.rebirths;
		if (config.stat === "IndexCells") {
			let cells = 0;
			for (const fishType of getFishIndexOrder()) {
				if (isEasterEgg(fishType)) continue;
				for (const variant of VARIANT_ORDER) if (getHatchedVariant(data, fishType, variant) > 0) cells += 1;
			}
			return cells;
		}
		if (config.stat === "SpeciesFound") {
			let species = 0;
			for (const [fishType, count] of pairs(data.hatched)) if (count > 0 && !isEasterEgg(fishType)) species += 1;
			return species;
		}
		if (config.stat === "VariantFound") {
			const variant = config.variant;
			if (variant === undefined) return 0;
			let species = 0;
			for (const fishType of getFishIndexOrder()) {
				if (!isEasterEgg(fishType) && getHatchedVariant(data, fishType, variant) > 0) species += 1;
			}
			return species;
		}
		if (config.stat === "TotalHatched") {
			let total = 0;
			for (const [, count] of pairs(data.hatched)) total += count;
			return total;
		}
		return 0;
	}

	/** `getUpdate` gives, for each active quest's config, how its progress moves (undefined: not concerned). */
	private updateProgress(
		player: Player,
		getUpdate: (config: QuestConfig) => ((progress: number) => number) | undefined,
	) {
		let changed = false;
		for (const quest of this.getActiveQuests(player)) {
			const config = getQuestConfig(quest.id);
			if (!config || quest.claimed || quest.progress >= config.target) continue;
			const update = getUpdate(config);
			if (!update) continue;
			const progress = math.min(update(quest.progress), config.target);
			if (progress === quest.progress) continue;
			quest.progress = progress;
			changed = true;
			if (quest.progress >= config.target) {
				DataService.notify(
					player,
					`Quest complete: ${config.title}! Claim your reward in the quest book.`,
					"info",
				);
			}
		}
		if (changed) DataService.sync(player);
	}

	private claim(player: Player, questId: string) {
		const data = DataService.getData(player);
		const quest = this.getActiveQuests(player).find((q) => q.id === questId);
		const config = getQuestConfig(questId);
		if (!data || !quest || !config || quest.claimed || !isQuestComplete(quest)) return;

		quest.claimed = true;
		const line = getStoryLine(questId);
		if (line && data.quests.lines[line] === quest) {
			// The line's next quest starts right away, from zero (the last one stays, claimed: a quest added
			// to the line later starts on the next join), and lines waiting for this quest open
			const nextId = STORY_LINES[line].quests[STORY_LINES[line].quests.indexOf(questId) + 1];
			if (nextId !== undefined) data.quests.lines[line] = { id: nextId, progress: 0, claimed: false };
			refreshStoryLines(data.quests.lines, data.companions);
		}
		DataService.sync(player);
		for (const reward of config.rewards) this.grant(player, reward);
		for (const callback of this.claimedCallbacks) task.spawn(callback, player, questId, config);
		// A gauge quest that just started may already be done (e.g. the tank is already full)
		this.reportGauges(player);
	}

	private grant(player: Player, reward: QuestReward) {
		let celebration: Reward;
		if (reward.kind === "Money") {
			DataService.addMoney(player, reward.amount);
			celebration = { title: "Quest complete!", subtitle: "Quest reward", amount: reward.amount };
		} else if (reward.kind === "Feature") {
			const feature = FEATURES[reward.feature];
			DataService.unlockFeature(player, reward.feature);
			celebration = {
				title: "New feature!",
				subtitle: feature.description,
				amount: 0,
				item: { icon: "", name: feature.displayName, image: feature.image },
			};
		} else if (reward.kind === "IncomeMinutes") {
			const amount = this.getIncomeReward(player, reward.minutes);
			DataService.addMoney(player, amount);
			celebration = { title: "Quest complete!", subtitle: `${reward.minutes} minutes of income`, amount };
		} else if (reward.kind === "OceanPoints") {
			DataService.addOceanPoints(player, reward.amount);
			celebration = {
				title: "Quest complete!",
				subtitle: "Ocean Points: they count toward the Ocean rewards.",
				amount: 0,
				item: { icon: "", name: `+${formatNumber(reward.amount)} Ocean Points`, image: FEATURES.Ocean.image },
			};
		} else if (reward.kind === "CoinBoost") {
			const data = DataService.getData(player);
			if (data) data.coinBoostSeconds += reward.minutes * 60;
			DataService.sync(player);
			celebration = {
				title: "Coin boost!",
				subtitle: `Coins x${QUEST_COIN_BOOST_MULTIPLIER} for ${reward.minutes} more minutes in your aquarium. It waits for you while you're away.`,
				amount: 0,
				item: { icon: `x${QUEST_COIN_BOOST_MULTIPLIER}`, name: `${reward.minutes} min boost` },
			};
		} else if (reward.kind === "Title" || reward.kind === "Decor") {
			const id = reward.kind === "Title" ? reward.title : reward.decor;
			const cosmetic = COSMETICS[id];
			DataService.addCosmetic(player, id);
			celebration = {
				title: reward.kind === "Title" ? "New title!" : "New decor!",
				subtitle: cosmetic.description,
				amount: 0,
				item: { icon: "NEW", name: cosmetic.displayName },
			};
		} else if (reward.kind === "Perk") {
			const perk = PERKS[reward.perk];
			const data = DataService.getData(player);
			if (data && !data.perks.includes(reward.perk)) data.perks.push(reward.perk);
			DataService.sync(player);
			celebration = {
				title: "Quest complete!",
				subtitle: perk.description,
				amount: 0,
				item: { icon: perk.label, name: perk.displayName },
			};
		} else {
			const companion = COMPANION_TYPES[reward.companion];
			const equipped = CompanionService.grant(player, reward.companion, true);
			celebration = {
				title: "New companion!",
				subtitle: equipped ? companion.ability : "Equip it from your companions.",
				amount: 0,
				item: { icon: "", name: companion.displayName, image: companion.image },
			};
		}
		this.rewardRemote.FireClient(player, celebration);
	}

	/**
	 * `minutes` of the tank's income as it is now (each fish's coins at its growth and variant, sparkling coins on
	 * average), times the rebirth multiplier: worth the same share of the run whatever the run. At least the
	 * income of one fish of the player's best species ever hatched, so an empty tank after a rebirth still gets one.
	 */
	private getIncomeReward(player: Player, minutes: number): number {
		const data = DataService.getData(player);
		if (!data) return 0;
		let floor = 0;
		for (const fishType of getFishIndexOrder()) {
			const config = FISH_TYPES[fishType];
			if (config.easterEgg || (data.hatched[fishType] ?? 0) <= 0) continue;
			floor = math.max(floor, (config.income / config.incomeInterval) * 60);
		}
		const perMinute = math.max(FishService.getTankIncomePerMinute(player), floor);
		return math.floor(perMinute * minutes * getRebirthMultiplier(data.rebirths));
	}
}

export const QuestService = new QuestServiceSingleton();
