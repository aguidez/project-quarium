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
	| "Swordfish3";

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
}

export const PERKS: Record<Perk, PerkConfig> = {
	CoinLinger1: {
		displayName: "Lasting coins",
		label: "+1s",
		description: "Coins stay 1 second longer on the sand.",
		groundTimeBonus: 1,
		bounce: false,
	},
	CoinLinger2: {
		displayName: "Lasting coins II",
		label: "+2s",
		description: "Coins stay 2 more seconds on the sand.",
		groundTimeBonus: 2,
		bounce: false,
	},
	CoinBounce: {
		displayName: "Bouncy coins",
		label: "Boing",
		description: "Coins bounce once when they reach the sand, before their timer starts.",
		groundTimeBonus: 0,
		bounce: true,
	},
	FishSatiety: {
		displayName: "Hearty meals",
		label: "+15s",
		description: "Your fish stay full 15 seconds longer after eating.",
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
};

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
