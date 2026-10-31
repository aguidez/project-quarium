import { CompanionType } from "./companions";
import { CosmeticId } from "./cosmetics";
import { Feature } from "./features";
import { DEFAULT_FISH_CAPACITY, FishType } from "./fish";
import { GamePass } from "./gamepasses";
import { Perk } from "./perks";
import { FishVariant } from "./variants";

/**
 * Story quests come in lines (STORY_LINES): the quests of a line are done one after another, and
 * several lines run at the same time (the player picks which one to push). Daily and weekly quests are drawn from
 * their pool at each reset (midnight UTC / Monday midnight UTC), the same for every player.
 */
export type QuestCategory = "Story" | "Daily" | "Weekly";

/**
 * What a quest counts. Every stat is reported by the server (see QuestService.addProgress). Counters add up
 * what happens while the quest is active; gauges (GAUGE_STATS) read a current value, and the quest keeps the
 * best one seen while active: a gauge quest whose goal is already met completes as soon as it opens.
 */
export type QuestStat =
	/** Money earned from coins, collected by hand or by a companion (not the onboarding coin). */
	| "CoinMoney"
	/** Ocean Points earned by releasing fish. */
	| "OceanPoints"
	/** Gauge: living fish in the tank. */
	| "FishInTank"
	/** Gauge: money held at once. */
	| "MoneyHeld"
	/** Gauge: fish of the quest's `fishType` ever hatched (PlayerData.hatched): "Hatch a Flame Gourami". */
	| "SpeciesHatched"
	/** Gauge: rebirths done. */
	| "Rebirths"
	/** Gauge: Fish Index cells discovered (species x variant, easter eggs aside: the index's own count). */
	| "IndexCells"
	/** Eggs opened. */
	| "EggsOpened"
	/** Fish of the quest's `variant` hatched. */
	| "VariantHatched"
	/** Fish released from the Ocean menu (a rebirth's release doesn't count). */
	| "FishReleased"
	/**
	 * What the quest's `companion` does for the player: coins its Snail picks up, fish its Pelican feeds (the V1
	 * companions add theirs: eggs opened with the Water Hen equipped, coins its Swordfish grabs).
	 */
	| "CompanionStat";

/** Stats read as a current value rather than counted (see QuestStat). */
export const GAUGE_STATS: readonly QuestStat[] = ["FishInTank", "MoneyHeld", "SpeciesHatched", "Rebirths", "IndexCells"];

/**
 * Rule (BALANCE.md §5.9): no quest reward multiplies the income or the Ocean Points permanently, so quests can be
 * added or reworded without touching the pace.
 */
export type QuestReward =
	| { kind: "Money"; amount: number }
	| { kind: "Companion"; companion: CompanionType }
	| { kind: "Feature"; feature: Feature }
	/** A permanent bonus (shared/types/perks). */
	| { kind: "Perk"; perk: Perk }
	/**
	 * Money: this many minutes of the tank's current income, times the rebirth multiplier, so it is worth
	 * something in every run (QuestService.getIncomeReward).
	 */
	| { kind: "IncomeMinutes"; minutes: number }
	| { kind: "OceanPoints"; amount: number }
	/** A title or a decor (shared/types/cosmetics, PlayerData.cosmetics). */
	| { kind: "Title"; title: CosmeticId }
	| { kind: "Decor"; decor: CosmeticId };

export interface QuestConfig {
	category: QuestCategory;
	title: string;
	description: string;
	stat: QuestStat;
	target: number;
	rewards: readonly QuestReward[];
	/** The species a SpeciesHatched quest counts. */
	fishType?: FishType;
	/** The variant a VariantHatched quest counts. */
	variant?: FishVariant;
	/** The companion a CompanionStat quest counts. */
	companion?: CompanionType;
}

