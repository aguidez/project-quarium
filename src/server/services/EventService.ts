import {
	CollectionService,
	HttpService,
	MemoryStoreService,
	MessagingService,
	Players,
	ReplicatedStorage,
	RunService,
	TextChatService,
	TweenService,
	Workspace,
} from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import {
	EVENT_ATTRIBUTES,
	EVENT_IMMUNE_ATTRIBUTE,
	EVENT_LEAD_TIME,
	EventSource,
	GAME_EVENTS,
	GameEventType,
	getBeatLength,
	getRecurringChance,
	getRecurringEvents,
	isEventImmune,
	MusicEventConfig,
} from "shared/types/events";
import { isOnboardingDone } from "shared/types/onboarding";
import { isAdmin } from "../admins";
import { loadTemplates, scaleModel } from "../templates";
import { AbyssService } from "./AbyssService";
import { Aquarium, AquariumService } from "./AquariumService";
import { DataService } from "./DataService";
import { FishService } from "./FishService";
import { UfoService } from "./UfoService";

const isEventType = t.keyOf(GAME_EVENTS);

// Admin events: started on every server through MessagingService, and remembered in a MemoryStore
// (expiring with the event) so that servers started meanwhile join it. Never from Studio: a playtest
// must not start events on the live servers
const ADMIN_COMMAND = "/event";
const ADMIN_TOPIC = "QuariumAdminEvent";
const ADMIN_STORE = "QuariumEvents";
const ADMIN_STORE_KEY = "AdminEvent";
const MIN_REMAINING = 5; // seconds: an admin event closer to its end than this isn't joined
const isAdminMessage = t.interface({
	action: t.literal("start", "stop"),
	id: t.string,
	eventType: t.optional(isEventType),
	endsAtUtc: t.optional(t.number),
});
type AdminMessage = { action: "start" | "stop"; id: string; eventType?: GameEventType; endsAtUtc?: number };

const CLOCK_STEP = 1; // seconds between two looks at the recurring clock and the players' immunity
const CLOCK_MINUTE = 60; // seconds in a minute of the recurring clock

// Guest fish (the event's star) swimming in every owned aquarium
const GUEST_SPEED = 3.5; // studs/s
const GUEST_MARGIN = 1.5;
const GUEST_TURN_TIME = 0.5;
const ENTER_TIME = 0.8; // pops in from nothing
const LEAVE_TIME = 0.6; // shrinks away when the event ends
const MIN_SCALE = 0.05;
// Now and then the star stops to face the glass and perform for its audience
const PERFORM_CHANCE = 0.4;
const PERFORM_TIME_MIN = 1.5;
const PERFORM_TIME_MAX = 3;
// Walking guest (the saxophone crab): on the sand, on a lane near the glass, always facing it, stepping sideways
const WALK_SPEED = 2.2; // studs/s
const WALK_LANE = 0.35; // fraction of the tank's half depth between its middle and the lane, toward the glass
const WALK_MARGIN = 1.5; // studs kept from the side glasses
const WALK_STEP_MIN = 3; // studs: never a shuffle on the spot
const WALK_PAUSE_MIN = 0.8; // seconds dancing on a spot before the next step
const WALK_PAUSE_MAX = 3;
/** Longest sleep of the beat loop, so guests show up quickly in the tank of a player who just joined. */
const MAX_LOOP_WAIT = 0.25;

interface GuestFish {
	aquarium: Aquarium;
	model: Model;
	body: BasePart; // invisible anchored root, head toward -Z (FishTemplate layout)
	alive: boolean;
}

interface RunningEvent {
	eventType: GameEventType;
	source: EventSource;
	/** Admin events: the id shared by every server, to recognise our own message and the stop order. */
	adminId?: string;
}

function utcNow(): number {
	return DateTime.now().UnixTimestampMillis / 1000;
}

