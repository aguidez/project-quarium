import { CollectionService, Players, TweenService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { TAGS } from "shared/tags";
import { CompanionType } from "shared/types/companions";
import { COIN_HITBOX_SCALE, COIN_TYPES, CoinType, FART_BUBBLE_VALUE } from "shared/types/fish";
import { COIN_BOUNCE_TIME, getGroundTimeBonus, hasCoinBounce } from "shared/types/perks";
import { loadTemplates } from "../templates";
import { AquariumService } from "./AquariumService";
import { DataService } from "./DataService";
import { InteractionService } from "./InteractionService";

const SINK_SPEED = 4; // studs/s
const EDGE_MARGIN = 1;
const GROUND_LIFETIME = 5; // seconds a coin stays on the sand before vanishing
const BLINK_DURATION = 1.5; // last part of the ground lifetime, blinking as a warning
const BLINK_INTERVAL = 0.15;
const BOUNCE_HEIGHT = 2.2; // studs a coin hops back up with the Bouncy coins perk (the Snail still reaches it)
const MAX_COINS_PER_PLAYER = 80;

// Fart bubbles of weak fish (see spawnBubble): built here, no Studio template
const BUBBLE_SIZE = 1.1; // studs
const BUBBLE_RISE_SPEED = 2.2; // studs/s: slow enough to be clicked on the way up
const BUBBLE_COLOR = Color3.fromRGB(150, 225, 80); // a "fart" green, still readable through the water

// Special coin sparkles (built-in Roblox sparkle texture)
const SPARKLE_TEXTURE = "rbxasset://textures/particles/sparkles_main.dds";
const SPARKLE_COLOR = new ColorSequence(Color3.fromRGB(255, 240, 160), Color3.fromRGB(255, 255, 255));
const GLOW_COLOR = Color3.fromRGB(255, 210, 90);

// Ghost coins (a ghost fish's sparkling coins, see spawnCoin): translucent, pale, with faint wisps
const GHOST_TRANSPARENCY = 0.45;
const GHOST_TINT = Color3.fromRGB(185, 235, 255);
const GHOST_WISP_TEXTURE = "rbxasset://textures/particles/smoke_main.dds";

interface Coin {
	model: Model;
	hitbox: BasePart; // invisible clickable root of the Studio template
	visuals: BasePart[]; // the visible parts (blink)
	owner: Player;
	value: number;
	special: boolean;
	frozen: boolean; // onboarding coin: stays where it was dropped until collected
	bubble: boolean; // a weak fish's fart: rises to the surface instead of sinking
	alive: boolean;
	ghost: boolean; // a ghost fish's coin: translucent
	motion?: Tween; // sinking / rising, cancelled when a lantern fish snatches it
	vanishesAt?: number; // os.clock(), once it lies on the sand
}

/** `value`: money credited. `frozen`: the onboarding coin. */
/** `companion`: the companion that picked it up (the Snail, the Swordfish), undefined when clicked. */
type CoinCollectedCallback = (player: Player, frozen: boolean, value: number, companion?: CompanionType) => void;

/** Twinkle: grows from nothing to `peak` then fades back to nothing. */
function twinkle(peak: number): NumberSequence {
	return new NumberSequence([
		new NumberSequenceKeypoint(0, 0),
		new NumberSequenceKeypoint(0.4, peak),
		new NumberSequenceKeypoint(1, 0),
	]);
}

/** A ghost coin: translucent and pale, trailing faint wisps, with a cold glow. */
function addGhostLook(hitbox: BasePart, visuals: BasePart[], diameter: number) {
	for (const part of visuals) {
		part.Transparency = GHOST_TRANSPARENCY;
		const appearance = part.FindFirstChildOfClass("SurfaceAppearance");
		if (appearance) appearance.Color = appearance.Color.Lerp(GHOST_TINT, 0.6);
	}
	const wisps = new Instance("ParticleEmitter");
	wisps.Name = "Wisps";
	wisps.Texture = GHOST_WISP_TEXTURE;
	wisps.Color = new ColorSequence(GHOST_TINT);
	wisps.LightEmission = 0.6;
	wisps.LightInfluence = 0;
	wisps.Transparency = new NumberSequence([
		new NumberSequenceKeypoint(0, 1),
		new NumberSequenceKeypoint(0.3, 0.6),
		new NumberSequenceKeypoint(1, 1),
	]);
	wisps.Size = twinkle(math.max(diameter * 0.7, 0.6));
	wisps.Lifetime = new NumberRange(0.8, 1.4);
	wisps.Rate = 6;
	wisps.Speed = new NumberRange(0.3, 0.8);
	wisps.EmissionDirection = Enum.NormalId.Top;
	wisps.SpreadAngle = new Vector2(30, 30);
	wisps.Parent = hitbox;

	const light = new Instance("PointLight");
	light.Color = GHOST_TINT;
	light.Brightness = 1.2;
	light.Range = 3 + diameter * 2;
	light.Shadows = false;
	light.Parent = hitbox;
}

/** Sparkles around a special coin: small twinkles over its face, a periodic star glint and a warm glow. */
function addSparkles(hitbox: BasePart, face: BasePart, diameter: number) {
	const sparkles = new Instance("ParticleEmitter");
	sparkles.Name = "Sparkles";
	sparkles.Texture = SPARKLE_TEXTURE;
	sparkles.Color = SPARKLE_COLOR;
	sparkles.LightEmission = 1;
	sparkles.LightInfluence = 0;
	sparkles.Brightness = 2;
	sparkles.ZOffset = 0.5;
	sparkles.Size = twinkle(math.max(diameter * 0.5, 0.45));
	sparkles.Lifetime = new NumberRange(0.4, 0.8);
	sparkles.Rate = 24;
	sparkles.Speed = new NumberRange(0.5, 1.5);
	sparkles.SpreadAngle = new Vector2(180, 180);
	sparkles.Rotation = new NumberRange(0, 360);
	sparkles.RotSpeed = new NumberRange(-120, 120);
	sparkles.Shape = Enum.ParticleEmitterShape.Box;
	sparkles.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface;
	sparkles.Parent = face; // emits over the coin's face, sized like the coin

	const center = new Instance("Attachment");
	center.Name = "GlintCenter";
	center.Parent = hitbox;

	const glint = new Instance("ParticleEmitter");
	glint.Name = "Glint";
	glint.Texture = SPARKLE_TEXTURE;
	glint.Color = SPARKLE_COLOR;
	glint.LightEmission = 1;
	glint.LightInfluence = 0;
	glint.Brightness = 3;
	glint.ZOffset = 0.6;
	glint.Size = twinkle(math.max(diameter * 1.5, 1.2));
	glint.Lifetime = new NumberRange(0.6);
	glint.Rate = 2.5;
	glint.Speed = new NumberRange(0);
	glint.Rotation = new NumberRange(0, 360);
	glint.RotSpeed = new NumberRange(90);
	glint.LockedToPart = true;
	glint.Parent = center;

	const light = new Instance("PointLight");
	light.Color = GLOW_COLOR;
	light.Brightness = 2;
	light.Range = 4 + diameter * 2;
	light.Shadows = false;
	light.Parent = hitbox;
}

/** Coins dropped by fish. Money is only credited when the owner clicks a coin. */
class CoinServiceSingleton implements Lifecycle {
	private popupRemote = getRemoteEvent("MoneyPopup");
	private sfxRemote = getRemoteEvent("PlaySfx");
	private rng = new Random();
	private coinsByHitbox = new Map<BasePart, Coin>();
	private coinsByOwner = new Map<Player, Set<Coin>>();
	private templates = new Map<CoinType, Model>();
	private collectedCallbacks = new Array<CoinCollectedCallback>();

	public onInit() {
		this.templates = loadTemplates(TAGS.CoinTemplate, "CoinType", COIN_TYPES);

		// Rate limiting is handled globally by InteractionService
		InteractionService.register("CollectCoin", t.instanceIsA("BasePart"), (player, part) =>
			this.collect(player, part),
		);

		Players.PlayerRemoving.Connect((player) => {
			const coins = this.coinsByOwner.get(player);
			if (coins) {
				for (const coin of coins) this.removeCoin(coin);
			}
			this.coinsByOwner.delete(player);
		});
	}

	public onStart() {
		print("[Server] CoinService started.");
	}

	private getCoins(owner: Player): Set<Coin> {
		let coins = this.coinsByOwner.get(owner);
		if (!coins) {
			coins = new Set();
			this.coinsByOwner.set(owner, coins);
		}
		return coins;
	}

	/**
	 * Drops a coin from `from` (usually a fish's position) into the owner's aquarium. A frozen coin
	 * (onboarding) doesn't sink nor expire: it waits in the water, highlighted, until collected. A ghost
	 * coin (a ghost fish's, already worth more) is translucent instead of sparkling.
	 */
	public spawnCoin(
		owner: Player,
		coinType: CoinType,
		value: number,
		from: Vector3,
		special: boolean,
		frozen = false,
		ghost = false,
	) {
		const aquarium = AquariumService.getAquarium(owner);
		const template = this.templates.get(coinType);
		if (!aquarium || !template) return;
		const coins = this.getCoins(owner);
		if (coins.size() >= MAX_COINS_PER_PLAYER) return;

		// Clone the Studio-made coin (ServerStorage.Assets.Coins)
		const model = template.Clone();
		model.Name = ghost ? `Ghost${coinType}Coin` : special ? `Special${coinType}Coin` : `${coinType}Coin`;
		CollectionService.RemoveTag(model, TAGS.CoinTemplate);
		const hitbox = model.PrimaryPart!;
		// Bigger clickable area than the visible coin; resizing keeps the hitbox centred,
		// so the welded coin mesh doesn't move
		hitbox.Size = hitbox.Size.mul(COIN_HITBOX_SCALE);
		hitbox.SetAttribute("Special", special);
		if (frozen) hitbox.SetAttribute("Frozen", true); // highlighted by the client (OnboardingController)
		if (ghost) hitbox.SetAttribute("Ghost", true);

		const visuals = new Array<BasePart>();
		let radius = 0;
		for (const descendant of model.GetDescendants()) {
			if (descendant.IsA("BasePart") && descendant !== hitbox) {
				visuals.push(descendant);
				radius = math.max(radius, descendant.Size.Y / 2);
			}
		}
		if (special && visuals.size() > 0) addSparkles(hitbox, visuals[0], radius * 2);
		if (ghost) addGhostLook(hitbox, visuals, radius * 2);

		const bounds = aquarium.waterBounds;
		const x = math.clamp(from.X, bounds.min.X + EDGE_MARGIN, bounds.max.X - EDGE_MARGIN);
		const z = math.clamp(from.Z, bounds.min.Z + EDGE_MARGIN, bounds.max.Z - EDGE_MARGIN);
		const bottomY = bounds.min.Y + radius;
		const start = new Vector3(x, math.clamp(from.Y, bottomY, bounds.max.Y - radius), z);

		// Coin face (template Z axis) toward the front glass, slightly turned for variety
		const facing = CFrame.lookAt(start, start.add(aquarium.cframe.LookVector)).mul(
			CFrame.Angles(0, this.rng.NextNumber(-0.4, 0.4), 0),
		);
		model.PivotTo(facing);
		CollectionService.AddTag(hitbox, TAGS.Coin); // clients raycast against tagged hitboxes
		model.Parent = aquarium.coinFolder;

		const coin: Coin = {
			model,
			hitbox,
			visuals,
			owner,
			value,
			special,
			frozen,
			bubble: false,
			alive: true,
			ghost,
		};
		coins.add(coin);
		this.coinsByHitbox.set(hitbox, coin);
		if (frozen) return;

		const sink = TweenService.Create(
			hitbox,
			new TweenInfo(math.max(start.Y - bottomY, 0.01) / SINK_SPEED, Enum.EasingStyle.Linear),
			{ CFrame: facing.add(new Vector3(0, bottomY - start.Y, 0)) },
		);
		coin.motion = sink;
		sink.Completed.Connect((state) => {
			if (state !== Enum.PlaybackState.Completed) return;
			// The Bouncy coins perk: one bounce first, then the usual time on the sand
			const perks = DataService.getData(owner)?.perks ?? [];
			if (hasCoinBounce(perks)) this.bounce(coin, facing.add(new Vector3(0, bottomY - start.Y, 0)));
			else task.spawn(() => this.expireOnGround(coin));
		});
		sink.Play();
	}

	/**
	 * A weak fish's fart (see FishService): a bubble that rises from `from` to the surface, where it
	 * pops. Clicked on the way up, it's worth FART_BUBBLE_VALUE, like a coin.
	 */
	public spawnBubble(owner: Player, from: Vector3) {
		const aquarium = AquariumService.getAquarium(owner);
		if (!aquarium) return;
		const coins = this.getCoins(owner);
		if (coins.size() >= MAX_COINS_PER_PLAYER) return;

		const radius = BUBBLE_SIZE / 2;
		const bounds = aquarium.waterBounds;
		const top = bounds.max.Y - radius;
		const start = new Vector3(
			math.clamp(from.X, bounds.min.X + EDGE_MARGIN, bounds.max.X - EDGE_MARGIN),
			math.clamp(from.Y, bounds.min.Y + radius, top),
			math.clamp(from.Z, bounds.min.Z + EDGE_MARGIN, bounds.max.Z - EDGE_MARGIN),
		);

		const model = new Instance("Model");
		model.Name = "FartBubble";
		const hitbox = new Instance("Part");
		hitbox.Name = "Hitbox";
		hitbox.Shape = Enum.PartType.Ball;
		hitbox.Size = Vector3.one.mul(BUBBLE_SIZE * COIN_HITBOX_SCALE);
		hitbox.Transparency = 1;
		hitbox.Anchored = true;
		hitbox.CanCollide = false;
		hitbox.CanTouch = false;
		hitbox.CFrame = new CFrame(start);
		hitbox.SetAttribute("Bubble", true);
		hitbox.Parent = model;

		const visuals = new Array<BasePart>();
		const addPart = (
			name: string,
			size: number,
			offset: Vector3,
			color: Color3,
			transparency: number,
			neon: boolean,
		) => {
			const part = new Instance("Part");
			part.Name = name;
			part.Shape = Enum.PartType.Ball;
			part.Size = Vector3.one.mul(size);
			part.Color = color;
			part.Material = neon ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
			part.Transparency = transparency;
			part.Reflectance = neon ? 0 : 0.15;
			part.CastShadow = false;
			part.CanCollide = false;
			part.CanQuery = false;
			part.CanTouch = false;
			part.Massless = true;
			part.CFrame = hitbox.CFrame.add(offset);
			const weld = new Instance("WeldConstraint");
			weld.Part0 = hitbox;
			weld.Part1 = part;
			weld.Parent = part;
			part.Parent = model;
			visuals.push(part);
		};
		addPart("Bubble", BUBBLE_SIZE, Vector3.zero, BUBBLE_COLOR, 0.2, false);
		addPart(
			"Glint",
			BUBBLE_SIZE * 0.22,
			new Vector3(-0.2, 0.25, -0.3).mul(BUBBLE_SIZE),
			Color3.fromRGB(255, 255, 255),
			0.1,
			true,
		);
		model.PrimaryPart = hitbox;
		CollectionService.AddTag(hitbox, TAGS.Coin); // clicked like a coin
		model.Parent = aquarium.coinFolder;

		const coin: Coin = {
			model,
			hitbox,
			visuals,
			owner,
			value: FART_BUBBLE_VALUE,
			special: false,
			frozen: false,
			bubble: true,
			alive: true,
			ghost: false,
		};
		coins.add(coin);
		this.coinsByHitbox.set(hitbox, coin);

		const rise = TweenService.Create(
			hitbox,
			new TweenInfo(math.max(top - start.Y, 0.01) / BUBBLE_RISE_SPEED, Enum.EasingStyle.Linear),
			{ CFrame: new CFrame(start.X, top, start.Z) },
		);
		coin.motion = rise;
		rise.Completed.Connect(() => this.removeCoin(coin)); // pops at the surface
		rise.Play();
	}

	/** Hops up from the sand and lands again (COIN_BOUNCE_TIME), then starts its ground timer. */
	private bounce(coin: Coin, landed: CFrame) {
		const half = COIN_BOUNCE_TIME / 2;
		const up = TweenService.Create(
			coin.hitbox,
			new TweenInfo(half, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
			{ CFrame: landed.add(new Vector3(0, BOUNCE_HEIGHT, 0)) },
		);
		const down = TweenService.Create(
			coin.hitbox,
			new TweenInfo(half, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
			{
				CFrame: landed,
			},
		);
		up.Completed.Connect((state) => {
			if (state !== Enum.PlaybackState.Completed || !coin.alive) return;
			coin.motion = down;
			down.Play();
		});
		down.Completed.Connect((state) => {
			if (state === Enum.PlaybackState.Completed && coin.alive) task.spawn(() => this.expireOnGround(coin));
		});
		coin.motion = up;
		up.Play();
	}

	/** Waits on the sand (longer with the owner's perks), blinks as a warning, then vanishes if nobody collected it. */
	private expireOnGround(coin: Coin) {
		const lifetime = GROUND_LIFETIME + getGroundTimeBonus(DataService.getData(coin.owner)?.perks ?? []);
		coin.vanishesAt = os.clock() + lifetime;
		task.wait(lifetime - BLINK_DURATION);

		let visible = true;
		const blinkEnd = os.clock() + BLINK_DURATION;
		while (coin.alive && os.clock() < blinkEnd) {
			visible = !visible;
			const rest = coin.ghost ? GHOST_TRANSPARENCY : 0;
			for (const part of coin.visuals) part.Transparency = visible ? rest : 0.7 + rest * 0.5;
			task.wait(BLINK_INTERVAL);
		}
		this.removeCoin(coin);
	}

	/** Removes every coin and bubble of the owner, without crediting them (rebirth: the run restarts). */
	public clearOwner(owner: Player) {
		const coins = this.coinsByOwner.get(owner);
		if (!coins) return;
		for (const coin of [...coins]) this.removeCoin(coin);
	}

	private removeCoin(coin: Coin) {
		if (!coin.alive) return;
		coin.alive = false;
		this.coinsByHitbox.delete(coin.hitbox);
		this.coinsByOwner.get(coin.owner)?.delete(coin);
		coin.model.Destroy();
	}

	private collect(player: Player, part: BasePart) {
		const coin = this.coinsByHitbox.get(part);
		// Only the owner, standing at their aquarium, can collect a coin that still exists
		if (!coin || !coin.alive || coin.owner !== player) return;
		if (!AquariumService.isAtOwnAquarium(player)) return;
		this.credit(coin);
	}

	/** Removes the coin and credits its value to its owner. */
	private credit(coin: Coin, companion?: CompanionType) {
		const owner = coin.owner;
		const position = coin.hitbox.Position;
		this.removeCoin(coin);
		DataService.addMoney(owner, coin.value);
		this.popupRemote.FireClient(owner, { position, amount: coin.value, special: coin.special, ghost: coin.ghost });
		if (coin.bubble) this.sfxRemote.FireClient(owner, "BubblePop", 0.9 + math.random() * 0.3);
		for (const callback of this.collectedCallbacks) {
			task.spawn(callback, owner, coin.frozen, coin.value, companion);
		}
	}

	// ---------------------------------------------------------------------
	// Companions (see CompanionService)
	// ---------------------------------------------------------------------

	/**
	 * Hitbox of the owner's coin a crawler on the sand at `from` can pick up the soonest: the time to
	 * crawl under it at `speed`, or the time it still needs to sink to `pickupY`, whichever is longer.
	 * So it goes for a coin already on the sand rather than waiting under one still falling. The
	 * onboarding coin is left to the player.
	 */
	public findCoinToFetch(owner: Player, from: Vector3, speed: number, pickupY: number): BasePart | undefined {
		const coins = this.coinsByOwner.get(owner);
		if (!coins) return undefined;
		let best: BasePart | undefined;
		let bestTime = math.huge;
		for (const coin of coins) {
			// The onboarding coin is the player's; bubbles rise out of reach
			if (!coin.alive || coin.frozen || coin.bubble) continue;
			const offset = coin.hitbox.Position.sub(from);
			const crawlTime = new Vector3(offset.X, 0, offset.Z).Magnitude / speed;
			const sinkTime = math.max(coin.hitbox.Position.Y - pickupY, 0) / SINK_SPEED;
			const time = math.max(crawlTime, sinkTime);
			if (time < bestTime) {
				best = coin.hitbox;
				bestTime = time;
			}
		}
		return best;
	}

	/** A companion picks up one of its owner's coins: credited as if the owner had clicked it. */
	public collectForOwner(owner: Player, hitbox: BasePart, companion: CompanionType): boolean {
		const coin = this.coinsByHitbox.get(hitbox);
		if (!coin || !coin.alive || coin.frozen || coin.bubble || coin.owner !== owner) return false;
		this.credit(coin, companion);
		return true;
	}

	// ---------------------------------------------------------------------
	// Abyssal raid (see AbyssService)
	// ---------------------------------------------------------------------

	/**
	 * The owner's coin a lantern fish goes for: the most valuable one in the water or on the sand
	 * that stays there at least `minLifetime` more seconds. The onboarding coin and fart bubbles are
	 * left alone.
	 */
	public findCoinToSteal(owner: Player, minLifetime: number): BasePart | undefined {
		const coins = this.coinsByOwner.get(owner);
		if (!coins) return undefined;
		const now = os.clock();
		let best: Coin | undefined;
		for (const coin of coins) {
			if (!coin.alive || coin.frozen || coin.bubble) continue;
			if (coin.vanishesAt !== undefined && coin.vanishesAt - now < minLifetime) continue;
			if (!best || coin.value > best.value) best = coin;
		}
		return best?.hitbox;
	}

	/** Whether this coin is still there to be collected (or stolen). */
	public isCoinAlive(hitbox: BasePart): boolean {
		return this.coinsByHitbox.get(hitbox)?.alive === true;
	}

	/**
	 * A lantern fish snatches one of the owner's coins: lost, nobody is credited. The coin stops
	 * moving and can no longer be clicked; its model is handed over (the thief carries it away and
	 * destroys it). The owner sees a red "-X$" where it was.
	 */
	public stealCoin(owner: Player, hitbox: BasePart): Model | undefined {
		const coin = this.coinsByHitbox.get(hitbox);
		if (!coin || !coin.alive || coin.frozen || coin.bubble || coin.owner !== owner) return undefined;
		coin.alive = false;
		this.coinsByHitbox.delete(hitbox);
		this.coinsByOwner.get(owner)?.delete(coin);
		coin.motion?.Cancel();
		CollectionService.RemoveTag(hitbox, TAGS.Coin);
		for (const part of coin.visuals) part.Transparency = coin.ghost ? GHOST_TRANSPARENCY : 0; // caught mid-blink
		this.popupRemote.FireClient(owner, {
			position: hitbox.Position,
			amount: coin.value,
			special: coin.special,
			stolen: true,
		});
		this.sfxRemote.FireClient(owner, "CoinStolen", 0.55 + math.random() * 0.15);
		return coin.model;
	}

	/** Registers a callback fired after a player collects one of their coins. */
	public onCollected(callback: CoinCollectedCallback) {
		this.collectedCallbacks.push(callback);
	}
}

export const CoinService = new CoinServiceSingleton();
