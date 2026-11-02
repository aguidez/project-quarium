import { FISH_VARIANTS, FishVariant, VARIANT_ORDER } from "./variants";

/**
 * The starfall (an event, StarfallService): shooting stars fall into every owned aquarium and the owner clicks them like
 * coins. Each one fills the star gauge (PlayerData.starCharge) by a random amount, bigger stars more; the gauge holds
 * STAR_MAX_BARS bars. When the event ends the gauge becomes the player's star power (PlayerData.starPower, the best of
 * the old and the new one): their next opened egg draws its variant from getStarVariantOdds instead of the usual
 * chances, then the power is spent.
 */
export type StarSize = "Small" | "Medium" | "Big" | "Huge";

export interface StarSizeConfig {
	/** Share of the stars of this size (out of the sizes' total). */
	weight: number;
	/** Bars of the gauge one star fills, drawn between the two (the luck of the event). */
	power: [number, number];
	/** Size of the star in studs (the clickable hitbox is a bit bigger). */
	studs: number;
}

/**
 * Tuned with a Monte Carlo of the event (BALANCE.md §3 Starfall): catching every star gives 2.5 bars at the median
 * (p10 1.8), 3 bars one time in five; three stars out of four give 1.8 (3 bars one time in twenty).
 */
export const STAR_SIZES: Record<StarSize, StarSizeConfig> = {
	Small: { weight: 56, power: [0.05, 0.09], studs: 1.3 },
	Medium: { weight: 30, power: [0.11, 0.18], studs: 1.8 },
	Big: { weight: 11, power: [0.25, 0.4], studs: 2.5 },
	Huge: { weight: 3, power: [0.6, 0.9], studs: 3.4 },
};

/** Draw order of the sizes (the rarest last). */
export const STAR_SIZE_ORDER: readonly StarSize[] = ["Small", "Medium", "Big", "Huge"];

export const STAR_MAX_BARS = 3;

export const STARFALL = {
	/** Stars falling into each tank during the event (a tank joining late gets its share of the time left). */
	starsMin: 16,
	starsMax: 20,
	/** Seconds after the start before the first star, and before the end after the last one falls. */
	firstDelay: 2,
	lastLead: 8,
	/**
	 * Least gauge at the end: this many bars x the share of the tank's stars caught. Catching every star always gives
	 * 1.5 bars at least, whatever the stars' sizes.
	 */
	floor: 1.5,
};

/**
 * Each full bar guarantees a variant; what is filled of the next bar (0 → 1) raises the chances of the better ones
 * from `from` to `to`. Under one bar, the gauge multiplies the usual variant chances by 1 → 1 + EMPTY_BAR_LUCK.
 */
export const STAR_BARS: { guaranteed: FishVariant; better: Partial<Record<FishVariant, [number, number]>> }[] = [
	{ guaranteed: "Anomaly", better: { Ghost: [0.1, 0.4], Shiny: [0.02, 0.06] } },
	{ guaranteed: "Ghost", better: { Shiny: [0.05, 0.4] } },
	{ guaranteed: "Shiny", better: {} },
];
const EMPTY_BAR_LUCK = 2;

/** Hitbox attribute of a falling star: its StarSize (the clients draw it from there). */
export const STAR_SIZE_ATTRIBUTE = "StarSize";
/** Hitbox attribute set when its owner catches it: the clients burst it (it is destroyed a moment later). */
export const STAR_CAUGHT_ATTRIBUTE = "Caught";
/** Hitbox attribute set for the last STAR_FADE_TIME seconds of a star on the sand: the clients make it blink. */
export const STAR_FADING_ATTRIBUTE = "Fading";
export const STAR_FADE_TIME = 1.5;

export function drawStarSize(rng: Random): StarSize {
	let total = 0;
	for (const size of STAR_SIZE_ORDER) total += STAR_SIZES[size].weight;
	let roll = rng.NextNumber() * total;
	for (const size of STAR_SIZE_ORDER) {
		roll -= STAR_SIZES[size].weight;
		if (roll < 0) return size;
	}
	return "Small";
}

export function isStarSize(value: unknown): value is StarSize {
	return typeIs(value, "string") && STAR_SIZES[value as StarSize] !== undefined;
}

/** The gauge at the end of the event: what the stars filled, at least the floor for the share caught. */
export function getFinalStarCharge(charge: number, caught: number, fallen: number): number {
	const floor = fallen > 0 ? (STARFALL.floor * caught) / fallen : 0;
	return math.clamp(math.max(charge, floor), 0, STAR_MAX_BARS);
}

/** Chances of each variant for an egg opened with this star power (they add up to 1). `luck`: the player's own. */
export function getStarVariantOdds(power: number, luck = 1): Record<FishVariant, number> {
	const odds: Record<FishVariant, number> = { Normal: 0, Anomaly: 0, Ghost: 0, Shiny: 0 };
	const bars = math.clamp(power, 0, STAR_MAX_BARS);
	const full = math.floor(bars);
	const part = bars - full;
	if (full === 0) {
		const boosted = luck * (1 + EMPTY_BAR_LUCK * part);
		let rest = 1;
		for (const variant of VARIANT_ORDER) {
			if (variant === "Normal") continue;
			odds[variant] = math.min(FISH_VARIANTS[variant].chance * boosted, rest);
			rest -= odds[variant];
		}
		odds.Normal = rest;
		return odds;
	}
	const bar = STAR_BARS[math.min(full, STAR_BARS.size()) - 1];
	let rest = 1;
	// The rarest first, so a lucky player's chances never push the guaranteed variant below 0
	for (let i = VARIANT_ORDER.size() - 1; i >= 0; i--) {
		const variant = VARIANT_ORDER[i];
		const range = bar.better[variant];
		if (!range) continue;
		odds[variant] = math.min((range[0] + (range[1] - range[0]) * part) * luck, rest);
		rest -= odds[variant];
	}
	odds[bar.guaranteed] += rest;
	return odds;
}

/** The variant of an egg opened with star power (see getStarVariantOdds). */
export function rollStarVariant(rng: Random, power: number, luck = 1): FishVariant {
	const odds = getStarVariantOdds(power, luck);
	let roll = rng.NextNumber();
	for (let i = VARIANT_ORDER.size() - 1; i >= 1; i--) {
		roll -= odds[VARIANT_ORDER[i]];
		if (roll < 0) return VARIANT_ORDER[i];
	}
	return "Normal";
}

/** The variant the star power guarantees (Normal under one bar). */
export function getGuaranteedVariant(power: number): FishVariant {
	const full = math.floor(math.clamp(power, 0, STAR_MAX_BARS));
	return full === 0 ? "Normal" : STAR_BARS[full - 1].guaranteed;
}
