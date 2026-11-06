import { CollectionService, RunService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { SWORDFISH_CRUISE_SPEED } from "shared/types/companions";
import { FISH_TYPES, FishType, HungerState } from "shared/types/fish";

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
const SLOW_SPEED = 0.45; // asleep (a UFO's mutation) or leaving: lazy beats
const SLOW_AMOUNT = 0.6; // ... and smaller ones

// Behaviours (ROADMAP_V1.1 A6), from what the fish does on screen, compared with its species' wandering speed (the
// server's segments: a chase is 2×, a weak fish 0.35×, a wait 0):
//   rest (still)   slow, small beats; the pectorals keep paddling to hover
//   cruise (1×)    V1's swim
//   sprint (2×)    faster, wider beats (rushing to food)
// The wandering itself eases in and out, so the beats follow each push.
const REST_BEAT = 0.4; // × beat rate and amplitude at a standstill
const REST_PADDLE = 0.75; // × pectoral rate at a standstill
const SPRINT_BEAT = 1.7; // × beat rate at 2× speed
const SPRINT_AMOUNT = 1.3; // × amplitude at 2× speed
const SPRINT_PADDLE = 1.4;
const SPEED_SETTLE = 4; // per second: how fast the beats follow a change of speed
const SPEED_MAX = 2.5; // × cruise, clamps a jump (a fish rebuilt elsewhere)
// Turn: the body bends into the curve, the tail trailing the head (seconds of yaw rate turned into a bend, shared
// over the spine by each bone's t)
const TURN_BEND = 0.2;
const TURN_BEND_MAX = math.rad(28);
const TURN_SETTLE = 8;
// Weak (unfed): its slower swim comes from its speed; on top, drooping pectorals and a sagging tail
const WEAK_FIN_DROOP = math.rad(35);
const WEAK_TAIL_SAG = math.rad(15); // in total over the spine
const WEAK_FLUTTER = 0.5; // × dorsal / ventral flutter
const DROOP_SETTLE = 1.5;
// Moments (ROADMAP_V1.1 A6, patch 2), short overlays on the swim, from the fish's local attributes:
//   Feed     Hunger back to Satiated (it just ate): a bite (jaw snap, head jerk), then a happy wiggle
//   Grow     GrowthStage up: fins flare, a slow sweep of the tail
//   Released Exit = "Released": strong fast tail strokes up to the surface
//   Struggle Exit = "Eaten" / "Abducted": a fast, wild wriggle
const BITE_TIME = 0.3;
const BITE_JAW = math.rad(18); // the lower lip only, as ever (CLAUDE.md §7)
const BITE_JERK = math.rad(10); // the head snaps toward the food: a quick bend of the spine
const JOY_TIME = 0.8; // after the bite
const JOY_WIGGLE = 1.3; // × spine peak, at JOY_RATE
const JOY_RATE = 5; // wiggles per second
const GROW_TIME = 1.2;
const GROW_FLARE = math.rad(30); // pectorals lifted, dorsal / ventral flutter × (1 + flare)
const GROW_SWEEP = 0.7; // × spine peak, at GROW_RATE
const GROW_RATE = 2.5;
const RELEASE_BEAT = 3; // × beat rate ...
const RELEASE_AMOUNT = 1.6; // ... and amplitude while it darts out
const STRUGGLE_WIGGLE = 1.5;
const STRUGGLE_RATE = 7;

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

/** A bone this controller turns: its axis (in its own space) and how it moves, plus an optional second rotation. */
interface DrivenBone {
	bone: Bone;
	axis: Vector3;
	drive: (fish: RiggedFish) => number; // angle (radians) at the fish's current phases
	tiltAxis?: Vector3;
	tilt?: (fish: RiggedFish) => number;
}

interface RiggedFish {
	model: Model;
	mesh: MeshPart;
	bones: DrivenBone[];
	yaw: number; // last heading (radians)
	earLean: number; // radians, smoothed
	bend: number; // turn bend over the whole spine (radians), smoothed
	cruise: number; // its species' wandering speed (studs/s)
	lastPosition?: Vector3;
	pace: number; // speed / cruise, smoothed (0 still, 1 cruising, 2 rushing)
	droop: number; // 0 .. 1 while weak, smoothed
	hunger?: unknown; // last Hunger / GrowthStage seen, to catch the moments they change
	stage?: unknown;
	moment?: { kind: "Feed" | "Grow"; start: number };
	wiggle: number; // phase of a moment's extra wiggle (radians)
	wiggleAmount: number; // × spine peak
	bite: number; // 0 .. 1, the jaw snap
	jerk: number; // radians over the spine, the bite's head jerk
	flare: number; // 0 .. 1, fins spread
	swim: number; // phases (radians)
	fin: number;
	mouth: number;
	amount: number; // beat amplitude (× V1's)
	finAmount: number; // pectoral amplitude
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
		// The tanks' fish (built by FishRenderController), the event guests and the companions with a bone rig (the
		// abyss lantern fish, the Swordfish: server models, their bones turned locally like the fish's)
		for (const tag of [TAGS.Fish, TAGS.EventFish, TAGS.Companion]) {
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
				finAmount: 1,
				yaw: 0,
				earLean: 0,
				bend: 0,
				cruise: this.getCruise(model, mesh),
				pace: 1,
				droop: 0,
				hunger: model.GetAttribute("Hunger"),
				stage: model.GetAttribute("GrowthStage"),
				wiggle: 0,
				wiggleAmount: 0,
				bite: 0,
				jerk: 0,
				flare: 0,
				onScreen: true,
				checkedAt: -math.huge,
				lastUpdate: os.clock(),
			});
		});
	}

	/** Its species' wandering speed (FISH_TYPES), the Swordfish's cruise; an event guest: about its length per second. */
	private getCruise(model: Model, mesh: MeshPart): number {
		if (model.GetAttribute("CompanionType") === "Swordfish") return SWORDFISH_CRUISE_SPEED;
		const config = FISH_TYPES[model.GetAttribute("FishType") as FishType] as (typeof FISH_TYPES)[FishType] | undefined;
		if (config) return (config.speedMin + config.speedMax) / 2;
		return math.max(mesh.Size.Z * 0.8, 1);
	}

	/** The bones of the fish rig (tools/blender/rig_fish.py names), with their axis and motion. */
	private findBones(mesh: MeshPart): DrivenBone[] {
		const found = new Array<DrivenBone>();
		const finTop = mesh.FindFirstChild("FinTop", true);
		const finT = finTop?.IsA("Bone") ? boneT(mesh, finTop) : 0.5;
		const bones = mesh.GetDescendants().filter((d): d is Bone => d.IsA("Bone"));
		const spine = bones.filter((b) => isSpine(b.Name));
		// The turn bend and the weak sag are shared over the spine by t: the tail end bends most
		let tSum = 0;
		for (const b of spine) tSum += boneT(mesh, b);
		for (const bone of bones) {
			const name = bone.Name;
			if (isSpine(name)) {
				const t = boneT(mesh, bone);
				const peak = spinePeak(t, spine.size());
				const lag = t * BODY_WAVE;
				const share = tSum > 0 ? t / tSum : 1 / spine.size();
				found.push({
					bone,
					axis: boneAxis(mesh, bone, UP),
					drive: (f) =>
						f.amount * peak * math.sin(f.swim - lag) +
						f.wiggleAmount * peak * math.sin(f.wiggle - lag) +
						(f.bend + f.jerk) * share,
					tiltAxis: boneAxis(mesh, bone, SIDE),
					tilt: (f) => f.droop * WEAK_TAIL_SAG * share,
				});
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
					drive: (f) =>
						sign *
						f.amount *
						(1 - (1 - WEAK_FLUTTER) * f.droop + f.flare) *
						FIN_FLUTTER *
						math.sin(f.swim - lag),
				});
			} else if (name === "FinR" || name === "FinL") {
				const offset = name === "FinR" ? 0 : math.pi; // they paddle alternately
				const sign = name === "FinR" ? 1 : -1;
				found.push({
					bone,
					axis: boneAxis(mesh, bone, UP),
					drive: (f) => sign * f.finAmount * PECTORAL_PADDLE * math.sin(f.fin + offset),
					// weak: the fins hang down (the right one turns down around the length axis, the left one the other way)
					tiltAxis: boneAxis(mesh, bone, LENGTH),
					tilt: (f) => -sign * (f.droop * WEAK_FIN_DROOP - f.flare * GROW_FLARE),
				});
			} else if (name === "Jaw") {
				// Only the lower lip drops a little: nothing ever comes out of the mouth (CLAUDE.md §7)
				found.push({
					bone,
					axis: boneAxis(mesh, bone, SIDE),
					drive: (f) => -(f.amount * JAW_OPEN * math.max(0, math.sin(f.mouth)) ** 2 + f.bite * BITE_JAW),
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
		const mesh = fish.mesh;
		// How fast it really moves, against its species' wandering speed
		const position = mesh.Position;
		if (dt > 0 && fish.lastPosition) {
			const pace = math.min(position.sub(fish.lastPosition).Magnitude / dt / fish.cruise, SPEED_MAX);
			fish.pace += (pace - fish.pace) * math.min(1, dt * SPEED_SETTLE);
		}
		fish.lastPosition = position;
		const calm = math.clamp(1 - fish.pace, 0, 1);
		const rush = math.clamp(fish.pace - 1, 0, 1);
		let beat = 1 - (1 - REST_BEAT) * calm + (SPRINT_BEAT - 1) * rush;
		let amount = 1 - (1 - REST_BEAT) * calm + (SPRINT_AMOUNT - 1) * rush;
		const paddle = 1 - (1 - REST_PADDLE) * calm + (SPRINT_PADDLE - 1) * rush;
		// Asleep (a UFO's mutation): V1's lazy swim, whatever its speed
		if (model.GetAttribute("Asleep") === true) {
			beat = SLOW_SPEED;
			amount = SLOW_AMOUNT;
		}
		// Moments: just fed (back to Satiated), grown a stage; leaving the tank
		const hunger = model.GetAttribute("Hunger");
		if (hunger !== fish.hunger) {
			if (hunger === HungerState.Satiated && fish.hunger !== undefined) fish.moment = { kind: "Feed", start: os.clock() };
			fish.hunger = hunger;
		}
		const stage = model.GetAttribute("GrowthStage");
		if (stage !== fish.stage) {
			if (typeIs(stage, "number") && typeIs(fish.stage, "number") && stage > fish.stage) {
				fish.moment = { kind: "Grow", start: os.clock() };
			}
			fish.stage = stage;
		}
		fish.jerk = 0;
		fish.wiggleAmount = 0;
		fish.bite = 0;
		fish.flare = 0;
		let wiggleRate = 0;
		const exit = model.GetAttribute("Exit");
		if (exit === "Released") {
			beat = RELEASE_BEAT;
			amount = RELEASE_AMOUNT;
		} else if (exit === "Eaten" || exit === "Abducted") {
			fish.wiggleAmount = STRUGGLE_WIGGLE;
			fish.flare = 0.5 * math.abs(math.sin(fish.wiggle));
			wiggleRate = STRUGGLE_RATE;
		} else if (model.GetAttribute("Dead") === true) {
			beat = SLOW_SPEED;
			amount = SLOW_AMOUNT;
		} else if (fish.moment) {
			const t = os.clock() - fish.moment.start;
			if (fish.moment.kind === "Feed") {
				if (t < BITE_TIME) {
					const k = math.sin((t / BITE_TIME) * math.pi);
					fish.bite = k;
					fish.jerk = BITE_JERK * k;
				} else if (t < BITE_TIME + JOY_TIME) {
					fish.wiggleAmount = JOY_WIGGLE * (1 - (t - BITE_TIME) / JOY_TIME);
					wiggleRate = JOY_RATE;
				} else fish.moment = undefined;
			} else if (t < GROW_TIME) {
				const k = math.sin((t / GROW_TIME) * math.pi);
				fish.flare = k;
				fish.wiggleAmount = GROW_SWEEP * k;
				wiggleRate = GROW_RATE;
			} else fish.moment = undefined;
		}
		fish.wiggle = (fish.wiggle + dt * TAU * wiggleRate) % TAU;
		const advance = dt * TAU;
		fish.swim = (fish.swim + advance * SWIM_FREQUENCY * beat) % TAU;
		fish.fin = (fish.fin + advance * FIN_FREQUENCY * math.max(paddle, beat)) % TAU;
		fish.mouth = (fish.mouth + advance * MOUTH_FREQUENCY * beat) % TAU;
		fish.amount = amount;
		fish.finAmount = math.max(amount, REST_PADDLE);
		// Weak with hunger: the fins and tail droop (fading in and out)
		const weak = model.GetAttribute("Hunger") === HungerState.Weak ? 1 : 0;
		fish.droop += (weak - fish.droop) * math.min(1, dt * DROOP_SETTLE);
		// Turns: the body bends into the curve and the ears trail, against the yaw rate (smoothed)
		const [, yaw] = mesh.CFrame.ToOrientation();
		if (dt > 0) {
			let turn = yaw - fish.yaw;
			if (turn > math.pi) turn -= TAU;
			if (turn < -math.pi) turn += TAU;
			const rate = turn / dt;
			const bend = math.clamp(-rate * TURN_BEND, -TURN_BEND_MAX, TURN_BEND_MAX);
			fish.bend += (bend - fish.bend) * math.min(1, dt * TURN_SETTLE);
			const lean = math.clamp(-rate * EAR_TURN, -EAR_TURN_MAX, EAR_TURN_MAX);
			fish.earLean += (lean - fish.earLean) * math.min(1, dt * EAR_SETTLE);
		}
		fish.yaw = yaw;
		for (const driven of fish.bones) {
			let pose = CFrame.fromAxisAngle(driven.axis, driven.drive(fish));
			if (driven.tilt && driven.tiltAxis) {
				const tilt = driven.tilt(fish);
				if (tilt !== 0) pose = pose.mul(CFrame.fromAxisAngle(driven.tiltAxis, tilt));
			}
			driven.bone.Transform = pose;
		}
	}
}

export const FishRigController = new FishRigControllerSingleton();