export const QUESTS: Record<string, QuestConfig> = {
	Story1: {
		category: "Story",
		title: "Coin Collector",
		description: "Collect 300$ worth of coins.",
		stat: "CoinMoney",
		target: 300,
		rewards: [{ kind: "Companion", companion: "Snail" }],
	},
	Story2: {
		category: "Story",
		title: "Full House",
		description: `Fill your aquarium with ${DEFAULT_FISH_CAPACITY} fish.`,
		stat: "FishInTank",
		target: DEFAULT_FISH_CAPACITY,
		rewards: [{ kind: "Feature", feature: "Ocean" }],
	},
	// The Snail's line: each one makes coins easier to catch
	Story3: {
		category: "Story",
		title: "Little Helper",
		description: "Let your Snail pick up 20 coins.",
		stat: "CompanionStat",
		companion: "Snail",
		target: 20,
		rewards: [{ kind: "Perk", perk: "CoinLinger1" }],
	},
	Story4: {
		category: "Story",
		title: "Busy Snail",
		description: "Let your Snail pick up 100 coins.",
		stat: "CompanionStat",
		companion: "Snail",
		target: 100,
		rewards: [{ kind: "Perk", perk: "CoinLinger2" }],
	},
	Story5: {
		category: "Story",
		title: "Snail Champion",
		description: "Let your Snail pick up 200 coins.",
		stat: "CompanionStat",
		companion: "Snail",
		target: 200,
		rewards: [{ kind: "Perk", perk: "CoinBounce" }],
	},
	// The Pelican's line (opens with the Pelican, an Ocean reward)
	Story6: {
		category: "Story",
		title: "Lunch Time",
		description: "Let your Pelican feed 50 fish.",
		stat: "CompanionStat",
		companion: "Pelican",
		target: 50,
		rewards: [{ kind: "Perk", perk: "FishSatiety" }],
	},
	Story7: {
		category: "Story",
		title: "Double Serving",
		description: "Let your Pelican feed 150 fish.",
		stat: "CompanionStat",
		companion: "Pelican",
		target: 150,
		rewards: [{ kind: "Perk", perk: "PelicanDouble" }],
	},
	Story8: {
		category: "Story",
		title: "Pelican Chef",
		description: "Let your Pelican feed 500 fish.",
		stat: "CompanionStat",
		companion: "Pelican",
		target: 500,
		rewards: [{ kind: "Perk", perk: "PelicanCharges" }],
	},
	// The Rebirth's line: points the player at their first rebirth and unlocks its menu
	Story9: {
		category: "Story",
		title: "Saving Up",
		description: "Have 5,000$ at once to unlock the Rebirth.",
		stat: "MoneyHeld",
		target: 5000, // REBIRTHS[0].price (rebirths.ts can't be imported here: it imports playerData, which imports this file)
		rewards: [{ kind: "Feature", feature: "Rebirth" }],
	},
	// The "Voyage" main line (BALANCE.md §5.9), after Saving Up: two quests per aquarium, find its signature species,
	// then reach the next aquarium. Gauges: a goal already met completes as the quest opens, so the line never blocks.
	// Rewards: 5 minutes of income (any run), Ocean Points for each rebirth (modelled by the simulator's plan).
	Voyage1: {
		category: "Story",
		title: "Freshwater Finds",
		description: "Hatch a Flame Gourami.",
		stat: "SpeciesHatched",
		fishType: "FlameGourami",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	Voyage2: {
		category: "Story",
		title: "Deeper Waters",
		description: "Rebirth into the Neon Coral Lagoon (rebirth 2).",
		stat: "Rebirths",
		target: 2,
		rewards: [{ kind: "OceanPoints", amount: 500 }],
	},
	Voyage3: {
		category: "Story",
		title: "Crown of the Reef",
		description: "Hatch an Imperial Discus.",
		stat: "SpeciesHatched",
		fishType: "ImperialDiscus",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	Voyage4: {
		category: "Story",
		title: "Sunken Secrets",
		description: "Rebirth into the Sunken Pirate Wreck (rebirth 3).",
		stat: "Rebirths",
		target: 3,
		rewards: [{ kind: "OceanPoints", amount: 1500 }],
	},
	Voyage5: {
		category: "Story",
		title: "Treasure of the Wreck",
		description: "Hatch a Catfish.",
		stat: "SpeciesHatched",
		fishType: "Catfish",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	Voyage6: {
		category: "Story",
		title: "The Lost City",
		description: "Rebirth into the Atlantis Ruins (rebirth 4).",
		stat: "Rebirths",
		target: 4,
		rewards: [{ kind: "OceanPoints", amount: 4000 }],
	},
	Voyage7: {
		category: "Story",
		title: "Atlantean Sun",
		description: "Hatch a Baby Sunfish.",
		stat: "SpeciesHatched",
		fishType: "BabySunfish",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	Voyage8: {
		category: "Story",
		title: "Into the Deep",
		description: "Rebirth into the Mariana Trench (rebirth 5).",
		stat: "Rebirths",
		target: 5,
		rewards: [{ kind: "OceanPoints", amount: 10000 }],
	},
	Voyage9: {
		category: "Story",
		title: "Light of the Deep",
		description: "Hatch a Lanternfish.",
		stat: "SpeciesHatched",
		fishType: "Lanternfish",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	// The Water Hen's line (Water Hen pass, BALANCE.md §5.9): eggs opened with it equipped. Slow on purpose: its
	// effect is the smallest
	WaterHen1: {
		category: "Story",
		title: "Nest Keeper",
		description: "Open 50 eggs with your Water Hen equipped.",
		stat: "CompanionStat",
		companion: "WaterHen",
		target: 50,
		rewards: [{ kind: "Perk", perk: "WaterHen1" }],
	},
	WaterHen2: {
		category: "Story",
		title: "Mother Hen",
		description: "Open 150 eggs with your Water Hen equipped.",
		stat: "CompanionStat",
		companion: "WaterHen",
		target: 150,
		rewards: [{ kind: "Perk", perk: "WaterHen2" }],
	},
	WaterHen3: {
		category: "Story",
		title: "Hatchery Queen",
		description: "Open 400 eggs with your Water Hen equipped.",
		stat: "CompanionStat",
		companion: "WaterHen",
		target: 400,
		rewards: [{ kind: "Perk", perk: "WaterHen3" }],
	},
	// The Swordfish's line (Swordfish pass): coins it picks up (~1 coin/s)
	Swordfish1: {
		category: "Story",
		title: "Quick Catch",
		description: "Let your Swordfish grab 300 coins.",
		stat: "CompanionStat",
		companion: "Swordfish",
		target: 300,
		rewards: [{ kind: "Perk", perk: "Swordfish1" }],
	},
	Swordfish2: {
		category: "Story",
		title: "Coin Hunter",
		description: "Let your Swordfish grab 1,000 coins.",
		stat: "CompanionStat",
		companion: "Swordfish",
		target: 1000,
		rewards: [{ kind: "Perk", perk: "Swordfish2" }],
	},
	Swordfish3: {
		category: "Story",
		title: "Swordfish Ace",
		description: "Let your Swordfish grab 3,000 coins.",
		stat: "CompanionStat",
		companion: "Swordfish",
		target: 3000,
		rewards: [{ kind: "Perk", perk: "Swordfish3" }],
	},
};

/** Story lines: each one has its quests in order, and opens once a quest of another line is claimed. */
export type StoryLine = "Start" | "Ocean" | "Rebirth" | "Snail" | "Pelican" | "WaterHen" | "Swordfish";

export interface StoryLineConfig {
	/** Small tag over its quests in the quest book. */
	displayName: string;
	quests: readonly string[];
	/** Story quest (of another line) to claim before this line opens; none: open from the start. */
	requires?: string;
	/** Companion to own before this line opens. */
	requiresCompanion?: CompanionType;
	/**
	 * Gamepass the line needs (the paid companion lines): it opens like the others, so the quest book shows what
	 * it would give, but stays locked (no progress, no claim) while the player doesn't own the pass.
	 */
	requiresPass?: GamePass;
	/** Display order in the quest book. */
	order: number;
}

export const STORY_LINES: Record<StoryLine, StoryLineConfig> = {
	Start: { displayName: "First steps", quests: ["Story1"], order: 1 },
	Ocean: { displayName: "Ocean", quests: ["Story2"], requires: "Story1", order: 2 },
	// The main line: the rebirth, then the "Voyage" through the aquariums (its key stays "Rebirth" for the saves)
	Rebirth: {
		displayName: "Voyage",
		quests: [
			"Story9",
			"Voyage1",
			"Voyage2",
			"Voyage3",
			"Voyage4",
			"Voyage5",
			"Voyage6",
			"Voyage7",
			"Voyage8",
			"Voyage9",
		],
		requires: "Story1",
		order: 3,
	},
	Snail: { displayName: "Snail", quests: ["Story3", "Story4", "Story5"], requires: "Story1", order: 4 },
	Pelican: { displayName: "Pelican", quests: ["Story6", "Story7", "Story8"], requiresCompanion: "Pelican", order: 5 },
	// The paid companion lines (ROADMAP M4): shown from the moment the companion is owned, locked without the pass
	WaterHen: {
		displayName: "Water Hen",
		quests: ["WaterHen1", "WaterHen2", "WaterHen3"],
		requiresCompanion: "WaterHen",
		requiresPass: "WaterHenPass",
		order: 6,
	},
	Swordfish: {
		displayName: "Swordfish",
		quests: ["Swordfish1", "Swordfish2", "Swordfish3"],
		requiresCompanion: "Swordfish",
		requiresPass: "SwordfishPass",
		order: 7,
	},
};

/** A quest of a line whose gamepass the player doesn't own: shown, never counted or claimed (see requiresPass). */
export function isQuestLocked(questId: string, passes: readonly GamePass[]): boolean {
	const line = getStoryLine(questId);
	const pass = line && STORY_LINES[line].requiresPass;
	return pass !== undefined && !passes.includes(pass);
}

/** Lines in quest book order. */
export function getStoryLineOrder(): StoryLine[] {
	const lines = new Array<StoryLine>();
	for (const [line] of pairs(STORY_LINES)) lines.push(line);
	lines.sort((a, b) => STORY_LINES[a].order < STORY_LINES[b].order);
	return lines;
}

/** The line a story quest belongs to. */
export function getStoryLine(questId: string): StoryLine | undefined {
	for (const [line, config] of pairs(STORY_LINES)) if (config.quests.includes(questId)) return line;
	return undefined;
}

/** Whether this story quest was claimed (its line went past it, or it is the line's last one, claimed). */
export function isStoryQuestDone(lines: QuestsData["lines"], questId: string): boolean {
	const line = getStoryLine(questId);
	const current = line && lines[line];
	if (!line || !current) return false;
	const order = STORY_LINES[line].quests;
	const currentIndex = order.indexOf(current.id);
	const index = order.indexOf(questId);
	return currentIndex > index || (currentIndex === index && current.claimed);
}

/**
 * Opens the lines whose requirement is met (first quest, from zero) and moves a finished line on to a
 * quest added to it since. Returns whether anything changed.
 */
export function refreshStoryLines(lines: QuestsData["lines"], companions: readonly CompanionType[]): boolean {
	let changed = false;
	for (const line of getStoryLineOrder()) {
		const config = STORY_LINES[line];
		const current = lines[line];
		if (!current) {
			if (config.requires !== undefined && !isStoryQuestDone(lines, config.requires)) continue;
			if (config.requiresCompanion !== undefined && !companions.includes(config.requiresCompanion)) continue;
			const first = config.quests[0];
			if (first === undefined) continue;
			lines[line] = { id: first, progress: 0, claimed: false };
			changed = true;
		} else if (current.claimed) {
			const following = config.quests[config.quests.indexOf(current.id) + 1];
			if (following === undefined) continue;
			lines[line] = { id: following, progress: 0, claimed: false };
			changed = true;
		}
	}
	return changed;
}

/** Story quests in progress (one per open line not finished), in quest book order. */
export function getActiveStoryQuests(lines: QuestsData["lines"]): QuestProgress[] {
	const active = new Array<QuestProgress>();
	for (const line of getStoryLineOrder()) {
		const quest = lines[line];
		if (quest && !quest.claimed) active.push(quest);
	}
	return active;
}
/** Ids of QUESTS drawn for the daily / weekly boards (none yet). */
export const DAILY_QUEST_POOL: readonly string[] = [];
export const WEEKLY_QUEST_POOL: readonly string[] = [];
/** Quests per board, fewer if the pool is smaller. */
export const DAILY_QUEST_COUNT = 3;
export const WEEKLY_QUEST_COUNT = 3;

/** A quest the player is doing: progress toward its target, and whether its reward was claimed. */
export interface QuestProgress {
	id: string;
	progress: number;
	claimed: boolean;
}

/** Daily or weekly quests of one period (see getQuestPeriod). */
export interface QuestBoard {
	period: number;
	quests: QuestProgress[];
}

export interface QuestsData {
	/**
	 * Current quest of each open story line. A finished line keeps its last quest (claimed), so the save
	 * knows where the player is when quests are added to it. A line not open yet has no entry.
	 */
	lines: Partial<Record<StoryLine, QuestProgress>>;
	daily: QuestBoard;
	weekly: QuestBoard;
}

export type QuestBoardCategory = "Daily" | "Weekly";

const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;
/** The Unix epoch was a Thursday: weeks start 4 days later, on Monday midnight UTC. */
const WEEK_START = 4 * DAY;

/** Index of the day / week containing `time` (Workspace.GetServerTimeNow(), Unix seconds). */
export function getQuestPeriod(category: QuestBoardCategory, time: number): number {
	return category === "Daily" ? math.floor(time / DAY) : math.floor((time - WEEK_START) / WEEK);
}

/** When the board of `period` resets (Unix seconds). */
export function getQuestPeriodEnd(category: QuestBoardCategory, period: number): number {
	return category === "Daily" ? (period + 1) * DAY : WEEK_START + (period + 1) * WEEK;
}

export function getQuestConfig(id: string): QuestConfig | undefined {
	return QUESTS[id] as QuestConfig | undefined;
}

export function isQuestComplete(quest: QuestProgress): boolean {
	const config = getQuestConfig(quest.id);
	return config !== undefined && quest.progress >= config.target;
}

/** Whether a reward is waiting to be claimed (shown as a badge on the quest button). */
export function hasClaimableQuest(quests: QuestsData, passes: readonly GamePass[]): boolean {
	const claimable = (quest: QuestProgress) =>
		!quest.claimed && isQuestComplete(quest) && !isQuestLocked(quest.id, passes);
	if (getActiveStoryQuests(quests.lines).some(claimable)) return true;
	return quests.daily.quests.some(claimable) || quests.weekly.quests.some(claimable);
}

export function createQuestsData(): QuestsData {
	const lines: QuestsData["lines"] = {};
	refreshStoryLines(lines, []);
	return {
		lines,
		daily: { period: -1, quests: [] }, // drawn by QuestService
		weekly: { period: -1, quests: [] },
	};
}
