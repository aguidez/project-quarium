import { CollectionService, Players, TweenService, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { CompanionType } from "shared/types/companions";
import { encodeFoodRefills, FOOD_RESERVE_ATTRIBUTES } from "shared/types/food";
import { FoodLook, getFoodLook } from "shared/types/foodLooks";
import { getFoodReserve, getSatietyBonus } from "shared/types/perks";
import { canDropFood } from "shared/types/onboarding";
import { Aquarium, AquariumService } from "./AquariumService";
import { DataService } from "./DataService";
import { InteractionService } from "./InteractionService";

const FOOD_SIZE = 0.6;
const SINK_SPEED = 2.5; // studs/s
const EDGE_MARGIN = 1;
const MAX_FOOD_PER_PLAYER = 10;
const THROW_TIME = 0.5; // a pellet thrown from above (Pelican) falls this long through the air
const SINK_TURN = math.rad(120); // a food template turns this much around itself while it sinks

export interface Food {
	part: BasePart;
	owner: Player;
	alive: boolean;
	/** The companion that gave it (the Pelican, the Jellyfish), undefined for the player's own pellets. */
	byCompanion?: CompanionType;
}

function isFiniteNumber(value: number) {
	return value === value && math.abs(value) !== math.huge;
}

class FoodServiceSingleton implements Lifecycle {
	private foodByOwner = new Map<Player, Set<Food>>();
	/** The food reserve: server times at which each used portion comes back (shared/types/food.ts). */
	private refillsByOwner = new Map<Player, number[]>();
	private templates = new Map<FoodLook, BasePart>();
	private rng = new Random();

	public onInit() {
		for (const instance of CollectionService.GetTagged(TAGS.FoodTemplate)) {
			const look = instance.GetAttribute("FoodLook");
			if (instance.IsA("BasePart") && typeIs(look, "string")) this.templates.set(look as FoodLook, instance);
			else warn(`[Server] Food template "${instance.GetFullName()}" ignored: needs to be a part with a "FoodLook".`);
		}
		// Rate limiting is handled globally by InteractionService
		InteractionService.register("DropFood", t.Vector3, (player, position) => this.tryDropFood(player, position));

		// Every player starts with a full reserve (it is never saved)
		Players.PlayerAdded.Connect((player) => this.publishReserve(player));
		// The reserve's size and refill time come from the perks (the Fish Keeper line): known once the profile is
		DataService.onLoaded((player) => this.publishReserve(player));
		for (const player of Players.GetPlayers()) this.publishReserve(player);

		Players.PlayerRemoving.Connect((player) => {
			const foods = this.foodByOwner.get(player);
			if (foods) {
				for (const food of foods) this.removeFood(food);
			}
			this.foodByOwner.delete(player);
			this.refillsByOwner.delete(player);
		});
	}

	public onStart() {
		print("[Server] FoodService started.");
	}

	private tryDropFood(player: Player, position: Vector3) {
		if (!isFiniteNumber(position.X) || !isFiniteNumber(position.Z)) return;

		const aquarium = AquariumService.getAquarium(player);
		if (!aquarium || !AquariumService.isAtOwnAquarium(player)) return;

		// Onboarding: food only once the tutorial asks for it (its reserve shows up at that step)
		const step = DataService.getOnboardingStep(player);
		if (!canDropFood(step)) {
			DataService.notify(player, "Follow the tutorial first!", "info");
			return;
		}

		if (DataService.getFishTotal(player) <= 0) {
			DataService.notify(player, "You need at least one fish to feed!");
			return;
		}

		const foods = this.getFoods(player);
		if (foods.size() >= MAX_FOOD_PER_PLAYER) return;

		// Food is free, the reserve is the limit: empty, the click does nothing (the HUD flashes, client side)
		if (!this.takePortion(player)) return;

		this.spawnFood(player, aquarium, position);
	}

	/** Uses one portion of the player's reserve; false when none is ready. */
	private takePortion(player: Player): boolean {
		const now = Workspace.GetServerTimeNow();
		const refills = (this.refillsByOwner.get(player) ?? []).filter((time) => time > now);
		const reserve = getFoodReserve(DataService.getData(player)?.perks ?? []);
		if (refills.size() >= reserve.slots) return false;
		refills.push(now + reserve.refillTime);
		this.refillsByOwner.set(player, refills);
		this.publishReserve(player);
		return true;
	}

	/** The reserve on the Player: the HUD works the refills out from the server times. Again after a Fish Keeper perk. */
	public publishReserve(player: Player) {
		const reserve = getFoodReserve(DataService.getData(player)?.perks ?? []);
		player.SetAttribute(FOOD_RESERVE_ATTRIBUTES.slots, reserve.slots);
		player.SetAttribute(FOOD_RESERVE_ATTRIBUTES.refillTime, reserve.refillTime);
		player.SetAttribute(FOOD_RESERVE_ATTRIBUTES.refills, encodeFoodRefills(this.refillsByOwner.get(player) ?? []));
	}

	private getFoods(player: Player): Set<Food> {
		let foods = this.foodByOwner.get(player);
		if (!foods) {
			foods = new Set();
			this.foodByOwner.set(player, foods);
		}
		return foods;
	}

	/**
	 * A companion (the Pelican) throws a free pellet from `from` (above the tank) into the water above
	 * `target`. Same cap as the player's pellets; returns false when the tank already has too many.
	 */
	public throwFood(owner: Player, from: Vector3, target: Vector3, companion: CompanionType): boolean {
		const aquarium = AquariumService.getAquarium(owner);
		if (!aquarium || this.getFoods(owner).size() >= MAX_FOOD_PER_PLAYER) return false;
		this.spawnFood(owner, aquarium, target, from, companion);
		return true;
	}

	/**
	 * A companion already in the water (the Jellyfish) lets a free pellet go at `at`: it sinks straight down from
	 * there. Same cap as the other pellets; returns false when the tank already has too many.
	 */
	public releaseFood(owner: Player, at: Vector3, companion: CompanionType): boolean {
		const aquarium = AquariumService.getAquarium(owner);
		if (!aquarium || this.getFoods(owner).size() >= MAX_FOOD_PER_PLAYER) return false;
		this.spawnFood(owner, aquarium, at, undefined, companion, at.Y);
		return true;
	}

	private spawnFood(
		owner: Player,
		aquarium: Aquarium,
		requested: Vector3,
		thrownFrom?: Vector3,
		companion?: CompanionType,
		startY?: number,
	) {
		// Never trust the client position: clamp it inside the owner's water
		const bounds = aquarium.waterBounds;
		const x = math.clamp(requested.X, bounds.min.X + EDGE_MARGIN, bounds.max.X - EDGE_MARGIN);
		const z = math.clamp(requested.Z, bounds.min.Z + EDGE_MARGIN, bounds.max.Z - EDGE_MARGIN);
		const top = bounds.max.Y - FOOD_SIZE;
		const start = new Vector3(x, math.clamp(startY ?? top, bounds.min.Y + FOOD_SIZE, top), z);
		const bottom = new Vector3(x, bounds.min.Y + FOOD_SIZE / 2, z);

		const part = this.createPart(owner);
		// A random turn, then a slow spin on the way down (invisible on the round pellet)
		const yaw = this.rng.NextNumber(0, math.pi * 2);
		const tilt = this.rng.NextNumber(-0.4, 0.4);
		part.CFrame = new CFrame(thrownFrom ?? start).mul(CFrame.Angles(tilt, yaw, 0));
		part.Parent = aquarium.foodFolder;

		const food: Food = { part, owner, alive: true, byCompanion: companion };
		this.getFoods(owner).add(food);

		// Sink slowly; the food disappears when it touches the sand
		const sink = TweenService.Create(
			part,
			new TweenInfo(start.sub(bottom).Magnitude / SINK_SPEED, Enum.EasingStyle.Linear),
			{ CFrame: new CFrame(bottom).mul(CFrame.Angles(-tilt, yaw + SINK_TURN, 0)) },
		);
		sink.Completed.Connect((state) => {
			if (state === Enum.PlaybackState.Completed) this.removeFood(food);
		});
		if (!thrownFrom) {
			sink.Play();
			return;
		}
		// Thrown: falls through the air onto the surface first
		const fall = TweenService.Create(
			part,
			new TweenInfo(THROW_TIME, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
			{ CFrame: new CFrame(start).mul(CFrame.Angles(tilt, yaw, 0)) },
		);
		fall.Completed.Connect((state) => {
			if (state === Enum.PlaybackState.Completed && food.alive) sink.Play();
		});
		fall.Play();
	}

	/** The food, as filling as the owner's perks make it (FOOD_LOOKS). */
	private createPart(owner: Player): BasePart {
		const look = getFoodLook(getSatietyBonus(DataService.getData(owner)?.perks ?? []));
		const template = this.templates.get(look);
		let part: BasePart;
		if (template) {
			part = template.Clone();
			CollectionService.RemoveTag(part, TAGS.FoodTemplate);
		} else {
			const ball = new Instance("Part");
			ball.Shape = Enum.PartType.Ball;
			ball.Size = new Vector3(FOOD_SIZE, FOOD_SIZE, FOOD_SIZE);
			ball.Color = Color3.fromRGB(170, 100, 40);
			ball.Material = Enum.Material.SmoothPlastic;
			part = ball;
		}
		part.Name = "Food";
		part.Anchored = true;
		part.CanCollide = false;
		part.CanQuery = false;
		part.CanTouch = false;
		part.CastShadow = false;
		return part;
	}

	private removeFood(food: Food) {
		if (!food.alive) return;
		food.alive = false;
		this.foodByOwner.get(food.owner)?.delete(food);
		food.part.Destroy();
	}

	public hasFood(owner: Player): boolean {
		const foods = this.foodByOwner.get(owner);
		return foods !== undefined && foods.size() > 0;
	}

	/** Fish only go after food dropped by their owner. */
	public findNearestFood(owner: Player, from: Vector3): Food | undefined {
		const foods = this.foodByOwner.get(owner);
		if (!foods) return undefined;

		let nearest: Food | undefined;
		let nearestDistance = math.huge;
		for (const food of foods) {
			const distance = food.part.Position.sub(from).Magnitude;
			if (distance < nearestDistance) {
				nearest = food;
				nearestDistance = distance;
			}
		}
		return nearest;
	}

	/** Returns true if the food was still there and has now been eaten. */
	public consume(food: Food): boolean {
		if (!food.alive) return false;
		this.removeFood(food);
		return true;
	}
}

export const FoodService = new FoodServiceSingleton();
