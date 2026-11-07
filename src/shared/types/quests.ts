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
	/** Gauge: species hatched at least once (easter eggs aside): "find every species". */
	| "SpeciesFound"
	/** Gauge: species found in the quest's `variant` (its Fish Index cells): "find a Shiny". */
	| "VariantFound"
	/** Gauge: fish ever hatched, every species (PlayerData.hatched, kept through rebirths). */
	| "TotalHatched"
	/** Eggs opened. */
	| "EggsOpened"
	/** Coins picked up, by hand or by a companion (not the onboarding coin). */
	| "CoinsCollected"
	/** Meals eaten from the food the player dropped (not a companion's). */
	| "FishFed"
	/** Likes given to other players' aquariums. */
	| "LikesGiven"
	/** Fish of the quest's `variant` hatched. */
	| "VariantHatched"
	/** Fish released from the Ocean menu (a rebirth's release doesn't count). */
	| "FishReleased"
	/** Fish hatched with a Size score of the quest's `minSize` or more (shared/types/size). */
	| "SizeHatched"
	/** Gauge: species whose best Size ever hatched (PlayerData.bestSize) is the quest's `minSize` or more. */
	| "SizeFound"
	/** Gauge: living fish of the tank with a Size score of the quest's `minSize` or more (PlayerData.tankSizes). */
	| "BigFishInTank"
	/** Gauge: meals the player's own food gave, all time (PlayerStats.mealsByHand): the Fish Keeper line. */
	| "MealsByHand"
	/**
	 * What the quest's `companion` does for the player: coins its Snail picks up, fish its Pelican feeds (the V1
	 * companions add theirs: eggs opened with the Water Hen equipped, coins its Swordfish grabs, fish its Jellyfish feeds).
	 */
	| "CompanionStat";

/** Stats read as a current value rather than counted (see QuestStat). */
export const GAUGE_STATS: readonly QuestStat[] = [
	"FishInTank",
	"MoneyHeld",
	"SpeciesHatched",
	"Rebirths",
	"IndexCells",
	"SpeciesFound",
	"VariantFound",
	"TotalHatched",
	"SizeFound",
	"BigFishInTank",
	"MealsByHand",
];

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
	/**
	 * Coins x QUEST_COIN_BOOST_MULTIPLIER for this many minutes of production (PlayerData.coinBoostSeconds): the
	 * daily / weekly rewards. Worth about `minutes` of income, spread over the play instead of paid at once.
	 */
	| { kind: "CoinBoost"; minutes: number }
	| { kind: "OceanPoints"; amount: number }
	/** A title or a decor (shared/types/cosmetics, PlayerData.cosmetics). */
	| { kind: "Title"; title: CosmeticId }
	| { kind: "Decor"; decor: CosmeticId };

