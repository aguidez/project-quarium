import { FishType } from "./fish";
import { FishVariant } from "./variants";

/**
 * The admin panel (client: AdminPanel, server: AdminService), the home of every administration tool. Who may use it
 * is decided by the server (server/admins.ts canUseAdminPanel) and told to the client by a player attribute; every
 * action is checked again on the server.
 */

/** Player attribute: true when the server lets this player open the admin panel. */
export const ADMIN_PANEL_ATTRIBUTE = "AdminPanel";

/** A tab of the panel: one per kind of tool. */
export type AdminTab = "Events" | "Aquariums" | "Servers";

/** The panel's tabs, in display order. */
export const ADMIN_TABS: { tab: AdminTab; label: string }[] = [
	{ tab: "Events", label: "Events" },
	{ tab: "Aquariums", label: "Aquariums" },
	{ tab: "Servers", label: "Servers" },
];

/** One fish of a player's tank, as the Aquariums tab lists it (`id`: FishService's, to remove that very fish). */
export interface AdminTankFish {
	id: number;
	fishType: FishType;
	variant: FishVariant;
}

/** A player of this server as the Aquariums tab shows them (the "AdminTanks" remote). */
export interface AdminTankInfo {
	userId: number;
	name: string;
	rebirths: number;
	capacity: number;
	/** The income leaderboard's figure (FishService.getSteadyIncomePerSecond). */
	income: number;
	/** SaveData.leaderboardBanned: kept off the three leaderboards (the LB BAN checkbox). */
	leaderboardBanned: boolean;
	/** Off the leaderboards anyway: the profile used the owner's test speed (PlayerStats.testSpeedUsed). */
	testProfile: boolean;
	fish: AdminTankFish[];
}

/** A live server as the Servers tab lists it (ServerUpdateService's registry). */
export interface AdminServerInfo {
	jobId: string;
	/** game.PlaceVersion: the published version it runs (a newer publish starts newer servers). */
	version: number;
	/** Its GAME_VERSION (the patch shown in the corner of the screen). */
	gameVersion: string;
	players: number;
	thisServer: boolean;
}

/** The Servers tab's data (the "AdminServers" remote). */
export interface AdminServersSync {
	/** Newest version first. */
	servers: AdminServerInfo[];
	/** The newest place version listed: the servers below it are the old ones. */
	latest: number;
	/** False when the registry couldn't be read (only this server is listed then). */
	listed: boolean;
	/** Studio: no teleport, the move only says so. */
	studio: boolean;
}

/** Seconds between two refreshes of the Aquariums tab while it is open (it asks; the server also answers each action). */
export const ADMIN_TANKS_REFRESH = 3;
