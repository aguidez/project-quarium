import { CompanionType, DEFAULT_COMPANION_SLOTS, WATER_HEN_HATCH_MULTIPLIER } from "./companions";
import { CosmeticId } from "./cosmetics";
import { EGG_TYPES, EggType } from "./eggs";
import { Feature } from "./features";
import { DEFAULT_FISH_CAPACITY, FishType } from "./fish";
import { OnboardingStep } from "./onboarding";
import { createQuestsData, QuestsData } from "./quests";
import { getVariantLuck, OceanRewardId } from "./oceanRewards";
import { getPerkHatchMultiplier, Perk } from "./perks";
import { FishVariant } from "./variants";
import { GamePass, getPassCompanionSlots, getPassVariantLuck } from "./gamepasses";

/**
 * Money never goes above this (DataService credits clamp to it): 1 quadrillion, the last unit the UI shortens
 * ("Qa"), and far below the doubles' exact-integer limit (9e15). The V1 economy tops out around 2T.
 */
export const MAX_MONEY = 1e15;
/** Incubators per egg type at first; PlayerData.incubators grows with the Ocean milestones. */
export const DEFAULT_INCUBATORS = 1;

export interface PlayerData {
	money: number;
	fish: Record<FishType, number>; // number of living fish per type
	/**
	 * Of those, the ones of a rare variant, per type (no "Normal" key: normal = fish minus these). Kept by
	 * DataService (hatch / removal), rebuilt from the saved tank on load. Lets the client show what can be released.
	 */
	fishVariants: Partial<Record<FishType, Partial<Record<FishVariant, number>>>>;
	/**
	 * Eggs being incubated, per type: when each hatches (Workspace:GetServerTimeNow() time), soonest first. At most
	 * `incubators` per type; older saves held one number per type (migrated by sanitizeSave).
	 */
	incubating: Partial<Record<EggType, number[]>>;
	/**
	 * Hatch speed the `incubating` timers run at now (getHatchMultiplier when they were last rescaled, see
	 * syncIncubationSpeed): the Water Hen speeds up the eggs live, and they keep running at that speed offline.
	 */
	incubationMultiplier: number;
	/** Eggs of the same type that can incubate at once (Ocean milestone "Incubator"), kept through rebirths. */
	incubators: number;
	/** Eggs bought so far, per type: buying one unlocks the next egg of the shop (see isEggUnlocked). */
	eggsBought: Partial<Record<EggType, number>>;
	onboarding: OnboardingStep;
	/** Fish hatched so far per type, dead ones included: a type is discovered in the fish index once hatched. */
	hatched: Partial<Record<FishType, number>>;
	/**
	 * Of those, the ones of a rare variant, per type (no "Normal" key: normal = hatched minus these, so
	 * fish hatched before variants existed count as normal). Each variant is its own Fish Index entry.
	 */
	hatchedVariants: Partial<Record<FishType, Partial<Record<FishVariant, number>>>>;
	/** Max living fish in the aquarium: a full aquarium can still buy eggs but not open them. Grows with progression. */
	capacity: number;
	quests: QuestsData;
	/** Companions earned so far (each type once). */
	companions: CompanionType[];
	/** Companions in the aquarium, at most companionSlots of them. */
	equippedCompanions: CompanionType[];
	companionSlots: number;
	/** Score earned by releasing fish to the ocean; it only grows (unlocks are thresholds, nothing is spent). */
	oceanPoints: number;
	/** Permanent bonuses earned through quests (shared/types/perks), kept through rebirths. */
	perks: Perk[];
	/** Ocean milestones claimed (shared/types/oceanRewards), kept through rebirths. */
	oceanRewardsClaimed: OceanRewardId[];
	/** Features unlocked through progression, and those whose tutorial was seen. */
	features: Feature[];
	tutorialsDone: Feature[];
	/** Likes received from other players on the aquarium's board (see shared/types/likes). */
	likesReceived: number;
	/** When this player last liked an aquarium (server time; 0 = never): one like per LIKE_COOLDOWN. */
	lastLikeGivenAt: number;
	/** Rebirths done (shared/types/rebirths): permanent coin multiplier and aquarium theme. */
	rebirths: number;
	/** Titles, decor and finishes earned (shared/types/cosmetics), kept forever. */
	cosmetics: CosmeticId[];
	/**
	 * Gamepasses owned (shared/types/gamepasses): written by the server from Roblox at join (GamePassService,
	 * ROADMAP M3), never from the client. Empty until then.
	 */
	passes: GamePass[];
}

