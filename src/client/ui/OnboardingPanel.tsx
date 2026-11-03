import React, { useBinding, useEffect, useRef, useState } from "@rbxts/react";
import { RunService, TweenService, Workspace } from "@rbxts/services";
import { SfxName } from "shared/sounds";
import { FOOD_REFILL_TIME, FOOD_RESERVE_SLOTS } from "shared/types/food";
import { OnboardingStep } from "shared/types/onboarding";
import { FoodPellet } from "./FoodReserve";
import { TextStroke } from "./kit";
import { COLORS, FONT_BOLD, FONT_TITLE, NAVY, OUTLINE, PALETTES, verticalGradient } from "./theme";

const MAX_TEXT_WIDTH = 600;
const BOTTOM_MARGIN = 28; // px under the card, unless something sits below it (the food reserve)
const STEP_COUNT = 5;
const POP_IN_TIME = 0.4;
// Gentle "breathing" so the card catches the eye without being annoying
const BREATHE_SPEED = 3.5; // radians per second
const BORDER_MIN = 4; // px of the gold border, which swells up to BORDER_MAX
const BORDER_MAX = 14;
const STROKE_ROOM = BORDER_MAX + 2; // px kept around the card for its border
// Designed for a 1080p screen, grown on bigger screens (never shrunk below MIN_SCREEN_SCALE)
const REFERENCE_HEIGHT = 1080;
const MIN_SCREEN_SCALE = 0.8;
const MAX_SCREEN_SCALE = 1.7;

interface StepContent {
	icon: string;
	/** Drawn instead of the glyph: a food pellet like the reserve's. */
	pellet?: boolean;
	title: string;
	body: string;
	number: number; // "STEP n / STEP_COUNT"
}

/** Instruction of each step; Done has none (the reward popup celebrates it). */
const STEP_CONTENT: Partial<Record<OnboardingStep, StepContent>> = {
	EnterView: {
		icon: "👋",
		title: "Welcome to your aquarium!",
		body: "Walk up to the glass of your aquarium to look after it.",
		number: 1,
	},
	BuyEgg: {
		icon: "🥚",
		title: "Buy your first egg!",
		body: "Click the Common Egg in the shop above. This one is free!",
		number: 2,
	},
	Hatching: {
		icon: "⏳",
		title: "Your egg is incubating...",
		body: "Every fish comes from an egg. Wait until it is ready to hatch!",
		number: 3,
	},
	OpenEgg: {
		icon: "🐣",
		title: "Your egg is ready!",
		body: "Click it in the shop above to open it and discover your fish.",
		number: 3,
	},
	CollectCoin: {
		icon: "💰",
		title: "Your fish drops coins!",
		body: "Click the coin in the water to collect it.",
		number: 4,
	},
	CoinCollected: {
		icon: "🎉",
		title: "Well done!",
		body: "Your fish drop coins over time: collect them to earn money.",
		number: 4,
	},
	Feed: {
		icon: "",
		pellet: true,
		title: "Your fish is hungry!",
		body: `Click the water to drop food. Food is free! Your reserve below holds ${FOOD_RESERVE_SLOTS} portions: an empty one refills in ${FOOD_REFILL_TIME} seconds.`,
		number: 5,
	},
};

export interface OnboardingPanelProps {
	step?: OnboardingStep;
	/** Hidden while something covers the screen (egg reveal); the card pops in again afterwards. */
	hidden?: boolean;
	/** Pixels kept free under the card (the food reserve sits there from the Feed step); BOTTOM_MARGIN otherwise. */
	bottom?: number;
	playSfx: (name: SfxName, playbackSpeed?: number) => void;
}

function computeScreenScale(): number {
	const viewport = Workspace.CurrentCamera?.ViewportSize;
	return viewport ? math.clamp(viewport.Y / REFERENCE_HEIGHT, MIN_SCREEN_SCALE, MAX_SCREEN_SCALE) : 1;
}

function useScreenScale(): number {
	const [scale, setScale] = useState(computeScreenScale);
	useEffect(() => {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		const connection = camera
			.GetPropertyChangedSignal("ViewportSize")
			.Connect(() => setScale(computeScreenScale()));
		return () => connection.Disconnect();
	}, []);
	return scale;
}

/** Seconds since the component mounted, updated every frame. */
function useTimeSinceMount(): React.Binding<number> {
	const [time, setTime] = useBinding(0);
	useEffect(() => {
		const start = os.clock();
		const connection = RunService.Heartbeat.Connect(() => setTime(os.clock() - start));
		return () => connection.Disconnect();
	}, []);
	return time;
}

