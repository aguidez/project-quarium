import { Players, TweenService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, NotifyKind } from "shared/network";
import { getTopHudBottom } from "client/ui/App";

const TOAST_GAP = 10; // pixels below the top HUD (shop bar + hint line)
const TOAST_SLIDE = 10; // pixels it slides down while appearing
const SHOW_TIME = 2.2;
const FADE_IN_TIME = 0.2;
const FADE_OUT_TIME = 0.35;
const BACKGROUND_TRANSPARENCY = 0.05;
const STROKE_TRANSPARENCY = 0;

const COLOR_TEXT = Color3.fromRGB(240, 245, 255);
const COLOR_BACKGROUND = Color3.fromHex("#0F1B29"); // UI V2 navy (client/ui/theme.ts NAVY.windowBottom)

/** Discreet by default: only the border colour tells a hint from a failed action. */
const TOAST_STYLES: Record<NotifyKind, { stroke: Color3 }> = {
	info: { stroke: Color3.fromHex("#FFD233") },
	warning: { stroke: Color3.fromHex("#FF4D5E") },
};

const isNotifyKind = t.literal("info", "warning");

/**
 * Server notifications ("Not enough money!", deaths, tutorial hints...) as a small toast
 * under the top HUD, away from the onboarding card at the bottom. Money and the egg shop
 * live in the React UI (UiController / src/client/ui).
 */
class HudControllerSingleton implements Lifecycle {
	private notifyRemote = getRemoteEvent("Notify");
	private actionRemote = getRemoteEvent("RequestAction");

	private toast!: TextLabel;
	private toastStroke!: UIStroke;
	private toastToken = 0;

	public onInit() {
		this.buildUi();
		this.notifyRemote.OnClientEvent.Connect((message: unknown, kind: unknown) => {
			if (!t.string(message)) return;
			this.showToast(message, isNotifyKind(kind) ? kind : "warning");
		});
	}

	public onStart() {
		// Ask for a fresh snapshot in case the initial sync fired before the UI connected
		this.actionRemote.FireServer("RequestSync");
	}

	private buildUi() {
		const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;

		const screenGui = new Instance("ScreenGui");
		screenGui.Name = "AquariumHud";
		screenGui.ResetOnSpawn = false;
		screenGui.IgnoreGuiInset = true; // same coordinates as the React UI (getTopHudBottom)
		screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		screenGui.DisplayOrder = 5; // over the React UI's overlays

		const toast = new Instance("TextLabel");
		toast.Name = "Toast";
		toast.AnchorPoint = new Vector2(0.5, 0);
		toast.Size = new UDim2(0, 0, 0, 42);
		toast.AutomaticSize = Enum.AutomaticSize.X;
		toast.BackgroundColor3 = COLOR_BACKGROUND;
		toast.BorderSizePixel = 0;
		toast.Font = Enum.Font.FredokaOne;
		toast.TextSize = 19;
		toast.TextColor3 = COLOR_TEXT;
		toast.Visible = false;
		toast.Parent = screenGui;

		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 14);
		corner.Parent = toast;
		const padding = new Instance("UIPadding");
		padding.PaddingLeft = new UDim(0, 16);
		padding.PaddingRight = new UDim(0, 16);
		padding.Parent = toast;
		const stroke = new Instance("UIStroke");
		stroke.Thickness = 3;
		stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
		stroke.Parent = toast;

		this.toast = toast;
		this.toastStroke = stroke;
		screenGui.Parent = playerGui;
	}

	private showToast(message: string, kind: NotifyKind) {
		const token = ++this.toastToken;
		const toast = this.toast;
		const style = TOAST_STYLES[kind];
		const top = getTopHudBottom() + TOAST_GAP;

		toast.Text = message;
		this.toastStroke.Color = style.stroke;
		toast.Position = new UDim2(0.5, 0, 0, top - TOAST_SLIDE);
		toast.TextTransparency = 1;
		toast.BackgroundTransparency = 1;
		this.toastStroke.Transparency = 1;
		toast.Visible = true;

		const fadeIn = new TweenInfo(FADE_IN_TIME, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
		TweenService.Create(toast, fadeIn, {
			Position: new UDim2(0.5, 0, 0, top),
			TextTransparency: 0,
			BackgroundTransparency: BACKGROUND_TRANSPARENCY,
		}).Play();
		TweenService.Create(this.toastStroke, fadeIn, { Transparency: STROKE_TRANSPARENCY }).Play();

		task.delay(SHOW_TIME, () => {
			if (token !== this.toastToken) return;
			const fadeOut = new TweenInfo(FADE_OUT_TIME);
			const fade = TweenService.Create(toast, fadeOut, { TextTransparency: 1, BackgroundTransparency: 1 });
			TweenService.Create(this.toastStroke, fadeOut, { Transparency: 1 }).Play();
			fade.Play();
			fade.Completed.Wait();
			if (token === this.toastToken) toast.Visible = false;
		});
	}
}

export const HudController = new HudControllerSingleton();
