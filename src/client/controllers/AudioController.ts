import { ContentProvider, Players, SoundService, TweenService, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { MUSIC_ID, SFX, SfxName } from "shared/sounds";
import { GAME_EVENTS } from "shared/types/events";

const MUSIC_VOLUME = 0.3;
const MUSIC_FADE_IN = 3; // seconds
// An event track crossfades over the background music, which stays playing (silent) underneath
const EVENT_FADE_IN = 1.5;
const EVENT_FADE_OUT = 2;

const isSfxName = t.keyOf(SFX);
const isPlaybackSpeed = t.numberConstrained(0.25, 4);

/**
 * Background music and the 2D sound effects (requested by the server, or by the UI such as the egg reveal). Every
 * sound of the game plays through the Master SoundGroup: the player's volume (the sound control, PlayerData.soundVolume)
 * is its Volume. Sounds made elsewhere (the character's footsteps and jumps) join it as they appear.
 */
class AudioControllerSingleton implements Lifecycle {
	private sfxRemote = getRemoteEvent("PlaySfx");
	private music!: Sound;
	private eventMusic?: Sound;
	private sfxTemplates = new Map<SfxName, Sound>();
	private master!: SoundGroup;

	public onInit() {
		this.master = new Instance("SoundGroup");
		this.master.Name = "Master";
		this.master.Volume = 1;
		this.master.Parent = SoundService;
		// Sounds of the game's own scripts and of Roblox's (character sounds) that have no group yet
		const adopt = (instance: Instance) => {
			if (instance.IsA("Sound") && instance.SoundGroup === undefined) instance.SoundGroup = this.master;
		};
		for (const container of [Workspace, SoundService, Players.LocalPlayer]) {
			for (const descendant of container.GetDescendants()) adopt(descendant);
			container.DescendantAdded.Connect(adopt);
		}

		this.music = new Instance("Sound");
		this.music.Name = "BackgroundMusic";
		this.music.SoundId = MUSIC_ID;
		this.music.Looped = true;
		this.music.Volume = 0;
		this.music.Parent = SoundService;

		for (const [name, { id, volume }] of pairs(SFX)) {
			const sound = new Instance("Sound");
			sound.Name = name;
			sound.SoundId = id;
			sound.Volume = volume;
			sound.Parent = SoundService;
			this.sfxTemplates.set(name, sound);
		}

		this.sfxRemote.OnClientEvent.Connect((sfx: unknown, playbackSpeed: unknown) => {
			if (isSfxName(sfx) && isPlaybackSpeed(playbackSpeed)) this.play(sfx, playbackSpeed);
		});
	}

	public onStart() {
		print("[Client] AudioController started.");

		this.music.Play();
		if (!this.eventMusic) {
			const fadeIn = new TweenInfo(MUSIC_FADE_IN, Enum.EasingStyle.Sine, Enum.EasingDirection.Out);
			TweenService.Create(this.music, fadeIn, { Volume: MUSIC_VOLUME }).Play();
		}

		// Load the effects and event tracks now so they play instantly the first time
		// (as Sounds: a bare id would be preloaded as an image)
		const assets = new Array<Instance>();
		for (const [, sound] of this.sfxTemplates) assets.push(sound);
		for (const [, config] of pairs(GAME_EVENTS)) {
			if (config.musicId === undefined) continue;
			const track = new Instance("Sound");
			track.SoundId = config.musicId;
			assets.push(track);
		}
		ContentProvider.PreloadAsync(assets);
	}

	/**
	 * Crossfades from the background music to an event track (looped) whose start is `startsAt`
	 * (Workspace.GetServerTimeNow() time): joining late seeks into it, so every client hears the
	 * same beat at the same time. Returns the track.
	 */
	public playEventMusic(soundId: string, volume: number, startsAt: number): Sound {
		this.stopEventMusic();
		const sound = new Instance("Sound");
		sound.Name = "EventMusic";
		sound.SoundId = soundId;
		sound.Looped = true;
		sound.Volume = 0;
		sound.Parent = SoundService;
		this.eventMusic = sound;

		const fade = new TweenInfo(EVENT_FADE_IN, Enum.EasingStyle.Sine, Enum.EasingDirection.Out);
		TweenService.Create(this.music, fade, { Volume: 0 }).Play();
		task.spawn(() => {
			// Seek once loaded (the load time would shift it otherwise, and the length is unknown before)
			if (!sound.IsLoaded) sound.Loaded.Wait();
			const early = startsAt - Workspace.GetServerTimeNow();
			if (early > 0) task.wait(early);
			if (this.eventMusic !== sound) return;
			const length = sound.TimeLength;
			const elapsed = math.max(Workspace.GetServerTimeNow() - startsAt, 0);
			sound.TimePosition = length > 0 ? elapsed % length : 0;
			sound.Play();
			TweenService.Create(sound, fade, { Volume: volume }).Play();
		});
		return sound;
	}

	/** Fades the event track out and the background music back in. */
	public stopEventMusic() {
		const sound = this.eventMusic;
		if (!sound) return;
		this.eventMusic = undefined;

		const fade = new TweenInfo(EVENT_FADE_OUT, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
		const fadeOut = TweenService.Create(sound, fade, { Volume: 0 });
		fadeOut.Completed.Connect(() => sound.Destroy());
		fadeOut.Play();
		TweenService.Create(this.music, fade, { Volume: MUSIC_VOLUME }).Play();
	}

	/** The player's volume, 0 (muted) to 1: applied at once to every sound (the Master group). */
	public setMasterVolume(volume: number) {
		this.master.Volume = math.clamp(volume, 0, 1);
	}

	/** Non-positional, so it is heard the same wherever the camera is. Overlapping plays are fine. */
	public play(name: SfxName, playbackSpeed = 1) {
		const template = this.sfxTemplates.get(name);
		if (!template) return;
		const sound = template.Clone();
		sound.PlaybackSpeed = playbackSpeed;
		sound.Parent = SoundService;
		sound.Ended.Connect(() => sound.Destroy());
		sound.Play();
		task.delay(10, () => sound.Destroy()); // in case it never ends (failed load)
	}
}

export const AudioController = new AudioControllerSingleton();
