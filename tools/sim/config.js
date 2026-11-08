// The economy simulator's mirror of the live config: src/shared/types/fish.ts, eggs.ts, rebirths.ts, variants.ts,
// size.ts, quests.ts and the milestones of oceanRewards.ts. Keep the numbers below in sync when the balance changes
// (CLAUDE.md §0c), then run `npm run sim` and write the results in BALANCE.md.
// buildConfig() merges a --plan file and the JSON overrides on top and returns plain data (no functions), so the
// worker threads can rebuild the same config and the segment cache can fingerprint it.
const path = require("path");

const FISH = {
	Basic: { income: 4, interval: 4, ocean: 1, growth: [[0, 1]] },
	Big: {
		income: 25,
		interval: 10,
		ocean: 2,
		growth: [
			[0, 1],
			[300, 1.2],
		],
	},
	RedTetra: { income: 48, interval: 8, ocean: 4 },
	Clownfish: { income: 180, interval: 12, ocean: 15 },
	ZebraDanio: { income: 150, interval: 5, ocean: 25 },
	FlameGourami: { income: 1400, interval: 20, ocean: 80 },
	SilverAngelfish: { income: 2400, interval: 15, ocean: 150 },
	PirateFish: { income: 1500, interval: 5, ocean: 250 },
	ImperialDiscus: { income: 17500, interval: 25, ocean: 500 },
	// Rebirths 3–4 (V0.38, ROADMAP M2: the plan's numbers)
	Catfish: { income: 16000, interval: 10, ocean: 800 },
	BlueTang: { income: 19200, interval: 6, ocean: 1300 },
	BabySunfish: { income: 130000, interval: 20, ocean: 2000 },
	// Rebirth 5 (V0.40, ROADMAP M4)
	Lanternfish: { income: 156000, interval: 12, ocean: 3200 },
	// Rebirth 6 (V0.42, ROADMAP M5)
	Lionfish: { income: 208000, interval: 8, ocean: 5000 },
	Dragonfish: { income: 1300000, interval: 25, ocean: 8000 },
	// Rebirths 7–8 (V0.44, ROADMAP M6): the end of V1
	WolfDogfish: { income: 1575000, interval: 15, ocean: 13000 },
	BunnyShark: { income: 4200000, interval: 20, ocean: 20000 },
	MiniLeviathan: { income: 12600000, interval: 30, ocean: 32000 },
	// V1.2 (V1.1.21): the Aurora Glacier's species
	FoxBetta: { income: 10080000, interval: 12, ocean: 51000 },
	// V1.2 (V1.1.22): the Sky Archipelago's species
	CloudWhale: { income: 33600000, interval: 20, ocean: 82000 },
	PegasusSeahorse: { income: 100800000, interval: 30, ocean: 131000 },
	// V1.2 M5 (V1.1.23): the Rainbow Dreamland's
	KittyKoi: { income: 53760000, interval: 8, ocean: 210000 },
	// V1.2 M6 (V1.1.24): the Heart of the Ocean's, the last two of V1.2
	SeaTurtle: { income: 268800000, interval: 20, ocean: 336000 },
	BabyKraken: { income: 806400000, interval: 30, ocean: 537000 },
};
// Easter egg fish (fish.ts FishConfig.easterEgg): hidden chance (percent) per egg opened, taken from the egg's
// most common fish; no variant; a coin every `interval` s worth `share` of the tank's theoretical income per
// minute (other fish only), so it earns `share` x the tank's income; leaves for the ocean after `lifetime` s
// in the water. Not a species of the "all species" count. The Alien Fish (hatchChance 0: only from the UFO night)
// is not here: events are not modelled (BALANCE.md §3 Easter eggs). Nor is Sugar (likeChance 1 % per like received,
// bestFishShare 1.1: copies the best fish): likes between players are not modelled.
const EASTER = { FrenchFish: { chance: 0.1, share: 0.5, interval: 60, lifetime: 3600, ocean: 100 } };
const FIRST_SIX = ["Basic", "Big", "RedTetra", "Clownfish", "ZebraDanio", "FlameGourami"];
const DEFAULT_GROWTH = [
	[0, 1],
	[300, 1.2],
	[600, 1.5],
];
// Fish variants (src/shared/types/variants.ts): chance at hatch, and income vs a normal fish of the type.
// A normal fish earns 1 + 1/15 (one coin in 15 sparkles, x2). Anomaly: coins 1.2x as often. Ghost: its
// sparkling coins become ghost coins worth 3 sparkling ones. Shiny: anomaly pace + 3x the sparkling coins
const VARIANTS = [
	// Galaxy (V1.1.20): coins 1.5x as often, one out of 5 a star coin worth 3 coins
	{ name: "Galaxy", chance: 0.002, mult: (1.5 * (4 / 5 + (1 / 5) * 3)) / (1 + 1 / 15), ocean: 10 },
	{ name: "Shiny", chance: 0.01, mult: 1.2 * ((4 / 5 + (1 / 5) * 2) / (1 + 1 / 15)), ocean: 5 },
	{ name: "Ghost", chance: 0.05, mult: (14 / 15 + (1 / 15) * 6) / (1 + 1 / 15), ocean: 3 },
	{ name: "Anomaly", chance: 0.1, mult: 1.2, ocean: 2 },
];
const EGGS = [
	{ name: "Common", price: 100, hatch: 3, odds: { Basic: 80, Big: 20 } },
	{ name: "Improved", price: 500, hatch: 8, odds: { Basic: 30, Big: 52, RedTetra: 18 } },
	{ name: "Superior", price: 2500, hatch: 20, odds: { Big: 35, RedTetra: 50, Clownfish: 15 } },
	{ name: "Freshwater", price: 25000, hatch: 45, odds: { RedTetra: 45, ZebraDanio: 40, FlameGourami: 15 } },
	{ name: "Amazon", price: 150000, hatch: 75, odds: { FlameGourami: 55, SilverAngelfish: 45 } },
	{
		name: "NeonCoral",
		price: 2500000,
		hatch: 120,
		odds: { SilverAngelfish: 25, PirateFish: 55, ImperialDiscus: 20 },
	},
	{ name: "Wreck", price: 78e6, hatch: 135, odds: { ImperialDiscus: 55, Catfish: 45 } },
	{ name: "Atlantis", price: 210e6, hatch: 150, odds: { Catfish: 25, BlueTang: 55, BabySunfish: 20 } },
	{ name: "Trench", price: 8.9e9, hatch: 165, odds: { BabySunfish: 55, Lanternfish: 45 } },
	{ name: "Volcano", price: 23e9, hatch: 180, odds: { Lanternfish: 25, Lionfish: 55, Dragonfish: 20 } },
	{ name: "Crystal", price: 1.2e12, hatch: 180, odds: { Dragonfish: 55, WolfDogfish: 45 } },
	{ name: "Cosmic", price: 2.6e12, hatch: 180, odds: { WolfDogfish: 25, BunnyShark: 55, MiniLeviathan: 20 } },
	{ name: "Aurora", price: 400e12, hatch: 180, odds: { MiniLeviathan: 55, FoxBetta: 45 } },
	{ name: "Sky", price: 770e12, hatch: 180, odds: { FoxBetta: 25, CloudWhale: 55, PegasusSeahorse: 20 } },
	{ name: "Dreamland", price: 50e15, hatch: 180, odds: { PegasusSeahorse: 55, KittyKoi: 45 } },
	{ name: "Heart", price: 96e15, hatch: 180, odds: { KittyKoi: 25, SeaTurtle: 55, BabyKraken: 20 } },
];
// Rebirth n is REBIRTHS[n - 1] (rebirths.ts): price, total coin multiplier, start money
const REBIRTHS = [
	{ price: 5000, mult: 2.5, start: 300 },
	{ price: 1300000, mult: 8, start: 300 },
	{ price: 65e6, mult: 25, start: 300 },
	{ price: 175e6, mult: 80, start: 300 },
	{ price: 7.4e9, mult: 250, start: 300 },
	{ price: 19e9, mult: 800, start: 300 },
	{ price: 1e12, mult: 2500, start: 300 },
	{ price: 2.2e12, mult: 8000, start: 300 },
	{ price: 200e12, mult: 25000, start: 300 },
	{ price: 640e12, mult: 120000, start: 300 },
	{ price: 3e15, mult: 375000, start: 300 },
	{ price: 80e15, mult: 1200000, start: 300 },
];
// Capacity milestones (oceanRewards.ts, kind "Capacity"): the tank holds `capacity` fish from `points` Ocean Points
const CAPACITY = [
	{ points: 1500, capacity: 15 },
	{ points: 8000, capacity: 17 },
	{ points: 25000, capacity: 19 },
	{ points: 70000, capacity: 21 },
	{ points: 180000, capacity: 23 },
	{ points: 450000, capacity: 25 },
	{ points: 1.5e6, capacity: 27 },
	{ points: 4e6, capacity: 29 },
	{ points: 9e6, capacity: 31 },
	{ points: 20e6, capacity: 33 },
];
// oceanRewards.ts (only reported, except the capacity / incubator / hatch ones)
const OCEAN_MILESTONES = [
	50, 100, 200, 500, 1500, 5000, 8000, 25000, 40000, 70000, 85000, 120000, 180000, 200000, 300000, 450000, 1000000,
	1500000, 2500000, 4000000, 6000000, 9000000, 14000000, 20000000, 40000000,
];
// Incubator milestones (oceanRewards.ts, kind "Incubator"): from `points` Ocean Points, `count` eggs of the same type
// can incubate at once
const INCUBATORS = [{ points: 5000, count: 2 }];
// Hatch-time milestones (the Water Hen companion, live since V0.40, assumed equipped): from `points` Ocean Points, eggs
// hatch in `mult` x their time
const HATCH = [{ points: 85000, mult: 0.85 }];
// Story quest rewards that move the economy (quests.ts, the Voyage line): minutes of income when a species is
// discovered, Ocean Points when rebirth n is done. Other rewards (perks, cosmetics) are not modelled.
const QUEST_REWARDS = {
	discover: {
		FlameGourami: 5,
		ImperialDiscus: 5,
		Catfish: 5,
		BabySunfish: 5,
		Lanternfish: 5,
		Dragonfish: 5,
		WolfDogfish: 5,
		MiniLeviathan: 5,
		FoxBetta: 5,
		PegasusSeahorse: 5,
		KittyKoi: 5,
		BabyKraken: 5,
	},
	rebirth: {
		2: 500,
		3: 1500,
		4: 4000,
		5: 10000,
		6: 25000,
		7: 60000,
		8: 150000,
		9: 375000,
		10: 900000,
		11: 2200000,
		12: 5000000,
	},
};
// The free side lines (quests.ts, live since V0.46). Hatchery: minutes of income at each total of fish hatched.
// Collector (opens with "Full House"): its quests in order, a variant found or a number of Fish Index cells
// (species x variant), each worth Ocean Points or minutes of income. Ocean (after "Full House"): minutes of income at
// `releases` fish released to make room (a rebirth's release doesn't count). Titles and decor are not modelled.
const SIDE_QUESTS = {
	hatchery: { at: [100, 300, 600, 900, 1200, 1800, 2500, 3500], minutes: 2 }, // 1,800+ since V1.1.24
	collector: [
		{ variant: "Anomaly", minutes: 2 },
		{ cells: 10, minutes: 2 },
		{ variant: "Ghost", minutes: 3 },
		{ cells: 25, ocean: 2500 },
		{ variant: "Shiny", ocean: 2500 },
		{ cells: 50, ocean: 0 },
		{ cells: 75, minutes: 3 }, // V1.1.20 (90 cells with the Galaxy column)
		{ variant: "Galaxy", minutes: 3 },
		// V1.1.24: the Shiny of species 21-24 (5,000,000 points) is not modelled (the line's variants are any species'),
		// so the cells goals after it wait for nothing: the Galaxy rims and the title cost nothing
		{ cells: 100, ocean: 0 },
		{ cells: 120, ocean: 0 },
	],
	ocean: [
		{ releases: 50, minutes: 3 },
		{ releases: 500, minutes: 5 }, // V1.1.24
	],
	// Big Catch (quests.ts, V1.1.16): hatch a fish of `size` or more, or hold `count` of them at once
	bigCatch: [
		{ size: 10, minutes: 3 },
		{ size: 10, count: 5, minutes: 5 },
		{ size: 13, minutes: 5 },
		{ size: 15, minutes: 0 },
	],
};
const P = {
	collect: 0.5, // share of coin value the player collects (0.5 = average player, calibrated)
	special: 1 + 1 / 15, // special coins x2 one time out of 15
	food: 0, // per pellet: free since V0.60.6 (the food reserve: 5 portions, each one back 10 s after use)
	feedEvery: 35, // seconds between two meals of a fish
	capacity: 10,
	reveal: 3.8,
	onboarding: 90, // seconds to finish the tutorial
	onboardingReward: 300,
	rebirths: null, // how many rebirths the player does (null = all of REBIRTHS)
	cheapEggRatio: 0.2, // only buys an egg worth >= this share of the best unlocked egg
	coinBoost: 1, // a coin multiplier on top of everything (gamepass estimate only)
	hatchMult: null, // hatch-time multiplier once the Hen is owned, replacing HATCH's (paid Hen quests estimate only)
	oceanBoost: 1, // an Ocean Points multiplier (gamepass estimate only)
	hatchScale: 1, // hatch times x this (the owner's test speed, "/speed" in Studio: 1 / speed)
	// Daily / weekly quests (quests.ts pools, V0.46): the reference player plays hoursPerDay each day (BALANCE.md:
	// the timeline is for 1 h a day) and claims, mid-session, the 3 dailies (dailyBoostMinutes of coin boost in
	// all) and, mid-week, the 3 weeklies (weeklyBoostMinutes). The boost multiplies the coins by boostMult and
	// runs down only while playing (PlayerData.coinBoostSeconds). 0 hours: no daily quests (play time only)
	hoursPerDay: 1,
	dailyBoostMinutes: 15,
	weeklyBoostMinutes: 45,
	dailyFromRebirth: 2, // the boards open at rebirth 2 (dailies) and 3 (weeklies): quests.ts BOARD_UNLOCK_REBIRTHS
	weeklyFromRebirth: 3,
	boostMult: 2,
	checkpoints: [15, 30, 60, 90, 120, 150, 180, 240, 300, 360],
	horizon: 32 * 3600, // V1.2 ends with the 24 species after rebirth 12 (~25h12); room for the slowest players
	players: 2000,
	sizeMax: 15, // the Size score's range (shared/types/size SIZE_MAX, live since V1.1.16); 0 = none
	seed: 1, // the random draws: player i always plays the same game for a given seed (`--seed n` for another sample)
};

