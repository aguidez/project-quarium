/**
 * Companions: special creatures of the aquarium, earned through progression (quests...).
 * Immortal, they never eat and don't drop coins like a fish: each one has its own ability
 * that changes how the player plays. Only `companionSlots` of them can be equipped at once.
 */
export type CompanionType = "Snail" | "Pelican" | "WaterHen" | "Swordfish";

export interface CompanionConfig {
	displayName: string;
	icon: string; // old emoji icon, unused by the UI now (see image)
	/** Sticker icon (design/ui/companions), shown in the companion panel, the rewards and the Ocean menu. */
	image: string;
	/** What it does for the player, shown in the companion panel. */
	ability: string;
}

export const COMPANION_TYPES: Record<CompanionType, CompanionConfig> = {
	Snail: {
		displayName: "Snail",
		icon: "🐌",
		image: "rbxassetid://126880573502867",
		ability: "Crawls along the bottom of your aquarium and picks up the coins for you.",
	},
	Pelican: {
		displayName: "Pelican",
		icon: "",
		image: "rbxassetid://125583206090759",
		ability: "Watches your aquarium from above and throws food to your fish every 10 s.",
	},
	// V1 companions (ROADMAP M4, BALANCE.md §5.8): free from the Ocean, upgraded by a gamepass quest line
	WaterHen: {
		displayName: "Water Hen",
		icon: "",
		image: "rbxassetid://106605624608137", // design/ui/companions/Companion_WaterHen.png
		ability: "Paddles on the surface of your aquarium. While equipped, the eggs you buy hatch 15% faster.",
	},
	Swordfish: {
		displayName: "Swordfish",
		icon: "",
		image: "rbxassetid://94908996690740", // design/ui/companions/Companion_Swordfish.png
		ability: "Swims through the water and grabs the coins for you while they sink.",
	},
};

/** Seconds between two pellets the Pelican throws into its owner's aquarium. */
export const PELICAN_FEED_INTERVAL = 10;

/**
 * Hatch time of the eggs bought while the Water Hen is equipped (x their time); its Water Hen pass quests lower it
 * further (perks.ts hatchMultiplier).
 */
export const WATER_HEN_HATCH_MULTIPLIER = 0.85;

/** Companions a player can have in their aquarium at first; PlayerData.companionSlots grows with progression. */
export const DEFAULT_COMPANION_SLOTS = 1;