/**
 * Events (one at a time per server). Two sources:
 * - recurring: this server's clock, restarted with the server and at the end of every event, draws one
 *   of the recurring events between minutes 5 and 15 (getRecurringChance). Only this server has it.
 * - admin: "/event <name>" by an admin starts any event on every server (MessagingService + a MemoryStore
 *   for servers started meanwhile). It replaces a recurring event; none can start while it runs.
 * Players still in the tutorial are event immune (EVENT_IMMUNE_ATTRIBUTE, kept up to date here): no guest,
 * thief or bonus in their tank, and their client shows nothing of the event.
 *
 * The abyssal raid is run by AbyssService, the UFO night by UfoService. A music event replaces the background music, sends its star
 * fish to swim in every owned aquarium and, on each beat of the track, lets every fish drop its coin with
 * the event's chance. The beats are timed on the server clock from the replicated start time, which the
 * clients also use to sync the track and the dance effects.
 */
class EventServiceSingleton implements Lifecycle {
	private templates = new Map<GameEventType, Model>();
	private guests = new Map<Aquarium, GuestFish>();
	/** Bumped by every start / stop: a running beat loop stops once its token is outdated. */
	private token = 0;
	private rng = new Random();
	private current?: RunningEvent;
	/** Recurring clock: os.clock() of its start, and the last minute already drawn. */
	private clockStartedAt = os.clock();
	private lastDrawnMinute = 0;

	public onInit() {
		const eventTypes = new Array<GameEventType>();
		for (const [eventType] of pairs(GAME_EVENTS)) eventTypes.push(eventType);
		this.templates = loadTemplates(TAGS.EventFishTemplate, "EventType", eventTypes);

		// Immune until loaded and done with the tutorial
		Players.PlayerAdded.Connect((player) => player.SetAttribute(EVENT_IMMUNE_ATTRIBUTE, true));
		for (const player of Players.GetPlayers()) player.SetAttribute(EVENT_IMMUNE_ATTRIBUTE, true);

		this.createAdminCommand();
	}

	public onStart() {
		print("[Server] EventService started.");
		if (!RunService.IsStudio()) {
			task.spawn(() => this.listenToAdminEvents());
			task.spawn(() => this.joinRunningAdminEvent());
		}
		while (true) {
			task.wait(CLOCK_STEP);
			this.updateImmunity();
			this.tickRecurringClock();
		}
	}

	// ---------------------------------------------------------------------
	// Immunity (tutorial)
	// ---------------------------------------------------------------------

	private updateImmunity() {
		for (const player of Players.GetPlayers()) {
			const data = DataService.getData(player);
			const immune = data === undefined || !isOnboardingDone(data.onboarding);
			if (player.GetAttribute(EVENT_IMMUNE_ATTRIBUTE) !== immune)
				player.SetAttribute(EVENT_IMMUNE_ATTRIBUTE, immune);
		}
	}

	/** Someone on the server an event would reach (not everyone in the tutorial). */
	private hasAudience(): boolean {
		return Players.GetPlayers().some((player) => !isEventImmune(player));
	}

	// ---------------------------------------------------------------------
	// Recurring clock
	// ---------------------------------------------------------------------

	private restartClock() {
		this.clockStartedAt = os.clock();
		this.lastDrawnMinute = 0;
	}

	/**
	 * Once per new minute of the clock (none while an event runs), draws whether a recurring event starts.
	 * With nobody to see it, the minute isn't drawn yet: it is as soon as a player can see it.
	 */
	private tickRecurringClock() {
		if (this.current) return;
		const minute = math.floor((os.clock() - this.clockStartedAt) / CLOCK_MINUTE);
		if (minute <= this.lastDrawnMinute) return;
		const chance = getRecurringChance(minute);
		if (chance <= 0) {
			this.lastDrawnMinute = minute;
			return;
		}
		if (!this.hasAudience()) return;
		this.lastDrawnMinute = minute;
		if (this.rng.NextNumber() >= chance) return;
		const pool = getRecurringEvents();
		if (pool.size() === 0) return;
		const eventType = pool[this.rng.NextInteger(0, pool.size() - 1)];
		this.startEvent(eventType, "Recurring", GAME_EVENTS[eventType].duration);
	}

	// ---------------------------------------------------------------------
	// Admin events
	// ---------------------------------------------------------------------

