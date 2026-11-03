/**
 * Gamepasses (BALANCE.md §5.10: never part of the balance). GamePassService fills PlayerData.passes from Roblox
 * (UserOwnsGamePassAsync at join, PromptGamePassPurchaseFinished on a purchase); nothing is ever trusted from the
 * client. The prices are read from Roblox by the Shop panel, never stored here.
 */
export type GamePass =
	| "ThirdCompanionSlot"
	| "OceanBoost"
	| "Lucky"
	| "Coins"
	| "WaterHenPass"
	| "SwordfishPass"
	| "JellyfishPass";

export interface GamePassConfig {
	displayName: string;
	/** Shop card text. */
	description: string;
	/** Roblox gamepass id (Creator Dashboard); 0: not created yet, so it can't be bought (Studio: /pass). */
	id: number;
	/** Shop card icon, without any text (CLAUDE.md §7); "" until uploaded (the card shows its badge alone). */
	image: string;
	/** Short value drawn over the icon by the game ("x2", "+50%"): uploaded icons carry no text. */
	badge?: string;
	/** Order on the Shop panel; undefined: sold from its quest line only (the companion passes). */
	shopOrder?: number;
}

export const GAME_PASSES: Record<GamePass, GamePassConfig> = {
	ThirdCompanionSlot: {
		displayName: "Third Companion Slot",
		description: "One more companion in your aquarium at once.",
		id: 2070385400,
		image: "rbxassetid://91011389500250", // design/ui/passes/Pass_ThirdCompanionSlot.png
		badge: "+1",
		shopOrder: 1,
	},
	OceanBoost: {
		displayName: "x2 Ocean Points",
		description: "Fish you release to the ocean give twice the Ocean Points, rebirths included.",
		id: 2070517298,
		image: "rbxassetid://100468634358996", // design/ui/passes/Pass_OceanBoost.png
		badge: "x2",
		shopOrder: 2,
	},
	Lucky: {
		displayName: "Lucky",
		description: "Anomaly, Ghost and Shiny fish hatch twice as often.",
		id: 2068051760,
		image: "rbxassetid://96173355511700", // design/ui/passes/Pass_Lucky.png
		badge: "x2",
		shopOrder: 3,
	},
	Coins: {
		displayName: "+50% Coins",
		description: "Every coin your fish drop is worth 50% more, forever.",
		id: 2068045751,
		image: "rbxassetid://120529755774174", // design/ui/passes/Pass_Coins.png
		badge: "+50%",
		shopOrder: 4,
	},
	// The companion passes (M4): sold from their quest line, they unlock its 3 upgrade quests; their picture is the
	// companion's sticker (COMPANION_TYPES image)
	WaterHenPass: {
		displayName: "Water Hen Pass",
		description: "Unlocks the Water Hen's quests: eggs hatch up to 35% faster with it.",
		id: 2070397345,
		image: "rbxassetid://106605624608137", // design/ui/companions/Companion_WaterHen.png
	},
	SwordfishPass: {
		displayName: "Swordfish Pass",
		description: "Unlocks the Swordfish's quests: it swims up to 2.2x as fast and grabs almost every coin.",
		id: 2066413853,
		image: "rbxassetid://94908996690740", // design/ui/companions/Companion_Swordfish.png
	},
	JellyfishPass: {
		displayName: "Jellyfish Pass",
		description: "Unlocks the Jellyfish's quests: it feeds faster, with more charges and pellets, up to 25 fish.",
		id: 2068729703,
		image: "rbxassetid://96894492239649", // design/ui/companions/Companion_Jellyfish.png
	},
};

// The passes' effects (BALANCE.md §5.10): they never stack beyond these
export const COINS_PASS_MULTIPLIER = 1.5;
export const OCEAN_PASS_MULTIPLIER = 2;
export const LUCKY_PASS_MULTIPLIER = 2;

export function isGamePass(value: unknown): value is GamePass {
	return typeIs(value, "string") && GAME_PASSES[value as GamePass] !== undefined;
}

/** The passes of the Shop panel, in order. */
export function getShopPasses(): GamePass[] {
	const passes = new Array<GamePass>();
	for (const [pass, config] of pairs(GAME_PASSES)) if (config.shopOrder !== undefined) passes.push(pass);
	passes.sort((a, b) => (GAME_PASSES[a].shopOrder ?? 0) < (GAME_PASSES[b].shopOrder ?? 0));
	return passes;
}

/** The pass whose Roblox id this is, if any (purchase callbacks). */
export function getPassById(id: number): GamePass | undefined {
	if (id <= 0) return undefined;
	for (const [pass, config] of pairs(GAME_PASSES)) if (config.id === id) return pass;
	return undefined;
}

export function getPassCoinMultiplier(passes: readonly GamePass[]): number {
	return passes.includes("Coins") ? COINS_PASS_MULTIPLIER : 1;
}

/** On the Ocean Points of fish going to the ocean (releases, rebirths), not on fixed quest rewards. */
export function getPassOceanMultiplier(passes: readonly GamePass[]): number {
	return passes.includes("OceanBoost") ? OCEAN_PASS_MULTIPLIER : 1;
}

export function getPassVariantLuck(passes: readonly GamePass[]): number {
	return passes.includes("Lucky") ? LUCKY_PASS_MULTIPLIER : 1;
}

/** Companion slots on top of PlayerData.companionSlots (the Ocean ones). */
export function getPassCompanionSlots(passes: readonly GamePass[]): number {
	return passes.includes("ThirdCompanionSlot") ? 1 : 0;
}
