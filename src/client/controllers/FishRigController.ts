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

// Peak angles (radians) of each bone, around the fish's own axes (mesh-local: Y up, Z nose -Z to tail +Z)
const SPINE_YAW = new Map<string, number>([
	["Spine1", math.rad(4)],
	["Spine2", math.rad(6)],
	["Tail1", math.rad(9)],
	["Tail2", math.rad(12)],
]);
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
	swim: number; // phases (radians)
	fin: number;
	mouth: number;
	amount: number; // 1, or SLOW_AMOUNT while lazy
	onScreen: boolean;
	checkedAt: number;
	lastUpdate: number;
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
		CollectionService.GetInstanceAddedSignal(TAGS.Fish).Connect((fish) => this.track(fish));
		CollectionService.GetInstanceRemovedSignal(TAGS.Fish).Connect((fish) => this.fishes.delete(fish as Model));
		for (const fish of CollectionService.GetTagged(TAGS.Fish)) this.track(fish);
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
		for (const descendant of mesh.GetDescendants()) {
			if (!descendant.IsA("Bone")) continue;
			const bone = descendant;
			const name = bone.Name;
			const spine = SPINE_YAW.get(name);
			if (spine !== undefined) {
				const lag = boneT(mesh, bone) * BODY_WAVE;
				found.push({ bone, axis: boneAxis(mesh, bone, UP), drive: (f) => f.amount * spine * math.sin(f.swim - lag) });
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
		for (const driven of fish.bones) {
			driven.bone.Transform = CFrame.fromAxisAngle(driven.axis, driven.drive(fish));
		}
	}
}

export const FishRigController = new FishRigControllerSingleton();
