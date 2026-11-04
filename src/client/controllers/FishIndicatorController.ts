import { Janitor } from "@rbxts/janitor";
import { CollectionService, Players, TweenService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";
import { HungerState } from "shared/types/fish";
import { getWorldLabelScale } from "client/ui/screenScale";

const BADGE_SIZE = 40; // pixels: constant on screen, readable even from the far focus camera
const PULSE_SCALE = 1.25;
const PULSE_TIME = 0.45;

const BADGE_STYLES: Partial<Record<HungerState, { color: Color3; icon: string }>> = {
	[HungerState.Hungry]: { color: Color3.fromRGB(255, 165, 30), icon: "🍽️" },
	[HungerState.Weak]: { color: Color3.fromRGB(225, 45, 45), icon: "🍽️" }, // red and pulsing: feed it!
};
/** Owner AFK: the fish is paused (no hunger, no coins), shown instead of its hunger. */
const PAUSED_STYLE = { color: Color3.fromRGB(90, 110, 170), icon: "💤" };

/**
 * Renders the hunger badge above every fish from the "Hunger" and "Paused" attributes set by the server.
 * Client-side so it can pulse smoothly without network traffic. None over a fish asleep after a UFO ("Asleep",
 * FishRenderController): its hunger is frozen and its "z Z z" bubble says it all.
 */
class FishIndicatorControllerSingleton implements Lifecycle {
	private janitors = new Map<Instance, Janitor>();
	private container!: Folder;

	public onInit() {
		const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
		this.container = new Instance("Folder");
		this.container.Name = "FishIndicators";
		this.container.Parent = playerGui;

		CollectionService.GetInstanceAddedSignal(TAGS.Fish).Connect((fish) => this.track(fish));
		CollectionService.GetInstanceRemovedSignal(TAGS.Fish).Connect((fish) => this.untrack(fish));
		for (const fish of CollectionService.GetTagged(TAGS.Fish)) this.track(fish);
	}

	public onStart() {
		print("[Client] FishIndicatorController started.");
	}

	private untrack(fish: Instance) {
		this.janitors.get(fish)?.Destroy();
		this.janitors.delete(fish);
	}

	private track(fish: Instance) {
		if (!fish.IsA("Model") || this.janitors.has(fish)) return;
		const janitor = new Janitor();
		this.janitors.set(fish, janitor);

		task.spawn(() => {
			const body = fish.WaitForChild("Body", 10);
			if (!body || !body.IsA("BasePart") || this.janitors.get(fish) !== janitor) return;
			this.createBadge(fish, body, janitor);
		});
	}

	private createBadge(fish: Model, body: BasePart, janitor: Janitor) {
		const billboard = new Instance("BillboardGui");
		billboard.Name = "HungerBadge";
		billboard.Adornee = body;
		const size = BADGE_SIZE * getWorldLabelScale();
		billboard.Size = new UDim2(0, size, 0, size);
		// Follows the fish's height as it grows
		const updateOffset = () => {
			billboard.StudsOffsetWorldSpace = new Vector3(0, body.Size.Y / 2 + 1.2, 0);
		};
		updateOffset();
		janitor.Add(body.GetPropertyChangedSignal("Size").Connect(updateOffset));
		billboard.AlwaysOnTop = true;
		billboard.MaxDistance = math.huge;
		billboard.LightInfluence = 0;
		billboard.Enabled = false;

		const badge = new Instance("Frame");
		badge.AnchorPoint = new Vector2(0.5, 0.5);
		badge.Position = UDim2.fromScale(0.5, 0.5);
		badge.Size = UDim2.fromScale(1, 1);
		badge.BorderSizePixel = 0;
		badge.Parent = billboard;

		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0.5, 0);
		corner.Parent = badge;
		const stroke = new Instance("UIStroke");
		stroke.Color = Color3.fromRGB(255, 255, 255);
		stroke.Thickness = 2.5;
		stroke.Parent = badge;
		const scale = new Instance("UIScale");
		scale.Parent = badge;

		const icon = new Instance("TextLabel");
		icon.AnchorPoint = new Vector2(0.5, 0.5);
		icon.Position = UDim2.fromScale(0.5, 0.5);
		icon.Size = UDim2.fromScale(0.7, 0.7);
		icon.BackgroundTransparency = 1;
		icon.TextScaled = true;
		icon.Font = Enum.Font.GothamBold;
		icon.Parent = badge;

		billboard.Parent = this.container;
		janitor.Add(billboard);

		let pulse: Tween | undefined;
		janitor.Add(() => pulse?.Cancel(), true);

		const refresh = () => {
			const hunger = fish.GetAttribute("Hunger");
			const dead = fish.GetAttribute("Dead") === true;
			const paused = fish.GetAttribute("Paused") === true;
			const asleep = fish.GetAttribute("Asleep") === true;
			const hungerStyle = typeIs(hunger, "string") ? BADGE_STYLES[hunger as HungerState] : undefined;
			const style = dead || asleep ? undefined : paused ? PAUSED_STYLE : hungerStyle;

			billboard.Enabled = style !== undefined;
			if (style) {
				badge.BackgroundColor3 = style.color;
				icon.Text = style.icon;
			}

			// Weak fish pulse to draw attention (not while paused: nothing happens to them then)
			pulse?.Cancel();
			pulse = undefined;
			scale.Scale = 1;
			if (style && !paused && hunger === HungerState.Weak) {
				pulse = TweenService.Create(
					scale,
					new TweenInfo(PULSE_TIME, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
					{ Scale: PULSE_SCALE },
				);
				pulse.Play();
			}
		};

		janitor.Add(fish.GetAttributeChangedSignal("Hunger").Connect(refresh));
		janitor.Add(fish.GetAttributeChangedSignal("Dead").Connect(refresh));
		janitor.Add(fish.GetAttributeChangedSignal("Paused").Connect(refresh));
		janitor.Add(fish.GetAttributeChangedSignal("Asleep").Connect(refresh));
		refresh();
	}
}

export const FishIndicatorController = new FishIndicatorControllerSingleton();
