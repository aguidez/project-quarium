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
	isEventImmune,
} from "shared/types/events";
import { STAGE_COLORS } from "client/ui/theme";
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
const SPARKLE_TEXTURE = "rbxasset://textures/particles/sparkles_main.dds";

type BeatListener = (beat: number) => void;
type EventListener = (event: ActiveEvent | undefined) => void;

interface Guest {
	body: BasePart;
	light: PointLight;
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
		RunService.RenderStepped.Connect(() => this.followBeat());
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
		const color = STAGE_COLORS[beat % STAGE_COLORS.size()];
		for (const [, guest] of this.guests) {
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

		// Coloured stage light: lights up the tank around the guest, flashing on the beat
		const light = janitor.Add(new Instance("PointLight"));
		light.Color = STAGE_COLORS[0];
		light.Brightness = LIGHT_BRIGHTNESS;
		light.Range = LIGHT_RANGE;
		light.Shadows = false;
		light.Parent = body;

		// Glitter all around it
		const sparkles = janitor.Add(new Instance("ParticleEmitter"));
		sparkles.Texture = SPARKLE_TEXTURE;
		sparkles.Color = new ColorSequence([
			new ColorSequenceKeypoint(0, STAGE_COLORS[0]),
			new ColorSequenceKeypoint(0.5, STAGE_COLORS[2]),
			new ColorSequenceKeypoint(1, STAGE_COLORS[3]),
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

		this.guests.set(instance, { body, light });
		janitor.Add(() => this.guests.delete(instance), true);
	}

	private untrackGuest(instance: Instance) {
		this.guestJanitors.get(instance)?.Destroy();
		this.guestJanitors.delete(instance);
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