/** Coin multiplier of the quest coin boost (CoinBoost rewards), multiplied with the others (like, pass, event). */
export const QUEST_COIN_BOOST_MULTIPLIER = 2;

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
	/** The least Size score a SizeHatched / SizeFound / BigFishInTank quest counts. */
	minSize?: number;
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
	Voyage10: {
		category: "Story",
		title: "Heat Below",
		description: "Rebirth into the Volcanic Temple (rebirth 6).",
		stat: "Rebirths",
		target: 6,
		rewards: [{ kind: "OceanPoints", amount: 25000 }],
	},
	Voyage11: {
		category: "Story",
		title: "Temple Guardian",
		description: "Hatch a Dragonfish.",
		stat: "SpeciesHatched",
		fishType: "Dragonfish",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	Voyage12: {
		category: "Story",
		title: "Crystal Path",
		description: "Rebirth into the Crystal Caverns (rebirth 7).",
		stat: "Rebirths",
		target: 7,
		rewards: [{ kind: "OceanPoints", amount: 60000 }],
	},
	Voyage13: {
		category: "Story",
		title: "Puppy in the Caves",
		description: "Hatch a Husky Dogfish.",
		stat: "SpeciesHatched",
		fishType: "WolfDogfish",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	Voyage14: {
		category: "Story",
		title: "To the Stars",
		description: "Rebirth into the Cosmic Sanctuary (rebirth 8).",
		stat: "Rebirths",
		target: 8,
		rewards: [{ kind: "OceanPoints", amount: 150000 }],
	},
	Voyage15: {
		category: "Story",
		title: "Leviathan",
		description: "Hatch a Mini Leviathan.",
		stat: "SpeciesHatched",
		fishType: "MiniLeviathan",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	// The end of the Voyage (and of V1): every species of the ocean in the Fish Index
	Voyage16: {
		category: "Story",
		title: "Master Aquarist",
		description: "Find all 18 species of the ocean.",
		stat: "SpeciesFound",
		target: 18,
		rewards: [
			{ kind: "Title", title: "TitleMasterAquarist" },
			{ kind: "Decor", decor: "DecorGoldenTrophy" },
			{ kind: "OceanPoints", amount: 300000 },
		],
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
	// The Jellyfish's line (Jellyfish pass): fish it feeds (~20 a minute at 20 fish)
	Jellyfish1: {
		category: "Story",
		title: "Snack Time",
		description: "Let your Jellyfish feed 300 fish.",
		stat: "CompanionStat",
		companion: "Jellyfish",
		target: 300,
		rewards: [{ kind: "Perk", perk: "Jellyfish1" }],
	},
	Jellyfish2: {
		category: "Story",
		title: "Tentacle Chef",
		description: "Let your Jellyfish feed 1,000 fish.",
		stat: "CompanionStat",
		companion: "Jellyfish",
		target: 1000,
		rewards: [{ kind: "Perk", perk: "Jellyfish2" }],
	},
	Jellyfish3: {
		category: "Story",
		title: "Grand Feast",
		description: "Let your Jellyfish feed 3,000 fish.",
		stat: "CompanionStat",
		companion: "Jellyfish",
		target: 3000,
		rewards: [{ kind: "Perk", perk: "Jellyfish3" }],
	},
	// The side lines (BALANCE.md §5.9, ROADMAP M7): always something to do next to the Voyage. Gauges, so the goals a
	// player already met complete as the quest opens.
	// Hatchery: every fish ever hatched counts (PlayerData.hatched)
	Hatchery1: {
		category: "Story",
		title: "Hatchling Keeper",
		description: "Hatch 100 fish (all time).",
		stat: "TotalHatched",
		target: 100,
		rewards: [{ kind: "IncomeMinutes", minutes: 2 }],
	},
	Hatchery2: {
		category: "Story",
		title: "Busy Hatchery",
		description: "Hatch 300 fish (all time).",
		stat: "TotalHatched",
		target: 300,
		rewards: [{ kind: "IncomeMinutes", minutes: 2 }],
	},
	Hatchery3: {
		category: "Story",
		title: "Egg Expert",
		description: "Hatch 600 fish (all time).",
		stat: "TotalHatched",
		target: 600,
		rewards: [{ kind: "IncomeMinutes", minutes: 2 }],
	},
	Hatchery4: {
		category: "Story",
		title: "Hatch Master",
		description: "Hatch 900 fish (all time).",
		stat: "TotalHatched",
		target: 900,
		rewards: [{ kind: "IncomeMinutes", minutes: 2 }],
	},
	Hatchery5: {
		category: "Story",
		title: "Golden Incubator",
		description: "Hatch 1,200 fish (all time).",
		stat: "TotalHatched",
		target: 1200,
		rewards: [
			{ kind: "Decor", decor: "DecorIncubator" },
			{ kind: "IncomeMinutes", minutes: 2 },
		],
	},
	// Collector: the rare variants and the Fish Index (cells = species x variant), a rare find between two cell goals.
	// Income before ~3 h, Ocean Points after: points early would bring the first milestones forward (BALANCE.md §5.9)
	Collector1: {
		category: "Story",
		title: "Strange Glow",
		description: "Find an Anomaly fish.",
		stat: "VariantFound",
		variant: "Anomaly",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 2 }],
	},
	Collector2: {
		category: "Story",
		title: "Growing Index",
		description: "Fill 10 entries of the Fish Index.",
		stat: "IndexCells",
		target: 10,
		rewards: [{ kind: "IncomeMinutes", minutes: 2 }],
	},
	Collector3: {
		category: "Story",
		title: "Ghostly Friend",
		description: "Find a Ghost fish.",
		stat: "VariantFound",
		variant: "Ghost",
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 3 }],
	},
	Collector4: {
		category: "Story",
		title: "Keen Collector",
		description: "Fill 25 entries of the Fish Index.",
		stat: "IndexCells",
		target: 25,
		rewards: [{ kind: "OceanPoints", amount: 2500 }],
	},
	Collector5: {
		category: "Story",
		title: "Shiny Hunter",
		description: "Find a Shiny fish.",
		stat: "VariantFound",
		variant: "Shiny",
		target: 1,
		rewards: [{ kind: "OceanPoints", amount: 2500 }],
	},
	Collector6: {
		category: "Story",
		title: "The Collector",
		description: "Fill 50 entries of the Fish Index.",
		stat: "IndexCells",
		target: 50,
		rewards: [{ kind: "Title", title: "TitleCollector" }],
	},
	// Ocean: after "Full House" (which opens the Ocean menu), give fish back to the sea
	Ocean1: {
		category: "Story",
		title: "Back to the Sea",
		description: "Release 50 fish into the ocean.",
		stat: "FishReleased",
		target: 50,
		rewards: [{ kind: "IncomeMinutes", minutes: 3 }],
	},
	Ocean2: {
		category: "Story",
		title: "Ocean Friend",
		description: "Release a Shiny fish into the ocean.",
		stat: "FishReleased",
		variant: "Shiny",
		target: 1,
		rewards: [{ kind: "Title", title: "TitleOceanFriend" }],
	},
	// Big Catch (V1.1.16, the Size score: ROADMAP_V1.2 §3.5): opens with "Full House" like the Collector, so early: its
	// money rewards are minutes of income (BALANCE.md §4). Huge = +10 % or more, Giant +13, Titan +15 (shared/types/size)
	BigCatch1: {
		category: "Story",
		title: "Big Catch",
		description: "Hatch a Huge fish (Size +10% or more).",
		stat: "SizeFound",
		minSize: 10,
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 3 }],
	},
	BigCatch2: {
		category: "Story",
		title: "Heavyweights",
		description: "Have 5 Huge fish (Size +10% or more) in your tank at once.",
		stat: "BigFishInTank",
		minSize: 10,
		target: 5,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	BigCatch3: {
		category: "Story",
		title: "Giant Find",
		description: "Hatch a Giant fish (Size +13% or more).",
		stat: "SizeFound",
		minSize: 13,
		target: 1,
		rewards: [{ kind: "IncomeMinutes", minutes: 5 }],
	},
	BigCatch4: {
		category: "Story",
		title: "Titan Tamer",
		description: "Hatch a Titan: a perfect fish, Size +15%.",
		stat: "SizeFound",
		minSize: 15,
		target: 1,
		rewards: [
			{ kind: "Title", title: "TitleTitanTamer" },
			{ kind: "Decor", decor: "DecorTitanTrophy" },
		],
	},
	BigCatch5: {
		category: "Story",
		title: "Size Collector",
		description: "Hatch a Huge fish (Size +10% or more) of 18 different species.",
		stat: "SizeFound",
		minSize: 10,
		target: 18,
		rewards: [{ kind: "Title", title: "TitleSizeCollector" }],
	},
	// Fish Keeper (V1.1.19, ROADMAP_V1.2 §5): meals given by hand, all time (a gauge: a veteran is ahead), from rebirth 2.
	// The food reserve's perks: ~33 / ~37 / ~45 meals a minute by hand, for ~24 / ~27 / ~33 fish
	FishKeeper1: {
		category: "Story",
		title: "Fish Keeper",
		description: "Feed your fish 500 times with food you drop (all time).",
		stat: "MealsByHand",
		target: 500,
		rewards: [{ kind: "Perk", perk: "FoodRefill1" }],
	},
	FishKeeper2: {
		category: "Story",
		title: "Devoted Keeper",
		description: "Feed your fish 2,000 times with food you drop (all time).",
		stat: "MealsByHand",
		target: 2000,
		rewards: [{ kind: "Perk", perk: "FoodRefill2" }],
	},
	FishKeeper3: {
		category: "Story",
		title: "Master Keeper",
		description: "Feed your fish 6,000 times with food you drop (all time).",
		stat: "MealsByHand",
		target: 6000,
		rewards: [{ kind: "Perk", perk: "FoodSlot1" }],
	},
	// Daily quests (DAILY_QUEST_POOL): doable by anyone in a session, alone; coins x2 for 5 minutes each (BALANCE.md §5.9)
	DailyCoins: {
		category: "Daily",
		title: "Coin Rush",
		description: "Collect 150 coins.",
		stat: "CoinsCollected",
		target: 150,
		rewards: [{ kind: "CoinBoost", minutes: 5 }],
	},
	DailyCoinsBig: {
		category: "Daily",
		title: "Big Haul",
		description: "Collect 400 coins.",
		stat: "CoinsCollected",
		target: 400,
		rewards: [{ kind: "CoinBoost", minutes: 5 }],
	},
	DailyEggs: {
		category: "Daily",
		title: "Egg Hunt",
		description: "Open 10 eggs.",
		stat: "EggsOpened",
		target: 10,
		rewards: [{ kind: "CoinBoost", minutes: 5 }],
	},
	DailyEggsBig: {
		category: "Daily",
		title: "Hatch Day",
		description: "Open 20 eggs.",
		stat: "EggsOpened",
		target: 20,
		rewards: [{ kind: "CoinBoost", minutes: 5 }],
	},
	DailyFeed: {
		category: "Daily",
		title: "Feeding Time",
		description: "Feed your fish 30 times (food you drop).",
		stat: "FishFed",
		target: 30,
		rewards: [{ kind: "CoinBoost", minutes: 5 }],
	},
	DailyAnomaly: {
		category: "Daily",
		title: "Lucky Find",
		description: "Hatch an Anomaly fish.",
		stat: "VariantHatched",
		variant: "Anomaly",
		target: 1,
		rewards: [{ kind: "CoinBoost", minutes: 5 }],
	},
	DailySize: {
		category: "Daily",
		title: "Big Fish",
		description: "Hatch a Big fish or bigger (Size +4% or more).",
		stat: "SizeHatched",
		minSize: 4,
		target: 1,
		rewards: [{ kind: "CoinBoost", minutes: 5 }],
	},
	// Weekly quests (WEEKLY_QUEST_POOL): coins x2 for 15 minutes each
	WeeklyCoins: {
		category: "Weekly",
		title: "Coin Hoard",
		description: "Collect 3,000 coins.",
		stat: "CoinsCollected",
		target: 3000,
		rewards: [{ kind: "CoinBoost", minutes: 15 }],
	},
	WeeklyEggs: {
		category: "Weekly",
		title: "Egg Marathon",
		description: "Open 100 eggs.",
		stat: "EggsOpened",
		target: 100,
		rewards: [{ kind: "CoinBoost", minutes: 15 }],
	},
	WeeklyFeed: {
		category: "Weekly",
		title: "Gourmet Week",
		description: "Feed your fish 300 times (food you drop).",
		stat: "FishFed",
		target: 300,
		rewards: [{ kind: "CoinBoost", minutes: 15 }],
	},
	WeeklyGhost: {
		category: "Weekly",
		title: "Ghost Hunt",
		description: "Hatch a Ghost fish.",
		stat: "VariantHatched",
		variant: "Ghost",
		target: 1,
		rewards: [{ kind: "CoinBoost", minutes: 15 }],
	},
	WeeklyRelease: {
		category: "Weekly",
		title: "Return to the Sea",
		description: "Release 25 fish into the ocean.",
		stat: "FishReleased",
		target: 25,
		rewards: [{ kind: "CoinBoost", minutes: 15 }],
	},
	WeeklySize: {
		category: "Weekly",
		title: "Huge Haul",
		description: "Hatch a Huge fish or bigger (Size +10% or more).",
		stat: "SizeHatched",
		minSize: 10,
		target: 1,
		rewards: [{ kind: "CoinBoost", minutes: 15 }],
	},
	// The social one: a week leaves time to meet other players (one like an hour, LIKE_COOLDOWN)
	WeeklyLikes: {
		category: "Weekly",
		title: "Good Neighbour",
		description: "Like 3 other players' aquariums.",
		stat: "LikesGiven",
		target: 3,
		rewards: [{ kind: "CoinBoost", minutes: 15 }],
	},
};

