// V1.2 balance plan (ROADMAP_V1.2.md, M1): the live V1 economy plus rebirths 9–12, eggs 13–16, species 19–24, tank
// 25 → 33, the new Ocean milestones and quests, the Size score and the Galaxy variant. Not in the game: played by
//   node tools/economy-sim.js --plan tools/balance-v1.2-plan.js [--players 300]
// V1's numbers below are a copy of the live config (tools/economy-sim.js): keep them equal until V1.2 is built, then
// move the new numbers into the game and the live simulator, and remove this file (as tools/balance-v1-plan.js in V0.50).

const V1_FISH = {
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
	Catfish: { income: 16000, interval: 10, ocean: 800 },
	BlueTang: { income: 19200, interval: 6, ocean: 1300 },
	BabySunfish: { income: 130000, interval: 20, ocean: 2000 },
	Lanternfish: { income: 156000, interval: 12, ocean: 3200 },
	Lionfish: { income: 208000, interval: 8, ocean: 5000 },
	Dragonfish: { income: 1300000, interval: 25, ocean: 8000 },
	WolfDogfish: { income: 1575000, interval: 15, ocean: 13000 },
	BunnyShark: { income: 4200000, interval: 20, ocean: 20000 },
	MiniLeviathan: { income: 12600000, interval: 30, ocean: 32000 },
};
// Species 19–24 (ROADMAP_V1.2 §3.2): income x2 per species, Ocean Points x1.6, quick / slow intervals
const V12_FISH = {
	FoxBetta: { income: 10.08e6, interval: 12, ocean: 51000 },
	CloudWhale: { income: 33.6e6, interval: 20, ocean: 82000 },
	PegasusSeahorse: { income: 100.8e6, interval: 30, ocean: 131000 },
	KittyKoi: { income: 53.76e6, interval: 8, ocean: 210000 },
	SeaTurtle: { income: 268.8e6, interval: 20, ocean: 336000 },
	BabyKraken: { income: 806.4e6, interval: 30, ocean: 537000 },
};

const V1_EGGS = [
	{ name: "Common", price: 100, hatch: 3, odds: { Basic: 80, Big: 20 } },
	{ name: "Improved", price: 500, hatch: 8, odds: { Basic: 30, Big: 52, RedTetra: 18 } },
	{ name: "Superior", price: 2500, hatch: 20, odds: { Big: 35, RedTetra: 50, Clownfish: 15 } },
	{ name: "Freshwater", price: 25000, hatch: 45, odds: { RedTetra: 45, ZebraDanio: 40, FlameGourami: 15 } },
	{ name: "Amazon", price: 150000, hatch: 75, odds: { FlameGourami: 55, SilverAngelfish: 45 } },
	{ name: "NeonCoral", price: 2500000, hatch: 120, odds: { SilverAngelfish: 25, PirateFish: 55, ImperialDiscus: 20 } },
	{ name: "Wreck", price: 78e6, hatch: 135, odds: { ImperialDiscus: 55, Catfish: 45 } },
	{ name: "Atlantis", price: 210e6, hatch: 150, odds: { Catfish: 25, BlueTang: 55, BabySunfish: 20 } },
	{ name: "Trench", price: 8.9e9, hatch: 165, odds: { BabySunfish: 55, Lanternfish: 45 } },
	{ name: "Volcano", price: 23e9, hatch: 180, odds: { Lanternfish: 25, Lionfish: 55, Dragonfish: 20 } },
	{ name: "Crystal", price: 1.2e12, hatch: 180, odds: { Dragonfish: 55, WolfDogfish: 45 } },
	{ name: "Cosmic", price: 2.6e12, hatch: 180, odds: { WolfDogfish: 25, BunnyShark: 55, MiniLeviathan: 20 } },
];

const V1_REBIRTHS = [
	{ price: 5000, mult: 2.5, start: 300 },
	{ price: 1300000, mult: 8, start: 300 },
	{ price: 65e6, mult: 25, start: 300 },
	{ price: 175e6, mult: 80, start: 300 },
	{ price: 7.4e9, mult: 250, start: 300 },
	{ price: 19e9, mult: 800, start: 300 },
	{ price: 1e12, mult: 2500, start: 300 },
	{ price: 2.2e12, mult: 8000, start: 300 },
];

