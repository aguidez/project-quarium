import { FOOD_REFILL_TIME, FOOD_RESERVE_SLOTS } from "./food";

/**
 * Perks: permanent bonuses earned through quests (kept through rebirths, like the quests themselves).
 * Their effects add up: CoinLinger1 + CoinLinger2 keep coins on the sand 3 s longer.
 */
export type Perk =
	| "CoinLinger1"
	| "CoinLinger2"
	| "CoinBounce"
	| "FishSatiety"
	| "PelicanDouble"
	| "PelicanCharges"
	| "WaterHen1"
	| "WaterHen2"
	| "WaterHen3"
	| "Swordfish1"
	| "Swordfish2"
	| "Swordfish3"
	| "Jellyfish1"
	| "Jellyfish2"
	| "Jellyfish3"
	| "FoodRefill1"
	| "FoodRefill2"
	| "FoodRefill3"
	| "FoodSlot1"
	| "HermitCrab1"
	| "HermitCrab2"
	| "HermitCrab3";

export interface PerkConfig {
	displayName: string;
	/** Short text drawn as the reward's icon (quest book, reward popup). */
	label: string;
	description: string;
	/** Seconds a coin stays on the sand before vanishing, on top of the normal lifetime. */
	groundTimeBonus: number;
	/** Coins bounce once when they reach the sand (COIN_BOUNCE_TIME), before their ground timer starts. */
	bounce: boolean;
	/** Seconds a fed fish stays full before turning hungry, on top of its species' time. */
	satietyBonus?: number;
	/** Pellets the Pelican throws at once. */
	pelicanPellets?: number;
	/**
	 * The Pelican feeds on demand: it stores up to this many charges (one more every feeding interval)
	 * and spends one, right away, when a fish is hungry; it never throws food when no fish needs it.
	 */
	pelicanCharges?: number;
	/** Hatch time (x the egg's) of the eggs bought with the Water Hen equipped, instead of its 0.85. */
	hatchMultiplier?: number;
	/** The Swordfish swims this many times the Snail's speed (instead of SWORDFISH_SPEED)... */
	swordfishSpeed?: number;
	/** ...and grabs coins from this far (studs, instead of SWORDFISH_REACH). */
	swordfishReach?: number;
	/** The Jellyfish stores up to this many food charges (instead of JELLYFISH_CHARGES)... */
	jellyfishCharges?: number;
	/** ...gets one every this many seconds (instead of JELLYFISH_FEED_INTERVAL)... */
	jellyfishInterval?: number;
	/** ...and drops this many pellets a feed (instead of JELLYFISH_PELLETS). */
	jellyfishPellets?: number;
	/** A used portion of the food reserve comes back after this many seconds (instead of FOOD_REFILL_TIME); the best one counts. */
	foodRefillTime?: number;
	/** Portions the food reserve holds on top of FOOD_RESERVE_SLOTS. */
	foodSlots?: number;
	/** The Hermit Crab's variant luck with its full bonus (instead of HERMIT_CRAB_LUCK); the best one counts. */
	crabLuck?: number;
}

