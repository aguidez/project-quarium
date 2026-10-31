import { CompanionType } from "./companions";
import { CosmeticId } from "./cosmetics";

/**
 * Ocean milestones: Ocean Points (earned by releasing fish, never spent) unlock rewards at thresholds,
 * claimed one by one from the Ocean menu, a bit like quests. Each is claimed once per player and kept
 * through rebirths.
 */
export type OceanRewardId =
	| "Pelican"
	| "SnailSpeed"
	| "CompanionSlot2"
	| "PelicanFeedRate"
	| "BigAquarium"
	| "SecondIncubator"
	| "Aquarium17"
	| "Aquarium19"
	| "LuckyOcean"
	| "Aquarium21"
	| "WaterHen"
	| "Swordfish";

/**
 * A companion upgrade multiplies what the companion does: the Snail's crawling speed, the Pelican's
 * feeding rate (getCompanionMultiplier).
 */
export type OceanReward =
	| { kind: "Companion"; companion: CompanionType }
	| { kind: "CompanionSlot" }
	| { kind: "CompanionUpgrade"; companion: CompanionType; multiplier: number }
	/** The tank holds this many fish (PlayerData.capacity, kept through rebirths). */
	| { kind: "Capacity"; capacity: number }
	/** This many eggs of the same type can incubate at once (PlayerData.incubators, kept through rebirths). */
	| { kind: "Incubator"; count: number }
	/** The rare variants' chances are multiplied by this (getVariantLuck: nothing stored beyond the claimed id). */
	| { kind: "VariantLuck"; multiplier: number }
	/** Titles, decor or a tank finish (PlayerData.cosmetics): no effect on the economy. */
	| { kind: "Cosmetic"; cosmetics: readonly CosmeticId[] };

export interface OceanMilestone {
	id: OceanRewardId;
	/** Ocean Points needed. */
	points: number;
	title: string;
	description: string;
	reward: OceanReward;
}

/** In order of points. */
export const OCEAN_MILESTONES: readonly OceanMilestone[] = [
	{
		id: "Pelican",
		points: 50,
		title: "Pelican",
		description: "A new companion that throws food to your fish every 10 s.",
		reward: { kind: "Companion", companion: "Pelican" },
	},
	{
		id: "SnailSpeed",
		points: 100,
		title: "Faster Snail",
		description: "Your Snail crawls at 115% speed to pick up the coins.",
		// Balance (BALANCE.md §5.8): with all its quests ~60 % of the coins at 1 coin/s; the Swordfish goes further
		reward: { kind: "CompanionUpgrade", companion: "Snail", multiplier: 1.15 },
	},
	{
		id: "CompanionSlot2",
		points: 200,
		title: "Companion slot",
		description: "One more companion in your aquarium at the same time.",
		reward: { kind: "CompanionSlot" },
	},
	{
		id: "PelicanFeedRate",
		points: 500,
		title: "Hungry Pelican",
		description: "Your Pelican throws food a third more often (every 7.5 s).",
		// Balance (BALANCE.md §5.8): with all its quests it keeps 15 fish fed; the Jellyfish goes further
		reward: { kind: "CompanionUpgrade", companion: "Pelican", multiplier: 1.33 },
	},
	{
		// Balance (BALANCE.md): reached with the tank released at rebirth 2 (~1h44, ~2,000 points), so
		// the climb to the Neon Coral Egg runs with 15 fish
		id: "BigAquarium",
		points: 1500,
		title: "Bigger aquarium",
		description: "Your aquarium holds 15 fish instead of 10.",
		reward: { kind: "Capacity", capacity: 15 },
	},
	// V1 plan (BALANCE.md §5.7): the tank grows by 2 at each rebirth from 3 on, the milestones x2–3 apart
	{
		// Just before rebirth 3 (~2h58): the long late-game hatches stop being the bottleneck
		id: "SecondIncubator",
		points: 5000,
		title: "Second incubator",
		description: "Two eggs of the same kind can incubate at once.",
		reward: { kind: "Incubator", count: 2 },
	},
	{
		id: "Aquarium17",
		points: 8000,
		title: "Bigger aquarium",
		description: "Your aquarium holds 17 fish.",
		reward: { kind: "Capacity", capacity: 17 },
	},
	{
		id: "Aquarium19",
		points: 25000,
		title: "Bigger aquarium",
		description: "Your aquarium holds 19 fish.",
		reward: { kind: "Capacity", capacity: 19 },
	},
	{
		// A side goal: +1.8 % income on average, not in the simulator
		id: "LuckyOcean",
		points: 40000,
		title: "Lucky ocean",
		description: "Rare fish hatch 1.5x as often: Anomaly 15%, Ghost 7.5%, Shiny 1.5%.",
		reward: { kind: "VariantLuck", multiplier: 1.5 },
	},
	// Rebirth 5 (ROADMAP M4): the tank 21 comes with the rebirth's release, the Water Hen right after it
	{
		id: "Aquarium21",
		points: 70000,
		title: "Bigger aquarium",
		description: "Your aquarium holds 21 fish.",
		reward: { kind: "Capacity", capacity: 21 },
	},
	{
		// Balance (BALANCE.md §5.8): hatch -15 % while equipped, a comfort (the waits are for money): ~-11 min to the end
		id: "WaterHen",
		points: 85000,
		title: "Water Hen",
		description: "A new companion: while it is equipped, the eggs you buy hatch 15% faster.",
		reward: { kind: "Companion", companion: "WaterHen" },
	},
	{
		// Free, it collects like a maxed Snail (~60 % at 1 coin/s); its pass quests take it to ~96 %
		id: "Swordfish",
		points: 120000,
		title: "Swordfish",
		description: "A new companion that swims through the water and grabs your coins while they sink.",
		reward: { kind: "Companion", companion: "Swordfish" },
	},
];

/** The product of the claimed upgrades of this companion (1 without any). */
export function getCompanionMultiplier(claimed: readonly string[], companion: CompanionType): number {
	let multiplier = 1;
	for (const milestone of OCEAN_MILESTONES) {
		const reward = milestone.reward;
		if (reward.kind === "CompanionUpgrade" && reward.companion === companion && claimed.includes(milestone.id)) {
			multiplier *= reward.multiplier;
		}
	}
	return multiplier;
}

/** The product of the claimed variant luck milestones (1 without any): multiplies the rare variants' chances. */
export function getVariantLuck(claimed: readonly string[]): number {
	let luck = 1;
	for (const milestone of OCEAN_MILESTONES) {
		const reward = milestone.reward;
		if (reward.kind === "VariantLuck" && claimed.includes(milestone.id)) luck *= reward.multiplier;
	}
	return luck;
}

export function getOceanMilestone(id: string): OceanMilestone | undefined {
	return OCEAN_MILESTONES.find((milestone) => milestone.id === id);
}

/** A milestone reached and not claimed yet (badge on the Ocean button). */
export function hasClaimableOceanReward(oceanPoints: number, claimed: readonly string[]): boolean {
	return OCEAN_MILESTONES.some((milestone) => oceanPoints >= milestone.points && !claimed.includes(milestone.id));
}
