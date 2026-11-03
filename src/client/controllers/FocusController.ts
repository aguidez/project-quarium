import {
	CollectionService,
	ContextActionService,
	GuiService,
	Lighting,
	Players,
	RunService,
	TweenService,
	UserInputService,
	Workspace,
} from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { TAGS } from "shared/tags";
import {
	AQUARIUM_INNER_SIZE,
	FOCUS_ZONE_DEPTH,
	FRONT_GLASS_Z,
	getAquariumFrame,
	isInFocusZone,
	TANK_FRONT_CENTER_Y,
	TANK_FRONT_SIZE,
	TANK_FRONT_Z,
} from "shared/types/aquarium";
import { getTopHudBottom } from "client/ui/App";
import { FONT_TITLE, OUTLINE, PALETTES, verticalGradient } from "client/ui/theme";

const ENTER_TIME = 1.1;
const EXIT_TIME = 0.8;
// Roblox has no orthographic camera: a narrow FOV from far away flattens the perspective (2.5D)
const FOCUS_FOV = 20;
const FRAME_GAP = 8; // pixels kept between the tank and the UI / screen edges
const BACK_BUTTON_MARGIN = 16;
const BACK_BUTTON_SIZE = new Vector2(220, 50);
const BACK_BUTTON_DEPTH = 6;
const BACK_BUTTON_HOVER_SCALE = 1.04; // kit.tsx HOVER_SCALE
const OCCLUDER_HALF_WIDTH = AQUARIUM_INNER_SIZE.X / 2 + 15; // characters in this corridor get hidden
const EXIT_CAMERA_OFFSET = new Vector3(0, 5, 12); // behind the character, relative to the tank front
const EXIT_ACTION = "ExitAquariumFocus";
const OCCLUSION_STEP = "AquariumFocusOcclusion";
// Clear water in the 2.5D view: the camera is ~100 studs away, so the beach's atmospheric haze and the
// tinted front glass + water washed the tank's colours out. Local only: the lobby keeps its look
const FOCUS_HAZE_KEEP = 0.2; // share of the atmosphere's density / haze left in the view
const FOCUS_GLASS_CLEAR = 0.6; // LocalTransparencyModifier of the front glass (0.7 -> 0.88 transparent)
const FOCUS_WATER_CLEAR = 0.5; // ... and of the water (0.8 -> 0.9)
// A companion perched on the rim (the Pelican) or floating on the surface (the Water Hen) stands above the
// tank's front: the view makes room for it
const PERCHED_COMPANIONS = ["Pelican", "WaterHen"];
const PERCH_HEADROOM = 6; // studs added above the tank's front
const UFO_HEADROOM = 9; // ... while a UFO of the UFO night hovers over it (UfoService HOVER_HEIGHT)
const REFRAME_TIME = 0.6;

type FocusState = "Free" | "Entering" | "Focused" | "Exiting";

/** Humanoid movement values saved while they are zeroed in focus view. */
interface SavedMovement {
	humanoid: Humanoid;
	walkSpeed: number;
	jumpPower: number;
	jumpHeight: number;
	touchControls: boolean;
}

/**
 * Lobby <-> aquarium focus view. When the player walks up to the glass of their own
 * aquarium, the camera glides to a flat, front-facing view of the tank, movement is
 * disabled and only the cursor / touch is used. A back button (or Q / B) leaves it. In the lobby,
 * a "My aquarium" button at the same spot brings the character to its tank and enters the view.
 * The server is told when the view is entered / left: outside of it the player is AFK
 * and their fish are paused (it also checks the character really is at the tank).
 */
class FocusControllerSingleton implements Lifecycle {
	private state: FocusState = "Free";
	private mustLeaveZone = false; // after leaving the view, walk out of the zone before re-entering
	private ownAquarium?: Model;
	private aquariumCFrame?: CFrame;
	private savedMovement?: SavedMovement;
	private savedFov = 70;
	private transitionToken = 0;
	private hiddenCharacters = new Set<Model>();
	private hiddenBillboards = new Set<BillboardGui>(); // turned off here (the title above the head), turned back on
	private backButton!: TextButton;
	private aquariumButton!: TextButton;
	private actionRemote = getRemoteEvent("RequestAction");
	/** 0 = lobby look, 1 = clear 2.5D view; tweened with the camera (see applyClarity). */
	private clarity = new Instance("NumberValue");
	private clarityTween?: Tween;
	private atmosphere?: { instance: Atmosphere; density: number; haze: number };
	/** Studs of room above the tank in the view (PERCH_HEADROOM while a perched companion is on its rim). */
	private headroom = 0;
	private viewListeners = new Array<(inView: boolean) => void>();
	/** The own tank's name plate, turned off in the view: the food reserve sits over it (and it says nothing new there). */
	private hiddenOwnerPlate?: SurfaceGui;

