/**
 * Companions: special creatures of the aquarium, earned through progression (quests...).
 * Immortal, they never eat and don't drop coins like a fish: each one has its own ability
 * that changes how the player plays. Only `companionSlots` of them can be equipped at once.
 */
export type CompanionType = "Snail" | "Pelican" | "WaterHen" | "Swordfish" | "Jellyfish";

export interface CompanionConfig {
	displayName: string;
	icon: string; // old emoji icon, unused by the UI now (see image)
	/** Sticker icon (design/ui/companions), shown in the companion panel, the rewards and the Ocean menu. */
	image: string;
	/** What it does for the player, shown in the companion panel (its numbers: companionStats.ts, with the bonuses). */
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
		ability: "Watches your aquarium from above and throws food to your fish.",
	},
	// V1 companions (ROADMAP M4, BALANCE.md §5.8): free from the Ocean, upgraded by a gamepass quest line
	WaterHen: {
		displayName: "Water Hen",
		icon: "",
		image: "rbxassetid://106605624608137", // design/ui/companions/Companion_WaterHen.png
		ability: "Paddles on the surface of your aquarium. While it is equipped, your eggs hatch faster.",
	},
	Swordfish: {
		displayName: "Swordfish",
		icon: "",
		image: "rbxassetid://94908996690740", // design/ui/companions/Companion_Swordfish.png
		ability: "Swims through the water and grabs the coins for you while they sink.",
	},
	Jellyfish: {
		displayName: "Jellyfish",
		icon: "",
		image: "rbxassetid://96894492239649", // design/ui/companions/Companion_Jellyfish.png
		ability: "Drifts in the water and drops food right above your hungry fish, as soon as they need it.",
	},
};

/** Seconds between two pellets the Pelican throws into its owner's aquarium. */
export const PELICAN_FEED_INTERVAL = 10;

/**
 * Hatch time of the eggs bought while the Water Hen is equipped (x their time); its Water Hen pass quests lower it
 * further (perks.ts hatchMultiplier).
 */
export const WATER_HEN_HATCH_MULTIPLIER = 0.85;

/**
 * The Jellyfish feeds on demand like a maxed Pelican (BALANCE.md §5.8): a food charge every JELLYFISH_FEED_INTERVAL,
 * up to JELLYFISH_CHARGES, JELLYFISH_PELLETS pellets a feed; its Jellyfish pass quests improve it (perks.ts).
 */
export const JELLYFISH_FEED_INTERVAL = 7.5;
/** The free Swordfish (BALANCE.md §5.8: a maxed Snail): x the Snail's speed, and its reach in studs (perks.ts raise them). */
export const SWORDFISH_SPEED = 0.95;
export const SWORDFISH_REACH = 2;
/** Studs/s the Swordfish swims at when there is nothing to grab (CompanionService; FishRigController reads its pace). */
export const SWORDFISH_CRUISE_SPEED = 2;
export const JELLYFISH_CHARGES = 2;
export const JELLYFISH_PELLETS = 2;

/** Companions a player can have in their aquarium at first; PlayerData.companionSlots grows with progression. */
export const DEFAULT_COMPANION_SLOTS = 1;
