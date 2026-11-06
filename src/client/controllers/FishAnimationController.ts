import { Janitor } from "@rbxts/janitor";
import { AssetService, CollectionService, Players, RunService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { HungerState } from "shared/types/fish";
import { FocusController } from "./FocusController";
import { hasBoneRig } from "./FishRigController";

// Each animated mesh is updated every FRAMES_PER_UPDATE frames (≈30 Hz at 60 fps), the
// meshes taking turns so the cost is spread over consecutive frames
const FRAMES_PER_UPDATE = 2;
// Fish of a type share a few animated meshes (cost independent of the fish count); two
// phases keep them from all beating their tails in sync without eating the EditableMesh budget
const SWIM_VARIANTS = 2;
const SLOW_SPEED = 0.45; // weak (unfed) / leaving fish move lazily
// EditableMeshes share a client memory budget counted in triangles (~81k measured on a PC, likely less on a
// phone; when it is full CreateEditableMeshAsync returns nil). The rigs are planned in triangles: the budget starts
// a bit under the PC's and drops to what is already built the first time the device refuses a mesh.
const INITIAL_TRIANGLE_BUDGET = 72_000;
const MIN_TRIANGLE_BUDGET = 10_000;
const DEFAULT_MESH_TRIANGLES = 6_000; // planning guess for a mesh never built (the heaviest are ~8.4k)
// The rig of a fish type no fish uses anymore is freed after RIG_RELEASE_DELAY seconds (at once when another species
// needs its room), and one the budget couldn't fit is tried again every RIG_RETRY_DELAY
const RIG_RELEASE_DELAY = 15;
const RIG_RETRY_DELAY = 10;
// Level of detail (see updateLod): only the tanks the player can see animate their fish
const LOD_INTERVAL = 0.5; // seconds between two choices of what to animate
const MAX_ANIMATED_SPECIES = 6; // CPU cap, on top of the triangle budget
const LOD_DISTANCE = 110; // studs from the camera to a tank center: zoomed out further, nothing swims
const AQUARIUM_CENTER_HEIGHT = 12; // tank center above its pivot (the base)
const AQUARIUM_RADIUS = 30; // the camera is this close: the tank counts as seen whatever the angle
const SCREEN_MARGIN = 300; // px around the screen where a tank center still counts as visible

const SWIM_FREQUENCY = 1.6; // tail beats per second
const FIN_FREQUENCY = 2.4;
const MOUTH_FREQUENCY = 1.1; // "blub" per second

// Deformation amplitudes, relative to the mesh size
const TAIL_AMPLITUDE = 0.09; // lateral sway of the tail tip, × length
const DORSAL_AMPLITUDE = 0.05; // dorsal / ventral fin flutter, × length
const FIN_AMPLITUDE = 0.07; // pectoral fins paddling back and forth, × length
const MOUTH_AMPLITUDE = 0.05; // lips parting, × half height
const BODY_WAVE = 3; // phase lag (radians) of the swim wave from nose to tail tip

// Sway: the cheap swim of a visible fish without a rig (over budget, or its rig still loading): the whole mesh
// yaws around a point near its head and rolls a little, so no fish ever glides frozen
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

/** Companion types whose mesh is a fish (head −Z, tail +Z): animated like the fish. */
const SWIMMING_COMPANIONS = ["Swordfish"];

function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = math.clamp((x - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

/** A vertex that moves, with its rest position and how much each motion affects it. */
interface AnimatedVertex {
	id: number;
	x: number;
	y: number;
	z: number;
	t: number; // 0 at the nose (-Z), 1 at the tail tip (+Z)
	tail: number;
	dorsal: number;
	fin: number; // signed: + right fin, - left fin
	mouth: number; // signed: + upper lip, - lower lip
}

/** One shared animated mesh: every fish using it plays the same motion. */
interface Variant {
	mesh: EditableMesh;
	source: MeshPart; // what fish meshes ApplyMesh from
	triangles: number; // its share of the budget
	vertices: AnimatedVertex[];
	length: number;
	halfHeight: number;
	speed: number;
	updatedAt: number; // os.clock() of the last animation step
	swim: number; // phases (radians)
	fin: number;
	mouth: number;
	users: number;
}

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

interface Rig {
	normal: Variant[];
	/** Built the first time a fish of the type turns weak (most never do); undefined if it couldn't be. */
	slow?: Variant;
	slowTried: boolean;
	/** Bumped each time the rig is used: a pending release only frees an idle rig it saw last. */
	generation: number;
}

/** A fish (or event guest) on screen: animated only while its tank is worth it (see updateLod). */
interface TrackedFish {
	model: Model;
	mesh: MeshPart;
	meshId: string;
	aquarium?: Model; // tank it swims in (tagged Aquarium)
	swimIndex: number; // which normal variant of its rig it plays
	visible: boolean; // in a watched tank (last LOD pass)
	wanted: boolean; // its species was given a rig by the last LOD pass
	rig?: Rig; // attached rig, undefined while showing its static mesh
	current?: Variant;
	attaching: boolean; // a rig build is in flight
	sway?: Sway; // set up the first time it sways (local fish only)
	bones: boolean; // a skinned mesh swimming with its bones (FishRigController): only its beat puffs are done here
	swaying: boolean;
	janitor: Janitor;
}

/** The local weld a swaying fish's mesh hangs from (it replaces the template's WeldConstraint). */
interface Sway {
	weld: Weld;
	rest: CFrame; // the mesh on its body at the model's scale `restScale` (growth rescales the model)
	restScale: number;
	phase: number; // radians
}

/** The tank model a fish swims in. */
function findAquarium(fish: Instance): Model | undefined {
	let ancestor = fish.Parent;
	while (ancestor) {
		if (ancestor.IsA("Model") && CollectionService.HasTag(ancestor, TAGS.Aquarium)) return ancestor;
		ancestor = ancestor.Parent;
	}
	return undefined;
}

/**
 * Procedural swimming: deforms the fish meshes in real time (tail and body wave, fins,
 * mouth) with EditableMesh, keeping their original texture. Purely visual and local:
 * FishRenderController builds and moves the models from the server's swim segments.
 *
 * Level of detail: EditableMeshes share a small memory budget (in triangles) and cost CPU, so only
 * the fish the player can actually see swim this way: in the 2.5D view, those of their own tank;
 * otherwise those of the tanks near the camera and on screen, nearest first, the most common species
 * first, as long as they fit the triangle budget (and MAX_ANIMATED_SPECIES). The other visible fish sway
 * as a whole (see updateSways); the rest keep their static mesh (still moved by FishRenderController).
 * Species converted to bones (template attribute Rig = "Bones") swim in FishRigController instead: here they only
 * puff on the beat.
 */
class FishAnimationControllerSingleton implements Lifecycle {
	private rigs = new Map<string, Rig | "loading">(); // by MeshId
	private failedAt = new Map<string, number>(); // os.clock() of the last failed rig build, by MeshId
	private warned = new Set<string>(); // MeshIds whose failure was already reported
	private triangleBudget = INITIAL_TRIANGLE_BUDGET;
	private meshTriangles = new Map<string, number>(); // by MeshId, known once a variant was built
	private wantedSpecies = new Set<string>(); // MeshIds given a rig by the last LOD pass
	private swaying = new Set<TrackedFish>();
	private building = false; // a rig or a lazy variant is being built (see withBuildLock)
	/** Untouched copy of each mesh, to put a fish back to its static shape when it stops being animated. */
	private staticMeshes = new Map<string, MeshPart>(); // by MeshId
	private variants = new Array<Variant>(); // of every rig
	/** Tracked fish; `false` while a new one's mesh is still streaming in. */
	private fishes = new Map<Instance, TrackedFish | false>();
	private frame = 0;
	private puffTargets = new Map<Model, PuffTarget>();
	private puffAt = -math.huge; // os.clock() of the last beat
	private puffing = false;

	public onInit() {
		CollectionService.GetInstanceAddedSignal(TAGS.Fish).Connect((fish) => this.track(fish));
		CollectionService.GetInstanceRemovedSignal(TAGS.Fish).Connect((fish) => this.untrack(fish));
		for (const fish of CollectionService.GetTagged(TAGS.Fish)) this.track(fish);
		// Event guests (the K-pop idol...) swim and dance the same way
		CollectionService.GetInstanceAddedSignal(TAGS.EventFish).Connect((fish) => this.track(fish));
		CollectionService.GetInstanceRemovedSignal(TAGS.EventFish).Connect((fish) => this.untrack(fish));
		for (const fish of CollectionService.GetTagged(TAGS.EventFish)) this.track(fish);
		// Companions shaped like a fish (the Swordfish) swim like one too
		const trackCompanion = (companion: Instance) => {
			if (SWIMMING_COMPANIONS.includes(companion.GetAttribute("CompanionType") as string)) this.track(companion);
		};
		CollectionService.GetInstanceAddedSignal(TAGS.Companion).Connect(trackCompanion);
		CollectionService.GetInstanceRemovedSignal(TAGS.Companion).Connect((companion) => this.untrack(companion));
		for (const companion of CollectionService.GetTagged(TAGS.Companion)) trackCompanion(companion);
	}

	public onStart() {
		print("[Client] FishAnimationController started.");

		RunService.Heartbeat.Connect((dt) => {
			this.frame += 1;
			const now = os.clock();
			this.variants.forEach((variant, index) => {
				if ((this.frame + index) % FRAMES_PER_UPDATE !== 0) return;
				this.animate(variant, now - variant.updatedAt);
				variant.updatedAt = now;
			});
			this.updateSways(dt);
			this.updatePuffs(now);
		});

		while (true) {
			this.updateLod();
			task.wait(LOD_INTERVAL);
		}
	}

	// ---------------------------------------------------------------------
	// Fish tracking
	// ---------------------------------------------------------------------

	private track(instance: Instance) {
		if (!instance.IsA("Model") || this.fishes.has(instance)) return;
		const model = instance;
		this.fishes.set(model, false);

		task.spawn(() => {
			const mesh = model.WaitForChild("Mesh", 10);
			if (!mesh || !mesh.IsA("MeshPart") || this.fishes.get(model) !== false) return;
			const meshId = mesh.MeshId;
			if (!this.staticMeshes.has(meshId)) {
				const copy = mesh.Clone();
				copy.ClearAllChildren();
				this.staticMeshes.set(meshId, copy);
			}
			const janitor = new Janitor();
			const fish: TrackedFish = {
				model,
				mesh,
				meshId,
				aquarium: findAquarium(model),
				swimIndex: math.random(0, SWIM_VARIANTS - 1),
				visible: false,
				wanted: false,
				attaching: false,
				swaying: false,
				bones: hasBoneRig(model),
				janitor,
			};
			this.fishes.set(model, fish);

			const strength = CollectionService.HasTag(model, TAGS.EventFish) ? GUEST_PUFF : 1;
			this.puffTargets.set(model, { mesh, strength, base: mesh.Size });
			janitor.Add(() => this.puffTargets.delete(model), true);
			janitor.Add(model.GetAttributeChangedSignal("Hunger").Connect(() => this.refreshVariant(fish)));
			janitor.Add(model.GetAttributeChangedSignal("Dead").Connect(() => this.refreshVariant(fish)));
			janitor.Add(model.GetAttributeChangedSignal("Asleep").Connect(() => this.refreshVariant(fish)));
			janitor.Add(() => this.detach(fish, false), true);
			janitor.Add(() => this.swaying.delete(fish), true);
			this.updateLod(); // a fish dropped in the watched tank starts swimming right away
		});
	}

	private untrack(instance: Instance) {
		const fish = this.fishes.get(instance);
		this.fishes.delete(instance);
		if (fish) fish.janitor.Destroy();
	}

	// ---------------------------------------------------------------------
	// Level of detail
	// ---------------------------------------------------------------------

	/** Tanks worth animating, the most important first. */
	private getWatchedAquariums(camera: Camera): Model[] {
		if (FocusController.isFocused()) {
			const own = FocusController.getOwnAquarium();
			return own ? [own] : [];
		}
		const eye = camera.CFrame.Position;
		const viewport = camera.ViewportSize;
		const candidates = new Array<{ aquarium: Model; distance: number }>();
		for (const instance of CollectionService.GetTagged(TAGS.Aquarium)) {
			if (!instance.IsA("Model")) continue;
			const center = instance.GetPivot().Position.add(new Vector3(0, AQUARIUM_CENTER_HEIGHT, 0));
			const distance = center.sub(eye).Magnitude;
			if (distance > LOD_DISTANCE) continue;
			// On screen, with a margin: a tank whose center is just off-screen still shows its fish
			const [point] = camera.WorldToViewportPoint(center);
			const onScreen =
				distance < AQUARIUM_RADIUS ||
				(point.Z > 0 &&
					point.X > -SCREEN_MARGIN &&
					point.X < viewport.X + SCREEN_MARGIN &&
					point.Y > -SCREEN_MARGIN &&
					point.Y < viewport.Y + SCREEN_MARGIN);
			if (onScreen) candidates.push({ aquarium: instance, distance });
		}
		candidates.sort((a, b) => a.distance < b.distance);
		return candidates.map((candidate) => candidate.aquarium);
	}

	/**
	 * Picks the fish to animate (watched tanks, triangle budget) and switches the others to their static mesh; the
	 * visible fish left without a rig sway.
	 */
	private updateLod() {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		const byAquarium = new Map<Model, TrackedFish[]>();
		for (const [, fish] of this.fishes) {
			if (!fish || fish.bones) continue;
			fish.visible = false; // tanks out of sight, or fish outside any tank
			fish.wanted = false;
			if (!fish.aquarium) continue;
			const list = byAquarium.get(fish.aquarium) ?? [];
			list.push(fish);
			byAquarium.set(fish.aquarium, list);
		}

		// Each watched tank in turn, its most common species first, as long as they fit (a lighter one may still fit
		// after a heavy one didn't)
		const species = new Set<string>();
		let planned = 0;
		for (const aquarium of this.getWatchedAquariums(camera)) {
			const list = byAquarium.get(aquarium) ?? [];
			const counts = new Map<string, number>();
			for (const fish of list) counts.set(fish.meshId, (counts.get(fish.meshId) ?? 0) + 1);
			const ranked = new Array<string>();
			for (const [meshId] of counts) ranked.push(meshId);
			// Ties: the species already rigged first, then a fixed order, so the passes don't swap rigs back and forth
			ranked.sort((a, b) => {
				const countA = counts.get(a)!;
				const countB = counts.get(b)!;
				if (countA !== countB) return countA > countB;
				const riggedA = this.rigs.has(a);
				if (riggedA !== this.rigs.has(b)) return riggedA;
				return a < b;
			});
			for (const meshId of ranked) {
				if (species.size() >= MAX_ANIMATED_SPECIES) break;
				if (species.has(meshId)) continue;
				const cost = this.getRigCost(meshId);
				if (planned + cost > this.triangleBudget) continue;
				species.add(meshId);
				planned += cost;
			}
			for (const fish of list) {
				fish.visible = true;
				fish.wanted = species.has(fish.meshId);
			}
		}
		this.wantedSpecies = species;

		// Detach first: the rigs they leave can make room for the new ones
		for (const [, fish] of this.fishes) if (fish && !fish.wanted && fish.rig) this.detach(fish, true);
		for (const [, fish] of this.fishes) {
			if (!fish || fish.bones) continue;
			if (fish.wanted && !fish.rig) this.attach(fish);
			this.setSwaying(fish, fish.visible && !fish.rig);
		}
	}

	/** Triangles a species' rig takes (its normal variants), guessed until one of them was built. */
	private getRigCost(meshId: string): number {
		return (this.meshTriangles.get(meshId) ?? DEFAULT_MESH_TRIANGLES) * SWIM_VARIANTS;
	}

	/** Triangles of every EditableMesh built. */
	private getUsedTriangles(): number {
		let used = 0;
		for (const variant of this.variants) used += variant.triangles;
		return used;
	}

	/** Frees idle rigs of the species the last LOD pass didn't keep until `needed` more triangles fit the budget. */
	private makeRoom(needed: number) {
		let used = this.getUsedTriangles();
		for (const [meshId, rig] of this.rigs) {
			if (used + needed <= this.triangleBudget) return;
			if (rig === "loading" || this.wantedSpecies.has(meshId)) continue;
			const variants = rig.slow ? [...rig.normal, rig.slow] : rig.normal;
			if (variants.some((variant) => variant.users > 0)) continue;
			this.rigs.delete(meshId);
			for (const variant of variants) {
				used -= variant.triangles;
				this.destroyVariant(variant);
			}
		}
	}

	/** The device refused a mesh: the budget becomes what is already built (never less than MIN_TRIANGLE_BUDGET). */
	private onBudgetFull(meshId: string) {
		let budget = math.min(this.triangleBudget, this.getUsedTriangles());
		// Refused again within the budget (the device doesn't count exactly in triangles): one more mesh's worth
		// lower, so the retries settle
		if (budget >= this.triangleBudget)
			budget = this.triangleBudget - (this.meshTriangles.get(meshId) ?? DEFAULT_MESH_TRIANGLES);
		budget = math.max(MIN_TRIANGLE_BUDGET, budget);
		if (budget === this.triangleBudget) return;
		this.triangleBudget = budget;
		Players.LocalPlayer.SetAttribute("SwimTriangleBudget", budget); // local only, a debugging aid
		warn(
			`[Client] Fish animation budget lowered to ${budget} triangles (the device's EditableMesh budget is full)`,
		);
	}

	/** Starts animating a fish (builds its species' rig first if needed, without blocking the LOD pass). */
	private attach(fish: TrackedFish) {
		if (fish.attaching) return;
		fish.attaching = true;
		task.spawn(() => {
			const rig = this.getRig(fish.meshId); // undefined if out of budget: the next passes retry
			fish.attaching = false;
			if (!rig) return;
			if (!fish.wanted || fish.rig || this.fishes.get(fish.model) !== fish) {
				this.scheduleRelease(fish.meshId, rig); // built for nothing: freed if nobody else needs it
				return;
			}
			fish.rig = rig;
			rig.generation += 1;
			fish.model.SetAttribute("Animated", true); // local only, a debugging aid
			this.setSwaying(fish, false);
			this.refreshVariant(fish);
		});
	}

	// ---------------------------------------------------------------------
	// Sway (visible fish without a rig)
	// ---------------------------------------------------------------------

	/** Starts or stops the sway of a fish; the mesh goes back to its rest pose when it stops. */
	private setSwaying(fish: TrackedFish, swaying: boolean) {
		if (swaying === fish.swaying) return;
		if (swaying && !this.setupSway(fish)) return;
		fish.swaying = swaying;
		if (swaying) this.swaying.add(fish);
		else {
			this.swaying.delete(fish);
			const sway = fish.sway;
			if (sway && sway.weld.Parent) sway.weld.C0 = this.getSwayRest(fish, sway);
		}
	}

	/** The mesh's rest pose on its body at the model's current scale. */
	private getSwayRest(fish: TrackedFish, sway: Sway): CFrame {
		const position = sway.rest.Position.mul(fish.model.GetScale() / sway.restScale);
		return new CFrame(position).mul(sway.rest.Rotation);
	}

	/**
	 * Hangs the mesh from a Weld it can sway on, in place of the template's WeldConstraint (once per fish). Only the
	 * fish this client builds (FishRenderController): event guests and companions belong to the server.
	 */
	private setupSway(fish: TrackedFish): boolean {
		if (fish.sway) return true;
		if (!CollectionService.HasTag(fish.model, TAGS.Fish)) return false;
		const body = fish.model.PrimaryPart ?? fish.model.FindFirstChild("Body");
		if (!body || !body.IsA("BasePart")) return false;
		const weld = new Instance("Weld");
		weld.Part0 = body;
		weld.Part1 = fish.mesh;
		weld.C0 = body.CFrame.ToObjectSpace(fish.mesh.CFrame);
		for (const child of fish.mesh.GetChildren()) if (child.IsA("WeldConstraint")) child.Destroy();
		weld.Parent = fish.mesh;
		fish.sway = { weld, rest: weld.C0, restScale: fish.model.GetScale(), phase: math.random() * TAU };
		return true;
	}

	/** Each swaying fish yaws around a point near its head and rolls a little, lazily while weak or asleep, not at all dead. */
	private updateSways(dt: number) {
		for (const fish of this.swaying) {
			const sway = fish.sway!;
			if (!sway.weld.Parent) continue;
			const dead = fish.model.GetAttribute("Dead") === true;
			const weak =
				fish.model.GetAttribute("Hunger") === HungerState.Weak || fish.model.GetAttribute("Asleep") === true;
			const speed = dead ? 0 : weak ? SLOW_SPEED : 1;
			sway.phase = (sway.phase + dt * TAU * SWIM_FREQUENCY * speed) % TAU;
			const amount = dead ? 0 : weak ? 0.6 : 1;
			const pivot = new CFrame(0, 0, -fish.mesh.Size.Z * SWAY_PIVOT);
			const swing = pivot
				.mul(
					CFrame.Angles(
						0,
						SWAY_YAW * amount * math.sin(sway.phase),
						SWAY_ROLL * amount * math.sin(sway.phase - 1.2),
					),
				)
				.mul(pivot.Inverse());
			sway.weld.C0 = this.getSwayRest(fish, sway).mul(swing);
		}
	}

	/** Stops animating a fish; `restore` puts its static mesh back (not needed when it's being removed). */
	private detach(fish: TrackedFish, restore: boolean) {
		const rig = fish.rig;
		if (!rig) return;
		fish.rig = undefined;
		fish.model.SetAttribute("Animated", false);
		if (fish.current) fish.current.users -= 1;
		fish.current = undefined;
		const original = this.staticMeshes.get(fish.meshId);
		if (restore && original && fish.mesh.Parent) this.applyMesh(fish.mesh, original);
		this.scheduleRelease(fish.meshId, rig);
	}

	/** Normal swim, or the lazy one while weak with hunger, asleep (a UFO's mutation) or leaving the tank. */
	private refreshVariant(fish: TrackedFish) {
		const rig = fish.rig;
		if (!rig) return;
		const swimming = rig.normal[fish.swimIndex % rig.normal.size()];
		const isLazy = () =>
			fish.model.GetAttribute("Dead") === true ||
			fish.model.GetAttribute("Asleep") === true ||
			fish.model.GetAttribute("Hunger") === HungerState.Weak;
		if (!isLazy()) return this.use(fish, swimming);
		task.spawn(() => {
			const slow = this.getSlowVariant(fish.meshId, rig);
			// Building it yields: the fish may have been fed, removed or switched to static meanwhile
			if (fish.rig === rig) this.use(fish, isLazy() ? (slow ?? swimming) : swimming);
		});
	}

	private use(fish: TrackedFish, variant: Variant) {
		if (variant === fish.current) return;
		if (fish.current) fish.current.users -= 1;
		fish.current = variant;
		variant.users += 1;
		this.applyMesh(fish.mesh, variant.source);
	}

	/** Swaps the geometry of a fish mesh, keeping its size and texture. */
	private applyMesh(mesh: MeshPart, source: MeshPart) {
		const size = mesh.Size;
		const texture = mesh.TextureID; // cleared by ApplyMesh (a SurfaceAppearance survives it)
		mesh.ApplyMesh(source);
		mesh.Size = size;
		mesh.TextureID = texture;
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

	// ---------------------------------------------------------------------
	// Rigs (built once per fish mesh)
	// ---------------------------------------------------------------------

	/** The rig of a mesh, built on first use; undefined while it can't be built (retried after RIG_RETRY_DELAY). */
	private getRig(meshId: string): Rig | undefined {
		while (this.rigs.get(meshId) === "loading") task.wait();
		const existing = this.rigs.get(meshId);
		if (existing !== undefined) return existing as Rig;
		const failedAt = this.failedAt.get(meshId);
		if (failedAt !== undefined && os.clock() - failedAt < RIG_RETRY_DELAY) return undefined;

		this.rigs.set(meshId, "loading"); // other fish of the species wait for this build
		const [ok, rig] = pcall(() => this.withBuildLock(() => this.buildRig(meshId)));
		if (ok && rig) this.rigs.set(meshId, rig);
		else this.rigs.delete(meshId);
		return ok ? rig : undefined;
	}

	/**
	 * Rigs and lazy variants are built one at a time, room check included: when the device refuses a mesh,
	 * `variants` then holds exactly what it accepted (see onBudgetFull).
	 */
	private withBuildLock<T>(build: () => T): T {
		while (this.building) task.wait();
		this.building = true;
		const [ok, result] = pcall(build);
		this.building = false;
		if (!ok) throw result;
		return result;
	}

	private buildRig(meshId: string): Rig | undefined {
		const cost = this.getRigCost(meshId);
		this.makeRoom(cost);
		if (this.getUsedTriangles() + cost > this.triangleBudget) {
			this.failedAt.set(meshId, os.clock()); // no room right now (rigs still in use): the sway goes on
			return undefined;
		}
		const normal = new Array<Variant>();
		let budgetFull = false;
		const [ok, result] = pcall(() => {
			for (let i = 0; i < SWIM_VARIANTS; i++) {
				const variant = this.createVariant(meshId, 1, (TAU * i) / SWIM_VARIANTS);
				if (!variant) {
					budgetFull = true;
					return;
				}
				normal.push(variant);
			}
		});
		if (!ok || budgetFull) {
			// Out of EditableMesh budget (the sway takes over), or a new mesh still being processed by Roblox: try
			// again later
			if (budgetFull)
				this.onBudgetFull(meshId); // before freeing what the device did accept
			else if (!this.warned.has(meshId)) {
				this.warned.add(meshId);
				warn(`[Client] Fish animation paused for ${meshId} (retried every ${RIG_RETRY_DELAY}s): ${result}`);
			}
			for (const variant of normal) this.destroyVariant(variant);
			this.failedAt.set(meshId, os.clock());
			return undefined;
		}
		this.failedAt.delete(meshId);
		return { normal, slowTried: false, generation: 0 };
	}

	/** The lazy variant of a rig, built on first need; undefined if the budget can't fit it. */
	private getSlowVariant(meshId: string, rig: Rig): Variant | undefined {
		if (rig.slowTried) return rig.slow;
		rig.slowTried = true;
		const [ok, variant] = pcall(() =>
			this.withBuildLock(() => {
				// Optional: only if it fits (the weak fish keep the normal swim otherwise)
				const cost = this.meshTriangles.get(meshId) ?? DEFAULT_MESH_TRIANGLES;
				if (this.getUsedTriangles() + cost > this.triangleBudget) return undefined;
				const created = this.createVariant(meshId, SLOW_SPEED, 0);
				if (!created) this.onBudgetFull(meshId);
				return created;
			}),
		);
		if (!ok || !variant) return undefined;
		if (this.rigs.get(meshId) !== rig) {
			this.destroyVariant(variant); // released meanwhile
			return undefined;
		}
		rig.slow = variant;
		return variant;
	}

	/** Frees the rig once no fish has used it for RIG_RELEASE_DELAY seconds. */
	private scheduleRelease(meshId: string, rig: Rig) {
		const generation = rig.generation;
		task.delay(RIG_RELEASE_DELAY, () => {
			if (this.rigs.get(meshId) !== rig || rig.generation !== generation) return;
			const variants = rig.slow ? [...rig.normal, rig.slow] : rig.normal;
			if (variants.some((variant) => variant.users > 0)) return;
			this.rigs.delete(meshId);
			for (const variant of variants) this.destroyVariant(variant);
		});
	}

	private destroyVariant(variant: Variant) {
		const index = this.variants.indexOf(variant);
		if (index >= 0) this.variants.remove(index);
		variant.mesh.Destroy();
		variant.source.Destroy();
	}

	/** A new animated copy of a mesh, counted in `variants`; undefined when the device's budget is full. */
	private createVariant(meshId: string, speed: number, phase: number): Variant | undefined {
		const mesh = AssetService.CreateEditableMeshAsync(Content.fromUri(meshId), { FixedSize: true }) as
			EditableMesh | undefined;
		if (!mesh) return undefined;
		const triangles = mesh.GetFaces().size();
		this.meshTriangles.set(meshId, triangles);

		const ids = mesh.GetVertices();
		let min = new Vector3(math.huge, math.huge, math.huge);
		let max = min.mul(-1);
		for (const id of ids) {
			const p = mesh.GetPosition(id);
			min = min.Min(p);
			max = max.Max(p);
		}
		const length = max.Z - min.Z;
		const halfWidth = math.max(-min.X, max.X);
		const halfHeight = (max.Y - min.Y) / 2;
		const midY = (min.Y + max.Y) / 2;

		// Weights from the position on the body: no manual rigging needed, works on any fish mesh
		const vertices = new Array<AnimatedVertex>();
		for (const id of ids) {
			const p = mesh.GetPosition(id);
			const t = (p.Z - min.Z) / length;
			const side = p.X / halfWidth; // -1 left .. 1 right
			const height = (p.Y - midY) / halfHeight; // -1 belly .. 1 back

			const tail = smoothstep(0.35, 1, t) ** 1.6;
			const dorsal =
				smoothstep(0.45, 0.9, math.abs(height)) * smoothstep(0.25, 0.4, t) * (1 - smoothstep(0.75, 0.85, t));
			const pectoral =
				smoothstep(0.62, 0.95, math.abs(side)) * smoothstep(0.12, 0.25, t) * (1 - smoothstep(0.5, 0.65, t));
			const lips = (1 - smoothstep(0.02, 0.1, t)) * math.clamp(height * 2, -1, 1);

			if (tail + dorsal + pectoral + math.abs(lips) < 0.001) continue; // never moves
			vertices.push({
				id,
				x: p.X,
				y: p.Y,
				z: p.Z,
				t,
				tail,
				dorsal,
				fin: pectoral * (side >= 0 ? 1 : -1),
				mouth: lips,
			});
		}

		const [ok, source] = pcall(() => AssetService.CreateMeshPartAsync(Content.fromObject(mesh)));
		if (!ok) {
			mesh.Destroy(); // or it would hold its share of the budget for nothing
			throw source;
		}
		const variant: Variant = {
			mesh,
			source,
			triangles,
			vertices,
			length,
			halfHeight,
			speed,
			updatedAt: os.clock(),
			swim: phase,
			fin: phase,
			mouth: phase,
			users: 0,
		};
		this.variants.push(variant); // counted at once: builds run in parallel
		return variant;
	}

	// ---------------------------------------------------------------------
	// Animation
	// ---------------------------------------------------------------------

	private animate(variant: Variant, dt: number) {
		const advance = dt * TAU * variant.speed;
		variant.swim = (variant.swim + advance * SWIM_FREQUENCY) % TAU;
		variant.fin = (variant.fin + advance * FIN_FREQUENCY) % TAU;
		variant.mouth = (variant.mouth + advance * MOUTH_FREQUENCY) % TAU;
		if (variant.users <= 0) return;

		const tailAmplitude = TAIL_AMPLITUDE * variant.length;
		const dorsalAmplitude = DORSAL_AMPLITUDE * variant.length;
		const finAmplitude = FIN_AMPLITUDE * variant.length;
		const mouthOpen = MOUTH_AMPLITUDE * variant.halfHeight * math.max(0, math.sin(variant.mouth)) ** 2;
		const rightFin = finAmplitude * math.sin(variant.fin);
		const leftFin = finAmplitude * math.sin(variant.fin + math.pi); // fins paddle alternately

		const mesh = variant.mesh;
		for (const v of variant.vertices) {
			const wave = variant.swim - v.t * BODY_WAVE;
			const dx = tailAmplitude * v.tail * math.sin(wave) + dorsalAmplitude * v.dorsal * math.sin(wave - 1.2);
			const dz = v.fin > 0 ? v.fin * rightFin : -v.fin * leftFin;
			const dy = v.mouth * mouthOpen;
			mesh.SetPosition(v.id, new Vector3(v.x + dx, v.y + dy, v.z + dz));
		}
	}
}

export const FishAnimationController = new FishAnimationControllerSingleton();
