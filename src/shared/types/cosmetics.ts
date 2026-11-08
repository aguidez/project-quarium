/**
 * Cosmetics: rewards that change nothing to the economy (BALANCE.md §5.9: no quest or Ocean reward
 * multiplies the income), earned once and kept forever (PlayerData.cosmetics, through rebirths).
 * - Title: a name shown with the player (quest "Master Aquarist", Ocean 1,000,000...);
 * - Decor: an ornament placed in the player's tank, whatever its theme;
 * - Finish: a look applied to the tank of every theme (Pearl rims).
 * The ids below are the ones the V1 plan grants. Shown: Pearl rims since V0.42 (AquariumService), the titles (the best
 * one above the player's head, TitleService) and the decor (AquariumService, at DECOR_SLOTS) since V0.44.
 * The leaderboard titles are the exception: held only while in the day's top 10 of their board (PlayerData.leaderboardRanks),
 * never in PlayerData.cosmetics (customization.ts getOwnedTitles).
 */
import type { LeaderboardId } from "./leaderboards";

export type CosmeticKind = "Title" | "Decor" | "Finish";

export type CosmeticId =
	| "TitleOceanCreator"
	| "TitleOceanGuardian"
	| "TitleMasterAquarist"
	| "TitleCollector"
	| "TitleOceanFriend"
	| "TitleTitanTamer"
	| "TitleSizeCollector"
	| "TitleOceanSovereign"
	| "TitleGrandAquarist"
	| "TitleVariantMaster"
	| "TitlePearlDiver"
	| "TitleAlphaPioneer"
	| "TitleOceanLegend"
	| "TitleTankTycoon"
	| "TitleDevotedKeeper"
	| "DecorWhaleStatue"
	| "DecorGoldenTrophy"
	| "DecorIncubator"
	| "DecorTitanTrophy"
	| "DecorGiantPearl"
	| "DecorPearlThrone"
	| "DecorDiamondIncubator"
	| "FinishPearlRims"
	| "FinishAuroraRims"
	| "FinishGalaxyRims";

export interface CosmeticConfig {
	kind: CosmeticKind;
	displayName: string;
	description: string;
	/** A leaderboard title: held by the top 10 of this board, for a day. */
	leaderboard?: LeaderboardId;
	/**
	 * The creator's title: never earned, given at each join to the creator's accounts only (server/admins.ts isCreator,
	 * TitleService) and taken from anyone else; worn before every other title, in red with a pulsing aura.
	 */
	creator?: boolean;
	/**
	 * Decor sharing one spot of the tank (the same DECOR_SLOTS position): at most one of a group shows, the player
	 * picks which or none (CustomizationService, DataService.addCosmetic, sanitizeSave: getGroupMates).
	 */
	group?: string;
}

