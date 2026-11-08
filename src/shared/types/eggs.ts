import { FISH_TYPES, FishType } from "./fish";

/** Fish are no longer bought directly: the player buys an egg, which hatches into a random fish. */
export type EggType =
	| "Common"
	| "Improved"
	| "Superior"
	| "Freshwater"
	| "Amazon"
	| "NeonCoral"
	| "Wreck"
	| "Atlantis"
	| "Trench"
	| "Volcano"
	| "Crystal"
	| "Cosmic"
	| "Aurora"
	| "Sky"
	| "Dreamland"
	| "Heart";

export interface EggOdds {
	fishType: FishType;
	chance: number; // percent; the odds of an egg add up to 100
}

export interface EggConfig {
	displayName: string;
	price: number;
	/** Seconds between the purchase and the hatching. Only one egg of a type incubates at a time, so long hatches pace the farming of the best eggs. */
	hatchTime: number;
	odds: readonly EggOdds[];
	order: number; // display order in the shop
	/** Hidden (closed gate in the shop) until the player has bought one egg of this type: the previous rarity. */
	requires?: EggType;
}

/**
 * Balance: see BALANCE.md (timeline, reasons) and tools/economy-sim.js, its mirror tools/sim/config.js (average player collecting
 * ~50% of the coins, feeding its fish, weakest fish released for room, saving for the next egg,
 * rebirthing as soon as it can). Medians: rebirth 1 at ~28 min, the six first species at ~61 min,
 * rebirth 2 at ~1h44, all nine species at ~2h31. The Freshwater Egg (25k) is the wall the first
 * rebirth gets past (x2.5); the Amazon Egg (150k, Silver Angelfish at ~79 min) is the wall of
 * rebirth 2 (1.3M, x8); the Neon Coral Egg (2.5M) costs more than rebirth 2, so players reach it
 * after that rebirth (Pirate ~2h19, Discus ~2h29). Each new egg costs ~6-15x the previous one
 * while the fish income only grows ~2.5x, so every tier takes longer.
 */
export const EGG_TYPES: Record<EggType, EggConfig> = {
	Common: {
		displayName: "Common Egg",
		price: 100,
		hatchTime: 3,
		odds: [
			{ fishType: "Basic", chance: 80 },
			{ fishType: "Big", chance: 20 },
		],
		order: 1,
	},
	Improved: {
		displayName: "Improved Egg",
		price: 500,
		hatchTime: 8,
		odds: [
			{ fishType: "Basic", chance: 30 },
			{ fishType: "Big", chance: 52 },
			{ fishType: "RedTetra", chance: 18 },
		],
		order: 2,
		requires: "Common",
	},
	Superior: {
		displayName: "Superior Egg",
		price: 2500,
		hatchTime: 20,
		odds: [
			{ fishType: "Big", chance: 35 },
			{ fishType: "RedTetra", chance: 50 },
			{ fishType: "Clownfish", chance: 15 },
		],
		order: 3,
		requires: "Improved",
	},
	Freshwater: {
		displayName: "Freshwater Egg",
		price: 25000,
		hatchTime: 45,
		odds: [
			{ fishType: "RedTetra", chance: 45 },
			{ fishType: "ZebraDanio", chance: 40 },
			{ fishType: "FlameGourami", chance: 15 },
		],
		order: 4,
		requires: "Superior",
	},
	Amazon: {
		displayName: "Amazon Egg",
		price: 150000,
		hatchTime: 75,
		odds: [
			{ fishType: "FlameGourami", chance: 55 },
			{ fishType: "SilverAngelfish", chance: 45 },
		],
		order: 5,
		requires: "Freshwater",
	},
	NeonCoral: {
		displayName: "Neon Coral Egg",
		price: 2500000,
		hatchTime: 120,
		odds: [
			{ fishType: "SilverAngelfish", chance: 25 },
			{ fishType: "PirateFish", chance: 55 },
			{ fishType: "ImperialDiscus", chance: 20 },
		],
		order: 6,
		requires: "Amazon",
	},
	// V1 eggs (BALANCE.md §5): one per aquarium, priced 1.2x the rebirth that opens it, so it is reached after
	// that rebirth (rebirth 3: 65M, rebirth 4: 175M, rebirth 5: 7.4B, rebirth 6: 19B, rebirth 7: 1T, rebirth 8: 2.2T; 1.45x
	// the plan's since V0.46, with the rebirths)
	Wreck: {
		displayName: "Wreck Egg",
		price: 78e6,
		hatchTime: 135,
		odds: [
			{ fishType: "ImperialDiscus", chance: 55 },
			{ fishType: "Catfish", chance: 45 },
		],
		order: 7,
		requires: "NeonCoral",
	},
	Atlantis: {
		displayName: "Atlantis Egg",
		price: 210e6,
		hatchTime: 150,
		odds: [
			{ fishType: "Catfish", chance: 25 },
			{ fishType: "BlueTang", chance: 55 },
			{ fishType: "BabySunfish", chance: 20 },
		],
		order: 8,
		requires: "Wreck",
	},
	Trench: {
		displayName: "Trench Egg",
		price: 8.9e9,
		hatchTime: 165,
		odds: [
			{ fishType: "BabySunfish", chance: 55 },
			{ fishType: "Lanternfish", chance: 45 },
		],
		order: 9,
		requires: "Atlantis",
	},
	Volcano: {
		displayName: "Volcano Egg",
		price: 23e9,
		hatchTime: 180,
		odds: [
			{ fishType: "Lanternfish", chance: 25 },
			{ fishType: "Lionfish", chance: 55 },
			{ fishType: "Dragonfish", chance: 20 },
		],
		order: 10,
		requires: "Trench",
	},
	Crystal: {
		displayName: "Crystal Egg",
		price: 1.2e12,
		hatchTime: 180,
		odds: [
			{ fishType: "Dragonfish", chance: 55 },
			{ fishType: "WolfDogfish", chance: 45 },
		],
		order: 11,
		requires: "Volcano",
	},
	Cosmic: {
		displayName: "Cosmic Egg",
		price: 2.6e12,
		hatchTime: 180,
		odds: [
			{ fishType: "WolfDogfish", chance: 25 },
			{ fishType: "BunnyShark", chance: 55 },
			{ fishType: "MiniLeviathan", chance: 20 },
		],
		order: 12,
		requires: "Crystal",
	},
	// V1.2: 2x rebirth 9, the wall of run 9 (tuned with the simulator)
	Aurora: {
		displayName: "Aurora Egg",
		price: 400e12,
		hatchTime: 180,
		odds: [
			{ fishType: "MiniLeviathan", chance: 55 },
			{ fishType: "FoxBetta", chance: 45 },
		],
		order: 13,
		requires: "Cosmic",
	},
	// 1.2x rebirth 10 (tuned with the simulator): bought with the end of run 10's money
	Sky: {
		displayName: "Sky Egg",
		price: 770e12,
		hatchTime: 180,
		odds: [
			{ fishType: "FoxBetta", chance: 25 },
			{ fishType: "CloudWhale", chance: 55 },
			{ fishType: "PegasusSeahorse", chance: 20 },
		],
		order: 14,
		requires: "Aurora",
	},
	// ~17x rebirth 11 (tuned with the simulator): run 11's long wall, after a rebirth only x3.1 the last one
	Dreamland: {
		displayName: "Dreamland Egg",
		price: 50e15,
		hatchTime: 180,
		odds: [
			{ fishType: "PegasusSeahorse", chance: 55 },
			{ fishType: "KittyKoi", chance: 45 },
		],
		order: 15,
		requires: "Sky",
	},
	// 1.2x rebirth 12: the last egg of V1.2
	Heart: {
		displayName: "Heart Egg",
		price: 96e15,
		hatchTime: 180,
		odds: [
			{ fishType: "KittyKoi", chance: 25 },
			{ fishType: "SeaTurtle", chance: 55 },
			{ fishType: "BabyKraken", chance: 20 },
		],
		order: 16,
		requires: "Dreamland",
	},
};

