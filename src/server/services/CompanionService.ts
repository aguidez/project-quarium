import { CollectionService, Players, TweenService, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { COMPANION_TYPES, CompanionType, PELICAN_FEED_INTERVAL } from "shared/types/companions";
import { getCompanionMultiplier } from "shared/types/oceanRewards";
import { getPelicanCharges, getPelicanPellets, getSwordfishStats } from "shared/types/perks";
import { isOnboardingDone } from "shared/types/onboarding";
import { getCompanionSlots } from "shared/types/playerData";
import { loadTemplates, scaleModel } from "../templates";
import { Aquarium, AquariumService } from "./AquariumService";
import { CoinService } from "./CoinService";
import { DataService } from "./DataService";
import { FishService } from "./FishService";
import { FoodService } from "./FoodService";

const isCompanionType = t.keyOf(COMPANION_TYPES);

/** Equipped companions show up in the tank of a player who just joined within this delay. */
const UPDATE_INTERVAL = 0.5;
const ENTER_TIME = 0.6; // pops in from nothing
const LEAVE_TIME = 0.4; // shrinks away when unequipped
const MIN_SCALE = 0.05;
const EDGE_MARGIN = 1.5;

// Snail: crawls on the sand, slower than most fish, and picks up its owner's coins without stopping
const SNAIL_SPEED = 3.6; // studs/s while fetching a coin (fish swim at 3-8)
const SNAIL_STROLL_SPEED = 1.2; // studs/s when there is nothing to pick up
const SNAIL_STEP_TIME = 0.2; // re-targets this often, so it follows falling / new coins
const SNAIL_TURN = 0.35; // fraction of the way to the target direction turned per step (no spinning on the spot)
const SNAIL_REACH = 1.8; // horizontal studs from the coin to pick it up
const SNAIL_PICKUP_HEIGHT = 3; // the falling coin must be this low above the sand
const SNAIL_REST_MIN = 1.5; // rests between strolls
const SNAIL_REST_MAX = 4;

// Pelican: perched on the back rim, near a corner (out of the way of the fish), facing the glass
const PELICAN_PERCH_X = -0.36; // × the rim's length, from its middle (left of the tank seen from the front)
const PELICAN_LOOK_ANGLE = math.rad(28); // turns its head (whole body) this far left / right while watching
const PELICAN_LOOK_TIME = 0.6;
const PELICAN_LOOK_PAUSE_MIN = 1.2;
const PELICAN_LOOK_PAUSE_MAX = 3;
const PELICAN_LEAN = math.rad(32); // leans forward to throw
const PELICAN_LEAN_TIME = 0.25;
const PELICAN_PELLET_SPREAD = 1.6; // studs between the pellets of one throw (Double serving)
const PELICAN_PELLET_DELAY = 0.15;
const PELICAN_WATCH_STEP = 0.25; // an on-demand Pelican checks the fish this often

// Water Hen: floats on the surface and paddles from one side to the other (its ability is passive: EggService)
const HEN_SPEED = 1.6; // studs/s
const HEN_STEP_TIME = 0.25;
const HEN_FLOAT = 0.25; // × its height above the surface (the rest is under water)
const HEN_BOB = 0.12; // studs up and down while it floats
const HEN_BOB_PERIOD = 1.6; // seconds
const HEN_FRONT_DEPTH = 0.45; // stays in this front share of the tank (never hidden at the back)
const HEN_REST_MIN = 1.5;
const HEN_REST_MAX = 4;

// Swordfish: swims through the water and grabs its owner's coins while they sink (BALANCE.md §5.8: free, as a maxed
// Snail; its pass quests make it faster with a wider reach, perks.ts)
const SWORDFISH_SPEED = 0.95; // × SNAIL_SPEED while chasing a coin
const SWORDFISH_REACH = 2; // horizontal studs from the coin to grab it
const SWORDFISH_DIVE_SPEED = 6; // studs/s up or down: keeps up with a sinking coin (4 studs/s)
const SWORDFISH_CRUISE_SPEED = 2; // studs/s when there is nothing to grab
const SWORDFISH_STEP_TIME = 0.15;
const SWORDFISH_TURN = 0.45;
const SWORDFISH_REST_MIN = 0.5;
const SWORDFISH_REST_MAX = 2;

interface CompanionEntity {
	owner: Player;
	companionType: CompanionType;
	aquarium: Aquarium;
	model: Model;
	body: BasePart; // invisible anchored root, head toward -Z (FishTemplate layout)
	alive: boolean;
}

function flat(vector: Vector3): Vector3 {
	return new Vector3(vector.X, 0, vector.Z);
}

/**
 * Companions: owned and equipped lists live in PlayerData (granted by quests...), the equipped
 * ones swim / crawl in their owner's aquarium and do their job there, all server-side.
 * Immortal: no hunger, never eaten, never counted as fish.
 */
class CompanionServiceSingleton implements Lifecycle {
	private rng = new Random();
	private templates = new Map<CompanionType, Model>();
	private entities = new Map<Player, Map<CompanionType, CompanionEntity>>();
	private behaviors: Record<CompanionType, (entity: CompanionEntity) => void> = {
		Snail: (entity) => this.snailLoop(entity),
		Pelican: (entity) => this.pelicanLoop(entity),
		WaterHen: (entity) => this.waterHenLoop(entity),
		Swordfish: (entity) => this.swordfishLoop(entity),
	};

	public onInit() {
		const companionTypes = new Array<CompanionType>();
		for (const [companionType] of pairs(COMPANION_TYPES)) companionTypes.push(companionType);
		this.templates = loadTemplates(TAGS.CompanionTemplate, "CompanionType", companionTypes);

		DataService.registerAction("EquipCompanion", isCompanionType, (player, companionType) =>
			this.equip(player, companionType),
		);
		DataService.registerAction("UnequipCompanion", isCompanionType, (player, companionType) =>
			this.unequip(player, companionType),
		);

		Players.PlayerRemoving.Connect((player) => {
			const entities = this.entities.get(player);
			if (entities) {
				for (const [, entity] of entities) this.despawn(entity);
			}
			this.entities.delete(player);
		});
	}

	public onStart() {
		print("[Server] CompanionService started.");

		// The aquarium is assigned after joining (and the data may come later): keep the tanks in line
		while (true) {
			for (const player of Players.GetPlayers()) this.refresh(player);
			task.wait(UPDATE_INTERVAL);
		}
	}

	/** Gives a companion (quest reward...). Returns whether it was equipped, which needs a free slot. */
	public grant(player: Player, companionType: CompanionType, equip: boolean): boolean {
		const data = DataService.getData(player);
		if (!data) return false;
		if (!data.companions.includes(companionType)) data.companions.push(companionType);

		const equipped =
			equip &&
			!data.equippedCompanions.includes(companionType) &&
			data.equippedCompanions.size() < getCompanionSlots(data);
		if (equipped) data.equippedCompanions.push(companionType);
		DataService.sync(player);
		this.refresh(player);
		return equipped;
	}

	private equip(player: Player, companionType: CompanionType) {
		const data = DataService.getData(player);
		if (!data || !data.companions.includes(companionType) || data.equippedCompanions.includes(companionType))
			return;
		if (data.equippedCompanions.size() >= getCompanionSlots(data)) {
			const slots = getCompanionSlots(data);
			DataService.notify(player, `Only ${slots} companion${slots > 1 ? "s" : ""} at a time: unequip one first.`);
			return;
		}
		data.equippedCompanions.push(companionType);
		DataService.sync(player);
		this.refresh(player);
	}

	private unequip(player: Player, companionType: CompanionType) {
		const data = DataService.getData(player);
		const index = data?.equippedCompanions.indexOf(companionType) ?? -1;
		if (!data || index < 0) return;
		data.equippedCompanions.remove(index);
		DataService.sync(player);
		this.refresh(player);
	}

	// ---------------------------------------------------------------------
	// Companions in the aquarium
	// ---------------------------------------------------------------------

	/** Spawns the equipped companions missing from the player's tank, removes the others. */
	private refresh(player: Player) {
		const data = DataService.getData(player);
		const aquarium = AquariumService.getAquarium(player);
		let entities = this.entities.get(player);
		if (!entities) {
			entities = new Map();
			this.entities.set(player, entities);
		}

		for (const [companionType, entity] of entities) {
			const kept = data?.equippedCompanions.includes(companionType) && entity.aquarium === aquarium;
			if (!kept) {
				this.despawn(entity);
				entities.delete(companionType);
			}
		}
		if (!data || !aquarium) return;
		for (const companionType of data.equippedCompanions) {
			if (entities.has(companionType)) continue;
			const entity = this.spawn(player, companionType, aquarium);
			if (entity) entities.set(companionType, entity);
		}
	}

	private spawn(owner: Player, companionType: CompanionType, aquarium: Aquarium): CompanionEntity | undefined {
		const template = this.templates.get(companionType);
		if (!template) return undefined;

		const model = template.Clone();
		model.Name = `${companionType}_${owner.Name}`;
		model.SetAttribute("Owner", owner.UserId);
		model.SetAttribute("CompanionType", companionType);
		CollectionService.RemoveTag(model, TAGS.CompanionTemplate);
		for (const descendant of model.GetDescendants()) {
			// Never in the way of clicks on coins / water
			if (descendant.IsA("BasePart")) {
				descendant.CanCollide = false;
				descendant.CanQuery = false;
				descendant.CanTouch = false;
			}
		}

		const body = model.PrimaryPart!;
		const entity: CompanionEntity = { owner, companionType, aquarium, model, body, alive: true };

		if (companionType === "Pelican") {
			// Pops in on its perch on the back rim, facing the glass (the tank's LookVector)
			model.PivotTo(this.getPerch(entity));
		} else if (companionType === "WaterHen" || companionType === "Swordfish") {
			// On the surface / in the water, somewhere along the front of the tank, facing sideways
			const start = companionType === "WaterHen" ? this.randomSurfacePoint(entity) : this.randomWaterPoint(entity);
			const side = aquarium.cframe.RightVector.mul(this.rng.NextNumber() < 0.5 ? 1 : -1);
			model.PivotTo(CFrame.lookAt(start, start.add(side)));
		} else {
			// Pops in on the sand, somewhere along the front of the tank, facing sideways
			const start = this.randomFloorPoint(entity);
			const side = aquarium.cframe.RightVector.mul(this.rng.NextNumber() < 0.5 ? 1 : -1);
			model.PivotTo(CFrame.lookAt(start, start.add(side)));
		}
		model.ScaleTo(MIN_SCALE);
		CollectionService.AddTag(model, TAGS.Companion);
		model.Parent = aquarium.companionFolder;

		task.spawn(() => {
			scaleModel(model, MIN_SCALE, 1, ENTER_TIME, Enum.EasingStyle.Back);
			// Back on the sand (or its perch) at its full size: it popped in around its centre
			if (companionType === "Pelican") {
				model.PivotTo(this.getPerch(entity));
			} else if (companionType === "WaterHen") {
				const position = body.Position;
				model.PivotTo(body.CFrame.add(new Vector3(0, this.surfaceY(entity) - position.Y, 0)));
			} else if (companionType === "Swordfish") {
				// Already in the water
			} else {
				const position = body.Position;
				model.PivotTo(body.CFrame.add(new Vector3(0, this.floorY(entity) - position.Y, 0)));
			}
			if (entity.alive) this.behaviors[companionType](entity);
		});
		return entity;
	}

	private despawn(entity: CompanionEntity) {
		if (!entity.alive) return;
		entity.alive = false;
		task.spawn(() => {
			const model = entity.model;
			if (model.Parent) scaleModel(model, model.GetScale(), MIN_SCALE, LEAVE_TIME, Enum.EasingStyle.Quad);
			model.Destroy();
		});
	}

	/** Height of the body's centre when resting on the sand (the bottom of the water). */
	private floorY(entity: CompanionEntity): number {
		return entity.aquarium.waterBounds.min.Y + entity.body.Size.Y / 2;
	}

	/** Keeps a point on the sand, inside the tank. */
	private clampToFloor(entity: CompanionEntity, point: Vector3): Vector3 {
		const bounds = entity.aquarium.waterBounds;
		const margin = EDGE_MARGIN + entity.body.Size.Z / 2;
		return new Vector3(
			math.clamp(point.X, bounds.min.X + margin, bounds.max.X - margin),
			this.floorY(entity),
			math.clamp(point.Z, bounds.min.Z + margin, bounds.max.Z - margin),
		);
	}

	private randomFloorPoint(entity: CompanionEntity): Vector3 {
		const bounds = entity.aquarium.waterBounds;
		return this.clampToFloor(
			entity,
			new Vector3(
				this.rng.NextNumber(bounds.min.X, bounds.max.X),
				0,
				this.rng.NextNumber(bounds.min.Z, bounds.max.Z),
			),
		);
	}

	// ---------------------------------------------------------------------
	// Pelican
	// ---------------------------------------------------------------------

	/** Standing on the back rim of the tank (its top), near the left corner, facing the glass. */
	private getPerch(entity: CompanionEntity): CFrame {
		const frame = entity.aquarium.cframe;
		const rim = entity.aquarium.model.FindFirstChild("RimBack");
		let x = PELICAN_PERCH_X * 48;
		let top = entity.aquarium.waterBounds.max.Y + 2.5;
		let z = 10.5;
		if (rim?.IsA("BasePart")) {
			const rimLocal = frame.PointToObjectSpace(rim.Position);
			x = PELICAN_PERCH_X * rim.Size.X;
			z = rimLocal.Z;
			top = rim.Position.Y + rim.Size.Y / 2;
		}
		const position = frame.PointToWorldSpace(new Vector3(x, 0, z));
		const standing = new Vector3(position.X, top + entity.body.Size.Y / 2, position.Z);
		return CFrame.lookAt(standing, standing.add(frame.LookVector));
	}

	/** Seconds between two pellets: PELICAN_FEED_INTERVAL, shortened by the Ocean upgrade (x1.33: every 7.5 s). */
	private getFeedInterval(owner: Player): number {
		return PELICAN_FEED_INTERVAL / this.getMultiplier(owner, "Pelican");
	}

	/** Ocean upgrades of a companion of this owner (shared/types/oceanRewards). */
	private getMultiplier(owner: Player, companion: CompanionType): number {
		const data = DataService.getData(owner);
		return data ? getCompanionMultiplier(data.oceanRewardsClaimed, companion) : 1;
	}

	/** Its owner is looking after the tank (fish frozen otherwise) and done with the tutorial. */
	private canFeed(owner: Player): boolean {
		const data = DataService.getData(owner);
		return (
			data !== undefined &&
			isOnboardingDone(data.onboarding) &&
			AquariumService.isTending(owner) &&
			DataService.getFishTotal(owner) > 0
		);
	}

	private turnTo(
		entity: CompanionEntity,
		goal: CFrame,
		time: number,
		style: Enum.EasingStyle = Enum.EasingStyle.Sine,
	) {
		if (!entity.alive) return;
		TweenService.Create(entity.body, new TweenInfo(time, style, Enum.EasingDirection.InOut), {
			CFrame: goal,
		}).Play();
		task.wait(time);
	}

	/** The owner's perks (quest bonuses). */
	private getPerks(owner: Player) {
		return DataService.getData(owner)?.perks ?? [];
	}

	/**
	 * Watches the tank (turns its head left and right now and then) and feeds the fish:
	 * - by default, every feeding interval it throws food toward a hungry fish (anywhere when none is);
	 * - with the Smart Pelican perk, it stores charges instead (one per interval, up to the perk's
	 *   count) and spends one right away when a fish is hungry and no food is already in the water.
	 * A throw: it turns toward the fish, leans forward and drops 1 pellet (2 with Double serving).
	 */
	private pelicanLoop(entity: CompanionEntity) {
		const owner = entity.owner;
		let nextFeedAt = os.clock() + this.getFeedInterval(owner);
		let charges = 0;
		let maxCharges = 0;
		let chargeAt = os.clock() + this.getFeedInterval(owner);
		// On demand: charges refill one by one, the refill timer only runs while it isn't full
		const updateCharges = () => {
			const max = getPelicanCharges(this.getPerks(owner));
			if (max > maxCharges) charges = max; // starts full (on spawn, or right when the perk is earned)
			maxCharges = max;
			if (charges >= maxCharges) chargeAt = os.clock() + this.getFeedInterval(owner);
			else if (os.clock() >= chargeAt) {
				charges += 1;
				chargeAt = os.clock() + this.getFeedInterval(owner);
			}
			this.showCharges(entity, charges, maxCharges, chargeAt);
		};
		while (entity.alive) {
			const perch = this.getPerch(entity);
			updateCharges();
			if (maxCharges > 0) {
				if (charges > 0 && this.needsFood(owner)) {
					charges -= 1;
					updateCharges();
					this.throwPellet(entity, perch);
					continue;
				}
			} else if (os.clock() >= nextFeedAt) {
				nextFeedAt = os.clock() + this.getFeedInterval(owner);
				if (this.canFeed(owner)) this.throwPellet(entity, perch);
				continue;
			}
			const angle = this.rng.NextNumber(-PELICAN_LOOK_ANGLE, PELICAN_LOOK_ANGLE);
			this.turnTo(entity, perch.mul(CFrame.Angles(0, angle, 0)), PELICAN_LOOK_TIME);
			const pause = this.rng.NextNumber(PELICAN_LOOK_PAUSE_MIN, PELICAN_LOOK_PAUSE_MAX);
			if (maxCharges > 0) {
				// Stops watching as soon as a fish needs food and a charge is ready
				const watchEnd = os.clock() + pause;
				while (entity.alive && os.clock() < watchEnd && !(charges > 0 && this.needsFood(owner))) {
					task.wait(PELICAN_WATCH_STEP);
					updateCharges();
				}
			} else {
				task.wait(math.min(pause, math.max(nextFeedAt - os.clock(), 0)));
			}
		}
	}

	/**
	 * Food charges of an on-demand Pelican, as attributes of its model for its owner's charge gauge
	 * (PelicanChargesController): "Charges", "MaxCharges" (0: feeds on a timer, no gauge), and while
	 * it isn't full "NextChargeAt" (server time) and "ChargeInterval". Only written when they change.
	 */
	private showCharges(entity: CompanionEntity, charges: number, maxCharges: number, chargeAt: number) {
		const model = entity.model;
		const interval = this.getFeedInterval(entity.owner);
		if (model.GetAttribute("Charges") !== charges) model.SetAttribute("Charges", charges);
		if (model.GetAttribute("MaxCharges") !== maxCharges) model.SetAttribute("MaxCharges", maxCharges);
		if (model.GetAttribute("ChargeInterval") !== interval) model.SetAttribute("ChargeInterval", interval);
		const nextChargeAt =
			charges < maxCharges ? Workspace.GetServerTimeNow() + (chargeAt - os.clock()) : undefined;
		const shown = model.GetAttribute("NextChargeAt") as number | undefined;
		// os.clock and the server time drift apart a little: only a real change of the timer is sent
		const changed =
			nextChargeAt === undefined
				? shown !== undefined
				: shown === undefined || math.abs(shown - nextChargeAt) > 0.2;
		if (changed) model.SetAttribute("NextChargeAt", nextChargeAt);
	}

	/** On demand: it can feed, a fish is hungry and no pellet is already in the water for it. */
	private needsFood(owner: Player): boolean {
		return this.canFeed(owner) && FishService.hasHungryFish(owner) && !FoodService.hasFood(owner);
	}

	private throwPellet(entity: CompanionEntity, perch: CFrame) {
		const bounds = entity.aquarium.waterBounds;
		const target =
			FishService.findHungryFishPosition(entity.owner) ??
			new Vector3(
				this.rng.NextNumber(bounds.min.X + 3, bounds.max.X - 3),
				bounds.max.Y,
				this.rng.NextNumber(bounds.min.Z + 3, bounds.max.Z - 3),
			);
		// Faces the target (on the horizontal plane), leans over the water, lets the pellet go, stands back up
		const flatTarget = new Vector3(target.X, perch.Position.Y, target.Z);
		const facing =
			flatTarget.sub(perch.Position).Magnitude > 0.5 ? CFrame.lookAt(perch.Position, flatTarget) : perch;
		this.turnTo(entity, facing, PELICAN_LOOK_TIME);
		this.turnTo(entity, facing.mul(CFrame.Angles(-PELICAN_LEAN, 0, 0)), PELICAN_LEAN_TIME, Enum.EasingStyle.Quad);
		if (!entity.alive) return;
		const body = entity.body;
		const beak = body.CFrame.PointToWorldSpace(new Vector3(0, body.Size.Y * 0.15, -body.Size.Z / 2));
		const pellets = getPelicanPellets(this.getPerks(entity.owner));
		for (let i = 0; i < pellets; i++) {
			// Spread sideways around the target (seen from the front)
			const side = (i - (pellets - 1) / 2) * PELICAN_PELLET_SPREAD;
			FoodService.throwFood(entity.owner, beak, target.add(entity.aquarium.cframe.RightVector.mul(side)));
			if (i < pellets - 1) task.wait(PELICAN_PELLET_DELAY);
		}
		this.turnTo(entity, facing, PELICAN_LEAN_TIME * 1.5, Enum.EasingStyle.Back);
		this.turnTo(entity, perch, PELICAN_LOOK_TIME);
	}

	// ---------------------------------------------------------------------
	// Snail
	// ---------------------------------------------------------------------

	/**
	 * Always heading for the coin it can pick up the soonest (one on the sand before one still
	 * falling), strolling and resting otherwise. Coins within reach are picked up on the way, without
	 * stopping, and it heads straight for the next one.
	 */
	private snailLoop(entity: CompanionEntity) {
		const owner = entity.owner;
		const pickupY = entity.aquarium.waterBounds.min.Y + SNAIL_PICKUP_HEIGHT;
		let strollTarget: Vector3 | undefined;
		let restUntil = 0;

		while (entity.alive) {
			// The Ocean upgrade makes it crawl faster (fetching and strolling)
			const boost = this.getMultiplier(owner, "Snail");
			const coin = CoinService.findCoinToFetch(owner, entity.body.Position, SNAIL_SPEED * boost, pickupY);
			if (coin) {
				strollTarget = undefined;
				if (this.canPickUp(entity, coin, pickupY)) {
					// Straight to the next coin (a refused pickup must not spin the loop without yielding)
					if (!CoinService.collectForOwner(owner, coin, "Snail")) task.wait(0.1);
					continue;
				}
				const target = this.clampToFloor(entity, coin.Position);
				if (flat(target.sub(entity.body.Position)).Magnitude > SNAIL_REACH * 0.5) {
					this.crawlStep(entity, target, SNAIL_SPEED * boost);
					if (coin.Parent && this.canPickUp(entity, coin, pickupY))
						CoinService.collectForOwner(owner, coin, "Snail");
				} else {
					task.wait(0.1); // right under the coin, waiting for it to sink
				}
				continue;
			}

			if (os.clock() < restUntil) {
				task.wait(0.2);
				continue;
			}
			strollTarget ??= this.randomFloorPoint(entity);
			if (flat(strollTarget.sub(entity.body.Position)).Magnitude < 0.5) {
				strollTarget = undefined;
				restUntil = os.clock() + this.rng.NextNumber(SNAIL_REST_MIN, SNAIL_REST_MAX);
				continue;
			}
			this.crawlStep(entity, strollTarget, SNAIL_STROLL_SPEED * boost);
		}
	}

	/** The coin is within reach of the snail and low enough above the sand. */
	private canPickUp(entity: CompanionEntity, coin: BasePart, pickupY: number): boolean {
		return flat(coin.Position.sub(entity.body.Position)).Magnitude <= SNAIL_REACH && coin.Position.Y <= pickupY;
	}

	/** One short glide on the sand toward `target`, turning progressively to face it (yields). */
	private crawlStep(entity: CompanionEntity, target: Vector3, speed: number) {
		const body = entity.body;
		const from = body.Position;
		const offset = flat(target.sub(from));
		const distance = offset.Magnitude;
		if (distance < 0.05) {
			task.wait(SNAIL_STEP_TIME);
			return;
		}

		const direction = offset.Unit;
		const facing = flat(body.CFrame.LookVector);
		let look = facing.Magnitude > 0.01 ? facing.Unit.Lerp(direction, SNAIL_TURN) : direction;
		if (look.Magnitude < 0.01) look = direction; // was facing the exact opposite way
		const position = this.clampToFloor(
			entity,
			from.add(direction.mul(math.min(distance, speed * SNAIL_STEP_TIME))),
		);

		const goal = CFrame.lookAt(position, position.add(look.Unit));
		const tween = TweenService.Create(body, new TweenInfo(SNAIL_STEP_TIME, Enum.EasingStyle.Linear), {
			CFrame: goal,
		});
		tween.Play();
		task.wait(SNAIL_STEP_TIME); // not Completed.Wait(): never fires if the model is destroyed meanwhile
	}

	// ---------------------------------------------------------------------
	// Water Hen
	// ---------------------------------------------------------------------

	/** Height of its body's centre while it floats (most of it above the surface). */
	private surfaceY(entity: CompanionEntity): number {
		return entity.aquarium.waterBounds.max.Y + entity.body.Size.Y * HEN_FLOAT;
	}

	/** A point on the surface, in the front part of the tank. */
	private randomSurfacePoint(entity: CompanionEntity): Vector3 {
		const bounds = entity.aquarium.waterBounds;
		const margin = EDGE_MARGIN + entity.body.Size.Z / 2;
		const frame = entity.aquarium.cframe;
		// The front of a tank is its -Z side (its LookVector): pick a local point, then go to world space
		const halfX = (bounds.max.X - bounds.min.X) / 2 - margin;
		const halfZ = (bounds.max.Z - bounds.min.Z) / 2 - margin;
		const localX = this.rng.NextNumber(-halfX, halfX);
		const localZ = -halfZ + this.rng.NextNumber(0, 2 * halfZ * HEN_FRONT_DEPTH);
		const point = frame.PointToWorldSpace(new Vector3(localX, 0, localZ));
		return new Vector3(
			math.clamp(point.X, bounds.min.X + margin, bounds.max.X - margin),
			this.surfaceY(entity),
			math.clamp(point.Z, bounds.min.Z + margin, bounds.max.Z - margin),
		);
	}

	/** Paddles to a spot of the surface, rests there bobbing, and goes on. */
	private waterHenLoop(entity: CompanionEntity) {
		while (entity.alive) {
			const target = this.randomSurfacePoint(entity);
			while (entity.alive && flat(target.sub(entity.body.Position)).Magnitude > 0.3) {
				this.floatStep(entity, target, HEN_SPEED);
			}
			const restUntil = os.clock() + this.rng.NextNumber(HEN_REST_MIN, HEN_REST_MAX);
			while (entity.alive && os.clock() < restUntil) this.floatStep(entity, entity.body.Position, 0);
		}
	}

	/** One short paddle toward `target` on the surface (or bobbing on the spot at speed 0), turning to face it. */
	private floatStep(entity: CompanionEntity, target: Vector3, speed: number) {
		const body = entity.body;
		const from = body.Position;
		const offset = flat(target.sub(from));
		const distance = offset.Magnitude;
		let look = flat(body.CFrame.LookVector);
		let position = from;
		if (speed > 0 && distance > 0.05) {
			const direction = offset.Unit;
			const turned = look.Magnitude > 0.01 ? look.Unit.Lerp(direction, SNAIL_TURN) : direction;
			look = turned.Magnitude > 0.01 ? turned : direction;
			position = from.add(direction.mul(math.min(distance, speed * HEN_STEP_TIME)));
		}
		if (look.Magnitude < 0.01) look = entity.aquarium.cframe.RightVector;
		const bob = math.sin((os.clock() / HEN_BOB_PERIOD) * 2 * math.pi) * HEN_BOB;
		const floating = new Vector3(position.X, this.surfaceY(entity) + bob, position.Z);
		const goal = CFrame.lookAt(floating, floating.add(look.Unit));
		TweenService.Create(body, new TweenInfo(HEN_STEP_TIME, Enum.EasingStyle.Linear), { CFrame: goal }).Play();
		task.wait(HEN_STEP_TIME);
	}

	// ---------------------------------------------------------------------
	// Swordfish
	// ---------------------------------------------------------------------

	/** Keeps a point inside the water, its whole body included. */
	private clampToWater(entity: CompanionEntity, point: Vector3): Vector3 {
		const bounds = entity.aquarium.waterBounds;
		const margin = EDGE_MARGIN + entity.body.Size.Z / 2;
		const halfY = entity.body.Size.Y / 2;
		return new Vector3(
			math.clamp(point.X, bounds.min.X + margin, bounds.max.X - margin),
			math.clamp(point.Y, bounds.min.Y + halfY, bounds.max.Y - halfY - 0.5),
			math.clamp(point.Z, bounds.min.Z + margin, bounds.max.Z - margin),
		);
	}

	private randomWaterPoint(entity: CompanionEntity): Vector3 {
		const bounds = entity.aquarium.waterBounds;
		return this.clampToWater(
			entity,
			new Vector3(
				this.rng.NextNumber(bounds.min.X, bounds.max.X),
				this.rng.NextNumber(bounds.min.Y, bounds.max.Y),
				this.rng.NextNumber(bounds.min.Z, bounds.max.Z),
			),
		);
	}

	/**
	 * Heads for the coin it can reach the soonest, wherever it is in the water (no waiting for it to sink), and grabs
	 * it once within reach; cruises around the tank otherwise. Its speed and reach come from its perks.
	 */
	private swordfishLoop(entity: CompanionEntity) {
		const owner = entity.owner;
		// The coins are reachable at any height: the "pickup height" is the surface
		const anyHeight = entity.aquarium.waterBounds.max.Y;
		let cruiseTarget: Vector3 | undefined;
		let restUntil = 0;

		while (entity.alive) {
			const stats = getSwordfishStats(this.getPerks(owner), SWORDFISH_SPEED, SWORDFISH_REACH);
			const speed = SNAIL_SPEED * stats.speed;
			const coin = CoinService.findCoinToFetch(owner, entity.body.Position, speed, anyHeight);
			if (coin) {
				cruiseTarget = undefined;
				if (this.canGrab(entity, coin, stats.reach)) {
					if (!CoinService.collectForOwner(owner, coin, "Swordfish")) task.wait(0.1);
					continue;
				}
				this.swimStep(entity, coin.Position, speed);
				if (coin.Parent && this.canGrab(entity, coin, stats.reach))
					CoinService.collectForOwner(owner, coin, "Swordfish");
				continue;
			}

			if (os.clock() < restUntil) {
				task.wait(0.2);
				continue;
			}
			cruiseTarget ??= this.randomWaterPoint(entity);
			if (cruiseTarget.sub(entity.body.Position).Magnitude < 0.5) {
				cruiseTarget = undefined;
				restUntil = os.clock() + this.rng.NextNumber(SWORDFISH_REST_MIN, SWORDFISH_REST_MAX);
				continue;
			}
			this.swimStep(entity, cruiseTarget, SWORDFISH_CRUISE_SPEED);
		}
	}

	/** The coin is within its reach (horizontally, and not far above or below). */
	private canGrab(entity: CompanionEntity, coin: BasePart, reach: number): boolean {
		const offset = coin.Position.sub(entity.body.Position);
		return flat(offset).Magnitude <= reach && math.abs(offset.Y) <= reach + entity.body.Size.Y / 2;
	}

	/** One short swim toward `target`: `speed` across the tank, diving fast enough to follow a sinking coin. */
	private swimStep(entity: CompanionEntity, target: Vector3, speed: number) {
		const body = entity.body;
		const from = body.Position;
		const goalPoint = this.clampToWater(entity, target);
		const offset = flat(goalPoint.sub(from));
		const distance = offset.Magnitude;
		const dy = goalPoint.Y - from.Y;
		const climb = math.clamp(dy, -SWORDFISH_DIVE_SPEED * SWORDFISH_STEP_TIME, SWORDFISH_DIVE_SPEED * SWORDFISH_STEP_TIME);
		let look = flat(body.CFrame.LookVector);
		let position = from.add(new Vector3(0, climb, 0));
		if (distance > 0.05) {
			const direction = offset.Unit;
			const turned = look.Magnitude > 0.01 ? look.Unit.Lerp(direction, SWORDFISH_TURN) : direction;
			look = turned.Magnitude > 0.01 ? turned : direction;
			position = position.add(direction.mul(math.min(distance, speed * SWORDFISH_STEP_TIME)));
		}
		if (look.Magnitude < 0.01) look = entity.aquarium.cframe.RightVector;
		const goal = CFrame.lookAt(position, position.add(look.Unit));
		TweenService.Create(body, new TweenInfo(SWORDFISH_STEP_TIME, Enum.EasingStyle.Linear), { CFrame: goal }).Play();
		task.wait(SWORDFISH_STEP_TIME);
	}
}

export const CompanionService = new CompanionServiceSingleton();
