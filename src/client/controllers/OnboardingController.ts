import { CollectionService, Players, TweenService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { TAGS } from "shared/tags";
import { FOCUS_ZONE_DEPTH, FRONT_GLASS_Z, getAquariumFrame } from "shared/types/aquarium";
import { OnboardingStep } from "shared/types/onboarding";
import { PlayerData } from "shared/types/playerData";
import { FocusController } from "./FocusController";

const UPDATE_INTERVAL = 0.25;
const MARKER_COLOR = Color3.fromHex("#FFC93C");
const MARKER_DIAMETER = 10;
const BOUNCE_HEIGHT = 1.2; // studs
const BOUNCE_TIME = 0.5;

/** Bouncing "👇 text" sign above a part, always on top so it reads from any camera. */
function createPointer(text: string, adornee: BasePart, offsetY: number): BillboardGui {
	const billboard = new Instance("BillboardGui");
	billboard.Name = "OnboardingPointer";
	billboard.Adornee = adornee;
	billboard.Size = UDim2.fromOffset(160, 90);
	billboard.StudsOffsetWorldSpace = new Vector3(0, offsetY, 0);
	billboard.AlwaysOnTop = true;
	billboard.MaxDistance = math.huge;
	billboard.LightInfluence = 0;

	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 0.4, 0);
	label.BackgroundTransparency = 1;
	label.Font = Enum.Font.LuckiestGuy;
	label.Text = text;
	label.TextScaled = true;
	label.TextColor3 = MARKER_COLOR;
	label.TextStrokeTransparency = 0.2;
	label.Parent = billboard;

	const hand = new Instance("TextLabel");
	hand.Position = UDim2.fromScale(0, 0.4);
	hand.Size = new UDim2(1, 0, 0.6, 0);
	hand.BackgroundTransparency = 1;
	hand.Text = "👇";
	hand.TextScaled = true;
	hand.Parent = billboard;

	TweenService.Create(
		billboard,
		new TweenInfo(BOUNCE_TIME, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
		{ StudsOffsetWorldSpace: new Vector3(0, offsetY + BOUNCE_HEIGHT, 0) },
	).Play();
	return billboard;
}

/**
 * 3D hints of the onboarding (the instructions themselves are in the React UI): a glowing
 * marker on the floor in front of the player's tank while they must walk to the glass, and a
 * pointer above the frozen coin they must collect. Local-only instances, purely visual.
 */
class OnboardingControllerSingleton implements Lifecycle {
	private syncRemote = getRemoteEvent("SyncPlayerData");
	private step?: OnboardingStep;
	private floorMarker?: Model;

	public onInit() {
		this.syncRemote.OnClientEvent.Connect((data: PlayerData) => {
			this.step = data.onboarding;
		});

		CollectionService.GetInstanceAddedSignal(TAGS.Coin).Connect((coin) => this.onCoinAdded(coin));
		for (const coin of CollectionService.GetTagged(TAGS.Coin)) this.onCoinAdded(coin);
	}

	public onStart() {
		print("[Client] OnboardingController started.");

		while (true) {
			task.wait(UPDATE_INTERVAL);
			this.updateFloorMarker();
		}
	}

	/** Frozen (onboarding) coins of the local player's tank get a "Click!" pointer. */
	private onCoinAdded(coin: Instance) {
		if (!coin.IsA("BasePart") || coin.GetAttribute("Frozen") !== true) return;
		const aquarium = FocusController.getOwnAquarium();
		if (!aquarium || !coin.IsDescendantOf(aquarium)) return;
		// Parented to the coin: destroyed along with it once collected
		createPointer("Click!", coin, coin.Size.Y / 2 + 2.5).Parent = coin;
	}

	private updateFloorMarker() {
		const aquarium = FocusController.getOwnAquarium();
		const wanted = this.step === "EnterView" && aquarium !== undefined && !FocusController.isFocused();
		if (!wanted) {
			this.floorMarker?.Destroy();
			this.floorMarker = undefined;
			return;
		}
		if (this.floorMarker) return;

		const frame = getAquariumFrame(aquarium!);
		if (!frame) return;
		const center = frame.PointToWorldSpace(new Vector3(0, 0, FRONT_GLASS_Z - FOCUS_ZONE_DEPTH / 2));

		// Sit on whatever floor is in front of the glass
		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Exclude;
		const character = Players.LocalPlayer.Character;
		params.FilterDescendantsInstances = character ? [character] : [];
		const hit = Workspace.Raycast(center.add(new Vector3(0, 10, 0)), new Vector3(0, -30, 0), params);
		const floorY = hit ? hit.Position.Y : center.Y;

		const model = new Instance("Model");
		model.Name = "OnboardingFloorMarker";

		const ring = new Instance("Part");
		ring.Name = "Ring";
		ring.Shape = Enum.PartType.Cylinder;
		ring.Size = new Vector3(0.2, MARKER_DIAMETER, MARKER_DIAMETER);
		ring.CFrame = new CFrame(center.X, floorY + 0.15, center.Z).mul(CFrame.Angles(0, 0, math.rad(90)));
		ring.Anchored = true;
		ring.CanCollide = false;
		ring.CanQuery = false;
		ring.CanTouch = false;
		ring.CastShadow = false;
		ring.Material = Enum.Material.Neon;
		ring.Color = MARKER_COLOR;
		ring.Transparency = 0.45;
		ring.Parent = model;
		TweenService.Create(ring, new TweenInfo(0.8, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
			Transparency: 0.8,
		}).Play();

		createPointer("Walk here", ring, 5).Parent = ring;
		model.Parent = Workspace;
		this.floorMarker = model;
	}
}

export const OnboardingController = new OnboardingControllerSingleton();
