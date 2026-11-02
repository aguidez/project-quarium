import { Janitor } from "@rbxts/janitor";
import React from "@rbxts/react";
import { createRoot, Root } from "@rbxts/react-roblox";
import { CollectionService, Players } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { TAGS } from "shared/tags";
import { LEADERBOARD_ATTRIBUTE, LEADERBOARD_IDS, LeaderboardId, LeaderboardSync } from "shared/types/leaderboards";
import { LEADERBOARD_CANVAS, LeaderboardBoard } from "client/ui/LeaderboardBoard";

const BOARD_MAX_DISTANCE = 250; // studs: farther signs aren't drawn

interface SignView {
	board: LeaderboardId;
	root: Root;
	janitor: Janitor;
}

/**
 * The lobby's leaderboard signs (tag Leaderboard, built in Studio): draws each one's face as a local SurfaceGui (React
 * LeaderboardBoard) on its "Screen" part, from the server's LeaderboardSync. The SurfaceGui lives in PlayerGui with
 * the part as Adornee: only there does it take input, which the list needs to scroll.
 */
class LeaderboardControllerSingleton implements Lifecycle {
	private syncRemote = getRemoteEvent("LeaderboardSync");
	private sync?: LeaderboardSync;
	private views = new Map<Model, SignView>();

	public onInit() {
		this.syncRemote.OnClientEvent.Connect((sync: LeaderboardSync) => {
			this.sync = sync;
			for (const [, view] of this.views) this.render(view);
		});
	}

	public onStart() {
		print("[Client] LeaderboardController started.");
		CollectionService.GetInstanceAddedSignal(TAGS.Leaderboard).Connect((instance) => this.add(instance));
		CollectionService.GetInstanceRemovedSignal(TAGS.Leaderboard).Connect((instance) => this.remove(instance));
		for (const instance of CollectionService.GetTagged(TAGS.Leaderboard)) task.spawn(() => this.add(instance));
	}

	private add(instance: Instance) {
		if (!instance.IsA("Model") || this.views.has(instance)) return;
		const board = instance.GetAttribute(LEADERBOARD_ATTRIBUTE) as LeaderboardId | undefined;
		if (board === undefined || !LEADERBOARD_IDS.includes(board)) {
			warn(`[Client] LeaderboardController: ${instance.GetFullName()} has no valid "${LEADERBOARD_ATTRIBUTE}"`);
			return;
		}
		const screen = instance.WaitForChild("Screen", 5);
		if (!screen || !screen.IsA("BasePart") || !instance.Parent || this.views.has(instance)) return;

		const janitor = new Janitor();
		const gui = janitor.Add(new Instance("SurfaceGui"));
		gui.Name = `Leaderboard_${board}`;
		gui.Adornee = screen;
		gui.Face = Enum.NormalId.Front;
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
		gui.PixelsPerStud = LEADERBOARD_CANVAS.X / screen.Size.X;
		gui.LightInfluence = 0.15;
		gui.MaxDistance = BOARD_MAX_DISTANCE;
		gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		gui.ResetOnSpawn = false;
		gui.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");

		const root = createRoot(gui);
		janitor.Add(() => root.unmount(), true);
		const view: SignView = { board, root, janitor };
		this.views.set(instance, view);
		this.render(view);
	}

	private remove(instance: Instance) {
		if (!instance.IsA("Model")) return;
		this.views.get(instance)?.janitor.Destroy();
		this.views.delete(instance);
	}

	private render(view: SignView) {
		view.root.render(
			React.createElement(LeaderboardBoard, {
				board: view.board,
				entries: this.sync?.boards[view.board],
				own: this.sync?.own?.[view.board],
				localUserId: Players.LocalPlayer.UserId,
			}),
		);
	}
}

export const LeaderboardController = new LeaderboardControllerSingleton();