export const COSMETICS: Record<CosmeticId, CosmeticConfig> = {
	TitleOceanCreator: {
		kind: "Title",
		displayName: "Ocean Creator",
		description: "The title of the game's creator.",
		creator: true,
	},
	TitleOceanGuardian: {
		kind: "Title",
		displayName: "Ocean Guardian",
		description: "A title for those who gave a million Ocean Points back to the sea.",
	},
	TitleMasterAquarist: {
		kind: "Title",
		displayName: "Master Aquarist",
		description: "A title for those who found every species.",
	},
	TitleCollector: {
		kind: "Title",
		displayName: "Collector",
		description: "A title for the keenest Fish Index collectors.",
	},
	TitleOceanFriend: {
		kind: "Title",
		displayName: "Ocean Friend",
		description: "A title for those who set a Shiny free.",
	},
	TitleTitanTamer: {
		kind: "Title",
		displayName: "Titan Tamer",
		description: "A title for those who hatched a Titan, a perfect fish.",
	},
	TitleSizeCollector: {
		kind: "Title",
		displayName: "Size Collector",
		description: "A title for those who hatched a Huge fish of 18 species.",
	},
	// V1.2 (ROADMAP_V1.2 §6, §7)
	TitleOceanSovereign: {
		kind: "Title",
		displayName: "Ocean Sovereign",
		description: "A title for those who earned 40,000,000 Ocean Points.",
	},
	TitleGrandAquarist: {
		kind: "Title",
		displayName: "Grand Aquarist",
		description: "A title for those who found all 24 species of the ocean.",
	},
	TitleVariantMaster: {
		kind: "Title",
		displayName: "Variant Master",
		description: "A title for those who found every species in every variant.",
	},
	TitlePearlDiver: {
		kind: "Title",
		displayName: "Pearl Diver",
		description: "A title for those who set a Shiny Baby Kraken free.",
	},
	TitleAlphaPioneer: {
		kind: "Title",
		displayName: "Alpha Pioneer",
		description: "A title for the testers who reached the end of the alpha. No longer earned.",
	},
	TitleOceanLegend: {
		kind: "Title",
		displayName: "Ocean Legend",
		description: "Held by the top 10 of the Ocean Points leaderboard.",
		leaderboard: "OceanPoints",
	},
	TitleTankTycoon: {
		kind: "Title",
		displayName: "Tank Tycoon",
		description: "Held by the top 10 of the income leaderboard.",
		leaderboard: "Income",
	},
	TitleDevotedKeeper: {
		kind: "Title",
		displayName: "Devoted Keeper",
		description: "Held by the top 10 of the time leaderboard.",
		leaderboard: "PlayTime",
	},
	DecorWhaleStatue: {
		kind: "Decor",
		displayName: "Whale Statue",
		description: "A whale statue for your aquarium. It shares its spot with the Pearl Throne: show one or the other.",
		group: "Statue",
	},
	DecorGoldenTrophy: {
		kind: "Decor",
		displayName: "Golden Trophy",
		description: "A golden trophy for your aquarium. It shares its spot with the Titan Trophy: show one or the other.",
		group: "Trophy",
	},
	DecorTitanTrophy: {
		kind: "Decor",
		displayName: "Titan Trophy",
		description: "A rose-gold trophy for those who hatched a Titan. It shares its spot with the Golden Trophy: show one or the other.",
		group: "Trophy",
	},
	DecorIncubator: {
		kind: "Decor",
		displayName: "Golden Incubator",
		description: "A golden incubator for your aquarium. It shares its spot with the Diamond Incubator: show one or the other.",
		group: "Incubator",
	},
	// V1.2
	DecorGiantPearl: {
		kind: "Decor",
		displayName: "Giant Pearl",
		description: "A giant glowing pearl for the Ocean Sovereigns.",
	},
	DecorPearlThrone: {
		kind: "Decor",
		displayName: "Pearl Throne",
		description: "A pearl throne for the Grand Aquarists. It shares its spot with the Whale Statue: show one or the other.",
		group: "Statue",
	},
	DecorDiamondIncubator: {
		kind: "Decor",
		displayName: "Diamond Incubator",
		description: "A diamond incubator for those who hatched 3,500 fish. It shares its spot with the Golden Incubator.",
		group: "Incubator",
	},
	FinishPearlRims: {
		kind: "Finish",
		displayName: "Pearl Rims",
		description: "A pearly finish on the rims of your aquarium, whatever its theme. One rims finish shows at a time.",
		group: "Rims",
	},
	// V1.2 (ROADMAP_V1.2 §6, Ocean 14,000,000): the rims glow and drift through the northern lights' colours (client)
	FinishAuroraRims: {
		kind: "Finish",
		displayName: "Aurora Rims",
		description: "The rims of your aquarium glow with the colours of the northern lights. One rims finish shows at a time.",
		group: "Rims",
	},
	// V1.2 (Collector, 100 Fish Index cells): night-blue rims drifting through the Galaxy variant's colours (client)
	FinishGalaxyRims: {
		kind: "Finish",
		displayName: "Galaxy Rims",
		description: "The rims of your aquarium glow with the colours of the Galaxy. One rims finish shows at a time.",
		group: "Rims",
	},
};

