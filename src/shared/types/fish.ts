export type FishType =
	| "Basic"
	| "Big"
	| "RedTetra"
	| "Clownfish"
	| "ZebraDanio"
	| "FlameGourami"
	| "SilverAngelfish"
	| "PirateFish"
	| "ImperialDiscus"
	| "Catfish"
	| "BlueTang"
	| "BabySunfish"
	| "Lanternfish"
	| "Lionfish"
	| "Dragonfish"
	| "WolfDogfish"
	| "BunnyShark"
	| "MiniLeviathan"
	| "FoxBetta"
	| "CloudWhale"
	| "PegasusSeahorse"
	| "FrenchFish"
	| "AlienFish"
	| "Sugar";

/** Rarity of a fish type, shown in the fish index, the egg odds and the hatch reveal. */
export type FishRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Secret";
/** Rarities from the most common to the rarest (the fish index is sorted this way). Secret: the easter egg fish. */
export const FISH_RARITIES: readonly FishRarity[] = [
	"Common",
	"Uncommon",
	"Rare",
	"Epic",
	"Legendary",
	"Mythic",
	"Secret",
];

/** Coin dropped by a fish every `incomeInterval` seconds, worth `income`. */
export type CoinType =
	| "Bronze"
	| "Silver"
	| "Gold"
	| "Platinum"
	| "Amethyst"
	| "Orichalcum"
	| "Pearl"
	| "Ruby"
	| "Crown"
	| "Chest"
	| "Sapphire"
	| "SunMedallion"
	| "Nautilus"
	| "CoralFan"
	| "DragonScale"
	| "Moon"
	| "Star"
	| "Planet"
	| "Frost"
	| "Cloud"
	| "Feather"
	| "Croissant"
	| "Sugar";
export const COIN_TYPES: readonly CoinType[] = [
	"Bronze",
	"Silver",
	"Gold",
	"Platinum",
	"Amethyst",
	"Orichalcum",
	"Pearl",
	"Ruby",
	"Crown",
	"Chest",
	"Sapphire",
	"SunMedallion",
	"Nautilus",
	"CoralFan",
	"DragonScale",
	"Moon",
	"Star",
	"Planet",
	"Frost",
	"Cloud",
	"Feather",
	"Croissant",
	"Sugar",
];

/**
 * Fish never starve to death (losing one by accident is too frustrating): an unfed fish turns
 * Hungry, then Weak until it eats. A weak fish swims very slowly and, instead of its coins, only
 * lets out fart bubbles that rise to the surface, worth FART_BUBBLE_VALUE each when clicked.
 */
export enum HungerState {
	Satiated = "Satiated",
	Hungry = "Hungry",
	Weak = "Weak",
}

export interface HungerConfig {
	satiatedDuration: number; // seconds
	hungryDuration: number; // then Weak, until fed
}

/** Money of a weak fish's fart bubble. */
export const FART_BUBBLE_VALUE = 1;

/** A bought fish starts small and grows with the time it spends in the water. */
export interface GrowthStage {
	age: number; // seconds in the water before reaching this stage
	size: number; // fraction of the adult size (coins always keep their full size)
	coinMultiplier: number;
}

/** Growth of every fish type that doesn't define its own `growth`. */
export const DEFAULT_GROWTH: readonly GrowthStage[] = [
	{ age: 0, size: 1 / 3, coinMultiplier: 1 },
	{ age: 5 * 60, size: 2 / 3, coinMultiplier: 1.2 },
	{ age: 10 * 60, size: 1, coinMultiplier: 1.5 },
];

export interface FishConfig {
	displayName: string;
	rarity: FishRarity;
	income: number; // value of the coin dropped every `incomeInterval` seconds
	coin: CoinType;
	incomeInterval: number;
	// Random size multiplier applied to the Studio template (ServerStorage.Assets.Fish)
	scaleMin: number;
	scaleMax: number;
	speedMin: number; // studs/s while wandering
	speedMax: number;
	hunger: HungerConfig;
	growth?: readonly GrowthStage[]; // defaults to DEFAULT_GROWTH
	/** Once weak with hunger, hunts the smaller non-cannibal fish of its tank (see FishService.findPrey). No species does yet. */
	cannibal?: boolean;
	/** Ocean Points earned by releasing one to the ocean (see features.ts): the rarer and richer, the more. */
	oceanPoints: number;
	/** A secret fish (Fish Index category "Easter eggs"): no variant, coins worth a share of the tank's income. */
	easterEgg?: EasterEggConfig;
	/**
	 * How its bone rig swims (FishRigController): "Vertical" beats the spine up and down (a whale's fluke, the Cloud
	 * Whale), the turns still bend it sideways; default: side to side like a fish.
	 */
	stroke?: "Vertical";
}

