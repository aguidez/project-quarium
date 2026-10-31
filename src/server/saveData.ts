import { Workspace } from "@rbxts/services";
import { COMPANION_TYPES, CompanionType } from "shared/types/companions";
import { isCosmeticId } from "shared/types/cosmetics";
import { EGG_TYPES, EggType } from "shared/types/eggs";
import { FEATURES } from "shared/types/features";
import { FISH_TYPES, FishType, HungerState } from "shared/types/fish";
import { getOceanMilestone } from "shared/types/oceanRewards";
import { PERKS } from "shared/types/perks";
import { ONBOARDING_STEPS } from "shared/types/onboarding";
import { isGamePass } from "shared/types/gamepasses";
import {
	DEFAULT_INCUBATORS,
	DEFAULT_PLAYER_DATA,
	getCompanionSlots,
	MAX_MONEY,
	PlayerData,
	syncIncubationSpeed,
} from "shared/types/playerData";
import {
	getQuestConfig,
	getStoryLine,
	getStoryLineOrder,
	QuestProgress,
	QuestsData,
	refreshStoryLines,
	STORY_LINES,
} from "shared/types/quests";
import { REBIRTHS } from "shared/types/rebirths";
import { FISH_VARIANTS, FishVariant, isFishVariant } from "shared/types/variants";

/** A fish of the tank as saved: what makes it worth more than a newborn one. */
export interface SavedFish {
	fishType: FishType;
	scale: number; // adult scale (random at birth)
	age: number; // seconds spent in the water while its owner was tending the tank (drives growth)
	hunger: HungerState;
	hungerLeft: number; // seconds before the next hunger state (unused while weak)
	variant?: FishVariant; // undefined in saves made before variants: Normal
}

/**
 * What a player's DataStore profile holds. `player` is the PlayerData synced to the client;
 * `tank` is written by FishService right before each save (PlayerData.fish stays the authority
 * on how many fish there are: the tank only tells how grown / hungry they were).
 */
export interface SaveData {
	player: PlayerData;
	tank: SavedFish[];
}

/** Template of new profiles; ProfileStore copies it and Reconcile() fills fields added since. */
export const SAVE_TEMPLATE: SaveData = {
	player: DEFAULT_PLAYER_DATA,
	tank: [],
};

function isFishType(value: unknown): value is FishType {
	return typeIs(value, "string") && FISH_TYPES[value as FishType] !== undefined;
}

function isCount(value: unknown): value is number {
	return typeIs(value, "number") && value >= 0 && value === value; // excludes NaN
}

/** Keeps the keys of `record` that are still valid ids with a valid value (content removed or renamed since). */
function filterRecord<K extends string>(
	record: Partial<Record<K, number>>,
	ids: Record<K, unknown>,
): Partial<Record<K, number>> {
	const result: Partial<Record<K, number>> = {};
	for (const [key, value] of pairs(record as Record<string, unknown>)) {
		const id = key as K;
		if (ids[id] !== undefined && isCount(value)) result[id] = value;
	}
	return result;
}

/**
 * Eggs being incubated, as lists of hatch times per type, soonest first. Saves made before the incubator
 * milestones held one number per type: it becomes a list of one. An empty list is dropped.
 */
function sanitizeIncubating(incubating: unknown): PlayerData["incubating"] {
	const result: PlayerData["incubating"] = {};
	if (!typeIs(incubating, "table")) return result;
	for (const [key, value] of pairs(incubating as Record<string, unknown>)) {
		const eggType = key as EggType;
		if (EGG_TYPES[eggType] === undefined) continue;
		const eggs = new Array<number>();
		if (isCount(value)) eggs.push(value);
		else if (typeIs(value, "table")) {
			for (const hatchAt of value as unknown[]) if (isCount(hatchAt)) eggs.push(hatchAt);
		}
		eggs.sort((a, b) => a < b);
		if (eggs.size() > 0) result[eggType] = eggs;
	}
	return result;
}