export const PERKS: Record<Perk, PerkConfig> = {
	CoinLinger1: {
		displayName: "Lasting coins",
		label: "+1s",
		description: "Coins stay 1 second longer on the sand. Permanent, even without your Snail.",
		groundTimeBonus: 1,
		bounce: false,
	},
	CoinLinger2: {
		displayName: "Lasting coins II",
		label: "+2s",
		description: "Coins stay 2 more seconds on the sand. Permanent, even without your Snail.",
		groundTimeBonus: 2,
		bounce: false,
	},
	CoinBounce: {
		displayName: "Bouncy coins",
		label: "Boing",
		description:
			"Coins bounce once when they reach the sand, before their timer starts. Permanent, even without your Snail.",
		groundTimeBonus: 0,
		bounce: true,
	},
	FishSatiety: {
		displayName: "Hearty meals",
		label: "+15s",
		description: "Your fish stay full 15 seconds longer after eating. Permanent, even without your Pelican.",
		groundTimeBonus: 0,
		bounce: false,
		satietyBonus: 15,
	},
	PelicanDouble: {
		displayName: "Double serving",
		label: "x2",
		description: "Your Pelican throws 2 pellets instead of 1.",
		groundTimeBonus: 0,
		bounce: false,
		pelicanPellets: 2,
	},
	PelicanCharges: {
		displayName: "Smart Pelican",
		label: "2",
		description: "Your Pelican only feeds hungry fish, right away. It stores up to 2 food charges.",
		groundTimeBonus: 0,
		bounce: false,
		pelicanCharges: 2,
	},
	// The Water Hen's line (Water Hen pass, BALANCE.md §5.9): eggs opened with it equipped
	WaterHen1: {
		displayName: "Swift hatching",
		label: "-22%",
		description: "With your Water Hen equipped, eggs hatch 22% faster.",
		groundTimeBonus: 0,
		bounce: false,
		hatchMultiplier: 0.78,
	},
	WaterHen2: {
		displayName: "Swift hatching II",
		label: "-28%",
		description: "With your Water Hen equipped, eggs hatch 28% faster.",
		groundTimeBonus: 0,
		bounce: false,
		hatchMultiplier: 0.72,
	},
	WaterHen3: {
		displayName: "Swift hatching III",
		label: "-35%",
		description: "With your Water Hen equipped, eggs hatch 35% faster.",
		groundTimeBonus: 0,
		bounce: false,
		hatchMultiplier: 0.65,
	},
	// The Swordfish's line (Swordfish pass): coins it picks up
	Swordfish1: {
		displayName: "Quick fins",
		label: "x1.4",
		description: "Your Swordfish swims 1.4x as fast and reaches coins from further away.",
		groundTimeBonus: 0,
		bounce: false,
		swordfishSpeed: 1.4,
		swordfishReach: 2.5,
	},
	Swordfish2: {
		displayName: "Quick fins II",
		label: "x1.8",
		description: "Your Swordfish swims 1.8x as fast and reaches coins from further away.",
		groundTimeBonus: 0,
		bounce: false,
		swordfishSpeed: 1.8,
		swordfishReach: 3,
	},
	Swordfish3: {
		displayName: "Quick fins III",
		label: "x2.2",
		description: "Your Swordfish swims 2.2x as fast and reaches coins from further away.",
		groundTimeBonus: 0,
		bounce: false,
		swordfishSpeed: 2.2,
		swordfishReach: 3.2,
	},
	// The Jellyfish's line (Jellyfish pass, BALANCE.md §5.8): fish it feeds. 19 / 23 / 25 fish kept fed AFK
	Jellyfish1: {
		displayName: "Big appetite",
		label: "3",
		description: "Your Jellyfish stores 3 food charges and gets one every 6 s.",
		groundTimeBonus: 0,
		bounce: false,
		jellyfishCharges: 3,
		jellyfishInterval: 6,
	},
	Jellyfish2: {
		displayName: "Quick tentacles",
		label: "5s",
		description: "Your Jellyfish gets a food charge every 5 s.",
		groundTimeBonus: 0,
		bounce: false,
		jellyfishInterval: 5,
	},
	Jellyfish3: {
		displayName: "Feast",
		label: "x3",
		description: "Your Jellyfish drops 3 pellets at a time.",
		groundTimeBonus: 0,
		bounce: false,
		jellyfishPellets: 3,
	},
	// The Fish Keeper line (meals given by hand, V1.1.19, ROADMAP_V1.2 §5): the reserve feeds ~24 / ~27 / ~33 fish by hand
	FoodRefill1: {
		displayName: "Quick refill",
		label: "9s",
		description: "A portion of your food reserve comes back in 9 seconds instead of 10.",
		groundTimeBonus: 0,
		bounce: false,
		foodRefillTime: 9,
	},
	FoodRefill2: {
		displayName: "Quicker refill",
		label: "8s",
		description: "A portion of your food reserve comes back in 8 seconds.",
		groundTimeBonus: 0,
		bounce: false,
		foodRefillTime: 8,
	},
	// The Quick pantry Ocean milestone (6,000,000 points, ROADMAP_V1.2 §6): the best refill wins
	FoodRefill3: {
		displayName: "Quick pantry",
		label: "7s",
		description: "A portion of your food reserve comes back in 7 seconds.",
		groundTimeBonus: 0,
		bounce: false,
		foodRefillTime: 7,
	},
	FoodSlot1: {
		displayName: "Bigger reserve",
		label: "+1",
		description: "Your food reserve holds 6 portions instead of 5.",
		groundTimeBonus: 0,
		bounce: false,
		foodSlots: 1,
	},
	// The Hermit Crab's line (Hermit Crab Pass, ROADMAP_V1.2 §8): eggs opened with its full bonus
	HermitCrab1: {
		displayName: "Lucky shell",
		label: "x1.35",
		description: "With your Hermit Crab, your eggs hatch rare variants x1.35 more often.",
		groundTimeBonus: 0,
		bounce: false,
		crabLuck: 1.35,
	},
	HermitCrab2: {
		displayName: "Lucky shell II",
		label: "x1.45",
		description: "With your Hermit Crab, your eggs hatch rare variants x1.45 more often.",
		groundTimeBonus: 0,
		bounce: false,
		crabLuck: 1.45,
	},
	HermitCrab3: {
		displayName: "Lucky shell III",
		label: "x1.6",
		description: "With your Hermit Crab, your eggs hatch rare variants x1.6 more often.",
		groundTimeBonus: 0,
		bounce: false,
		crabLuck: 1.6,
	},
};