export function isCosmeticId(value: unknown): value is CosmeticId {
	return typeIs(value, "string") && COSMETICS[value as CosmeticId] !== undefined;
}

/**
 * The earned titles from the most to the least prestigious: after the leaderboard titles, the player wears the first one
 * they own (customization.ts getBestTitle).
 */
export const TITLE_ORDER: readonly CosmeticId[] = [
	"TitleGrandAquarist",
	"TitleOceanSovereign",
	"TitleVariantMaster",
	"TitleMasterAquarist",
	"TitleOceanGuardian",
	"TitleAlphaPioneer",
	"TitleCollector",
	"TitleTitanTamer",
	"TitleSizeCollector",
	"TitlePearlDiver",
	"TitleOceanFriend",
];

/** The title of each leaderboard, in the boards' order (Ocean first: the best of two equal ranks). */
export const LEADERBOARD_TITLES: Record<LeaderboardId, CosmeticId> = {
	OceanPoints: "TitleOceanLegend",
	Income: "TitleTankTycoon",
	PlayTime: "TitleDevotedKeeper",
};

/** Player attributes (TitleService): the title worn (a CosmeticId) and, for a leaderboard title, its rank today. */
export const TITLE_ATTRIBUTE = "Title";
export const TITLE_RANK_ATTRIBUTE = "TitleRank";

/** Gold of the earned titles: their text above the head and their tag in the chat. */
export const EARNED_TITLE_COLOR = Color3.fromHex("#FFD54A");

/**
 * The creator's title (COSMETICS creator): bright red text with golden four-point sparkles around it that twinkle in
 * turn (TitleSparklesController); pale gold at their heart, gold toward their tips.
 */
export const CREATOR_TITLE: CosmeticId = "TitleOceanCreator";
export const CREATOR_TITLE_COLOR = Color3.fromHex("#FF2B2B");
export const CREATOR_SPARKLE_COLOR = Color3.fromHex("#FFC928");
export const CREATOR_SPARKLE_HEART = Color3.fromHex("#FFF6C8");

export function isCreatorTitle(id: CosmeticId): boolean {
	return COSMETICS[id].creator === true;
}

export function isLeaderboardTitle(id: CosmeticId): boolean {
	return COSMETICS[id].leaderboard !== undefined;
}

/**
 * Where each decor stands in a tank, in the aquarium's frame (x right, z toward the back; the sand top is y 4): low in
 * the front corners, out of the fish's way, whatever the theme. The models: ServerStorage.Assets.Decor (DecorTemplate).
 */
export const DECOR_SLOTS: Partial<Record<CosmeticId, Vector3>> = {
	DecorWhaleStatue: new Vector3(-18.5, 4, -6),
	DecorGoldenTrophy: new Vector3(19, 4, -6),
	DecorIncubator: new Vector3(15.2, 4, -5.6), // next to the trophy (Hatchery line, ROADMAP M7)
	DecorTitanTrophy: new Vector3(19, 4, -6), // the golden trophy's spot: one or the other shows (group "Trophy")
	DecorGiantPearl: new Vector3(-14.8, 4, -5.6), // next to the whale statue (Ocean 40,000,000, V1.2)
	DecorPearlThrone: new Vector3(-18.5, 4, -6), // the whale statue's spot (group "Statue")
	DecorDiamondIncubator: new Vector3(15.2, 4, -5.6), // the golden incubator's spot (group "Incubator")
};

/** The other cosmetics of the same group (one spot of the tank), none for a cosmetic without a group. */
export function getGroupMates(cosmetic: CosmeticId): CosmeticId[] {
	const group = COSMETICS[cosmetic].group;
	const mates = new Array<CosmeticId>();
	if (group === undefined) return mates;
	for (const [id, config] of pairs(COSMETICS)) if (id !== cosmetic && config.group === group) mates.push(id);
	return mates;
}

export function isDecor(cosmetic: CosmeticId): boolean {
	return COSMETICS[cosmetic].kind === "Decor";
}
