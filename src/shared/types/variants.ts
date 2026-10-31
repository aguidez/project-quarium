import { FISH_TYPES, FishType, SPECIAL_COIN_MULTIPLIER, SPECIAL_COIN_ODDS } from "./fish";

/**
 * Every hatched fish is drawn a variant on top of its species. Variants are rare, look different and
 * earn a bit more; each one is its own entry of the Fish Index.
 */
export type FishVariant = "Normal" | "Anomaly" | "Ghost" | "Shiny";

export interface VariantConfig {
	displayName: string;
	/** What it brings, shown when the Fish Index's variant column is hovered. */
	description: string;
	/** Chance at hatch, for every species (Normal takes what is left). */
	chance: number;
	/** Coins come this much more often (the drop interval is divided by it). */
	coinRate: number;
	/** Sparkling coins come this much more often. */
	specialOddsMultiplier: number;
	/** Its sparkling coins are ghost coins instead, worth GHOST_COIN_MULTIPLIER sparkling coins. */
	ghostCoins: boolean;
	/** Its fish sparkle, like sparkling coins. */
	sparkles: boolean;
	/** Release order when no variant is picked: the lowest rank first. */
	rank: number;
	/** Ocean Points of a release (or a rebirth) are the species' times this. */
	oceanPointsMultiplier: number;
}

/**
 * Balance (tools/economy-sim.js): a normal fish earns 1 + 1/15 (one coin out of 15 sparkles, x2).
 * Anomaly +20 %, Ghost +25 % (14/15 + 6/15), Shiny +35 % (anomaly pace and one coin out of 5
 * sparkling: 1.2 × 1.2 / 1.0667). The rarer, the richer. On average (10 % / 5 % / 1 %) +3.6 %
 * income: first rebirth 28.9 → 27.7 min, the six first species 61.5 → 58.2 min (medians), well
 * inside the spread between players (p10–p90 of the rebirth: 21–36 min). Prices are left as they
 * are: the rebirth price sits on a threshold of the savings curve (5,250 $ would push it to 42 min).
 */
export const FISH_VARIANTS: Record<FishVariant, VariantConfig> = {
	Normal: {
		displayName: "Normal",
		description: "The species as you know it.",
		chance: 0,
		coinRate: 1,
		specialOddsMultiplier: 1,
		ghostCoins: false,
		sparkles: false,
		rank: 0,
		oceanPointsMultiplier: 1,
	},
	Anomaly: {
		displayName: "Anomaly",
		description: "Alternate colours. Drops its coins 1.2x as often. Worth 2x Ocean Points.",
		chance: 0.1,
		coinRate: 1.2,
		specialOddsMultiplier: 1,
		ghostCoins: false,
		sparkles: false,
		rank: 1,
		oceanPointsMultiplier: 2,
	},
	Ghost: {
		displayName: "Ghost",
		description: "See-through. Its sparkling coins become ghost coins, worth 3x more. Worth 3x Ocean Points.",
		chance: 0.05,
		coinRate: 1,
		specialOddsMultiplier: 1,
		ghostCoins: true,
		sparkles: false,
		rank: 2,
		oceanPointsMultiplier: 3,
	},
	Shiny: {
		displayName: "Shiny",
		description:
			"Alternate colours and sparkles. Drops its coins 1.2x as often, with 3x more sparkling coins. Worth 5x Ocean Points.",
		chance: 0.01,
		// An alternate colour like the anomaly, with its pace, so the rarest variant is also the richest
		coinRate: 1.2,
		specialOddsMultiplier: 3,
		ghostCoins: false,
		sparkles: true,
		rank: 3,
		oceanPointsMultiplier: 5,
	},
};

/** Fish Index columns, and draw order of rollVariant (the rarest first). */
export const VARIANT_ORDER: readonly FishVariant[] = ["Normal", "Anomaly", "Ghost", "Shiny"];

/** A ghost coin (replacing a ghost fish's sparkling coin) is worth this many sparkling coins. */
export const GHOST_COIN_MULTIPLIER = 3;

/** Variants that wear a recoloured texture (a FishVariantAppearance, see tags.ts); a ghost turns translucent instead. */
export const RECOLOURED_VARIANTS: readonly FishVariant[] = ["Anomaly", "Shiny"];

export function isFishVariant(value: unknown): value is FishVariant {
	return typeIs(value, "string") && FISH_VARIANTS[value as FishVariant] !== undefined;
}

/**
 * Draws the variant of a hatching fish: Shiny 1 %, Ghost 5 %, Anomaly 10 %, else Normal. `luck` multiplies
 * the rare variants' chances (Ocean milestone "VariantLuck": x1.5 = 1.5 % / 7.5 % / 15 %).
 */
export function rollVariant(rng: Random, luck = 1): FishVariant {
	let roll = rng.NextNumber();
	for (let i = VARIANT_ORDER.size() - 1; i >= 1; i--) {
		const variant = VARIANT_ORDER[i];
		roll -= FISH_VARIANTS[variant].chance * luck;
		if (roll < 0) return variant;
	}
	return "Normal";
}

/**
 * Ocean Points of releasing one fish of the species in the variant. Rare variants are worth more to
 * the Ocean (x2 / x3 / x5), so letting one go (or rebirthing with it) is never a plain loss.
 */
export function getOceanPoints(fishType: FishType, variant: FishVariant): number {
	return FISH_TYPES[fishType].oceanPoints * FISH_VARIANTS[variant].oceanPointsMultiplier;
}

/** One coin out of this many sparkles, for a fish of the variant. */
export function getSpecialCoinOdds(variant: FishVariant): number {
	return SPECIAL_COIN_ODDS / FISH_VARIANTS[variant].specialOddsMultiplier;
}

/** Average coin income of the variant, relative to a normal fish of the same species (sparkling coins included). */
export function getVariantIncomeMultiplier(variant: FishVariant): number {
	const config = FISH_VARIANTS[variant];
	const normalSpecial = 1 / SPECIAL_COIN_ODDS;
	const special = 1 / getSpecialCoinOdds(variant);
	const specialValue = SPECIAL_COIN_MULTIPLIER * (config.ghostCoins ? GHOST_COIN_MULTIPLIER : 1);
	const perCoin = 1 - special + special * specialValue;
	return (config.coinRate * perCoin) / (1 - normalSpecial + normalSpecial * SPECIAL_COIN_MULTIPLIER);
}

/** Percent shown next to a variant ("10%"), from its chance. */
/** "10%": the chance at hatch, with the player's variant luck (Lucky ocean, the Lucky pass) like rollVariant. */
export function formatVariantChance(variant: FishVariant, luck = 1): string {
	let chance = FISH_VARIANTS[variant].chance * luck;
	if (variant === "Normal") {
		chance = 1;
		for (const other of VARIANT_ORDER) chance -= FISH_VARIANTS[other].chance * luck;
	}
	return `${math.floor(chance * 1000 + 0.5) / 10}%`;
}
