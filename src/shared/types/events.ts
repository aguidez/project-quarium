import { ReplicatedStorage, Workspace } from "@rbxts/services";

/**
 * Events. Only one runs at a time on a server. Two ways to start one (EventService):
 * - recurring: the server's own clock draws one of the recurring events every 5 to 15 minutes of play;
 *   it only happens on that server;
 * - admin: an admin starts any event (recurring ones too) on every server at once. It replaces the
 *   recurring event running, and no recurring event can start while it runs.
 * Players still in the tutorial are "event immune": events don't touch them (see isEventImmune).
 */
export type GameEventType = "Kpop" | "Island" | "Abyss" | "Ufo" | "Starfall";

/** How the running event was started (replicated for information). */
export type EventSource = "Recurring" | "Admin";

interface BaseEventConfig {
	displayName: string;
	icon: string;
	/** Line under the name on the event banner. */
	subtitle: string;
	/** Track crossfaded over the background music (looped). Without one, the background music keeps playing. */
	musicId?: string;
	musicVolume: number;
	/** Seconds the event lasts. */
	duration: number;
	/** In the pool the server's recurring clock draws from. Any event can still be started by an admin. */
	recurring: boolean;
	/** Every coin dropped while the event runs is worth this much more (stacks with rebirths and likes). */
	coinMultiplier?: number;
}

/** A musical event: its track replaces the background music and every fish dances to the beat. */
export interface MusicEventConfig extends BaseEventConfig {
	kind: "Music";
	bpm: number;
	/** Seconds into the track of its first beat, so the effects land on the music. */
	beatOffset: number;
	/** The coins the fish drop on the beat, on top of their regular ones (owner tending their tank only). */
	beatCoins: FlatBeatCoins | PacedBeatCoins;
	/**
	 * How the guest star moves (EventService): "Swim" wanders through the water like a fish, now and then facing the glass;
	 * "Walk" stays on the sand near the glass, always facing it, and steps sideways from one spot to another.
	 */
	guestMove: "Swim" | "Walk";
}

/**
 * Joints of a guest that dances on the beat (MusicEventController, client-side only): the `Dance` Motor6D (root → hips)
 * rocks and bobs the whole body, the `Sway` Motor6D (hips → instrument) swings what it holds from side to side. Each
 * `Arm` Motor6D (hips → an arm, pivot at the shoulder) holds an ObjectValue `Grip` pointing at an Attachment of the
 * instrument's root (the claw holding it): the arm is turned and stretched every frame to reach it.
 */
export const GUEST_DANCE_JOINTS = { body: "Dance", sway: "Sway", arm: "Arm", grip: "Grip" } as const;

/**
 * Every living fish drops its coin with the same chance on every beat, whatever its pace: a slow fish of the late game
 * earns many times its income (x14 for a 30 s fish at 130 BPM). Generous: admin events only.
 */
export interface FlatBeatCoins {
	mode: "Flat";
	chance: number;
}

/**
 * Coins on one beat out of `every`, each fish with a chance of boost × seconds between two drops / its income interval:
 * on average every fish earns `boost` times its own income on top of it, whatever its pace, so the event is worth the same minutes of
 * income at every stage of the game. The boost grows from `boostFrom` to `boostTo` (the show builds up); the finale
 * (the last drop beat at least `finaleLead` seconds before the end) makes every fish drop its coin at once, then the
 * beat drops nothing more.
 */
export interface PacedBeatCoins {
	mode: "Paced";
	every: number;
	boostFrom: number;
	boostTo: number;
	finaleLead: number;
}

/**
 * An abyssal raid: the world goes dark, tank backdrops turn into the abyss and a lantern fish
 * sneaks out of the dark in every owned aquarium to steal coins before their owner collects them.
 */
export interface AbyssEventConfig extends BaseEventConfig {
	kind: "Abyss";
}

/**
 * UFO night: the world goes dark under green spotlights, tank backdrops turn into space, and a UFO over every owned
 * aquarium beams fish up one by one and drops them back changed (UfoService, shared/types/ufo).
 */
export interface UfoEventConfig extends BaseEventConfig {
	kind: "Ufo";
}

/**
 * Starfall: a starry night falls, shooting stars streak across the sky and fall into every owned aquarium. Clicked like
 * coins, they fill the owner's star gauge: their next egg hatches a rarer variant (StarfallService, shared/types/stars).
 */
export interface StarfallEventConfig extends BaseEventConfig {
	kind: "Starfall";
}

export type GameEventConfig = MusicEventConfig | AbyssEventConfig | UfoEventConfig | StarfallEventConfig;

