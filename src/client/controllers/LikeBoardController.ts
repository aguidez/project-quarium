import { Janitor } from "@rbxts/janitor";
import React from "@rbxts/react";
import { createRoot } from "@rbxts/react-roblox";
import { CollectionService, Players, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { TAGS } from "shared/tags";
import { formatCountdown, getNextLikeAt, LIKE_PROMPT_RANGE } from "shared/types/likes";
import { PlayerData } from "shared/types/playerData";
import { BOARD_CANVAS_WIDTH, LikeBoard } from "client/ui/LikeBoard";

const PROMPT_UPDATE_INTERVAL = 1; // seconds between two refreshes of the prompts' texts (cooldown)
const BOARD_MAX_DISTANCE = 90; // studs: farther boards aren't drawn

interface BoardView {
	model: Model;
	aquarium: Model;
	prompt: ProximityPrompt;
	janitor: Janitor;
}

/**
 * Like boards (LikeService places one beside each aquarium): draws each board's face as a local
 * SurfaceGui (React LikeBoard, from the aquarium's "Likes" / "LikeBoostEndsAt" attributes) and adds
 * a local "Like" ProximityPrompt on the boards of other players' aquariums, which sends a
 * "GiveLike" intent. The server checks the range, the owner and the cooldown.
 */
class LikeBoardControllerSingleton implements Lifecycle {
	private syncRemote = getRemoteEvent("SyncPlayerData");
	private actionRemote = getRemoteEvent("RequestAction");
	private data?: PlayerData;
	private views = new Map<Model, BoardView>();
	/** Boost of the local player's own aquarium (server time; 0 = none): not in PlayerData, it isn't saved. */
	private ownBoostEndsAt = 0;
	private ownBoostListeners = new Array<() => void>();

	public getOwnBoostEndsAt(): number {
		return this.ownBoostEndsAt;
	}

	/** Called when the local player's own boost starts, restarts or is gone. */
	public onOwnBoostChanged(listener: () => void) {
		this.ownBoostListeners.push(listener);
	}

	public onInit() {
		this.syncRemote.OnClientEvent.Connect((data: PlayerData) => {
			this.data = data;
			for (const [, view] of this.views) this.updatePrompt(view);
		});
	}

	public onStart() {
		print("[Client] LikeBoardController started.");

		// Boards stream in and out with the rest of the world
		CollectionService.GetInstanceAddedSignal(TAGS.LikeBoard).Connect((instance) => this.add(instance));
		CollectionService.GetInstanceRemovedSignal(TAGS.LikeBoard).Connect((instance) => this.remove(instance));
		for (const instance of CollectionService.GetTagged(TAGS.LikeBoard)) this.add(instance);

		while (true) {
			for (const [, view] of this.views) this.updatePrompt(view);
			task.wait(PROMPT_UPDATE_INTERVAL);
		}
	}

	private add(instance: Instance) {
		if (!instance.IsA("Model") || this.views.has(instance)) return;
		const aquarium = instance.Parent;
		const board = instance.WaitForChild("Board", 5);
		if (!aquarium || !aquarium.IsA("Model") || !board || !board.IsA("BasePart") || !instance.Parent) return;

		const janitor = new Janitor();
		const gui = janitor.Add(new Instance("SurfaceGui"));
		gui.Name = "LikeBoard";
		gui.Adornee = board;
		gui.Face = Enum.NormalId.Front;
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
		gui.PixelsPerStud = BOARD_CANVAS_WIDTH / board.Size.X;
		gui.LightInfluence = 0.3;
		gui.MaxDistance = BOARD_MAX_DISTANCE;
		gui.ResetOnSpawn = false;
		gui.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");

		const root = createRoot(gui);
		janitor.Add(() => root.unmount(), true);
		const render = () => {
			const likes = aquarium.GetAttribute("Likes");
			const boostEndsAt = aquarium.GetAttribute("LikeBoostEndsAt");
			root.render(
				React.createElement(LikeBoard, {
					likes: typeIs(likes, "number") ? likes : undefined,
					boostEndsAt: typeIs(boostEndsAt, "number") ? boostEndsAt : undefined,
				}),
			);
			if (aquarium.GetAttribute("OwnerUserId") === Players.LocalPlayer.UserId) {
				this.setOwnBoost(typeIs(boostEndsAt, "number") ? boostEndsAt : 0);
			}
		};
		janitor.Add(aquarium.GetAttributeChangedSignal("Likes").Connect(render));
		janitor.Add(aquarium.GetAttributeChangedSignal("LikeBoostEndsAt").Connect(render));
		janitor.Add(aquarium.GetAttributeChangedSignal("OwnerUserId").Connect(render));
		render();

		const prompt = janitor.Add(new Instance("ProximityPrompt"));
		prompt.Name = "LikePrompt";
		prompt.ActionText = "Like";
		prompt.KeyboardKeyCode = Enum.KeyCode.E;
		prompt.HoldDuration = 0;
		prompt.MaxActivationDistance = LIKE_PROMPT_RANGE;
		prompt.RequiresLineOfSight = false;
		prompt.Parent = board;
		janitor.Add(
			prompt.Triggered.Connect(() => {
				const plot = instance.GetAttribute("PlotIndex");
				if (typeIs(plot, "number")) this.actionRemote.FireServer("GiveLike", plot);
			}),
		);

		const view: BoardView = { model: instance, aquarium, prompt, janitor };
		this.views.set(instance, view);
		janitor.Add(aquarium.GetAttributeChangedSignal("OwnerUserId").Connect(() => this.updatePrompt(view)));
		this.updatePrompt(view);
	}

	private setOwnBoost(endsAt: number) {
		if (endsAt === this.ownBoostEndsAt) return;
		this.ownBoostEndsAt = endsAt;
		for (const listener of this.ownBoostListeners) listener();
	}

	private remove(instance: Instance) {
		if (!instance.IsA("Model")) return;
		this.views.get(instance)?.janitor.Destroy();
		this.views.delete(instance);
	}

	/** Only on other players' aquariums; says whose it is, or how long until the next like. */
	private updatePrompt(view: BoardView) {
		const ownerId = view.aquarium.GetAttribute("OwnerUserId");
		const owner = typeIs(ownerId, "number") ? Players.GetPlayerByUserId(ownerId) : undefined;
		view.prompt.Enabled = owner !== undefined && owner !== Players.LocalPlayer;
		if (!owner) return;

		const nextLikeAt = this.data ? getNextLikeAt(this.data) : 0;
		const wait = nextLikeAt - Workspace.GetServerTimeNow();
		view.prompt.ObjectText = wait > 0 ? `Next like in ${formatCountdown(wait)}` : `${owner.DisplayName}'s aquarium`;
	}
}

export const LikeBoardController = new LikeBoardControllerSingleton();