/** Story lines: each one has its quests in order, and opens once a quest of another line is claimed. */
export type StoryLine =
	| "Start"
	| "Ocean"
	| "Rebirth"
	| "Hatchery"
	| "Collector"
	| "BigCatch"
	| "FishKeeper"
	| "Snail"
	| "Pelican"
	| "WaterHen"
	| "Swordfish"
	| "Jellyfish";

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
	Ocean: { displayName: "Ocean", quests: ["Story2", "Ocean1", "Ocean2"], requires: "Story1", order: 2 },
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
			"Voyage10",
			"Voyage11",
			"Voyage12",
			"Voyage13",
			"Voyage14",
			"Voyage15",
			"Voyage16",
		],
		requires: "Story1",
		order: 3,
	},
	Snail: { displayName: "Snail", quests: ["Story3", "Story4", "Story5"], requires: "Story1", order: 4 },
	Pelican: { displayName: "Pelican", quests: ["Story6", "Story7", "Story8"], requiresCompanion: "Pelican", order: 5 },
	// The free side lines (ROADMAP M7): the Collector waits for "Full House", so a new player has 4 story quests at once
	Hatchery: {
		displayName: "Hatchery",
		quests: ["Hatchery1", "Hatchery2", "Hatchery3", "Hatchery4", "Hatchery5"],
		requires: "Story1",
		order: 6,
	},
	Collector: {
		displayName: "Collector",
		quests: ["Collector1", "Collector2", "Collector3", "Collector4", "Collector5", "Collector6"],
		requires: "Story2",
		order: 7,
	},
	BigCatch: {
		displayName: "Big Catch",
		quests: ["BigCatch1", "BigCatch2", "BigCatch3", "BigCatch4", "BigCatch5"],
		requires: "Story2",
		order: 8,
	},
	// Opens with rebirth 2 (Voyage "Deeper Waters"), when the dailies do: the food reserve starts to be short after
	FishKeeper: {
		displayName: "Fish Keeper",
		quests: ["FishKeeper1", "FishKeeper2", "FishKeeper3"],
		requires: "Voyage2",
		order: 9,
	},
	// The paid companion lines (ROADMAP M4): shown from the moment the companion is owned, locked without the pass
	WaterHen: {
		displayName: "Water Hen",
		quests: ["WaterHen1", "WaterHen2", "WaterHen3"],
		requiresCompanion: "WaterHen",
		requiresPass: "WaterHenPass",
		order: 10,
	},
	Swordfish: {
		displayName: "Swordfish",
		quests: ["Swordfish1", "Swordfish2", "Swordfish3"],
		requiresCompanion: "Swordfish",
		requiresPass: "SwordfishPass",
		order: 11,
	},
	Jellyfish: {
		displayName: "Jellyfish",
		quests: ["Jellyfish1", "Jellyfish2", "Jellyfish3"],
		requiresCompanion: "Jellyfish",
		requiresPass: "JellyfishPass",
		order: 12,
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
/** Ids of QUESTS drawn for the daily / weekly boards (3 of each, the same for every player). */
export const DAILY_QUEST_POOL: readonly string[] = [
	"DailyCoins",
	"DailyCoinsBig",
	"DailyEggs",
	"DailyEggsBig",
	"DailyFeed",
	"DailyAnomaly",
	"DailySize",
];
export const WEEKLY_QUEST_POOL: readonly string[] = [
	"WeeklyCoins",
	"WeeklyEggs",
	"WeeklyFeed",
	"WeeklyGhost",
	"WeeklyRelease",
	"WeeklyLikes",
	"WeeklySize",
];
/**
 * Rebirths a player needs before their daily / weekly boards open (decided by the owner, V0.48): the first hours stay
 * on the story quests; dailies come with the second aquarium, weeklies with the third.
 */
export const BOARD_UNLOCK_REBIRTHS: Record<QuestBoardCategory, number> = { Daily: 2, Weekly: 3 };

export function isBoardUnlocked(category: QuestBoardCategory, rebirths: number): boolean {
	return rebirths >= BOARD_UNLOCK_REBIRTHS[category];
}

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