	public onInit() {
		this.buildUi();
		Players.LocalPlayer.CharacterAdded.Connect(() => this.resetToFree());
		this.clarity.Changed.Connect(() => this.applyClarity());
	}

	public onStart() {
		RunService.Heartbeat.Connect(() => this.update());
		// Runs right after the default camera so our transparency overrides win
		RunService.BindToRenderStep(OCCLUSION_STEP, Enum.RenderPriority.Camera.Value + 1, () => this.updateOccluders());

		const camera = Workspace.CurrentCamera;
		camera?.GetPropertyChangedSignal("ViewportSize").Connect(() => {
			if (this.state === "Focused") camera.CFrame = this.getFocusCFrame(camera);
		});
	}

	public isFocused(): boolean {
		return this.state === "Focused";
	}

	/** In the tank view or flying into it (its back button shows): the view HUD (the food reserve) shows. */
	public isInView(): boolean {
		return this.state === "Entering" || this.state === "Focused";
	}

	public onViewChanged(listener: (inView: boolean) => void) {
		this.viewListeners.push(listener);
	}

	private fireViewChanged() {
		const inView = this.isInView();
		this.showOwnerPlate(!inView);
		for (const listener of this.viewListeners) task.spawn(listener, inView);
	}

	/** The local player's aquarium model, once the server has assigned it. */
	public getOwnAquarium(): Model | undefined {
		return this.ownAquarium;
	}

	/** The water part of the local player's aquarium. */
	public getOwnWater(): BasePart | undefined {
		const aquarium = this.ownAquarium;
		if (!aquarium) return undefined;
		for (const instance of CollectionService.GetTagged(TAGS.AquariumWater)) {
			if (instance.IsA("BasePart") && instance.IsDescendantOf(aquarium)) return instance;
		}
		return undefined;
	}

	// ---------------------------------------------------------------------
	// Setup
	// ---------------------------------------------------------------------

	/**
	 * Freezes the character for every input type (keyboard, gamepad, touch). The PlayerModule
	 * is no longer exposed in PlayerScripts, so instead the client zeroes its own humanoid's
	 * movement (the client owns its character's physics) and hides the touch thumbstick.
	 */
	private lockMovement(humanoid: Humanoid) {
		if (this.savedMovement) return;
		this.savedMovement = {
			humanoid,
			walkSpeed: humanoid.WalkSpeed,
			jumpPower: humanoid.JumpPower,
			jumpHeight: humanoid.JumpHeight,
			touchControls: GuiService.TouchControlsEnabled,
		};
		humanoid.WalkSpeed = 0;
		humanoid.JumpPower = 0;
		humanoid.JumpHeight = 0;
		humanoid.Move(Vector3.zero);
		GuiService.TouchControlsEnabled = false;
	}

	private unlockMovement() {
		const saved = this.savedMovement;
		if (!saved) return;
		this.savedMovement = undefined;
		GuiService.TouchControlsEnabled = saved.touchControls;
		// A respawned character already has fresh default values
		if (saved.humanoid.Parent) {
			saved.humanoid.WalkSpeed = saved.walkSpeed;
			saved.humanoid.JumpPower = saved.jumpPower;
			saved.humanoid.JumpHeight = saved.jumpHeight;
		}
	}

	private buildUi() {
		const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;

		const screenGui = new Instance("ScreenGui");
		screenGui.Name = "FocusUi";
		screenGui.ResetOnSpawn = false;
		screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Global;

		// Same spot, one at a time: "Back to lobby" in the 2.5D view, "My aquarium" in the lobby
		this.backButton = this.createButton(screenGui, "Back", "Back to lobby", () => this.exitFocus());
		this.aquariumButton = this.createButton(screenGui, "GoToAquarium", "My aquarium", () => this.goToAquarium());
		screenGui.Parent = playerGui;
	}

