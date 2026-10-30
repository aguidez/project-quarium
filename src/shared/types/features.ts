/**
 * Game features unlocked through progression (quest rewards, the first affordable rebirth...).
 * Each one comes with a short tutorial the first time (PlayerData.tutorialsDone).
 */
export type Feature = "Ocean" | "Rebirth";

export interface FeatureConfig {
	displayName: string;
	/** Drawn icon (design/ui/v2), shown by the quest book and the reward popup. */
	image: string;
	description: string;
}

export const FEATURES: Record<Feature, FeatureConfig> = {
	Ocean: {
		displayName: "The Ocean",
		image: "rbxassetid://86767682222210", // Icon_Ocean.png
		description: "Release fish back to the ocean to earn Ocean Points.",
	},
	Rebirth: {
		displayName: "Rebirth",
		image: "rbxassetid://123446163856086", // Icon_Rebirth.png
		description: "Start over with a permanent coin multiplier and a new aquarium.",
	},
};

/**
 * The Ocean: a released fish leaves the tank for good (freeing its spot) and earns its
 * FishConfig.oceanPoints. Ocean Points are a score that only grows: they will unlock companions,
 * advantages and aquarium upgrades.
 */
export const MIN_FISH_KEPT = 1; // can't release the last fish (the free starter egg would make points free)