/**
 * An easter egg fish hides in every egg with a chance shown nowhere, taken from the egg's most common
 * fish (see getDrawOdds). It hatches without a variant, its coins (every `incomeInterval`) are worth
 * `incomeShare` of the tank's theoretical income per minute (FishService.getTankIncomePerMinute) instead
 * of `income` (none at 0), and with a `lifetime` it doesn't stay: after that many seconds in the water (its
 * age: frozen offline and while the tank is paused, like its growth) it leaves for the ocean by itself, Ocean
 * Points included. The alien fish (UFO event) never hatches from an egg and stays: it screams instead. Sugar comes
 * with a like (`likeChance`) and copies the tank's best fish (`bestFishShare`).
 */
export interface EasterEggConfig {
	/** Percent per egg opened (0: never from an egg). */
	hatchChance: number;
	/**
	 * Percent per like the player gives (LikeService): it swims into the giver's own tank, even a full one, and never
	 * while one is already there (one per tank).
	 */
	likeChance?: number;
	/**
	 * Copies the tank's best fish (FishService.getBestFish: the highest income per second, easter eggs aside): drops its
	 * own coin each time that fish's interval passes (variant pace included), worth this many times that fish's coin at
	 * its growth stage (then its own sparkle roll and the usual multipliers). Nothing while it is alone. Overrides
	 * `incomeShare`.
	 */
	bestFishShare?: number;
	/** Fish Index: where it comes from (in place of the eggs and odds), and what it does (in place of its coins). */
	source: string;
	perk: string;
	incomeShare: number;
	/** Seconds in the water before it leaves on its own; none: it stays until released. */
	lifetime?: number;
	/** Told to the owner when it leaves on its own. */
	leaveMessage?: string;
	/**
	 * Seconds between two screams (FishService): a wave through its tank that makes every other fish drop one plain
	 * coin (never sparkling nor ghost), on top of their own (their timers don't move). Only while the tank produces.
	 */
	screamInterval?: number;
}

export const DEFAULT_HUNGER: HungerConfig = {
	satiatedDuration: 30,
	hungryDuration: 15,
};

/**
 * Economy (see BALANCE.md and the notes in eggs.ts): the bigger the fish, the rarer but the bigger its
 * coins. Income per second (baby stage): Guppy 1, Neon 2.5, Tetra 6, Clownfish 15, Danio 30, Gourami 70,
 * Angelfish 160, Pirate 300, Discus 700.
 */
