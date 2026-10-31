import { CollectionService, Players, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";

/** Studs from the shopkeeper at which his shop opens, and (a bit further, so it doesn't flicker) closes again. */
const OPEN_DISTANCE = 9; // at the counter (the east hut stands ~13 studs from the spawn)
const CLOSE_DISTANCE = 12;
const CHECK_INTERVAL = 0.2;
// While a player is near he turns toward them (yaw only), and back to his counter afterwards
const TURN_RATE = 3; // share of the remaining angle turned per second
const MAX_TURN = math.rad(55); // never turns his back to the counter
// Idle: breathes (a slow up and down) so he never looks frozen
const BREATH_HEIGHT = 0.08;
const BREATH_FREQUENCY = 0.35;

interface Keeper {
	model: Model;
	rest: CFrame; // the pivot built in Studio, facing out of the counter
	yaw: number; // current turn from the rest pose (radians)
}

/**
 * The fisherman of the beach hut sells the gamepasses: the Shop panel opens when the local player walks up to him
 * and closes when they walk away (the side menu has no Shop button). Purely local: purchases still go through the
 * "BuyGamePass" intent. He also turns toward a player who comes close, and breathes while idle.
 */
class ShopKeeperControllerSingleton implements Lifecycle {
	private keepers = new Map<Instance, Keeper>();
	private nearby = false;
	private listeners = new Array<(nearby: boolean) => void>();

	/** Whether the local player stands at the shop counter. */
	public isNearby(): boolean {
		return this.nearby;
	}

	public onNearbyChanged(listener: (nearby: boolean) => void) {
		this.listeners.push(listener);
	}

	public onInit() {
		CollectionService.GetInstanceAddedSignal(TAGS.ShopKeeper).Connect((model) => this.track(model));
		CollectionService.GetInstanceRemovedSignal(TAGS.ShopKeeper).Connect((model) => this.keepers.delete(model));
		for (const model of CollectionService.GetTagged(TAGS.ShopKeeper)) this.track(model);
	}

	public onStart() {
		print("[Client] ShopKeeperController started.");
		RunService.RenderStepped.Connect((dt) => this.animate(dt));
		while (true) {
			this.checkDistance();
			task.wait(CHECK_INTERVAL);
		}
	}

	private track(instance: Instance) {
		if (!instance.IsA("Model") || this.keepers.has(instance)) return;
		this.keepers.set(instance, { model: instance, rest: instance.GetPivot(), yaw: 0 });
	}

	private getRootPart(): BasePart | undefined {
		const root = Players.LocalPlayer.Character?.FindFirstChild("HumanoidRootPart");
		return root?.IsA("BasePart") ? root : undefined;
	}

	private checkDistance() {
		const root = this.getRootPart();
		let closest = math.huge;
		if (root) {
			for (const [, keeper] of this.keepers) {
				closest = math.min(closest, keeper.rest.Position.sub(root.Position).Magnitude);
			}
		}
		const nearby = this.nearby ? closest <= CLOSE_DISTANCE : closest <= OPEN_DISTANCE;
		if (nearby === this.nearby) return;
		this.nearby = nearby;
		for (const listener of this.listeners) task.spawn(listener, nearby);
	}

	private animate(dt: number) {
		const root = this.getRootPart();
		const breath = math.sin(os.clock() * BREATH_FREQUENCY * math.pi * 2) * BREATH_HEIGHT;
		for (const [, keeper] of this.keepers) {
			let target = 0;
			if (root && this.nearby) {
				// The player's direction in the keeper's rest frame (he faces −Z, like every model here)
				const offset = keeper.rest.PointToObjectSpace(root.Position);
				target = math.clamp(math.atan2(-offset.X, -offset.Z), -MAX_TURN, MAX_TURN);
			}
			keeper.yaw += (target - keeper.yaw) * math.min(1, dt * TURN_RATE);
			keeper.model.PivotTo(keeper.rest.mul(new CFrame(0, breath, 0)).mul(CFrame.Angles(0, keeper.yaw, 0)));
		}
	}
}

export const ShopKeeperController = new ShopKeeperControllerSingleton();
