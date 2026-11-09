import { Janitor } from "@rbxts/janitor";
import { CollectionService, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { HungerState } from "shared/types/fish";
import { hasBoneRig } from "./FishRigController";

// Sway: the fallback swim of a fish whose template has no bone rig (since V1.1 every species has one): the whole mesh
// yaws around a point near its head and rolls a little, on a local Weld
const SWIM_FREQUENCY = 1.6; // sways per second (V1's tail beats)
const SLOW_SPEED = 0.45; // weak (unfed) / asleep fish sway lazily ...
const SLOW_AMOUNT = 0.6; // ... and less
const SWAY_YAW = math.rad(7);
const SWAY_ROLL = math.rad(3);
const SWAY_PIVOT = 0.3; // × length, ahead of the mesh center

// Beat puff of music events (see pulse): the fish swells, mostly in girth, then deflates
const PUFF_UP_TIME = 0.07;
const PUFF_DOWN_TIME = 0.3;
const PUFF_GIRTH = 0.22; // × width and height at the peak
const PUFF_LENGTH = 0.06; // × length
const GUEST_PUFF = 1.4; // the event's star dances harder

const TAU = math.pi * 2;

/** Companion types whose mesh is a fish (head −Z, tail +Z): they puff on the beat like the fish. */
const SWIMMING_COMPANIONS = ["Swordfish"];

/** Mesh puffed on the beat, with its size outside of a puff (the server may resize it to grow the fish). */
interface PuffTarget {
	mesh: MeshPart;
	strength: number;
	base: Vector3;
	applied?: Vector3; // size set by the last puff frame, undefined at rest
	stretch?: Vector3; // the puff in `applied` (× base), to take it back out of a size someone else scaled
}

/** 0 at rest, quick swell to 1, slower deflate back to 0. */
function puffEnvelope(t: number): number {
	if (t < 0 || t >= PUFF_UP_TIME + PUFF_DOWN_TIME) return 0;
	if (t < PUFF_UP_TIME) return math.sin(((t / PUFF_UP_TIME) * math.pi) / 2);
	return (1 - (t - PUFF_UP_TIME) / PUFF_DOWN_TIME) ** 2;
}

/** The local weld a swaying fish's mesh hangs from (it replaces the template's WeldConstraint). */
interface Sway {
	model: Model;
	mesh: MeshPart;
	weld: Weld;
	rest: CFrame; // the mesh on its body at the model's scale `restScale` (growth rescales the model)
	restScale: number;
	phase: number; // radians
}

/**
 * What is left of V1's fish animation now that every species swims with bones (FishRigController):
 * - the beat puff of the music events, for every fish, event guest and fish-shaped companion;
 * - a fallback for a template without a bone rig (warned once in the output): a local fish sways as a whole; an event
 *   guest without bones (a server model) only puffs.
 * Purely visual and local: FishRenderController builds and moves the models from the server's swim segments.
 */
class FishAnimationControllerSingleton implements Lifecycle {
	private puffTargets = new Map<Model, PuffTarget>();
	private puffAt = -math.huge; // os.clock() of the last beat
	private puffing = false;
	private sways = new Map<Model, Sway>();
	private tracked = new Set<Instance>();
	private warned = new Set<string>(); // MeshIds already reported without a bone rig

	public onInit() {
		for (const tag of [TAGS.Fish, TAGS.EventFish]) {
			CollectionService.GetInstanceAddedSignal(tag).Connect((fish) => this.track(fish));
			for (const fish of CollectionService.GetTagged(tag)) this.track(fish);
		}
		const trackCompanion = (companion: Instance) => {
			if (SWIMMING_COMPANIONS.includes(companion.GetAttribute("CompanionType") as string)) this.track(companion);
		};
		CollectionService.GetInstanceAddedSignal(TAGS.Companion).Connect(trackCompanion);
		for (const companion of CollectionService.GetTagged(TAGS.Companion)) trackCompanion(companion);
	}

	public onStart() {
		print("[Client] FishAnimationController started.");
		RunService.Heartbeat.Connect((dt) => {
			this.updateSways(dt);
			this.updatePuffs(os.clock());
		});
	}

	private track(instance: Instance) {
		if (!instance.IsA("Model") || this.tracked.has(instance)) return;
		const model = instance;
		this.tracked.add(model);
		task.spawn(() => {
			const mesh = model.WaitForChild("Mesh", 10);
			if (!mesh || !mesh.IsA("MeshPart") || !model.Parent) {
				this.tracked.delete(model);
				return;
			}
			const janitor = new Janitor();
			janitor.Add(() => {
				this.tracked.delete(model);
				this.puffTargets.delete(model);
				this.sways.delete(model);
			}, true);
			janitor.Add(
				model.AncestryChanged.Connect(() => {
					if (!model.IsDescendantOf(game)) janitor.Destroy();
				}),
			);
			const strength = CollectionService.HasTag(model, TAGS.EventFish) ? GUEST_PUFF : 1;
			this.puffTargets.set(model, { mesh, strength, base: mesh.Size });
			if (!hasBoneRig(model)) this.startSway(model, mesh);
		});
	}

	// ---------------------------------------------------------------------
	// Sway (a template without a bone rig)
	// ---------------------------------------------------------------------

	/**
	 * Warns once per mesh, then hangs the mesh from a Weld it can sway on, in place of the template's WeldConstraint.
	 * Only the fish this client builds (FishRenderController): event guests and companions belong to the server.
	 */
	private startSway(model: Model, mesh: MeshPart) {
		if (!this.warned.has(mesh.MeshId)) {
			this.warned.add(mesh.MeshId);
			warn(`[Client] ${model.Name} has no bone rig (template attribute Rig = "Bones"): it won't swim.`);
		}
		if (!CollectionService.HasTag(model, TAGS.Fish)) return;
		const body = model.PrimaryPart ?? model.FindFirstChild("Body");
		if (!body || !body.IsA("BasePart")) return;
		const weld = new Instance("Weld");
		weld.Part0 = body;
		weld.Part1 = mesh;
		weld.C0 = body.CFrame.ToObjectSpace(mesh.CFrame);
		for (const child of mesh.GetChildren()) if (child.IsA("WeldConstraint")) child.Destroy();
		weld.Parent = mesh;
		this.sways.set(model, { model, mesh, weld, rest: weld.C0, restScale: model.GetScale(), phase: math.random() * TAU });
	}

	/** Each swaying fish yaws around a point near its head and rolls a little, lazily while weak or asleep, not at all dead. */
	private updateSways(dt: number) {
		for (const [, sway] of this.sways) {
			if (!sway.weld.Parent) continue;
			const model = sway.model;
			const dead = model.GetAttribute("Dead") === true;
			const weak = model.GetAttribute("Hunger") === HungerState.Weak || model.GetAttribute("Asleep") === true;
			sway.phase = (sway.phase + dt * TAU * SWIM_FREQUENCY * (dead ? 0 : weak ? SLOW_SPEED : 1)) % TAU;
			const amount = dead ? 0 : weak ? SLOW_AMOUNT : 1;
			const pivot = new CFrame(0, 0, -sway.mesh.Size.Z * SWAY_PIVOT);
			const swing = pivot
				.mul(CFrame.Angles(0, SWAY_YAW * amount * math.sin(sway.phase), SWAY_ROLL * amount * math.sin(sway.phase - 1.2)))
				.mul(pivot.Inverse());
			const rest = new CFrame(sway.rest.Position.mul(model.GetScale() / sway.restScale)).mul(sway.rest.Rotation);
			sway.weld.C0 = rest.mul(swing);
		}
	}

	// ---------------------------------------------------------------------
	// Beat puff (music events)
	// ---------------------------------------------------------------------

	/** Every fish puffs up and deflates, on a beat of the music (see MusicEventController). */
	public pulse() {
		this.puffAt = os.clock();
	}

	private updatePuffs(now: number) {
		const envelope = puffEnvelope(now - this.puffAt);
		if (envelope <= 0 && !this.puffing) return;
		this.puffing = envelope > 0;

		for (const [fish, target] of this.puffTargets) {
			const mesh = target.mesh;
			// Size changed by someone else (growth, the alien fish's scream, or first frame): new rest size. Those use
			// Model.ScaleTo, which scales the puffed size: take the puff back out, or it would add up frame after frame
			if (target.applied === undefined || mesh.Size !== target.applied) {
				target.base = target.applied !== undefined && target.stretch ? mesh.Size.div(target.stretch) : mesh.Size;
			}
			if (!this.puffing) {
				mesh.Size = target.base;
				target.applied = undefined;
				target.stretch = undefined;
				continue;
			}
			const amount = fish.GetAttribute("Dead") === true ? 0 : envelope * target.strength;
			const girth = 1 + PUFF_GIRTH * amount;
			target.stretch = new Vector3(girth, girth, 1 + PUFF_LENGTH * amount);
			mesh.Size = target.base.mul(target.stretch);
			target.applied = mesh.Size;
		}
	}
}

export const FishAnimationController = new FishAnimationControllerSingleton();
