import { GuiService, Players, RunService, Stats, UserInputService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";

const REPORT_INTERVAL = 60; // seconds (the server ignores closer reports)

/**
 * Sends the server, once a minute, what only the client knows: its kind of device, its frame rate and memory over the
 * last minute, and the swim animation budget it settled on (FishAnimationController). Statistics for the balance and
 * the mobile check (StatsService, ROADMAP M7); nothing of the game depends on them.
 */
class StatsReportControllerSingleton implements Lifecycle {
	private actionRemote = getRemoteEvent("RequestAction");

	public onInit() {}

	public onStart() {
		print("[Client] StatsReportController started.");
		let frames = 0;
		let seconds = 0;
		RunService.RenderStepped.Connect((dt) => {
			frames += 1;
			seconds += dt;
		});
		while (true) {
			task.wait(REPORT_INTERVAL);
			const fps = seconds > 0 ? frames / seconds : 0;
			frames = 0;
			seconds = 0;
			const budget = Players.LocalPlayer.GetAttribute("SwimTriangleBudget");
			this.actionRemote.FireServer("ReportClientStats", {
				platform: this.getPlatform(),
				fps,
				memoryMb: Stats.GetTotalMemoryUsageMb(),
				swimBudget: typeIs(budget, "number") ? budget : 0,
			});
		}
	}

	private getPlatform(): string {
		if (GuiService.IsTenFootInterface() || UserInputService.GetLastInputType() === Enum.UserInputType.Gamepad1)
			return "Gamepad";
		if (UserInputService.VREnabled) return "VR";
		if (UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled) return "Touch";
		return "Keyboard";
	}
}

export const StatsReportController = new StatsReportControllerSingleton();