/**
 * Seconds of the hatching animation played by the client (shake, cracks, reveal). The server
 * drops the fish in the aquarium once it ends, so the fish appears right after its reveal.
 */
export const HATCH_REVEAL_TIME = 3.8;

/**
 * Odds an egg is really drawn with: its own, plus each easter egg fish (FishConfig.easterEgg), whose
 * hidden chance is taken from the egg's most common fish. The UI only ever shows EGG_TYPES' odds.
 */
export function getDrawOdds(eggType: EggType): EggOdds[] {
	const odds = EGG_TYPES[eggType].odds.map((entry) => ({ fishType: entry.fishType, chance: entry.chance }));
	let mostCommon = odds[0];
	for (const entry of odds) if (entry.chance > mostCommon.chance) mostCommon = entry;
	for (const [fishType, config] of pairs(FISH_TYPES)) {
		if (!config.easterEgg || config.easterEgg.hatchChance <= 0) continue; // the alien fish: UFO event only
		mostCommon.chance -= config.easterEgg.hatchChance;
		odds.push({ fishType, chance: config.easterEgg.hatchChance });
	}
	return odds;
}

/** Draws the fish an egg hatches into (server only: the client never decides the result). */
export function rollEgg(eggType: EggType, random: Random): FishType {
	const odds = getDrawOdds(eggType);
	let total = 0;
	for (const entry of odds) total += entry.chance;

	const roll = random.NextNumber(0, total);
	let cumulative = 0;
	for (const entry of odds) {
		cumulative += entry.chance;
		if (roll < cumulative) return entry.fishType;
	}
	return odds[odds.size() - 1].fishType;
}

/** Anti-softlock: this egg is free while the player has no fish at all, hatched or incubating. */
export const STARTER_EGG: EggType = "Common";

/** Actual price of an egg for a player who owns `fishAndEggs` fish and incubating eggs. */
export function getEggPrice(eggType: EggType, fishAndEggs: number): number {
	if (eggType === STARTER_EGG && fishAndEggs === 0) return 0;
	return EGG_TYPES[eggType].price;
}

/** Odds of a fish type in an egg, in percent (0 when the egg can't hatch into it). */
export function getHatchChance(eggType: EggType, fishType: FishType): number {
	return EGG_TYPES[eggType].odds.find((entry) => entry.fishType === fishType)?.chance ?? 0;
}
