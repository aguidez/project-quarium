/**
 * What the food looks like. The better it feeds (the satiety bonus of the owner's perks, see
 * getSatietyBonus), the more filling it looks: each look has a minimum bonus, the best one reached wins.
 * Every look except the default pellet is a Studio template (tag FoodTemplate, attribute "FoodLook").
 */
export type FoodLook = "Pellet" | "Shrimp";

export interface FoodLookConfig {
	look: FoodLook;
	/** Satiety bonus (seconds) from which the food takes this look. */
	minSatietyBonus: number;
}

/** From the plainest to the most filling. */
export const FOOD_LOOKS: readonly FoodLookConfig[] = [
	{ look: "Pellet", minSatietyBonus: 0 },
	{ look: "Shrimp", minSatietyBonus: 15 }, // Hearty meals
];

export function getFoodLook(satietyBonus: number): FoodLook {
	let best: FoodLook = "Pellet";
	for (const config of FOOD_LOOKS) if (satietyBonus >= config.minSatietyBonus) best = config.look;
	return best;
}