/** The single story chain of saves made before story lines, in its order. */
const OLD_STORY_ORDER = ["Story1", "Story2", "Story3", "Story4", "Story5"];

/**
 * Story lines of a save made with the single story chain (`quests.story`): every quest before its
 * current one was claimed, so each line resumes at its first quest not done (keeping the progress
 * of the quest that was current).
 */
function migrateStory(old: QuestProgress): QuestsData["lines"] {
	const index = OLD_STORY_ORDER.indexOf(old.id);
	const done = new Set<string>();
	for (let i = 0; i < OLD_STORY_ORDER.size(); i++) {
		if (i < index || (i === index && old.claimed)) done.add(OLD_STORY_ORDER[i]);
	}
	const lines: QuestsData["lines"] = {};
	for (const line of getStoryLineOrder()) {
		const quests = STORY_LINES[line].quests;
		const pending = quests.find((id) => !done.has(id));
		if (pending === undefined) {
			const last = quests[quests.size() - 1];
			if (last !== undefined) lines[line] = { id: last, progress: 0, claimed: true };
		} else if (quests.indexOf(pending) > 0 || pending === old.id) {
			// Lines not started yet are opened by refreshStoryLines, from zero
			lines[line] = { id: pending, progress: pending === old.id ? old.progress : 0, claimed: false };
		}
	}
	return lines;
}

/** Keeps valid story line entries (quest of that line, sane progress), then opens what can be opened. */
function sanitizeStoryLines(quests: QuestsData, companions: readonly CompanionType[]) {
	const old = (quests as unknown as { story?: QuestProgress }).story;
	// Reconcile has already filled `lines` from the template (a fresh Story1) in an old save: the old chain wins
	const raw = old !== undefined && getQuestConfig(old.id) !== undefined ? migrateStory(old) : (quests.lines ?? {});
	const lines: QuestsData["lines"] = {};
	for (const [line, quest] of pairs(raw as Record<string, QuestProgress>)) {
		const storyLine = line as keyof typeof STORY_LINES;
		if (STORY_LINES[storyLine] === undefined || !typeIs(quest, "table")) continue;
		if (getStoryLine(quest.id) !== storyLine || !isCount(quest.progress)) continue;
		lines[storyLine] = { id: quest.id, progress: quest.progress, claimed: quest.claimed === true };
	}
	refreshStoryLines(lines, companions);
	quests.lines = lines;
	(quests as unknown as { story?: QuestProgress }).story = undefined; // the single chain is gone for good
}

/**
 * Cleans a loaded profile (after Reconcile): drops ids that no longer exist in the shared config,
 * fixes values a new version may break, and keeps the invariants the services rely on.
 */
