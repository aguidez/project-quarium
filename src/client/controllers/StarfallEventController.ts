import { Janitor } from "@rbxts/janitor";
import { CollectionService, Lighting, RunService, TweenService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { getAquariumFrame } from "shared/types/aquarium";
import { ActiveEvent } from "shared/types/events";
import { isStarSize, STAR_CAUGHT_ATTRIBUTE, STAR_FADING_ATTRIBUTE, STAR_SIZE_ATTRIBUTE, STAR_SIZES } from "shared/types/stars";
import { STARFALL_COLORS } from "client/ui/theme";
import { MusicEventController } from "./MusicEventController";

// The night falling (local Lighting changes, put back when it ends): a clear deep blue night, brighter than the UFO's
const DARKEN_TIME = 2.5;
const BRIGHTEN_TIME = 2.5;
const NIGHT_CLOCK = 23.5;
const NIGHT_BRIGHTNESS = 0.8;
const NIGHT_EXPOSURE = -0.2;
const NIGHT_AMBIENT = Color3.fromRGB(30, 38, 84);
const NIGHT_OUTDOOR_AMBIENT = Color3.fromRGB(44, 56, 120);
const NIGHT_ATMOSPHERE = Color3.fromRGB(36, 52, 128);
const NIGHT_DECAY = Color3.fromRGB(16, 22, 64);
const GRADE_TINT = Color3.fromRGB(205, 215, 255);
const GRADE_SATURATION = 0.1;
const GRADE_CONTRAST = 0.08;

// Starry backdrop, laid just in front of each tank's Backdrop (behind the decor)
const BACKDROP_GAP = 0.06; // studs in front of the Backdrop's face
const BACKDROP_PIXELS_PER_STUD = 20;
const TWINKLE_COUNT = 54;
// Shooting stars crossing the backdrop (the 2.5D view) and the sky over the beach (the lobby)
const BACKDROP_STREAK_GAP: [number, number] = [0.5, 1.4]; // seconds between two, per tank
const BACKDROP_STREAK_TIME = 0.9;
const SKY_STREAK_GAP: [number, number] = [0.25, 0.8];
const SKY_STREAK_TIME = 1.4;
const SKY_STREAK_SPEED = 90; // studs/s
const SKY_STREAK_HEIGHT: [number, number] = [70, 120]; // studs above the camera
const SKY_STREAK_SPREAD = 160; // studs around the camera
const TANK_LIGHT_BRIGHTNESS = 1.2;
const TANK_LIGHT_RANGE = 26;

// A falling star: a golden star drawn on a camera-facing billboard (★ glyph, outlined), a halo, a trail and sparkles
const STAR_GLYPH = "★";
const STAR_DRAW_SCALE = 1.6; // billboard size / star studs (the glyph doesn't fill its box)
const STAR_SPIN_SPEED = 70; // degrees per second
const STAR_PULSE = 0.07;
const STAR_LIGHT_BRIGHTNESS = 2.5;
const BURST_TIME = 0.35; // a caught star swells and vanishes
const BLINK_PERIOD = 0.3;
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
}

interface BackdropStreak {
	frame: Frame;
	from: UDim2;
	to: UDim2;
	startedAt: number;
}

interface TankDressing {
	janitor: Janitor;
	gui?: SurfaceGui;
	sky?: GuiObject;
	water?: { part: BasePart; color: Color3 };
	twinkles: Twinkle[];
	streaks: BackdropStreak[];
	nextStreakAt: number;
	light?: PointLight;
}

interface SkyStreak {
	part: BasePart;
	velocity: Vector3;
	startedAt: number;
}

interface StarLook {
	hitbox: BasePart;
	janitor: Janitor;
	star: TextLabel;
	halo: TextLabel;
	scale: UIScale;
	light: PointLight;
	sparkles: ParticleEmitter;
	phase: number;
	caughtAt?: number;
}

/**
 * Client side of the starfall (the server's StarfallService drops invisible balls into the tanks): while it lasts a
 * clear blue night falls, shooting stars streak across the sky and across every tank's starry backdrop, and each falling
 * star is drawn here around its ball, golden, spinning, with a halo, a trail and sparkles. A caught star bursts, a star
 * about to vanish blinks. All local and visual.
 */
class StarfallEventControllerSingleton implements Lifecycle {
	private active = false;
	/** 0 = normal world, 1 = full night; tweened on start / end. */
	private darkness = new Instance("NumberValue");
	private darknessTween?: Tween;
	private saved?: SavedLighting;
	private grade?: ColorCorrectionEffect;
	private tanks = new Map<Model, TankDressing>();
	private skyStreaks = new Array<SkyStreak>();
	private nextSkyStreakAt = 0;
	private stars = new Map<BasePart, StarLook>();
	private rng = new Random();

