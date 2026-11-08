import { DataStoreService, Players, UserService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { COSMETICS, LEADERBOARD_TITLES } from "shared/types/cosmetics";
import {
	getLeaderboardDay,
	LEADERBOARD_IDS,
	LEADERBOARD_SIZE,
	LEADERBOARD_TITLE_RANKS,
	LeaderboardEntry,
	LeaderboardId,
	LeaderboardSync,
} from "shared/types/leaderboards";
import { SaveData } from "../saveData";
import { DataService } from "./DataService";
import { FishService } from "./FishService";

/**
 * One OrderedDataStore per board: key = the UserId as text, value = the score encoded by encodeScore (an OrderedDataStore
 * only holds 64-bit integers, ~9.2e18, and incremental incomes go far past it).
 */
const STORE_NAMES: Record<LeaderboardId, string> = {
	OceanPoints: "Leaderboard_OceanPoints_v1",
	Income: "Leaderboard_Income_v1",
	PlayTime: "Leaderboard_PlayTime_v1",
};
const TICK = 5; // seconds between two checks of the loop below
const READ_INTERVAL = 120; // seconds between two reads of the global tops (3 GetSortedAsync)
const WRITE_INTERVAL = 120; // seconds between two writes of a player's scores (only the changed ones)
const PUSH_INTERVAL = 30; // seconds between two sends of the boards to the clients
/** After joining, the tank first respawns its fish: until then its income reads 0, so the player isn't counted yet. */
const SETTLE_DELAY = 30;
const NAME_BATCH = 100; // UserIds per GetUserInfosByUserIdsAsync call
/** The titles' daily snapshot: one key, written once a UTC day by the first server that sees the new day. */
const TITLES_STORE_NAME = "LeaderboardTitles_v1";
const TITLES_KEY = "Daily";
const TITLES_CHECK_INTERVAL = 60; // seconds between two checks of the day (a DataStore read only while it has none for today)
/** How the notices name each board. */
const BOARD_NAMES: Record<LeaderboardId, string> = {
	OceanPoints: "Ocean Points",
	Income: "income",
	PlayTime: "time",
};

/** The top LEADERBOARD_TITLE_RANKS of each board on a UTC day (UserIds, best first): who holds the titles that day. */
interface TitleSnapshot {
	day: number;
	ranks: Record<LeaderboardId, number[]>;
}

function toSnapshot(value: unknown): TitleSnapshot | undefined {
	if (!typeIs(value, "table")) return undefined;
	const raw = value as { day?: unknown; ranks?: unknown };
	if (!typeIs(raw.day, "number") || !typeIs(raw.ranks, "table")) return undefined;
	const ranks = { OceanPoints: [], Income: [], PlayTime: [] } as Record<LeaderboardId, number[]>;
	for (const board of LEADERBOARD_IDS) {
		const ids = (raw.ranks as Record<string, unknown>)[board];
		if (!typeIs(ids, "table")) continue;
		for (const id of ids as unknown[]) if (typeIs(id, "number")) ranks[board].push(id);
	}
	return { day: raw.day, ranks };
}

/**
 * Scores below RAW_SCORE_LIMIT are stored as they are (every score written before V1.1.15 is one of them); above it,
 * RAW_SCORE_LIMIT + (log10(score) - 15) x LOG_SCORE_SCALE. The order is kept, the encoded value stays below 2^53 up to
 * the doubles' limit (1e308 → ~1.29e15), and a decoded score is off by ~2e-12 of itself: invisible on the signs.
 */
const RAW_SCORE_LIMIT = 1e15;
const LOG_SCORE_SCALE = 1e12;

function encodeScore(score: number): number {
	if (!(score > 0)) return 0; // also NaN
	if (score < RAW_SCORE_LIMIT) return math.floor(score);
	const logScore = math.log10(math.min(score, 1.7976931348623157e308)) - 15;
	return RAW_SCORE_LIMIT + math.max(math.floor(logScore * LOG_SCORE_SCALE), 0);
}

function decodeScore(stored: number): number {
	if (stored < RAW_SCORE_LIMIT) return stored;
	return 10 ** (15 + (stored - RAW_SCORE_LIMIT) / LOG_SCORE_SCALE);
}

type Scores = Record<LeaderboardId, number>;

interface Session {
	joinedAt: number;
	writtenAt: number;
	/** Last values written to the stores, encoded (unchanged ones aren't written again). */
	written: Partial<Scores>;
	/** Last scores sampled: on every push, write and save (the final save samples them before the tank is emptied). */
	scores?: Scores;
	/** The profile is kept off the boards and its entries were removed from the stores. */
	removed: boolean;
}

/**
 * The lobby's leaderboards: Ocean Points, the tank's steady income per second (FishService.getSteadyIncomePerSecond)
 * and the time played (PlayerStats.playSeconds). Each is a global OrderedDataStore: every server writes the scores of
 * its players (every 2 min and when they leave) and reads the top 100 (every 2 min); its own players' live scores are
 * merged in before the boards are sent to the clients (LeaderboardSync, every 30 s and at join), with display names
 * from UserService. A banned profile (SaveData.leaderboardBanned) or one that ever used the owner's test speed
 * (PlayerStats.testSpeedUsed) is kept off the boards.
 * Every DataStore call is in a pcall: without access (Studio settings, an outage) the boards only show this server.
 */
class LeaderboardServiceSingleton implements Lifecycle {
	private remote = getRemoteEvent("LeaderboardSync");
	private stores = new Map<LeaderboardId, OrderedDataStore>();
	/** The global tops as last read, before this server's live scores are merged in. */
	private tops: Record<LeaderboardId, LeaderboardEntry[]> = { OceanPoints: [], Income: [], PlayTime: [] };
	/** What the clients get (tops + live scores, names filled in). */
	private boards: Record<LeaderboardId, LeaderboardEntry[]> = { OceanPoints: [], Income: [], PlayTime: [] };
	private names = new Map<number, string>();
	private sessions = new Map<Player, Session>();
	private warned = false;
	private titlesStore?: DataStore;
	/** Today's titles, once read or taken. */
	private titles?: TitleSnapshot;

	public onInit() {
		DataService.onLoaded((player) => this.startSession(player));
		DataService.onSave((player, save) => {
			const session = this.sessions.get(player);
			if (session) session.scores = this.getScores(player, save);
		});
		// Connected after DataService's: the final save (and its onSave sample above) already ran
		Players.PlayerRemoving.Connect((player) => this.endSession(player));
	}

	public onStart() {
		print("[Server] LeaderboardService started.");
		for (const board of LEADERBOARD_IDS) {
			const [ok, store] = pcall(() => DataStoreService.GetOrderedDataStore(STORE_NAMES[board]));
			if (ok) this.stores.set(board, store);
			else this.warnOnce(`no store for ${board}: ${store}`);
		}
		const [ok, titlesStore] = pcall(() => DataStoreService.GetDataStore(TITLES_STORE_NAME));
		if (ok) this.titlesStore = titlesStore;

		let readAt = -math.huge;
		let pushAt = -math.huge;
		let titlesAt = -math.huge;
		while (true) {
			if (os.clock() - titlesAt >= TITLES_CHECK_INTERVAL) {
				titlesAt = os.clock();
				this.refreshTitles();
			}
			if (os.clock() - readAt >= READ_INTERVAL) {
				readAt = os.clock();
				this.readTops();
			}
			this.writeDue();
			if (os.clock() - pushAt >= PUSH_INTERVAL) {
				pushAt = os.clock();
				this.push();
			}
			task.wait(TICK);
		}
	}

	// ---------------------------------------------------------------------
	// Players
	// ---------------------------------------------------------------------

	private startSession(player: Player) {
		const clock = os.clock();
		this.sessions.set(player, { joinedAt: clock, writtenAt: clock, written: {}, removed: false });
		this.names.set(player.UserId, player.DisplayName);
		this.applyTitles(player);
		this.send(player);
	}

	private endSession(player: Player) {
		const session = this.sessions.get(player);
		this.sessions.delete(player);
		if (!session?.scores || !this.isSettled(session) || this.isExcluded(player, session)) return;
		task.spawn(() => this.write(player.UserId, session.scores!, session.written));
	}

	private isSettled(session: Session): boolean {
		return os.clock() - session.joinedAt >= SETTLE_DELAY;
	}

	/**
	 * The admin panel's LB BAN (SaveData.leaderboardBanned, saved): banned, the player's entries leave the stores and
	 * the boards at once (and their titles at the next day's snapshot); unbanned, their scores are written again at the
	 * next write (a test profile stays off anyway). The boards are sent again right away.
	 */
	public setBanned(player: Player, banned: boolean) {
		const save = DataService.getSave(player);
		const session = this.sessions.get(player);
		if (!save || save.leaderboardBanned === banned) return;
		save.leaderboardBanned = banned;
		if (session && !banned && !save.stats.testSpeedUsed) {
			session.removed = false;
			session.written = {};
			session.writtenAt = -math.huge;
		}
		if (session) this.isExcluded(player, session);
		this.push();
	}

	/** Banned profiles and the owner's test ones stay off the boards; their entries are removed from the stores once. */
	private isExcluded(player: Player, session: Session): boolean {
		if (session.removed) return true;
		const save = DataService.getSave(player);
		if (!save || (!save.leaderboardBanned && !save.stats.testSpeedUsed)) return false;
		session.removed = true;
		task.spawn(() => this.remove(player.UserId));
		return true;
	}

	private getScores(player: Player, save: SaveData): Scores {
		return {
			OceanPoints: math.floor(save.player.oceanPoints),
			Income: FishService.getSteadyIncomePerSecond(player),
			PlayTime: math.floor(save.stats.playSeconds),
		};
	}

	/** Samples the player's scores now (undefined until the profile is loaded). */
	private sample(player: Player, session: Session): Scores | undefined {
		const save = DataService.getSave(player);
		if (save) session.scores = this.getScores(player, save);
		return session.scores;
	}

	// ---------------------------------------------------------------------
	// DataStores
	// ---------------------------------------------------------------------

	private writeDue() {
		const clock = os.clock();
		for (const [player, session] of this.sessions) {
			if (!this.isSettled(session) || clock - session.writtenAt < WRITE_INTERVAL) continue;
			if (this.isExcluded(player, session)) continue;
			session.writtenAt = clock;
			const scores = this.sample(player, session);
			if (scores) this.write(player.UserId, scores, session.written);
		}
	}

	private write(userId: number, scores: Scores, written: Partial<Scores>) {
		// A Studio test store's profiles are not the players' (V1.1.24: a test profile reached the boards)
		if (!DataService.isLiveStore()) return;
		for (const board of LEADERBOARD_IDS) {
			const store = this.stores.get(board);
			const value = encodeScore(scores[board]);
			if (!store || written[board] === value) continue;
			const [ok, err] = pcall(() => store.SetAsync(tostring(userId), value));
			if (ok) written[board] = value;
			else this.warnOnce(`write of ${board} failed: ${err}`);
		}
	}

	private remove(userId: number) {
		if (!DataService.isLiveStore()) return; // a test profile's exclusion must not remove the real entries
		for (const [board, store] of this.stores) {
			const [ok, err] = pcall(() => store.RemoveAsync(tostring(userId)));
			if (!ok) this.warnOnce(`removal from ${board} failed: ${err}`);
		}
	}

	private readTops() {
		for (const board of LEADERBOARD_IDS) {
			const store = this.stores.get(board);
			if (!store) continue;
			const [ok, page] = pcall(() => store.GetSortedAsync(false, LEADERBOARD_SIZE).GetCurrentPage());
			if (!ok) {
				this.warnOnce(`read of ${board} failed: ${page}`);
				continue;
			}
			const entries = new Array<LeaderboardEntry>();
			for (const item of page as ReadonlyArray<{ key: string; value?: unknown }>) {
				const userId = tonumber(item.key);
				const value = item.value;
				if (userId !== undefined && typeIs(value, "number") && value > 0)
					entries.push({ userId, name: "", value: decodeScore(value) });
			}
			this.tops[board] = entries;
		}
		this.fetchNames();
	}

	/** Display names of the players on the tops this server doesn't know yet (kept for the server's life). */
	private fetchNames() {
		const unknown = new Array<number>();
		const seen = new Set<number>();
		for (const board of LEADERBOARD_IDS) {
			for (const entry of this.tops[board]) {
				if (this.names.has(entry.userId) || seen.has(entry.userId)) continue;
				seen.add(entry.userId);
				unknown.push(entry.userId);
			}
		}
		for (let start = 0; start < unknown.size(); start += NAME_BATCH) {
			const batch = new Array<number>();
			for (let i = start; i < math.min(start + NAME_BATCH, unknown.size()); i++) batch.push(unknown[i]);
			const [ok, infos] = pcall(() => UserService.GetUserInfosByUserIdsAsync(batch));
			if (!ok) {
				this.warnOnce(`names failed: ${infos}`);
				return;
			}
			for (const info of infos) this.names.set(info.Id, info.DisplayName);
		}
	}

	// ---------------------------------------------------------------------
	// Titles (the day's top 10 of each board)
	// ---------------------------------------------------------------------

	/** Reads today's snapshot, or takes it if this server is the first to see the new day; then hands the titles out. */
	private refreshTitles() {
		const store = this.titlesStore;
		const today = getLeaderboardDay(Workspace.GetServerTimeNow());
		if (!store || this.titles?.day === today) return;
		const [ok, stored] = pcall(() => store.GetAsync(TITLES_KEY)[0]);
		if (!ok) {
			this.warnOnce(`titles read failed: ${stored}`);
			return;
		}
		let snapshot = toSnapshot(stored);
		if (!snapshot || snapshot.day < today) {
			const fresh = this.takeSnapshot(today);
			if (!fresh) return; // a board couldn't be read: never hand out a partial day, try again at the next check
			let winner = fresh;
			// Several servers may see the new day at once: the first write wins, the others keep it
			const [written, err] = pcall(() =>
				store.UpdateAsync(TITLES_KEY, (old: unknown) => {
					const previous = toSnapshot(old);
					winner = previous && previous.day >= today ? previous : fresh;
					return $tuple(winner);
				}),
			);
			if (!written) {
				this.warnOnce(`titles write failed: ${err}`);
				return;
			}
			snapshot = winner;
		}
		this.titles = snapshot;
		for (const [player] of this.sessions) this.applyTitles(player);
	}

	private takeSnapshot(day: number): TitleSnapshot | undefined {
		const ranks = { OceanPoints: [], Income: [], PlayTime: [] } as Record<LeaderboardId, number[]>;
		for (const board of LEADERBOARD_IDS) {
			const store = this.stores.get(board);
			if (!store) return undefined;
			const [ok, page] = pcall(() => store.GetSortedAsync(false, LEADERBOARD_TITLE_RANKS).GetCurrentPage());
			if (!ok) {
				this.warnOnce(`titles snapshot of ${board} failed: ${page}`);
				return undefined;
			}
			for (const item of page as ReadonlyArray<{ key: string; value?: unknown }>) {
				const userId = tonumber(item.key);
				if (userId !== undefined && typeIs(item.value, "number") && item.value > 0) ranks[board].push(userId);
			}
		}
		return { day, ranks };
	}

	/**
	 * The player's ranks in today's snapshot become their leaderboard titles (PlayerData.leaderboardRanks), with a notice
	 * for each title gained or lost. Without a snapshot yet, ranks of an older day are cleared.
	 */
	private applyTitles(player: Player) {
		const data = DataService.getData(player);
		const session = this.sessions.get(player);
		if (!data || !session) return;
		const snapshot = this.titles;
		const day = snapshot?.day ?? getLeaderboardDay(Workspace.GetServerTimeNow());
		if (!snapshot && data.leaderboardRanksDay === day) return; // today's, from an earlier session
		const ranks: Partial<Record<LeaderboardId, number>> = {};
		if (snapshot && !this.isExcluded(player, session)) {
			for (const board of LEADERBOARD_IDS) {
				const index = snapshot.ranks[board].indexOf(player.UserId);
				if (index >= 0) ranks[board] = index + 1;
			}
		}
		const old = data.leaderboardRanks;
		const changed = LEADERBOARD_IDS.some((board) => old[board] !== ranks[board]);
		if (!changed && data.leaderboardRanksDay === day) return;
		data.leaderboardRanks = ranks;
		data.leaderboardRanksDay = day;
		DataService.sync(player);
		for (const board of LEADERBOARD_IDS) {
			const name = COSMETICS[LEADERBOARD_TITLES[board]].displayName.upper();
			const rank = ranks[board];
			if (rank !== undefined && rank !== old[board]) {
				DataService.notify(
					player,
					`Title ${name}: #${rank} on the ${BOARD_NAMES[board]} leaderboard today!`,
					"info",
				);
			} else if (rank === undefined && old[board] !== undefined) {
				DataService.notify(player, `Title ${name} lost: you left the top 10. Climb back up!`, "info");
			}
		}
	}

	private warnOnce(message: string) {
		if (this.warned) return;
		this.warned = true;
		warn(`[Server] LeaderboardService: ${message} (the boards show this server's players only)`);
	}

	// ---------------------------------------------------------------------
	// Clients
	// ---------------------------------------------------------------------

	/** The tops with this server's live scores merged in, then sent to every player. */
	private push() {
		// Live players replace their stored entry once settled (a player who just joined keeps the stored one), and
		// excluded ones never show
		const live = new Map<number, Scores>();
		const hidden = new Set<number>();
		for (const [player, session] of this.sessions) {
			if (this.isExcluded(player, session)) {
				hidden.add(player.UserId);
				continue;
			}
			const scores = this.sample(player, session);
			if (scores && this.isSettled(session)) live.set(player.UserId, scores);
		}

		for (const board of LEADERBOARD_IDS) {
			const entries = new Array<LeaderboardEntry>();
			for (const entry of this.tops[board]) {
				if (!live.has(entry.userId) && !hidden.has(entry.userId)) entries.push(entry);
			}
			for (const [userId, scores] of live) {
				if (scores[board] > 0) entries.push({ userId, name: "", value: scores[board] });
			}
			entries.sort((a, b) => (a.value !== b.value ? a.value > b.value : a.userId < b.userId));
			const top = new Array<LeaderboardEntry>();
			for (let i = 0; i < math.min(entries.size(), LEADERBOARD_SIZE); i++) {
				const entry = entries[i];
				top.push({ userId: entry.userId, name: this.names.get(entry.userId) ?? "", value: entry.value });
			}
			this.boards[board] = top;
		}
		for (const [player] of this.sessions) this.send(player);
	}

	private send(player: Player) {
		const session = this.sessions.get(player);
		if (!session) return;
		const sync: LeaderboardSync = {
			boards: this.boards,
			own: this.isExcluded(player, session) ? undefined : this.sample(player, session),
		};
		this.remote.FireClient(player, sync);
	}
}

export const LeaderboardService = new LeaderboardServiceSingleton();