	/** Blue pseudo-3D button (FigCraft redesign-v2: BackToLobby), the kit's recipe in plain instances. */
	private createButton(parent: Instance, name: string, text: string, onActivated: () => void): TextButton {
		const palette = PALETTES.blue;
		const button = new Instance("TextButton");
		button.Name = name;
		// Bottom-left: the top of the screen belongs to the shop bar
		button.AnchorPoint = new Vector2(0, 1);
		button.Position = new UDim2(0, BACK_BUTTON_MARGIN, 1, -BACK_BUTTON_MARGIN - BACK_BUTTON_DEPTH);
		button.Size = UDim2.fromOffset(BACK_BUTTON_SIZE.X, BACK_BUTTON_SIZE.Y);
		button.BackgroundColor3 = new Color3(1, 1, 1);
		button.BorderSizePixel = 0;
		button.AutoButtonColor = false;
		button.Text = ""; // in a child label: the gradient would tint the button's own text
		button.ZIndex = 2;
		button.Visible = false;
		button.Parent = parent;

		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 14);
		corner.Parent = button;
		const gradient = new Instance("UIGradient");
		gradient.Color = verticalGradient(palette.light, palette.base);
		gradient.Rotation = 90;
		gradient.Parent = button;
		const stroke = new Instance("UIStroke");
		stroke.Color = OUTLINE;
		stroke.Thickness = 3;
		stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
		stroke.Parent = button;

		// The bevel: under the button thanks to the Global ZIndex behaviour of the ScreenGui
		const shadow = new Instance("Frame");
		shadow.Name = "Shadow";
		shadow.Position = UDim2.fromOffset(0, BACK_BUTTON_DEPTH);
		shadow.Size = UDim2.fromScale(1, 1);
		shadow.BackgroundColor3 = palette.shadow;
		shadow.BorderSizePixel = 0;
		shadow.ZIndex = 1;
		shadow.Parent = button;
		corner.Clone().Parent = shadow;
		stroke.Clone().Parent = shadow;

		const gloss = new Instance("Frame");
		gloss.Name = "Gloss";
		gloss.Position = UDim2.fromOffset(5, 4);
		gloss.Size = new UDim2(1, -10, 0.4, 0);
		gloss.BackgroundColor3 = new Color3(1, 1, 1);
		gloss.BackgroundTransparency = 0.7;
		gloss.BorderSizePixel = 0;
		gloss.ZIndex = 3;
		gloss.Parent = button;
		const glossCorner = new Instance("UICorner");
		glossCorner.CornerRadius = new UDim(0, 10);
		glossCorner.Parent = gloss;

		const label = new Instance("TextLabel");
		label.Name = "Label";
		label.Position = UDim2.fromOffset(0, 1);
		label.Size = UDim2.fromScale(1, 1);
		label.BackgroundTransparency = 1;
		label.Font = FONT_TITLE;
		label.TextSize = 22;
		label.TextColor3 = new Color3(1, 1, 1);
		label.Text = text.upper();
		label.ZIndex = 4;
		label.Parent = button;
		const labelStroke = new Instance("UIStroke");
		labelStroke.Color = palette.shadow;
		labelStroke.Thickness = 2.5;
		labelStroke.LineJoinMode = Enum.LineJoinMode.Round;
		labelStroke.Parent = label;