export const FISH_TYPES: Record<FishType, FishConfig> = {
	Basic: {
		displayName: "Golden Guppy",
		rarity: "Common",
		income: 4,
		oceanPoints: 1,
		coin: "Bronze",
		incomeInterval: 4, // tiny: many small coins, the busy start of the game
		scaleMin: 0.85,
		scaleMax: 1.2,
		speedMin: 4,
		speedMax: 8,
		hunger: DEFAULT_HUNGER,
		growth: [{ age: 0, size: 1, coinMultiplier: 1 }], // already tiny: never grows
	},
	Big: {
		displayName: "Blue Neon",
		rarity: "Common",
		income: 25,
		oceanPoints: 2,
		coin: "Silver",
		incomeInterval: 10,
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 3,
		speedMax: 5,
		hunger: DEFAULT_HUNGER,
		growth: [
			{ age: 0, size: 2 / 3, coinMultiplier: 1 },
			{ age: 5 * 60, size: 1, coinMultiplier: 1.2 },
		],
	},
	RedTetra: {
		displayName: "Red Tetra",
		rarity: "Common",
		income: 48,
		oceanPoints: 4,
		coin: "Gold",
		incomeInterval: 8,
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 4,
		speedMax: 6,
		hunger: DEFAULT_HUNGER,
	},
	Clownfish: {
		displayName: "Clownfish",
		rarity: "Common",
		income: 180,
		oceanPoints: 15,
		coin: "Platinum",
		incomeInterval: 12,
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 3,
		speedMax: 5,
		hunger: DEFAULT_HUNGER,
	},
	ZebraDanio: {
		displayName: "Zebra Danio",
		rarity: "Uncommon",
		income: 150,
		oceanPoints: 25,
		coin: "Amethyst",
		incomeInterval: 5, // small and lively: frequent gems
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 6,
		speedMax: 9,
		hunger: DEFAULT_HUNGER,
	},
	FlameGourami: {
		displayName: "Flame Gourami",
		rarity: "Uncommon",
		income: 1400,
		oceanPoints: 80,
		coin: "Orichalcum",
		incomeInterval: 20, // big and slow: a heavy ingot now and then
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 2,
		speedMax: 3.5,
		hunger: DEFAULT_HUNGER,
	},
	// Rebirth 2 content (Amazon and Neon Coral eggs): the wall after the first six species. All three Rare:
	// Epic and Legendary are kept for later species
	SilverAngelfish: {
		displayName: "Silver Angelfish",
		rarity: "Uncommon",
		income: 2400,
		oceanPoints: 150,
		coin: "Pearl",
		incomeInterval: 15, // a slow, graceful glider: a pearl now and then
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 2,
		speedMax: 3.5,
		hunger: DEFAULT_HUNGER,
	},
	PirateFish: {
		displayName: "Pirate Fish",
		rarity: "Uncommon",
		income: 1500,
		oceanPoints: 250,
		coin: "Ruby",
		incomeInterval: 5, // a lively little captain: rubies all the time
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 3,
		speedMax: 5,
		hunger: DEFAULT_HUNGER,
	},
	ImperialDiscus: {
		displayName: "Imperial Discus",
		rarity: "Rare",
		income: 17500,
		oceanPoints: 500,
		coin: "Crown",
		incomeInterval: 25, // majestic and slow: a heavy crown now and then
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 1.8,
		speedMax: 3,
		hunger: DEFAULT_HUNGER,
	},
	// --- Rebirths 3–4 (V1 plan, BALANCE.md §5): the Pirate Wreck's and Atlantis' species, x2 income each ---
	Catfish: {
		displayName: "Catfish",
		rarity: "Rare",
		income: 16000, // 1,600/s
		oceanPoints: 800,
		coin: "Chest",
		incomeInterval: 10, // a bottom dweller digging up little treasure chests
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 1.5,
		speedMax: 2.5,
		hunger: DEFAULT_HUNGER,
	},
	BlueTang: {
		displayName: "Blue Tang",
		rarity: "Rare",
		income: 19200, // 3,200/s
		oceanPoints: 1300,
		coin: "Sapphire",
		incomeInterval: 6, // quick and lively: small gems often
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 2.6,
		speedMax: 4,
		hunger: DEFAULT_HUNGER,
	},
	BabySunfish: {
		displayName: "Baby Sunfish",
		rarity: "Rare",
		income: 130000, // 6,500/s
		oceanPoints: 2000,
		coin: "SunMedallion",
		incomeInterval: 20, // a slow round drifter: a big golden sun now and then
		scaleMin: 0.95,
		scaleMax: 1.1,
		speedMin: 1.2,
		speedMax: 2.2,
		hunger: DEFAULT_HUNGER,
	},
	// --- Rebirth 5 (ROADMAP M4): the Mariana Trench's species. Not the Abyss event's lantern fish (EventFish
	// "LanternFish"): another look, photophores and no lure ---
	Lanternfish: {
		displayName: "Lanternfish",
		rarity: "Epic",
		income: 156000, // 13,000/s
		oceanPoints: 3200,
		coin: "Nautilus",
		incomeInterval: 12, // a little glowing darter: a shining nautilus shell now and then
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 2.6,
		speedMax: 4.2,
		hunger: DEFAULT_HUNGER,
	},
	// --- Rebirth 6 (ROADMAP M5): the Volcanic Temple's species. Lionfish with soft fan fins (no spines), Dragonfish
	// with glowing scales (no fire, no fangs): CLAUDE.md §7 ---
	Lionfish: {
		displayName: "Lionfish",
		rarity: "Epic",
		income: 208000, // 26,000/s
		oceanPoints: 5000,
		coin: "CoralFan",
		incomeInterval: 8, // a frilly little dancer: red coral fans often
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 2.2,
		speedMax: 3.6,
		hunger: DEFAULT_HUNGER,
	},
	Dragonfish: {
		displayName: "Dragonfish",
		rarity: "Epic",
		income: 1300000, // 52,000/s
		oceanPoints: 8000,
		coin: "DragonScale",
		incomeInterval: 25, // a long glowing glider: a heavy golden scale now and then
		scaleMin: 0.95,
		scaleMax: 1.1,
		speedMin: 1.8,
		speedMax: 3,
		hunger: DEFAULT_HUNGER,
	},
	// --- Rebirths 7–8 (ROADMAP M6), the last species of V1: Mythic. Cartoon faces, mouths closed, no teeth, horns or
	// fangs (CLAUDE.md §7) ---
	WolfDogfish: {
		displayName: "Husky Dogfish",
		rarity: "Epic",
		income: 1575000, // 105,000/s
		oceanPoints: 13000,
		coin: "Moon",
		incomeInterval: 15, // a little shark howling at the moon: silver crescents
		scaleMin: 0.9,
		scaleMax: 1.1,
		speedMin: 2.4,
		speedMax: 3.8,
		hunger: DEFAULT_HUNGER,
	},
	BunnyShark: {
		displayName: "Bunny Shark",
		rarity: "Legendary",
		income: 4200000, // 210,000/s
		oceanPoints: 20000,
		coin: "Star",
		incomeInterval: 20, // a pink shark with bunny ears, hopping through the water: golden stars
		scaleMin: 0.95,
		scaleMax: 1.1,
		speedMin: 1.8,
		speedMax: 3,
		hunger: DEFAULT_HUNGER,
	},
	MiniLeviathan: {
		displayName: "Mini Leviathan",
		rarity: "Legendary",
		income: 12600000, // 420,000/s
		oceanPoints: 32000,
		coin: "Planet",
		incomeInterval: 30, // the rarest of all: a whole little planet now and then
		scaleMin: 0.95,
		scaleMax: 1.1,
		speedMin: 1.6,
		speedMax: 2.8,
		hunger: DEFAULT_HUNGER,
	},
	// V1.2 (ROADMAP_V1.2 §3.2), species 19, the Aurora Glacier's: a round fox-fish (it replaced the planned Penguin
	// Puffer). Income x2 the Mini Leviathan's, Ocean Points x1.6
	FoxBetta: {
		displayName: "Fox Betta",
		rarity: "Legendary",
		income: 10080000, // 840,000/s
		oceanPoints: 51000,
		coin: "Frost",
		incomeInterval: 12,
		scaleMin: 0.95,
		scaleMax: 1.1,
		speedMin: 1.8,
		speedMax: 3,
		hunger: DEFAULT_HUNGER,
	},
	// V1.2 (ROADMAP_V1.2 §3.2), species 20-21, the Sky Archipelago's (rebirth 10, the Sky Egg). Income x2 the previous
	// species', Ocean Points x1.6
	CloudWhale: {
		displayName: "Cloud Whale",
		rarity: "Legendary",
		income: 33600000, // 1,680,000/s
		oceanPoints: 82000,
		coin: "Cloud",
		incomeInterval: 20, // a baby whale covered in clouds: little puffy clouds
		scaleMin: 0.95,
		scaleMax: 1.1,
		speedMin: 1.5,
		speedMax: 2.5,
		hunger: DEFAULT_HUNGER,
		stroke: "Vertical",
	},
	PegasusSeahorse: {
		displayName: "Pegasus Seahorse",
		rarity: "Mythic",
		income: 100800000, // 3,360,000/s
		oceanPoints: 131000,
		coin: "Feather",
		incomeInterval: 30, // a winged white seahorse with a golden mane: soft white feathers
		scaleMin: 0.95,
		scaleMax: 1.1,
		speedMin: 1.3,
		speedMax: 2.3,
		hunger: DEFAULT_HUNGER,
	},
	// Easter egg (see EasterEggConfig): its coin is a croissant worth half the tank's income per minute
	FrenchFish: {
		displayName: "French Fish",
		rarity: "Secret",
		income: 0,
		// A nice surprise early (the 50 and 100 milestones) that doesn't skip the mid-game ones: it hatches
		// from any egg, at minute 5 as well as after rebirth 2
		oceanPoints: 100,
		coin: "Croissant",
		incomeInterval: 60,
		scaleMin: 0.95,
		scaleMax: 1.05,
		speedMin: 2.5,
		speedMax: 4,
		hunger: DEFAULT_HUNGER,
		growth: [{ age: 0, size: 1, coinMultiplier: 1 }], // hatches grown up: it is only passing through
		easterEgg: {
			hatchChance: 0.1,
			source: "Hides in any egg, now and then",
			perk: "A croissant every 1 min",
			incomeShare: 0.5,
			lifetime: 60 * 60,
			leaveMessage: "The French Fish went off to join a protest. Au revoir!",
		},
	},
	// Easter egg of the UFO event (0.5 % of the fish a UFO brings back): no coin of its own, it stays, and its scream
	// makes the whole tank drop a coin every 30 s (EasterEggConfig.screamInterval)
	AlienFish: {
		displayName: "Alien Fish",
		rarity: "Secret",
		income: 0,
		oceanPoints: 500,
		coin: "Bronze", // never dropped (incomeShare 0)
		incomeInterval: 60,
		scaleMin: 0.95,
		scaleMax: 1.05,
		speedMin: 2.5,
		speedMax: 4,
		hunger: DEFAULT_HUNGER,
		growth: [{ age: 0, size: 1, coinMultiplier: 1 }], // comes back grown up
		easterEgg: {
			hatchChance: 0,
			source: "Brought back by a UFO, now and then",
			perk: "Screams every 30s: your fish drop coins",
			incomeShare: 0,
			screamInterval: 30,
		},
	},
	// Easter egg of the likes (1 % of the likes a player gives, into the giver's tank, one per tank): a sugar cube as often as the tank's best fish drops
	// its coin, worth 110 % of that coin (EasterEggConfig.bestFishShare); it stays
	Sugar: {
		displayName: "Sugar",
		rarity: "Secret",
		income: 0,
		oceanPoints: 500,
		coin: "Sugar",
		incomeInterval: 60, // until the tank has another fish to copy
		scaleMin: 0.95,
		scaleMax: 1.05,
		speedMin: 2,
		speedMax: 3.2, // round and plump: a little slower than the other secret fish
		hunger: DEFAULT_HUNGER,
		growth: [{ age: 0, size: 1, coinMultiplier: 1 }], // arrives grown up
		easterEgg: {
			hatchChance: 0,
			likeChance: 1,
			source: "Give a like: 1 chance in 100",
			perk: "A sugar cube: 110% of your best fish's coin",
			incomeShare: 0,
			bestFishShare: 1.1,
		},
	},
};

