import { CollectionService, Players, TweenService, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { TAGS } from "shared/tags";
import { isEventImmune, StarfallEventConfig } from "shared/types/events";
import {
	drawStarSize,
	addStarPower,
	getFinalStarCharge,
	getGuaranteedVariant,
	STAR_CAUGHT_ATTRIBUTE,
	STAR_FADE_TIME,
	STAR_FADING_ATTRIBUTE,
	STAR_MAX_BARS,
	STAR_SIZE_ATTRIBUTE,
	STAR_SIZES,
	STARFALL,
	StarSize,
} from "shared/types/stars";
import { FISH_VARIANTS } from "shared/types/variants";
import { Aquarium, AquariumService } from "./AquariumService";
import { DataService } from "./DataService";
import { InteractionService } from "./InteractionService";

const SKY_HEIGHT = 38; // studs above the water where a star shows up
const SKY_SIDE = 20; // and off to a side: it streaks in on a slant, like a shooting star
const FALL_SPEED = 30; // studs/s through the air
const SINK_SPEED = 2.4; // studs/s in the water: slower than a coin, time to catch it
const GROUND_TIME = 6; // seconds on the sand before it vanishes (blinking for the last STAR_FADE_TIME)
const HITBOX_SCALE = 1.4; // clickable ball, bigger than the drawn star
const EDGE_MARGIN = 1.5; // studs kept from the glass
const CAUGHT_LINGER = 0.4; // seconds the caught star stays (unclickable) while the clients burst it
const POLL_INTERVAL = 0.5; // a tank joining mid-event gets its shower this soon

interface Star {
	hitbox: Part;
	owner: Player;
	power: number;
	alive: boolean;
	motion?: Tween;
}

/** The stars of one owner's tank during a starfall. */
interface Shower {
	owner: Player;
	aquarium: Aquarium;
	stars: Set<Star>;
	caught: number;
	fallen: number;
}

/**
 * The starfall (an event of EventService, rules in shared/types/stars). Over every owned aquarium, stars streak down from
 * the sky on a slant, plunge into the water, sink slowly and lie on the sand a few seconds. The owner clicks them like
 * coins (the "CatchStar" interaction): each one adds its power to PlayerData.starCharge. When the event ends, the gauge
 * (at least the floor for the share caught) becomes the star power if it beats the one kept. The server only moves an
 * invisible ball; the clients draw the star around it (StarfallEventController).
 */
class StarfallServiceSingleton implements Lifecycle {
	private showers = new Map<Player, Shower>();
	private starsByHitbox = new Map<BasePart, Star>();
	/** Bumped by every start / stop: running showers stop once their token is outdated. */
	private token = 0;
	private rng = new Random();
	private sfxRemote = getRemoteEvent("PlaySfx");

	public onInit() {
		InteractionService.register("CatchStar", t.instanceIsA("BasePart"), (player, part) => this.catchStar(player, part));
		Players.PlayerRemoving.Connect((player) => {
			const shower = this.showers.get(player);
			if (shower) this.clearShower(shower);
			this.showers.delete(player);
		});
	}

	public onStart() {
		print("[Server] StarfallService started.");
	}

	/** Runs the starfall until `endsAt` (server time) or `stop()`; yields. */
	public run(_config: StarfallEventConfig, startsAt: number, endsAt: number) {
		this.stop();
		const token = ++this.token;
		const active = () => token === this.token && Workspace.GetServerTimeNow() < endsAt;

		const early = startsAt - Workspace.GetServerTimeNow();
		if (early > 0) task.wait(early); // the night is still falling on the clients
		while (active()) {
			// One shower per owned aquarium: players joining mid-event (or done with the tutorial) get theirs too
			for (const player of Players.GetPlayers()) {
				if (isEventImmune(player) || this.showers.has(player)) continue;
				const aquarium = AquariumService.getAquarium(player);
				if (!aquarium) continue;
				const shower: Shower = { owner: player, aquarium, stars: new Set(), caught: 0, fallen: 0 };
				this.showers.set(player, shower);
				task.spawn(() => this.rain(shower, token, startsAt, endsAt));
			}
			task.wait(POLL_INTERVAL);
		}
	}

	/** Ends the starfall: every gauge becomes its owner's star power (if better), the stars left fade out. */
	public stop() {
		this.token += 1;
		for (const [player, shower] of this.showers) {
			this.clearShower(shower);
			this.bankCharge(player, shower);
		}
		this.showers.clear();
	}

	// ---------------------------------------------------------------------
	// Stars
	// ---------------------------------------------------------------------

	/**
	 * Drops the tank's stars over the time left, one per slot of equal length at a random moment of it: a steady rain
	 * rather than clumps. A tank joining late gets its share of the stars for the time left.
	 */
	private rain(shower: Shower, token: number, startsAt: number, endsAt: number) {
		const from = math.max(Workspace.GetServerTimeNow(), startsAt + STARFALL.firstDelay);
		const to = endsAt - STARFALL.lastLead;
		const total = to - (startsAt + STARFALL.firstDelay);
		if (to <= from || total <= 0) return;
		const count = math.round(this.rng.NextInteger(STARFALL.starsMin, STARFALL.starsMax) * ((to - from) / total));
		const slot = (to - from) / math.max(count, 1);
		for (let i = 0; i < count; i++) {
			const at = from + slot * (i + this.rng.NextNumber(0.15, 0.85));
			const wait = at - Workspace.GetServerTimeNow();
			if (wait > 0) task.wait(wait);
			if (token !== this.token || this.showers.get(shower.owner) !== shower) return;
			if (shower.aquarium.owner !== shower.owner) return; // the tank changed hands
			this.spawnStar(shower, drawStarSize(this.rng));
		}
	}

	private spawnStar(shower: Shower, size: StarSize) {
		const config = STAR_SIZES[size];
		const aquarium = shower.aquarium;
		const frame = aquarium.cframe;
		const bounds = aquarium.waterBounds;
		const radius = config.studs / 2;
		const center = bounds.min.add(bounds.max).div(2);
		const halfWidth = math.abs(bounds.max.sub(bounds.min).Dot(frame.RightVector)) / 2 - EDGE_MARGIN - radius;
		const halfDepth = math.abs(bounds.max.sub(bounds.min).Dot(frame.LookVector)) / 2 - EDGE_MARGIN - radius;
		// Lands anywhere across the tank, from its middle to near the glass (where the player looks)
		const landing = center
			.add(frame.RightVector.mul(this.rng.NextNumber(-1, 1) * math.max(halfWidth, 0)))
			.add(frame.LookVector.mul(this.rng.NextNumber(-0.2, 0.6) * math.max(halfDepth, 0)));
		const surface = new Vector3(landing.X, bounds.max.Y - radius, landing.Z);
		const floor = new Vector3(landing.X, bounds.min.Y + radius, landing.Z);
		const side = this.rng.NextNumber() < 0.5 ? -1 : 1;
		const sky = surface
			.add(frame.RightVector.mul(side * SKY_SIDE * this.rng.NextNumber(0.6, 1)))
			.add(new Vector3(0, SKY_HEIGHT, 0));

		const hitbox = new Instance("Part");
		hitbox.Name = `${size}Star`;
		hitbox.Shape = Enum.PartType.Ball;
		hitbox.Size = Vector3.one.mul(config.studs * HITBOX_SCALE);
		hitbox.Transparency = 1;
		hitbox.Anchored = true;
		hitbox.CanCollide = false;
		hitbox.CanTouch = false;
		hitbox.CastShadow = false;
		hitbox.CFrame = new CFrame(sky);
		hitbox.SetAttribute(STAR_SIZE_ATTRIBUTE, size);
		CollectionService.AddTag(hitbox, TAGS.Star); // clients draw it and raycast against it
		hitbox.Parent = aquarium.coinFolder;

		const power = this.rng.NextNumber(config.power[0], config.power[1]);
		const star: Star = { hitbox, owner: shower.owner, power, alive: true };
		shower.stars.add(star);
		shower.fallen += 1;
		this.starsByHitbox.set(hitbox, star);

		// Through the air on its slant, then a slow sink, then a while on the sand
		const fall = TweenService.Create(
			hitbox,
			new TweenInfo(sky.sub(surface).Magnitude / FALL_SPEED, Enum.EasingStyle.Linear),
			{ CFrame: new CFrame(surface) },
		);
		const sink = TweenService.Create(
			hitbox,
			new TweenInfo(math.max(surface.Y - floor.Y, 0.01) / SINK_SPEED, Enum.EasingStyle.Sine, Enum.EasingDirection.Out),
			{ CFrame: new CFrame(floor) },
		);
		fall.Completed.Connect((state) => {
			if (state !== Enum.PlaybackState.Completed || !star.alive) return;
			star.motion = sink;
			sink.Play();
		});
		sink.Completed.Connect((state) => {
			if (state !== Enum.PlaybackState.Completed || !star.alive) return;
			task.delay(GROUND_TIME - STAR_FADE_TIME, () => {
				if (!star.alive) return;
				star.hitbox.SetAttribute(STAR_FADING_ATTRIBUTE, true);
				task.delay(STAR_FADE_TIME, () => this.removeStar(shower, star));
			});
		});
		star.motion = fall;
		fall.Play();
	}

	private removeStar(shower: Shower, star: Star, linger = 0) {
		if (!star.alive) return;
		star.alive = false;
		star.motion?.Cancel();
		shower.stars.delete(star);
		this.starsByHitbox.delete(star.hitbox);
		if (linger <= 0) {
			star.hitbox.Destroy();
			return;
		}
		CollectionService.RemoveTag(star.hitbox, TAGS.Star);
		star.hitbox.SetAttribute(STAR_CAUGHT_ATTRIBUTE, true); // the clients burst it
		task.delay(linger, () => star.hitbox.Destroy());
	}

	private clearShower(shower: Shower) {
		for (const star of [...shower.stars]) this.removeStar(shower, star);
	}

	/** The owner clicked one of their stars, standing at their aquarium: its power goes into the gauge. */
	private catchStar(player: Player, part: BasePart) {
		const star = this.starsByHitbox.get(part);
		const shower = this.showers.get(player);
		if (!star || !star.alive || star.owner !== player || !shower) return;
		if (!AquariumService.isAtOwnAquarium(player)) return;
		const data = DataService.getData(player);
		if (!data) return;
		this.removeStar(shower, star, CAUGHT_LINGER);
		shower.caught += 1;
		data.starCharge = addStarPower(data.starCharge, star.power);
		DataService.sync(player);
		// The chime climbs with the gauge
		this.sfxRemote.FireClient(player, "StarCatch", 1 + (data.starCharge / STAR_MAX_BARS) * 0.5);
	}

	/** End of the event for this owner: the gauge (with its floor) becomes the star power if it is better. */
	private bankCharge(player: Player, shower: Shower) {
		const data = DataService.getData(player);
		if (!data) return;
		const charge = getFinalStarCharge(data.starCharge, shower.caught, shower.fallen);
		data.starCharge = 0;
		if (charge <= 0) {
			DataService.sync(player);
			return;
		}
		const kept = data.starPower >= charge;
		if (!kept) data.starPower = charge;
		DataService.sync(player);
		const guaranteed = getGuaranteedVariant(data.starPower);
		const promise =
			guaranteed === "Normal"
				? "better odds of a rare variant"
				: `at least ${guaranteed === "Anomaly" ? "an" : "a"} ${FISH_VARIANTS[guaranteed].displayName}`;
		DataService.notify(
			player,
			kept
				? `Your saved star power was better: kept! Your next egg hatches ${promise}.`
				: `Star power saved! Your next egg hatches ${promise}.`,
			"info",
		);
	}
}

export const StarfallService = new StarfallServiceSingleton();
