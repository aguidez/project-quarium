import { Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { ADMIN_PANEL_ATTRIBUTE } from "shared/types/admin";
import { GAME_EVENTS } from "shared/types/events";
import { canUseAdminPanel } from "../admins";
import { DataService } from "./DataService";
import { EventService } from "./EventService";

const isEventType = t.keyOf(GAME_EVENTS);

/**
 * The admin panel's server side (client: AdminPanel). Tells each player whether they may open it
 * (ADMIN_PANEL_ATTRIBUTE, from canUseAdminPanel) and runs its actions, checking that right again every time:
 * the attribute only shows or hides the button.
 *
 * Events tab: "AdminStartEvent" (payload: GameEventType) starts an admin event like "/event <name>",
 * "AdminStopEvent" ends the running event like "/event stop".
 */
class AdminServiceSingleton implements Lifecycle {
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
}

export const AdminService = new AdminServiceSingleton();
