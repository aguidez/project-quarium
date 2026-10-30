import { Janitor } from "@rbxts/janitor";
import { CollectionService, Lighting, RunService, TweenService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { getAquariumFrame } from "shared/types/aquarium";
import { ActiveEvent, LURKING_ATTRIBUTE } from "shared/types/events";
import { ABYSS_COLORS } from "client/ui/theme";
import { MusicEventController } from "./MusicEventController";

// The world going dark (local Lighting changes, put back when the raid ends)
const DARKEN_TIME = 2.5;
const BRIGHTEN_TIME = 2.5;
const NIGHT_CLOCK = 24.5; // ClockTime the day runs to (past midnight), through the sunset
const NIGHT_BRIGHTNESS = 0.6;
const NIGHT_EXPOSURE = -0.3;
const NIGHT_AMBIENT = Color3.fromRGB(16, 22, 42);
const NIGHT_OUTDOOR_AMBIENT = Color3.fromRGB(22, 30, 58);
const NIGHT_ATMOSPHERE = Color3.fromRGB(25, 40, 70);
const NIGHT_DECAY = Color3.fromRGB(10, 20, 45);
const GRADE_TINT = Color3.fromRGB(175, 195, 255);
const GRADE_SATURATION = -0.15;
const GRADE_CONTRAST = 0.08;

// Abyss backdrop, laid just in front of each tank's Backdrop (behind the decor)
const BACKDROP_GAP = 0.06; // studs in front of the Backdrop's face
const BACKDROP_PIXELS_PER_STUD = 20;
const SPECK_COUNT = 26;
const RIDGE_ROCKS = 9;
// Marine snow drifting down in the water, and a faint cold light so fish and coins stay readable
const SNOW_RATE = 9;
const TANK_LIGHT_BRIGHTNESS = 1.2;
const TANK_LIGHT_RANGE = 28;

// Lantern fish (EventFish of the Abyss event)
const FADE_IN_TIME = 1; // its lure shows up first, then its body comes out of the dark
const FADE_OUT_TIME = 0.8; // as AbyssService's FADE_TIME
const LURE_LEAD = 1.8; // the lure and the eyes are fully lit at 1 / LURE_LEAD of the fade-in
// Template parts shown with the lure: the glowing iris (Neon "Eye") and its slit ("Pupil")
const GLOWING_EYE_NAMES = ["Eye", "Pupil"];
const EYE_LIGHT_BRIGHTNESS = 1.2;
const EYE_LIGHT_RANGE = 2.5;
const LURE_BRIGHTNESS = 3;
const LURE_RANGE = 16;
const LURE_PULSE = 0.15; // ± share of the brightness, slow flicker
const SPARKLE_TEXTURE = "rbxasset://textures/particles/sparkles_main.dds";
const SNOW_TEXTURE = "rbxasset://textures/particles/smoke_main.dds";

interface SavedLighting {
	clockTime: number;
	brightness: number;
	exposure: number;
	ambient: Color3;
	outdoorAmbient: Color3;
	atmosphere?: { instance: Atmosphere; color: Color3; decay: Color3 };
}

interface Speck {
	frame: Frame;
	phase: number;
	speed: number;
}

interface TankDressing {
	janitor: Janitor;
	water?: { part: BasePart; color: Color3 }; // its own colour, put back after the raid
	fills: Frame[]; // background and rocks: fade with the darkness
	specks: Speck[];
	snow?: ParticleEmitter;
	light?: PointLight;
}

interface Lantern {
	model: Model;
	lure?: BasePart;
	light?: PointLight;
	eyeLights: PointLight[];
	visibility: NumberValue;
	phase: number;
}

/**
 * Client side of the abyssal raid (the server's AbyssService runs the thief): while it lasts the
 * world goes dark, every tank's backdrop turns into a deep abyss with glowing specks, marine snow
 * drifts in the water, and the lantern fish lights its lure, fading in from the dark when it comes
 * for a coin and back into it when it flees. All local and visual.
 */
class AbyssEventControllerSingleton implements Lifecycle {
	private active = false;
	/** 0 = normal world, 1 = full abyss; tweened on start / end. */
	private darkness = new Instance("NumberValue");
	private darknessTween?: Tween;
	private saved?: SavedLighting;
	private grade?: ColorCorrectionEffect;
	private tanks = new Map<Model, TankDressing>();
	private lanterns = new Map<Model, Lantern>();
	private lanternJanitors = new Map<Model, Janitor>();
	private rng = new Random();

	public onInit() {
		this.darkness.Changed.Connect(() => this.applyDarkness());
		MusicEventController.onEventChanged((event) => this.refresh(event));

		CollectionService.GetInstanceAddedSignal(TAGS.EventFish).Connect((fish) => this.trackLantern(fish));
		CollectionService.GetInstanceRemovedSignal(TAGS.EventFish).Connect((fish) => this.untrackLantern(fish));
		for (const fish of CollectionService.GetTagged(TAGS.EventFish)) this.trackLantern(fish);
	}

	public onStart() {
		print("[Client] AbyssEventController started.");
		this.refresh(MusicEventController.getEvent());
		RunService.RenderStepped.Connect(() => this.update());
	}

	private refresh(event: ActiveEvent | undefined) {
		const active = event?.config.kind === "Abyss";
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

	/** The place's own lighting, read before the first change: it is what comes back after the raid. */
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
		// The day runs on to the night (a sunset), and back
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
			this.grade.Name = "AbyssGrade";
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
	// Abyss look of the tanks
	// ---------------------------------------------------------------------

	private dressTank(instance: Instance) {
		if (!instance.IsA("Model") || this.tanks.has(instance)) return;
		const frame = getAquariumFrame(instance);
		if (!frame) return;
		const janitor = new Janitor();
		const dressing: TankDressing = { janitor, fills: [], specks: [] };
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
			this.buildWaterEffects(dressing, water);
		}
	}

	private undressAll() {
		for (const [, dressing] of this.tanks) dressing.janitor.Destroy();
		this.tanks.clear();
	}

	/** Deep-sea panel: a gradient into black, a ridge of dark rocks and glowing specks. */
	private buildBackdrop(dressing: TankDressing, frame: CFrame, backdrop: BasePart) {
		const position = frame.PointToObjectSpace(backdrop.Position);
		const panel = dressing.janitor.Add(new Instance("Part"));
		panel.Name = "AbyssBackdrop";
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
		gui.LightInfluence = 0; // its own darkness, whatever the lighting
		gui.Parent = panel;

		const background = new Instance("Frame");
		background.Size = UDim2.fromScale(1, 1);
		background.BorderSizePixel = 0;
		background.BackgroundColor3 = new Color3(1, 1, 1);
		background.BackgroundTransparency = 1;
		const gradient = new Instance("UIGradient");
		gradient.Rotation = 90;
		gradient.Color = new ColorSequence([
			new ColorSequenceKeypoint(0, ABYSS_COLORS.backdropTop),
			new ColorSequenceKeypoint(0.55, ABYSS_COLORS.backdropMiddle),
			new ColorSequenceKeypoint(1, ABYSS_COLORS.backdropBottom),
		]);
		gradient.Parent = background;
		background.Parent = gui;
		dressing.fills.push(background);

		// Ridge of rocks along the bottom: squares turned 45° sunk halfway, peaks of various heights
		for (let i = 0; i < RIDGE_ROCKS; i++) {
			const rock = new Instance("Frame");
			const size = this.rng.NextNumber(0.16, 0.32);
			rock.AnchorPoint = new Vector2(0.5, 0.5);
			rock.SizeConstraint = Enum.SizeConstraint.RelativeYY;
			rock.Size = UDim2.fromScale(size * 1.4, size * 1.4);
			rock.Position = UDim2.fromScale((i + this.rng.NextNumber(0.2, 0.8)) / RIDGE_ROCKS, 1.02);
			rock.Rotation = 45 + this.rng.NextNumber(-8, 8);
			rock.BorderSizePixel = 0;
			rock.BackgroundColor3 = i % 2 === 0 ? ABYSS_COLORS.rock : ABYSS_COLORS.rockFar;
			rock.BackgroundTransparency = 1;
			rock.ZIndex = i % 2 === 0 ? 3 : 2;
			rock.Parent = gui;
			dressing.fills.push(rock);
		}

		// Bioluminescent specks, more of them up high where the rocks don't hide them
		for (let i = 0; i < SPECK_COUNT; i++) {
			const speck = new Instance("Frame");
			const pixels = this.rng.NextInteger(4, 10);
			speck.AnchorPoint = new Vector2(0.5, 0.5);
			speck.Size = UDim2.fromOffset(pixels, pixels);
			speck.Position = UDim2.fromScale(this.rng.NextNumber(0.02, 0.98), this.rng.NextNumber(0.05, 0.8));
			speck.BorderSizePixel = 0;
			speck.BackgroundColor3 = ABYSS_COLORS.specks[i % ABYSS_COLORS.specks.size()];
			speck.BackgroundTransparency = 1;
			speck.ZIndex = 4;
			const corner = new Instance("UICorner");
			corner.CornerRadius = new UDim(0.5, 0);
			corner.Parent = speck;
			speck.Parent = gui;
			dressing.specks.push({
				frame: speck,
				phase: this.rng.NextNumber(0, math.pi * 2),
				speed: this.rng.NextNumber(0.6, 1.6),
			});
		}

		panel.Parent = backdrop.Parent;
	}

	private buildWaterEffects(dressing: TankDressing, water: BasePart) {
		const volume = dressing.janitor.Add(new Instance("Part"));
		volume.Name = "AbyssWater";
		volume.Size = water.Size;
		volume.CFrame = water.CFrame;
		volume.Transparency = 1;
		volume.Anchored = true;
		volume.CanCollide = false;
		volume.CanQuery = false;
		volume.CanTouch = false;
		volume.CastShadow = false;

		const snow = new Instance("ParticleEmitter");
		snow.Name = "MarineSnow";
		snow.Texture = SNOW_TEXTURE;
		snow.Color = new ColorSequence(ABYSS_COLORS.snow);
		snow.LightEmission = 1;
		snow.LightInfluence = 0;
		snow.Size = new NumberSequence(0.18);
		snow.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, 1),
			new NumberSequenceKeypoint(0.2, 0.35),
			new NumberSequenceKeypoint(0.8, 0.35),
			new NumberSequenceKeypoint(1, 1),
		]);
		snow.Lifetime = new NumberRange(6, 10);
		snow.Rate = 0;
		snow.Speed = new NumberRange(0.2, 0.6);
		snow.EmissionDirection = Enum.NormalId.Bottom;
		snow.SpreadAngle = new Vector2(25, 25);
		snow.Shape = Enum.ParticleEmitterShape.Box;
		snow.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume;
		snow.Parent = volume;
		dressing.snow = snow;

		const light = new Instance("PointLight");
		light.Color = ABYSS_COLORS.tankLight;
		light.Brightness = 0;
		light.Range = TANK_LIGHT_RANGE;
		light.Shadows = false;
		light.Parent = volume;
		dressing.light = light;

		volume.Parent = water.Parent;
	}

	// ---------------------------------------------------------------------
	// Lantern fish
	// ---------------------------------------------------------------------

	private trackLantern(instance: Instance) {
		if (!instance.IsA("Model") || this.lanternJanitors.has(instance)) return;
		if (instance.GetAttribute("EventType") !== "Abyss") return;

		const janitor = new Janitor();
		this.lanternJanitors.set(instance, janitor);
		const visibility = janitor.Add(new Instance("NumberValue"));
		const lantern: Lantern = {
			model: instance,
			eyeLights: [],
			visibility,
			phase: this.rng.NextNumber(0, math.pi * 2),
		};
		this.lanterns.set(instance, lantern);
		janitor.Add(() => this.lanterns.delete(instance), true);

		const fade = () => {
			const lurking = instance.GetAttribute(LURKING_ATTRIBUTE) !== false;
			const info = new TweenInfo(
				lurking ? FADE_OUT_TIME : FADE_IN_TIME,
				Enum.EasingStyle.Sine,
				Enum.EasingDirection.InOut,
			);
			TweenService.Create(visibility, info, { Value: lurking ? 0 : 1 }).Play();
		};
		janitor.Add(instance.GetAttributeChangedSignal(LURKING_ATTRIBUTE).Connect(fade));
		this.applyLantern(lantern); // hidden from the first frame
		fade();

		task.spawn(() => {
			const lure = instance.WaitForChild("Lure", 10);
			if (!lure?.IsA("BasePart") || this.lanterns.get(instance) !== lantern) return;
			lantern.lure = lure;

			const light = janitor.Add(new Instance("PointLight"));
			light.Color = ABYSS_COLORS.lure;
			light.Brightness = 0;
			light.Range = LURE_RANGE;
			light.Shadows = false;
			light.Parent = lure;
			lantern.light = light;

			const glitter = janitor.Add(new Instance("ParticleEmitter"));
			glitter.Texture = SPARKLE_TEXTURE;
			glitter.Color = new ColorSequence(ABYSS_COLORS.lure);
			glitter.LightEmission = 1;
			glitter.LightInfluence = 0;
			glitter.Size = new NumberSequence([
				new NumberSequenceKeypoint(0, 0),
				new NumberSequenceKeypoint(0.4, 0.5),
				new NumberSequenceKeypoint(1, 0),
			]);
			glitter.Lifetime = new NumberRange(0.4, 0.8);
			glitter.Rate = 8;
			glitter.Speed = new NumberRange(0.3, 1);
			glitter.SpreadAngle = new Vector2(180, 180);
			glitter.Parent = lure;

			// A soft red glow in each eye socket: the eyes look lit from within, not painted on
			for (const eye of instance.GetChildren()) {
				if (!eye.IsA("BasePart") || eye.Name !== GLOWING_EYE_NAMES[0]) continue;
				const eyeLight = janitor.Add(new Instance("PointLight"));
				eyeLight.Color = ABYSS_COLORS.eye;
				eyeLight.Brightness = 0;
				eyeLight.Range = EYE_LIGHT_RANGE;
				eyeLight.Shadows = false;
				eyeLight.Parent = eye;
				lantern.eyeLights.push(eyeLight);
			}
		});
	}

	private untrackLantern(instance: Instance) {
		this.lanternJanitors.get(instance as Model)?.Destroy();
		this.lanternJanitors.delete(instance as Model);
	}

	/**
	 * The glowing parts (lure, eyes) show up before the body: two eyes and a light in the dark, then
	 * the fish. Everything it holds (its loot) fades with the body.
	 */
	private applyLantern(lantern: Lantern) {
		const amount = lantern.visibility.Value;
		const lureAmount = math.min(amount * LURE_LEAD, 1);
		for (const descendant of lantern.model.GetDescendants()) {
			if (!descendant.IsA("BasePart") || descendant === lantern.model.PrimaryPart) continue;
			const glowing = descendant === lantern.lure || GLOWING_EYE_NAMES.includes(descendant.Name);
			descendant.LocalTransparencyModifier = 1 - (glowing ? lureAmount : amount);
		}
		const flicker = 1 + LURE_PULSE * math.sin(os.clock() * 3 + lantern.phase);
		if (lantern.light) lantern.light.Brightness = LURE_BRIGHTNESS * lureAmount * flicker;
		for (const eyeLight of lantern.eyeLights) eyeLight.Brightness = EYE_LIGHT_BRIGHTNESS * lureAmount * flicker;
		const glitter = lantern.lure?.FindFirstChildOfClass("ParticleEmitter");
		if (glitter) glitter.Enabled = lureAmount > 0.5;
	}

	// ---------------------------------------------------------------------

	private update() {
		for (const [, lantern] of this.lanterns) this.applyLantern(lantern);
		if (this.tanks.size() === 0) return;

		const amount = this.darkness.Value;
		const now = os.clock();
		for (const [, dressing] of this.tanks) {
			for (const fill of dressing.fills) fill.BackgroundTransparency = 1 - amount;
			for (const speck of dressing.specks) {
				const glow = 0.5 + 0.5 * math.sin(now * speck.speed + speck.phase);
				speck.frame.BackgroundTransparency = 1 - amount * (0.25 + 0.75 * glow);
			}
			if (dressing.snow) dressing.snow.Rate = SNOW_RATE * amount;
			if (dressing.light) dressing.light.Brightness = TANK_LIGHT_BRIGHTNESS * amount;
			// The light blue water would tint the whole tank: deep navy in the abyss
			if (dressing.water) dressing.water.part.Color = dressing.water.color.Lerp(ABYSS_COLORS.water, amount);
		}
	}
}

export const AbyssEventController = new AbyssEventControllerSingleton();
