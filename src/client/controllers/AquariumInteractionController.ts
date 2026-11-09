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
// A click / tap that misses every hitbox still picks the coin or star drawn this close to it (share of the screen's
// height: ~30 px on a phone held sideways for a tap, a fingertip's width)
const TOUCH_SLACK = 0.08;
const MOUSE_SLACK = 0.03;

/**
 * In focus view, turns clicks/taps into interaction intents:
 * a falling star under the cursor (starfall) is caught first, then a coin is collected, otherwise food is dropped in the water.
 * A click or tap just beside a coin / star still gets it; a gamepad's A (or R2) acts on the one nearest the middle of
 * the screen. The server rate-limits and validates every intent.
 */
class AquariumInteractionControllerSingleton implements Lifecycle {
	private interactRemote = getRemoteEvent("Interact");
	private foodDeniedListeners = new Array<() => void>();

	public onInit() {
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (!FocusController.isFocused()) return;
			// A gamepad has no cursor: A (or R2) acts on what is nearest the middle of the screen. Jumping is off in
			// the tank view. A on a selected UI button presses that button instead (gameProcessed); R2 never does.
			if (input.KeyCode === Enum.KeyCode.ButtonR2 || (input.KeyCode === Enum.KeyCode.ButtonA && !gameProcessed)) {
				this.handleGamepadPress();
				return;
			}
			if (gameProcessed) return;
			if (
				input.UserInputType !== Enum.UserInputType.MouseButton1 &&
				input.UserInputType !== Enum.UserInputType.Touch
			) {
				return;
			}
			this.handleClick(input.Position.X, input.Position.Y, input.UserInputType === Enum.UserInputType.Touch);
		});
	}

	public onStart() {
		print("[Client] AquariumInteractionController started.");
	}

	private interact(kind: InteractionKind, payload: unknown) {
		this.interactRemote.FireServer(kind, payload);
	}

	private handleClick(screenX: number, screenY: number, touch: boolean) {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		const ray = camera.ScreenPointToRay(screenX, screenY);
		// A finger is wide and hides the coin: a tap that just misses one still picks it up
		const slack = camera.ViewportSize.Y * (touch ? TOUCH_SLACK : MOUSE_SLACK);
		const point = new Vector2(screenX, screenY);

		const star =
			this.getClickedPart(ray, TAGS.Star) ??
			this.getNearestOnScreen(TAGS.Star, point, slack, (p) => camera.WorldToScreenPoint(p));
		if (star) {
			this.interact("CatchStar", star);
			return;
		}

		const coin =
			this.getClickedPart(ray, TAGS.Coin) ??
			this.getNearestOnScreen(TAGS.Coin, point, slack, (p) => camera.WorldToScreenPoint(p));
		if (coin) {
			this.interact("CollectCoin", coin);
			return;
		}

		this.dropFood(ray);
	}

	/** Gamepad: the star, else the coin nearest the middle of the screen, else food dropped in the middle. */
	private handleGamepadPress() {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		const center = camera.ViewportSize.div(2);
		const toViewport = (p: Vector3) => camera.WorldToViewportPoint(p);
		const star = this.getNearestOnScreen(TAGS.Star, center, math.huge, toViewport);
		if (star) {
			this.interact("CatchStar", star);
			return;
		}
		const coin = this.getNearestOnScreen(TAGS.Coin, center, math.huge, toViewport);
		if (coin) {
			this.interact("CollectCoin", coin);
			return;
		}
		this.dropFood(camera.ViewportPointToRay(center.X, center.Y));
	}

	/**
	 * The own tank's part with this tag (a coin, a star) drawn nearest `point`, within `maxDistance` pixels and on
	 * screen. `project` maps a world position to the same screen space as `point` (with or without the GUI inset).
	 */
	private getNearestOnScreen(
		tag: string,
		point: Vector2,
		maxDistance: number,
		project: (position: Vector3) => LuaTuple<[Vector3, boolean]>,
	): BasePart | undefined {
		const aquarium = FocusController.getOwnAquarium();
		if (!aquarium) return undefined;
		let best: BasePart | undefined;
		let bestDistance = maxDistance;
		for (const part of CollectionService.GetTagged(tag)) {
			if (!part.IsA("BasePart") || !part.IsDescendantOf(aquarium)) continue;
			const [screen, onScreen] = project(part.Position);
			if (!onScreen) continue;
			const distance = new Vector2(screen.X, screen.Y).sub(point).Magnitude;
			if (distance <= bestDistance) {
				best = part;
				bestDistance = distance;
			}
		}
		return best;
	}

	private dropFood(ray: Ray) {
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
