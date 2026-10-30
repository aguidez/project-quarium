import { Players, TweenService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { PlayerData, getTotalFish } from "shared/types/playerData";
import { COLORS, verticalGradient } from "client/ui/theme";
import { FocusController } from "./FocusController";

const UPDATE_INTERVAL = 0.5;
const PIXELS_PER_STUD = 60;
const PLAQUE_HEIGHT = 96; // px: 1.6 studs on the 2-stud-tall front of the tank's base
// Towards the right end of the base: the bottom-centre of the focus view belongs to the onboarding card
const PLAQUE_POSITION_X = 0.84;
const BUMP_SCALE = 1.15;

const TEXT_COLOR = Color3.fromHex("#3A2408");
const FULL_COLOR = Color3.fromHex("#8A1F12");

/**
 * Small brass plaque on the front of the local player's own tank (FigCraft: CapacityPlaque):
 * "🐟 fish / capacity" (living fish only: eggs don't take room until they are opened).
 * Local-only SurfaceGui, built from the server's PlayerData snapshots.
 */
class CapacityPlaqueControllerSingleton implements Lifecycle {
	private syncRemote = getRemoteEvent("SyncPlayerData");
	private data?: PlayerData;
	private base?: BasePart;
	private gui?: SurfaceGui;
	private stroke!: UIStroke;
	private scale!: UIScale;
	private countLabel!: TextLabel;
	private shownText = "";

	public onInit() {
		this.syncRemote.OnClientEvent.Connect((data: PlayerData) => {
			this.data = data;
			this.refresh();
		});
	}

	public onStart() {
		print("[Client] CapacityPlaqueController started.");

		// The aquarium is assigned by the server after joining (and could change): follow it
		while (true) {
			this.ensureGui();
			task.wait(UPDATE_INTERVAL);
		}
	}

	private ensureGui() {
		const base = FocusController.getOwnAquarium()?.PrimaryPart;
		if (base === this.base) return;

		this.gui?.Destroy();
		this.gui = undefined;
		this.base = base;
		this.shownText = "";
		if (!base) return;
		this.gui = this.buildGui(base);
		this.refresh();
	}

	private buildGui(base: BasePart): SurfaceGui {
		const gui = new Instance("SurfaceGui");
		gui.Name = "CapacityPlaque";
		gui.Adornee = base;
		gui.Face = Enum.NormalId.Front; // the front of a tank is its -Z side
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
		gui.PixelsPerStud = PIXELS_PER_STUD;
		gui.LightInfluence = 0.3;
		gui.ResetOnSpawn = false;

		const plaque = new Instance("Frame");
		plaque.Name = "Plaque";
		plaque.AnchorPoint = new Vector2(0.5, 0.5);
		plaque.Position = UDim2.fromScale(PLAQUE_POSITION_X, 0.5);
		plaque.Size = UDim2.fromOffset(0, PLAQUE_HEIGHT);
		plaque.AutomaticSize = Enum.AutomaticSize.X;
		plaque.BackgroundColor3 = COLORS.white;
		plaque.Parent = gui;

		const gradient = new Instance("UIGradient");
		gradient.Color = verticalGradient(COLORS.railTop, COLORS.railBottom);
		gradient.Rotation = 90;
		gradient.Parent = plaque;
		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 16);
		corner.Parent = plaque;
		this.stroke = new Instance("UIStroke");
		this.stroke.Thickness = 5;
		this.stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
		this.stroke.Parent = plaque;
		this.scale = new Instance("UIScale");
		this.scale.Parent = plaque;
		const padding = new Instance("UIPadding");
		padding.PaddingLeft = new UDim(0, 28);
		padding.PaddingRight = new UDim(0, 28);
		padding.Parent = plaque;
		const layout = new Instance("UIListLayout");
		layout.FillDirection = Enum.FillDirection.Horizontal;
		layout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
		layout.VerticalAlignment = Enum.VerticalAlignment.Center;
		layout.Padding = new UDim(0, 24);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = plaque;

		this.countLabel = this.createLabel(plaque, 1, 58, Enum.Font.GothamBlack);

		gui.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");
		return gui;
	}

	private createLabel(parent: Frame, order: number, textSize: number, font: Enum.Font): TextLabel {
		const label = new Instance("TextLabel");
		label.LayoutOrder = order;
		label.Size = UDim2.fromOffset(0, PLAQUE_HEIGHT);
		label.AutomaticSize = Enum.AutomaticSize.X;
		label.BackgroundTransparency = 1;
		label.Font = font;
		label.TextSize = textSize;
		label.Parent = parent;
		return label;
	}

	private refresh() {
		const data = this.data;
		if (!this.gui || !data) return;

		const fish = getTotalFish(data);
		const full = fish >= data.capacity;
		const text = `${fish} / ${data.capacity}${full ? " · FULL" : ""}`;
		if (text === this.shownText) return;

		this.countLabel.Text = text;
		this.countLabel.TextColor3 = full ? FULL_COLOR : TEXT_COLOR;
		this.stroke.Color = full ? FULL_COLOR : COLORS.goldDark;

		// Little bump whenever the count changes (not on the first display)
		if (this.shownText !== "") {
			this.scale.Scale = BUMP_SCALE;
			TweenService.Create(this.scale, new TweenInfo(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
				Scale: 1,
			}).Play();
		}
		this.shownText = text;
	}
}

export const CapacityPlaqueController = new CapacityPlaqueControllerSingleton();
