import { CollectionService, Players, RunService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { TAGS } from "shared/tags";
import { FISH_TYPES, FishType } from "shared/types/fish";
import { isEventImmune, UfoEventConfig } from "shared/types/events";
import { drawUfoOutcome, UFO_BEAM_ATTRIBUTE, UFO_KIDNAP_TIME, UFO_TIMING, UfoOutcome } from "shared/types/ufo";
import { FISH_VARIANTS } from "shared/types/variants";
import { Aquarium, AquariumService } from "./AquariumService";
import { DataService } from "./DataService";
import { FishService } from "./FishService";

const HOVER_HEIGHT = 5; // studs above the water's surface where the UFO hovers to beam (FocusController UFO_HEADROOM keeps it in view)
const OFFSTAGE_HEIGHT = 34; // where it comes from / goes to, high above the tank
const OFFSTAGE_SIDE = 26; // and off to a side
const BEAM_OFFSET = 1.2; // the fish rises to this far under the UFO's centre
const POLL_INTERVAL = 0.5; // a tank with nothing to take is checked this often

interface Raid {
	aquarium: Aquarium;
	/** Fish already kidnapped during this event: never twice. */
	taken: Set<number>;
	/** Kidnapped and not back yet: dropped back at once if the event stops. */
	away?: { id: number; outcome: UfoOutcome };
}

/**
 * The UFO night (an event of EventService). Over every owned aquarium a UFO takes the fish one at a time: it flies in
 * from high up, beams one up, flies off with it, comes back a little later and drops it back into the water changed
 * (shared/types/ufo: asleep, green or red aura for a minute, a better variant, or the alien fish). About 12 s per
 * kidnapping: 4 to 5 in the event's minute when the tank has the fish. FishService moves the fish; the UFO is a model
 * moved here, its beam drawn by the clients (UfoEventController) from its "Beaming" attribute.
 */
class UfoServiceSingleton implements Lifecycle {
	private raids = new Map<Aquarium, Raid>();
	/** Bumped by every start / stop: running raids stop (and their UFOs leave) once their token is outdated. */
	private token = 0;
	private rng = new Random();
	private sfxRemote = getRemoteEvent("PlaySfx");
	/** Test outcome of an owner's kidnappings (DevCommandService "/ufo", Studio only). */
	private forced = new Map<Player, UfoOutcome>();

	public onInit() {}

	public onStart() {
		print("[Server] UfoService started.");
		Players.PlayerRemoving.Connect((player) => this.forced.delete(player));
	}

	/** Studio tests: every fish of the player's tank comes back with `outcome` (undefined: the normal odds). */
	public forceOutcome(player: Player, outcome: UfoOutcome | undefined) {
		if (outcome === undefined) this.forced.delete(player);
		else this.forced.set(player, outcome);
	}

	/** Runs the UFO night until `endsAt` (server time) or `stop()`; yields. `template`: the UFO model. */
	public run(template: Model, _config: UfoEventConfig, startsAt: number, endsAt: number) {
		this.stop();
		const token = ++this.token;
		const active = () => token === this.token && Workspace.GetServerTimeNow() < endsAt;

		const early = startsAt - Workspace.GetServerTimeNow();
		if (early > 0) task.wait(early); // the night is still falling on the clients
		while (active()) {
			// One UFO per owned aquarium: players joining mid-event (or done with the tutorial) get theirs too
			for (const player of Players.GetPlayers()) {
				if (isEventImmune(player)) continue;
				const aquarium = AquariumService.getAquarium(player);
				if (!aquarium || this.raids.has(aquarium)) continue;
				const raid: Raid = { aquarium, taken: new Set() };
				this.raids.set(aquarium, raid);
				task.spawn(() => this.raidTank(raid, template, token, endsAt));
			}
			task.wait(POLL_INTERVAL);
		}
	}

	/** Ends the night: a fish still in a UFO is dropped back at once (with its outcome), the UFOs leave. */
	public stop() {
		this.token += 1;
		for (const [, raid] of this.raids) {
			const away = raid.away;
			raid.away = undefined;
			if (away) task.spawn(() => this.giveBack(raid, away.id, away.outcome, this.getHover(raid.aquarium), 0.6));
		}
		this.raids.clear();
	}

	private raidTank(raid: Raid, template: Model, token: number, endsAt: number) {
		const aquarium = raid.aquarium;
		const owner = aquarium.owner;
		if (!owner) return;
		const ufo = this.spawnUfo(aquarium, template);
		const stillOn = () => token === this.token && aquarium.owner === owner && ufo.Parent !== undefined;
		while (stillOn()) {
			// No kidnapping that couldn't end before the night does
			if (endsAt - Workspace.GetServerTimeNow() < UFO_KIDNAP_TIME) break;
			const target = FishService.pickKidnapTarget(owner, raid.taken);
			if (!target) {
				task.wait(POLL_INTERVAL);
				continue;
			}
			raid.taken.add(target.id);
			this.kidnap(raid, ufo, target.id, stillOn);
			task.wait(UFO_TIMING.gap); // hovers a moment before the next one
		}
		// Away, high up, then gone
		this.fly(ufo, this.getOffstage(aquarium), UFO_TIMING.leave);
		ufo.Destroy();
		// A new owner of the tank gets a UFO of their own (the raid stays otherwise: one per tank and night)
		if (this.raids.get(aquarium) === raid && aquarium.owner !== owner) this.raids.delete(aquarium);
	}

	private kidnap(raid: Raid, ufo: Model, id: number, stillOn: () => boolean) {
		const aquarium = raid.aquarium;
		// Over the fish, beam it up
		const position = FishService.getFishPosition(id);
		if (!position) return;
		const hover = this.getHover(aquarium, position);
		this.fly(ufo, hover, UFO_TIMING.arrive);
		if (!stillOn()) return;
		ufo.SetAttribute(UFO_BEAM_ATTRIBUTE, true);
		if (aquarium.owner) this.sfxRemote.FireClient(aquarium.owner, "UfoBeam", 1);
		const taken = FishService.beamUp(id, hover.sub(new Vector3(0, BEAM_OFFSET, 0)), UFO_TIMING.beamUp);
		ufo.SetAttribute(UFO_BEAM_ATTRIBUTE, false);
		if (!taken) return;
		const forced = aquarium.owner && this.forced.get(aquarium.owner);
		const outcome = forced || drawUfoOutcome(this.rng.NextNumber());
		if (!stillOn()) {
			// The night ended while it rose: straight back down
			this.giveBack(raid, id, outcome, hover, 0.6);
			return;
		}
		raid.away = { id, outcome };

		// Off with it, a little while, back over another spot, and drop it
		this.fly(ufo, this.getOffstage(aquarium), UFO_TIMING.leave);
		task.wait(UFO_TIMING.away);
		if (raid.away?.id !== id) return; // the night ended meanwhile: stop() gave it back
		const drop = this.getHover(aquarium);
		this.fly(ufo, drop, UFO_TIMING.comeBack);
		if (raid.away?.id !== id) return;
		raid.away = undefined;
		ufo.SetAttribute(UFO_BEAM_ATTRIBUTE, true);
		if (aquarium.owner) this.sfxRemote.FireClient(aquarium.owner, "UfoBeam", 0.85);
		this.giveBack(raid, id, outcome, drop, UFO_TIMING.beamDown);
		ufo.SetAttribute(UFO_BEAM_ATTRIBUTE, false);
	}

	/** Drops the fish back and tells the owner what the UFO did to it. */
	private giveBack(raid: Raid, id: number, outcome: UfoOutcome, from: Vector3, time: number) {
		const owner = raid.aquarium.owner;
		const info = this.describe(id);
		const applied = FishService.beamDown(id, from.sub(new Vector3(0, BEAM_OFFSET, 0)), outcome, time);
		if (!owner || !applied || !info) return;
		const name = info.name;
		const messages: Record<UfoOutcome, string> = {
			Sleep: `Your ${name} came back from the UFO fast asleep: no coins for a minute.`,
			Green: `Your ${name} came back glowing green: its coins x2 for a minute!`,
			Red: `Your ${name} came back glowing red: its coins x0.5 for a minute.`,
			Variant: `Your ${name} came back as ${info.nextVariant ?? "a better variant"}, for good!`,
			Alien: `Your ${name} came back... as an ALIEN FISH! Its scream makes your fish drop coins.`,
		};
		DataService.notify(owner, messages[applied], applied === "Red" || applied === "Sleep" ? "warning" : "info");
	}

	/** The fish's name now, and its next variant's ("an Anomaly Clownfish"), read before the UFO changes it. */
	private describe(id: number): { name: string; nextVariant?: string } | undefined {
		const view = FishService.getFishInfo(id);
		if (!view) return undefined;
		const name = FISH_TYPES[view.fishType].displayName.lower();
		const better = view.nextVariant;
		return { name, nextVariant: better ? `${FISH_VARIANTS[better].displayName.lower()} ${name}` : undefined };
	}

	// ---------------------------------------------------------------------
	// The UFO
	// ---------------------------------------------------------------------

	private spawnUfo(aquarium: Aquarium, template: Model): Model {
		const model = template.Clone();
		model.Name = "Ufo";
		CollectionService.RemoveTag(model, TAGS.EventFishTemplate);
		for (const part of model.GetDescendants()) {
			// Never in the way of clicks on coins / water, nor of a character
			if (part.IsA("BasePart")) {
				part.Anchored = true;
				part.CanCollide = false;
				part.CanQuery = false;
				part.CanTouch = false;
			}
		}
		model.SetAttribute(UFO_BEAM_ATTRIBUTE, false);
		model.PivotTo(new CFrame(this.getOffstage(aquarium)));
		CollectionService.AddTag(model, TAGS.Ufo);
		model.Parent = aquarium.model;
		return model;
	}

	/** Above the water, over `over` (a fish) or a random spot of the tank. */
	private getHover(aquarium: Aquarium, over?: Vector3): Vector3 {
		const bounds = aquarium.waterBounds;
		const x = over?.X ?? this.rng.NextNumber(bounds.min.X + 3, bounds.max.X - 3);
		const z = over?.Z ?? (bounds.min.Z + bounds.max.Z) / 2;
		return new Vector3(x, bounds.max.Y + HOVER_HEIGHT, z);
	}

	/** High above the tank, off to a side: where the UFO comes from and leaves to. */
	private getOffstage(aquarium: Aquarium): Vector3 {
		const side = this.rng.NextNumber() < 0.5 ? -1 : 1;
		const aside = aquarium.cframe.PointToWorldSpace(new Vector3(side * OFFSTAGE_SIDE, 0, 0));
		return new Vector3(aside.X, aquarium.waterBounds.max.Y + OFFSTAGE_HEIGHT, aside.Z);
	}

	/** Glides the UFO to `goal` in `time` seconds (eased), with a slow spin and a little tilt toward where it goes. */
	private fly(ufo: Model, goal: Vector3, time: number) {
		const start = ufo.GetPivot().Position;
		const startSpin = ufo.GetPivot().ToOrientation()[1];
		const direction = goal.sub(start).mul(new Vector3(1, 0, 1));
		const heading = direction.Magnitude > 0.1 ? math.atan2(-direction.X, -direction.Z) : 0;
		let elapsed = 0;
		while (elapsed < time && ufo.Parent) {
			elapsed += RunService.Heartbeat.Wait()[0];
			const alpha = math.min(elapsed / time, 1);
			const eased = alpha * alpha * (3 - 2 * alpha);
			const tilt = direction.Magnitude > 0.1 ? math.rad(10) * math.sin(alpha * math.pi) : 0;
			ufo.PivotTo(
				new CFrame(start.Lerp(goal, eased))
					.mul(CFrame.Angles(0, heading, 0))
					.mul(CFrame.Angles(-tilt, 0, 0))
					.mul(CFrame.Angles(0, startSpin + elapsed * 1.5 - heading, 0)),
			);
		}
	}
}

export const UfoService = new UfoServiceSingleton();