	/** "/event <name>" starts an admin event everywhere, "/event stop" stops the running event. Admins only. */
	private createAdminCommand() {
		const command = new Instance("TextChatCommand");
		command.Name = "AdminEvent";
		command.PrimaryAlias = ADMIN_COMMAND;
		command.Triggered.Connect((source, text) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onAdminCommand(player, text);
		});
		command.Parent = TextChatService;
	}

	private onAdminCommand(player: Player, text: string) {
		if (!isAdmin(player)) {
			warn(`[Server] ${player.Name} tried ${ADMIN_COMMAND}: refused (not an admin).`);
			return;
		}
		const words = text.split(" ").filter((word) => word !== "");
		const argument = (words[1] ?? "").lower();
		const names = new Array<string>();
		for (const [eventType] of pairs(GAME_EVENTS)) names.push(eventType);
		names.sort();
		const scope = RunService.IsStudio() ? " (Studio: this server only)" : "";

		if (argument === "stop") {
			const wasAdmin = this.current?.adminId !== undefined;
			if (!this.stopRunningEvent()) {
				DataService.notify(player, "No event is running.", "info");
				return;
			}
			DataService.notify(player, `Event stopped${wasAdmin ? scope : ""}.`, "info");
			return;
		}
		const eventType = names.find((name) => name.lower() === argument) as GameEventType | undefined;
		if (!eventType) {
			DataService.notify(
				player,
				`Usage: ${ADMIN_COMMAND} <${names.join(" | ")}> or ${ADMIN_COMMAND} stop`,
				"info",
			);
			return;
		}
		this.startAdminEvent(eventType);
		DataService.notify(player, `${GAME_EVENTS[eventType].displayName} started on every server${scope}.`, "info");
	}

	/**
	 * Ends the running event (the "/event stop" command, the admin panel): everywhere when it is an admin event, only
	 * here when it is this server's recurring one. False when none runs.
	 */
	public stopRunningEvent(): boolean {
		if (!this.current) return false;
		const adminId = this.current.adminId;
		this.stopEvent();
		if (adminId !== undefined) this.broadcastStop(adminId);
		return true;
	}

	/**
	 * Starts an admin event on every server, replacing whatever runs ("/event <name>", the admin panel). In Studio it
	 * only reaches the playtest server: a playtest never starts events on the live servers.
	 */
	public startAdminEvent(eventType: GameEventType) {
		const id = HttpService.GenerateGUID(false);
		const duration = GAME_EVENTS[eventType].duration;
		this.startEvent(eventType, "Admin", duration, id);
		if (RunService.IsStudio()) return;
		const message: AdminMessage = {
			action: "start",
			id,
			eventType,
			endsAtUtc: utcNow() + EVENT_LEAD_TIME + duration,
		};
		task.spawn(() => {
			const [published] = pcall(() => MessagingService.PublishAsync(ADMIN_TOPIC, message));
			if (!published) warn("[Server] Admin event: couldn't reach the other servers.");
			pcall(() =>
				MemoryStoreService.GetHashMap(ADMIN_STORE).SetAsync(ADMIN_STORE_KEY, message, math.ceil(duration + 30)),
			);
		});
	}

	private broadcastStop(id: string) {
		if (RunService.IsStudio()) return;
		task.spawn(() => {
			const message: AdminMessage = { action: "stop", id };
			pcall(() => MessagingService.PublishAsync(ADMIN_TOPIC, message));
			pcall(() => MemoryStoreService.GetHashMap(ADMIN_STORE).RemoveAsync(ADMIN_STORE_KEY));
		});
	}

	private listenToAdminEvents() {
		const [ok, problem] = pcall(() =>
			MessagingService.SubscribeAsync(ADMIN_TOPIC, (packet) => {
				const message = (packet as { Data: unknown }).Data;
				if (isAdminMessage(message)) this.onAdminMessage(message as AdminMessage);
			}),
		);
		if (!ok) warn(`[Server] Admin events: no MessagingService (${problem}).`);
	}

	private onAdminMessage(message: AdminMessage) {
		if (message.action === "stop") {
			if (this.current?.adminId === message.id) this.stopEvent();
			return;
		}
		// Our own message comes back too: that event already runs here
		if (this.current?.adminId === message.id || message.eventType === undefined || message.endsAtUtc === undefined)
			return;
		const remaining = message.endsAtUtc - utcNow() - EVENT_LEAD_TIME;
		if (remaining > MIN_REMAINING) this.startEvent(message.eventType, "Admin", remaining, message.id);
	}

	/** A server started during an admin event joins it for the time it has left. */
	private joinRunningAdminEvent() {
		const [ok, stored] = pcall(() => MemoryStoreService.GetHashMap(ADMIN_STORE).GetAsync(ADMIN_STORE_KEY));
		if (ok && isAdminMessage(stored)) this.onAdminMessage(stored as AdminMessage);
	}

	// ---------------------------------------------------------------------
	// Running an event
	// ---------------------------------------------------------------------

	/**
	 * Starts an event on this server. An admin event replaces whatever runs; a recurring one only starts
	 * when nothing does (it never overrides an admin event).
	 */
	public startEvent(eventType: GameEventType, source: EventSource, duration: number, adminId?: string) {
		if (source === "Recurring" && this.current) return;
		this.clearEvent();
		const token = ++this.token;
		this.current = { eventType, source, adminId };
		const startsAt = Workspace.GetServerTimeNow() + EVENT_LEAD_TIME;
		const endsAt = startsAt + duration;
		ReplicatedStorage.SetAttribute(EVENT_ATTRIBUTES.type, eventType);
		ReplicatedStorage.SetAttribute(EVENT_ATTRIBUTES.startsAt, startsAt);
		ReplicatedStorage.SetAttribute(EVENT_ATTRIBUTES.endsAt, endsAt);
		ReplicatedStorage.SetAttribute(EVENT_ATTRIBUTES.source, source);
		print(`[Server] ${source} event ${eventType} started for ${math.floor(duration)}s.`);

		const config = GAME_EVENTS[eventType];
		if (config.kind === "Music") {
			task.spawn(() => this.run(token, eventType, config, startsAt, endsAt));
		} else if (config.kind === "Abyss") {
			const run = (template: Model) => AbyssService.run(template, config, startsAt, endsAt);
			task.spawn(() => this.runRaid(token, eventType, endsAt, run));
		} else {
			const run = (template: Model) => UfoService.run(template, config, startsAt, endsAt);
			task.spawn(() => this.runRaid(token, eventType, endsAt, run));
		}
	}

	/** Ends the running event (if any); the recurring clock starts over. */
	public stopEvent() {
		this.clearEvent();
		this.restartClock();
	}

	private clearEvent() {
		this.token += 1;
		this.current = undefined;
		ReplicatedStorage.SetAttribute(EVENT_ATTRIBUTES.type, undefined);
		ReplicatedStorage.SetAttribute(EVENT_ATTRIBUTES.startsAt, undefined);
		ReplicatedStorage.SetAttribute(EVENT_ATTRIBUTES.endsAt, undefined);
		ReplicatedStorage.SetAttribute(EVENT_ATTRIBUTES.source, undefined);
		for (const [, guest] of this.guests) this.removeGuest(guest);
		AbyssService.stop(); // its lantern fish flee
		UfoService.stop(); // its UFOs give their fish back and leave
	}

	/** An event run by its own service (the abyssal raid, the UFO night) with the event's model as `template`. */
	private runRaid(token: number, eventType: GameEventType, endsAt: number, run: (template: Model) => void) {
		const template = this.templates.get(eventType);
		if (template) run(template);
		// Without its template there is no thief / UFO, but the world still goes dark until the end
		while (token === this.token && Workspace.GetServerTimeNow() < endsAt) task.wait(MAX_LOOP_WAIT);
		if (token === this.token) {
			print(`[Server] Event ${eventType} ended.`);
			this.stopEvent();
		}
	}

	private run(token: number, eventType: GameEventType, config: MusicEventConfig, startsAt: number, endsAt: number) {
		const beatLength = getBeatLength(config);
		const firstBeatAt = startsAt + config.beatOffset;
		const coins = config.beatCoins;
		// Paced coins: the finale is the last drop beat at least finaleLead seconds before the end
		const finaleBeat =
			coins.mode === "Paced"
				? math.max(math.floor((endsAt - coins.finaleLead - firstBeatAt) / beatLength / coins.every), 0) * coins.every
				: math.huge;
		let finaleDone = false;
		let beat = 0;

		while (token === this.token) {
			const now = Workspace.GetServerTimeNow();
			if (now >= endsAt) break;
			this.updateGuests(eventType);

			const beatAt = firstBeatAt + beat * beatLength;
			if (now >= beatAt) {
				if (coins.mode === "Flat") {
					FishService.dropBeatCoins(coins.chance);
				} else if (!finaleDone && beat >= finaleBeat) {
					finaleDone = true; // even if a hitch skipped its exact beat
					FishService.dropBeatCoins(1);
				} else if (!finaleDone && beat % coins.every === 0) {
					const boost = coins.boostFrom + ((coins.boostTo - coins.boostFrom) * beat) / finaleBeat;
					FishService.dropPacedBeatCoins(boost * coins.every * beatLength);
				}
				// After a hitch, skip the missed beats instead of dropping them all at once
				beat = math.floor((now - firstBeatAt) / beatLength) + 1;
				continue;
			}
			task.wait(math.min(beatAt - now, MAX_LOOP_WAIT));
		}

		if (token === this.token) {
			print(`[Server] Event ${eventType} ended.`);
			this.stopEvent();
		}
	}

	// ---------------------------------------------------------------------
	// Guest fish (music events)
	// ---------------------------------------------------------------------

	/** One guest per owned aquarium (not immune): players joining mid-event get theirs, freed tanks lose it. */
	private updateGuests(eventType: GameEventType) {
		for (const [aquarium, guest] of this.guests) {
			if (aquarium.owner === undefined) this.removeGuest(guest);
		}
		for (const player of Players.GetPlayers()) {
			if (isEventImmune(player)) continue; // in the tutorial: the star waits for the end of it
			const aquarium = AquariumService.getAquarium(player);
			if (aquarium && !this.guests.has(aquarium)) this.spawnGuest(eventType, aquarium);
		}
	}

	private spawnGuest(eventType: GameEventType, aquarium: Aquarium) {
		const template = this.templates.get(eventType);
		if (!template) return;

		const model = template.Clone();
		model.Name = `${eventType}Guest`;
		model.SetAttribute("EventType", eventType);
		CollectionService.RemoveTag(model, TAGS.EventFishTemplate);
		for (const descendant of model.GetDescendants()) {
			// A visitor: never in the way of clicks on coins / water
			if (descendant.IsA("BasePart")) {
				descendant.CanCollide = false;
				descendant.CanQuery = false;
				descendant.CanTouch = false;
			}
		}

		const guest: GuestFish = { aquarium, model, body: model.PrimaryPart!, alive: true };
		this.guests.set(aquarium, guest);

		// Pops in at the middle of the tank facing the glass's side, or (walking) on the sand facing the glass. Placed
		// from its full size: it pops in around its centre, so a walker's feet touch the sand once grown
		const walks = (GAME_EVENTS[eventType] as MusicEventConfig).guestMove === "Walk";
		const bounds = aquarium.waterBounds;
		const center = bounds.min.add(bounds.max).div(2);
		const start = walks ? this.walkSpot(guest, 0) : CFrame.lookAt(center, this.randomSwimPoint(guest));
		model.ScaleTo(MIN_SCALE);
		model.PivotTo(start);
		CollectionService.AddTag(model, TAGS.EventFish); // dance & effects, client-side
		model.Parent = aquarium.fishFolder;

		task.spawn(() => {
			scaleModel(model, MIN_SCALE, 1, ENTER_TIME, Enum.EasingStyle.Back);
			if (walks) this.walkLoop(guest);
			else this.swimLoop(guest);
		});
	}

	private removeGuest(guest: GuestFish) {
		if (!guest.alive) return;
		guest.alive = false;
		if (this.guests.get(guest.aquarium) === guest) this.guests.delete(guest.aquarium);

		task.spawn(() => {
			const model = guest.model;
			if (model.Parent) scaleModel(model, model.GetScale(), MIN_SCALE, LEAVE_TIME, Enum.EasingStyle.Quad);
			model.Destroy();
		});
	}

	private randomSwimPoint(guest: GuestFish): Vector3 {
		const bounds = guest.aquarium.waterBounds;
		const half = guest.body.Size.div(2);
		const horizontal = GUEST_MARGIN + half.Z;
		const vertical = GUEST_MARGIN + half.Y;
		return new Vector3(
			this.rng.NextNumber(bounds.min.X + horizontal, bounds.max.X - horizontal),
			this.rng.NextNumber(bounds.min.Y + vertical, bounds.max.Y - vertical),
			this.rng.NextNumber(bounds.min.Z + horizontal, bounds.max.Z - horizontal),
		);
	}

	/** Plays a tween and yields until it ends, cancelling it if the guest leaves meanwhile. */
	private playTween(guest: GuestFish, tween: Tween) {
		tween.Play();
		while (
			tween.PlaybackState !== Enum.PlaybackState.Completed &&
			tween.PlaybackState !== Enum.PlaybackState.Cancelled
		) {
			if (!guest.alive) {
				tween.Cancel();
				return;
			}
			task.wait();
		}
	}

	/** Same calm wandering as the fish (turn toward a random point, glide to it), with performance pauses. */
	private swimLoop(guest: GuestFish) {
		const body = guest.body;
		while (guest.alive) {
			const from = body.Position;
			const target = this.randomSwimPoint(guest);
			const distance = target.sub(from).Magnitude;
			if (distance > 1) {
				const facing = CFrame.lookAt(from, target);
				const turnInfo = new TweenInfo(GUEST_TURN_TIME, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
				this.playTween(guest, TweenService.Create(body, turnInfo, { CFrame: facing }));
				if (!guest.alive) return;
				const moveInfo = new TweenInfo(
					distance / GUEST_SPEED,
					Enum.EasingStyle.Sine,
					Enum.EasingDirection.InOut,
				);
				this.playTween(guest, TweenService.Create(body, moveInfo, { CFrame: facing.add(target.sub(from)) }));
			}
			if (guest.alive && this.rng.NextNumber() < PERFORM_CHANCE) {
				// The tank's LookVector points out through the front glass, toward the player
				const position = body.Position;
				const audience = CFrame.lookAt(position, position.add(guest.aquarium.cframe.LookVector));
				const turnInfo = new TweenInfo(GUEST_TURN_TIME, Enum.EasingStyle.Back, Enum.EasingDirection.Out);
				this.playTween(guest, TweenService.Create(body, turnInfo, { CFrame: audience }));
				task.wait(this.rng.NextNumber(PERFORM_TIME_MIN, PERFORM_TIME_MAX));
			}
			task.wait(this.rng.NextNumber(0.1, 0.6));
		}
	}

	/** A spot on the walking lane (on the sand, near the glass, facing it), `lateral` studs right of the tank's middle. */
	private walkSpot(guest: GuestFish, lateral: number): CFrame {
		const frame = guest.aquarium.cframe;
		const bounds = guest.aquarium.waterBounds;
		const depth = (math.abs(bounds.max.sub(bounds.min).Dot(frame.LookVector)) / 2) * WALK_LANE;
		const center = bounds.min.add(bounds.max).div(2);
		const spot = center.add(frame.RightVector.mul(lateral)).add(frame.LookVector.mul(depth));
		const floor = new Vector3(spot.X, bounds.min.Y + guest.body.Size.Y / 2, spot.Z);
		return CFrame.lookAt(floor, floor.add(frame.LookVector));
	}

	/** Steps sideways like a crab from spot to spot of its lane, dancing a while on each (its dance is client-side). */
	private walkLoop(guest: GuestFish) {
		const body = guest.body;
		const bounds = guest.aquarium.waterBounds;
		const width = math.abs(bounds.max.sub(bounds.min).Dot(guest.aquarium.cframe.RightVector));
		const range = math.max(width / 2 - WALK_MARGIN - body.Size.X / 2, 0);
		let lateral = 0;
		while (guest.alive) {
			let goal = this.rng.NextNumber(-range, range);
			// Too close to where it stands: the same distance the other way (or toward the far side near a glass)
			if (math.abs(goal - lateral) < WALK_STEP_MIN) {
				goal = math.clamp(lateral + (goal >= lateral ? WALK_STEP_MIN : -WALK_STEP_MIN), -range, range);
				if (math.abs(goal - lateral) < WALK_STEP_MIN) goal = lateral > 0 ? -range : range;
			}
			const distance = math.abs(goal - lateral);
			const stepInfo = new TweenInfo(distance / WALK_SPEED, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
			this.playTween(guest, TweenService.Create(body, stepInfo, { CFrame: this.walkSpot(guest, goal) }));
			lateral = goal;
			task.wait(this.rng.NextNumber(WALK_PAUSE_MIN, WALK_PAUSE_MAX));
		}
	}
}

export const EventService = new EventServiceSingleton();