	public onInit() {
		this.darkness.Changed.Connect(() => this.applyDarkness());
		MusicEventController.onEventChanged((event) => this.refresh(event));

		CollectionService.GetInstanceAddedSignal(TAGS.Star).Connect((star) => this.trackStar(star));
		for (const star of CollectionService.GetTagged(TAGS.Star)) this.trackStar(star);
	}

	public onStart() {
		print("[Client] StarfallEventController started.");
		this.refresh(MusicEventController.getEvent());
		RunService.RenderStepped.Connect((dt) => this.update(dt));
	}

	private refresh(event: ActiveEvent | undefined) {
		const active = event?.config.kind === "Starfall";
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
	// The night
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
		Lighting.ClockTime = saved.clockTime + (NIGHT_CLOCK - saved.clockTime) * amount;
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
			this.grade.Name = "StarfallGrade";
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
	// Starry backdrop of the tanks
	// ---------------------------------------------------------------------

	private dressTank(instance: Instance) {
		if (!instance.IsA("Model") || this.tanks.has(instance)) return;
		const frame = getAquariumFrame(instance);
		if (!frame) return;
		const janitor = new Janitor();
		const dressing: TankDressing = { janitor, twinkles: [], streaks: [], nextStreakAt: os.clock() };
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

			const volume = dressing.janitor.Add(new Instance("Part"));
			volume.Name = "StarfallWater";
			volume.Size = Vector3.one;
			volume.CFrame = water.CFrame;
			volume.Transparency = 1;
			volume.Anchored = true;
			volume.CanCollide = false;
			volume.CanQuery = false;
			volume.CanTouch = false;
			volume.CastShadow = false;
			const light = new Instance("PointLight");
			light.Color = STARFALL_COLORS.tankLight;
			light.Brightness = 0;
			light.Range = TANK_LIGHT_RANGE;
			light.Shadows = false;
			light.Parent = volume;
			dressing.light = light;
			volume.Parent = water.Parent;
		}
	}

	private undressAll() {
		for (const [, dressing] of this.tanks) dressing.janitor.Destroy();
		this.tanks.clear();
		for (const streak of this.skyStreaks) streak.part.Destroy();
		this.skyStreaks.clear();
	}