export const GAME_EVENTS: Record<GameEventType, GameEventConfig> = {
	Kpop: {
		kind: "Music",
		displayName: "K-POP LIVE",
		icon: "🎤",
		subtitle: "Your fish dance and drop coins!",
		musicId: "rbxassetid://88841459325782",
		musicVolume: 0.5,
		duration: 60,
		recurring: false, // admin event
		bpm: 130,
		beatOffset: 0,
		beatCoins: { mode: "Flat", chance: 0.2 },
		guestMove: "Swim",
	},
	Island: {
		kind: "Music",
		displayName: "ISLAND BREEZE",
		icon: "♫", // drawn as text in the banner's badge (no emoji)
		subtitle: "The crab plays the sax: coins fall on the beat!",
		musicId: "rbxassetid://117781439222323", // August Island Breeze, 60.8 s
		musicVolume: 0.5,
		duration: 60,
		recurring: true,
		bpm: 124,
		// Measured in Studio (AudioAnalyzer onsets): beats every 0.484 s from 0.357 s, the accented ones (the island
		// backbeat) from 0.841 s: beat 0 is the first accented one, so the coins (every 2 beats) fall on them
		beatOffset: 0.841,
		// x2 coins on average (+1 min of income per event at every stage), growing x1.5 → x2.5, then the finale
		beatCoins: { mode: "Paced", every: 2, boostFrom: 0.5, boostTo: 1.5, finaleLead: 2.5 },
		guestMove: "Walk", // the saxophone crab, on the sand like the Snail
	},
	Abyss: {
		kind: "Abyss",
		displayName: "ABYSSAL RAID",
		icon: "🏮",
		subtitle: "Coins x1.5... but a lantern fish wants them!",
		musicId: "rbxassetid://79486059286103",
		musicVolume: 0.5,
		duration: 60, // the lantern fish makes passes at the coins the whole time, at its own pace
		recurring: true,
		coinMultiplier: 1.5,
	},
	Ufo: {
		kind: "Ufo",
		displayName: "UFO NIGHT",
		icon: "UFO", // drawn as text in the banner's badge (no emoji)
		subtitle: "UFOs beam your fish up... and bring them back changed!",
		musicId: "rbxassetid://87373069356270",
		musicVolume: 0.5,
		duration: 60, // 4 to 5 kidnappings per tank (UfoService)
		recurring: true,
	},
	Starfall: {
		kind: "Starfall",
		displayName: "STARFALL",
		icon: "★", // drawn as text in the banner's badge (no emoji)
		subtitle: "Catch the falling stars: your next egg hatches a rare variant!",
		musicId: "rbxassetid://88076339607645", // the owner's choice
		musicVolume: 0.5,
		duration: 60, // 16 to 20 stars per tank (shared/types/stars STARFALL)
		recurring: true,
	},
};

/** Display order of the events in the admin panel. */
export const ADMIN_EVENT_ORDER: GameEventType[] = ["Kpop", "Island", "Abyss", "Ufo", "Starfall"];

/** The events the recurring clock draws from. */
export function getRecurringEvents(): GameEventType[] {
	const events = new Array<GameEventType>();
	for (const [eventType, config] of pairs(GAME_EVENTS)) if (config.recurring) events.push(eventType);
	events.sort();
	return events;
}

/**
 * Recurring clock: it starts with the server and again when any event ends. From minute
 * RECURRING_MIN_MINUTES on, each minute has a chance to start a recurring event, growing until it is
 * certain at minute RECURRING_MAX_MINUTES: minute 5 has 1/11, minute 10 6/11, minute 15 11/11.
 */
export const RECURRING_MIN_MINUTES = 5;
export const RECURRING_MAX_MINUTES = 15;

/** Chance that the recurring event starts at this minute of the clock (0 before the window). */
export function getRecurringChance(minute: number): number {
	if (minute < RECURRING_MIN_MINUTES) return 0;
	const steps = RECURRING_MAX_MINUTES - RECURRING_MIN_MINUTES + 1;
	return math.min((minute - RECURRING_MIN_MINUTES + 1) / steps, 1);
}

/** Player attribute: true while events must not touch the player (absent counts as immune). */
export const EVENT_IMMUNE_ATTRIBUTE = "EventImmune";

/**
 * Whether events leave this player alone: still in the tutorial, or not loaded yet. Set by the server
 * (EventService), read by both sides: no guest, thief or bonus in their tank, no music or darkness
 * on their screen. It turns off by itself when the tutorial ends, and the running event joins them.
 */
export function isEventImmune(player: Player): boolean {
	return player.GetAttribute(EVENT_IMMUNE_ATTRIBUTE) !== false;
}
/** Clients get this long to load the track before the first beat, so everyone starts on time. */
export const EVENT_LEAD_TIME = 1;

/** The running event, replicated through attributes of ReplicatedStorage (late joiners get it too). */
export const EVENT_ATTRIBUTES = {
	type: "EventType",
	/** Workspace.GetServerTimeNow() of the track's start. */
	startsAt: "EventStartsAt",
	endsAt: "EventEndsAt",
	/** EventSource. */
	source: "EventSource",
} as const;

/**
 * Attribute of the lantern fish model (an EventFish of the Abyss event): true while it lurks in the
 * dark (just spawned, or fleeing with or without its loot). The clients fade it in / out from it.
 */
export const LURKING_ATTRIBUTE = "Lurking";

export interface ActiveEvent {
	eventType: GameEventType;
	config: GameEventConfig;
	startsAt: number;
	endsAt: number;
}

export function getBeatLength(config: MusicEventConfig): number {
	return 60 / config.bpm;
}

/** Coin multiplier of the running event for this owner's coins (1 without one, or for an immune owner). */
export function getEventCoinMultiplier(owner: Player): number {
	if (isEventImmune(owner)) return 1;
	return getActiveEvent()?.config.coinMultiplier ?? 1;
}

/** The event replicated in ReplicatedStorage's attributes, if one is running. */
export function getActiveEvent(): ActiveEvent | undefined {
	const eventType = ReplicatedStorage.GetAttribute(EVENT_ATTRIBUTES.type);
	const startsAt = ReplicatedStorage.GetAttribute(EVENT_ATTRIBUTES.startsAt);
	const endsAt = ReplicatedStorage.GetAttribute(EVENT_ATTRIBUTES.endsAt);
	if (!typeIs(eventType, "string") || !typeIs(startsAt, "number") || !typeIs(endsAt, "number")) return undefined;
	const config = GAME_EVENTS[eventType as GameEventType] as GameEventConfig | undefined;
	if (!config || Workspace.GetServerTimeNow() >= endsAt) return undefined;
	return { eventType: eventType as GameEventType, config, startsAt, endsAt };
}
