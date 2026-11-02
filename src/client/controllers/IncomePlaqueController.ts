import { CollectionService, Players } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { formatNumber } from "shared/format";
import { TAGS } from "shared/tags";
import { INCOME_ATTRIBUTES } from "shared/types/aquarium";
import { formatMultiplier } from "shared/types/rebirths";
import { COLORS, verticalGradient } from "client/ui/theme";

const UPDATE_INTERVAL = 0.5;
const PIXELS_PER_STUD = 60;
const PLAQUE_HEIGHT = 96; // px: 1.6 studs on the 2-stud-tall front of the tank's base (as the capacity plaque)
// Towards the left end of the base, opposite the own tank's capacity plaque (CapacityPlaqueController)
const PLAQUE_POSITION_X = 0.16;

const TEXT_COLOR = Color3.fromHex("#3A2408");
const MULTIPLIER_COLOR = Color3.fromHex("#8A5A12");
const PAUSED_COLOR = Color3.fromHex("#6B6152");

interface Plaque {
	gui: SurfaceGui;
	income: TextLabel;
	multiplier: TextLabel;
	shownText: string;
}

/**
 * Brass plaque on the front of every owned tank: what it earns ("+4,892,750$/s  x500", or "paused" while its owner is
 * away), so each player sees what the other tanks give. Read from the aquarium's INCOME_ATTRIBUTES (FishService,
 * every second). Local SurfaceGuis in PlayerGui, adorned to each tank's base.
 */
class IncomePlaqueControllerSingleton implements Lifecycle {
	private plaques = new Map<Model, Plaque>();

	public onInit() {}

	public onStart() {
		print("[Client] IncomePlaqueController started.");
		while (true) {
			this.update();
			task.wait(UPDATE_INTERVAL);
		}
	}

	private update() {
		const seen = new Set<Model>();
		for (const instance of CollectionService.GetTagged(TAGS.Aquarium)) {
			if (!instance.IsA("Model")) continue;
			const base = instance.PrimaryPart;
			const perSecond = instance.GetAttribute(INCOME_ATTRIBUTES.perSecond);
			if (!base || instance.GetAttribute("OwnerUserId") === undefined || !typeIs(perSecond, "number")) continue;
			seen.add(instance);
			let plaque = this.plaques.get(instance);
			if (plaque && plaque.gui.Adornee !== base) {
				plaque.gui.Destroy();
				plaque = undefined;
			}
			if (!plaque) {
				plaque = this.build(base);
				this.plaques.set(instance, plaque);
			}
			this.refresh(plaque, instance, perSecond);
		}
		// Free tanks (or gone): no plaque
		for (const [model, plaque] of this.plaques) {
			if (seen.has(model)) continue;
			plaque.gui.Destroy();
			this.plaques.delete(model);
		}
	}

	private build(base: BasePart): Plaque {
		const gui = new Instance("SurfaceGui");
		gui.Name = "IncomePlaque";
		gui.Adornee = base;
		gui.Face = Enum.NormalId.Front; // the front of a tank is its -Z side
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
		gui.PixelsPerStud = PIXELS_PER_STUD;
		gui.LightInfluence = 0.3;
		gui.ResetOnSpawn = false;

		const frame = new Instance("Frame");
		frame.Name = "Plaque";
		frame.AnchorPoint = new Vector2(0.5, 0.5);
		frame.Position = UDim2.fromScale(PLAQUE_POSITION_X, 0.5);
		frame.Size = UDim2.fromOffset(0, PLAQUE_HEIGHT);
		frame.AutomaticSize = Enum.AutomaticSize.X;
		frame.BackgroundColor3 = COLORS.white;
		frame.Parent = gui;

		const gradient = new Instance("UIGradient");
		gradient.Color = verticalGradient(COLORS.railTop, COLORS.railBottom);
		gradient.Rotation = 90;
		gradient.Parent = frame;
		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 16);
		corner.Parent = frame;
		const stroke = new Instance("UIStroke");
		stroke.Thickness = 5;
		stroke.Color = COLORS.goldDark;
		stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
		stroke.Parent = frame;
		const padding = new Instance("UIPadding");
		padding.PaddingLeft = new UDim(0, 28);
		padding.PaddingRight = new UDim(0, 28);
		padding.Parent = frame;
		const layout = new Instance("UIListLayout");
		layout.FillDirection = Enum.FillDirection.Horizontal;
		layout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
		layout.VerticalAlignment = Enum.VerticalAlignment.Center;
		layout.Padding = new UDim(0, 20);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = frame;

		const income = this.createLabel(frame, 1, 58, Enum.Font.GothamBlack, TEXT_COLOR);
		const multiplier = this.createLabel(frame, 2, 44, Enum.Font.GothamBold, MULTIPLIER_COLOR);

		gui.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");
		return { gui, income, multiplier, shownText: "" };
	}

	private createLabel(parent: Frame, order: number, textSize: number, font: Enum.Font, color: Color3): TextLabel {
		const label = new Instance("TextLabel");
		label.LayoutOrder = order;
		label.Size = UDim2.fromOffset(0, PLAQUE_HEIGHT);
		label.AutomaticSize = Enum.AutomaticSize.X;
		label.BackgroundTransparency = 1;
		label.Font = font;
		label.TextSize = textSize;
		label.TextColor3 = color;
		label.Parent = parent;
		return label;
	}

	private refresh(plaque: Plaque, aquarium: Model, perSecond: number) {
		const paused = aquarium.GetAttribute(INCOME_ATTRIBUTES.paused) === true;
		const multiplier = aquarium.GetAttribute(INCOME_ATTRIBUTES.multiplier);
		const income = `+${formatNumber(perSecond)}$/s`;
		const bonus = typeIs(multiplier, "number") && multiplier > 1 ? formatMultiplier(multiplier) : "";
		const text = paused ? `${income}|paused` : `${income}|${bonus}`;
		if (text === plaque.shownText) return;
		plaque.shownText = text;
		plaque.income.Text = income;
		plaque.income.TextColor3 = paused ? PAUSED_COLOR : TEXT_COLOR;
		plaque.multiplier.Text = paused ? "paused" : bonus;
		plaque.multiplier.Visible = paused || bonus !== "";
	}
}

export const IncomePlaqueController = new IncomePlaqueControllerSingleton();
