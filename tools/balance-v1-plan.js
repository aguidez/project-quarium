// V1 balance plan (BALANCE.md §5, dev plan in ROADMAP.md): 18 species, 12 eggs, 8 rebirths, a tank growing from
// 10 to 25 fish through the Ocean milestones, 5 companions. Not in the game yet: species 10–18, eggs 7–12,
// rebirths 3–8, the Ocean milestones above 1,500 and the new companions. Species 1–9, eggs 1–6 and rebirths 1–2 are
// the live ones. When V1 is built, these numbers become the config (fish.ts, eggs.ts, rebirths.ts, oceanRewards.ts).
// Played by: node tools/economy-sim.js --plan tools/balance-v1-plan.js
//            node tools/companion-sim.js --plan tools/balance-v1-plan.js
// Growth (default): x1, x1.2 after 5 min, x1.5 after 10 min. `ocean`: Ocean Points of a release.
module.exports = {
	name: "V1 (18 species, 12 eggs, 8 rebirths, 25 fish)",
	FISH: {
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
		// --- V1 species (the owner's list, ordered by aquarium) ---
		Catfish: { income: 16000, interval: 10, ocean: 800 }, // 1,600/s
		BlueTang: { income: 19200, interval: 6, ocean: 1300 }, // 3,200/s
		BabySunfish: { income: 130000, interval: 20, ocean: 2000 }, // 6,500/s
		Lanternfish: { income: 156000, interval: 12, ocean: 3200 }, // 13,000/s
		Lionfish: { income: 208000, interval: 8, ocean: 5000 }, // 26,000/s
		Dragonfish: { income: 1300000, interval: 25, ocean: 8000 }, // 52,000/s
		WolfDogfish: { income: 1575000, interval: 15, ocean: 13000 }, // 105,000/s
		BunnyShark: { income: 4200000, interval: 20, ocean: 20000 }, // 210,000/s
		MiniLeviathan: { income: 12600000, interval: 30, ocean: 32000 }, // 420,000/s
	},
	EGGS: [
		{ name: "Common", price: 100, hatch: 3, odds: { Basic: 80, Big: 20 } },
		{ name: "Improved", price: 500, hatch: 8, odds: { Basic: 30, Big: 52, RedTetra: 18 } },
		{ name: "Superior", price: 2500, hatch: 20, odds: { Big: 35, RedTetra: 50, Clownfish: 15 } },
		{ name: "Freshwater", price: 25000, hatch: 45, odds: { RedTetra: 45, ZebraDanio: 40, FlameGourami: 15 } },
		{ name: "Amazon", price: 150000, hatch: 75, odds: { FlameGourami: 55, SilverAngelfish: 45 } },
		{
			name: "NeonCoral",
			price: 2.5e6,
			hatch: 120,
			odds: { SilverAngelfish: 25, PirateFish: 55, ImperialDiscus: 20 },
		},
		// --- V1 eggs: one per aquarium, 1.2x the rebirth that opens it ---
		{ name: "Wreck", price: 55e6, hatch: 135, odds: { ImperialDiscus: 55, Catfish: 45 } },
		{ name: "Atlantis", price: 144e6, hatch: 150, odds: { Catfish: 25, BlueTang: 55, BabySunfish: 20 } },
		{ name: "Trench", price: 6.1e9, hatch: 165, odds: { BabySunfish: 55, Lanternfish: 45 } },
		{ name: "Volcano", price: 15.6e9, hatch: 180, odds: { Lanternfish: 25, Lionfish: 55, Dragonfish: 20 } },
		{ name: "Crystal", price: 830e9, hatch: 180, odds: { Dragonfish: 55, WolfDogfish: 45 } },
		{ name: "Cosmic", price: 1.8e12, hatch: 180, odds: { WolfDogfish: 25, BunnyShark: 55, MiniLeviathan: 20 } },
	],
	// Rebirth n: Lagoon, Neon Coral, Pirate Wreck, Atlantis, Mariana Trench, Volcanic Temple, Crystal Caverns, Cosmic Sanctuary
	REBIRTHS: [
		{ price: 5e3, mult: 2.5, start: 300 },
		{ price: 1.3e6, mult: 8, start: 300 },
		{ price: 4.5e7, mult: 25, start: 300 },
		{ price: 120e6, mult: 80, start: 300 },
		{ price: 5.1e9, mult: 250, start: 300 },
		{ price: 13e9, mult: 800, start: 300 },
		{ price: 690e9, mult: 2500, start: 300 },
		{ price: 1.5e12, mult: 8000, start: 300 },
	],
	CAPACITY: [
		{ points: 1500, capacity: 15 },
		{ points: 8000, capacity: 17 },
		{ points: 25000, capacity: 19 },
		{ points: 70000, capacity: 21 },
		{ points: 180000, capacity: 23 },
		{ points: 450000, capacity: 25 },
	],
	INCUBATORS: [{ points: 5000, count: 2 }],
	// The Water Hen (Ocean 85,000, free): eggs hatch 15 % faster while it is equipped. The average player is assumed to
	// equip it (an active player feeds by hand). Its paid quests (up to -35 %) are a gamepass estimate: P.hatchMult.
	HATCH: [{ points: 85000, mult: 0.85 }],
	// Every Ocean milestone (BALANCE.md §5.7), reported; capacity, incubator and Hen also act in the simulation
	OCEAN_MILESTONES: [
		50, 100, 200, 500, 1500, 5000, 8000, 25000, 40000, 70000, 85000, 120000, 180000, 200000, 300000, 450000,
		1000000,
	],
	// Story quests of the "Voyage" line (BALANCE.md §5.9): 5 min of income for a signature species, Ocean Points
	// for a rebirth (keyed by the rebirth's number)
	QUEST_REWARDS: {
		discover: {
			FlameGourami: 5,
			ImperialDiscus: 5,
			Catfish: 5,
			BabySunfish: 5,
			Lanternfish: 5,
			Dragonfish: 5,
			WolfDogfish: 5,
			MiniLeviathan: 5,
		},
		rebirth: { 2: 500, 3: 1500, 4: 4000, 5: 10000, 6: 25000, 7: 60000, 8: 150000 },
	},
	// Companions (node tools/companion-sim.js --plan tools/balance-v1-plan.js).
	// Pelican (free): its Ocean upgrade x1.33 (every 7.5 s, live since V0.36): with all its quests it keeps 15 fish fed.
	// Jellyfish (Ocean 200,000, free): starts as a maxed Pelican; its quests (gamepass) take it to 25 fish.
	PELICAN_UPGRADE: 1.33,
	PELICAN_STAGES: [
		{ name: "Jellyfish (Ocean 200k, free)", interval: 7.5, pellets: 2, charges: 2, satiety: 15 },
		{ name: "+ pass quest 1: 3 charges, every 6 s", interval: 6, pellets: 2, charges: 3, satiety: 15 },
		{ name: "+ pass quest 2: every 5 s", interval: 5, pellets: 2, charges: 3, satiety: 15 },
		{ name: "+ pass quest 3: 3 pellets", interval: 5, pellets: 3, charges: 3, satiety: 15 },
	],
	// Snail (free): its Ocean upgrade x1.15 (live since V0.36): with all its quests ~60 % of the coins at 1 coin/s.
	// Swordfish (Ocean 120,000, free): swims and grabs coins while they sink; starts as a maxed Snail, its quests
	// (gamepass) take it to ~95 %. Speeds are x the Snail's 3.6 studs/s, reach in studs.
	SNAIL_UPGRADE: 1.15,
	SNAIL_STAGES: [
		{ name: "Swordfish (Ocean 120k, free)", speed: 0.95, ground: 9.5, pickup: 22, reach: 2 },
		{ name: "+ pass quest 1: x1.4, reach 2.5", speed: 1.4, ground: 9.5, pickup: 22, reach: 2.5 },
		{ name: "+ pass quest 2: x1.8, reach 3", speed: 1.8, ground: 9.5, pickup: 22, reach: 3 },
		{ name: "+ pass quest 3: x2.2, reach 3.2", speed: 2.2, ground: 9.5, pickup: 22, reach: 3.2 },
	],
	P: {
		checkpoints: [30, 60, 120, 180, 240, 360, 480, 600, 720, 840],
		horizon: 18 * 3600,
	},
};
