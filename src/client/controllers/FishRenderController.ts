import { CollectionService, RunService, TweenService, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { FishMessage, FishView, getRemoteEvent } from "shared/network";
import { getSwimPose, SwimSegment } from "shared/swim";
import { TAGS } from "shared/tags";
import { getGrowthStages, HungerState } from "shared/types/fish";
import { FishEffect } from "shared/types/ufo";
import { UFO_COLORS } from "client/ui/theme";
import { applyVariantLook, cloneFishTemplate, hasVariantLook, onFishAssetAdded } from "client/fishLook";
import { FocusController } from "./FocusController";
import { getWorldLabelScale } from "client/ui/screenScale";

// Which tanks this client renders (and receives): its own in the 2.5D view, else the near ones
const WATCH_INTERVAL = 0.5;
const WATCH_DISTANCE = 160; // studs from the camera to a tank center, in the lobby
const AQUARIUM_CENTER_HEIGHT = 12; // tank center above its pivot (the base)

const BLEND_TIME = 0.2; // a new segment arrives a bit late: the fish joins it smoothly instead of jumping
const GROW_TIME = 1.5; // smooth growth from one stage to the next
const WEAK_COLOR = Color3.fromRGB(105, 110, 95); // unfed fish turn dull
const WEAK_TINT = 0.75;
const TINT_TIME = 0.8;
const AURA_TINT = 0.45; // a fish under a UFO's green / red mutation takes on that colour
const EATEN_TIME = 0.35; // sucked into the predator's mouth
const RELEASE_TIME = 1.4; // darts up through the surface, back to the ocean
const ABDUCTED_TIME = 0.35; // already up in the beam: shrinks into the UFO
const SCREAM_TIME = 1.1; // the alien fish's scream wave spreads through the tank
const SCREAM_SIZE = 40; // studs across at its widest
/**
 * A fish whose model hasn't arrived waits (server/fishAssets replicates a species on demand); after this long
 * without its variant's texture it is built in its normal look rather than not at all.
 */
const VARIANT_LOOK_WAIT = 5;

const isMessage = t.interface({ kind: t.string });

/** A SurfaceAppearance of the fish mesh, tinted to show hunger (MeshPart.Color doesn't tint textures). */
interface TintTarget {
	appearance: SurfaceAppearance;
	baseColor: Color3;
}

interface LocalFish {
	view: FishView;
	model: Model;
	body: BasePart; // anchored root, head toward -Z; the mesh is welded to it
	tints: TintTarget[];
	segment: SwimSegment;
	/**
	 * A new segment arrives a bit late: the gap between the pose shown then and the new segment
	 * fades out over BLEND_TIME while the fish already moves at the new segment's speed.
	 */
	blendOffset?: Vector3;
	blendRotation?: CFrame; // orientation shown when the current segment arrived
	blendStart: number;
	leaving: boolean; // playing its exit (eaten / released): no longer follows segments
	/** A UFO's mutation shown on the fish (aura or sleep bubble), destroyed with it or when it ends. */
	effectLook?: Instance[];
}

function smooth(alpha: number): number {
	return alpha * alpha * (3 - 2 * alpha);
}

/**
 * Builds and moves the fish models locally. The server only sends what changes for the tanks this
 * client watches (FishMessage: spawn, swim segments, state, removal); every frame the pose is
 * computed from the segment on the shared clock. Nothing here affects the game: coins, eating,
 * hunger and money are all decided by the server, which never trusts a position from a client.
 */
class FishRenderControllerSingleton implements Lifecycle {
	private fishRemote = getRemoteEvent("FishSync");
	private actionRemote = getRemoteEvent("RequestAction");
	private fishes = new Map<number, LocalFish>();
	/** Fish heard of whose model (or variant texture) hasn't arrived yet, kept up to date, and since when. */
	private pending = new Map<number, { view: FishView; since: number }>();
	private watched = new Set<number>();
	private watchKey = "";

	public onInit() {
		this.fishRemote.OnClientEvent.Connect((message: unknown) => {
			if (isMessage(message)) this.onMessage(message as FishMessage);
		});
		onFishAssetAdded(() => this.buildPending());
	}

	public onStart() {
		print("[Client] FishRenderController started.");

		RunService.Heartbeat.Connect(() => this.render());
		while (true) {
			this.updateWatch();
			this.buildPending(); // the ones that waited too long for a variant texture
			task.wait(WATCH_INTERVAL);
		}
	}

	// ---------------------------------------------------------------------
	// Watched tanks
	// ---------------------------------------------------------------------

	private getAquariums(): Model[] {
		return CollectionService.GetTagged(TAGS.Aquarium).filter((instance): instance is Model =>
			instance.IsA("Model"),
		);
	}

	private getPlot(aquarium: Model): number | undefined {
		const plot = aquarium.GetAttribute("PlotIndex");
		return typeIs(plot, "number") ? plot : undefined;
	}

	private updateWatch() {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		const plots = new Array<number>();
		if (FocusController.isFocused()) {
			const own = FocusController.getOwnAquarium();
			const plot = own && this.getPlot(own);
			if (plot !== undefined) plots.push(plot);
		} else {
			const eye = camera.CFrame.Position;
			for (const aquarium of this.getAquariums()) {
				const plot = this.getPlot(aquarium);
				const center = aquarium.GetPivot().Position.add(new Vector3(0, AQUARIUM_CENTER_HEIGHT, 0));
				if (plot !== undefined && center.sub(eye).Magnitude <= WATCH_DISTANCE) plots.push(plot);
			}
		}
		plots.sort((a, b) => a < b);
		const key = plots.join(",");
		if (key === this.watchKey) return;
		this.watchKey = key;

		this.watched = new Set(plots);
		// Tanks out of sight: drop their fish now (the server stops sending them)
		for (const [id, fish] of this.fishes) {
			if (!this.watched.has(fish.view.plot)) this.destroy(id);
		}
		for (const [id, entry] of this.pending) {
			if (!this.watched.has(entry.view.plot)) this.pending.delete(id);
		}
		this.actionRemote.FireServer("WatchAquariums", plots);
	}

	// ---------------------------------------------------------------------
	// Server messages
	// ---------------------------------------------------------------------

	private onMessage(message: FishMessage) {
		if (message.kind === "Tank") {
			if (!this.watched.has(message.plot)) return;
			for (const [id, fish] of this.fishes) {
				if (fish.view.plot === message.plot && !fish.leaving) this.destroy(id);
			}
			for (const [id, entry] of this.pending) {
				if (entry.view.plot === message.plot) this.pending.delete(id);
			}
			for (const view of message.fish) this.create(view);
		} else if (message.kind === "Spawn") {
			if (this.watched.has(message.fish.plot)) this.create(message.fish);
		} else if (message.kind === "Swim") {
			const waiting = this.pending.get(message.id);
			if (waiting) waiting.view.segment = message.segment;
			const fish = this.fishes.get(message.id);
			if (!fish || fish.leaving) return;
			// Where the old movement puts the fish right now (not last frame's pose: the fish would
			// stand still for a frame), blended into the new segment
			const time = Workspace.GetServerTimeNow();
			const clock = os.clock();
			const current = this.getPose(fish, time, clock);
			fish.segment = message.segment;
			fish.blendOffset = current.Position.sub(getSwimPose(fish.segment, time).Position);
			fish.blendRotation = current.Rotation;
			fish.blendStart = clock;
		} else if (message.kind === "State") {
			const waiting = this.pending.get(message.id);
			if (waiting) {
				waiting.view.hunger = message.hunger;
				waiting.view.growthStage = message.growthStage;
				waiting.view.paused = message.paused;
				waiting.view.effect = message.effect;
			}
			const fish = this.fishes.get(message.id);
			if (fish) {
				this.applyState(fish, message.hunger, message.growthStage, message.paused);
				this.applyEffect(fish, message.effect);
			}
		} else if (message.kind === "Remove") {
			this.pending.delete(message.id);
			const fish = this.fishes.get(message.id);
			if (!fish) return;
			if (message.cause === "Gone") this.destroy(message.id);
			else this.playExit(fish, message.cause, message.by);
		} else if (message.kind === "Scream") {
			const fish = this.fishes.get(message.id);
			if (fish && !fish.leaving) this.playScream(fish);
		}
	}

	// ---------------------------------------------------------------------
	// Models
	// ---------------------------------------------------------------------

	private getFolder(plot: number): Instance | undefined {
		const aquarium = this.getAquariums().find((model) => this.getPlot(model) === plot);
		return aquarium?.FindFirstChild("Fish") ?? aquarium;
	}

	/** Builds the fish waiting for their model, now that something arrived (or their wait is over). */
	private buildPending() {
		for (const [, entry] of this.pending) this.create(entry.view);
	}

	private create(view: FishView) {
		const existing = this.fishes.get(view.id);
		if (existing) return;
		const folder = this.getFolder(view.plot);
		if (!folder) return;
		// The model (and a rare variant's texture) may still be on its way: the fish waits for it
		const since = this.pending.get(view.id)?.since ?? os.clock();
		const lookReady = hasVariantLook(view.fishType, view.variant) || os.clock() - since > VARIANT_LOOK_WAIT;
		const model = lookReady ? cloneFishTemplate(view.fishType) : undefined;
		if (!model) {
			this.pending.set(view.id, { view, since });
			return;
		}
		this.pending.delete(view.id);

		model.Name = `${view.fishType}Fish_${view.id}`;
		model.ScaleTo(view.scale * getGrowthStages(view.fishType)[view.growthStage].size);
		const body = model.PrimaryPart!;
		applyVariantLook(model, view.fishType, view.variant);
		const tints = new Array<TintTarget>();
		for (const descendant of model.GetDescendants()) {
			if (descendant.IsA("SurfaceAppearance"))
				tints.push({ appearance: descendant, baseColor: descendant.Color });
		}
		const fish: LocalFish = {
			view,
			model,
			body,
			tints,
			segment: view.segment,
			blendStart: 0,
			leaving: false,
		};
		model.PivotTo(getSwimPose(view.segment, Workspace.GetServerTimeNow()));
		model.SetAttribute("FishId", view.id);
		model.SetAttribute("FishType", view.fishType);
		model.SetAttribute("Variant", view.variant);
		model.SetAttribute("Hunger", view.hunger);
		model.SetAttribute("GrowthStage", view.growthStage);
		model.SetAttribute("Paused", view.paused);
		this.tint(fish, view.hunger, 0);
		this.applyEffect(fish, view.effect);
		model.Parent = folder;
		CollectionService.AddTag(model, TAGS.Fish); // animation, hunger badges and beat puffs pick it up
		this.fishes.set(view.id, fish);
	}

	private destroy(id: number) {
		const fish = this.fishes.get(id);
		this.fishes.delete(id);
		fish?.model.Destroy();
	}

	private applyState(fish: LocalFish, hunger: HungerState, growthStage: number, paused: boolean) {
		const view = fish.view;
		if (view.hunger !== hunger) this.tint(fish, hunger, TINT_TIME);
		const grown = view.growthStage !== growthStage;
		view.hunger = hunger;
		view.growthStage = growthStage;
		view.paused = paused;
		// After the new stage is stored: grow's loop runs while the fish is at that stage (it stopped at once before,
		// so fish only showed their size once rebuilt, e.g. back from a UFO)
		if (grown) this.grow(fish, growthStage);
		fish.model.SetAttribute("Hunger", hunger);
		fish.model.SetAttribute("GrowthStage", growthStage);
		fish.model.SetAttribute("Paused", paused);
	}

	/**
	 * A UFO's mutation: a green or red aura (sparkles and a glow) or a sleep bubble ("z Z z") over a fish fast
	 * asleep (attribute "Asleep": FishAnimationController lets it idle).
	 */
	private applyEffect(fish: LocalFish, effect: FishEffect | undefined) {
		if (fish.view.effect === effect && (effect === undefined || fish.effectLook)) return;
		fish.view.effect = effect;
		for (const look of fish.effectLook ?? []) look.Destroy();
		fish.effectLook = undefined;
		fish.model.SetAttribute("Asleep", effect === "Sleep" ? true : undefined);
		this.tint(fish, fish.view.hunger, TINT_TIME);
		if (effect === "Green" || effect === "Red") fish.effectLook = this.makeAura(fish, effect);
		else if (effect === "Sleep") fish.effectLook = [this.makeSleepBubble(fish)];
	}

	/** Sparkles out of the fish's body (its invisible root, sized to the fish) and a soft glow (and its tint, see tint). */
	private makeAura(fish: LocalFish, effect: "Green" | "Red"): Instance[] {
		const color = effect === "Green" ? UFO_COLORS.auraGreen : UFO_COLORS.auraRed;
		const size = fish.body.Size;
		const sparkles = new Instance("ParticleEmitter");
		sparkles.Name = "UfoAura";
		sparkles.Texture = "rbxasset://textures/particles/sparkles_main.dds";
		sparkles.Color = new ColorSequence(color);
		sparkles.LightEmission = 1;
		sparkles.LightInfluence = 0;
		sparkles.Size = new NumberSequence([
			new NumberSequenceKeypoint(0, 0),
			new NumberSequenceKeypoint(0.3, math.max(0.3 * math.max(size.X, size.Y, size.Z), 0.8)),
			new NumberSequenceKeypoint(1, 0),
		]);
		sparkles.Transparency = new NumberSequence(0.2, 1);
		sparkles.Lifetime = new NumberRange(0.6, 1);
		sparkles.Rate = 20;
		sparkles.Speed = new NumberRange(0.4, 1);
		sparkles.SpreadAngle = new Vector2(180, 180);
		sparkles.Shape = Enum.ParticleEmitterShape.Box;
		sparkles.ShapeInOut = Enum.ParticleEmitterShapeInOut.Outward;
		sparkles.Parent = fish.body;
		const glow = new Instance("PointLight");
		glow.Name = "UfoAuraGlow";
		glow.Color = color;
		glow.Range = math.max(size.Z * 1.6, 3);
		glow.Brightness = 2;
		glow.Parent = fish.body;
		return [sparkles, glow];
	}

	private makeSleepBubble(fish: LocalFish): Instance {
		const bubble = new Instance("BillboardGui");
		bubble.Name = "UfoSleep";
		const labelScale = getWorldLabelScale();
		bubble.Size = UDim2.fromOffset(60 * labelScale, 32 * labelScale);
		bubble.StudsOffsetWorldSpace = new Vector3(0, fish.body.Size.Y / 2 + 0.8, 0);
		bubble.LightInfluence = 0;
		bubble.AlwaysOnTop = false;
		// Like the hunger badges: the 2.5D camera stands ~133 studs back during a UFO night (its headroom), farther
		// than a distance limit of 120 (the bubble only showed once the event ended)
		bubble.MaxDistance = math.huge;
		const label = new Instance("TextLabel");
		label.BackgroundTransparency = 1;
		label.Size = UDim2.fromScale(1, 1);
		label.Font = Enum.Font.FredokaOne;
		label.Text = "z Z z";
		label.TextScaled = true;
		label.TextColor3 = UFO_COLORS.sleep;
		label.TextStrokeTransparency = 0.4;
		label.Parent = bubble;
		bubble.Adornee = fish.body;
		bubble.Parent = fish.body;
		// The z's bob gently
		task.spawn(() => {
			const start = os.clock();
			while (bubble.Parent) {
				const t = os.clock() - start;
				label.Position = UDim2.fromOffset(0, math.sin(t * 2.2) * 4);
				label.Rotation = math.sin(t * 1.3) * 8;
				task.wait();
			}
		});
		return bubble;
	}

	/** The alien fish screams: a green wave swells from it through the tank. */
	private playScream(fish: LocalFish) {
		const wave = new Instance("Part");
		wave.Name = "AlienScream";
		wave.Shape = Enum.PartType.Ball;
		wave.Anchored = true;
		wave.CanCollide = false;
		wave.CanQuery = false;
		wave.CanTouch = false;
		wave.CastShadow = false;
		wave.Material = Enum.Material.ForceField;
		wave.Color = UFO_COLORS.auraGreen;
		wave.Transparency = 0;
		wave.Size = Vector3.one;
		wave.Position = fish.body.Position;
		wave.Parent = fish.model.Parent;
		const info = new TweenInfo(SCREAM_TIME, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
		TweenService.Create(wave, info, { Size: Vector3.one.mul(SCREAM_SIZE), Transparency: 1 }).Play();
		// The alien fish puffs up while it screams
		const scale = fish.model.GetScale();
		const puff = new TweenInfo(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out, 1, true);
		const value = new Instance("NumberValue");
		value.Value = scale;
		value.Changed.Connect((v) => {
			if (fish.model.Parent) fish.model.ScaleTo(v);
		});
		TweenService.Create(value, puff, { Value: scale * 1.3 }).Play();
		task.delay(SCREAM_TIME, () => {
			wave.Destroy();
			value.Destroy();
		});
	}

	private tint(fish: LocalFish, hunger: HungerState, time: number) {
		const weak = hunger === HungerState.Weak;
		const effect = fish.view.effect;
		const aura = effect === "Green" ? UFO_COLORS.auraGreen : effect === "Red" ? UFO_COLORS.auraRed : undefined;
		for (const { appearance, baseColor } of fish.tints) {
			const fed = weak ? baseColor.Lerp(WEAK_COLOR, WEAK_TINT) : baseColor;
			const color = aura ? fed.Lerp(aura, AURA_TINT) : fed;
			if (time <= 0) appearance.Color = color;
			else TweenService.Create(appearance, new TweenInfo(time), { Color: color }).Play();
		}
	}

	/** Smoothly scales the model up to its new growth stage. */
	private grow(fish: LocalFish, stage: number) {
		const from = fish.model.GetScale();
		const to = fish.view.scale * getGrowthStages(fish.view.fishType)[stage].size;
		task.spawn(() => {
			const start = os.clock();
			while (fish.model.Parent && fish.view.growthStage === stage) {
				const alpha = math.min((os.clock() - start) / GROW_TIME, 1);
				const eased = TweenService.GetValue(alpha, Enum.EasingStyle.Back, Enum.EasingDirection.Out);
				fish.model.ScaleTo(from + (to - from) * eased);
				if (alpha >= 1) break;
				task.wait();
			}
		});
	}

	// ---------------------------------------------------------------------
	// Movement
	// ---------------------------------------------------------------------

	/** Pose of a fish at `time` (server clock): its segment, plus what remains of the blend into it. */
	private getPose(fish: LocalFish, time: number, clock: number): CFrame {
		const pose = getSwimPose(fish.segment, time);
		if (!fish.blendOffset || !fish.blendRotation) return pose;
		const alpha = (clock - fish.blendStart) / BLEND_TIME;
		if (alpha >= 1) {
			fish.blendOffset = undefined;
			fish.blendRotation = undefined;
			return pose;
		}
		const k = smooth(alpha);
		return fish.blendRotation.Lerp(pose.Rotation, k).add(pose.Position.add(fish.blendOffset.mul(1 - k)));
	}

	private render() {
		const time = Workspace.GetServerTimeNow();
		const clock = os.clock();
		const parts = new Array<BasePart>();
		const poses = new Array<CFrame>();
		for (const [, fish] of this.fishes) {
			if (fish.leaving) continue;
			parts.push(fish.body);
			poses.push(this.getPose(fish, time, clock));
		}
		if (parts.size() > 0) Workspace.BulkMoveTo(parts, poses, Enum.BulkMoveMode.FireCFrameChanged);
	}

	/** Exit of a fish leaving the tank (the server already removed it from the game). */
	private playExit(fish: LocalFish, cause: "Eaten" | "Released" | "Abducted", predatorId?: number) {
		fish.leaving = true;
		fish.model.SetAttribute("Dead", true);
		for (const look of fish.effectLook ?? []) look.Destroy();
		const body = fish.body;
		let goal: CFrame;
		let time: number;
		if (cause === "Eaten") {
			const predator = predatorId !== undefined ? this.fishes.get(predatorId) : undefined;
			const mouth = predator
				? predator.body.CFrame.PointToWorldSpace(new Vector3(0, 0, -predator.body.Size.Z / 2))
				: body.Position;
			goal = body.CFrame.Rotation.add(mouth);
			time = EATEN_TIME;
		} else if (cause === "Abducted") {
			// Already up in the beam, right under the UFO: sucked in, spinning
			goal = body.CFrame.add(new Vector3(0, 1.2, 0)).mul(CFrame.Angles(0, math.pi, 0));
			time = ABDUCTED_TIME;
		} else {
			// Nose up, slightly forward (a straight-up lookAt has no stable roll), out through the surface
			const water = this.getWaterTop(fish.view.plot) ?? body.Position.Y + 8;
			const exit = new Vector3(body.Position.X, water + body.Size.Z, body.Position.Z);
			const forward = body.CFrame.LookVector.mul(new Vector3(1, 0, 1)).mul(2);
			goal = CFrame.lookAt(exit, exit.add(forward).add(exit.sub(body.Position)));
			time = RELEASE_TIME;
		}
		const info = new TweenInfo(time, Enum.EasingStyle.Quad, Enum.EasingDirection.In);
		TweenService.Create(body, info, { CFrame: goal }).Play();
		const fade = new TweenInfo(time * 0.5, Enum.EasingStyle.Linear, Enum.EasingDirection.In, 0, false, time * 0.5);
		for (const descendant of fish.model.GetDescendants()) {
			if (descendant.IsA("BasePart") && descendant !== body) {
				TweenService.Create(descendant, fade, { Transparency: 1 }).Play();
			}
		}
		task.delay(time, () => this.destroy(fish.view.id));
	}

	private getWaterTop(plot: number): number | undefined {
		const aquarium = this.getAquariums().find((model) => this.getPlot(model) === plot);
		if (!aquarium) return undefined;
		for (const water of CollectionService.GetTagged(TAGS.AquariumWater)) {
			if (water.IsA("BasePart") && water.IsDescendantOf(aquarium)) return water.Position.Y + water.Size.Y / 2;
		}
		return undefined;
	}
}

export const FishRenderController = new FishRenderControllerSingleton();