	/** A night sky panel: deep blue fading to violet at the horizon, and twinkling stars. */
	private buildBackdrop(dressing: TankDressing, frame: CFrame, backdrop: BasePart) {
		const position = frame.PointToObjectSpace(backdrop.Position);
		const panel = dressing.janitor.Add(new Instance("Part"));
		panel.Name = "StarfallBackdrop";
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
		dressing.gui = gui;

		const sky = new Instance("Frame");
		sky.Size = UDim2.fromScale(1, 1);
		sky.BorderSizePixel = 0;
		sky.BackgroundColor3 = new Color3(1, 1, 1);
		sky.BackgroundTransparency = 1;
		const gradient = new Instance("UIGradient");
		gradient.Rotation = 90;
		gradient.Color = new ColorSequence([
			new ColorSequenceKeypoint(0, STARFALL_COLORS.backdropTop),
			new ColorSequenceKeypoint(0.6, STARFALL_COLORS.backdropMiddle),
			new ColorSequenceKeypoint(1, STARFALL_COLORS.backdropBottom),
		]);
		gradient.Parent = sky;
		sky.Parent = gui;
		dressing.sky = sky;

		for (let i = 0; i < TWINKLE_COUNT; i++) {
			const pixels = i % 8 === 0 ? this.rng.NextInteger(7, 10) : this.rng.NextInteger(3, 6);
			const star = new Instance("Frame");
			star.AnchorPoint = new Vector2(0.5, 0.5);
			star.Size = UDim2.fromOffset(pixels, pixels);
			star.Position = UDim2.fromScale(this.rng.NextNumber(0.01, 0.99), this.rng.NextNumber(0.02, 0.9));
			star.BorderSizePixel = 0;
			star.BackgroundColor3 = STARFALL_COLORS.twinkles[i % STARFALL_COLORS.twinkles.size()];
			star.BackgroundTransparency = 1;
			star.Rotation = 45;
			star.ZIndex = 2;
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
			});
		}

		panel.Parent = backdrop.Parent;
	}

	/** A shooting star across the backdrop: a bright head and a tail fading behind it, on a downward slant. */
	private launchBackdropStreak(dressing: TankDressing, now: number) {
		const gui = dressing.gui;
		if (!gui) return;
		const leftToRight = this.rng.NextNumber() < 0.5;
		const angle = this.rng.NextNumber(18, 34); // degrees below the horizon
		const length = this.rng.NextNumber(0.18, 0.3);
		const streak = new Instance("Frame");
		streak.AnchorPoint = new Vector2(leftToRight ? 1 : 0, 0.5);
		streak.Size = new UDim2(length, 0, 0, this.rng.NextInteger(3, 5));
		streak.BorderSizePixel = 0;
		streak.BackgroundColor3 = STARFALL_COLORS.starLight;
		streak.Rotation = leftToRight ? angle : -angle;
		streak.ZIndex = 3;
		const fade = new Instance("UIGradient");
		// Transparent tail, solid head (at the anchor's side)
		fade.Transparency = new NumberSequence(leftToRight ? [new NumberSequenceKeypoint(0, 1), new NumberSequenceKeypoint(1, 0)] : [new NumberSequenceKeypoint(0, 0), new NumberSequenceKeypoint(1, 1)]);
		fade.Color = new ColorSequence(
			leftToRight ? STARFALL_COLORS.trail : STARFALL_COLORS.starLight,
			leftToRight ? STARFALL_COLORS.starLight : STARFALL_COLORS.trail,
		);
		fade.Parent = streak;
		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0.5, 0);
		corner.Parent = streak;
		streak.Parent = gui;

		const startX = leftToRight ? this.rng.NextNumber(-0.1, 0.5) : this.rng.NextNumber(0.5, 1.1);
		const startY = this.rng.NextNumber(-0.05, 0.35);
		const travel = this.rng.NextNumber(0.35, 0.6);
		const slope = math.tan(math.rad(angle));
		const from = UDim2.fromScale(startX, startY);
		const to = UDim2.fromScale(
			startX + (leftToRight ? travel : -travel),
			// The panel is wider than tall: the slope is in pixels, so scale the drop by the aspect ratio
			startY + travel * slope * (gui.AbsoluteSize.X / math.max(gui.AbsoluteSize.Y, 1)),
		);
		streak.Position = from;
		dressing.streaks.push({ frame: streak, from, to, startedAt: now });
	}

	/** A shooting star high in the sky over the beach (seen from the lobby): a glowing ball with a long trail. */
	private launchSkyStreak(now: number) {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		const origin = camera.CFrame.Position;
		const start = origin.add(
			new Vector3(
				this.rng.NextNumber(-SKY_STREAK_SPREAD, SKY_STREAK_SPREAD),
				this.rng.NextNumber(SKY_STREAK_HEIGHT[0], SKY_STREAK_HEIGHT[1]),
				this.rng.NextNumber(-SKY_STREAK_SPREAD, SKY_STREAK_SPREAD),
			),
		);
		const heading = this.rng.NextNumber(0, math.pi * 2);
		const velocity = new Vector3(math.cos(heading), -this.rng.NextNumber(0.25, 0.5), math.sin(heading))
			.Unit.mul(SKY_STREAK_SPEED);

		const part = new Instance("Part");
		part.Name = "SkyShootingStar";
		part.Shape = Enum.PartType.Ball;
		part.Size = Vector3.one.mul(0.8);
		part.Material = Enum.Material.Neon;
		part.Color = STARFALL_COLORS.starLight;
		part.Anchored = true;
		part.CanCollide = false;
		part.CanQuery = false;
		part.CanTouch = false;
		part.CastShadow = false;
		part.Position = start;
		const top = new Instance("Attachment");
		top.Position = new Vector3(0, 0.35, 0);
		top.Parent = part;
		const bottom = new Instance("Attachment");
		bottom.Position = new Vector3(0, -0.35, 0);
		bottom.Parent = part;
		const trail = new Instance("Trail");
		trail.Attachment0 = top;
		trail.Attachment1 = bottom;
		trail.FaceCamera = true;
		trail.Lifetime = 0.45;
		trail.LightEmission = 1;
		trail.LightInfluence = 0;
		trail.Color = new ColorSequence(STARFALL_COLORS.starLight, STARFALL_COLORS.trail);
		trail.Transparency = new NumberSequence(0, 1);
		trail.WidthScale = new NumberSequence(1, 0);
		trail.Parent = part;
		part.Parent = Workspace;
		this.skyStreaks.push({ part, velocity, startedAt: now });
	}

	// ---------------------------------------------------------------------
	// Falling stars
	// ---------------------------------------------------------------------

	private trackStar(instance: Instance) {
		if (!instance.IsA("BasePart") || this.stars.has(instance)) return;
		const size = instance.GetAttribute(STAR_SIZE_ATTRIBUTE);
		if (!isStarSize(size)) return;
		const studs = STAR_SIZES[size].studs;
		const janitor = new Janitor();

		const gui = janitor.Add(new Instance("BillboardGui"));
		gui.Name = "StarLook";
		gui.Size = UDim2.fromScale(studs * STAR_DRAW_SCALE, studs * STAR_DRAW_SCALE);
		gui.LightInfluence = 0;
		gui.MaxDistance = 250;
		gui.ResetOnSpawn = false;
		gui.Adornee = instance;
		const scale = new Instance("UIScale");
		scale.Parent = gui;

		const glyph = (name: string, size: number, z: number) => {
			const label = new Instance("TextLabel");
			label.Name = name;
			label.AnchorPoint = new Vector2(0.5, 0.5);
			label.Position = UDim2.fromScale(0.5, 0.5);
			label.Size = UDim2.fromScale(size, size);
			label.BackgroundTransparency = 1;
			label.Font = Enum.Font.FredokaOne;
			label.Text = STAR_GLYPH;
			label.TextScaled = true;
			label.ZIndex = z;
			label.Parent = gui;
			return label;
		};
		const halo = glyph("Halo", 1.45, 1);
		halo.TextColor3 = STARFALL_COLORS.starLight;
		halo.TextTransparency = 0.65;
		const star = glyph("Star", 1, 2);
		star.TextColor3 = new Color3(1, 1, 1);
		const gold = new Instance("UIGradient");
		gold.Rotation = 90;
		gold.Color = new ColorSequence(STARFALL_COLORS.starLight, STARFALL_COLORS.star);
		gold.Parent = star;
		const stroke = new Instance("UIStroke");
		stroke.Color = STARFALL_COLORS.starEdge;
		stroke.Thickness = math.clamp(studs * 1.2, 1.5, 4);
		stroke.LineJoinMode = Enum.LineJoinMode.Round;
		stroke.Parent = star;
		gui.Parent = instance;

		const light = janitor.Add(new Instance("PointLight"));
		light.Color = STARFALL_COLORS.star;
		light.Brightness = STAR_LIGHT_BRIGHTNESS;
		light.Range = 5 + studs * 2.5;
		light.Shadows = false;
		light.Parent = instance;

		// The trail it leaves while it streaks in (short once it sinks slowly)
		const top = janitor.Add(new Instance("Attachment"));
		top.Position = new Vector3(0, studs * 0.22, 0);
		top.Parent = instance;
		const bottom = janitor.Add(new Instance("Attachment"));
		bottom.Position = new Vector3(0, -studs * 0.22, 0);
		bottom.Parent = instance;
		const trail = janitor.Add(new Instance("Trail"));
		trail.Attachment0 = top;
		trail.Attachment1 = bottom;
		trail.FaceCamera = true;
		trail.Lifetime = 0.35;
		trail.LightEmission = 1;
		trail.LightInfluence = 0;
		trail.Color = new ColorSequence(STARFALL_COLORS.star, STARFALL_COLORS.trail);
		trail.Transparency = new NumberSequence(0.1, 1);
		trail.WidthScale = new NumberSequence(1, 0);
		trail.Parent = instance;

		const sparkles = janitor.Add(new Instance("ParticleEmitter"));
		sparkles.Texture = SPARKLE_TEXTURE;
		sparkles.Color = new ColorSequence(STARFALL_COLORS.starLight, STARFALL_COLORS.star);
		sparkles.LightEmission = 1;
		sparkles.LightInfluence = 0;
		sparkles.Brightness = 2;
		sparkles.Size = new NumberSequence([
			new NumberSequenceKeypoint(0, 0),
			new NumberSequenceKeypoint(0.4, math.max(studs * 0.35, 0.4)),
			new NumberSequenceKeypoint(1, 0),
		]);
		sparkles.Lifetime = new NumberRange(0.4, 0.9);
		sparkles.Rate = 4 + studs * 4;
		sparkles.Speed = new NumberRange(0.5, 2);
		sparkles.SpreadAngle = new Vector2(180, 180);
		sparkles.Rotation = new NumberRange(0, 360);
		sparkles.RotSpeed = new NumberRange(-120, 120);
		sparkles.Parent = instance;

		const look: StarLook = {
			hitbox: instance,
			janitor,
			star,
			halo,
			scale,
			light,
			sparkles,
			phase: this.rng.NextNumber(0, 360),
		};
		this.stars.set(instance, look);
		janitor.Add(() => this.stars.delete(instance), true);
		janitor.Add(
			instance.GetAttributeChangedSignal(STAR_CAUGHT_ATTRIBUTE).Connect(() => {
				if (look.caughtAt !== undefined) return;
				look.caughtAt = os.clock();
				sparkles.Emit(math.floor(12 + studs * 8));
				sparkles.Rate = 0;
				trail.Enabled = false;
			}),
		);
		janitor.Add(instance.Destroying.Connect(() => janitor.Destroy()));
		janitor.Add(
			instance.AncestryChanged.Connect(() => {
				if (!instance.IsDescendantOf(Workspace)) janitor.Destroy();
			}),
		);
	}

	private updateStar(look: StarLook, now: number) {
		let visibility = 1;
		let swell = 1 + STAR_PULSE * math.sin(now * 5 + look.phase);
		if (look.caughtAt !== undefined) {
			const t = math.min((now - look.caughtAt) / BURST_TIME, 1);
			swell = 1 + t * 0.9;
			visibility = 1 - t;
		} else if (look.hitbox.GetAttribute(STAR_FADING_ATTRIBUTE) === true) {
			visibility = math.floor(now / (BLINK_PERIOD / 2)) % 2 === 0 ? 1 : 0.3;
		}
		look.scale.Scale = swell;
		look.star.Rotation = (now * STAR_SPIN_SPEED + look.phase) % 360;
		look.halo.Rotation = -look.star.Rotation * 0.5;
		look.star.TextTransparency = 1 - visibility;
		look.halo.TextTransparency = 1 - visibility * (0.35 + 0.15 * math.sin(now * 3 + look.phase));
		const stroke = look.star.FindFirstChildOfClass("UIStroke");
		if (stroke) stroke.Transparency = 1 - visibility;
		look.light.Brightness = STAR_LIGHT_BRIGHTNESS * visibility;
	}

	// ---------------------------------------------------------------------

	private update(dt: number) {
		const now = os.clock();
		for (const [, look] of this.stars) this.updateStar(look, now);

		const amount = this.darkness.Value;
		for (const [, dressing] of this.tanks) {
			if (dressing.sky) dressing.sky.BackgroundTransparency = 1 - amount;
			for (const star of dressing.twinkles) {
				const glow = 0.5 + 0.5 * math.sin(now * star.speed + star.phase);
				star.frame.BackgroundTransparency = 1 - amount * (0.3 + 0.7 * glow);
			}
			if (this.active && amount > 0.5 && now >= dressing.nextStreakAt) {
				this.launchBackdropStreak(dressing, now);
				dressing.nextStreakAt = now + this.rng.NextNumber(BACKDROP_STREAK_GAP[0], BACKDROP_STREAK_GAP[1]);
			}
			for (let i = dressing.streaks.size() - 1; i >= 0; i--) {
				const streak = dressing.streaks[i];
				const t = (now - streak.startedAt) / BACKDROP_STREAK_TIME;
				if (t >= 1) {
					streak.frame.Destroy();
					dressing.streaks.remove(i);
					continue;
				}
				streak.frame.Position = streak.from.Lerp(streak.to, t);
				// Bright in the middle of its run, fading in and out
				streak.frame.BackgroundTransparency = 1 - amount * math.sin(t * math.pi);
			}
			if (dressing.light) dressing.light.Brightness = TANK_LIGHT_BRIGHTNESS * amount;
			// The light blue water would tint the whole tank: a deep night blue
			if (dressing.water) dressing.water.part.Color = dressing.water.color.Lerp(STARFALL_COLORS.water, amount);
		}

		if (this.active && amount > 0.5 && now >= this.nextSkyStreakAt) {
			this.launchSkyStreak(now);
			this.nextSkyStreakAt = now + this.rng.NextNumber(SKY_STREAK_GAP[0], SKY_STREAK_GAP[1]);
		}
		for (let i = this.skyStreaks.size() - 1; i >= 0; i--) {
			const streak = this.skyStreaks[i];
			const age = now - streak.startedAt;
			if (age >= SKY_STREAK_TIME) {
				streak.part.Destroy();
				this.skyStreaks.remove(i);
				continue;
			}
			streak.part.Position = streak.part.Position.add(streak.velocity.mul(dt));
			streak.part.Transparency = 1 - math.sin((age / SKY_STREAK_TIME) * math.pi);
		}
	}
}

export const StarfallEventController = new StarfallEventControllerSingleton();
