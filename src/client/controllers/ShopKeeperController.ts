import { CollectionService, Players, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";

/** Studs from the shopkeeper at which his shop opens, and (a bit further, so it doesn't flicker) closes again. */
const OPEN_DISTANCE = 9; // only without a ShopZone in the place (the zone is the rule)
const CLOSE_DISTANCE = 12;
/** Studs past a ShopZone's edges the player can walk before the shop closes (so it doesn't flicker at the edge). */
const ZONE_CLOSE_MARGIN = 2;
const ZONE_HEIGHT = 8; // studs above the zone's floor that still count (a jump)
const CHECK_INTERVAL = 0.2;
// While a player is near he turns toward them (yaw only), and back to his counter afterwards
const TURN_RATE = 3; // share of the remaining angle turned per second
const MAX_TURN = math.rad(55); // never turns his back to the counter
// Idle: breathes (a slow up and down) so he never looks frozen
const BREATH_HEIGHT = 0.08;
const BREATH_FREQUENCY = 0.35;
// His bones (tools/blender/rig_boxes.py, design/rigs/Fisherman.json: Hips the root, Chest, Head, ArmL, ArmR), once
// his body_geom is the skinned mesh: the chest breathes with the bob, the head looks around while idle and finishes
// the turn toward the player, and he waves (right arm, empty hand: CLAUDE.md §7) when a player steps up
const CHEST_BREATH = math.rad(2.5);
const HEAD_SHARE = 0.4; // of the turn toward the player done by the head, the rest by the whole body
const HEAD_MAX_TURN = math.rad(30);
const HEAD_IDLE_LOOK = math.rad(8); // a slow look around while nobody is there ...
const HEAD_IDLE_FREQUENCY = 0.12; // ... looks per second
const WAVE_TIME = 2.4; // seconds of a wave
const WAVE_RAISE = math.rad(60); // the right arm comes up in front of him ...
const WAVE_SWING = math.rad(12); // ... and waves from side to side
const WAVE_FREQUENCY = 2.4; // swings per second
const WAVE_EASE = 0.4; // seconds to raise / lower the arm
const RIG_RETRY = 1; // seconds between two looks for his bones (they may stream in after him)
// The zone's glowing pad (a SurfaceGui on the zone's top face): gold, its outline pulsing, brighter while stood on
const PAD_PIXELS_PER_STUD = 40;
const PAD_CORNER = 0.9; // studs
const PAD_STROKE = 0.4; // studs: an orange outline, so the zone reads on the light boardwalk in full sun
const PAD_LINE = 0.12; // studs: the thin white line inside it
const PAD_LINE_INSET = 0.3; // studs between the outline and the white line
const PAD_COLOR = Color3.fromHex("#FFC21A");
const PAD_OUTLINE = Color3.fromHex("#F08A00");
const PAD_LIGHT = Color3.fromHex("#FFF3A0");
const PULSE_SPEED = 2.4; // radians per second
const SPARKLE_RATE = 4; // per second, rising from the pad (more while stood on)

interface Keeper {
	model: Model;
	rest: CFrame; // the pivot built in Studio, facing out of the counter
	yaw: number; // current turn from the rest pose (radians)
	rig?: KeeperRig;
	rigCheckedAt: number;
	waveStart?: number; // os.clock() of the current wave
}

/** His bones and their axes (bone space), from the skinned mesh's rest pose; any of them may be missing. */
interface KeeperRig {
	chest?: { bone: Bone; side: Vector3 };
	head?: { bone: Bone; up: Vector3 };
	arm?: { bone: Bone; side: Vector3; length: Vector3 };
}

/** The bone-space axis matching a mesh-local axis (front −Z, up +Y, right +X), from the bone's rest pose. */
function boneAxis(mesh: BasePart, bone: Bone, meshAxis: Vector3): Vector3 {
	return mesh.CFrame.ToObjectSpace(bone.WorldCFrame).VectorToObjectSpace(meshAxis).Unit;
}

function findRig(model: Model): KeeperRig | undefined {
	for (const mesh of model.GetDescendants()) {
		if (!mesh.IsA("MeshPart")) continue;
		const bone = (name: string) => {
			const found = mesh.FindFirstChild(name, true);
			return found?.IsA("Bone") ? found : undefined;
		};
		const chest = bone("Chest");
		const head = bone("Head");
		const arm = bone("ArmR");
		if (!chest && !head && !arm) continue;
		const side = new Vector3(1, 0, 0);
		const up = new Vector3(0, 1, 0);
		const length = new Vector3(0, 0, 1);
		return {
			chest: chest && { bone: chest, side: boneAxis(mesh, chest, side) },
			head: head && { bone: head, up: boneAxis(mesh, head, up) },
			arm: arm && { bone: arm, side: boneAxis(mesh, arm, side), length: boneAxis(mesh, arm, length) },
		};
	}
	return undefined;
}

interface Zone {
	part: BasePart;
	fill: Frame;
	stroke: UIStroke;
	sparkles: ParticleEmitter;
	cleanup: Instance[];
}

/**
 * The fisherman of the beach hut sells the gamepasses: the Shop panel opens when the local player steps on the
 * glowing zone in front of his counter (tag ShopZone) and closes when they walk away (the side menu has no Shop
 * button). Purely local: purchases still go through the "BuyGamePass" intent. He also turns toward a player who comes
 * close (body and head), waves when they step up, and breathes while idle (his bones, once his mesh has them).
 */
class ShopKeeperControllerSingleton implements Lifecycle {
	private keepers = new Map<Instance, Keeper>();
	private zones = new Map<Instance, Zone>();
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

		CollectionService.GetInstanceAddedSignal(TAGS.ShopZone).Connect((part) => this.addZone(part));
		CollectionService.GetInstanceRemovedSignal(TAGS.ShopZone).Connect((part) => this.removeZone(part));
		for (const part of CollectionService.GetTagged(TAGS.ShopZone)) this.addZone(part);
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
		this.keepers.set(instance, { model: instance, rest: instance.GetPivot(), yaw: 0, rigCheckedAt: -math.huge });
	}

	/** Draws the zone's pad (local only): a rounded gold plate with a light outline, and sparkles rising from it. */
	private addZone(instance: Instance) {
		if (!instance.IsA("BasePart") || this.zones.has(instance)) return;
		const gui = new Instance("SurfaceGui");
		gui.Name = "ShopZonePad";
		gui.ResetOnSpawn = false;
		gui.Face = Enum.NormalId.Top;
		gui.LightInfluence = 0;
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
		gui.PixelsPerStud = PAD_PIXELS_PER_STUD;
		gui.Adornee = instance;

		const fill = new Instance("Frame");
		fill.Name = "Fill";
		// The stroke is drawn outside the frame: shrink it by the stroke so the outline stays on the zone
		const inset = PAD_STROKE * PAD_PIXELS_PER_STUD;
		fill.AnchorPoint = new Vector2(0.5, 0.5);
		fill.Position = UDim2.fromScale(0.5, 0.5);
		fill.Size = new UDim2(1, -inset * 2, 1, -inset * 2);
		fill.BackgroundColor3 = PAD_COLOR;
		fill.BorderSizePixel = 0;
		fill.Parent = gui;
		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, PAD_CORNER * PAD_PIXELS_PER_STUD);
		corner.Parent = fill;
		// Brighter at the edges than in the middle: reads as a lit zone rather than a painted floor
		const gradient = new Instance("UIGradient");
		gradient.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, 0),
			new NumberSequenceKeypoint(0.5, 0.35),
			new NumberSequenceKeypoint(1, 0),
		]);
		gradient.Parent = fill;
		const stroke = new Instance("UIStroke");
		stroke.Color = PAD_OUTLINE;
		stroke.Thickness = inset;
		stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
		stroke.Parent = fill;
		// A thin white line just inside the outline
		const lineInset = PAD_LINE_INSET * PAD_PIXELS_PER_STUD;
		const line = new Instance("Frame");
		line.Name = "Line";
		line.AnchorPoint = new Vector2(0.5, 0.5);
		line.Position = UDim2.fromScale(0.5, 0.5);
		line.Size = new UDim2(1, -lineInset * 2, 1, -lineInset * 2);
		line.BackgroundTransparency = 1;
		line.Parent = fill;
		const lineCorner = new Instance("UICorner");
		lineCorner.CornerRadius = new UDim(0, math.max(PAD_CORNER * PAD_PIXELS_PER_STUD - lineInset, 0));
		lineCorner.Parent = line;
		const lineStroke = new Instance("UIStroke");
		lineStroke.Color = new Color3(1, 1, 1);
		lineStroke.Thickness = PAD_LINE * PAD_PIXELS_PER_STUD;
		lineStroke.Parent = line;
		// PlayerGui: a SurfaceGui only takes clicks there, and it stays local
		gui.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");

		// On the part itself: a box emitter spreads over its parent part's whole surface
		const sparkles = new Instance("ParticleEmitter");
		sparkles.Name = "ShopZoneSparkles";
		sparkles.Shape = Enum.ParticleEmitterShape.Box;
		sparkles.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume;
		sparkles.EmissionDirection = Enum.NormalId.Top;
		sparkles.Texture = "rbxasset://textures/particles/sparkles_main.dds";
		sparkles.Color = new ColorSequence(PAD_LIGHT, PAD_COLOR);
		sparkles.LightEmission = 1;
		sparkles.LightInfluence = 0;
		sparkles.Size = new NumberSequence([new NumberSequenceKeypoint(0, 0.35), new NumberSequenceKeypoint(1, 0)]);
		sparkles.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, 0.2),
			new NumberSequenceKeypoint(1, 1),
		]);
		sparkles.Lifetime = new NumberRange(1.2, 2);
		sparkles.Speed = new NumberRange(1.5, 2.5);
		sparkles.Rate = SPARKLE_RATE;
		sparkles.Parent = instance;

		this.zones.set(instance, { part: instance, fill, stroke, sparkles, cleanup: [gui, sparkles] });
	}

	private removeZone(instance: Instance) {
		const zone = this.zones.get(instance);
		if (!zone) return;
		for (const item of zone.cleanup) item.Destroy();
		this.zones.delete(instance);
	}

	private getRootPart(): BasePart | undefined {
		const root = Players.LocalPlayer.Character?.FindFirstChild("HumanoidRootPart");
		return root?.IsA("BasePart") ? root : undefined;
	}

	/** Whether `position` stands on the zone (its footprint grown by `margin`, up to ZONE_HEIGHT above its floor). */
	private isOnZone(zone: Zone, position: Vector3, margin: number): boolean {
		const offset = zone.part.CFrame.PointToObjectSpace(position);
		const size = zone.part.Size;
		const height = offset.Y - size.Y / 2;
		return (
			math.abs(offset.X) <= size.X / 2 + margin &&
			math.abs(offset.Z) <= size.Z / 2 + margin &&
			height >= -1 &&
			height <= ZONE_HEIGHT
		);
	}

	private checkDistance() {
		const root = this.getRootPart();
		let nearby = false;
		if (root && this.zones.size() > 0) {
			const margin = this.nearby ? ZONE_CLOSE_MARGIN : 0;
			for (const [, zone] of this.zones) if (this.isOnZone(zone, root.Position, margin)) nearby = true;
		} else if (root) {
			// No zone in the place: the old rule, the distance to the fisherman
			let closest = math.huge;
			for (const [, keeper] of this.keepers) {
				closest = math.min(closest, keeper.rest.Position.sub(root.Position).Magnitude);
			}
			nearby = this.nearby ? closest <= CLOSE_DISTANCE : closest <= OPEN_DISTANCE;
		}
		if (nearby === this.nearby) return;
		this.nearby = nearby;
		if (nearby) for (const [, keeper] of this.keepers) keeper.waveStart = os.clock();
		for (const [, zone] of this.zones) zone.sparkles.Rate = nearby ? SPARKLE_RATE * 3 : SPARKLE_RATE;
		for (const listener of this.listeners) task.spawn(listener, nearby);
	}

	private animate(dt: number) {
		const root = this.getRootPart();
		const now = os.clock();
		const wave = math.sin(now * BREATH_FREQUENCY * math.pi * 2);
		const breath = wave * BREATH_HEIGHT;
		for (const [, keeper] of this.keepers) {
			if (!keeper.rig && now - keeper.rigCheckedAt >= RIG_RETRY) {
				keeper.rigCheckedAt = now;
				keeper.rig = findRig(keeper.model);
			}
			const rig = keeper.rig;
			// The player's direction in the keeper's rest frame (he faces −Z, like every model here): with bones the
			// head takes a share of the turn, so he can follow a little further without turning his back to the counter
			let target = 0;
			if (root && this.nearby) {
				const offset = keeper.rest.PointToObjectSpace(root.Position);
				const reach = rig?.head ? MAX_TURN + HEAD_MAX_TURN : MAX_TURN;
				target = math.clamp(math.atan2(-offset.X, -offset.Z), -reach, reach);
			}
			keeper.yaw += (target - keeper.yaw) * math.min(1, dt * TURN_RATE);
			// (at the far reach the head is at HEAD_MAX_TURN and the body at MAX_TURN)
			const headYaw = rig?.head ? math.clamp(keeper.yaw * HEAD_SHARE, -HEAD_MAX_TURN, HEAD_MAX_TURN) : 0;
			const bodyYaw = keeper.yaw - headYaw;
			keeper.model.PivotTo(keeper.rest.mul(new CFrame(0, breath, 0)).mul(CFrame.Angles(0, bodyYaw, 0)));
			if (!rig) continue;
			if (rig.chest?.bone.Parent) rig.chest.bone.Transform = CFrame.fromAxisAngle(rig.chest.side, CHEST_BREATH * wave);
			if (rig.head?.bone.Parent) {
				const idle = (1 - math.min(1, math.abs(keeper.yaw) / math.rad(10))) * HEAD_IDLE_LOOK;
				const look = headYaw + idle * math.sin(now * HEAD_IDLE_FREQUENCY * math.pi * 2);
				rig.head.bone.Transform = CFrame.fromAxisAngle(rig.head.up, look);
			}
			if (rig.arm?.bone.Parent) {
				let raise = 0;
				let swing = 0;
				if (keeper.waveStart !== undefined) {
					const t = now - keeper.waveStart;
					if (t >= WAVE_TIME) keeper.waveStart = undefined;
					else {
						const ease = math.min(1, t / WAVE_EASE, (WAVE_TIME - t) / WAVE_EASE);
						const k = ease * ease * (3 - 2 * ease);
						raise = WAVE_RAISE * k;
						swing = WAVE_SWING * k * math.sin(t * WAVE_FREQUENCY * math.pi * 2);
					}
				}
				rig.arm.bone.Transform = CFrame.fromAxisAngle(rig.arm.side, raise).mul(
					CFrame.fromAxisAngle(rig.arm.length, swing),
				);
			}
		}
		// The pad breathes; stood on, it lights up
		const pulse = (math.sin(os.clock() * PULSE_SPEED) + 1) / 2;
		for (const [, zone] of this.zones) {
			zone.fill.BackgroundTransparency = this.nearby ? 0.15 : 0.4 + pulse * 0.2;
			zone.stroke.Transparency = this.nearby ? 0 : pulse * 0.3;
		}
	}
}

export const ShopKeeperController = new ShopKeeperControllerSingleton();
