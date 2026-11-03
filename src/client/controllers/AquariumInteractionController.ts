import { CollectionService, Players, UserInputService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, InteractionKind } from "shared/network";
import { TAGS } from "shared/tags";
import { COIN_HITBOX_SCALE } from "shared/types/fish";
import { decodeFoodRefills, FOOD_RESERVE_ATTRIBUTES, getFoodReady } from "shared/types/food";
import { FocusController } from "./FocusController";

const MAX_RAY_DISTANCE = 500;
// Forgiving hit test so small coins are easy to click / tap (grows with the coin hitbox)
const COIN_PICK_RADIUS = 0.6 * COIN_HITBOX_SCALE;

/**
 * In focus view, turns clicks/taps into interaction intents:
 * a falling star under the cursor (starfall) is caught first, then a coin is collected, otherwise food is dropped in the water.
 * The server rate-limits and validates every intent.
 */
class AquariumInteractionControllerSingleton implements Lifecycle {
	private interactRemote = getRemoteEvent("Interact");
	private foodDeniedListeners = new Array<() => void>();

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

		const star = this.getClickedPart(ray, TAGS.Star);
		if (star) {
			this.interact("CatchStar", star);
			return;
		}

		const coin = this.getClickedPart(ray, TAGS.Coin);
		if (coin) {
			this.interact("CollectCoin", coin);
			return;
		}

		const position = this.getClickedWaterPoint(ray);
		if (!position) return;
		// The server checks the reserve too; with none ready, the click only tells the HUD to flash
		if (!this.hasFoodReady()) {
			for (const listener of this.foodDeniedListeners) task.spawn(listener);
			return;
		}
		this.interact("DropFood", position);
	}

	/** The food reserve FoodService publishes on the local player (shared/types/food.ts). */
	private hasFoodReady(): boolean {
		const player = Players.LocalPlayer;
		const slots = player.GetAttribute(FOOD_RESERVE_ATTRIBUTES.slots);
		if (!typeIs(slots, "number")) return true; // not published yet: let the server decide
		const refills = decodeFoodRefills(player.GetAttribute(FOOD_RESERVE_ATTRIBUTES.refills));
		return getFoodReady(slots, refills, Workspace.GetServerTimeNow()) > 0;
	}

	/** A click on the water with the food reserve empty (FoodReserve flashes). */
	public onFoodDenied(listener: () => void): () => void {
		this.foodDeniedListeners.push(listener);
		return () => {
			const index = this.foodDeniedListeners.indexOf(listener);
			if (index >= 0) this.foodDeniedListeners.remove(index);
		};
	}

	/** The own tank's hitbox with this tag (a coin, a star) under the cursor, with a forgiving radius. */
	private getClickedPart(ray: Ray, tag: string): BasePart | undefined {
		const aquarium = FocusController.getOwnAquarium();
		if (!aquarium) return undefined;

		const parts = CollectionService.GetTagged(tag).filter((part) => part.IsDescendantOf(aquarium));
		if (parts.size() === 0) return undefined;

		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Include;
		params.FilterDescendantsInstances = parts;

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