const clone = (x) => JSON.parse(JSON.stringify(x));

/**
 * The config of a run: the live one above, or a --plan file's tables, with the JSON overrides on top (same merge
 * rules as the simulator always had). Returns plain data.
 */
function buildConfig({ planPath, overrides = {}, players, seed } = {}) {
	const plan = planPath ? require(path.resolve(planPath)) : {};
	const cfg = {
		planName: planPath ? plan.name || planPath : null,
		FISH: clone(plan.FISH || FISH),
		EASTER: clone(EASTER),
		FIRST_SIX: clone(FIRST_SIX),
		DEFAULT_GROWTH: clone(DEFAULT_GROWTH),
		VARIANTS: clone(overrides.VARIANTS || plan.VARIANTS || VARIANTS),
		EGGS: clone(overrides.EGGS || plan.EGGS || EGGS),
		REBIRTHS: clone(overrides.REBIRTHS || plan.REBIRTHS || REBIRTHS),
		CAPACITY: clone(overrides.CAPACITY || plan.CAPACITY || CAPACITY),
		OCEAN_MILESTONES: clone(plan.OCEAN_MILESTONES || OCEAN_MILESTONES),
		INCUBATORS: clone(plan.INCUBATORS || INCUBATORS),
		HATCH: clone(plan.HATCH || HATCH),
		QUEST_REWARDS: Object.assign({ discover: {}, rebirth: {} }, clone(plan.QUEST_REWARDS || QUEST_REWARDS)),
		SIDE_QUESTS: clone(overrides.SIDE_QUESTS || plan.SIDE_QUESTS || SIDE_QUESTS),
		P: Object.assign(clone(P), plan.P || {}, overrides.P || {}),
	};
	if (players !== undefined) cfg.P.players = Number(players);
	if (seed !== undefined) cfg.P.seed = Number(seed);
	if (cfg.P.rebirths !== null) cfg.REBIRTHS = cfg.REBIRTHS.slice(0, cfg.P.rebirths);
	if (overrides.FISH) Object.assign(cfg.FISH, clone(overrides.FISH));
	return cfg;
}

module.exports = { buildConfig };
