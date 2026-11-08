import { CollectionService, RunService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import {
	HERMIT_CRAB_STROLL_SPEED,
	PELICAN_LEAN,
	SNAIL_STROLL_SPEED,
	SWORDFISH_CRUISE_SPEED,
} from "shared/types/companions";
import { FISH_TYPES, FishType, HungerState } from "shared/types/fish";

/**
 * Template attribute of a fish whose `Mesh` is a skinned mesh made in Blender (tools/blender/rig_fish.py): it swims
 * with its bones here; FishAnimationController only adds its beat puffs.
 */
export const RIG_ATTRIBUTE = "Rig";
export const BONES_RIG = "Bones";

export function hasBoneRig(model: Instance): boolean {
	return model.GetAttribute(RIG_ATTRIBUTE) === BONES_RIG;
}

// V1's rhythm, approved by the owner on the Blender preview (tools/blender/preview_swim.py)
const SWIM_FREQUENCY = 1.6; // tail beats per second
const FIN_FREQUENCY = 2.4;
const MOUTH_FREQUENCY = 1.1;
const BODY_WAVE = 3; // radians of lag from nose to tail tip
const SLOW_SPEED = 0.45; // asleep (a UFO's mutation) or leaving: lazy beats
const SLOW_AMOUNT = 0.6; // ... and smaller ones

// Behaviours (V1.1), from what the fish does on screen, compared with its species' wandering speed (the
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
// Moments (V1.1), short overlays on the swim, from the fish's local attributes:
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

// The Jellyfish companion (tools/blender/rig_jellyfish.py: Bell, Rim<side>, Tent<side><1..3>), V1's rhythm
// (V1's): the rim swings in from a pivot near the dome's top, the tentacles trail behind, the
// whole jellyfish rises a little with each squeeze and sways slowly
const JELLY_PULSE_FREQUENCY = 0.8; // pulses per second
const JELLY_RIM_SQUEEZE = math.rad(12);
const JELLY_TENTACLE_TRAIL = math.rad(14);
const JELLY_TENTACLE_LAG = 0.9; // radians per chain bone
const JELLY_BOB = 0.15; // studs at its template's height (4.6)
const JELLY_SWAY = math.rad(5);
const JELLY_SWAY_RATE = 0.25; // × the pulse
// The Snail companion (tools/blender/rig_snail.py: Foot, Shell, SnailHead, SnailTail, EyeL, EyeR): as it crawls, its
// head reaches forward and the back of its foot follows (the body stretches and gathers), its shell rocks a little;
// its eye stalks sway all the time. The crawl follows its pace (still at rest, faster when it fetches a coin).
const SNAIL_CRAWL_FREQUENCY = 0.8; // stretches per second at its strolling speed
const SNAIL_STRETCH = 0.06; // × its length
const SNAIL_TAIL_LAG = 1.4; // radians: the tail gathers after the head has reached
const SNAIL_SHELL_ROCK = math.rad(3);
const SNAIL_EYE_SWAY = math.rad(12);
const SNAIL_EYE_FREQUENCY = 0.6;
const SNAIL_EYE_TILT_RATE = 1.3; // × the sway: the two stalk motions never line up
// The birds (tools/blender/rig_boxes.py, design/rigs/Pelican.json / WaterHen.json: Torso the root, Head, WingL/R,
// TailFan; the Pelican also has Neck, Beak, LegL/R). Their Body is moved by the server, the bones only add life.
// Pelican, on its perch: breathes, nods, ruffles its wings and flicks its tail; when it leans over the water to throw
// (the server tilts its Body by PELICAN_LEAN), its neck reaches, its whole beak dips and its wings open.
const BIRD_BREATH_FREQUENCY = 0.5; // per second
const BIRD_NOD_FREQUENCY = 0.85; // head nods and tail flicks
const BIRD_RUFFLE_FREQUENCY = 1.1; // wings
const PELICAN_NECK_BREATH = math.rad(3);
const PELICAN_HEAD_NOD = math.rad(4);
const PELICAN_WING_RUFFLE = math.rad(4);
const PELICAN_TAIL_FLICK = math.rad(6);
const PELICAN_LEAN_NECK = math.rad(14); // at a full lean
const PELICAN_LEAN_BEAK = math.rad(14);
const PELICAN_LEAN_WINGS = math.rad(25);
const PELICAN_LEAN_SETTLE = 12; // per second
// Water Hen, on the water (V1's numbers, now on its Torso bone): rocks from side to side
// and nods while it floats, faster and wider while it paddles; its head bobs, its wings ruffle, its tail flicks
const HEN_ROCK_FREQUENCY = 0.9; // rocks per second at rest
const HEN_PADDLE_FREQUENCY = 2.2; // waddles per second while paddling
const HEN_ROCK_ANGLE = math.rad(5); // roll at rest
const HEN_PADDLE_ANGLE = math.rad(9); // roll while paddling
const HEN_NOD_ANGLE = math.rad(4); // the body leans forward a little with each paddle
const HEN_BOB = 0.06; // studs: a small extra bob on top of the server's
const HEN_MOVING_SPEED = 0.4; // studs/s on the flat: faster than this, it is paddling
const HEN_BLEND_RATE = 4; // per second: eases between resting and paddling
const HEN_HEAD_NOD = math.rad(6);
const HEN_WING_RUFFLE = math.rad(3); // at rest, + HEN_WING_PADDLE while paddling
const HEN_WING_PADDLE = math.rad(5);
const HEN_TAIL_FLICK = math.rad(10);
// The Pegasus Seahorse (V1.2, design/rigs/PegasusSeahorse.json, a box rig: Torso the root, Head, WingL/R, Curl): it
// swims upright, so no spine wave: its body rocks and bobs, its head nods, its small wings flap (on the pectoral
// beat), its curled tail sways on the swim beat; weak, its wings hang
const SEAHORSE_ROCK = math.rad(4);
const SEAHORSE_BOB = 0.04; // × its height
const SEAHORSE_HEAD_NOD = math.rad(5);
const SEAHORSE_WING_FLAP = math.rad(30);
const SEAHORSE_WING_SWEEP = math.rad(10);
const SEAHORSE_WING_RATE = 2; // × the pectoral phase (a whole number: the phase wraps at 2π without a jump)
const SEAHORSE_WING_DROOP = math.rad(25);
const SEAHORSE_CURL_SWAY = math.rad(10);
// The Hermit Crab companion (V1.2, design/rigs/HermitCrab.json, a box rig: Torso the root, Head, ClawL/R, LegsL/R):
// as it strolls (the Snail's crawl phase, at its pace), its legs shuffle in turn; its head nods and its claws pinch
// gently all the time, always low (CLAUDE.md §7: never raised). Its shell never moves (the owner's rule): it is on
// the root, which nothing turns
const CRAB_LEG_SHUFFLE = math.rad(12);
const CRAB_HEAD_NOD = math.rad(4);
const CRAB_CLAW_PINCH = math.rad(9);
// Side letter of a rim / tentacle bone -> its direction from the axis, in mesh space (front -Z, right +X)
const JELLY_SIDES: Record<string, Vector3> = {
	F: new Vector3(0, 0, -1),
	B: new Vector3(0, 0, 1),
	L: new Vector3(-1, 0, 0),
	R: new Vector3(1, 0, 0),
};

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
	offset?: (fish: RiggedFish) => Vector3; // a translation (bone space), for the Jellyfish's bob
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
	pulse: number; // the Jellyfish's pulse and sway phases (radians)
	sway: number;
	crawl: number; // the Snail's crawl and eye phases (radians), and how much it crawls (0 still .. 1)
	eyes: number;
	eyeTilt: number; // a phase of its own: derived from `eyes` (× 1.3), it jumped each time `eyes` wrapped
	crawlAmount: number;
	breath: number; // the birds' phases (radians): breathing / rocking, nodding, wings
	nod: number;
	ruffle: number;
	paddle: number; // the Water Hen: 0 floating .. 1 paddling, eased
	lean: number; // the Pelican: 0 upright .. 1 leaning over the water to throw, smoothed
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
 * Bone swimming (V1.1): the fish whose template says `Rig = "Bones"` swim by turning the bones of their
 * skinned mesh (a spine wave, fins, mouth), each fish at its own phase. The GPU deforms the mesh: no EditableMesh, no
 * memory budget, every species on screen swims. Purely visual and local; FishAnimationController adds the beat puffs.
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
			const bones = this.findBones(mesh, model.GetAttribute("CompanionType"), model.GetAttribute("FishType"));
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
				pulse: math.random() * TAU,
				sway: math.random() * TAU,
				crawl: math.random() * TAU,
				eyes: math.random() * TAU,
				eyeTilt: math.random() * TAU,
				crawlAmount: 0,
				breath: math.random() * TAU,
				nod: math.random() * TAU,
				ruffle: math.random() * TAU,
				paddle: 0,
				lean: 0,
				onScreen: true,
				checkedAt: -math.huge,
				lastUpdate: os.clock(),
			});
		});
	}

	/** Its species' wandering speed (FISH_TYPES), the Swordfish's cruise; an event guest: about its length per second. */
	private getCruise(model: Model, mesh: MeshPart): number {
		const companion = model.GetAttribute("CompanionType");
		if (companion === "Swordfish") return SWORDFISH_CRUISE_SPEED;
		if (companion === "Snail") return SNAIL_STROLL_SPEED;
		if (companion === "HermitCrab") return HERMIT_CRAB_STROLL_SPEED;
		const config = FISH_TYPES[model.GetAttribute("FishType") as FishType] as (typeof FISH_TYPES)[FishType] | undefined;
		if (config) return (config.speedMin + config.speedMax) / 2;
		return math.max(mesh.Size.Z * 0.8, 1);
	}

	/** The bones of the fish rig (tools/blender/rig_fish.py names), with their axis and motion. */
	private findBones(mesh: MeshPart, companion: unknown, fishType: unknown): DrivenBone[] {
		if (companion === "Pelican" || companion === "WaterHen") return this.findBirdBones(mesh, companion);
		if (companion === "HermitCrab") return this.findCrabBones(mesh);
		if (mesh.FindFirstChild("Curl", true)?.IsA("Bone")) return this.findSeahorseBones(mesh);
		// A whale (FishConfig.stroke "Vertical"): its spine wave beats up and down, its turns still bend it sideways
		const config = FISH_TYPES[fishType as FishType] as (typeof FISH_TYPES)[FishType] | undefined;
		const vertical = config?.stroke === "Vertical";
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
				const wave = (f: RiggedFish) =>
					f.amount * peak * math.sin(f.swim - lag) + f.wiggleAmount * peak * math.sin(f.wiggle - lag);
				found.push(
					vertical
						? {
								bone,
								axis: boneAxis(mesh, bone, SIDE),
								drive: (f) => wave(f) + f.droop * WEAK_TAIL_SAG * share,
								tiltAxis: boneAxis(mesh, bone, UP),
								tilt: (f) => (f.bend + f.jerk) * share,
							}
						: {
								bone,
								axis: boneAxis(mesh, bone, UP),
								drive: (f) => wave(f) + (f.bend + f.jerk) * share,
								tiltAxis: boneAxis(mesh, bone, SIDE),
								tilt: (f) => f.droop * WEAK_TAIL_SAG * share,
							},
				);
			} else if (name === "Bell") {
				// the root: the whole jellyfish rises with each squeeze and sways slowly
				const up = boneAxis(mesh, bone, UP);
				const bob = (JELLY_BOB * mesh.Size.Y) / 4.6;
				found.push({
					bone,
					axis: boneAxis(mesh, bone, LENGTH),
					drive: (f) => JELLY_SWAY * math.sin(f.sway),
					offset: (f) => up.mul(bob * 0.5 * (1 + math.sin(f.pulse))),
				});
			} else if (name.sub(1, 3) === "Rim" && JELLY_SIDES[name.sub(4, 4)]) {
				const tangent = UP.Cross(JELLY_SIDES[name.sub(4, 4)]);
				found.push({
					bone,
					axis: boneAxis(mesh, bone, tangent),
					drive: (f) => -JELLY_RIM_SQUEEZE * 0.5 * (1 + math.sin(f.pulse)),
				});
			} else if (name.sub(1, 4) === "Tent" && JELLY_SIDES[name.sub(5, 5)]) {
				const tangent = UP.Cross(JELLY_SIDES[name.sub(5, 5)]);
				const lag = (tonumber(name.sub(6, 6)) ?? 1) * JELLY_TENTACLE_LAG;
				found.push({
					bone,
					axis: boneAxis(mesh, bone, tangent),
					drive: (f) => JELLY_TENTACLE_TRAIL * math.sin(f.pulse - lag),
				});
			} else if (name === "SnailHead" || name === "SnailTail") {
				// reaching forward (the head), then gathering after it (the back of the foot)
				const forward = boneAxis(mesh, bone, LENGTH.mul(-1));
				const reach = SNAIL_STRETCH * mesh.Size.Z;
				const lag = name === "SnailTail" ? SNAIL_TAIL_LAG : 0;
				found.push({
					bone,
					axis: forward,
					drive: () => 0,
					offset: (f) => forward.mul(f.crawlAmount * reach * 0.5 * (1 + math.sin(f.crawl - lag))),
				});
			} else if (name === "Shell") {
				found.push({
					bone,
					axis: boneAxis(mesh, bone, LENGTH),
					drive: (f) => f.crawlAmount * SNAIL_SHELL_ROCK * math.sin(f.crawl),
				});
			} else if (name === "EyeL" || name === "EyeR") {
				const lag = name === "EyeL" ? 0 : 1.3;
				found.push({
					bone,
					axis: boneAxis(mesh, bone, SIDE),
					drive: (f) => SNAIL_EYE_SWAY * math.sin(f.eyes - lag),
					tiltAxis: boneAxis(mesh, bone, LENGTH),
					tilt: (f) => 0.5 * SNAIL_EYE_SWAY * math.sin(f.eyeTilt + lag),
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

	/** The Hermit Crab's bones (tools/blender/rig_boxes.py, design/rigs/HermitCrab.json). */
	private findCrabBones(mesh: MeshPart): DrivenBone[] {
		const found = new Array<DrivenBone>();
		for (const bone of mesh.GetDescendants()) {
			if (!bone.IsA("Bone")) continue;
			const name = bone.Name;
			if (name === "LegsL" || name === "LegsR") {
				const offset = name === "LegsR" ? math.pi : 0; // one side then the other
				found.push({
					bone,
					axis: boneAxis(mesh, bone, LENGTH),
					drive: (f) => f.crawlAmount * CRAB_LEG_SHUFFLE * math.sin(f.crawl * 2 + offset),
				});
			} else if (name === "Head") {
				found.push({ bone, axis: boneAxis(mesh, bone, SIDE), drive: (f) => CRAB_HEAD_NOD * math.sin(f.nod) });
			} else if (name === "ClawL" || name === "ClawR") {
				const sign = name === "ClawR" ? -1 : 1;
				const lag = name === "ClawR" ? 1.2 : 0;
				// a small turn around the vertical: the claw opens and closes sideways, it never lifts
				found.push({
					bone,
					axis: boneAxis(mesh, bone, UP),
					drive: (f) => sign * CRAB_CLAW_PINCH * math.sin(f.eyes * 2 - lag),
				});
			}
		}
		return found;
	}

	/** The Pegasus Seahorse's bones (tools/blender/rig_boxes.py, design/rigs/PegasusSeahorse.json). */
	private findSeahorseBones(mesh: MeshPart): DrivenBone[] {
		const found = new Array<DrivenBone>();
		for (const bone of mesh.GetDescendants()) {
			if (!bone.IsA("Bone")) continue;
			const name = bone.Name;
			if (name === "Torso") {
				const up = boneAxis(mesh, bone, UP);
				const bob = SEAHORSE_BOB * mesh.Size.Y;
				found.push({
					bone,
					axis: boneAxis(mesh, bone, SIDE),
					drive: (f) => SEAHORSE_ROCK * math.sin(f.breath),
					offset: (f) => up.mul(bob * math.sin(f.breath * 2)),
				});
			} else if (name === "Head") {
				found.push({
					bone,
					axis: boneAxis(mesh, bone, SIDE),
					drive: (f) => SEAHORSE_HEAD_NOD * (math.sin(f.nod) + f.bite),
				});
			} else if (name === "WingL" || name === "WingR") {
				const sign = name === "WingR" ? 1 : -1;
				found.push({
					bone,
					axis: boneAxis(mesh, bone, LENGTH),
					drive: (f) =>
						sign *
						(f.finAmount * (1 + f.flare) * SEAHORSE_WING_FLAP * math.sin(f.fin * SEAHORSE_WING_RATE) -
							f.droop * SEAHORSE_WING_DROOP),
					tiltAxis: boneAxis(mesh, bone, UP),
					tilt: (f) => sign * f.finAmount * SEAHORSE_WING_SWEEP * math.sin(f.fin * SEAHORSE_WING_RATE - 1.2),
				});
			} else if (name === "Curl") {
				found.push({
					bone,
					axis: boneAxis(mesh, bone, SIDE),
					drive: (f) =>
						f.amount * SEAHORSE_CURL_SWAY * math.sin(f.swim - 1.5) +
						f.wiggleAmount * SEAHORSE_CURL_SWAY * math.sin(f.wiggle),
					tiltAxis: boneAxis(mesh, bone, UP),
					tilt: (f) => f.bend * 0.5,
				});
			}
		}
		return found;
	}

	/** The birds' bones (tools/blender/rig_boxes.py, design/rigs/Pelican.json / WaterHen.json). */
	private findBirdBones(mesh: MeshPart, companion: "Pelican" | "WaterHen"): DrivenBone[] {
		const found = new Array<DrivenBone>();
		const pelican = companion === "Pelican";
		for (const bone of mesh.GetDescendants()) {
			if (!bone.IsA("Bone")) continue;
			const name = bone.Name;
			// Mesh-local axes: a negative turn around SIDE leans the front (−Z) down; around LENGTH, + lifts the right
			if (name === "Torso" && !pelican) {
				const up = boneAxis(mesh, bone, UP);
				found.push({
					bone,
					axis: boneAxis(mesh, bone, LENGTH),
					drive: (f) => math.sin(f.breath) * (HEN_ROCK_ANGLE + (HEN_PADDLE_ANGLE - HEN_ROCK_ANGLE) * f.paddle),
					tiltAxis: boneAxis(mesh, bone, SIDE),
					tilt: (f) => -math.abs(math.sin(f.breath)) * HEN_NOD_ANGLE * f.paddle,
					offset: (f) => up.mul(HEN_BOB * math.sin(f.breath * 2)),
				});
			} else if (name === "Neck") {
				found.push({
					bone,
					axis: boneAxis(mesh, bone, SIDE),
					drive: (f) => PELICAN_NECK_BREATH * math.sin(f.breath) - PELICAN_LEAN_NECK * f.lean,
				});
			} else if (name === "Head") {
				const nod = pelican ? PELICAN_HEAD_NOD : HEN_HEAD_NOD;
				found.push({ bone, axis: boneAxis(mesh, bone, SIDE), drive: (f) => nod * math.sin(f.nod) });
			} else if (name === "Beak") {
				found.push({ bone, axis: boneAxis(mesh, bone, SIDE), drive: (f) => -PELICAN_LEAN_BEAK * f.lean });
			} else if (name === "WingL" || name === "WingR") {
				const sign = name === "WingR" ? 1 : -1;
				found.push({
					bone,
					axis: boneAxis(mesh, bone, LENGTH),
					drive: pelican
						? (f) => sign * (PELICAN_WING_RUFFLE * math.sin(f.ruffle) + PELICAN_LEAN_WINGS * f.lean)
						: (f) => sign * (HEN_WING_RUFFLE + HEN_WING_PADDLE * f.paddle) * math.sin(f.ruffle),
				});
			} else if (name === "TailFan") {
				const flick = pelican ? PELICAN_TAIL_FLICK : HEN_TAIL_FLICK;
				found.push({ bone, axis: boneAxis(mesh, bone, SIDE), drive: (f) => flick * math.sin(f.nod - 1.5) });
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
		// The Water Hen paddles when it moves on the flat (the server bobs it up and down as it floats)
		if (dt > 0 && fish.lastPosition) {
			const flat = position.sub(fish.lastPosition);
			const target = new Vector3(flat.X, 0, flat.Z).Magnitude / dt > HEN_MOVING_SPEED ? 1 : 0;
			fish.paddle += (target - fish.paddle) * math.min(1, dt * HEN_BLEND_RATE);
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
		fish.pulse = (fish.pulse + dt * TAU * JELLY_PULSE_FREQUENCY) % TAU;
		fish.crawl = (fish.crawl + dt * TAU * SNAIL_CRAWL_FREQUENCY * math.min(fish.pace, 3)) % TAU;
		fish.crawlAmount = math.min(fish.pace, 1);
		fish.eyes = (fish.eyes + dt * TAU * SNAIL_EYE_FREQUENCY) % TAU;
		fish.eyeTilt = (fish.eyeTilt + dt * TAU * SNAIL_EYE_FREQUENCY * SNAIL_EYE_TILT_RATE) % TAU;
		// The birds: the Water Hen rocks faster while it paddles; the Pelican's lean is its Body's forward tilt
		const rock = HEN_ROCK_FREQUENCY + (HEN_PADDLE_FREQUENCY - HEN_ROCK_FREQUENCY) * fish.paddle;
		const hen = model.GetAttribute("CompanionType") === "WaterHen";
		fish.breath = (fish.breath + dt * TAU * (hen ? rock : BIRD_BREATH_FREQUENCY)) % TAU;
		fish.nod = (fish.nod + dt * TAU * BIRD_NOD_FREQUENCY) % TAU;
		fish.ruffle = (fish.ruffle + dt * TAU * BIRD_RUFFLE_FREQUENCY * (1 + fish.paddle)) % TAU;
		const body = model.FindFirstChild("Body");
		const look = (body?.IsA("BasePart") ? body : mesh).CFrame.LookVector;
		const lean = math.clamp(-look.Y / math.sin(PELICAN_LEAN), 0, 1);
		fish.lean += (lean - fish.lean) * math.min(1, dt * PELICAN_LEAN_SETTLE);
		fish.sway = (fish.sway + dt * TAU * JELLY_PULSE_FREQUENCY * JELLY_SWAY_RATE) % TAU;
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
			if (driven.offset) pose = new CFrame(driven.offset(fish)).mul(pose);
			driven.bone.Transform = pose;
		}
	}
}

export const FishRigController = new FishRigControllerSingleton();
