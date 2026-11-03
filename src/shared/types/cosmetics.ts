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
	| "TitleOceanGuardian"
	| "TitleMasterAquarist"
	| "TitleCollector"
	| "TitleOceanFriend"
	| "TitleAlphaPioneer"
	| "TitleOceanLegend"
	| "TitleTankTycoon"
	| "TitleDevotedKeeper"
	| "DecorWhaleStatue"
	| "DecorGoldenTrophy"
	| "DecorIncubator"
	| "FinishPearlRims";

export interface CosmeticConfig {
	kind: CosmeticKind;
	displayName: string;
	description: string;
	/** A leaderboard title: held by the top 10 of this board, for a day. */
	leaderboard?: LeaderboardId;
}

export const COSMETICS: Record<CosmeticId, CosmeticConfig> = {
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
	TitleAlphaPioneer: {
		kind: "Title",
		displayName: "Alpha Pioneer",
		description: "A title for the testers who reached the end of the alpha.",
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
		description: "A whale statue for your aquarium.",
	},
	DecorGoldenTrophy: {
		kind: "Decor",
		displayName: "Golden Trophy",
		description: "A golden trophy for your aquarium.",
	},
	DecorIncubator: {
		kind: "Decor",
		displayName: "Golden Incubator",
		description: "A golden incubator for your aquarium.",
	},
	FinishPearlRims: {
		kind: "Finish",
		displayName: "Pearl Rims",
		description: "A pearly finish on the rims of your aquarium, whatever its theme.",
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
	"TitleMasterAquarist",
	"TitleOceanGuardian",
	"TitleAlphaPioneer",
	"TitleCollector",
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
};

export function isDecor(cosmetic: CosmeticId): boolean {
	return COSMETICS[cosmetic].kind === "Decor";
}
