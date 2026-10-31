/**
 * Cosmetics: rewards that change nothing to the economy (BALANCE.md §5.9: no quest or Ocean reward
 * multiplies the income), earned once and kept forever (PlayerData.cosmetics, through rebirths).
 * - Title: a name shown with the player (quest "Master Aquarist", Ocean 1,000,000...);
 * - Decor: an ornament placed in the player's tank, whatever its theme;
 * - Finish: a look applied to the tank of every theme (Pearl rims).
 * The ids below are the ones the V1 plan grants. Pearl rims are shown since V0.42 (Ocean 300,000, AquariumService);
 * the titles and decor come with the content that grants them (ROADMAP M6), nothing grants them before.
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
