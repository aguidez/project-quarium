import { Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { ADMIN_PANEL_ATTRIBUTE, AdminTankInfo } from "shared/types/admin";
import { GAME_EVENTS } from "shared/types/events";
import { FISH_TYPES } from "shared/types/fish";
import { GAME_PASSES, isGamePass } from "shared/types/gamepasses";
import { FISH_VARIANTS } from "shared/types/variants";
import { canUseAdminPanel } from "../admins";
import { DataService } from "./DataService";
import { EventService } from "./EventService";
import { FishService } from "./FishService";
import { GamePassService } from "./GamePassService";
import { LeaderboardService } from "./LeaderboardService";
import { ServerUpdateService } from "./ServerUpdateService";

const isEventType = t.keyOf(GAME_EVENTS);
const isRemoveFish = t.strictInterface({ userId: t.integer, fishId: t.integer });
const isAddFish = t.strictInterface({
	userId: t.integer,
	fishType: t.keyOf(FISH_TYPES),
	variant: t.keyOf(FISH_VARIANTS),
	size: t.optional(t.integer), // undefined: drawn like an egg's; clamped to the Size range (FishService)
});
const isLeaderboardBan = t.strictInterface({ userId: t.integer, banned: t.boolean });
const isSetPass = t.strictInterface({ userId: t.integer, pass: isGamePass, granted: t.boolean });

/**
 * The admin panel's server side (client: AdminPanel). Tells each player whether they may open it
 * (ADMIN_PANEL_ATTRIBUTE, from canUseAdminPanel) and runs its actions, checking that right again every time:
 * the attribute only shows or hides the button.
 *
 * Events tab: "AdminStartEvent" (payload: GameEventType) starts an admin event like "/event <name>",
 * "AdminStopEvent" ends the running event like "/event stop".
 * Aquariums tab (this server's players only): "AdminRequestTanks" answers with "AdminTanks"; "AdminRemoveFish"
 * ({ userId, fishId }) takes a fish out (no Ocean Points), "AdminAddFish" ({ userId, fishType, variant, size? }) drops
 * a new one (even into a full tank; size: its Size score, drawn when absent), "AdminSetLeaderboardBan" ({ userId, banned }) is the LB BAN checkbox (saved),
 * "AdminSetPass" ({ userId, pass, granted }) gives a gamepass for good or takes a given one back (saved:
 * SaveData.grantedPasses; a bought pass stays). Each action answers with the tanks again.
 * Servers tab: "AdminRequestServers" answers with "AdminServers"; "AdminUpdateOldServers" moves the players of every
 * server on an old place version to the newest one, "AdminCloseOldServers" closes those servers to newcomers (their
 * players stay until they leave) (ServerUpdateService).
 */
class AdminServiceSingleton implements Lifecycle {
	private tanksRemote = getRemoteEvent("AdminTanks");
	private serversRemote = getRemoteEvent("AdminServers");

	public onInit() {
		Players.PlayerAdded.Connect((player) => this.grant(player));
		for (const player of Players.GetPlayers()) this.grant(player);

		DataService.registerAction("AdminStartEvent", isEventType, (player, eventType) => {
			if (!this.allowed(player, "AdminStartEvent")) return;
			EventService.startAdminEvent(eventType);
			DataService.notify(player, `${GAME_EVENTS[eventType].displayName} started.`, "info");
		});
		DataService.registerAction("AdminStopEvent", t.nil, (player) => {
			if (!this.allowed(player, "AdminStopEvent")) return;
			if (EventService.stopRunningEvent()) DataService.notify(player, "Event stopped.", "info");
		});

		DataService.registerAction("AdminRequestServers", t.nil, (player) => {
			if (this.allowed(player, "AdminRequestServers")) this.serversRemote.FireClient(player, ServerUpdateService.getServers());
		});
		DataService.registerAction("AdminUpdateOldServers", t.nil, (player) => {
			if (!this.allowed(player, "AdminUpdateOldServers")) return;
			const moved = ServerUpdateService.updateOldServers();
			print(`[Server] Admin ${player.Name}: update to place version ${moved.latest}, ${moved.servers} old server(s).`);
			DataService.notify(
				player,
				moved.servers > 0
					? `${moved.servers} old server(s) are moving ${moved.players} player(s) to version ${moved.latest}.`
					: "Every server already runs the newest version.",
				"info",
			);
			this.serversRemote.FireClient(player, ServerUpdateService.getServers());
		});
		DataService.registerAction("AdminCloseOldServers", t.nil, (player) => {
			if (!this.allowed(player, "AdminCloseOldServers")) return;
			const closed = ServerUpdateService.closeOldServers();
			print(`[Server] Admin ${player.Name}: close the servers below place version ${closed.latest}, ${closed.servers} old server(s).`);
			DataService.notify(
				player,
				closed.servers > 0
					? `${closed.servers} old server(s) closed to newcomers: their ${closed.players} player(s) stay until they leave.`
					: "No old server left to close.",
				"info",
			);
			this.serversRemote.FireClient(player, ServerUpdateService.getServers());
		});
		DataService.registerAction("AdminRequestTanks", t.nil, (player) => {
			if (this.allowed(player, "AdminRequestTanks")) this.sendTanks(player);
		});
		DataService.registerAction("AdminRemoveFish", isRemoveFish, (player, { userId, fishId }) => {
			if (!this.allowed(player, "AdminRemoveFish")) return;
			const target = Players.GetPlayerByUserId(userId);
			if (target && FishService.adminRemoveFish(target, fishId))
				print(`[Server] Admin ${player.Name} removed fish ${fishId} from ${target.Name}'s tank.`);
			else DataService.notify(player, "That fish can't be removed now.", "warning");
			this.sendTanks(player);
		});
		DataService.registerAction("AdminAddFish", isAddFish, (player, { userId, fishType, variant, size }) => {
			if (!this.allowed(player, "AdminAddFish")) return;
			const target = Players.GetPlayerByUserId(userId);
			if (target && FishService.adminAddFish(target, fishType, variant, size)) {
				const sized = size !== undefined ? ` (size ${size})` : "";
				print(`[Server] Admin ${player.Name} added a ${variant} ${fishType}${sized} to ${target.Name}'s tank.`);
				DataService.notify(player, `${FISH_TYPES[fishType].displayName} added to ${target.DisplayName}'s aquarium.`, "info");
			} else DataService.notify(player, "That fish can't be added now.", "warning");
			this.sendTanks(player);
		});
		DataService.registerAction("AdminSetLeaderboardBan", isLeaderboardBan, (player, { userId, banned }) => {
			if (!this.allowed(player, "AdminSetLeaderboardBan")) return;
			const target = Players.GetPlayerByUserId(userId);
			if (target) {
				LeaderboardService.setBanned(target, banned);
				print(`[Server] Admin ${player.Name} ${banned ? "banned" : "unbanned"} ${target.Name} from the leaderboards.`);
			}
			this.sendTanks(player);
		});
		DataService.registerAction("AdminSetPass", isSetPass, (player, { userId, pass, granted }) => {
			if (!this.allowed(player, "AdminSetPass")) return;
			const target = Players.GetPlayerByUserId(userId);
			if (target && GamePassService.setGranted(target, pass, granted)) {
				print(`[Server] Admin ${player.Name} ${granted ? "gave" : "took back"} ${pass} ${granted ? "to" : "from"} ${target.Name}.`);
				DataService.notify(
					player,
					`${GAME_PASSES[pass].displayName} ${granted ? "given to" : "taken back from"} ${target.DisplayName}.`,
					"info",
				);
			}
			this.sendTanks(player);
		});
	}

	public onStart() {
		print("[Server] AdminService started.");
	}

	private grant(player: Player) {
		player.SetAttribute(ADMIN_PANEL_ATTRIBUTE, canUseAdminPanel(player));
	}

	private allowed(player: Player, action: string): boolean {
		if (canUseAdminPanel(player)) return true;
		warn(`[Server] ${player.Name} tried ${action}: refused (no admin panel).`);
		return false;
	}

	/** This server's players whose data is loaded, with their tanks, to the admin who asked. */
	private sendTanks(admin: Player) {
		const tanks = new Array<AdminTankInfo>();
		for (const player of Players.GetPlayers()) {
			const save = DataService.getSave(player);
			if (!save) continue;
			const data = save.player;
			tanks.push({
				userId: player.UserId,
				name: player.DisplayName,
				rebirths: data.rebirths,
				capacity: data.capacity,
				income: FishService.getSteadyIncomePerSecond(player),
				leaderboardBanned: save.leaderboardBanned,
				testProfile: save.stats.testSpeedUsed,
				fish: FishService.getFishList(player),
				passes: [...data.passes],
				grantedPasses: [...save.grantedPasses],
			});
		}
		this.tanksRemote.FireClient(admin, tanks);
	}
}

export const AdminService = new AdminServiceSingleton();
