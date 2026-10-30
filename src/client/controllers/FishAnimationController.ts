import { Janitor } from "@rbxts/janitor";
import { AssetService, CollectionService, RunService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { HungerState } from "shared/types/fish";
import { FocusController } from "./FocusController";

// Each animated mesh is updated every FRAMES_PER_UPDATE frames (≈30 Hz at 60 fps), the
// meshes taking turns so the cost is spread over consecutive frames
const FRAMES_PER_UPDATE = 2;
// Fish of a type share a few animated meshes (cost independent of the fish count); two
// phases keep them from all beating their tails in sync without eating the EditableMesh budget
const SWIM_VARIANTS = 2;
const SLOW_SPEED = 0.45; // weak (unfed) / leaving fish move lazily
// EditableMeshes share a memory budget: the rig of a fish type no fish uses anymore is freed after
// RIG_RELEASE_DELAY seconds, and one the budget couldn't fit is tried again every RIG_RETRY_DELAY
const RIG_RELEASE_DELAY = 15;
const RIG_RETRY_DELAY = 10;
// Level of detail (see updateLod): only the tanks the player can see animate their fish
const LOD_INTERVAL = 0.5; // seconds between two choices of what to animate
const MAX_ANIMATED_SPECIES = 6; // x SWIM_VARIANTS EditableMeshes (+ lazy ones for weak fish)
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

// Beat puff of music events (see pulse): the fish swells, mostly in girth, then deflates
const PUFF_UP_TIME = 0.07;
const PUFF_DOWN_TIME = 0.3;
const PUFF_GIRTH = 0.22; // × width and height at the peak
const PUFF_LENGTH = 0.06; // × length
const GUEST_PUFF = 1.4; // the event's star dances harder

const TAU = math.pi * 2;

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
	wanted: boolean; // chosen by the last LOD pass
	rig?: Rig; // attached rig, undefined while showing its static mesh
	current?: Variant;
	attaching: boolean; // a rig build is in flight
	janitor: Janitor;
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
 * Level of detail: EditableMeshes share a small memory budget and cost CPU, so only the
 * fish the player can actually see swim this way: in the 2.5D view, those of their own tank;
 * otherwise those of the tanks near the camera and on screen, nearest first, up to
 * MAX_ANIMATED_SPECIES species. The others keep their static mesh (still moved by FishRenderController).
 */
class FishAnimationControllerSingleton implements Lifecycle {
	private rigs = new Map<string, Rig | "loading">(); // by MeshId
	private failedAt = new Map<string, number>(); // os.clock() of the last failed rig build, by MeshId
	private warned = new Set<string>(); // MeshIds whose failure was already reported
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
	}

	public onStart() {
		print("[Client] FishAnimationController started.");

		RunService.Heartbeat.Connect(() => {
			this.frame += 1;
			const now = os.clock();
			this.variants.forEach((variant, index) => {
				if ((this.frame + index) % FRAMES_PER_UPDATE !== 0) return;
				this.animate(variant, now - variant.updatedAt);
				variant.updatedAt = now;
			});
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
				wanted: false,
				attaching: false,
				janitor,
			};
			this.fishes.set(model, fish);

			const strength = CollectionService.HasTag(model, TAGS.EventFish) ? GUEST_PUFF : 1;
			this.puffTargets.set(model, { mesh, strength, base: mesh.Size });
			janitor.Add(() => this.puffTargets.delete(model), true);
			janitor.Add(model.GetAttributeChangedSignal("Hunger").Connect(() => this.refreshVariant(fish)));
			janitor.Add(model.GetAttributeChangedSignal("Dead").Connect(() => this.refreshVariant(fish)));
			janitor.Add(() => this.detach(fish, false), true);
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

	/** Picks the fish to animate (watched tanks, species budget) and switches the others to their static mesh. */
	private updateLod() {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		const byAquarium = new Map<Model, TrackedFish[]>();
		for (const [, fish] of this.fishes) {
			if (!fish) continue;
			fish.wanted = false; // tanks out of sight, or fish outside any tank
			if (!fish.aquarium) continue;
			const list = byAquarium.get(fish.aquarium) ?? [];
			list.push(fish);
			byAquarium.set(fish.aquarium, list);
		}

		// Species budget: each watched tank in turn, its most common species first
		const species = new Set<string>();
		for (const aquarium of this.getWatchedAquariums(camera)) {
			const list = byAquarium.get(aquarium) ?? [];
			const counts = new Map<string, number>();
			for (const fish of list) counts.set(fish.meshId, (counts.get(fish.meshId) ?? 0) + 1);
			const ranked = new Array<string>();
			for (const [meshId] of counts) ranked.push(meshId);
			ranked.sort((a, b) => counts.get(a)! > counts.get(b)!);
			for (const meshId of ranked) {
				if (species.size() >= MAX_ANIMATED_SPECIES) break;
				species.add(meshId);
			}
			for (const fish of list) fish.wanted = species.has(fish.meshId);
		}

		for (const [, fish] of this.fishes) {
			if (!fish) continue;
			if (fish.wanted && !fish.rig) this.attach(fish);
			else if (!fish.wanted && fish.rig) this.detach(fish, true);
		}
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
			this.refreshVariant(fish);
		});
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

	/** Normal swim, or the lazy one while weak with hunger / leaving the tank. */
	private refreshVariant(fish: TrackedFish) {
		const rig = fish.rig;
		if (!rig) return;
		const swimming = rig.normal[fish.swimIndex % rig.normal.size()];
		const isLazy = () =>
			fish.model.GetAttribute("Dead") === true || fish.model.GetAttribute("Hunger") === HungerState.Weak;
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
			// Size changed by someone else (the server growing the fish, or first frame): new rest size
			if (target.applied === undefined || mesh.Size !== target.applied) target.base = mesh.Size;
			if (!this.puffing) {
				mesh.Size = target.base;
				target.applied = undefined;
				continue;
			}
			const amount = fish.GetAttribute("Dead") === true ? 0 : envelope * target.strength;
			const girth = 1 + PUFF_GIRTH * amount;
			mesh.Size = target.base.mul(new Vector3(girth, girth, 1 + PUFF_LENGTH * amount));
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

		this.rigs.set(meshId, "loading");
		const normal = new Array<Variant>();
		const [ok, result] = pcall(() => {
			for (let i = 0; i < SWIM_VARIANTS; i++)
				normal.push(this.createVariant(meshId, 1, (TAU * i) / SWIM_VARIANTS));
		});
		if (!ok) {
			// Out of EditableMesh budget, or a new mesh still being processed by Roblox: try again later
			for (const variant of normal) this.destroyVariant(variant);
			if (!this.warned.has(meshId)) {
				this.warned.add(meshId);
				warn(`[Client] Fish animation paused for ${meshId} (retried every ${RIG_RETRY_DELAY}s): ${result}`);
			}
			this.rigs.delete(meshId);
			this.failedAt.set(meshId, os.clock());
			return undefined;
		}
		this.failedAt.delete(meshId);
		const rig: Rig = { normal, slowTried: false, generation: 0 };
		this.rigs.set(meshId, rig);
		for (const variant of normal) this.variants.push(variant);
		return rig;
	}

	/** The lazy variant of a rig, built on first need; undefined if the budget can't fit it. */
	private getSlowVariant(meshId: string, rig: Rig): Variant | undefined {
		if (rig.slowTried) return rig.slow;
		rig.slowTried = true;
		const [ok, variant] = pcall(() => this.createVariant(meshId, SLOW_SPEED, 0));
		if (!ok) return undefined;
		if (this.rigs.get(meshId) !== rig) {
			this.destroyVariant(variant); // released meanwhile
			return undefined;
		}
		rig.slow = variant;
		this.variants.push(variant);
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

	private createVariant(meshId: string, speed: number, phase: number): Variant {
		const mesh = AssetService.CreateEditableMeshAsync(Content.fromUri(meshId), { FixedSize: true });

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

		const source = AssetService.CreateMeshPartAsync(Content.fromObject(mesh));
		return {
			mesh,
			source,
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
