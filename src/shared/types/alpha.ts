import type { CosmeticId } from "./cosmetics";
import { EGG_TYPES, EggType } from "./eggs";
import { FishType } from "./fish";

/**
 * The alpha (V0.60.0): a short version of the game for the first testers, the content of the first ~2h15 of the
 * reference player (BALANCE.md §7): rebirths 1–2, the eggs up to the Neon Coral Egg (the nine first species), the
 * Ocean milestones up to the second incubator, the story quests of that part, the daily quests (no weekly ones), no
 * gamepass for sale. Finding the nine species ends it with the ALPHA_TITLE and a thank-you message.
 *
 * Every check below lets everything through once ALPHA_ENABLED is off (the release). A save already past the alpha
 * (more rebirths than ALPHA_MAX_REBIRTHS, made before it) keeps the whole game: the alpha stops progress, it never
 * takes back what a save has.
 */
export const ALPHA_ENABLED = true;

/** Rebirths a player can do in the alpha: the Lagoon, then the Neon Coral Lagoon. */
export const ALPHA_MAX_REBIRTHS = 2;
/** The best egg of the alpha (the eggs after it in shop order are left out). */
export const ALPHA_LAST_EGG: EggType = "NeonCoral";
/** The last Ocean milestone of the alpha: the second incubator. Points keep counting past it. */
export const ALPHA_MAX_OCEAN_POINTS = 5000;
/** Story quests of the alpha: a line stops (finished) at its first quest not listed here. */
export const ALPHA_STORY_QUESTS: readonly string[] = [
	"Story1", // First steps
	"Story2", // Ocean line
	"Ocean1",
	"Ocean2",
	"Story9", // Voyage: up to the Imperial Discus of the Neon Coral Lagoon
	"Voyage1",
	"Voyage2",
	"Voyage3",
	"Story3", // Snail
	"Story4",
	"Story5",
	"Story6", // Pelican
	"Story7",
	"Story8",
	"Hatchery1",
	"Collector1",
	"Collector2",
	"Collector3",
];
/** Earned by finding every species of the alpha; only during the alpha, kept forever. */
export const ALPHA_TITLE: CosmeticId = "TitleAlphaPioneer";

/** Whether the alpha's limits apply to a save with this many rebirths. */
export function isAlphaLimited(rebirths: number): boolean {
	return ALPHA_ENABLED && rebirths <= ALPHA_MAX_REBIRTHS;
}

/** Whether rebirth n (1-based) and its aquarium are in the game for a player who has done `rebirths` rebirths. */
export function isRebirthAvailable(rebirth: number, rebirths: number): boolean {
	return !isAlphaLimited(rebirths) || rebirth <= ALPHA_MAX_REBIRTHS;
}

/** Whether a player who has done `rebirths` rebirths may do the next one. */
export function isNextRebirthAvailable(rebirths: number): boolean {
	return isRebirthAvailable(rebirths + 1, rebirths);
}

export function isEggAvailable(eggType: EggType, rebirths: number): boolean {
	return !isAlphaLimited(rebirths) || EGG_TYPES[eggType].order <= EGG_TYPES[ALPHA_LAST_EGG].order;
}

/** The species the alpha's eggs hatch (easter eggs aside: they are in no egg's odds). */
function getAlphaSpecies(): FishType[] {
	const species = new Array<FishType>();
	for (const [, config] of pairs(EGG_TYPES)) {
		if (config.order > EGG_TYPES[ALPHA_LAST_EGG].order) continue;
		for (const { fishType } of config.odds) if (!species.includes(fishType)) species.push(fishType);
	}
	return species;
}
export const ALPHA_SPECIES: readonly FishType[] = getAlphaSpecies();

/** A species the player can find (Fish Index, egg lists). Easter eggs always can. */
export function isSpeciesAvailable(fishType: FishType, rebirths: number): boolean {
	return !isAlphaLimited(rebirths) || ALPHA_SPECIES.includes(fishType);
}

export function isOceanMilestoneAvailable(points: number, rebirths: number): boolean {
	return !isAlphaLimited(rebirths) || points <= ALPHA_MAX_OCEAN_POINTS;
}

export function isStoryQuestAvailable(questId: string, rebirths: number): boolean {
	return !isAlphaLimited(rebirths) || ALPHA_STORY_QUESTS.includes(questId);
}

/** Gamepasses are not sold during the alpha (the ones already owned keep working). */
export function arePassesOnSale(): boolean {
	return !ALPHA_ENABLED;
}

/** Every species of the alpha hatched at least once: the end of the alpha. */
export function hasFinishedAlpha(hatched: Partial<Record<FishType, number>>): boolean {
	return ALPHA_SPECIES.every((fishType) => (hatched[fishType] ?? 0) > 0);
}
