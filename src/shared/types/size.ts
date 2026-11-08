/**
 * The Size score: every fish hatched from an egg gets a whole number from -SIZE_MAX to +SIZE_MAX,
 * drawn by the server when the egg is opened and kept for the fish's whole life (SavedFish.size). The fish is
 * x getSizeMultiplier bigger and its coins are worth as much more; its Ocean Points don't change. Shown to the player
 * as a percentage with a tier ("+12% Huge"): never hidden, it is a reason to farm better fish.
 * The special fish (easter eggs) have none (0).
 */

export const SIZE_MAX = 15;

export type SizeTier = "Tiny" | "Small" | "Normal" | "Big" | "Huge" | "Giant" | "Titan";

export interface SizeTierConfig {
	/** Lowest score of the tier (its highest is the next tier's min - 1). */
	min: number;
	displayName: string;
}

/** From the smallest up (BALANCE.md: the draw's chances per tier). */
export const SIZE_TIERS: readonly [SizeTier, SizeTierConfig][] = [
	["Tiny", { min: -15, displayName: "Tiny" }], // 6.7 %
	["Small", { min: -9, displayName: "Small" }], // 22.7 %
	["Normal", { min: -3, displayName: "Normal" }], // 41.2 %
	["Big", { min: 4, displayName: "Big" }], // 22.7 %
	["Huge", { min: 10, displayName: "Huge" }], // 5.3 %, one egg in 19
	["Giant", { min: 13, displayName: "Giant" }], // 1.3 %, one in 75
	["Titan", { min: 15, displayName: "Titan" }], // 0.056 %, one in 1,800
];

/**
 * Draws a Size score: the sum of two dice (a triangular draw), so 0 is the most common and the ends are rare.
 * round((u1 + u2 - 1) x SIZE_MAX), u1 and u2 uniform in [0, 1].
 */
export function rollSize(rng: Random): number {
	const size = math.floor((rng.NextNumber() + rng.NextNumber() - 1) * SIZE_MAX + 0.5);
	return math.clamp(size, -SIZE_MAX, SIZE_MAX);
}

/** A valid Size score (saves, sanitising): whole, in range; anything else reads as 0. */
export function toSize(value: unknown): number {
	if (!typeIs(value, "number") || value !== value) return 0;
	return math.clamp(math.floor(value + 0.5), -SIZE_MAX, SIZE_MAX);
}

/** Coins and body x this: +12 → 1.12. */
export function getSizeMultiplier(size: number): number {
	return 1 + size / 100;
}

export function getSizeTier(size: number): SizeTier {
	let tier: SizeTier = "Tiny";
	for (const [name, config] of SIZE_TIERS) if (size >= config.min) tier = name;
	return tier;
}

/** "+12%", "-5%", "0%". */
export function formatSize(size: number): string {
	return size > 0 ? `+${size}%` : `${size}%`;
}
