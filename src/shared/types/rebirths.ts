import { FISH_TYPES, FishType } from "./fish";
import { getPassOceanMultiplier } from "./gamepasses";
import { getLivingVariant, PlayerData } from "./playerData";
import { getOceanPoints, VARIANT_ORDER } from "./variants";

/**
 * Rebirths: the player gives up their run (fish, money, eggs and egg unlocks) for a permanent
 * coin multiplier and a new aquarium look. Their fish go back to the ocean and earn their Ocean
 * Points. Kept: Fish Index, quests, companions, Ocean Points, features, likes.
 *
 * Balance (BALANCE.md, tools/economy-sim.js; average player collecting ~50% of the coins, rebirthing
 * as soon as it can): rebirth 1 at ~28 min (p10 21, p90 36) gets past the Freshwater Egg (25k);
 * rebirth 2 at ~1h44 (p10 1h31, p90 1h59) gets past the Amazon Egg (150k) and opens the Neon Coral
 * Egg (2.5M, more than its price), the last species at ~2h31. Its x8 is steep on purpose: the run
 * restarts from the first egg, and the climb back to the Neon Coral Egg must stay under ~35 min.
 */
export type AquariumTheme =
	| "Basic"
	| "Lagoon"
	| "NeonCoral"
	| "PirateWreck"
	| "Atlantis"
	| "MarianaTrench"
	| "VolcanicTemple"
	| "CrystalCaverns"
	| "CosmicSanctuary"
	| "AuroraGlacier"
	| "SkyArchipelago";

export interface AquariumThemeConfig {
	displayName: string;
}

/**
 * Studio-made look of each theme: ServerStorage.Assets.AquariumThemes.<theme> (see AquariumService).
 */
export const AQUARIUM_THEMES: Record<AquariumTheme, AquariumThemeConfig> = {
	Basic: { displayName: "Basic Aquarium" },
	Lagoon: { displayName: "Lagoon Aquarium" },
	NeonCoral: { displayName: "Neon Coral Lagoon" },
	PirateWreck: { displayName: "Sunken Pirate Wreck" },
	Atlantis: { displayName: "Atlantis Ruins" },
	MarianaTrench: { displayName: "Mariana Trench" },
	VolcanicTemple: { displayName: "Volcanic Temple" },
	CrystalCaverns: { displayName: "Crystal Caverns" },
	CosmicSanctuary: { displayName: "Cosmic Sanctuary" },
	AuroraGlacier: { displayName: "Aurora Glacier" },
	SkyArchipelago: { displayName: "Sky Archipelago" },
};

export interface RebirthConfig {
	/** Money needed (and spent: the money restarts anyway). */
	price: number;
	/** Total coin multiplier once this rebirth is done (not stacked with the previous ones). */
	multiplier: number;
	/** Money the player starts the new run with. */
	startMoney: number;
	theme: AquariumTheme;
}

/**
 * Rebirth n (1-based) is REBIRTHS[n - 1]. More levels (and themes) come with the next eggs. V1 plan (BALANCE.md §5):
 * ~x3.2 per rebirth, each new run gets back to its previous income in ~15–20 min. Rebirths 3–8 cost 1.45x the plan's
 * since V0.46: the daily / weekly coin boosts would otherwise end V1 at ~9h45 for a player of 1 h a day (BALANCE.md §2).
 */
export const REBIRTHS: readonly RebirthConfig[] = [
	{ price: 5000, multiplier: 2.5, startMoney: 300, theme: "Lagoon" },
	{ price: 1300000, multiplier: 8, startMoney: 300, theme: "NeonCoral" },
	{ price: 65e6, multiplier: 25, startMoney: 300, theme: "PirateWreck" },
	{ price: 175e6, multiplier: 80, startMoney: 300, theme: "Atlantis" },
	{ price: 7.4e9, multiplier: 250, startMoney: 300, theme: "MarianaTrench" },
	{ price: 19e9, multiplier: 800, startMoney: 300, theme: "VolcanicTemple" },
	{ price: 1e12, multiplier: 2500, startMoney: 300, theme: "CrystalCaverns" },
	// The last aquarium of V1
	{ price: 2.2e12, multiplier: 8000, startMoney: 300, theme: "CosmicSanctuary" },
	// V1.2 (ROADMAP_V1.2 §3.4, tuned with tools/balance-v1.2-plan.js): rebirth 9 at ~13h37
	{ price: 200e12, multiplier: 25000, startMoney: 300, theme: "AuroraGlacier" },
	// Rebirth 10 at ~16h28: x4.8 only (an even rebirth stays under ~1.6x the egg its run farms, ROADMAP_V1.2 §2)
	{ price: 640e12, multiplier: 120000, startMoney: 300, theme: "SkyArchipelago" },
];

/** The rebirth a player who has done `rebirths` of them can do next (undefined once all are done). */
export function getNextRebirth(rebirths: number): RebirthConfig | undefined {
	return REBIRTHS[rebirths];
}

/** Permanent coin multiplier after `rebirths` rebirths. */
export function getRebirthMultiplier(rebirths: number): number {
	return rebirths > 0 ? (REBIRTHS[math.min(rebirths, REBIRTHS.size()) - 1]?.multiplier ?? 1) : 1;
}

export function getAquariumTheme(rebirths: number): AquariumTheme {
	return rebirths > 0 ? (REBIRTHS[math.min(rebirths, REBIRTHS.size()) - 1]?.theme ?? "Basic") : "Basic";
}

/**
 * Ocean Points the living fish earn when they all go back to the ocean at a rebirth (rare variants count more,
 * the x2 Ocean Points pass doubles them).
 */
export function getRebirthOceanPoints(data: Pick<PlayerData, "fish" | "fishVariants" | "passes">): number {
	let points = 0;
	for (const [fishType] of pairs(data.fish)) {
		for (const variant of VARIANT_ORDER)
			points += getLivingVariant(data, fishType, variant) * getOceanPoints(fishType, variant);
	}
	return points * getPassOceanMultiplier(data.passes);
}

/** "x2.5" */
export function formatMultiplier(multiplier: number): string {
	return `x${math.floor(multiplier * 10 + 0.5) / 10}`;
}
