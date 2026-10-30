import { FishType } from "./fish";

/**
 * Main onboarding, driven by the server (OnboardingService) and stored in PlayerData:
 * - EnterView: walk up to the glass (2.5D view). Egg purchases are blocked until then.
 * - BuyEgg: buy the (free) Common Egg. It always hatches into ONBOARDING_FISH.
 * - Hatching: the egg incubates.
 * - OpenEgg: the egg is ready: click it in the shop to open it (eggs never open by themselves).
 * - CollectCoin: the fish drops a frozen coin ONBOARDING_COIN_DELAY seconds after it is born: collect it.
 * - CoinCollected: congratulations, then ONBOARDING_FEED_DELAY seconds later the fish turns hungry.
 * - Feed: drop food (clicking the water) to feed the hungry fish.
 * - Done: the game is unlocked and the player receives ONBOARDING_REWARD.
 * Until Done, fish hunger and coin drops are held (only the scripted coin / hunger happen).
 */
export type OnboardingStep =
	"EnterView" | "BuyEgg" | "Hatching" | "OpenEgg" | "CollectCoin" | "CoinCollected" | "Feed" | "Done";

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
	"EnterView",
	"BuyEgg",
	"Hatching",
	"OpenEgg",
	"CollectCoin",
	"CoinCollected",
	"Feed",
	"Done",
];

/** The first egg always hatches into this fish (the egg's own odds apply afterwards). */
export const ONBOARDING_FISH: FishType = "Basic";
export const ONBOARDING_COIN_DELAY = 2; // seconds between the first fish's birth and its first coin
export const ONBOARDING_FEED_DELAY = 5; // seconds the "Well done!" stays readable before the fish gets hungry
/** Money given when the onboarding is done (players start with nothing: the first egg and food are free). */
export const ONBOARDING_REWARD = 300;
/** Seconds after the onboarding before a bubble invites the player to read the story quests (after the reward popup). */
export const STORY_QUEST_HINT_DELAY = 5;

/** The onboarding egg is incubating or waiting to be opened: it hatches into ONBOARDING_FISH. */
export function isOnboardingEggStep(step: OnboardingStep): boolean {
	return step === "Hatching" || step === "OpenEgg";
}

export function isOnboardingDone(step: OnboardingStep): boolean {
	return step === "Done";
}

/** Food can only be dropped once the onboarding asks for it (so the player can't waste their money before). */
export function canDropFood(step: OnboardingStep): boolean {
	return step === "Feed" || step === "Done";
}

/** The food of the onboarding's Feed step is free: the player starts with no money. */
export function isFoodFree(step: OnboardingStep): boolean {
	return step === "Feed";
}

/** Eggs can only be bought at the onboarding's BuyEgg step, then freely once it is done. */
export function canBuyEggs(step: OnboardingStep): boolean {
	return step === "BuyEgg" || step === "Done";
}
