import { Janitor } from "@rbxts/janitor";
import { CollectionService, Lighting, RunService, TweenService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { getAquariumFrame } from "shared/types/aquarium";
import { ActiveEvent } from "shared/types/events";
import { UFO_BEAM_ATTRIBUTE } from "shared/types/ufo";
import { UFO_COLORS } from "client/ui/theme";
import { MusicEventController } from "./MusicEventController";

// The world going dark (local Lighting changes, put back when the night ends): a violet night
const DARKEN_TIME = 2.5;
const BRIGHTEN_TIME = 2.5;
const NIGHT_CLOCK = 24.5; // ClockTime the day runs to (past midnight), through the sunset
const NIGHT_BRIGHTNESS = 0.5;
const NIGHT_EXPOSURE = -0.35;
const NIGHT_AMBIENT = Color3.fromRGB(26, 16, 48);
const NIGHT_OUTDOOR_AMBIENT = Color3.fromRGB(30, 22, 62);
const NIGHT_ATMOSPHERE = Color3.fromRGB(40, 24, 80);
const NIGHT_DECAY = Color3.fromRGB(14, 10, 40);
const GRADE_TINT = Color3.fromRGB(200, 185, 255);
const GRADE_SATURATION = 0.05;
const GRADE_CONTRAST = 0.1;

// Space backdrop, laid just in front of each tank's Backdrop (behind the decor)
const BACKDROP_GAP = 0.06; // studs in front of the Backdrop's face
const BACKDROP_PIXELS_PER_STUD = 20;
const STAR_COUNT = 46;
const NEBULA_COUNT = 3;
// Green searchlights sweeping over each tank, and a faint green light in the water
const SPOT_COUNT = 2;
const SPOT_HEIGHT = 16; // studs above the water's surface
const SPOT_BRIGHTNESS = 10;
const SPOT_RANGE = 48;
const SPOT_ANGLE = 26;
const SHAFT_TOP_WIDTH = 1.2; // the searchlight's visible shaft of light, down to the sand
const SHAFT_BOTTOM_WIDTH = 9;
const SHAFT_TRANSPARENCY = 0.82;
const SPOT_SWEEP = math.rad(28); // swing each side of straight down
const SPOT_PERIOD = 7; // seconds of a full swing
const TANK_LIGHT_BRIGHTNESS = 1;
const TANK_LIGHT_RANGE = 28;

// A UFO's tractor beam (camera-facing ribbons from under the UFO down through the water)
const BEAM_FADE_TIME = 0.35;
const BEAM_TOP_WIDTH = 1.4;
const BEAM_BOTTOM_WIDTH = 6;
const BEAM_LIGHT_BRIGHTNESS = 4;
const BEAM_LIGHT_RANGE = 18;
const UFO_LIGHT_BRIGHTNESS = 1.5; // its own soft glow, always on
const SPARKLE_TEXTURE = "rbxasset://textures/particles/sparkles_main.dds";

interface SavedLighting {
	clockTime: number;
	brightness: number;
	exposure: number;
	ambient: Color3;
	outdoorAmbient: Color3;
	atmosphere?: { instance: Atmosphere; color: Color3; decay: Color3 };
}

interface Twinkle {
	frame: GuiObject;
	phase: number;
	speed: number;
	base: number; // its transparency at full night (0 = solid)
}

interface Spot {
	part: BasePart;
	light: SpotLight;
	origin: CFrame;
	phase: number;
	shaft: Beam;
	floor: Attachment; // where the shaft meets the sand (moved with the sweep)
	floorY: number;
}

interface TankDressing {
	janitor: Janitor;
	water?: { part: BasePart; color: Color3 }; // its own colour, put back after the night
	fills: { frame: GuiObject; base: number }[]; // sky, nebulas and planets: fade with the darkness
	twinkles: Twinkle[];
	spots: Spot[];
	light?: PointLight;
}

interface UfoLook {
	model: Model;
	beams: Beam[];
	sparkles?: ParticleEmitter;
	beamLight?: PointLight;
	glow?: PointLight;
	/** 0 = beam off, 1 = on; tweened from the "Beaming" attribute. */
	beam: NumberValue;
}

/**
 * Client side of the UFO night (the server's UfoService flies the UFOs and moves the fish): while it lasts the
 * world turns to a violet night, every tank's backdrop becomes deep space (stars, nebulas, planets), green
 * searchlights sweep over the tanks, and each UFO shines a green tractor beam while it takes or gives back a fish.
 * All local and visual.
 */
class UfoEventControllerSingleton implements Lifecycle {
	private active = false;
	/** 0 = normal world, 1 = full night; tweened on start / end. */
	private darkness = new Instance("NumberValue");
	private darknessTween?: Tween;
	private saved?: SavedLighting;
	private grade?: ColorCorrectionEffect;
	private tanks = new Map<Model, TankDressing>();
	private ufos = new Map<Model, UfoLook>();
	private ufoJanitors = new Map<Model, Janitor>();
	private rng = new Random();

	public onInit() {
		this.darkness.Changed.Connect(() => this.applyDarkness());
		MusicEventController.onEventChanged((event) => this.refresh(event));

		CollectionService.GetInstanceAddedSignal(TAGS.Ufo).Connect((ufo) => this.trackUfo(ufo));
		CollectionService.GetInstanceRemovedSignal(TAGS.Ufo).Connect((ufo) => this.untrackUfo(ufo));
		for (const ufo of CollectionService.GetTagged(TAGS.Ufo)) this.trackUfo(ufo);
	}

	public onStart() {
		print("[Client] UfoEventController started.");
		this.refresh(MusicEventController.getEvent());
		RunService.RenderStepped.Connect(() => this.update());
	}

	private refresh(event: ActiveEvent | undefined) {
		const active = event?.config.kind === "Ufo";
		if (active === this.active) return;
		this.active = active;
		if (active) {
			if (this.darkness.Value === 0) this.saveLighting();
			for (const instance of CollectionService.GetTagged(TAGS.Aquarium)) this.dressTank(instance);
		}
		this.darknessTween?.Cancel();
		const info = new TweenInfo(
			active ? DARKEN_TIME : BRIGHTEN_TIME,
			Enum.EasingStyle.Sine,
			Enum.EasingDirection.InOut,
		);
		this.darknessTween = TweenService.Create(this.darkness, info, { Value: active ? 1 : 0 });
		this.darknessTween.Completed.Connect((state) => {
			if (state === Enum.PlaybackState.Completed && !this.active) this.undressAll();
		});
		this.darknessTween.Play();
	}

	// ---------------------------------------------------------------------
	// Darkness
	// ---------------------------------------------------------------------

	/** The place's own lighting, read before the first change: it is what comes back after the night. */
	private saveLighting() {
		const atmosphere = Lighting.FindFirstChildOfClass("Atmosphere");
		this.saved = {
			clockTime: Lighting.ClockTime,
			brightness: Lighting.Brightness,
			exposure: Lighting.ExposureCompensation,
			ambient: Lighting.Ambient,
			outdoorAmbient: Lighting.OutdoorAmbient,
			atmosphere: atmosphere && { instance: atmosphere, color: atmosphere.Color, decay: atmosphere.Decay },
		};
	}

	private applyDarkness() {
		const saved = this.saved;
		if (!saved) return;
		const amount = this.darkness.Value;
		Lighting.ClockTime = (saved.clockTime + (NIGHT_CLOCK - saved.clockTime) * amount) % 24;
		Lighting.Brightness = saved.brightness + (NIGHT_BRIGHTNESS - saved.brightness) * amount;
		Lighting.ExposureCompensation = saved.exposure + (NIGHT_EXPOSURE - saved.exposure) * amount;
		Lighting.Ambient = saved.ambient.Lerp(NIGHT_AMBIENT, amount);
		Lighting.OutdoorAmbient = saved.outdoorAmbient.Lerp(NIGHT_OUTDOOR_AMBIENT, amount);
		// Only its colours: FocusController owns the atmosphere's density / haze (clear 2.5D view)
		if (saved.atmosphere) {
			saved.atmosphere.instance.Color = saved.atmosphere.color.Lerp(NIGHT_ATMOSPHERE, amount);
			saved.atmosphere.instance.Decay = saved.atmosphere.decay.Lerp(NIGHT_DECAY, amount);
		}

		if (amount > 0 && !this.grade) {
			this.grade = new Instance("ColorCorrectionEffect");
			this.grade.Name = "UfoGrade";
			this.grade.Parent = Lighting;
		}
		if (this.grade) {
			this.grade.TintColor = new Color3(1, 1, 1).Lerp(GRADE_TINT, amount);
			this.grade.Saturation = GRADE_SATURATION * amount;
			this.grade.Contrast = GRADE_CONTRAST * amount;
			if (amount === 0) {
				this.grade.Destroy();
				this.grade = undefined;
			}
		}
	}

	// ---------------------------------------------------------------------
	// Space look of the tanks
	// ---------------------------------------------------------------------

	private dressTank(instance: Instance) {
		if (!instance.IsA("Model") || this.tanks.has(instance)) return;
		const frame = getAquariumFrame(instance);
		if (!frame) return;
		const janitor = new Janitor();
		const dressing: TankDressing = { janitor, fills: [], twinkles: [], spots: [] };
		this.tanks.set(instance, dressing);

		const backdrop = instance.FindFirstChild("Backdrop");
		if (backdrop?.IsA("BasePart")) this.buildBackdrop(dressing, frame, backdrop);

		let water: BasePart | undefined;
		for (const part of CollectionService.GetTagged(TAGS.AquariumWater)) {
			if (part.IsA("BasePart") && part.IsDescendantOf(instance)) water = part;
		}
		if (water) {
			dressing.water = { part: water, color: water.Color };
			// Local change of a server part: the server never recolours the water, so nothing overrides it
			dressing.janitor.Add(() => (water.Color = dressing.water!.color), true);
			this.buildLights(dressing, frame, water);
		}
	}

	private undressAll() {
		for (const [, dressing] of this.tanks) dressing.janitor.Destroy();
		this.tanks.clear();
	}

	private addFill(dressing: TankDressing, frame: GuiObject, base: number) {
		frame.BackgroundTransparency = 1;
		dressing.fills.push({ frame, base });
	}

	private makeCircle(parent: Instance, size: number, x: number, y: number, z: number): Frame {
		const circle = new Instance("Frame");
		circle.AnchorPoint = new Vector2(0.5, 0.5);
		circle.SizeConstraint = Enum.SizeConstraint.RelativeYY;
		circle.Size = UDim2.fromScale(size, size);
		circle.Position = UDim2.fromScale(x, y);
		circle.BorderSizePixel = 0;
		circle.BackgroundColor3 = new Color3(1, 1, 1);
		circle.ZIndex = z;
		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0.5, 0);
		corner.Parent = circle;
		circle.Parent = parent;
		return circle;
	}

	/** Deep space panel: a violet sky, soft nebulas, twinkling stars and three cartoon planets. */
	private buildBackdrop(dressing: TankDressing, frame: CFrame, backdrop: BasePart) {
		const position = frame.PointToObjectSpace(backdrop.Position);
		const panel = dressing.janitor.Add(new Instance("Part"));
		panel.Name = "UfoBackdrop";
		panel.Size = new Vector3(backdrop.Size.X, backdrop.Size.Y, 0.05);
		// Its Front face (-Z) looks out of the tank, toward the glass
		panel.CFrame = frame.mul(new CFrame(0, position.Y, position.Z - backdrop.Size.Z / 2 - BACKDROP_GAP));
		panel.Transparency = 1;
		panel.Anchored = true;
		panel.CanCollide = false;
		panel.CanQuery = false;
		panel.CanTouch = false;
		panel.CastShadow = false;

		const gui = new Instance("SurfaceGui");
		gui.Face = Enum.NormalId.Front;
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
		gui.PixelsPerStud = BACKDROP_PIXELS_PER_STUD;
		gui.LightInfluence = 0; // its own glow, whatever the lighting
		gui.ClipsDescendants = true;
		gui.Parent = panel;

		const sky = new Instance("Frame");
		sky.Size = UDim2.fromScale(1, 1);
		sky.BorderSizePixel = 0;
		sky.BackgroundColor3 = new Color3(1, 1, 1);
		const skyGradient = new Instance("UIGradient");
		skyGradient.Rotation = 90;
		skyGradient.Color = new ColorSequence([
			new ColorSequenceKeypoint(0, UFO_COLORS.backdropTop),
			new ColorSequenceKeypoint(0.5, UFO_COLORS.backdropMiddle),
			new ColorSequenceKeypoint(1, UFO_COLORS.backdropBottom),
		]);
		skyGradient.Parent = sky;
		sky.Parent = gui;
		this.addFill(dressing, sky, 0);

		// Nebulas: big soft clouds of colour, fading out to their edge
		for (let i = 0; i < NEBULA_COUNT; i++) {
			const x = (i + this.rng.NextNumber(0.2, 0.8)) / NEBULA_COUNT;
			const nebula = this.makeCircle(gui, this.rng.NextNumber(0.9, 1.3), x, this.rng.NextNumber(0.2, 0.7), 2);
			nebula.Size = UDim2.fromScale(nebula.Size.X.Scale * 1.6, nebula.Size.Y.Scale);
			nebula.BackgroundColor3 = UFO_COLORS.nebula[i % UFO_COLORS.nebula.size()];
			const fade = new Instance("UIGradient");
			fade.Transparency = new NumberSequence([
				new NumberSequenceKeypoint(0, 1),
				new NumberSequenceKeypoint(0.5, 0.55),
				new NumberSequenceKeypoint(1, 1),
			]);
			fade.Rotation = this.rng.NextNumber(-20, 20);
			fade.Parent = nebula;
			this.addFill(dressing, nebula, 0);
		}

		// Stars: tiny dots, a few bigger ones, all twinkling
		for (let i = 0; i < STAR_COUNT; i++) {
			const pixels = i % 9 === 0 ? this.rng.NextInteger(7, 10) : this.rng.NextInteger(3, 6);
			const star = new Instance("Frame");
			star.AnchorPoint = new Vector2(0.5, 0.5);
			star.Size = UDim2.fromOffset(pixels, pixels);
			star.Position = UDim2.fromScale(this.rng.NextNumber(0.01, 0.99), this.rng.NextNumber(0.02, 0.95));
			star.BorderSizePixel = 0;
			star.BackgroundColor3 = UFO_COLORS.stars[i % UFO_COLORS.stars.size()];
			star.BackgroundTransparency = 1;
			star.Rotation = 45;
			star.ZIndex = 3;
			if (pixels < 7) {
				const corner = new Instance("UICorner");
				corner.CornerRadius = new UDim(0.5, 0);
				corner.Parent = star;
			}
			star.Parent = gui;
			dressing.twinkles.push({
				frame: star,
				phase: this.rng.NextNumber(0, math.pi * 2),
				speed: this.rng.NextNumber(1, 2.6),
				base: 0,
			});
		}

		// Planets: a big ringed one low on a side, two small ones up high
		const big = UFO_COLORS.planets[0];
		const side = this.rng.NextNumber() < 0.5 ? 0.16 : 0.84;
		const ring = this.makeCircle(gui, 0.62, side, 0.7, 4);
		ring.Size = UDim2.fromScale(0.78, 0.16);
		ring.Rotation = side < 0.5 ? -14 : 14;
		ring.BackgroundColor3 = big.ring!;
		this.addFill(dressing, ring, 0.15);
		const planet = this.makeCircle(gui, 0.42, side, 0.7, 5);
		const shade = new Instance("UIGradient");
		shade.Rotation = 60;
		shade.Color = new ColorSequence(big.top, big.bottom);
		shade.Parent = planet;
		this.addFill(dressing, planet, 0);
		// The ring's front half crosses the planet
		const front = this.makeCircle(gui, 0.62, side, 0.7, 6);
		front.Size = UDim2.fromScale(0.78, 0.16);
		front.Rotation = ring.Rotation;
		front.BackgroundColor3 = big.ring!;
		const frontHalf = new Instance("UIGradient");
		frontHalf.Rotation = 90;
		frontHalf.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, 1),
			new NumberSequenceKeypoint(0.5, 1),
			new NumberSequenceKeypoint(0.501, 0),
			new NumberSequenceKeypoint(1, 0),
		]);
		frontHalf.Parent = front;
		this.addFill(dressing, front, 0.15);

		for (let i = 1; i < UFO_COLORS.planets.size(); i++) {
			const colors = UFO_COLORS.planets[i];
			const x = side < 0.5 ? 0.55 + i * 0.16 : 0.45 - i * 0.16;
			const small = this.makeCircle(gui, this.rng.NextNumber(0.1, 0.16), x, this.rng.NextNumber(0.15, 0.32), 5);
			const smallShade = new Instance("UIGradient");
			smallShade.Rotation = 60;
			smallShade.Color = new ColorSequence(colors.top, colors.bottom);
			smallShade.Parent = small;
			this.addFill(dressing, small, 0);
		}

		panel.Parent = backdrop.Parent;
	}

	/** Two green searchlights high above the tank, swinging over it, and a faint green light in the water. */
	private buildLights(dressing: TankDressing, frame: CFrame, water: BasePart) {
		const top = water.Position.Y + water.Size.Y / 2;
		const center = frame.PointToObjectSpace(water.Position);
		for (let i = 0; i < SPOT_COUNT; i++) {
			const part = dressing.janitor.Add(new Instance("Part"));
			part.Name = "UfoSearchlight";
			part.Size = Vector3.one;
			part.Transparency = 1;
			part.Anchored = true;
			part.CanCollide = false;
			part.CanQuery = false;
			part.CanTouch = false;
			part.CastShadow = false;
			const offsetX = (i === 0 ? -1 : 1) * water.Size.X * 0.25;
			const above = frame.PointToWorldSpace(new Vector3(center.X + offsetX, 0, center.Z - water.Size.Z * 0.3));
			const origin = new CFrame(new Vector3(above.X, top + SPOT_HEIGHT, above.Z)).mul(frame.Rotation);
			part.CFrame = origin;
			const light = new Instance("SpotLight");
			light.Face = Enum.NormalId.Bottom;
			light.Color = UFO_COLORS.spot;
			light.Angle = SPOT_ANGLE;
			light.Range = SPOT_RANGE;
			light.Brightness = 0;
			light.Shadows = false;
			light.Parent = part;
			const source = new Instance("Attachment");
			source.Parent = part;
			const floor = new Instance("Attachment");
			floor.Parent = part;
			const shaft = new Instance("Beam");
			shaft.Attachment0 = source;
			shaft.Attachment1 = floor;
			shaft.Width0 = SHAFT_TOP_WIDTH;
			shaft.Width1 = SHAFT_BOTTOM_WIDTH;
			shaft.FaceCamera = true;
			shaft.LightEmission = 1;
			shaft.LightInfluence = 0;
			shaft.Color = new ColorSequence(UFO_COLORS.spot);
			shaft.Transparency = new NumberSequence(1);
			shaft.Segments = 1;
			shaft.Parent = part;
			part.Parent = water.Parent;
			const floorY = water.Position.Y - water.Size.Y / 2;
			dressing.spots.push({ part, light, origin, phase: i * math.pi * 0.7, shaft, floor, floorY });
		}

		const volume = dressing.janitor.Add(new Instance("Part"));
		volume.Name = "UfoWater";
		volume.Size = Vector3.one;
		volume.CFrame = water.CFrame;
		volume.Transparency = 1;
		volume.Anchored = true;
		volume.CanCollide = false;
		volume.CanQuery = false;
		volume.CanTouch = false;
		volume.CastShadow = false;
		const light = new Instance("PointLight");
		light.Color = UFO_COLORS.tankLight;
		light.Brightness = 0;
		light.Range = TANK_LIGHT_RANGE;
		light.Shadows = false;
		light.Parent = volume;
		dressing.light = light;
		volume.Parent = water.Parent;
	}

	// ---------------------------------------------------------------------
	// UFOs
	// ---------------------------------------------------------------------

	/** The water's floor under a UFO (its aquarium's water part), or 30 studs under it. */
	private getBeamBottom(ufo: Model): number {
		const aquarium = ufo.Parent;
		for (const part of CollectionService.GetTagged(TAGS.AquariumWater)) {
			if (aquarium && part.IsA("BasePart") && part.IsDescendantOf(aquarium))
				return part.Position.Y - part.Size.Y / 2;
		}
		return ufo.GetPivot().Position.Y - 30;
	}

	private trackUfo(instance: Instance) {
		if (!instance.IsA("Model") || this.ufoJanitors.has(instance)) return;
		const janitor = new Janitor();
		this.ufoJanitors.set(instance, janitor);
		const look: UfoLook = { model: instance, beams: [], beam: janitor.Add(new Instance("NumberValue")) };
		this.ufos.set(instance, look);
		janitor.Add(() => this.ufos.delete(instance), true);

		const root = instance.PrimaryPart ?? instance.FindFirstChildWhichIsA("BasePart", true);
		if (!root) return;
		const [, size] = instance.GetBoundingBox();
		// The beam's top: right under the saucer; its bottom follows the UFO at the water's floor (see update)
		const top = janitor.Add(new Instance("Attachment"));
		top.Name = "BeamTop";
		top.Parent = root;
		top.WorldPosition = instance.GetPivot().Position.sub(new Vector3(0, size.Y * 0.35, 0));
		const bottom = janitor.Add(new Instance("Attachment"));
		bottom.Name = "BeamBottom";
		bottom.Parent = root;

		for (let i = 0; i < 2; i++) {
			const beam = janitor.Add(new Instance("Beam"));
			beam.Attachment0 = top;
			beam.Attachment1 = bottom;
			beam.Width0 = BEAM_TOP_WIDTH * (i === 0 ? 1 : 0.55);
			beam.Width1 = BEAM_BOTTOM_WIDTH * (i === 0 ? 1 : 0.55);
			beam.FaceCamera = true;
			beam.LightEmission = 1;
			beam.LightInfluence = 0;
			beam.Color = new ColorSequence(UFO_COLORS.beam);
			beam.Segments = 1;
			beam.Enabled = false;
			beam.Parent = root;
			look.beams.push(beam);
		}
		const sparkles = janitor.Add(new Instance("ParticleEmitter"));
		sparkles.Texture = SPARKLE_TEXTURE;
		sparkles.Color = new ColorSequence(UFO_COLORS.beam);
		sparkles.LightEmission = 1;
		sparkles.LightInfluence = 0;
		sparkles.Size = new NumberSequence([
			new NumberSequenceKeypoint(0, 0),
			new NumberSequenceKeypoint(0.5, 0.4),
			new NumberSequenceKeypoint(1, 0),
		]);
		sparkles.Lifetime = new NumberRange(0.8, 1.4);
		sparkles.Speed = new NumberRange(3, 6);
		sparkles.EmissionDirection = Enum.NormalId.Top;
		sparkles.SpreadAngle = new Vector2(12, 12);
		sparkles.Rate = 0;
		sparkles.Parent = bottom;
		look.sparkles = sparkles;

		const beamLight = janitor.Add(new Instance("PointLight"));
		beamLight.Color = UFO_COLORS.beam;
		beamLight.Range = BEAM_LIGHT_RANGE;
		beamLight.Brightness = 0;
		beamLight.Shadows = false;
		beamLight.Parent = bottom;
		look.beamLight = beamLight;
		const glow = janitor.Add(new Instance("PointLight"));
		glow.Color = UFO_COLORS.dome;
		glow.Range = math.max(size.X, 6);
		glow.Brightness = UFO_LIGHT_BRIGHTNESS;
		glow.Shadows = false;
		glow.Parent = top;
		look.glow = glow;

		const fade = () => {
			const on = instance.GetAttribute(UFO_BEAM_ATTRIBUTE) === true;
			TweenService.Create(look.beam, new TweenInfo(BEAM_FADE_TIME), { Value: on ? 1 : 0 }).Play();
		};
		janitor.Add(instance.GetAttributeChangedSignal(UFO_BEAM_ATTRIBUTE).Connect(fade));
		fade();
	}

	private untrackUfo(instance: Instance) {
		this.ufoJanitors.get(instance as Model)?.Destroy();
		this.ufoJanitors.delete(instance as Model);
	}

	private updateUfo(look: UfoLook, now: number) {
		const amount = look.beam.Value;
		const bottom = look.beams[0]?.Attachment1;
		if (!bottom) return;
		const pivot = look.model.GetPivot().Position;
		bottom.WorldPosition = new Vector3(pivot.X, this.getBeamBottom(look.model), pivot.Z);
		const shimmer = 0.08 * math.sin(now * 9);
		for (const [i, beam] of ipairs(look.beams)) {
			beam.Enabled = amount > 0.01;
			const base = i === 1 ? 0.55 : 0.35;
			beam.Transparency = new NumberSequence([
				new NumberSequenceKeypoint(0, 1 - amount * (1 - base + shimmer)),
				new NumberSequenceKeypoint(0.85, 1 - amount * (0.6 - base * 0.5)),
				new NumberSequenceKeypoint(1, 1),
			]);
		}
		if (look.sparkles) look.sparkles.Rate = 24 * amount;
		if (look.beamLight) look.beamLight.Brightness = BEAM_LIGHT_BRIGHTNESS * amount;
		if (look.glow) look.glow.Brightness = UFO_LIGHT_BRIGHTNESS * (0.8 + 0.2 * math.sin(now * 4));
	}

	// ---------------------------------------------------------------------

	private update() {
		const now = os.clock();
		for (const [, look] of this.ufos) this.updateUfo(look, now);
		if (this.tanks.size() === 0) return;

		const amount = this.darkness.Value;
		for (const [, dressing] of this.tanks) {
			for (const fill of dressing.fills) fill.frame.BackgroundTransparency = 1 - amount * (1 - fill.base);
			for (const star of dressing.twinkles) {
				const glow = 0.5 + 0.5 * math.sin(now * star.speed + star.phase);
				star.frame.BackgroundTransparency = 1 - amount * (0.3 + 0.7 * glow);
			}
			for (const spot of dressing.spots) {
				const swing = SPOT_SWEEP * math.sin((now / SPOT_PERIOD) * math.pi * 2 + spot.phase);
				const tilt = SPOT_SWEEP * 0.4 * math.cos((now / SPOT_PERIOD) * math.pi * 2 * 0.7 + spot.phase);
				spot.part.CFrame = spot.origin.mul(CFrame.Angles(tilt, 0, swing));
				spot.light.Brightness = SPOT_BRIGHTNESS * amount;
				// The shaft follows the light down to the sand
				const down = spot.part.CFrame.UpVector.mul(-1);
				const reach = (spot.part.Position.Y - spot.floorY) / math.max(-down.Y, 0.2);
				spot.floor.WorldPosition = spot.part.Position.add(down.mul(reach));
				const fade = 1 - (1 - SHAFT_TRANSPARENCY) * amount;
				spot.shaft.Transparency = new NumberSequence([
					new NumberSequenceKeypoint(0, fade),
					new NumberSequenceKeypoint(0.8, fade),
					new NumberSequenceKeypoint(1, 1),
				]);
			}
			if (dressing.light) dressing.light.Brightness = TANK_LIGHT_BRIGHTNESS * amount;
			// The light blue water would tint the whole tank: a deep night blue
			if (dressing.water) dressing.water.part.Color = dressing.water.color.Lerp(UFO_COLORS.water, amount);
		}
	}
}

export const UfoEventController = new UfoEventControllerSingleton();
