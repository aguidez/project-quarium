import { Janitor } from "@rbxts/janitor";
import { CollectionService, Players, RunService, TweenService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";

const SLOT_SIZE = 32; // pixels: constant on screen, like the fish's hunger badges
const PELLET_SIZE = 24;
const GAP = 7;
const PADDING = 7;
const HEAD_GAP = 1; // studs between the top of the Pelican and the gauge
const POP_SCALE = 1.3;
const POP_TIME = 0.35;

const PILL_COLOR = Color3.fromHex("#0D1D26");
const PILL_STROKE = Color3.fromHex("#E8B44A");
const SLOT_COLOR = Color3.fromHex("#06121A");
const SLOT_STROKE = Color3.fromHex("#2E5566");
const PELLET_LIGHT = Color3.fromHex("#F0A65A");
const PELLET_DARK = Color3.fromHex("#A85A1C");
const SHINE_COLOR = Color3.fromHex("#FFE2B8");

interface Slot {
	pellet: Frame;
	fill: Frame;
	scale: UIScale;
}

function corner(parent: Instance, radius: UDim) {
	const uiCorner = new Instance("UICorner");
	uiCorner.CornerRadius = radius;
	uiCorner.Parent = parent;
}

function stroke(parent: Instance, color: Color3, thickness: number) {
	const uiStroke = new Instance("UIStroke");
	uiStroke.Color = color;
	uiStroke.Thickness = thickness;
	uiStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
	uiStroke.Parent = parent;
}

/** A food pellet: round, lit from the top left. */
function createPellet(parent: Instance): Frame {
	const pellet = new Instance("Frame");
	pellet.Name = "Pellet";
	pellet.AnchorPoint = new Vector2(0.5, 0.5);
	pellet.Position = UDim2.fromScale(0.5, 0.5);
	pellet.Size = UDim2.fromOffset(PELLET_SIZE, PELLET_SIZE);
	pellet.BackgroundColor3 = Color3.fromRGB(255, 255, 255);
	pellet.BorderSizePixel = 0;
	corner(pellet, new UDim(0.5, 0));
	const gradient = new Instance("UIGradient");
	gradient.Color = new ColorSequence(PELLET_LIGHT, PELLET_DARK);
	gradient.Rotation = 60;
	gradient.Parent = pellet;
	const shine = new Instance("Frame");
	shine.Name = "Shine";
	shine.Position = UDim2.fromOffset(5, 4);
	shine.Size = UDim2.fromOffset(9, 6);
	shine.BackgroundColor3 = SHINE_COLOR;
	shine.BackgroundTransparency = 0.6;
	shine.BorderSizePixel = 0;
	corner(shine, new UDim(0.5, 0));
	shine.Parent = pellet;
	pellet.Parent = parent;
	return pellet;
}

/**
 * The food charges of the local player's on-demand Pelican (Smart Pelican perk), drawn above its head:
 * one slot per charge, full ones show a pellet, the one refilling fills up from the bottom. Read from
 * the attributes CompanionService sets on the Pelican's model ("Charges", "MaxCharges", "NextChargeAt",
 * "ChargeInterval"); hidden while the Pelican still feeds on a timer (MaxCharges 0). Only its owner sees it.
 */
class PelicanChargesControllerSingleton implements Lifecycle {
	private janitors = new Map<Instance, Janitor>();

	public onInit() {
		CollectionService.GetInstanceAddedSignal(TAGS.Companion).Connect((model) => this.track(model));
		CollectionService.GetInstanceRemovedSignal(TAGS.Companion).Connect((model) => this.untrack(model));
		for (const model of CollectionService.GetTagged(TAGS.Companion)) this.track(model);
	}

	public onStart() {
		print("[Client] PelicanChargesController started.");
	}

	private untrack(model: Instance) {
		this.janitors.get(model)?.Destroy();
		this.janitors.delete(model);
	}

	private track(model: Instance) {
		if (!model.IsA("Model") || this.janitors.has(model)) return;
		if (model.GetAttribute("CompanionType") !== "Pelican") return;
		if (model.GetAttribute("Owner") !== Players.LocalPlayer.UserId) return;
		const janitor = new Janitor();
		this.janitors.set(model, janitor);

		task.spawn(() => {
			const body = model.WaitForChild("Body", 10);
			if (!body || !body.IsA("BasePart") || this.janitors.get(model) !== janitor) return;
			this.createGauge(model, body, janitor);
		});
	}

	private createGauge(model: Model, body: BasePart, janitor: Janitor) {
		const billboard = janitor.Add(new Instance("BillboardGui"));
		billboard.Name = "PelicanCharges";
		billboard.Adornee = body;
		billboard.AlwaysOnTop = true;
		billboard.MaxDistance = math.huge;
		billboard.LightInfluence = 0;
		billboard.Enabled = false;
		// Follows the Pelican's size (it pops in from nothing)
		const updateOffset = () => {
			billboard.StudsOffsetWorldSpace = new Vector3(0, body.Size.Y / 2 + HEAD_GAP, 0);
		};
		updateOffset();
		janitor.Add(body.GetPropertyChangedSignal("Size").Connect(updateOffset));

		const pill = new Instance("Frame");
		pill.Name = "Pill";
		pill.AnchorPoint = new Vector2(0.5, 0.5);
		pill.Position = UDim2.fromScale(0.5, 0.5);
		pill.Size = UDim2.fromScale(1, 1);
		pill.BackgroundColor3 = PILL_COLOR;
		pill.BorderSizePixel = 0;
		corner(pill, new UDim(0.5, 0));
		stroke(pill, PILL_STROKE, 2);
		const layout = new Instance("UIListLayout");
		layout.FillDirection = Enum.FillDirection.Horizontal;
		layout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
		layout.VerticalAlignment = Enum.VerticalAlignment.Center;
		layout.Padding = new UDim(0, GAP);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = pill;
		pill.Parent = billboard;

		let slots = new Array<Slot>();
		let shownCharges = -1;
		const build = (count: number) => {
			for (const slot of slots) slot.pellet.Parent?.Destroy();
			slots = [];
			for (let i = 0; i < count; i++) {
				const frame = new Instance("Frame");
				frame.Name = `Slot${i + 1}`;
				frame.LayoutOrder = i;
				frame.Size = UDim2.fromOffset(SLOT_SIZE, SLOT_SIZE);
				frame.BackgroundColor3 = SLOT_COLOR;
				frame.BorderSizePixel = 0;
				corner(frame, new UDim(0.5, 0));
				stroke(frame, SLOT_STROKE, 2);
				// Refilling: a faint pellet grows from the centre (a clipped bar would ignore the round corners)
				const fill = new Instance("Frame");
				fill.Name = "Fill";
				fill.AnchorPoint = new Vector2(0.5, 0.5);
				fill.Position = UDim2.fromScale(0.5, 0.5);
				fill.Size = UDim2.fromOffset(0, 0);
				fill.BackgroundColor3 = PELLET_DARK;
				fill.BackgroundTransparency = 0.35;
				fill.BorderSizePixel = 0;
				corner(fill, new UDim(0.5, 0));
				fill.Parent = frame;
				const pellet = createPellet(frame);
				const scale = new Instance("UIScale");
				scale.Parent = pellet;
				frame.Parent = pill;
				slots.push({ pellet, fill, scale });
			}
			billboard.Size = UDim2.fromOffset(
				count * SLOT_SIZE + (count - 1) * GAP + PADDING * 2,
				SLOT_SIZE + PADDING * 2,
			);
			shownCharges = -1;
		};

		const render = () => {
			const maxCharges = (model.GetAttribute("MaxCharges") as number | undefined) ?? 0;
			billboard.Enabled = maxCharges > 0;
			if (maxCharges <= 0) return;
			if (slots.size() !== maxCharges) build(maxCharges);
			const charges = math.clamp((model.GetAttribute("Charges") as number | undefined) ?? 0, 0, maxCharges);
			const nextChargeAt = model.GetAttribute("NextChargeAt") as number | undefined;
			const interval = (model.GetAttribute("ChargeInterval") as number | undefined) ?? 1;
			const progress =
				nextChargeAt !== undefined
					? math.clamp(1 - (nextChargeAt - Workspace.GetServerTimeNow()) / interval, 0, 1)
					: 0;
			for (let i = 0; i < slots.size(); i++) {
				const slot = slots[i];
				const full = i < charges;
				slot.pellet.Visible = full;
				// Only the next charge to come refills
				const grown = !full && i === charges ? math.floor(PELLET_SIZE * progress) : 0;
				slot.fill.Size = UDim2.fromOffset(grown, grown);
				// A charge just earned pops in
				if (full && shownCharges >= 0 && i >= shownCharges) {
					slot.scale.Scale = POP_SCALE;
					TweenService.Create(slot.scale, new TweenInfo(POP_TIME, Enum.EasingStyle.Back), {
						Scale: 1,
					}).Play();
				}
			}
			shownCharges = charges;
		};
		render();
		janitor.Add(RunService.RenderStepped.Connect(render));
		billboard.Parent = body; // local child of the replicated model: goes away with it
	}
}

export const PelicanChargesController = new PelicanChargesControllerSingleton();