export const DEFAULT_PLAYER_DATA: PlayerData = {
	money: 0, // the first egg is free and the onboarding gives ONBOARDING_REWARD
	fish: {
		Basic: 0,
		Big: 0,
		RedTetra: 0,
		Clownfish: 0,
		ZebraDanio: 0,
		FlameGourami: 0,
		SilverAngelfish: 0,
		PirateFish: 0,
		ImperialDiscus: 0,
		Catfish: 0,
		BlueTang: 0,
		BabySunfish: 0,
		Lanternfish: 0,
		Lionfish: 0,
		Dragonfish: 0,
		WolfDogfish: 0,
		BunnyShark: 0,
		MiniLeviathan: 0,
		FrenchFish: 0,
	},
	fishVariants: {},
	incubating: {},
	incubationMultiplier: 1,
	incubators: DEFAULT_INCUBATORS,
	eggsBought: {},
	onboarding: "EnterView",
	hatched: {},
	hatchedVariants: {},
	capacity: DEFAULT_FISH_CAPACITY,
	quests: createQuestsData(),
	companions: [],
	equippedCompanions: [],
	companionSlots: DEFAULT_COMPANION_SLOTS,
	oceanPoints: 0,
	oceanRewardsClaimed: [],
	perks: [],
	features: [],
	tutorialsDone: [],
	likesReceived: 0,
	lastLikeGivenAt: 0,
	rebirths: 0,
	cosmetics: [],
	passes: [],
};

/** Fish of the type and variant hatched so far (the Fish Index entry is discovered once it is above 0). */
export function getHatchedVariant(
	data: Pick<PlayerData, "hatched" | "hatchedVariants">,
	fishType: FishType,
	variant: FishVariant,
): number {
	const variants = data.hatchedVariants[fishType] ?? {};
	if (variant !== "Normal") return variants[variant] ?? 0;
	let normal = data.hatched[fishType] ?? 0;
	for (const [, count] of pairs(variants)) normal -= count;
	return math.max(normal, 0);
}

/** Living fish of the type in the variant. */
export function getLivingVariant(
	data: Pick<PlayerData, "fish" | "fishVariants">,
	fishType: FishType,
	variant: FishVariant,
): number {
	const variants = data.fishVariants[fishType] ?? {};
	if (variant !== "Normal") return variants[variant] ?? 0;
	let normal = data.fish[fishType] ?? 0;
	for (const [, count] of pairs(variants)) normal -= count;
	return math.max(normal, 0);
}

/** Companions that can be equipped at once: the Ocean slots, plus the Third Companion Slot pass. */
export function getCompanionSlots(data: Pick<PlayerData, "companionSlots" | "passes">): number {
	return data.companionSlots + getPassCompanionSlots(data.passes);
}

/** The rare variants' chances multiplier of a player: Lucky ocean (Ocean milestone) x the Lucky pass. */
export function getPlayerVariantLuck(data: Pick<PlayerData, "oceanRewardsClaimed" | "passes">): number {
	return getVariantLuck(data.oceanRewardsClaimed) * getPassVariantLuck(data.passes);
}

/** Hatch time of an egg bought now (x its EGG_TYPES time): shorter while the Water Hen is equipped. */
export function getHatchMultiplier(data: Pick<PlayerData, "equippedCompanions" | "perks">): number {
	if (!data.equippedCompanions.includes("WaterHen")) return 1;
	return getPerkHatchMultiplier(data.perks) ?? WATER_HEN_HATCH_MULTIPLIER;
}

/**
 * Rescales the incubating eggs' timers when the hatch speed changed (the Water Hen equipped or unequipped, one of its
 * perks earned): what is left of each egg's hatching runs at the new speed, the progress made so far is kept, an egg
 * already ready stays ready. Timers are server times, so they keep the speed they had at the disconnection while
 * the player is offline. Returns whether anything changed.
 */
export function syncIncubationSpeed(
	data: Pick<PlayerData, "incubating" | "incubationMultiplier" | "equippedCompanions" | "perks">,
	now: number,
): boolean {
	const multiplier = getHatchMultiplier(data);
	const previous = data.incubationMultiplier;
	if (multiplier === previous) return false;
	data.incubationMultiplier = multiplier;
	if (!(previous > 0)) return true; // a broken save: its timers are kept as they are
	for (const [, eggs] of pairs(data.incubating)) {
		for (let i = 0; i < eggs.size(); i++) {
			if (eggs[i] > now) eggs[i] = now + ((eggs[i] - now) * multiplier) / previous;
		}
	}
	return true;
}

export function getTotalFish(data: PlayerData): number {
	let total = 0;
	for (const [, count] of pairs(data.fish)) {
		total += count;
	}
	return total;
}

/** Living fish plus incubating eggs (the starter egg is only free when the player has neither). */
export function getFishAndEggs(data: PlayerData): number {
	let total = getTotalFish(data);
	for (const [, eggs] of pairs(data.incubating)) total += eggs.size();
	return total;
}

/** Hatch times of the eggs of this type being incubated, soonest first (empty: none). */
export function getIncubating(data: Pick<PlayerData, "incubating">, eggType: EggType): readonly number[] {
	return data.incubating[eggType] ?? [];
}

/** Whether another egg of this type can start incubating (an incubator of its type is free). */
export function hasFreeIncubator(data: Pick<PlayerData, "incubating" | "incubators">, eggType: EggType): boolean {
	return getIncubating(data, eggType).size() < data.incubators;
}

/** An egg shows up in the shop (and can be bought) once the player has bought one of the egg it requires. */
export function isEggUnlocked(data: PlayerData, eggType: EggType): boolean {
	const requires = EGG_TYPES[eggType].requires;
	return requires === undefined || (data.eggsBought[requires] ?? 0) > 0;
}
