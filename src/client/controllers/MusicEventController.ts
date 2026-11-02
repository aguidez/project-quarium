import { Janitor } from "@rbxts/janitor";
import { CollectionService, Players, ReplicatedStorage, RunService, TweenService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import {
	ActiveEvent,
	EVENT_ATTRIBUTES,
	EVENT_IMMUNE_ATTRIBUTE,
	GAME_EVENTS,
	GameEventType,
	getActiveEvent,
	getBeatLength,
	GUEST_DANCE_JOINTS,
	isEventImmune,
} from "shared/types/events";
import { EVENT_BANNER_STYLES } from "client/ui/theme";
import { AudioController } from "./AudioController";
import { FishAnimationController } from "./FishAnimationController";

const NOTES = ["♪", "♫", "♬", "♩"];

// Guest effects
// The light sits inside the guest: kept soft so it tints the tank without washing out the guest's texture
const LIGHT_BRIGHTNESS = 0.5;
const LIGHT_FLASH = 1.4; // brightness on the beat
const LIGHT_RANGE = 18;
const WAVE_TIME = 0.55; // sound wave growing out of the guest
const WAVE_START = 1.1; // initial size, × the guest's size (around it, not over it)
const WAVE_GROWTH = 2.6; // final size, × the guest's size
const WAVE_TRANSPARENCY = 0.55;
const NOTE_TIME = 1.6;
const NOTE_RISE = 6; // studs
const NOTE_DRIFT = 3.5;
const NOTE_SIZE = 2.6; // studs
// Dancing guests (GUEST_DANCE_JOINTS)
// The instrument's dance (the crab's saxophone, pivot at its middle): HOLD_BEATS on its side swaying once, then a trip
// of CARRY_BEATS to the other side, low across the belly and tipped flat, its top leading (never up past the face),
// HOLD_BEATS there, and back. Rolls are on the guest's facing axis, negative = its top toward the guest's right side
const HOLD_BEATS = 2;
const CARRY_BEATS = 2;
const HOLD_SWAY = math.rad(12); // the lean outward on the beat while it stays on a side
const SIDE_TILT = math.rad(28); // roll on the other side: the mirror of its tilt on its own side
const CARRY_TIP = math.rad(90); // extra roll in the middle of a trip, toward where it goes
const CARRY_DIP = 0.85; // studs lower in the middle of a trip: under the face
const ROCK_ANGLE = math.rad(6); // the body rocks on the groove
const BOB_HEIGHT = 0.3; // studs: up between the beats, down on them
const SCUTTLE_HEIGHT = 0.12; // studs: little hops while walking
const SCUTTLE_RATE = 16; // rad/s of those hops
const WALKING_SPEED = 0.3; // studs/s: faster than this, the guest is walking
const SPARKLE_TEXTURE = "rbxasset://textures/particles/sparkles_main.dds";

type BeatListener = (beat: number) => void;
type EventListener = (event: ActiveEvent | undefined) => void;

interface Guest {
	body: BasePart;
	light: PointLight;
	/** Its event's stage colours (the banner's accents), cycled on the beat. */
	colors: Color3[];
	/** A guest with dance joints (GUEST_DANCE_JOINTS: the saxophone crab); `last` is its position a frame ago. */
	dance?: { body: Motor6D; sway: Motor6D; arms: DanceArm[]; last: Vector3 };
}

/** An arm kept between its shoulder (the motor's pivot on the hips) and the grip it holds on the instrument. */
interface DanceArm {
	motor: Motor6D;
	part: BasePart;
	grip: Attachment;
}

/**
 * Follows the running event of any kind (replicated by EventService through ReplicatedStorage's
 * attributes; none while the local player is event immune, i.e. in the tutorial) and crossfades its track, if it has one, over the background music. For a music
 * event, it also follows the track's beats and makes the show
 * on each of them: every fish puffs, the event's guest flashes, sends a sound wave and music notes.
 * Purely visual: the coins dropped on the beat come from the server.
 */
class MusicEventControllerSingleton implements Lifecycle {
	private event?: ActiveEvent;
	private music?: Sound;
	private lastBeat = -1;
	private guests = new Map<Instance, Guest>();
	private guestJanitors = new Map<Instance, Janitor>();
	private effectsFolder!: Folder;
	private beatListeners = new Set<BeatListener>();
	private eventListeners = new Set<EventListener>();
	private rng = new Random();

	public onInit() {
		this.effectsFolder = new Instance("Folder");
		this.effectsFolder.Name = "EventEffects";
		this.effectsFolder.Parent = Workspace;

		for (const attribute of [EVENT_ATTRIBUTES.type, EVENT_ATTRIBUTES.startsAt, EVENT_ATTRIBUTES.endsAt]) {
			ReplicatedStorage.GetAttributeChangedSignal(attribute).Connect(() => this.refreshEvent());
		}
		// Events leave a player in the tutorial alone; the running one joins them when it ends
		Players.LocalPlayer.GetAttributeChangedSignal(EVENT_IMMUNE_ATTRIBUTE).Connect(() => this.refreshEvent());

		CollectionService.GetInstanceAddedSignal(TAGS.EventFish).Connect((guest) => this.trackGuest(guest));
		CollectionService.GetInstanceRemovedSignal(TAGS.EventFish).Connect((guest) => this.untrackGuest(guest));
		for (const guest of CollectionService.GetTagged(TAGS.EventFish)) this.trackGuest(guest);
	}

	public onStart() {
		print("[Client] MusicEventController started.");
		this.refreshEvent(); // already running when joining
		RunService.RenderStepped.Connect((dt) => {
			this.followBeat();
			this.animateDancers(dt);
		});
	}

	/** The running event (undefined when none); listeners are told when it starts / ends. */
	public getEvent(): ActiveEvent | undefined {
		return this.event;
	}

	public onEventChanged(listener: EventListener): () => void {
		this.eventListeners.add(listener);
		return () => this.eventListeners.delete(listener);
	}

	/** Called on every beat of the event's track, in sync with what the player hears. */
	public onBeat(listener: BeatListener): () => void {
		this.beatListeners.add(listener);
		return () => this.beatListeners.delete(listener);
	}

	// ---------------------------------------------------------------------
	// Event & track
	// ---------------------------------------------------------------------

	private refreshEvent() {
		const event = isEventImmune(Players.LocalPlayer) ? undefined : getActiveEvent();
		// The three attributes change one after another: only react to an actual start / end
		if (event?.startsAt === this.event?.startsAt && event?.eventType === this.event?.eventType) return;

		this.event = event;
		this.lastBeat = -1;
		if (event?.config.musicId !== undefined) {
			this.music = AudioController.playEventMusic(event.config.musicId, event.config.musicVolume, event.startsAt);
		} else {
			this.music = undefined;
			AudioController.stopEventMusic();
		}
		for (const listener of this.eventListeners) task.spawn(listener, event);
	}

	/** Beats are read from the track's own position, so the show stays on what the player hears. */
	private followBeat() {
		const event = this.event;
		const music = this.music;
		if (!event || event.config.kind !== "Music" || !music || !music.IsPlaying) return;

		const beat = math.floor((music.TimePosition - event.config.beatOffset) / getBeatLength(event.config));
		if (beat === this.lastBeat || beat < 0) return;
		this.lastBeat = beat; // also catches the loop back to the start of the track
		this.playBeat(beat);
	}

	private playBeat(beat: number) {
		FishAnimationController.pulse();
		for (const [, guest] of this.guests) {
			const color = guest.colors[beat % guest.colors.size()];
			this.flashLight(guest, color);
			this.emitWave(guest, color);
			this.emitNote(guest, beat, color);
		}
		for (const listener of this.beatListeners) task.spawn(listener, beat);
	}

	// ---------------------------------------------------------------------
	// Guest effects: the music visibly comes from it
	// ---------------------------------------------------------------------

	private trackGuest(instance: Instance) {
		if (!instance.IsA("Model") || this.guestJanitors.has(instance)) return;
		// Only the stars of music events (the lantern fish belongs to AbyssEventController)
		const eventType = instance.GetAttribute("EventType") as GameEventType | undefined;
		if (eventType === undefined || GAME_EVENTS[eventType]?.kind !== "Music") return;
		const body = instance.PrimaryPart ?? (instance.WaitForChild("Body", 10) as BasePart | undefined);
		if (!body || !CollectionService.HasTag(instance, TAGS.EventFish) || this.guestJanitors.has(instance)) return;

		const janitor = new Janitor();
		this.guestJanitors.set(instance, janitor);
		const colors = EVENT_BANNER_STYLES[eventType].accents;

		// Coloured stage light: lights up the tank around the guest, flashing on the beat
		const light = janitor.Add(new Instance("PointLight"));
		light.Color = colors[0];
		light.Brightness = LIGHT_BRIGHTNESS;
		light.Range = LIGHT_RANGE;
		light.Shadows = false;
		light.Parent = body;

		// Glitter all around it
		const sparkles = janitor.Add(new Instance("ParticleEmitter"));
		sparkles.Texture = SPARKLE_TEXTURE;
		sparkles.Color = new ColorSequence([
			new ColorSequenceKeypoint(0, colors[0]),
			new ColorSequenceKeypoint(0.5, colors[2]),
			new ColorSequenceKeypoint(1, colors[3]),
		]);
		sparkles.LightEmission = 1;
		sparkles.LightInfluence = 0;
		sparkles.Size = new NumberSequence([
			new NumberSequenceKeypoint(0, 0),
			new NumberSequenceKeypoint(0.4, 0.6),
			new NumberSequenceKeypoint(1, 0),
		]);
		sparkles.Lifetime = new NumberRange(0.5, 1);
		sparkles.Rate = 18;
		sparkles.Speed = new NumberRange(0.5, 2);
		sparkles.SpreadAngle = new Vector2(180, 180);
		sparkles.Rotation = new NumberRange(0, 360);
		sparkles.RotSpeed = new NumberRange(-150, 150);
		sparkles.Shape = Enum.ParticleEmitterShape.Box;
		sparkles.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface;
		sparkles.Parent = body;

		const danceBody = instance.FindFirstChild(GUEST_DANCE_JOINTS.body, true);
		const sway = instance.FindFirstChild(GUEST_DANCE_JOINTS.sway, true);
		const dance =
			danceBody?.IsA("Motor6D") && sway?.IsA("Motor6D")
				? { body: danceBody, sway, arms: this.findDanceArms(instance), last: body.Position }
				: undefined;
		this.guests.set(instance, { body, light, colors, dance });
		janitor.Add(() => this.guests.delete(instance), true);
	}

	/** The arms of a dancing guest: `Arm` motors whose `Grip` value points at an Attachment (see GUEST_DANCE_JOINTS). */
	private findDanceArms(guest: Model): DanceArm[] {
		const arms = new Array<DanceArm>();
		for (const motor of guest.GetDescendants()) {
			if (!motor.IsA("Motor6D") || motor.Name !== GUEST_DANCE_JOINTS.arm || !motor.Part1) continue;
			const grip = motor.FindFirstChild(GUEST_DANCE_JOINTS.grip);
			const target = grip?.IsA("ObjectValue") ? grip.Value : undefined;
			if (target?.IsA("Attachment")) arms.push({ motor, part: motor.Part1, grip: target });
		}
		return arms;
	}

	private untrackGuest(instance: Instance) {
		this.guestJanitors.get(instance)?.Destroy();
		this.guestJanitors.delete(instance);
	}

	/**
	 * Dancing guests, every frame on the track's beat: the instrument goes from one side of the body to the other and
	 * back (getCarryPose), the body rocks and dips on every beat, with little hops while it walks; the arms follow the
	 * instrument from the shoulders. Local only: the server just moves the root.
	 */
	private animateDancers(dt: number) {
		const config = this.event?.config;
		const music = this.music;
		const playing = config?.kind === "Music" && music !== undefined && music.IsPlaying;
		const beat = playing ? (music.TimePosition - config.beatOffset) / getBeatLength(config) : 0;
		for (const [, guest] of this.guests) {
			const dance = guest.dance;
			if (!dance) continue;
			const position = guest.body.Position;
			const walking = dt > 0 && position.sub(dance.last).Magnitude / dt > WALKING_SPEED;
			dance.last = position;
			// At rest (track not playing yet) the instrument stays on its own side
			const rock = playing ? ROCK_ANGLE * math.cos((math.pi * beat) / 2) : 0;
			const lift = playing ? BOB_HEIGHT * math.abs(math.sin(math.pi * beat)) : 0;
			const hop = playing && walking ? SCUTTLE_HEIGHT * math.abs(math.sin(os.clock() * SCUTTLE_RATE)) : 0;
			dance.body.Transform = new CFrame(0, lift + hop, 0).mul(CFrame.Angles(0, 0, rock));
			const sway = playing ? this.getCarryPose(beat, dance.sway.C0.Position.X) : new CFrame();
			dance.sway.Transform = sway;
			this.reachGrips(dance.sway, sway, dance.arms);
		}
	}

	/**
	 * The instrument's offset from its rest pose (its own side, `side` studs from the middle of the hips) at this beat:
	 * a stay on its side, a trip across, a stay on the other side, a trip back (HOLD_BEATS / CARRY_BEATS).
	 */
	private getCarryPose(beat: number, side: number): CFrame {
		const cycle = 2 * (HOLD_BEATS + CARRY_BEATS);
		const t = ((beat % cycle) + cycle) % cycle;
		const smooth = (x: number) => x * x * (3 - 2 * x);
		let across = 0; // 0 on its own side, 1 on the other one
		let heading = 0; // +1 on the way over, -1 on the way back
		let lean = 0; // the stay's sway, outward
		if (t < HOLD_BEATS) {
			lean = -HOLD_SWAY * math.sin((math.pi * t) / HOLD_BEATS);
		} else if (t < HOLD_BEATS + CARRY_BEATS) {
			across = smooth((t - HOLD_BEATS) / CARRY_BEATS);
			heading = 1;
		} else if (t < 2 * HOLD_BEATS + CARRY_BEATS) {
			across = 1;
			lean = HOLD_SWAY * math.sin((math.pi * (t - HOLD_BEATS - CARRY_BEATS)) / HOLD_BEATS);
		} else {
			across = 1 - smooth((t - 2 * HOLD_BEATS - CARRY_BEATS) / CARRY_BEATS);
			heading = -1;
		}
		const trip = math.sin(math.pi * across); // 0 on the sides, 1 halfway
		const roll = SIDE_TILT * across + heading * CARRY_TIP * trip + lean;
		return new CFrame(-2 * side * across, -CARRY_DIP * trip, 0).mul(CFrame.Angles(0, 0, roll));
	}

	/**
	 * Turns and stretches each arm (a cylinder along its X axis, pivot at the shoulder end) to reach its grip, worked out
	 * in the hips' space from the joints themselves (reading the parts' CFrames would lag a frame behind).
	 */
	private reachGrips(sway: Motor6D, transform: CFrame, arms: DanceArm[]) {
		const instrument = sway.C0.mul(transform).mul(sway.C1.Inverse()); // the instrument's root, in the hips' space
		for (const arm of arms) {
			const grip = instrument.mul(arm.grip.CFrame).Position;
			const reach = arm.motor.C0.PointToObjectSpace(grip); // from the shoulder
			const length = reach.Magnitude;
			if (length < 0.05) continue;
			const size = arm.part.Size;
			arm.part.Size = new Vector3(length, size.Y, size.Z);
			arm.motor.C1 = new CFrame(-length / 2, 0, 0);
			arm.motor.Transform = CFrame.lookAt(Vector3.zero, reach).mul(CFrame.Angles(0, math.pi / 2, 0));
		}
	}

	private flashLight(guest: Guest, color: Color3) {
		guest.light.Color = color;
		guest.light.Brightness = LIGHT_FLASH;
		TweenService.Create(guest.light, new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Brightness: LIGHT_BRIGHTNESS,
		}).Play();
	}

	/** A shimmering bubble growing out of the guest and fading: the sound coming out of it. */
	private emitWave(guest: Guest, color: Color3) {
		const size = math.max(guest.body.Size.X, guest.body.Size.Y, guest.body.Size.Z);
		const wave = new Instance("Part");
		wave.Shape = Enum.PartType.Ball;
		wave.Material = Enum.Material.ForceField;
		wave.Color = color;
		wave.Transparency = WAVE_TRANSPARENCY;
		wave.Size = Vector3.one.mul(size * WAVE_START);
		wave.Position = guest.body.Position;
		wave.Anchored = true;
		wave.CanCollide = false;
		wave.CanQuery = false;
		wave.CanTouch = false;
		wave.CastShadow = false;
		wave.Parent = this.effectsFolder;

		const info = new TweenInfo(WAVE_TIME, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
		TweenService.Create(wave, info, { Size: Vector3.one.mul(size * WAVE_GROWTH), Transparency: 1 }).Play();
		task.delay(WAVE_TIME, () => wave.Destroy());
	}

	/** A music note popping out of the guest's head, floating up and away on alternate sides. */
	private emitNote(guest: Guest, beat: number, color: Color3) {
		const body = guest.body;
		const side = beat % 2 === 0 ? 1 : -1;
		const anchor = new Instance("Attachment");
		anchor.WorldPosition = body.Position.add(new Vector3(0, body.Size.Y * 0.4, 0));
		anchor.Parent = Workspace.Terrain;

		const billboard = new Instance("BillboardGui");
		billboard.Size = UDim2.fromScale(NOTE_SIZE, NOTE_SIZE);
		billboard.LightInfluence = 0;
		billboard.Adornee = anchor;
		billboard.Parent = anchor;

		const label = new Instance("TextLabel");
		label.Size = UDim2.fromScale(1, 1);
		label.BackgroundTransparency = 1;
		label.Font = Enum.Font.GothamBlack;
		label.Text = NOTES[this.rng.NextInteger(0, NOTES.size() - 1)];
		label.TextScaled = true;
		label.TextColor3 = color;
		label.TextStrokeColor3 = Color3.fromRGB(255, 255, 255);
		label.TextStrokeTransparency = 0.2;
		label.Rotation = side * this.rng.NextNumber(5, 20);
		label.Parent = billboard;

		const info = new TweenInfo(NOTE_TIME, Enum.EasingStyle.Sine, Enum.EasingDirection.Out);
		// Sideways on screen, whichever way the camera looks at the tank
		const right = Workspace.CurrentCamera?.CFrame.RightVector ?? Vector3.xAxis;
		const drift = right.mul(side * this.rng.NextNumber(NOTE_DRIFT * 0.5, NOTE_DRIFT));
		TweenService.Create(billboard, info, { StudsOffsetWorldSpace: drift.add(new Vector3(0, NOTE_RISE, 0)) }).Play();
		// Fully visible at first, fading out over the end of its flight
		TweenService.Create(label, new TweenInfo(NOTE_TIME, Enum.EasingStyle.Quart, Enum.EasingDirection.In), {
			TextTransparency: 1,
			TextStrokeTransparency: 1,
			Rotation: -side * 15,
		}).Play();
		task.delay(NOTE_TIME, () => anchor.Destroy());
	}
}

export const MusicEventController = new MusicEventControllerSingleton();
