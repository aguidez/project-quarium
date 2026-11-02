import { formatNumber, formatShort } from "shared/format";

/**
 * The lobby's leaderboards (LeaderboardService, LeaderboardController): global tops kept in OrderedDataStores, shown on
 * three signs on the east promenade. Ocean Points in the middle, the tank's income per second on its left, the time
 * played on its right.
 */
export type LeaderboardId = "OceanPoints" | "Income" | "PlayTime";
export const LEADERBOARD_IDS: readonly LeaderboardId[] = ["OceanPoints", "Income", "PlayTime"];

/** Players kept on a board (the signs show 10 rows and scroll to the last). */
export const LEADERBOARD_SIZE = 100;
export const LEADERBOARD_VISIBLE_ROWS = 10;

/** Attribute of a sign model (tag Leaderboard): the LeaderboardId it shows. */
export const LEADERBOARD_ATTRIBUTE = "Board";

export interface LeaderboardEntry {
	userId: number;
	/** Display name ("" while the server hasn't got it from Roblox yet). */
	name: string;
	value: number;
}

/** What a client gets (LeaderboardSync): every board, in order, and its own scores. */
export interface LeaderboardSync {
	boards: Record<LeaderboardId, LeaderboardEntry[]>;
	/** The player's own scores, even out of the top; absent for a profile kept off the boards (the owner's test speed). */
	own?: Record<LeaderboardId, number>;
}

/**
 * Leaderboard titles: once a day (midnight UTC, like the daily quests) the top LEADERBOARD_TITLE_RANKS of each board
 * are frozen (LeaderboardService's daily snapshot); each of them holds that board's title until the next snapshot
 * (PlayerData.leaderboardRanks). The title's nameplate (TitleService) shows the tier of the rank.
 */
export const LEADERBOARD_TITLE_RANKS = 10;
const DAY = 24 * 60 * 60;

/** The UTC day of a server time: a new snapshot of the titles each time it changes. */
export function getLeaderboardDay(time: number): number {
	return math.floor(time / DAY);
}

export type TitleTier = "Gold" | "Silver" | "Bronze" | "Common";

export function getTitleTier(rank: number): TitleTier {
	return rank === 1 ? "Gold" : rank === 2 ? "Silver" : rank === 3 ? "Bronze" : "Common";
}

/** Nameplate colours per tier (FigCraft leaderboards.figcraft, LeaderboardTitles_Mockup); bronze is copper, far from gold. */
export interface TitleTierStyle {
	faceTop: Color3;
	faceBottom: Color3;
	badgeTop: Color3;
	badgeBottom: Color3;
	/** The plate's bevel and its text outline. */
	shadow: Color3;
	/** Outline of the rank in the badge. */
	badgeShadow: Color3;
	gloss: number;
	sparkles: number;
}

export const TITLE_TIER_STYLES: Record<TitleTier, TitleTierStyle> = {
	Gold: {
		faceTop: Color3.fromHex("#FFF3A0"),
		faceBottom: Color3.fromHex("#FFD233"),
		badgeTop: Color3.fromHex("#FFF3A0"),
		badgeBottom: Color3.fromHex("#F0A500"),
		shadow: Color3.fromHex("#8F5A00"),
		badgeShadow: Color3.fromHex("#8F5A00"),
		gloss: 0.65,
		sparkles: 2,
	},
	Silver: {
		faceTop: Color3.fromHex("#FFFFFF"),
		faceBottom: Color3.fromHex("#C3CEDA"),
		badgeTop: Color3.fromHex("#FFFFFF"),
		badgeBottom: Color3.fromHex("#8C99A6"),
		shadow: Color3.fromHex("#46525E"),
		badgeShadow: Color3.fromHex("#46525E"),
		gloss: 0.65,
		sparkles: 1,
	},
	Bronze: {
		faceTop: Color3.fromHex("#F7B48A"),
		faceBottom: Color3.fromHex("#C0672F"),
		badgeTop: Color3.fromHex("#F7B48A"),
		badgeBottom: Color3.fromHex("#93461C"),
		shadow: Color3.fromHex("#4E220C"),
		badgeShadow: Color3.fromHex("#4E220C"),
		gloss: 0.65,
		sparkles: 0,
	},
	Common: {
		faceTop: Color3.fromHex("#2F5684"),
		faceBottom: Color3.fromHex("#1E3A5C"),
		badgeTop: Color3.fromHex("#8AF7F9"),
		badgeBottom: Color3.fromHex("#00939C"),
		shadow: Color3.fromHex("#08121D"),
		badgeShadow: Color3.fromHex("#005A61"),
		gloss: 0.88,
		sparkles: 0,
	},
};

/** Images of the nameplates, the same uploads as client/ui/theme.ts V2_IMAGES (the server can't import the client UI). */
export const TITLE_PLATE_IMAGES = {
	ocean: "rbxassetid://86767682222210",
	sparkle: "rbxassetid://84841007993115",
};

/** "212h 05m", "42m", "0m". */
export function formatPlayTime(seconds: number): string {
	const minutes = math.floor(seconds / 60);
	const hours = math.floor(minutes / 60);
	if (hours === 0) return `${minutes}m`;
	return `${formatNumber(hours)}h ${string.format("%02d", minutes % 60)}m`;
}

/** A score as the signs write it: "48,210" (Ocean Points), "$7.2M/s", "212h 05m". */
export function formatLeaderboardValue(board: LeaderboardId, value: number): string {
	if (board === "Income") return `$${formatShort(value)}/s`;
	if (board === "PlayTime") return formatPlayTime(value);
	return formatNumber(value);
}