/** One coin out of SPECIAL_COIN_ODDS (random) sparkles and is worth SPECIAL_COIN_MULTIPLIER times more. */
export const SPECIAL_COIN_ODDS = 15;
export const SPECIAL_COIN_MULTIPLIER = 2;

/** The clickable coin hitbox is this much bigger than the Studio template's, so coins are easy to click. */
export const COIN_HITBOX_SCALE = 1.3;

/** Growth stages of a fish type (its own `growth`, or DEFAULT_GROWTH). */
export function getGrowthStages(fishType: FishType): readonly GrowthStage[] {
	return FISH_TYPES[fishType].growth ?? DEFAULT_GROWTH;
}

/** Index in the type's growth stages of a fish that has spent `age` seconds in the water. */
export function getGrowthStage(fishType: FishType, age: number): number {
	const stages = getGrowthStages(fishType);
	let stage = 0;
	for (let i = 1; i < stages.size(); i++) {
		if (age >= stages[i].age) stage = i;
	}
	return stage;
}

/** Value of a coin dropped by a fish of the given type at the given growth stage. */
export function getCoinValue(fishType: FishType, stage: number, special: boolean): number {
	const multiplier = getGrowthStages(fishType)[stage].coinMultiplier * (special ? SPECIAL_COIN_MULTIPLIER : 1);
	return math.round(FISH_TYPES[fishType].income * multiplier);
}

/** Living fish an aquarium holds at first; PlayerData.capacity grows with progression. */
export const DEFAULT_FISH_CAPACITY = 10;

/** Average income per second for one fish of the given type (baby stage, no special coins). */
export function getIncomePerSecond(fishType: FishType): number {
	const config = FISH_TYPES[fishType];
	return config.income / config.incomeInterval;
}

/** Whether the fish type is a secret one (FishConfig.easterEgg): no variant, its own Fish Index category. */
export function isEasterEgg(fishType: FishType): boolean {
	return FISH_TYPES[fishType].easterEgg !== undefined;
}

/** Fish types in fish index order: by rarity, then by income (easter eggs last, see isEasterEgg). */
export function getFishIndexOrder(): FishType[] {
	const fishTypes = new Array<FishType>();
	for (const [fishType] of pairs(FISH_TYPES)) fishTypes.push(fishType);
	const rank = (fishType: FishType) => FISH_RARITIES.indexOf(FISH_TYPES[fishType].rarity);
	fishTypes.sort((a, b) => (rank(a) !== rank(b) ? rank(a) < rank(b) : getIncomePerSecond(a) < getIncomePerSecond(b)));
	return fishTypes;
}