/** One instruction card (FigCraft: OnboardingCard frame, horizontal auto layout); pops in, then breathes. */
function OnboardingCard(props: { content: StepContent; screenScale: number; bottom: number }) {
	const time = useTimeSinceMount();
	const content = props.content;
	// The card fades in at its final size (scaling it would make its text wobble), and the breathing is
	// on the border only, so the text always stays still
	const fadeIn = time.map((t) =>
		TweenService.GetValue(math.min(t / POP_IN_TIME, 1), Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	);
	// 0 -> 1 -> 0 breathing cycle, starting once the card has faded in
	const breathe = time.map((t) => (t > POP_IN_TIME ? 0.5 - 0.5 * math.cos((t - POP_IN_TIME) * BREATHE_SPEED) : 0));

	return (
		<canvasgroup
			key="OnboardingCard"
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -props.bottom + STROKE_ROOM * props.screenScale)}
			Size={UDim2.fromOffset(0, 0)}
			AutomaticSize={Enum.AutomaticSize.XY}
			BackgroundTransparency={1}
			GroupTransparency={fadeIn.map((p) => 1 - p)}
			ZIndex={15}
		>
			<uiscale Scale={props.screenScale} />
			{/* Room for the swelling border, drawn outside the card (the group clips to its bounds) */}
			<uipadding
				PaddingTop={new UDim(0, STROKE_ROOM)}
				PaddingBottom={new UDim(0, STROKE_ROOM)}
				PaddingLeft={new UDim(0, STROKE_ROOM)}
				PaddingRight={new UDim(0, STROKE_ROOM)}
			/>
			<frame
				key="Card"
				Size={UDim2.fromOffset(0, 0)}
				AutomaticSize={Enum.AutomaticSize.XY}
				BackgroundColor3={COLORS.white}
			>
				<uicorner CornerRadius={new UDim(0, 22)} />
				<uigradient Color={verticalGradient(NAVY.windowTop, NAVY.windowBottom)} Rotation={90} />
				{/* The border swells outward and glows: the box looks like it grows around fixed content */}
				<uistroke
					Color={COLORS.gold}
					Thickness={breathe.map((b) => BORDER_MIN + (BORDER_MAX - BORDER_MIN) * b)}
					Transparency={breathe.map((b) => 0.45 * b)}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uipadding
					PaddingTop={new UDim(0, 16)}
					PaddingBottom={new UDim(0, 16)}
					PaddingLeft={new UDim(0, 18)}
					PaddingRight={new UDim(0, 26)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 18)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

				<frame key="Icon" LayoutOrder={1} Size={UDim2.fromOffset(68, 68)} BackgroundColor3={COLORS.white}>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uistroke Color={OUTLINE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					<uigradient Color={verticalGradient(PALETTES.gold.light, PALETTES.gold.dark)} Rotation={90} />
					{content.pellet ? (
						<FoodPellet size={UDim2.fromScale(0.6, 0.6)} />
					) : (
						<textlabel
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={UDim2.fromScale(0.5, 0.5)}
							Size={UDim2.fromScale(0.62, 0.62)}
							BackgroundTransparency={1}
							Text={content.icon}
							TextScaled={true}
						/>
					)}
				</frame>

				<frame
					key="Texts"
					LayoutOrder={2}
					Size={UDim2.fromOffset(0, 0)}
					AutomaticSize={Enum.AutomaticSize.XY}
					BackgroundTransparency={1}
				>
					<uilistlayout Padding={new UDim(0, 3)} SortOrder={Enum.SortOrder.LayoutOrder} />
					<textlabel
						key="Step"
						LayoutOrder={1}
						Size={UDim2.fromOffset(0, 16)}
						AutomaticSize={Enum.AutomaticSize.X}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={`STEP ${content.number} / ${STEP_COUNT}`}
						TextSize={15}
						TextColor3={NAVY.muted}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<textlabel
						key="Title"
						LayoutOrder={2}
						Size={UDim2.fromOffset(0, 36)}
						AutomaticSize={Enum.AutomaticSize.X}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text={content.title.upper()}
						TextSize={30}
						TextColor3={PALETTES.gold.base}
						TextXAlignment={Enum.TextXAlignment.Left}
					>
						<TextStroke thickness={3} />
					</textlabel>
					<textlabel
						key="Body"
						LayoutOrder={3}
						Size={UDim2.fromOffset(0, 0)}
						AutomaticSize={Enum.AutomaticSize.XY}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={content.body}
						TextSize={20}
						TextColor3={COLORS.white}
						TextWrapped={true}
						TextXAlignment={Enum.TextXAlignment.Left}
					>
						<TextStroke />
						<uisizeconstraint MaxSize={new Vector2(MAX_TEXT_WIDTH, math.huge)} />
					</textlabel>
				</frame>
			</frame>
		</canvasgroup>
	);
}

/** Bottom-of-screen instruction for the current onboarding step (the server validates each step). */
export function OnboardingPanel(props: OnboardingPanelProps) {
	const step = props.step;
	const screenScale = useScreenScale();
	const previousStep = useRef<OnboardingStep>();

	useEffect(() => {
		const previous = previousStep.current;
		previousStep.current = step;
		if (step === undefined || step === "Done" || previous === undefined || previous === step) return;
		props.playSfx("OnboardingStep", step === "CoinCollected" ? 1.2 : 1);
	}, [step]);

	const content = step !== undefined ? STEP_CONTENT[step] : undefined;
	if (!content || props.hidden) return undefined;
	return (
		<OnboardingCard
			key={`Card${step}`}
			content={content}
			screenScale={screenScale}
			bottom={props.bottom ?? BOTTOM_MARGIN}
		/>
	);
}