export function sanitizeSave(save: SaveData) {
	const data = save.player;

	const fish = { ...DEFAULT_PLAYER_DATA.fish };
	for (const [fishType, count] of pairs(data.fish)) {
		if (isFishType(fishType) && isCount(count)) fish[fishType] = math.floor(count);
	}
	data.fish = fish;
	data.hatched = filterRecord(data.hatched, FISH_TYPES);
	const hatchedVariants: PlayerData["hatchedVariants"] = {};
	for (const [fishType, variants] of pairs(data.hatchedVariants as Record<string, unknown>)) {
		if (!isFishType(fishType) || !typeIs(variants, "table")) continue;
		const counts = filterRecord(variants as Partial<Record<FishVariant, number>>, FISH_VARIANTS);
		counts.Normal = undefined; // derived from hatched (see getHatchedVariant)
		hatchedVariants[fishType] = counts;
	}
	data.hatchedVariants = hatchedVariants;
	data.incubating = sanitizeIncubating(data.incubating);
	data.incubators = isCount(data.incubators) ? math.max(math.floor(data.incubators), DEFAULT_INCUBATORS) : DEFAULT_INCUBATORS;
	data.eggsBought = filterRecord(data.eggsBought, EGG_TYPES);
	if (!ONBOARDING_STEPS.includes(data.onboarding)) data.onboarding = DEFAULT_PLAYER_DATA.onboarding;
	if (!isCount(data.money)) data.money = 0;
	data.money = math.min(data.money, MAX_MONEY);
	if (!isCount(data.oceanPoints)) data.oceanPoints = 0;
	data.perks = data.perks.filter((perk, i) => PERKS[perk] !== undefined && data.perks.indexOf(perk) === i);
	data.oceanRewardsClaimed = data.oceanRewardsClaimed.filter(
		(id, i) => getOceanMilestone(id) !== undefined && data.oceanRewardsClaimed.indexOf(id) === i,
	);
	if (!isCount(data.likesReceived)) data.likesReceived = 0;
	if (!isCount(data.lastLikeGivenAt)) data.lastLikeGivenAt = 0;
	data.rebirths = isCount(data.rebirths) ? math.min(math.floor(data.rebirths), REBIRTHS.size()) : 0;
	sanitizeStoryLines(data.quests, data.companions);
	// Rebirth unlocked before its quest existed (it came with the first affordable rebirth): line done
	const rebirthQuest = data.quests.lines.Rebirth;
	// (only Saving Up: the Voyage quests after it in the same line are claimed normally)
	if (data.features.includes("Rebirth") && rebirthQuest && rebirthQuest.id === "Story9" && !rebirthQuest.claimed) {
		const target = getQuestConfig(rebirthQuest.id)?.target ?? 0;
		data.quests.lines.Rebirth = { id: rebirthQuest.id, progress: target, claimed: true };
	}

	data.companions = data.companions.filter(
		(c, i) => COMPANION_TYPES[c] !== undefined && data.companions.indexOf(c) === i,
	);
	// The passes are the saved ones here (GamePassService checks them again with Roblox, then trims the equipped)
	data.passes = data.passes.filter((p, i) => isGamePass(p) && data.passes.indexOf(p) === i);
	const equipped = new Array<CompanionType>();
	for (const companionType of data.equippedCompanions) {
		if (equipped.size() >= getCompanionSlots(data)) break;
		if (data.companions.includes(companionType) && !equipped.includes(companionType)) equipped.push(companionType);
	}
	data.equippedCompanions = equipped;
	// The eggs ran offline at the speed they had at the disconnection; from now on, at the speed of what is equipped
	if (!typeIs(data.incubationMultiplier, "number") || !(data.incubationMultiplier > 0)) data.incubationMultiplier = 1;
	syncIncubationSpeed(data, Workspace.GetServerTimeNow());
	data.features = data.features.filter((f) => FEATURES[f] !== undefined);
	data.cosmetics = data.cosmetics.filter((c, i) => isCosmeticId(c) && data.cosmetics.indexOf(c) === i);
	data.tutorialsDone = data.tutorialsDone.filter((f) => FEATURES[f] !== undefined);

	save.tank = save.tank.filter(
		(saved) =>
			isFishType(saved.fishType) &&
			isCount(saved.scale) &&
			isCount(saved.age) &&
			isCount(saved.hungerLeft) &&
			(saved.hunger === HungerState.Satiated ||
				saved.hunger === HungerState.Hungry ||
				saved.hunger === HungerState.Weak),
	);
	for (const saved of save.tank) {
		if (saved.variant !== undefined && !isFishVariant(saved.variant)) saved.variant = undefined;
	}
	// Living rare variants: restoreTank brings back, per type, the first saved fish of that type (as many as
	// data.fish says, extra ones newborn and normal), so the same fish are counted here
	const fishVariants: PlayerData["fishVariants"] = {};
	for (const [fishType, count] of pairs(data.fish)) {
		let left = count;
		for (const saved of save.tank) {
			if (left <= 0) break;
			if (saved.fishType !== fishType) continue;
			left -= 1;
			const variant = saved.variant ?? "Normal";
			if (variant === "Normal") continue;
			const variants = fishVariants[fishType] ?? {};
			variants[variant] = (variants[variant] ?? 0) + 1;
			fishVariants[fishType] = variants;
		}
	}
	data.fishVariants = fishVariants;
}
