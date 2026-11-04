/**
 * Play statistics of a player, saved with their profile (SaveData.stats) but never sent to the client: read offline by
 * tools/player-stats.js (Open Cloud) to calibrate the balance against real players (ROADMAP M7), and summed up live in
 * the Creator Dashboard through AnalyticsService (StatsService). Written only by StatsService.
 *
 * Times: `tending` is the simulator's play time (in front of the tank, producing: BALANCE.md §1), `play` every second
 * in the game, `days` the distinct UTC days played. A milestone reached before the stats existed (a save older than
 * V0.47) is kept with tending = -1: known, but not when.
 */
export interface MilestoneTime {
	tending: number;
	play: number;
	days: number;
	/** Server time (Unix seconds). */
	at: number;
}

/** Performance reported by the clients of one kind of device (ReportClientStats, one sample a minute). */
export interface DeviceStats {
	samples: number;
	fpsSum: number;
	/** Samples below 30 fps. */
	lowFps: number;
	memoryMaxMb: number;
	/** Lowest swim animation budget the device settled on (FishAnimationController), 0 if never lowered. */
	swimBudgetMin: number;
}

export interface PlayerStats {
	/** Stats format, for later migrations. */
	version: number;
	/** First join counted (Unix seconds). For a save older than the stats: their first join since V0.47 (see legacy). */
	firstJoinAt: number;
	lastJoinAt: number;
	/** The save had progress before the stats existed: its early milestones have no time. */
	legacy: boolean;
	sessions: number;
	days: number;
	/** UTC day index of the last day counted in `days`. */
	lastDay: number;
	playSeconds: number;
	tendingSeconds: number;
	/** Milestone id ("Onboarding", "Rebirth3", "Species:Catfish", "Ocean:SecondIncubator", "AllSpecies") → when. */
	milestones: Record<string, MilestoneTime>;
	/** Coins dropped by the fish (not the onboarding's), and how they were picked up: the rest expired. */
	coinsDropped: number;
	coinValueDropped: number;
	coinsClicked: number;
	coinValueClicked: number;
	coinsByCompanion: number;
	coinValueByCompanion: number;
	/** Meals from the food the player dropped. */
	mealsByHand: number;
	/** Quests claimed per category, and the coin boost minutes they gave (the rest is in PlayerData.coinBoostSeconds). */
	questsClaimed: { Story: number; Daily: number; Weekly: number };
	boostMinutesEarned: number;
	likesGiven: number;
	/** Platform of each session ("Touch", "Keyboard", "Gamepad", "VR"), as reported by the client (stats only). */
	platforms: Record<string, number>;
	devices: Record<string, DeviceStats>;
	/**
	 * The owner's test speed ("/speed" in Studio, owner only): coins, hatching and Ocean Points x this, saved. A profile
	 * that ever used it is left out of tools/player-stats.js.
	 */
	testSpeed: number;
	testSpeedUsed: boolean;
	/** The owner plays without their gamepasses ("/passes off" in Studio, saved): GamePassService grants none. */
	testNoPasses: boolean;
	/**
	 * The game's staff (admins.ts isAdmin: the owner, the group's admin roles), checked at every join: their profile
	 * sends nothing to the Creator Dashboard and is left out of tools/player-stats.js.
	 */
	staff: boolean;
}

export const PLAYER_STATS_VERSION = 1;

export function createPlayerStats(): PlayerStats {
	return {
		version: PLAYER_STATS_VERSION,
		firstJoinAt: 0,
		lastJoinAt: 0,
		legacy: false,
		sessions: 0,
		days: 0,
		lastDay: -1,
		playSeconds: 0,
		tendingSeconds: 0,
		milestones: {},
		coinsDropped: 0,
		coinValueDropped: 0,
		coinsClicked: 0,
		coinValueClicked: 0,
		coinsByCompanion: 0,
		coinValueByCompanion: 0,
		mealsByHand: 0,
		questsClaimed: { Story: 0, Daily: 0, Weekly: 0 },
		boostMinutesEarned: 0,
		likesGiven: 0,
		platforms: {},
		devices: {},
		testSpeed: 1,
		testSpeedUsed: false,
		testNoPasses: false,
		staff: false,
	};
}

/** The most "/speed" gives. */
export const MAX_TEST_SPEED = 10;

/** The test speed of a profile (1 for everyone but the owner testing): FishService, EggService, OceanService, RebirthService. */
export function getTestSpeed(stats: PlayerStats | undefined): number {
	return stats ? math.clamp(stats.testSpeed, 1, MAX_TEST_SPEED) : 1;
}

const isNumber = (value: unknown): value is number => typeIs(value, "number") && value === value; // excludes NaN

/** Puts back any field a corrupt or older save lacks (Reconcile only fills missing top-level template fields). */
export function sanitizePlayerStats(stats: Partial<PlayerStats> | undefined): PlayerStats {
	const clean = createPlayerStats();
	if (!typeIs(stats, "table")) return clean;
	const source = stats as Record<string, unknown>;
	const target = clean as unknown as Record<string, unknown>;
	for (const [key, value] of pairs(clean as unknown as Record<string, unknown>)) {
		const saved = source[key];
		if (typeIs(value, "number") && isNumber(saved)) target[key] = saved;
		else if (typeIs(value, "boolean") && typeIs(saved, "boolean")) target[key] = saved;
	}
	const claimed = source.questsClaimed;
	if (typeIs(claimed, "table")) {
		const counts = claimed as Record<string, unknown>;
		for (const category of ["Story", "Daily", "Weekly"] as const) {
			if (isNumber(counts[category])) clean.questsClaimed[category] = counts[category];
		}
	}
	if (typeIs(source.milestones, "table")) {
		for (const [id, time] of pairs(source.milestones as Record<string, unknown>)) {
			if (!typeIs(id, "string") || !typeIs(time, "table")) continue;
			const t = time as Record<string, unknown>;
			if (isNumber(t.tending) && isNumber(t.play) && isNumber(t.days) && isNumber(t.at)) {
				clean.milestones[id] = { tending: t.tending, play: t.play, days: t.days, at: t.at };
			}
		}
	}
	if (typeIs(source.platforms, "table")) {
		for (const [platform, count] of pairs(source.platforms as Record<string, unknown>)) {
			if (typeIs(platform, "string") && isNumber(count)) clean.platforms[platform] = count;
		}
	}
	if (typeIs(source.devices, "table")) {
		for (const [platform, device] of pairs(source.devices as Record<string, unknown>)) {
			if (!typeIs(platform, "string") || !typeIs(device, "table")) continue;
			const d = device as Record<string, unknown>;
			if (isNumber(d.samples) && isNumber(d.fpsSum) && isNumber(d.lowFps) && isNumber(d.memoryMaxMb)) {
				clean.devices[platform] = {
					samples: d.samples,
					fpsSum: d.fpsSum,
					lowFps: d.lowFps,
					memoryMaxMb: d.memoryMaxMb,
					swimBudgetMin: isNumber(d.swimBudgetMin) ? d.swimBudgetMin : 0,
				};
			}
		}
	}
	return clean;
}
