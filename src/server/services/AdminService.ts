import { Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { ADMIN_PANEL_ATTRIBUTE, AdminTankInfo } from "shared/types/admin";
import { GAME_EVENTS } from "shared/types/events";
import { FISH_TYPES } from "shared/types/fish";
import { FISH_VARIANTS } from "shared/types/variants";
import { canUseAdminPanel } from "../admins";
import { DataService } from "./DataService";
import { EventService } from "./EventService";
import { FishService } from "./FishService";
import { LeaderboardService } from "./LeaderboardService";

const isEventType = t.keyOf(GAME_EVENTS);
const isRemoveFish = t.strictInterface({ userId: t.integer, fishId: t.integer });
const isAddFish = t.strictInterface({ userId: t.integer, fishType: t.keyOf(FISH_TYPES), variant: t.keyOf(FISH_VARIANTS) });
const isLeaderboardBan = t.strictInterface({ userId: t.integer, banned: t.boolean });

/**
 * The admin panel's server side (client: AdminPanel). Tells each player whether they may open it
 * (ADMIN_PANEL_ATTRIBUTE, from canUseAdminPanel) and runs its actions, checking that right again every time:
 * the attribute only shows or hides the button.
 *
 * Events tab: "AdminStartEvent" (payload: GameEventType) starts an admin event like "/event <name>",
 * "AdminStopEvent" ends the running event like "/event stop".
 * Aquariums tab (this server's players only): "AdminRequestTanks" answers with "AdminTanks"; "AdminRemoveFish"
 * ({ userId, fishId }) takes a fish out (no Ocean Points), "AdminAddFish" ({ userId, fishType, variant }) drops a new
 * one (even into a full tank), "AdminSetLeaderboardBan" ({ userId, banned }) is the LB BAN checkbox (saved). Each
 * action answers with the tanks again.
 */
class AdminServiceSingleton implements Lifecycle {
	private tanksRemote = getRemoteEvent("AdminTanks");

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
		DataService.registerAction("AdminAddFish", isAddFish, (player, { userId, fishType, variant }) => {
			if (!this.allowed(player, "AdminAddFish")) return;
			const target = Players.GetPlayerByUserId(userId);
			if (target && FishService.adminAddFish(target, fishType, variant)) {
				print(`[Server] Admin ${player.Name} added a ${variant} ${fishType} to ${target.Name}'s tank.`);
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
			});
		}
		this.tanksRemote.FireClient(admin, tanks);
	}
}

export const AdminService = new AdminServiceSingleton();
