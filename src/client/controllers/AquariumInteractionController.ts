import { CollectionService, UserInputService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, InteractionKind } from "shared/network";
import { TAGS } from "shared/tags";
import { COIN_HITBOX_SCALE } from "shared/types/fish";
import { FocusController } from "./FocusController";

const MAX_RAY_DISTANCE = 500;
// Forgiving hit test so small coins are easy to click / tap (grows with the coin hitbox)
const COIN_PICK_RADIUS = 0.6 * COIN_HITBOX_SCALE;

/**
 * In focus view, turns clicks/taps into interaction intents:
 * a coin under the cursor is collected first, otherwise food is dropped in the water.
 * The server rate-limits and validates every intent.
 */
class AquariumInteractionControllerSingleton implements Lifecycle {
	private interactRemote = getRemoteEvent("Interact");

	public onInit() {
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed || !FocusController.isFocused()) return;
			if (
				input.UserInputType !== Enum.UserInputType.MouseButton1 &&
				input.UserInputType !== Enum.UserInputType.Touch
			) {
				return;
			}
			this.handleClick(input.Position.X, input.Position.Y);
		});
	}

	public onStart() {
		print("[Client] AquariumInteractionController started.");
	}

	private interact(kind: InteractionKind, payload: unknown) {
		this.interactRemote.FireServer(kind, payload);
	}

	private handleClick(screenX: number, screenY: number) {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		const ray = camera.ScreenPointToRay(screenX, screenY);

		const coin = this.getClickedCoin(ray);
		if (coin) {
			this.interact("CollectCoin", coin);
			return;
		}

		const position = this.getClickedWaterPoint(ray);
		if (position) this.interact("DropFood", position);
	}

	private getClickedCoin(ray: Ray): BasePart | undefined {
		const aquarium = FocusController.getOwnAquarium();
		if (!aquarium) return undefined;

		const coins = CollectionService.GetTagged(TAGS.Coin).filter((coin) => coin.IsDescendantOf(aquarium));
		if (coins.size() === 0) return undefined;

		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Include;
		params.FilterDescendantsInstances = coins;

		const hit = Workspace.Spherecast(ray.Origin, COIN_PICK_RADIUS, ray.Direction.mul(MAX_RAY_DISTANCE), params);
		return hit?.Instance;
	}

	/**
	 * Raycasts against the player's own water volume only (glass is ignored) and returns
	 * the midpoint between where the ray enters and leaves the water, so food drops
	 * "where the player is looking" inside the tank rather than against the front glass.
	 */
	private getClickedWaterPoint(ray: Ray): Vector3 | undefined {
		const water = FocusController.getOwnWater();
		if (!water) return undefined;

		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Include;
		params.FilterDescendantsInstances = [water];

		const entry = Workspace.Raycast(ray.Origin, ray.Direction.mul(MAX_RAY_DISTANCE), params);
		if (!entry) return undefined;

		// Cast back from the far side to find the exit point
		const farPoint = entry.Position.add(ray.Direction.mul(MAX_RAY_DISTANCE));
		const exit = Workspace.Raycast(farPoint, entry.Position.sub(farPoint), params);
		const exitPosition = exit ? exit.Position : entry.Position;

		return entry.Position.add(exitPosition).div(2);
	}
}

export const AquariumInteractionController = new AquariumInteractionControllerSingleton();