// Rebirths 9–12 (ROADMAP_V1.2 §3.4), tuned with this simulator (M1, 2026-11-07). Two rules of the model shape them:
// - an even rebirth (10, 12) sits at ≤ ~1.6x the egg its run farms (the Aurora / Dreamland Egg): above it the average
//   player keeps buying that egg to swap its baby fish and never saves up (a cliff: 400T → 15h43, 500T → never);
// - so a run is lengthened by its 1-species egg (Aurora 2x rebirth 9, Dreamland ~17x rebirth 11) rather than by the
//   rebirth, and rebirth 10's multiplier is x4.8 (not ~x3.2) so that the Sky Egg (2 species) can be farmed at all.
const V12_REBIRTHS = [
	{ price: 200e12, mult: 25000, start: 300 },
	{ price: 640e12, mult: 120000, start: 300 },
	{ price: 3e15, mult: 375000, start: 300 },
	{ price: 80e15, mult: 1200000, start: 300 },
];
const V12_EGGS = [
	{ name: "Aurora", price: 400e12, hatch: 180, odds: { MiniLeviathan: 55, FoxBetta: 45 } },
	{ name: "Sky", price: 770e12, hatch: 180, odds: { FoxBetta: 25, CloudWhale: 55, PegasusSeahorse: 20 } },
	{ name: "Dreamland", price: 50e15, hatch: 180, odds: { PegasusSeahorse: 55, KittyKoi: 45 } },
	{ name: "Heart", price: 96e15, hatch: 180, odds: { KittyKoi: 25, SeaTurtle: 55, BabyKraken: 20 } },
];

// Variants (variants.ts) + Galaxy (§3.6): coins 1.5x as often, one coin out of 5 a star coin worth 3 coins
const NORMAL_COIN = 1 + 1 / 15;
const VARIANTS = [
	{ name: "Galaxy", chance: 0.002, mult: (1.5 * (4 / 5 + (1 / 5) * 3)) / NORMAL_COIN, ocean: 10 },
	{ name: "Shiny", chance: 0.01, mult: (1.2 * (4 / 5 + (1 / 5) * 2)) / NORMAL_COIN, ocean: 5 },
	{ name: "Ghost", chance: 0.05, mult: (14 / 15 + (1 / 15) * 6) / NORMAL_COIN, ocean: 3 },
	{ name: "Anomaly", chance: 0.1, mult: 1.2, ocean: 2 },
];

module.exports = {
	name: "V1.2 plan (ROADMAP_V1.2.md)",
	FISH: { ...V1_FISH, ...V12_FISH },
	EGGS: [...V1_EGGS, ...V12_EGGS],
	REBIRTHS: [...V1_REBIRTHS, ...V12_REBIRTHS],
	CAPACITY: [
		{ points: 1500, capacity: 15 },
		{ points: 8000, capacity: 17 },
		{ points: 25000, capacity: 19 },
		{ points: 70000, capacity: 21 },
		{ points: 180000, capacity: 23 },
		{ points: 450000, capacity: 25 },
		// §6: one step of 2 per rebirth
		{ points: 1.5e6, capacity: 27 },
		{ points: 4e6, capacity: 29 },
		{ points: 9e6, capacity: 31 },
		{ points: 20e6, capacity: 33 },
	],
	OCEAN_MILESTONES: [
		50, 100, 200, 500, 1500, 5000, 8000, 25000, 40000, 70000, 85000, 120000, 180000, 200000, 300000, 450000, 1e6,
		1.5e6, 2.5e6, 4e6, 6e6, 9e6, 14e6, 20e6, 40e6,
	],
	INCUBATORS: [{ points: 5000, count: 2 }],
	HATCH: [{ points: 85000, mult: 0.85 }],
	QUEST_REWARDS: {
		// Voyage (§7.1): 5 min of income per signature species, Ocean Points per rebirth
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
		rebirth: { 2: 500, 3: 1500, 4: 4000, 5: 10000, 6: 25000, 7: 60000, 8: 150000, 9: 375000, 10: 900000, 11: 2.2e6, 12: 5e6 },
	},
	SIDE_QUESTS: {
		hatchery: { at: [100, 300, 600, 900, 1200, 1800, 2500, 3500], minutes: 2 },
		collector: [
			{ variant: "Anomaly", minutes: 2 },
			{ cells: 10, minutes: 2 },
			{ variant: "Ghost", minutes: 3 },
			{ cells: 25, ocean: 2500 },
			{ variant: "Shiny", ocean: 2500 },
			{ cells: 50, ocean: 0 },
			// §7.2
			{ cells: 75, minutes: 3 },
			{ variant: "Shiny", species: ["PegasusSeahorse", "KittyKoi", "SeaTurtle", "BabyKraken"], label: "Mythic", ocean: 5e6 },
			{ variant: "Galaxy", minutes: 3 },
			{ cells: 100, ocean: 0 },
			{ cells: 120, ocean: 0 },
		],
		ocean: [
			{ releases: 50, minutes: 3 },
			{ releases: 500, minutes: 5 },
		],
		// Big Catch (§7.2, Size score)
		bigCatch: [
			{ size: 10, minutes: 3 },
			{ size: 10, count: 5, minutes: 5 },
			{ size: 13, minutes: 5 },
			{ size: 15, minutes: 0 },
		],
	},
	VARIANTS,
	P: {
		sizeMax: 15,
		horizon: 32 * 3600,
		checkpoints: [15, 30, 60, 90, 120, 180, 240, 360, 480, 600, 720, 900, 1080, 1260, 1440, 1620],
	},
};