		// Pressed: the face sinks onto its bevel
		const rest = button.Position;
		button.MouseButton1Down.Connect(() => (button.Position = rest.add(UDim2.fromOffset(0, BACK_BUTTON_DEPTH - 2))));
		const release = () => (button.Position = rest);
		button.MouseButton1Up.Connect(release);
		// Hovered: grows a little, like the kit's Button3D (the Customize button next to it)
		const scale = new Instance("UIScale");
		scale.Parent = button;
		button.MouseEnter.Connect(() => (scale.Scale = BACK_BUTTON_HOVER_SCALE));
		button.MouseLeave.Connect(() => {
			release();
			scale.Scale = 1;
		});
		button.Activated.Connect(onActivated);
		return button;
	}

	// ---------------------------------------------------------------------
	// Zone detection
	// ---------------------------------------------------------------------

	private getCharacterParts(): [BasePart, Humanoid] | undefined {
		const character = Players.LocalPlayer.Character;
		const root = character?.FindFirstChild("HumanoidRootPart");
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		if (!root || !root.IsA("BasePart") || !humanoid) return undefined;
		return [root, humanoid];
	}

	private refreshOwnAquarium() {
		const userId = Players.LocalPlayer.UserId;
		const current = this.ownAquarium;
		if (current && current.Parent && current.GetAttribute("OwnerUserId") === userId) return;

		this.ownAquarium = undefined;
		this.aquariumCFrame = undefined;
		for (const instance of CollectionService.GetTagged(TAGS.Aquarium)) {
			if (!instance.IsA("Model") || instance.GetAttribute("OwnerUserId") !== userId) continue;
			const frame = getAquariumFrame(instance);
			if (!frame) continue;
			this.ownAquarium = instance;
			this.aquariumCFrame = frame;
			return;
		}
	}

	/** A companion of the local player perched on the rim (it needs room above the tank). */
	private hasPerchedCompanion(): boolean {
		const userId = Players.LocalPlayer.UserId;
		return CollectionService.GetTagged(TAGS.Companion).some(
			(model) =>
				model.GetAttribute("Owner") === userId &&
				PERCHED_COMPANIONS.includes(model.GetAttribute("CompanionType") as string),
		);
	}

	/** A UFO of the UFO night over the local player's tank (it flies above the water). */
	private hasUfo(): boolean {
		const own = this.ownAquarium;
		return own !== undefined && CollectionService.GetTagged(TAGS.Ufo).some((model) => model.IsDescendantOf(own));
	}

	private updateHeadroom() {
		const headroom = this.hasUfo() ? UFO_HEADROOM : this.hasPerchedCompanion() ? PERCH_HEADROOM : 0;
		if (headroom === this.headroom) return;
		this.headroom = headroom;
		const camera = Workspace.CurrentCamera;
		if (this.state === "Focused" && camera) this.reframe(camera);
	}

	private reframe(camera: Camera) {
		const info = new TweenInfo(REFRAME_TIME, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
		TweenService.Create(camera, info, { CFrame: this.getFocusCFrame(camera) }).Play();
	}

	private update() {
		this.refreshOwnAquarium();
		this.updateHeadroom();
		const parts = this.getCharacterParts();
		const alive = parts !== undefined && parts[1].Health > 0;
		this.aquariumButton.Visible = this.state === "Free" && this.aquariumCFrame !== undefined && alive;
		if (this.state !== "Free" || !this.aquariumCFrame || !parts || !alive) return;

		if (!isInFocusZone(this.aquariumCFrame, parts[0].Position)) {
			this.mustLeaveZone = false;
		} else if (!this.mustLeaveZone) {
			this.enterFocus();
		}
	}

	// ---------------------------------------------------------------------
	// Camera transitions
	// ---------------------------------------------------------------------

	/**
	 * Front-facing camera with a narrow FOV, as close as possible while the whole tank fits
	 * in the free screen area: below the top HUD, above the back button.
	 */
	private getFocusCFrame(camera: Camera): CFrame {
		const origin = this.aquariumCFrame!;
		const viewport = camera.ViewportSize;
		const top = getTopHudBottom() + FRAME_GAP;
		const bottom = viewport.Y - BACK_BUTTON_MARGIN - BACK_BUTTON_SIZE.Y - BACK_BUTTON_DEPTH - FRAME_GAP;
		const freeWidth = math.max(viewport.X - FRAME_GAP * 2, 1);
		const freeHeight = math.max(bottom - top, 1);

		// Studs visible vertically at the front of the tank (and the room above it), so it fills the free area
		const frontHeight = TANK_FRONT_SIZE.Y + this.headroom;
		const visibleHeight = math.max(
			(frontHeight * viewport.Y) / freeHeight,
			(TANK_FRONT_SIZE.X * viewport.Y) / freeWidth,
		);
		const distance = visibleHeight / (2 * math.tan(math.rad(FOCUS_FOV / 2)));

		// Raise the camera so the tank sits in the middle of the free area, not of the screen
		const shift = ((top + bottom) / 2 - viewport.Y / 2) * (visibleHeight / viewport.Y);
		const height = TANK_FRONT_CENTER_Y + this.headroom / 2 + shift;
		const target = origin.PointToWorldSpace(new Vector3(0, height, 0));
		const eye = origin.PointToWorldSpace(new Vector3(0, height, TANK_FRONT_Z - distance));
		return CFrame.lookAt(eye, target);
	}

	/** Over-the-shoulder camera behind the character, looking at the tank. */
	private getExitCFrame(camera: Camera): CFrame {
		const parts = this.getCharacterParts();
		const origin = this.aquariumCFrame;
		if (!parts || !origin) return camera.CFrame;

		const root = parts[0].Position;
		const outward = origin.LookVector; // points out of the front glass
		const eye = root.add(outward.mul(EXIT_CAMERA_OFFSET.Z)).add(new Vector3(0, EXIT_CAMERA_OFFSET.Y, 0));
		return CFrame.lookAt(eye, root.add(new Vector3(0, 2, 0)));
	}

	/** "My aquarium": the character steps in front of its tank's glass (facing it) and the 2.5D view starts. */
	private goToAquarium() {
		const origin = this.aquariumCFrame;
		const parts = this.getCharacterParts();
		const character = Players.LocalPlayer.Character;
		if (this.state !== "Free" || !origin || !parts || !character || parts[1].Health <= 0) return;
		const [root, humanoid] = parts;

		// Middle of the focus zone, on the ground (the client moves its own character)
		const spot = origin.PointToWorldSpace(new Vector3(0, 0, FRONT_GLASS_Z - FOCUS_ZONE_DEPTH / 2));
		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Exclude;
		params.FilterDescendantsInstances = [character];
		const hit = Workspace.Raycast(spot.add(new Vector3(0, 20, 0)), new Vector3(0, -40, 0), params);
		const groundY = hit ? hit.Position.Y : spot.Y;
		const position = new Vector3(spot.X, groundY + humanoid.HipHeight + root.Size.Y / 2, spot.Z);
		root.AssemblyLinearVelocity = Vector3.zero;
		character.PivotTo(CFrame.lookAt(position, position.sub(origin.LookVector)));

		this.mustLeaveZone = false;
		this.enterFocus();
	}

	private enterFocus() {
		const camera = Workspace.CurrentCamera;
		const parts = this.getCharacterParts();
		if (!camera || !parts) return;

		this.state = "Entering";
		const token = ++this.transitionToken;
		this.actionRemote.FireServer("SetFocus", true);
		this.fireViewChanged();

		// Cursor / touch only: no character movement, free mouse
		this.lockMovement(parts[1]);
		UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
		UserInputService.MouseIconEnabled = true;

		this.savedFov = camera.FieldOfView;
		camera.CameraType = Enum.CameraType.Scriptable;

		// Leaving is allowed at any moment, even mid-transition
		this.backButton.Visible = true;
		this.aquariumButton.Visible = false;
		ContextActionService.BindAction(
			EXIT_ACTION,
			(_, inputState) => {
				if (inputState === Enum.UserInputState.Begin) this.exitFocus();
				return Enum.ContextActionResult.Sink;
			},
			false,
			Enum.KeyCode.Q,
			Enum.KeyCode.Backspace,
			Enum.KeyCode.ButtonB,
		);

		this.tweenClarity(1, ENTER_TIME);
		const tween = TweenService.Create(
			camera,
			new TweenInfo(ENTER_TIME, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut),
			{ CFrame: this.getFocusCFrame(camera), FieldOfView: FOCUS_FOV },
		);
		const framedHeadroom = this.headroom;
		tween.Completed.Connect((playbackState) => {
			if (token !== this.transitionToken || playbackState !== Enum.PlaybackState.Completed) return;
			this.state = "Focused";
			// The room above the tank changed while the camera flew in (a UFO showed up): frame it again
			if (this.headroom !== framedHeadroom) this.reframe(camera);
		});
		tween.Play();
	}

	private exitFocus() {
		if (this.state !== "Entering" && this.state !== "Focused") return;
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		this.state = "Exiting";
		const token = ++this.transitionToken;
		this.actionRemote.FireServer("SetFocus", false);
		this.fireViewChanged();
		this.mustLeaveZone = true;
		this.backButton.Visible = false;
		ContextActionService.UnbindAction(EXIT_ACTION);
		this.restoreCharacters();

		this.tweenClarity(0, EXIT_TIME);
		const tween = TweenService.Create(
			camera,
			new TweenInfo(EXIT_TIME, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut),
			{ CFrame: this.getExitCFrame(camera), FieldOfView: this.savedFov },
		);
		tween.Completed.Connect((playbackState) => {
			if (token !== this.transitionToken || playbackState !== Enum.PlaybackState.Completed) return;
			this.giveBackControl(camera);
		});
		tween.Play();
	}

	private giveBackControl(camera: Camera) {
		const parts = this.getCharacterParts();
		camera.CameraType = Enum.CameraType.Custom;
		if (parts) camera.CameraSubject = parts[1];
		this.unlockMovement();
		this.state = "Free";
	}

	/** Respawn while focused: snap back to the normal camera. */
	private resetToFree() {
		if (this.state === "Free") return;
		const camera = Workspace.CurrentCamera;
		this.transitionToken++;
		this.actionRemote.FireServer("SetFocus", false);
		this.backButton.Visible = false;
		ContextActionService.UnbindAction(EXIT_ACTION);
		this.restoreCharacters();
		this.mustLeaveZone = false;
		this.clarityTween?.Cancel();
		this.clarity.Value = 0;
		if (camera) {
			camera.FieldOfView = this.savedFov;
			this.giveBackControl(camera);
		}
		this.fireViewChanged();
	}

	private showOwnerPlate(shown: boolean) {
		if (shown) {
			if (this.hiddenOwnerPlate) this.hiddenOwnerPlate.Enabled = true;
			this.hiddenOwnerPlate = undefined;
			return;
		}
		const plate = this.ownAquarium?.PrimaryPart?.FindFirstChild("OwnerPlate");
		if (!plate || !plate.IsA("SurfaceGui")) return;
		plate.Enabled = false; // local only
		this.hiddenOwnerPlate = plate;
	}

	// ---------------------------------------------------------------------
	// Clear water in the 2.5D view
	// ---------------------------------------------------------------------

	private tweenClarity(goal: number, duration: number) {
		this.clarityTween?.Cancel();
		const info = new TweenInfo(duration, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
		this.clarityTween = TweenService.Create(this.clarity, info, { Value: goal });
		this.clarityTween.Play();
	}

	/** Less haze, clearer front glass and water as `clarity` goes 0 -> 1 (local changes only). */
	private applyClarity() {
		const amount = this.clarity.Value;
		if (!this.atmosphere) {
			// Read once, before the first change: the place's own values are the lobby look
			const instance = Lighting.FindFirstChildOfClass("Atmosphere");
			if (instance) this.atmosphere = { instance, density: instance.Density, haze: instance.Haze };
		}
		const atmosphere = this.atmosphere;
		if (atmosphere) {
			const keep = 1 - (1 - FOCUS_HAZE_KEEP) * amount;
			atmosphere.instance.Density = atmosphere.density * keep;
			atmosphere.instance.Haze = atmosphere.haze * keep;
		}
		const glass = this.ownAquarium?.FindFirstChild("GlassFront");
		if (glass?.IsA("BasePart")) glass.LocalTransparencyModifier = FOCUS_GLASS_CLEAR * amount;
		const water = this.getOwnWater();
		if (water) water.LocalTransparencyModifier = FOCUS_WATER_CLEAR * amount;
	}

	// ---------------------------------------------------------------------
	// Characters standing between the camera and the glass
	// ---------------------------------------------------------------------

	private setCharacterHidden(character: Model, hidden: boolean) {
		const modifier = hidden ? 1 : 0;
		for (const descendant of character.GetDescendants()) {
			if (descendant.IsA("BasePart") || descendant.IsA("Decal")) {
				descendant.LocalTransparencyModifier = modifier;
			} else if (hidden && descendant.IsA("BillboardGui") && descendant.Enabled) {
				// The title would float alone above an invisible avatar (a new one, after a title change, too)
				descendant.Enabled = false;
				this.hiddenBillboards.add(descendant);
			}
		}
		if (!hidden) {
			for (const billboard of this.hiddenBillboards) {
				if (billboard.IsDescendantOf(character)) billboard.Enabled = true;
				if (billboard.IsDescendantOf(character) || !billboard.Parent) this.hiddenBillboards.delete(billboard);
			}
		}
		if (hidden) this.hiddenCharacters.add(character);
		else this.hiddenCharacters.delete(character);
	}

	private restoreCharacters() {
		for (const character of this.hiddenCharacters) {
			this.setCharacterHidden(character, false);
		}
	}

	private updateOccluders() {
		const origin = this.aquariumCFrame;
		if (this.state !== "Entering" && this.state !== "Focused") return;
		if (!origin) return;

		for (const player of Players.GetPlayers()) {
			const character = player.Character;
			const root = character?.FindFirstChild("HumanoidRootPart");
			if (!character || !root || !root.IsA("BasePart")) continue;

			const localPos = origin.PointToObjectSpace(root.Position);
			const blocking = localPos.Z < FRONT_GLASS_Z + 1 && math.abs(localPos.X) < OCCLUDER_HALF_WIDTH;
			if (blocking) {
				// Re-applied every frame: the default camera resets the local character's transparency
				this.setCharacterHidden(character, true);
			} else if (this.hiddenCharacters.has(character)) {
				this.setCharacterHidden(character, false);
			}
		}
	}
}

export const FocusController = new FocusControllerSingleton();
