import { EGG_TYPES, EggType, getEggPrice, STARTER_EGG } from "./eggs";
import { isOnboardingDone } from "./onboarding";
import { getFishAndEggs, getIncubating, getTotalFish, hasFreeIncubator, PlayerData } from "./playerData";

/**
 * First goals: right after the tutorial, the "Next goal" tracker walks the player through their first eggs before it
 * hands over to the story quests (on 2026-11-09, 44 % of the players who finished the tutorial left with its 300 $
 * without buying a second egg). Derived from the save, nothing stored: a goal reached stays reached (fish ever hatched
 * and rebirths only grow).
 */
export type FirstGoal = "NewEgg" | "HatchFish";
export const FIRST_GOALS: readonly FirstGoal[] = ["NewEgg", "HatchFish"];
/** Fish ever hatched (the tutorial's included) that end the first goals. */
export const FIRST_GOAL_FISH = 5;

/** Fish ever hatched (PlayerData.hatched, kept through rebirths). */
export function getTotalHatched(data: PlayerData): number {
	let total = 0;
	for (const [, count] of pairs(data.hatched)) total += count;
	return total;
}

/** Eggs incubating or ready to open. */
function getEggsWaiting(data: PlayerData): number {
	return getFishAndEggs(data) - getTotalFish(data);
}

export function isFirstGoalDone(data: PlayerData, goal: FirstGoal): boolean {
	if (data.rebirths > 0) return true;
	const hatched = getTotalHatched(data);
	if (goal === "NewEgg") return hatched + getEggsWaiting(data) >= 2;
	return hatched >= FIRST_GOAL_FISH;
}

/** What the tracker shows during the first goals, with the egg the shop points at (if any). */
export type FirstGoalStep =
	/** Buy a second egg (the Common Egg, 100 $ out of the tutorial's 300 $). */
	| { kind: "NewEgg"; egg?: EggType; affordable: boolean }
	/** An egg is ready: open it (eggs never open by themselves). */
	| { kind: "OpenEgg"; egg: EggType }
	/** Hatch fish up to FIRST_GOAL_FISH; `egg` is the one to buy now, none while an egg incubates or money is short. */
	| { kind: "HatchFish"; hatched: number; egg?: EggType; incubating: boolean };

/** The current first goal, undefined once they are all done (or before the tutorial's end). */
export function getFirstGoalStep(data: PlayerData, serverNow: number): FirstGoalStep | undefined {
	if (!isOnboardingDone(data.onboarding) || isFirstGoalDone(data, "HatchFish")) return undefined;

	// A ready egg comes first: opening it is what the goals are about
	const roomLeft = getTotalFish(data) < data.capacity;
	let incubating = false;
	for (const [eggType] of pairs(EGG_TYPES)) {
		const hatchAt = getIncubating(data, eggType)[0];
		if (hatchAt === undefined) continue;
		if (hatchAt <= serverNow && roomLeft) return { kind: "OpenEgg", egg: eggType };
		incubating = true;
	}

	const price = getEggPrice(STARTER_EGG, getFishAndEggs(data));
	const affordable = data.money >= price && hasFreeIncubator(data, STARTER_EGG);
	if (!isFirstGoalDone(data, "NewEgg"))
		return { kind: "NewEgg", egg: affordable ? STARTER_EGG : undefined, affordable };
	return {
		kind: "HatchFish",
		hatched: getTotalHatched(data),
		egg: affordable && !incubating ? STARTER_EGG : undefined,
		incubating,
	};
}
