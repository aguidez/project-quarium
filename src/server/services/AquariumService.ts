import { Janitor } from "@rbxts/janitor";
import { CollectionService, Players, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { FRONT_GLASS_Z, getAquariumFrame, isInFocusZone } from "shared/types/aquarium";
import { AQUARIUM_THEMES, AquariumTheme } from "shared/types/rebirths";
import { CosmeticId, DECOR_SLOTS, isDecor } from "shared/types/cosmetics";
import { getDisplayedTheme, isCosmeticShown } from "shared/types/customization";
import { loadTemplates } from "../templates";
import { DataService } from "./DataService";

const SPAWN_DISTANCE = 14; // studs in front of the glass
const FOCUS_ZONE_TOLERANCE = 4; // studs of slack for latency when validating interactions
// Owner nameplate on the front of the tank's base (FigCraft: OwnerPlate), the same brass as the capacity plaque
const PLATE_PIXELS_PER_STUD = 60;
const PLATE_HEIGHT = 96; // px: 1.6 studs on the 2-stud-tall front of the base
const PLATE_TOP = Color3.fromHex("#F4CF7A");
const PLATE_BOTTOM = Color3.fromHex("#A8741F");
const PLATE_STROKE = Color3.fromHex("#6E4A12");
const PLATE_TEXT = Color3.fromHex("#3A2408");
const THEME_CHECK_INTERVAL = 1; // seconds between two checks of the themes the tanks should wear
const THEME_CHILD_ATTRIBUTE = "ThemeChild"; // decals / textures a theme added to a tank part
// The Pearl rims cosmetic (FinishPearlRims): a pearly white sheen on the tank's rims, whatever its theme
const RIM_PARTS = ["RimFront", "RimBack", "RimLeft", "RimRight"];
const PEARL_COLOR = Color3.fromHex("#F3ECF7");
const PEARL_REFLECTANCE = 0.3;

/** Axis-aligned box describing the inside of a water volume (world space). */
export interface Bounds {
	min: Vector3;
	max: Vector3;
}

export interface Aquarium {
	index: number;
	model: Model;
	cframe: CFrame;
	waterBounds: Bounds;
	fishFolder: Folder;
	foodFolder: Folder;
	coinFolder: Folder;
	companionFolder: Folder;
	ownerPlate: SurfaceGui; // hidden while the tank is free
	ownerLabel: TextLabel;
	owner?: Player;
	theme?: AquariumTheme; // worn now (see applyTheme)
	pearlRims?: boolean; // the Pearl rims finish worn now
	decorKey?: string; // the owner's decor cosmetics placed now (sorted ids)
	themeDecor?: Model;
}

function getWorldBounds(cframe: CFrame, size: Vector3): Bounds {
	const half = size.div(2);
	let min = new Vector3(math.huge, math.huge, math.huge);
	let max = new Vector3(-math.huge, -math.huge, -math.huge);
	for (const sx of [-1, 1]) {
		for (const sy of [-1, 1]) {
			for (const sz of [-1, 1]) {
				const corner = cframe.PointToWorldSpace(new Vector3(sx * half.X, sy * half.Y, sz * half.Z));
				min = min.Min(corner);
				max = max.Max(corner);
			}
		}
	}
	return { min, max };
}

function getOrCreateFolder(parent: Instance, name: string): Folder {
	const existing = parent.FindFirstChild(name);
	if (existing && existing.IsA("Folder")) return existing;
	const folder = new Instance("Folder");
	folder.Name = name;
	folder.Parent = parent;
	return folder;
}

/**
 * Registers the aquariums built in Studio (models tagged "Aquarium") and assigns one
 * to each player. Expected model layout: PrimaryPart "Base" (frame of the tank), a part
 * tagged "AquariumWater". The owner's nameplate and the runtime folders
 * (Fish / Food / Coins / Companions) are created if missing.
 */
class AquariumServiceSingleton implements Lifecycle {
	private aquariums = new Array<Aquarium>();
	private aquariumByPlayer = new Map<Player, Aquarium>();
	private playerJanitors = new Map<Player, Janitor>();
	/** Players whose client reports the 2.5D focus view of their aquarium (see isTending). */
	private focusedPlayers = new Set<Player>();
	private themes = new Map<AquariumTheme, Model>();
	private decorTemplates = new Map<CosmeticId, Model>();

	public onInit() {
		const themes = new Array<AquariumTheme>();
		for (const [theme] of pairs(AQUARIUM_THEMES)) themes.push(theme);
		this.themes = loadTemplates(TAGS.AquariumThemeTemplate, "Theme", themes);
		const decorIds = new Array<CosmeticId>();
		for (const [id] of pairs(DECOR_SLOTS)) decorIds.push(id);
		this.decorTemplates = loadTemplates(TAGS.DecorTemplate, "Cosmetic", decorIds);

		for (const instance of CollectionService.GetTagged(TAGS.Aquarium)) {
			const aquarium = this.register(instance);
			if (aquarium) this.aquariums.push(aquarium);
		}
		this.aquariums.sort((a, b) => a.index < b.index);
		if (this.aquariums.size() === 0) {
			warn(
				`[Server] No valid model tagged "${TAGS.Aquarium}" found in Workspace: players will have no aquarium.`,
			);
		}

		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.onPlayerRemoving(player));
		for (const player of Players.GetPlayers()) {
			task.spawn(() => this.onPlayerAdded(player));
		}

		DataService.registerAction("SetFocus", t.boolean, (player, focused) => {
			if (focused) this.focusedPlayers.add(player);
			else this.focusedPlayers.delete(player);
		});
	}

	public onStart() {
		print(`[Server] AquariumService started with ${this.aquariums.size()} aquariums.`);

		// Each tank wears its owner's theme (their choice among the reached ones, else the newest: getDisplayedTheme),
		// free tanks the basic one, with the decor and finishes they show. Owners come and go, their data loads later,
		// rebirths and choices change it: kept in line by polling
		while (true) {
			for (const aquarium of this.aquariums) {
				const data = aquarium.owner ? DataService.getData(aquarium.owner) : undefined;
				const pearlRims = data ? isCosmeticShown(data, "FinishPearlRims") : false;
				const decor = data
					? data.cosmetics.filter((cosmetic) => isDecor(cosmetic) && isCosmeticShown(data, cosmetic))
					: [];
				this.applyTheme(aquarium, data ? getDisplayedTheme(data) : "Basic", pearlRims, decor);
			}
			task.wait(THEME_CHECK_INTERVAL);
		}
	}

	// ---------------------------------------------------------------------
	// Themes (rebirths)
	// ---------------------------------------------------------------------

	/**
	 * Dresses the tank in a theme: ServerStorage.Assets.AquariumThemes.<theme>, a model tagged
	 * AquariumThemeTemplate whose PrimaryPart "Origin" stands for the tank's frame. Its "Style" folder
	 * holds parts named like the tank's (Sand, Backdrop, Base, Rim...): their look (and decals,
	 * textures...) is copied onto the tank. Everything else is decor, cloned into the tank.
	 */
	private applyTheme(aquarium: Aquarium, theme: AquariumTheme, pearlRims: boolean, decorIds: CosmeticId[]) {
		const decorKey = [...decorIds].sort().join(",");
		if (aquarium.theme === theme && aquarium.pearlRims === pearlRims && aquarium.decorKey === decorKey) return;
		const template = this.themes.get(theme);
		if (!template) return;
		aquarium.theme = theme;
		aquarium.pearlRims = pearlRims;
		aquarium.decorKey = decorKey;

		aquarium.themeDecor?.Destroy();
		// The decor built in Studio is the basic theme's: replaced for good by the template
		aquarium.model.FindFirstChild("Decorations")?.Destroy();

		const decor = template.Clone();
		decor.Name = "ThemeDecor";
		CollectionService.RemoveTag(decor, TAGS.AquariumThemeTemplate);
		const style = decor.FindFirstChild("Style");
		if (style) {
			for (const part of style.GetChildren()) {
				const target = aquarium.model.FindFirstChild(part.Name);
				if (part.IsA("BasePart") && target?.IsA("BasePart")) this.copyStyle(part, target);
			}
			style.Destroy();
		}
		// The Pearl rims finish (Ocean 300,000) goes over every theme's rims
		if (pearlRims) {
			for (const name of RIM_PARTS) {
				const rim = aquarium.model.FindFirstChild(name);
				if (!rim?.IsA("BasePart")) continue;
				rim.Color = PEARL_COLOR;
				rim.Material = Enum.Material.SmoothPlastic;
				rim.MaterialVariant = "";
				rim.Reflectance = PEARL_REFLECTANCE;
			}
		}
		for (const part of decor.GetDescendants()) {
			// Decor never blocks a click on the water or a coin, nor a character
			if (part.IsA("BasePart")) {
				part.Anchored = true;
				part.CanCollide = false;
				part.CanQuery = false;
				part.CanTouch = false;
			}
		}
		// The owner's decor cosmetics (whale statue, golden trophy...), in their slots, with the theme's decor
		for (const id of decorIds) {
			const slot = DECOR_SLOTS[id];
			const piece = this.decorTemplates.get(id)?.Clone();
			if (!slot || !piece) continue;
			CollectionService.RemoveTag(piece, TAGS.DecorTemplate);
			const [, size] = piece.GetBoundingBox();
			// The theme's Origin stands for the tank's frame: the slot is placed before the decor moves to the tank
			piece.PivotTo(template.GetPivot().mul(new CFrame(slot.X, slot.Y + size.Y / 2, slot.Z)));
			piece.Parent = decor;
		}
		decor.PivotTo(aquarium.cframe);
		decor.Parent = aquarium.model;
		aquarium.themeDecor = decor;
		aquarium.model.SetAttribute("Theme", theme);
	}

	private copyStyle(from: BasePart, to: BasePart) {
		to.Color = from.Color;
		to.Material = from.Material;
		to.MaterialVariant = from.MaterialVariant;
		to.Transparency = from.Transparency;
		to.Reflectance = from.Reflectance;
		for (const child of to.GetChildren()) {
			if (child.GetAttribute(THEME_CHILD_ATTRIBUTE) === true) child.Destroy();
		}
		for (const child of from.GetChildren()) {
			const copy = child.Clone();
			copy.SetAttribute(THEME_CHILD_ATTRIBUTE, true);
			copy.Parent = to;
		}
	}

	public getAquarium(player: Player): Aquarium | undefined {
		return this.aquariumByPlayer.get(player);
	}

	/** Every aquarium of the place, owned or free. */
	public getAquariums(): readonly Aquarium[] {
		return this.aquariums;
	}

	/** Whether a tank with this PlotIndex exists (validates the tanks a client asks to watch). */
	public isPlot(index: number): boolean {
		return this.aquariums.some((aquarium) => aquarium.index === index);
	}

	/**
	 * Server-side check that the player's character stands in front of their own aquarium
	 * (where the focus view is), so tank interactions can't be triggered from elsewhere.
	 */
	public isAtOwnAquarium(player: Player): boolean {
		const aquarium = this.aquariumByPlayer.get(player);
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		if (!aquarium || !root || !root.IsA("BasePart")) return false;
		return isInFocusZone(aquarium.cframe, root.Position, FOCUS_ZONE_TOLERANCE);
	}

	/**
	 * The player is looking after their tank: in the 2.5D focus view (reported by the client) AND
	 * actually standing at their own aquarium (checked here, so the client can't fake it from afar).
	 * Otherwise they are AFK and their fish are paused (see FishService).
	 */
	public isTending(player: Player): boolean {
		return this.focusedPlayers.has(player) && this.isAtOwnAquarium(player);
	}

	// ---------------------------------------------------------------------
	// Studio-built aquariums
	// ---------------------------------------------------------------------

	private register(instance: Instance): Aquarium | undefined {
		if (!instance.IsA("Model")) return undefined;
		const fail = (reason: string) => {
			warn(`[Server] Aquarium "${instance.GetFullName()}" ignored: ${reason}`);
			return undefined;
		};

		const cframe = getAquariumFrame(instance);
		if (!cframe) return fail("PrimaryPart (Base) is not set");

		const water = CollectionService.GetTagged(TAGS.AquariumWater).find(
			(part): part is BasePart => part.IsA("BasePart") && part.IsDescendantOf(instance),
		);
		if (!water) return fail(`no part tagged "${TAGS.AquariumWater}"`);

		const index = instance.GetAttribute("PlotIndex");
		const [ownerPlate, ownerLabel] = this.createOwnerPlate(instance.PrimaryPart!);

		return {
			index: typeIs(index, "number") ? index : this.aquariums.size(),
			model: instance,
			cframe,
			waterBounds: getWorldBounds(water.CFrame, water.Size),
			fishFolder: getOrCreateFolder(instance, "Fish"),
			foodFolder: getOrCreateFolder(instance, "Food"),
			coinFolder: getOrCreateFolder(instance, "Coins"),
			companionFolder: getOrCreateFolder(instance, "Companions"),
			ownerPlate,
			ownerLabel,
		};
	}

	/** Brass nameplate in the middle of the base's front face, seen by everyone; disabled while the tank is free. */
	private createOwnerPlate(base: BasePart): [SurfaceGui, TextLabel] {
		const gui = new Instance("SurfaceGui");
		gui.Name = "OwnerPlate";
		gui.Face = Enum.NormalId.Front; // the front of a tank is its -Z side
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
		gui.PixelsPerStud = PLATE_PIXELS_PER_STUD;
		gui.LightInfluence = 0.3;
		gui.Enabled = false;

		const plate = new Instance("Frame");
		plate.Name = "Plate";
		plate.AnchorPoint = new Vector2(0.5, 0.5);
		plate.Position = UDim2.fromScale(0.5, 0.5);
		plate.Size = UDim2.fromOffset(0, PLATE_HEIGHT);
		plate.AutomaticSize = Enum.AutomaticSize.X;
		plate.BackgroundColor3 = Color3.fromHex("#FFFFFF");
		plate.Parent = gui;
		const gradient = new Instance("UIGradient");
		gradient.Color = new ColorSequence(PLATE_TOP, PLATE_BOTTOM);
		gradient.Rotation = 90;
		gradient.Parent = plate;
		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 16);
		corner.Parent = plate;
		const stroke = new Instance("UIStroke");
		stroke.Color = PLATE_STROKE;
		stroke.Thickness = 5;
		stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
		stroke.Parent = plate;
		const padding = new Instance("UIPadding");
		padding.PaddingLeft = new UDim(0, 32);
		padding.PaddingRight = new UDim(0, 32);
		padding.Parent = plate;

		// In a child label: the plate's gradient would tint its text
		const label = new Instance("TextLabel");
		label.Name = "Owner";
		label.Size = UDim2.fromOffset(0, PLATE_HEIGHT);
		label.AutomaticSize = Enum.AutomaticSize.X;
		label.BackgroundTransparency = 1;
		label.Font = Enum.Font.GothamBlack;
		label.TextSize = 56;
		label.TextColor3 = PLATE_TEXT;
		label.Parent = plate;

		gui.Parent = base;
		return [gui, label];
	}

	// ---------------------------------------------------------------------
	// Assignment
	// ---------------------------------------------------------------------

	private onPlayerAdded(player: Player) {
		if (this.aquariumByPlayer.has(player)) return;

		const aquarium = this.aquariums.find((a) => a.owner === undefined);
		if (!aquarium) {
			player.Kick(`This server is full (${this.aquariums.size()} players max).`);
			return;
		}

		aquarium.owner = player;
		this.aquariumByPlayer.set(player, aquarium);
		aquarium.model.SetAttribute("OwnerUserId", player.UserId);
		aquarium.ownerLabel.Text = `${player.DisplayName}'s Aquarium`;
		aquarium.ownerPlate.Enabled = true;

		const janitor = new Janitor();
		this.playerJanitors.set(player, janitor);
		janitor.Add(player.CharacterAdded.Connect((character) => this.placeCharacter(character, aquarium)));
		if (player.Character) task.spawn(() => this.placeCharacter(player.Character!, aquarium));
	}

	private onPlayerRemoving(player: Player) {
		this.focusedPlayers.delete(player);
		this.playerJanitors.get(player)?.Destroy();
		this.playerJanitors.delete(player);

		const aquarium = this.aquariumByPlayer.get(player);
		if (!aquarium) return;
		this.aquariumByPlayer.delete(player);

		aquarium.owner = undefined;
		aquarium.model.SetAttribute("OwnerUserId", undefined);
		aquarium.ownerPlate.Enabled = false;
	}

	/** Spawns the character in front of its own aquarium, facing the glass. */
	private placeCharacter(character: Model, aquarium: Aquarium) {
		const root = character.WaitForChild("HumanoidRootPart", 10);
		if (!root) return;
		if (!character.IsDescendantOf(Workspace)) character.AncestryChanged.Wait();
		task.wait(); // let the default spawn positioning run first
		if (!character.Parent || aquarium.owner === undefined) return;

		const position = aquarium.cframe.PointToWorldSpace(new Vector3(0, 3, FRONT_GLASS_Z - SPAWN_DISTANCE));
		const towardTank = aquarium.cframe.LookVector.mul(-1);
		character.PivotTo(CFrame.lookAt(position, position.add(towardTank)));
	}
}

export const AquariumService = new AquariumServiceSingleton();
