import { AnalyticsService, Players, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { FISH_TYPES, FishType, isEasterEgg } from "shared/types/fish";
import { FIRST_GOALS, isFirstGoalDone } from "shared/types/goals";
import { isOnboardingDone, ONBOARDING_STEPS } from "shared/types/onboarding";
import { QuestConfig } from "shared/types/quests";
import { REBIRTHS } from "shared/types/rebirths";
import { isAdmin } from "../admins";
import { getTestSpeed, MilestoneTime, PlayerStats } from "../playerStats";
import { SaveData } from "../saveData";
import { AquariumService } from "./AquariumService";
import { CoinService } from "./CoinService";
import { DataService } from "./DataService";
import { FishService } from "./FishService";
import { LikeService } from "./LikeService";
import { QuestService } from "./QuestService";

const TICK = 1; // seconds between two counts of play time and milestones
const DAY = 24 * 60 * 60;
/** A client reports its performance once a minute; closer reports are ignored. */
const REPORT_MIN_GAP = 45;
const PLATFORMS = ["Touch", "Keyboard", "Gamepad", "VR"] as const;
type Platform = (typeof PLATFORMS)[number];
const isClientReport = t.interface({
	platform: t.literal(...PLATFORMS),
	fps: t.number,
	memoryMb: t.number,
});

/** The one-time "Progression" funnel of the Creator Dashboard: its steps, in order. */
const PROGRESSION_FUNNEL = ["Onboarding:Done", ...REBIRTHS.map((_, i) => `Rebirth${i + 1}`), "AllSpecies"];
/**
 * The one-time "FirstGoals" funnel (V1.2.15): from the tutorial's end to the first rebirth through the "Next goal"
 * card's steps. Only for the players who finished the tutorial since FIRST_GOALS_SINCE: the others never saw the card.
 */
const FIRST_GOALS_FUNNEL = [
	"Onboarding:Done",
	...FIRST_GOALS.map((goal) => `Goal:${goal}`),
	"Quest:Story1",
	"Quest:Story9",
	"Rebirth1",
];
const FIRST_GOALS_SINCE = 1794240000; // 2026-11-09 16:00 UTC, just before V1.2.15 went live

/** What only lasts the session (summed up into the Creator Dashboard when the player leaves). */
interface Session {
	startTending: number;
	startPlay: number;
	coinValueDropped: number;
	coinValuePicked: number;
	platform?: Platform;
	reportedAt: number;
	tickedAt: number;
}

/**
 * Play statistics (ROADMAP M7: calibrating the balance with real players). Counts each player's time in the game and
 * in front of their producing tank, stamps the milestones they reach (onboarding steps, rebirths, species, Ocean
 * milestones, story quests) with those times, and counts coins dropped / picked up, meals, quests, likes and the
 * client's performance. Everything goes into SaveData.stats (read offline by tools/player-stats.js) and a summary into
 * the Creator Dashboard (AnalyticsService: the "Progression" funnel, the onboarding funnel, custom events).
 */
class StatsServiceSingleton implements Lifecycle {
	private sessions = new Map<Player, Session>();

	public onInit() {
		DataService.onLoaded((player, save) => this.startSession(player, save));
		Players.PlayerRemoving.Connect((player) => this.endSession(player));
		DataService.registerAction("ReportClientStats", isClientReport, (player, report) =>
			this.onClientReport(player, report),
		);

		CoinService.onSpawned((owner, value) => {
			const stats = this.getStats(owner);
			const session = this.sessions.get(owner);
			if (!stats || !session) return;
			stats.coinsDropped += 1;
			stats.coinValueDropped += value;
			session.coinValueDropped += value;
		});
		CoinService.onCollected((player, frozen, value, companion) => {
			const stats = this.getStats(player);
			const session = this.sessions.get(player);
			if (frozen || !stats || !session) return;
			if (companion) {
				stats.coinsByCompanion += 1;
				stats.coinValueByCompanion += value;
			} else {
				stats.coinsClicked += 1;
				stats.coinValueClicked += value;
			}
			session.coinValuePicked += value;
		});
		FishService.onFishFed((owner, _fishType, companion) => {
			const stats = this.getStats(owner);
			if (stats && !companion) stats.mealsByHand += 1;
		});
		QuestService.onQuestClaimed((player, questId, config) => this.onQuestClaimed(player, questId, config));
		LikeService.onLikeGiven((player) => {
			const stats = this.getStats(player);
			if (stats) stats.likesGiven += 1;
		});
	}

	public onStart() {
		print("[Server] StatsService started.");
		while (true) {
			const clock = os.clock();
			for (const [player, session] of this.sessions) this.tick(player, session, clock);
			task.wait(TICK);
		}
	}

	private getStats(player: Player): PlayerStats | undefined {
		return DataService.getSave(player)?.stats;
	}

	// ---------------------------------------------------------------------
	// Sessions and time
	// ---------------------------------------------------------------------

	private startSession(player: Player, save: SaveData) {
		const stats = save.stats;
		const now = Workspace.GetServerTimeNow();
		if (stats.firstJoinAt === 0) {
			stats.firstJoinAt = now;
			// A save older than the stats: what it already reached is known, not when
			stats.legacy = isOnboardingDone(save.player.onboarding);
			if (stats.legacy) this.checkMilestones(player, save, true);
		}
		stats.lastJoinAt = now;
		stats.sessions += 1;
		// The owner's test speed ("/speed"), shown on their HUD
		if (getTestSpeed(stats) > 1) player.SetAttribute("TestSpeed", getTestSpeed(stats));
		this.countDay(stats, now);
		this.sessions.set(player, {
			startTending: stats.tendingSeconds,
			startPlay: stats.playSeconds,
			coinValueDropped: 0,
			coinValuePicked: 0,
			reportedAt: -math.huge,
			tickedAt: os.clock(),
		});
		// The staff stays out of the analytics; the group rank check yields, the saved flag applies meanwhile
		task.spawn(() => {
			const staff = isAdmin(player);
			if (this.sessions.has(player)) stats.staff = staff;
		});
	}

	private countDay(stats: PlayerStats, now: number) {
		const day = math.floor(now / DAY);
		if (day === stats.lastDay) return;
		stats.lastDay = day;
		stats.days += 1;
	}

	private tick(player: Player, session: Session, clock: number) {
		const save = DataService.getSave(player);
		if (!save) return;
		const stats = save.stats;
		const elapsed = clock - session.tickedAt;
		session.tickedAt = clock;
		stats.playSeconds += elapsed;
		// The simulator's play time: in front of the tank while it produces (FishService's "not frozen")
		if (AquariumService.isTending(player) && isOnboardingDone(save.player.onboarding))
			stats.tendingSeconds += elapsed;
		this.countDay(stats, Workspace.GetServerTimeNow());
		this.checkMilestones(player, save, false);
	}

	/** Summed up into the Creator Dashboard: the session's length and the share of the coins picked up. */
	private endSession(player: Player) {
		const session = this.sessions.get(player);
		this.sessions.delete(player);
		const save = DataService.getSave(player);
		if (!session || !save) return;
		const stats = save.stats;
		const platform = session.platform ?? "Unknown";
		this.logCustom(player, "SessionMinutes", (stats.tendingSeconds - session.startTending) / 60, platform);
		this.logCustom(player, "SessionMinutesInGame", (stats.playSeconds - session.startPlay) / 60, platform);
		if (session.coinValueDropped > 0) {
			const share = math.min(session.coinValuePicked / session.coinValueDropped, 1) * 100;
			this.logCustom(player, "CoinPickupPercent", share, `Rebirth${save.player.rebirths}`);
		}
	}

	// ---------------------------------------------------------------------
	// Milestones
	// ---------------------------------------------------------------------

	/** Stamps every milestone reached and not stamped yet (`unknownTime`: reached before the stats existed). */
	private checkMilestones(player: Player, save: SaveData, unknownTime: boolean) {
		const data = save.player;
		const reached = new Array<string>();
		const step = ONBOARDING_STEPS.indexOf(data.onboarding);
		for (let i = 0; i <= step; i++) reached.push(`Onboarding:${ONBOARDING_STEPS[i]}`);
		for (let n = 1; n <= data.rebirths; n++) reached.push(`Rebirth${n}`);
		let species = 0;
		let speciesFound = 0;
		for (const [fishType] of pairs(FISH_TYPES)) {
			if (isEasterEgg(fishType)) continue;
			species += 1;
			if ((data.hatched[fishType as FishType] ?? 0) > 0) {
				speciesFound += 1;
				reached.push(`Species:${fishType}`);
			}
		}
		if (speciesFound >= species) reached.push("AllSpecies");
		for (const id of data.oceanRewardsClaimed) reached.push(`Ocean:${id}`);
		for (const id of reached) this.stamp(player, save.stats, id, unknownTime);

		// The first goals (after Onboarding:Done, stamped above): a player who was past them before they existed gets
		// them without a time, like a legacy save
		if (!isOnboardingDone(data.onboarding)) return;
		const goalsKnown = !unknownTime && this.sawFirstGoals(save.stats);
		for (const goal of FIRST_GOALS)
			if (isFirstGoalDone(data, goal)) this.stamp(player, save.stats, `Goal:${goal}`, !goalsKnown);
	}

	/** The player finished the tutorial once the "Next goal" card existed (FIRST_GOALS_SINCE). */
	private sawFirstGoals(stats: PlayerStats): boolean {
		const done = stats.milestones["Onboarding:Done"];
		return done !== undefined && done.at >= FIRST_GOALS_SINCE;
	}

	private stamp(player: Player, stats: PlayerStats, id: string, unknownTime: boolean) {
		if (stats.milestones[id] !== undefined) return;
		const time: MilestoneTime = {
			tending: unknownTime ? -1 : stats.tendingSeconds,
			play: unknownTime ? -1 : stats.playSeconds,
			days: unknownTime ? -1 : stats.days,
			at: Workspace.GetServerTimeNow(),
		};
		stats.milestones[id] = time;
		if (unknownTime) return;

		// Creator Dashboard: the funnels, and the average play time at each milestone
		const onboardingStep = ONBOARDING_STEPS.indexOf(id.sub(12) as never);
		if (id.sub(1, 11) === "Onboarding:" && onboardingStep >= 0 && !stats.legacy) {
			this.safely(player, () =>
				AnalyticsService.LogOnboardingFunnelStepEvent(
					player,
					onboardingStep + 1,
					ONBOARDING_STEPS[onboardingStep],
				),
			);
		}
		const funnelStep = PROGRESSION_FUNNEL.indexOf(id);
		if (funnelStep >= 0 && !stats.legacy) {
			this.safely(player, () =>
				AnalyticsService.LogFunnelStepEvent(player, "Progression", tostring(player.UserId), funnelStep + 1, id),
			);
		}
		const goalStep = FIRST_GOALS_FUNNEL.indexOf(id);
		if (goalStep >= 0 && !stats.legacy && this.sawFirstGoals(stats)) {
			this.safely(player, () =>
				AnalyticsService.LogFunnelStepEvent(player, "FirstGoals", tostring(player.UserId), goalStep + 1, id),
			);
		}
		this.logCustom(player, "MilestoneMinutes", time.tending / 60, id, tostring(math.min(time.days, 30)));
	}

	// ---------------------------------------------------------------------
	// Quests and client reports
	// ---------------------------------------------------------------------

	private onQuestClaimed(player: Player, questId: string, config: QuestConfig) {
		const stats = this.getStats(player);
		if (!stats) return;
		stats.questsClaimed[config.category] += 1;
		for (const reward of config.rewards)
			if (reward.kind === "CoinBoost") stats.boostMinutesEarned += reward.minutes;
		if (config.category === "Story") this.stamp(player, stats, `Quest:${questId}`, false);
		else {
			this.logCustom(player, `${config.category}QuestClaimed`, 1, questId);
		}
	}

	/** Once a minute from each client: its platform and performance (stats only, never trusted for the game). */
	private onClientReport(
		player: Player,
		report: { platform: Platform; fps: number; memoryMb: number },
	) {
		const stats = this.getStats(player);
		const session = this.sessions.get(player);
		if (!stats || !session) return;
		const now = os.clock();
		if (now - session.reportedAt < REPORT_MIN_GAP) return;
		session.reportedAt = now;
		if (session.platform === undefined)
			stats.platforms[report.platform] = (stats.platforms[report.platform] ?? 0) + 1;
		session.platform = report.platform;
		const fps = math.clamp(report.fps, 0, 240);
		const device = (stats.devices[report.platform] ??= {
			samples: 0,
			fpsSum: 0,
			lowFps: 0,
			memoryMaxMb: 0,
		});
		device.samples += 1;
		device.fpsSum += fps;
		if (fps < 30) device.lowFps += 1;
		device.memoryMaxMb = math.max(device.memoryMaxMb, math.clamp(report.memoryMb, 0, 100000));
	}

	// ---------------------------------------------------------------------
	// Creator Dashboard
	// ---------------------------------------------------------------------

	private logCustom(player: Player, eventName: string, value: number, field1?: string, field2?: string) {
		const fields: Partial<Record<Enum.AnalyticsCustomFieldKeys["Name"], string>> = {};
		if (field1 !== undefined) fields.CustomField01 = field1;
		if (field2 !== undefined) fields.CustomField02 = field2;
		this.safely(player, () => AnalyticsService.LogCustomEvent(player, eventName, value, fields as never));
	}

	/**
	 * Analytics never break the game (limits, Studio, an outage): a failed call is dropped. The owner's test runs
	 * ("/speed", "/passes off") and the staff's profiles send nothing: the Creator Dashboard can't forget an event.
	 */
	private safely(player: Player, log: () => void) {
		const stats = this.getStats(player);
		if (stats && (stats.testSpeedUsed || stats.testNoPasses || stats.staff)) return;
		const [ok, err] = pcall(log);
		if (!ok) warn(`[Server] StatsService: analytics call failed (${err})`);
	}
}

export const StatsService = new StatsServiceSingleton();