/** The Hermit Crab's variant luck with its full bonus (HERMIT_CRAB_LUCK, or its best quest perk). */
export function getCrabFullLuck(perks: readonly Perk[], base: number): number {
	let luck = base;
	for (const perk of perks) luck = math.max(luck, PERKS[perk].crabLuck ?? base);
	return luck;
}

/** The player's food reserve: portions it holds and seconds a used one takes to come back (FoodService, the HUD). */
export function getFoodReserve(perks: readonly Perk[]): { slots: number; refillTime: number } {
	let slots = FOOD_RESERVE_SLOTS;
	let refillTime = FOOD_REFILL_TIME;
	for (const perk of perks) {
		const config = PERKS[perk];
		slots += config.foodSlots ?? 0;
		if (config.foodRefillTime !== undefined) refillTime = math.min(refillTime, config.foodRefillTime);
	}
	return { slots, refillTime };
}

/** How long a coin's bounce lasts (up and down) when the player has CoinBounce. */
export const COIN_BOUNCE_TIME = 1.5;

/** Extra seconds on the sand given by these perks. */
export function getGroundTimeBonus(perks: readonly Perk[]): number {
	let bonus = 0;
	for (const perk of perks) bonus += PERKS[perk].groundTimeBonus;
	return bonus;
}

/** Extra seconds a fed fish stays full. */
export function getSatietyBonus(perks: readonly Perk[]): number {
	let bonus = 0;
	for (const perk of perks) bonus += PERKS[perk].satietyBonus ?? 0;
	return bonus;
}

/** Pellets per Pelican throw (1 without a perk). */
export function getPelicanPellets(perks: readonly Perk[]): number {
	let pellets = 1;
	for (const perk of perks) pellets = math.max(pellets, PERKS[perk].pelicanPellets ?? 1);
	return pellets;
}

/** Food charges of an on-demand Pelican, or 0 while it still feeds on a timer. */
export function getPelicanCharges(perks: readonly Perk[]): number {
	let charges = 0;
	for (const perk of perks) charges = math.max(charges, PERKS[perk].pelicanCharges ?? 0);
	return charges;
}

export function hasCoinBounce(perks: readonly Perk[]): boolean {
	return perks.some((perk) => PERKS[perk].bounce);
}

/** Hatch time multiplier of the Water Hen's perks (the lowest one wins), or undefined without any. */
export function getPerkHatchMultiplier(perks: readonly Perk[]): number | undefined {
	let best: number | undefined;
	for (const perk of perks) {
		const multiplier = PERKS[perk].hatchMultiplier;
		if (multiplier !== undefined && (best === undefined || multiplier < best)) best = multiplier;
	}
	return best;
}

/** The Swordfish's speed (x the Snail's) and reach from its perks, defaults when it has none. */
export function getSwordfishStats(
	perks: readonly Perk[],
	speed: number,
	reach: number,
): { speed: number; reach: number } {
	for (const perk of perks) {
		const config = PERKS[perk];
		if (config.swordfishSpeed !== undefined) speed = math.max(speed, config.swordfishSpeed);
		if (config.swordfishReach !== undefined) reach = math.max(reach, config.swordfishReach);
	}
	return { speed, reach };
}

/** The Jellyfish's feeding from its perks: the best of each, the defaults when it has none. */
export function getJellyfishStats(
	perks: readonly Perk[],
	defaults: { charges: number; interval: number; pellets: number },
): { charges: number; interval: number; pellets: number } {
	let { charges, interval, pellets } = defaults;
	for (const perk of perks) {
		const config = PERKS[perk];
		if (config.jellyfishCharges !== undefined) charges = math.max(charges, config.jellyfishCharges);
		if (config.jellyfishInterval !== undefined) interval = math.min(interval, config.jellyfishInterval);
		if (config.jellyfishPellets !== undefined) pellets = math.max(pellets, config.jellyfishPellets);
	}
	return { charges, interval, pellets };
}
