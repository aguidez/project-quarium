import { CollectionService, RunService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { HungerState } from "shared/types/fish";

/**
 * Template attribute of a fish whose `Mesh` is a skinned mesh made in Blender (tools/blender/rig_fish.py): it swims
 * with its bones here, FishAnimationController leaves it alone (beat puffs apart).
 */
export const RIG_ATTRIBUTE = "Rig";
export const BONES_RIG = "Bones";

export function hasBoneRig(model: Instance): boolean {
	return model.GetAttribute(RIG_ATTRIBUTE) === BONES_RIG;
}

// V1's rhythm (FishAnimationController), approved by the owner on the Blender preview (tools/blender/preview_swim.py)
const SWIM_FREQUENCY = 1.6; // tail beats per second
const FIN_FREQUENCY = 2.4;
const MOUTH_FREQUENCY = 1.1;
const BODY_WAVE = 3; // radians of lag from nose to tail tip
const SLOW_SPEED = 0.45; // weak (unfed), asleep or leaving: lazy beats
const SLOW_AMOUNT = 0.6; // ... and smaller ones

// Peak angles (radians) of each bone, around the fish's own axes (mesh-local: Y up, Z nose -Z to tail +Z).
// Spine yaw by the bone's t along the body: V1's 4 / 6 / 9 / 12° at the default joints 0.35 / 0.55 / 0.72 / 0.86,
// linear in between and beyond (never under 1°), shared out over the chain (× 4 / spine bones) so a long chain
// (Dragonfish, Mini Leviathan) bends the same in total. Same curve as tools/blender/preview_swim.py.
const SPINE_CURVE: Array<[number, number]> = [
	[0.35, 4],
	[0.55, 6],
	[0.72, 9],
	[0.86, 12],
];
const EAR_FLOP = math.rad(10); // Ear* bones (the Bunny Shark's ears): a soft flop behind the swim beat ...
const EAR_TURN = 0.35; // ... and they trail the fish's turns: seconds of yaw rate turned into lean
const EAR_TURN_MAX = math.rad(25);
const EAR_SETTLE = 6; // per second: how fast the lean follows the turns
const FIN_FLUTTER = math.rad(12); // FinTop / FinBottom, sideways
const PECTORAL_PADDLE = math.rad(20); // FinL / FinR, alternately
const JAW_OPEN = math.rad(10);

// Level of detail: every bone fish animates, closer ones more often; off screen they hold their pose
const VISIBILITY_INTERVAL = 0.5; // seconds between two on-screen checks of a fish
const NEAR_DISTANCE = 60; // studs: every frame within this, every 2nd frame up to FAR_DISTANCE, then every 4th
const FAR_DISTANCE = 110;
const SCREEN_MARGIN = 0.15; // fraction of the screen around it where a fish still counts as on screen

const TAU = math.pi * 2;

const UP = new Vector3(0, 1, 0);
const LENGTH = new Vector3(0, 0, 1);
const SIDE = new Vector3(1, 0, 0);

/** A bone this controller turns: its axis (in its own space) and how it moves. */
interface DrivenBone {
	bone: Bone;
	axis: Vector3;
	drive: (fish: RiggedFish) => number; // angle (radians) at the fish's current phases
}

interface RiggedFish {
	model: Model;
	mesh: MeshPart;
	bones: DrivenBone[];
	yaw: number; // last heading (radians), for the ears' lean
	earLean: number; // radians, smoothed
	swim: number; // phases (radians)
	fin: number;
	mouth: number;
	amount: number; // 1, or SLOW_AMOUNT while lazy
	onScreen: boolean;
	checkedAt: number;
	lastUpdate: number;
}

function spinePeak(t: number, count: number): number {
	let [t0, a0] = SPINE_CURVE[0];
	let [t1, a1] = SPINE_CURVE[1];
	for (let i = 0; i < SPINE_CURVE.size() - 1; i++) {
		if (t >= SPINE_CURVE[i][0]) {
			[t0, a0] = SPINE_CURVE[i];
			[t1, a1] = SPINE_CURVE[i + 1];
		}
	}
	const peak = a0 + ((a1 - a0) * (t - t0)) / (t1 - t0);
	return (math.rad(math.max(1, peak)) * 4) / count;
}

function isSpine(name: string): boolean {
	return string.match(name, "^Spine%d+$")[0] !== undefined || string.match(name, "^Tail%d+$")[0] !== undefined;
}

/** t of a bone (0 nose .. 1 tail tip) from its rest position along the mesh's Z. */
function boneT(mesh: MeshPart, bone: Bone): number {
	const z = mesh.CFrame.PointToObjectSpace(bone.WorldPosition).Z;
	const half = mesh.Size.Z / 2;
	return math.clamp((z + half) / (2 * half), 0, 1);
}

/** The bone-space axis matching a mesh-local axis, from the bone's rest orientation on the mesh. */
function boneAxis(mesh: MeshPart, bone: Bone, meshAxis: Vector3): Vector3 {
	const rest = mesh.CFrame.ToObjectSpace(bone.WorldCFrame);
	return rest.VectorToObjectSpace(meshAxis).Unit;
}

/**
 * Bone swimming (ROADMAP_V1.1 A4): the fish whose template says `Rig = "Bones"` swim by turning the bones of their
 * skinned mesh (a spine wave, fins, mouth), each fish at its own phase. The GPU deforms the mesh: no EditableMesh, no
 * memory budget, every species on screen swims. Purely visual and local, like FishAnimationController, which keeps
 * animating the species not converted yet.
 */
class FishRigControllerSingleton implements Lifecycle {
	private fishes = new Map<Model, RiggedFish>();
	private frame = 0;

	public onInit() {
		// The tanks' fish (built by FishRenderController) and the event guests with a bone rig (the K-pop idol, the
		// abyss lantern fish: server models, their bones turned locally like the fish's)
		for (const tag of [TAGS.Fish, TAGS.EventFish]) {
			CollectionService.GetInstanceAddedSignal(tag).Connect((fish) => this.track(fish));
			CollectionService.GetInstanceRemovedSignal(tag).Connect((fish) => this.fishes.delete(fish as Model));
			for (const fish of CollectionService.GetTagged(tag)) this.track(fish);
		}
	}

	public onStart() {
		print("[Client] FishRigController started.");
		RunService.RenderStepped.Connect(() => this.update());
	}

	private track(instance: Instance) {
		if (!instance.IsA("Model") || !hasBoneRig(instance) || this.fishes.has(instance)) return;
		const model = instance;
		task.spawn(() => {
			const mesh = model.WaitForChild("Mesh", 10);
			if (!mesh || !mesh.IsA("MeshPart") || !model.Parent) return;
			const bones = this.findBones(mesh);
			if (bones.size() === 0) {
				warn(`[Client] ${model.Name} says Rig = "Bones" but its Mesh has no bones: it won't swim.`);
				return;
			}
			this.fishes.set(model, {
				model,
				mesh,
				bones,
				swim: math.random() * TAU,
				fin: math.random() * TAU,
				mouth: math.random() * TAU,
				amount: 1,
				yaw: 0,
				earLean: 0,
				onScreen: true,
				checkedAt: -math.huge,
				lastUpdate: os.clock(),
			});
		});
	}

	/** The bones of the fish rig (tools/blender/rig_fish.py names), with their axis and motion. */
	private findBones(mesh: MeshPart): DrivenBone[] {
		const found = new Array<DrivenBone>();
		const finTop = mesh.FindFirstChild("FinTop", true);
		const finT = finTop?.IsA("Bone") ? boneT(mesh, finTop) : 0.5;
		const bones = mesh.GetDescendants().filter((d): d is Bone => d.IsA("Bone"));
		const spineCount = bones.filter((b) => isSpine(b.Name)).size();
		for (const bone of bones) {
			const name = bone.Name;
			if (isSpine(name)) {
				const t = boneT(mesh, bone);
				const peak = spinePeak(t, spineCount);
				const lag = t * BODY_WAVE;
				found.push({ bone, axis: boneAxis(mesh, bone, UP), drive: (f) => f.amount * peak * math.sin(f.swim - lag) });
			} else if (name.sub(1, 3) === "Ear") {
				found.push({
					bone,
					axis: boneAxis(mesh, bone, SIDE),
					drive: (f) => f.amount * EAR_FLOP * math.sin(f.swim - 1.8) + f.earLean,
				});
			} else if (name === "FinTop" || name === "FinBottom") {
				const sign = name === "FinTop" ? 1 : -1;
				const lag = finT * BODY_WAVE + 1.2;
				found.push({
					bone,
					axis: boneAxis(mesh, bone, LENGTH),
					drive: (f) => sign * f.amount * FIN_FLUTTER * math.sin(f.swim - lag),
				});
			} else if (name === "FinR" || name === "FinL") {
				const offset = name === "FinR" ? 0 : math.pi; // they paddle alternately
				const sign = name === "FinR" ? 1 : -1;
				found.push({
					bone,
					axis: boneAxis(mesh, bone, UP),
					drive: (f) => sign * f.amount * PECTORAL_PADDLE * math.sin(f.fin + offset),
				});
			} else if (name === "Jaw") {
				// Only the lower lip drops a little: nothing ever comes out of the mouth (CLAUDE.md §7)
				found.push({
					bone,
					axis: boneAxis(mesh, bone, SIDE),
					drive: (f) => -f.amount * JAW_OPEN * math.max(0, math.sin(f.mouth)) ** 2,
				});
			}
		}
		return found;
	}

	private update() {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		this.frame += 1;
		const now = os.clock();
		const eye = camera.CFrame.Position;
		const viewport = camera.ViewportSize;
		for (const [model, fish] of this.fishes) {
			if (!model.Parent || !fish.mesh.Parent) {
				this.fishes.delete(model);
				continue;
			}
			const position = fish.mesh.Position;
			if (now - fish.checkedAt >= VISIBILITY_INTERVAL) {
				fish.checkedAt = now;
				const [point, inFront] = camera.WorldToViewportPoint(position);
				const mx = viewport.X * SCREEN_MARGIN;
				const my = viewport.Y * SCREEN_MARGIN;
				fish.onScreen =
					inFront && point.X > -mx && point.X < viewport.X + mx && point.Y > -my && point.Y < viewport.Y + my;
			}
			if (!fish.onScreen) {
				fish.lastUpdate = now; // holds its pose; the phases don't jump when it comes back
				continue;
			}
			const distance = position.sub(eye).Magnitude;
			const every = distance <= NEAR_DISTANCE ? 1 : distance <= FAR_DISTANCE ? 2 : 4;
			if (this.frame % every !== 0) continue;
			this.animate(fish, now - fish.lastUpdate);
			fish.lastUpdate = now;
		}
	}

	private animate(fish: RiggedFish, dt: number) {
		const model = fish.model;
		const lazy =
			model.GetAttribute("Hunger") === HungerState.Weak ||
			model.GetAttribute("Asleep") === true ||
			model.GetAttribute("Dead") === true;
		const advance = dt * TAU * (lazy ? SLOW_SPEED : 1);
		fish.swim = (fish.swim + advance * SWIM_FREQUENCY) % TAU;
		fish.fin = (fish.fin + advance * FIN_FREQUENCY) % TAU;
		fish.mouth = (fish.mouth + advance * MOUTH_FREQUENCY) % TAU;
		fish.amount = lazy ? SLOW_AMOUNT : 1;
		// The ears trail the turns: lean against the yaw rate, smoothed (only fish with Ear* bones read it)
		const [, yaw] = fish.mesh.CFrame.ToOrientation();
		if (dt > 0) {
			let turn = yaw - fish.yaw;
			if (turn > math.pi) turn -= TAU;
			if (turn < -math.pi) turn += TAU;
			const target = math.clamp((-turn / dt) * EAR_TURN, -EAR_TURN_MAX, EAR_TURN_MAX);
			fish.earLean += (target - fish.earLean) * math.min(1, dt * EAR_SETTLE);
		}
		fish.yaw = yaw;
		for (const driven of fish.bones) {
			driven.bone.Transform = CFrame.fromAxisAngle(driven.axis, driven.drive(fish));
		}
	}
}

export const FishRigController = new FishRigControllerSingleton();
