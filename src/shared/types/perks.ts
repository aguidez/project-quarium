/**
 * Perks: permanent bonuses earned through quests (kept through rebirths, like the quests themselves).
 * Their effects add up: CoinLinger1 + CoinLinger2 keep coins on the sand 3 s longer.
 */
export type Perk = "CoinLinger1" | "CoinLinger2" | "CoinBounce" | "FishSatiety" | "PelicanDouble" | "PelicanCharges";

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
