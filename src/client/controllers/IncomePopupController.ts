import { Players, TweenService, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { formatShort } from "shared/format";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, MoneyPopup } from "shared/network";
import { getWorldLabelScale } from "client/ui/screenScale";

const POPUP_LIFETIME = 1.2;
const POPUP_RISE = 3; // studs

const isMoneyPopup = t.interface({
	position: t.Vector3,
	amount: t.number,
	special: t.boolean,
	ocean: t.optional(t.boolean),
	stolen: t.optional(t.boolean),
	ghost: t.optional(t.boolean),
});

const POPUP_STYLES = {
	normal: { width: 100, color: Color3.fromRGB(90, 255, 110), stroke: Color3.fromRGB(0, 70, 20), suffix: "" },
	special: { width: 140, color: Color3.fromRGB(255, 215, 70), stroke: Color3.fromRGB(110, 60, 0), suffix: "" },
	// A fish released to the ocean (Ocean Points, not money)
	ocean: { width: 140, color: Color3.fromRGB(127, 240, 255), stroke: Color3.fromRGB(8, 60, 90), suffix: " Ocean" },
	// A coin snatched by the lantern fish of the abyssal raid (money lost)
	stolen: { width: 140, color: Color3.fromRGB(255, 90, 90), stroke: Color3.fromRGB(80, 0, 10), suffix: "" },
	// A ghost fish's ghost coin
	ghost: { width: 150, color: Color3.fromRGB(200, 240, 255), stroke: Color3.fromRGB(30, 70, 110), suffix: "" },
};

type PopupStyle = keyof typeof POPUP_STYLES;

/**
 * Floating green "+X$" where a coin was collected (gold for a sparkling one, pale for a ghost coin),
 * cyan "+X Ocean" where a fish was released, red "-X$" where the lantern fish stole a coin (visual
 * only, the server credits). No emoji in these texts.
 */
class IncomePopupControllerSingleton implements Lifecycle {
	private popupRemote = getRemoteEvent("MoneyPopup");
	private playerGui!: PlayerGui;

	public onInit() {
		// Straight in PlayerGui with ResetOnSpawn off: a respawn empties PlayerGui of everything else (the Folder that
		// held the popups was lost at the first respawn, and no "+X$" showed afterwards)
		this.playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;

		this.popupRemote.OnClientEvent.Connect((popup: MoneyPopup) => {
			if (!isMoneyPopup(popup)) return;
			let style: PopupStyle = popup.special ? "special" : "normal";
			if (popup.ghost) style = "ghost";
			if (popup.ocean) style = "ocean";
			if (popup.stolen) style = "stolen";
			this.showPopup(popup.position, popup.amount, style);
		});
	}

	public onStart() {
		print("[Client] IncomePopupController started.");
	}

	private showPopup(position: Vector3, amount: number, styleName: PopupStyle) {
		const style = POPUP_STYLES[styleName];
		const ocean = styleName === "ocean";
		const stolen = styleName === "stolen";

		// Local anchor at the coin's last position
		const anchor = new Instance("Attachment");
		anchor.WorldPosition = position;
		anchor.Parent = Workspace.Terrain;

		const billboard = new Instance("BillboardGui");
		billboard.Name = "IncomePopup";
		billboard.Adornee = anchor;
		const labelScale = getWorldLabelScale();
		billboard.Size = UDim2.fromOffset(style.width * labelScale, (styleName === "normal" ? 34 : 44) * labelScale);
		billboard.AlwaysOnTop = true;
		billboard.MaxDistance = math.huge;
		billboard.LightInfluence = 0;

		const label = new Instance("TextLabel");
		label.Size = UDim2.fromScale(1, 1);
		label.BackgroundTransparency = 1;
		label.Font = Enum.Font.LuckiestGuy; // UI V2 title font: arcade "+X$"
		label.TextScaled = true;
		const shown = formatShort(amount);
		label.Text = ocean ? `+${shown}${style.suffix}` : `${stolen ? "-" : "+"}${shown}$${style.suffix}`;
		label.TextColor3 = style.color;
		label.TextStrokeColor3 = style.stroke;
		label.TextStrokeTransparency = 0.2;
		label.Parent = billboard;

		billboard.ResetOnSpawn = false;
		billboard.Parent = this.playerGui;

		const info = new TweenInfo(POPUP_LIFETIME, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
		TweenService.Create(billboard, info, { StudsOffsetWorldSpace: new Vector3(0, POPUP_RISE, 0) }).Play();
		TweenService.Create(label, info, { TextTransparency: 1, TextStrokeTransparency: 1 }).Play();

		task.delay(POPUP_LIFETIME, () => {
			billboard.Destroy();
			anchor.Destroy();
		});
	}
}

export const IncomePopupController = new IncomePopupControllerSingleton();
