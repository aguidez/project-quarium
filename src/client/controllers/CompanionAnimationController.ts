import { Janitor } from "@rbxts/janitor";
import { CollectionService, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { hasBoneRig } from "./FishRigController";

// Water Hen: rocks from side to side and nods while it floats, faster and wider while it paddles
const HEN_ROCK_FREQUENCY = 0.9; // rocks per second at rest
const HEN_PADDLE_FREQUENCY = 2.2; // waddles per second while paddling
const HEN_ROCK_ANGLE = math.rad(5); // roll at rest
const HEN_PADDLE_ANGLE = math.rad(9); // roll while paddling
const HEN_NOD_ANGLE = math.rad(4); // pitch: leans forward a little with each paddle
const HEN_BOB = 0.06; // studs: a small extra bob on top of the server's
const MOVING_SPEED = 0.4; // studs/s: faster than this, it is paddling
const BLEND_RATE = 4; // how fast it eases between resting and paddling (per second)

// Jellyfish: its bell squeezes and relaxes like a swimming jellyfish (wider and flatter, then taller and narrower)
const JELLY_PULSE_FREQUENCY = 0.8; // pulses per second
const JELLY_SQUEEZE = 0.1; // ± share of its size
const JELLY_BOB = 0.15; // studs: rises a little with each squeeze
const JELLY_SWAY = math.rad(5); // a slow tilt from side to side

/** Companion types animated here, and how. */
type Animation = "Hen" | "Jelly";
const ANIMATIONS: Record<string, Animation> = { WaterHen: "Hen", Jellyfish: "Jelly" };

interface AnimatedCompanion {
	animation: Animation;
	body: BasePart;
	mesh: BasePart;
	lastPosition: Vector3;
	paddle: number; // 0 resting, 1 paddling (eased)
	phase: number; // radians
	janitor: Janitor;
}

/**
 * Small procedural animations of the companions that have no mesh deformation: the Water Hen rocks as it paddles,
 * the Jellyfish's bell pulses (the Swordfish swims through FishAnimationController). Purely visual and local: the server moves the model's anchored "Body"; here, the
 * client unwelds its own copy of the "Mesh" and places it on the body every frame with a wobble.
 */
class CompanionAnimationControllerSingleton implements Lifecycle {
	private companions = new Map<Instance, AnimatedCompanion>();

	public onInit() {
		CollectionService.GetInstanceAddedSignal(TAGS.Companion).Connect((model) => this.track(model));
		CollectionService.GetInstanceRemovedSignal(TAGS.Companion).Connect((model) => this.untrack(model));
		for (const model of CollectionService.GetTagged(TAGS.Companion)) this.track(model);
	}

	public onStart() {
		print("[Client] CompanionAnimationController started.");
		RunService.RenderStepped.Connect((dt) => {
			for (const [, companion] of this.companions) {
				if (companion.animation === "Hen") this.animateHen(companion, dt);
				else this.animateJelly(companion, dt);
			}
		});
	}

	private track(model: Instance) {
		const animation = ANIMATIONS[model.GetAttribute("CompanionType") as string];
		if (!model.IsA("Model") || animation === undefined || this.companions.has(model)) return;
		if (hasBoneRig(model)) return; // a companion with a bone rig (the Jellyfish) moves in FishRigController
		task.spawn(() => {
			const body = model.WaitForChild("Body", 10);
			const mesh = model.WaitForChild("Mesh", 10);
			if (!body?.IsA("BasePart") || !mesh?.IsA("BasePart") || !model.IsDescendantOf(game)) return;
			if (!CollectionService.HasTag(model, TAGS.Companion)) return;
			// Local only: the mesh follows the body from here, not through its weld
			mesh.Anchored = true;
			for (const child of mesh.GetChildren()) if (child.IsA("WeldConstraint")) child.Destroy();
			const janitor = new Janitor();
			this.companions.set(model, {
				animation,
				body,
				mesh,
				lastPosition: body.Position,
				paddle: 0,
				phase: math.random() * math.pi * 2,
				janitor,
			});
			janitor.Add(model.AncestryChanged.Connect(() => !model.IsDescendantOf(game) && this.untrack(model)));
		});
	}

	private untrack(model: Instance) {
		const companion = this.companions.get(model);
		if (!companion) return;
		this.companions.delete(model);
		companion.janitor.Destroy();
	}

	private animateHen(companion: AnimatedCompanion, dt: number) {
		const { body, mesh } = companion;
		if (dt <= 0) return;
		const position = body.Position;
		const offset = position.sub(companion.lastPosition);
		const speed = new Vector3(offset.X, 0, offset.Z).Magnitude / dt;
		companion.lastPosition = position;
		const target = speed > MOVING_SPEED ? 1 : 0;
		companion.paddle += (target - companion.paddle) * math.min(1, dt * BLEND_RATE);

		const paddle = companion.paddle;
		const frequency = HEN_ROCK_FREQUENCY + (HEN_PADDLE_FREQUENCY - HEN_ROCK_FREQUENCY) * paddle;
		companion.phase = (companion.phase + dt * frequency * math.pi * 2) % (math.pi * 2);
		const roll = math.sin(companion.phase) * (HEN_ROCK_ANGLE + (HEN_PADDLE_ANGLE - HEN_ROCK_ANGLE) * paddle);
		// Head toward −Z: a negative pitch around X leans it forward, twice per waddle (once per foot)
		const nod = -math.abs(math.sin(companion.phase)) * HEN_NOD_ANGLE * paddle;
		const bob = math.sin(companion.phase * 2) * HEN_BOB;
		mesh.CFrame = body.CFrame.mul(new CFrame(0, bob, 0)).mul(CFrame.Angles(nod, 0, roll));
	}

	private animateJelly(companion: AnimatedCompanion, dt: number) {
		const { body, mesh } = companion;
		companion.phase = (companion.phase + dt * JELLY_PULSE_FREQUENCY * math.pi * 2) % (math.pi * 2);
		const squeeze = math.sin(companion.phase);
		// The body is scaled with the model by the server (pop in / out): the mesh follows its size
		const size = body.Size;
		mesh.Size = new Vector3(
			size.X * (1 + squeeze * JELLY_SQUEEZE),
			size.Y * (1 - squeeze * JELLY_SQUEEZE),
			size.Z * (1 + squeeze * JELLY_SQUEEZE),
		);
		const sway = math.sin(companion.phase * 0.25) * JELLY_SWAY;
		mesh.CFrame = body.CFrame.mul(new CFrame(0, -squeeze * JELLY_BOB, 0)).mul(CFrame.Angles(0, 0, sway));
	}
}

export const CompanionAnimationController = new CompanionAnimationControllerSingleton();
