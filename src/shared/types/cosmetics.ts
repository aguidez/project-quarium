/**
 * Cosmetics: rewards that change nothing to the economy (BALANCE.md §5.9: no quest or Ocean reward
 * multiplies the income), earned once and kept forever (PlayerData.cosmetics, through rebirths).
 * - Title: a name shown with the player (quest "Master Aquarist", Ocean 1,000,000...);
 * - Decor: an ornament placed in the player's tank, whatever its theme;
 * - Finish: a look applied to the tank of every theme (Pearl rims).
 * The ids below are the ones the V1 plan grants. Shown: Pearl rims since V0.42 (AquariumService), the titles (the best
 * one above the player's head, TitleService) and the decor (AquariumService, at DECOR_SLOTS) since V0.44.
 */
export type CosmeticKind = "Title" | "Decor" | "Finish";

export type CosmeticId =
	| "TitleOceanGuardian"
	| "TitleMasterAquarist"
	| "TitleCollector"
	| "TitleOceanFriend"
	| "DecorWhaleStatue"
	| "DecorGoldenTrophy"
	| "DecorIncubator"
	| "FinishPearlRims";

export interface CosmeticConfig {
	kind: CosmeticKind;
	displayName: string;
	description: string;
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

/** Titles from the most to the least prestigious: the player wears the first one they own (getBestTitle). */
export const TITLE_ORDER: readonly CosmeticId[] = [
	"TitleMasterAquarist",
	"TitleOceanGuardian",
	"TitleCollector",
	"TitleOceanFriend",
];

export function getBestTitle(cosmetics: readonly CosmeticId[]): CosmeticId | undefined {
	return TITLE_ORDER.find((title) => cosmetics.includes(title));
}

/**
 * Where each decor stands in a tank, in the aquarium's frame (x right, z toward the back; the sand top is y 4): low in
 * the front corners, out of the fish's way, whatever the theme. The models: ServerStorage.Assets.Decor (DecorTemplate).
 */
export const DECOR_SLOTS: Partial<Record<CosmeticId, Vector3>> = {
	DecorWhaleStatue: new Vector3(-18.5, 4, -6),
	DecorGoldenTrophy: new Vector3(19, 4, -6),
	// DecorIncubator: with the Hatchery side line (ROADMAP M7)
};

export function isDecor(cosmetic: CosmeticId): boolean {
	return COSMETICS[cosmetic].kind === "Decor";
}
