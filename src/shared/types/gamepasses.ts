/**
 * Gamepasses (BALANCE.md §5.10: never part of the balance). Only their names exist so far: the passes,
 * their Roblox ids and their effects come with GamePassService (ROADMAP M3), which fills
 * PlayerData.passes from Roblox at join. Nothing is ever trusted from the client.
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
}

export const GAME_PASSES: Record<GamePass, GamePassConfig> = {
	ThirdCompanionSlot: { displayName: "Third Companion Slot" },
	OceanBoost: { displayName: "x2 Ocean Points" },
	Lucky: { displayName: "Lucky" },
	Coins: { displayName: "+50% Coins" },
	WaterHenPass: { displayName: "Water Hen Pass" },
	SwordfishPass: { displayName: "Swordfish Pass" },
	JellyfishPass: { displayName: "Jellyfish Pass" },
};

export function isGamePass(value: unknown): value is GamePass {
	return typeIs(value, "string") && GAME_PASSES[value as GamePass] !== undefined;
}
