import { CollectionService, Players, RunService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { AbyssEventConfig, isEventImmune, LURKING_ATTRIBUTE } from "shared/types/events";
import { AQUARIUM_INNER_SIZE } from "shared/types/aquarium";
import { Aquarium, AquariumService } from "./AquariumService";
import { CoinService } from "./CoinService";

// Lantern fish passes. Local Z of a tank: front glass at -10, backdrop at +10
const LAIR_Z = AQUARIUM_INNER_SIZE.Z / 2 - 3; // spawns / vanishes this deep, in the dark of the backdrop
const SIDE_OFFSET_MIN = 6; // spawns this far sideways from its target coin (studs)...
const SIDE_OFFSET_MAX = 14;
const EDGE_MARGIN = 3;
const EMERGE_TIME = 1.2; // glides slowly out of the dark first: the player sees its lure coming
const EMERGE_SPEED = 3; // studs/s
const DART_SPEED = 9; // then darts at the coin
const DART_ACCELERATION = 10; // studs/s²
const FLEE_SPEED = 8;
const TURN_RATE = 6; // higher turns faster (exponential smoothing per second)
const REACH = 1; // studs between its mouth and the coin to snatch it
const MAX_CHASE_TIME = 5; // gives up on a coin it can't catch (a sinking coin moving away...)
const MIN_COIN_LIFETIME = 2.5; // only goes for coins that stay on the sand long enough to be reached
const MAX_FLEE_TIME = 3;
const FADE_TIME = 0.8; // clients fade it out over this long once it flees (see AbyssEventController)
// Pause between two passes in a tank, and how often a tank without coins is checked
const REST_MIN = 0.8;
const REST_MAX = 2.2;
const POLL_INTERVAL = 0.25;

interface Raid {
	aquarium: Aquarium;
}

/**
 * The abyssal raid (an event of EventService). In every owned aquarium a lantern fish makes passes
 * at its owner's coins: it emerges from the dark at the back of the tank, darts at the most valuable
 * coin and snatches it if the owner (or the Snail) didn't collect it first, then swims back into the
 * dark and vanishes, with or without its loot. No cap: it keeps making passes (a short rest between
 * two) until the event ends.
 */
class AbyssServiceSingleton implements Lifecycle {
	private raids = new Map<Aquarium, Raid>();
	/** Bumped by every start / stop: running raids stop (and their fish flee) once their token is outdated. */
	private token = 0;
	private rng = new Random();

	public onInit() {}

	public onStart() {
		print("[Server] AbyssService started.");
	}

	/** Runs the raid until `endsAt` (server time) or `stop()`; yields. `template`: the lantern fish. */
	public run(template: Model, config: AbyssEventConfig, startsAt: number, endsAt: number) {
		this.stop();
		const token = ++this.token;
		const active = () => token === this.token && Workspace.GetServerTimeNow() < endsAt;

		const early = startsAt - Workspace.GetServerTimeNow();
		if (early > 0) task.wait(early); // the world is still going dark on the clients
		while (active()) {
			// One raid per owned aquarium: players joining mid-event (or done with the tutorial) get theirs too
			for (const player of Players.GetPlayers()) {
				if (isEventImmune(player)) continue;
				const aquarium = AquariumService.getAquarium(player);
				if (!aquarium || this.raids.has(aquarium)) continue;
				const raid: Raid = { aquarium };
				this.raids.set(aquarium, raid);
				task.spawn(() => this.raidTank(raid, template, active));
			}
			task.wait(POLL_INTERVAL);
		}
		if (token === this.token) this.raids.clear();
	}

	public stop() {
		this.token += 1;
		this.raids.clear();
	}

	private raidTank(raid: Raid, template: Model, active: () => boolean) {
		const aquarium = raid.aquarium;
		while (active()) {
			const owner = aquarium.owner;
			if (!owner) break; // freed tank: a new owner gets a fresh raid
			const target = CoinService.findCoinToSteal(owner, MIN_COIN_LIFETIME);
			if (!target) {
				task.wait(POLL_INTERVAL);
				continue;
			}
			this.makePass(aquarium, owner, template, target, active);
			task.wait(this.rng.NextNumber(REST_MIN, REST_MAX));
		}
		if (this.raids.get(aquarium) === raid && !aquarium.owner) this.raids.delete(aquarium);
	}

	// ---------------------------------------------------------------------
	// One pass of the lantern fish
	// ---------------------------------------------------------------------

	private spawnFish(aquarium: Aquarium, template: Model, target: Vector3): [Model, BasePart] {
		const model = template.Clone();
		model.Name = "LanternFish";
		CollectionService.RemoveTag(model, TAGS.EventFishTemplate);
		for (const descendant of model.GetDescendants()) {
			// Never in the way of clicks on coins / water
			if (descendant.IsA("BasePart")) {
				descendant.CanCollide = false;
				descendant.CanQuery = false;
				descendant.CanTouch = false;
			}
		}
		model.SetAttribute(LURKING_ATTRIBUTE, true); // invisible until the clients fade it in

		// In the dark at the back, off to one side of the coin, at about its height
		const frame = aquarium.cframe;
		const coin = frame.PointToObjectSpace(target);
		const side = this.rng.NextNumber() < 0.5 ? -1 : 1;
		const halfX = AQUARIUM_INNER_SIZE.X / 2 - EDGE_MARGIN;
		let x = coin.X + side * this.rng.NextNumber(SIDE_OFFSET_MIN, SIDE_OFFSET_MAX);
		if (math.abs(x) > halfX) x = coin.X - side * this.rng.NextNumber(SIDE_OFFSET_MIN, SIDE_OFFSET_MAX);
		const start = this.clampInWater(aquarium, frame.PointToWorldSpace(new Vector3(x, coin.Y, LAIR_Z)), model);
		model.PivotTo(CFrame.lookAt(start, target));
		CollectionService.AddTag(model, TAGS.EventFish); // lure light & fades, client-side
		model.Parent = aquarium.fishFolder;
		return [model, model.PrimaryPart!];
	}

	private makePass(aquarium: Aquarium, owner: Player, template: Model, coin: BasePart, active: () => boolean) {
		let target = coin;
		const [model, body] = this.spawnFish(aquarium, template, target.Position);
		task.wait(); // replicated hidden first, so the clients see it fade in
		model.SetAttribute(LURKING_ATTRIBUTE, false);

		// Approach: a slow glide out of the dark, then a dart at the coin (followed as it sinks)
		const halfLength = body.Size.Z / 2;
		let loot: Model | undefined;
		let speed = EMERGE_SPEED;
		let elapsed = 0;
		while (model.Parent && elapsed < MAX_CHASE_TIME && active() && aquarium.owner === owner) {
			if (!CoinService.isCoinAlive(target)) {
				// Gone while it was still coming out of the dark: it picks another coin. Later: missed
				const other = elapsed < EMERGE_TIME ? CoinService.findCoinToSteal(owner, MIN_COIN_LIFETIME) : undefined;
				if (!other) break;
				target = other;
			}
			const goal = target.Position;
			if (goal.sub(body.Position).Magnitude <= halfLength + REACH) {
				loot = CoinService.stealCoin(owner, target);
				break;
			}
			const dt = RunService.Heartbeat.Wait()[0];
			elapsed += dt;
			if (elapsed > EMERGE_TIME) speed = math.min(speed + DART_ACCELERATION * dt, DART_SPEED);
			this.swimToward(body, goal, speed, dt);
		}
		if (loot) this.carry(model, body, loot);

		// Back into the dark, a little lower, toward the far side of where it came from
		model.SetAttribute(LURKING_ATTRIBUTE, true);
		const frame = aquarium.cframe;
		const here = frame.PointToObjectSpace(body.Position);
		const halfX = AQUARIUM_INNER_SIZE.X / 2 - EDGE_MARGIN;
		const lair = this.clampInWater(
			aquarium,
			frame.PointToWorldSpace(
				new Vector3(
					math.clamp(here.X + this.rng.NextNumber(-8, 8), -halfX, halfX),
					here.Y - this.rng.NextNumber(0, 3),
					LAIR_Z,
				),
			),
			model,
		);
		elapsed = 0;
		while (model.Parent && elapsed < math.max(MAX_FLEE_TIME, FADE_TIME)) {
			const dt = RunService.Heartbeat.Wait()[0];
			elapsed += dt;
			if (lair.sub(body.Position).Magnitude < 0.5 && elapsed >= FADE_TIME) break;
			this.swimToward(body, lair, FLEE_SPEED, dt);
		}
		model.Destroy(); // the loot with it
	}

	/** Holds the stolen coin in its mouth: welded to the body, it follows the fish (and fades with it). */
	private carry(model: Model, body: BasePart, loot: Model) {
		const hitbox = loot.PrimaryPart;
		if (!hitbox) {
			loot.Destroy();
			return;
		}
		hitbox.Anchored = false;
		for (const descendant of loot.GetDescendants()) {
			if (descendant.IsA("BasePart")) {
				descendant.CanQuery = false;
				descendant.Massless = true;
			}
		}
		loot.PivotTo(body.CFrame.mul(new CFrame(0, -body.Size.Y * 0.15, -body.Size.Z / 2)));
		const weld = new Instance("WeldConstraint");
		weld.Part0 = body;
		weld.Part1 = hitbox;
		weld.Parent = hitbox;
		loot.Parent = model;
	}

	/** Moves the (anchored) body toward `goal` at `speed`, turning its head (-Z) smoothly toward it. */
	private swimToward(body: BasePart, goal: Vector3, speed: number, dt: number) {
		const position = body.Position;
		const offset = goal.sub(position);
		const distance = offset.Magnitude;
		if (distance < 1e-3) return;
		const nextPosition = position.add(offset.mul(math.min((speed * dt) / distance, 1)));
		const facing = CFrame.lookAt(Vector3.zero, offset);
		const rotation = body.CFrame.Rotation.Lerp(facing, 1 - math.exp(-TURN_RATE * dt));
		body.CFrame = new CFrame(nextPosition).mul(rotation);
	}

	/** Keeps the whole fish inside the water (its half height above the sand / below the surface). */
	private clampInWater(aquarium: Aquarium, position: Vector3, model: Model): Vector3 {
		const bounds = aquarium.waterBounds;
		const half = model.PrimaryPart!.Size.Y / 2 + 0.5;
		return new Vector3(
			math.clamp(position.X, bounds.min.X, bounds.max.X),
			math.clamp(position.Y, bounds.min.Y + half, bounds.max.Y - half),
			math.clamp(position.Z, bounds.min.Z, bounds.max.Z),
		);
	}
}

export const AbyssService = new AbyssServiceSingleton();
