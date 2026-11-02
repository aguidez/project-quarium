import { ReplicatedStorage, Workspace } from "@rbxts/services";

/**
 * Events. Only one runs at a time on a server. Two ways to start one (EventService):
 * - recurring: the server's own clock draws one of the recurring events every 5 to 15 minutes of play;
 *   it only happens on that server;
 * - admin: an admin starts any event (recurring ones too) on every server at once. It replaces the
 *   recurring event running, and no recurring event can start while it runs.
 * Players still in the tutorial are "event immune": events don't touch them (see isEventImmune).
 */
export type GameEventType = "Kpop" | "Abyss" | "Ufo";

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
	/** Chance for each living fish to drop its coin on every beat (owner tending their tank only). */
	beatCoinChance: number;
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

export type GameEventConfig = MusicEventConfig | AbyssEventConfig | UfoEventConfig;

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
		beatCoinChance: 0.2,
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
};

/** Display order of the Studio test buttons. */
export const TEST_EVENT_ORDER: GameEventType[] = ["Kpop", "Abyss", "Ufo"];

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
