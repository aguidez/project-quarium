import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService, TweenService } from "@rbxts/services";
import { EGG_TYPES, getEggPrice, STARTER_EGG } from "shared/types/eggs";
import { FIRST_GOAL_FISH, FirstGoalStep, getFirstGoalStep } from "shared/types/goals";
import { getFishAndEggs, PlayerData } from "shared/types/playerData";
import { getQuestConfig, isQuestComplete, isQuestLocked, QuestProgress } from "shared/types/quests";
import { Chip, CoinIcon, Plate, ProgressBar, TextStroke } from "./kit";
import { formatNumber, getWrappedHeight } from "./Panel";
import { getStatImage } from "./QuestPanel";
import { EGG_SPRITES, FONT_BOLD, FONT_TITLE, NAVY, OUTLINE, PALETTES } from "./theme";

const WIDTH = 300;
const PADDING = 14;
const ICON_SIZE = 56;
const GAP = 12;
const TEXT_WIDTH = WIDTH - PADDING * 2 - ICON_SIZE - GAP;
const TITLE_SIZE = 22;
const BODY_SIZE = 16;
const BAR_HEIGHT = 20;
const RIGHT_MARGIN = 16;
const FADE_IN_TIME = 0.35;
const WHITE = new Color3(1, 1, 1);

/** What the "Next goal" card follows: the first goals (shared/types/goals.ts), then the story quests to claim. */
export type TrackedGoal = { kind: "First"; step: FirstGoalStep } | { kind: "Quest"; quest: QuestProgress };

/**
 * The goal to show: the first goals right after the tutorial, then "First steps" (the Snail), then the main line
 * (Saving Up, the Voyage) to its end. Undefined before the tutorial's end and once the main line is over.
 */
export function getTrackedGoal(data: PlayerData, serverNow: number): TrackedGoal | undefined {
	const step = getFirstGoalStep(data, serverNow);
	if (step) return { kind: "First", step };
	if (data.onboarding !== "Done") return undefined;
	for (const quest of [data.quests.lines.Start, data.quests.lines.Rebirth]) {
		if (quest && !quest.claimed && !isQuestLocked(quest.id, data.passes)) return { kind: "Quest", quest };
	}
	return undefined;
}

/** The shop's egg the card points at (EggSlot's pulsing ring and hand), if any. */
export function getGoalEgg(goal: TrackedGoal | undefined) {
	return goal?.kind === "First" ? goal.step.egg : undefined;
}

interface GoalDisplay {
	key: string;
	title: string;
	body: string;
	image?: string;
	bar?: { ratio: number; text: string };
	/** A quest done and waiting in the book: the card turns gold and opens the Quests panel. */
	claim?: boolean;
}

function describe(goal: TrackedGoal, data: PlayerData): GoalDisplay | undefined {
	if (goal.kind === "Quest") {
		const config = getQuestConfig(goal.quest.id);
		if (!config) return undefined;
		const done = isQuestComplete(goal.quest);
		const unit = config.stat === "CoinMoney" || config.stat === "MoneyHeld" ? "$" : "";
		const progress = math.min(goal.quest.progress, config.target);
		return {
			key: goal.quest.id,
			title: config.title,
			body: done ? "Done! Claim your reward in the Quests book." : config.description,
			image: getStatImage(config),
			bar: done
				? undefined
				: {
						ratio: progress / config.target,
						text: `${formatNumber(progress)}${unit} / ${formatNumber(config.target)}${unit}`,
					},
			claim: done,
		};
	}
	const step = goal.step;
	if (step.kind === "OpenEgg") {
		return {
			key: "OpenEgg",
			title: "Your egg is ready!",
			body: "Open it in the shop above to meet your new fish.",
			image: EGG_SPRITES[step.egg].icon,
		};
	}
	const egg = EGG_SPRITES[STARTER_EGG].icon;
	const price = getEggPrice(STARTER_EGG, getFishAndEggs(data));
	const moneyBar = { ratio: data.money / price, text: `${formatNumber(data.money)}$ / ${formatNumber(price)}$` };
	if (step.kind === "NewEgg") {
		return {
			key: "NewEgg",
			title: "Buy a new egg!",
			body: step.affordable
				? `The ${EGG_TYPES[STARTER_EGG].displayName} in the shop above: every fish drops coins.`
				: "Collect your fish's coins to buy one.",
			image: egg,
			bar: step.affordable ? undefined : moneyBar,
		};
	}
	return {
		key: "HatchFish",
		title: `Hatch ${FIRST_GOAL_FISH} fish`,
		body: step.incubating
			? "Your egg is incubating..."
			: step.egg !== undefined
				? "Buy another egg: more fish, more coins!"
				: "Collect coins to buy your next egg.",
		image: egg,
		bar: { ratio: step.hatched / FIRST_GOAL_FISH, text: `${step.hatched} / ${FIRST_GOAL_FISH}` },
	};
}

export interface GoalTrackerProps {
	goal: TrackedGoal;
	data: PlayerData;
	scale: number;
	onOpenQuests: () => void;
}

/** Seconds since mount, every frame (the card's fade-in). */
function useTimeSinceMount(): React.Binding<number> {
	const [time, setTime] = useBinding(0);
	useEffect(() => {
		const start = os.clock();
		const connection = RunService.Heartbeat.Connect(() => {
			const elapsed = os.clock() - start;
			setTime(elapsed);
			if (elapsed > FADE_IN_TIME) connection.Disconnect();
		});
		return () => connection.Disconnect();
	}, []);
	return time;
}

function GoalCard(props: { display: GoalDisplay; scale: number; onOpenQuests: () => void }) {
	const display = props.display;
	const time = useTimeSinceMount();
	const fade = time.map((t) =>
		TweenService.GetValue(math.min(t / FADE_IN_TIME, 1), Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	);
	const bodyHeight = getWrappedHeight(display.body, BODY_SIZE, FONT_BOLD, TEXT_WIDTH);
	const accent = display.claim ? PALETTES.green : PALETTES.gold;

	return (
		<canvasgroup
			key="GoalTracker"
			AnchorPoint={new Vector2(1, 0.5)}
			Position={new UDim2(1, -RIGHT_MARGIN * props.scale, 0.5, 0)}
			Size={UDim2.fromOffset(0, 0)}
			AutomaticSize={Enum.AutomaticSize.XY}
			BackgroundTransparency={1}
			GroupTransparency={fade.map((p) => 1 - p)}
			ZIndex={3}
		>
			<uiscale Scale={props.scale} />
			{/* Room for the chip over the top edge (the group clips to its bounds) */}
			<uipadding PaddingTop={new UDim(0, 14)} PaddingRight={new UDim(0, 4)} PaddingLeft={new UDim(0, 4)} />
			<Plate
				size={UDim2.fromOffset(WIDTH, 0)}
				autoHeight={true}
				top={NAVY.cardTop}
				bottom={NAVY.cardBottom}
				shadow={NAVY.cardShadow}
				outline={display.claim ? PALETTES.gold.base : undefined}
				radius={18}
				overlay={
					<Chip
						key="Header"
						text={display.claim ? "CLAIM!" : "NEXT GOAL"}
						color={accent.base}
						textColor={WHITE}
						textStroke={accent.shadow}
						font={FONT_TITLE}
						textSize={15}
						height={24}
						position={UDim2.fromOffset(16, -12)}
						zIndex={4}
					/>
				}
			>
				<uipadding
					PaddingTop={new UDim(0, PADDING + 4)}
					PaddingBottom={new UDim(0, PADDING)}
					PaddingLeft={new UDim(0, PADDING)}
					PaddingRight={new UDim(0, PADDING)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, GAP)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				<frame
					key="Icon"
					LayoutOrder={1}
					Size={UDim2.fromOffset(ICON_SIZE, ICON_SIZE)}
					BackgroundColor3={WHITE}
					BorderSizePixel={0}
					ZIndex={3}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uigradient Color={new ColorSequence(Color3.fromHex("#3B6CA6"), NAVY.cardBottom)} Rotation={90} />
					<uistroke Color={OUTLINE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					{display.image !== undefined ? (
						<imagelabel
							key="Image"
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={UDim2.fromScale(0.5, 0.5)}
							Size={UDim2.fromScale(0.9, 0.9)}
							BackgroundTransparency={1}
							Image={display.image}
							ScaleType={Enum.ScaleType.Fit}
							ZIndex={3}
						/>
					) : (
						<CoinIcon
							key="Coin"
							size={36}
							position={UDim2.fromScale(0.5, 0.5)}
							anchorPoint={new Vector2(0.5, 0.5)}
						/>
					)}
				</frame>
				<frame
					key="Texts"
					LayoutOrder={2}
					Size={UDim2.fromOffset(TEXT_WIDTH, 0)}
					AutomaticSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
				>
					<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
					<textlabel
						key="Title"
						LayoutOrder={1}
						Size={UDim2.fromOffset(TEXT_WIDTH, TITLE_SIZE + 4)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text={display.title.upper()}
						TextSize={TITLE_SIZE}
						TextColor3={PALETTES.gold.base}
						TextXAlignment={Enum.TextXAlignment.Left}
						TextTruncate={Enum.TextTruncate.AtEnd}
						ZIndex={3}
					>
						<TextStroke thickness={2.5} />
					</textlabel>
					<textlabel
						key="Body"
						LayoutOrder={2}
						Size={UDim2.fromOffset(TEXT_WIDTH, bodyHeight)}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={display.body}
						TextSize={BODY_SIZE}
						TextColor3={WHITE}
						TextWrapped={true}
						TextXAlignment={Enum.TextXAlignment.Left}
						TextYAlignment={Enum.TextYAlignment.Top}
						ZIndex={3}
					>
						<TextStroke />
					</textlabel>
					{display.bar && (
						<ProgressBar
							key="Bar"
							layoutOrder={3}
							ratio={display.bar.ratio}
							palette={PALETTES.green}
							text={display.bar.text}
							size={UDim2.fromOffset(TEXT_WIDTH, BAR_HEIGHT)}
							textSize={14}
						/>
					)}
				</frame>
			</Plate>
			{display.claim && (
				// The whole card opens the Quests book
				<textbutton
					key="Open"
					Size={UDim2.fromScale(1, 1)}
					BackgroundTransparency={1}
					Text=""
					ZIndex={10}
					Event={{ Activated: props.onOpenQuests }}
				/>
			)}
		</canvasgroup>
	);
}

/**
 * "Next goal" card on the right of the tank view: the first goals after the tutorial (buy an egg, open it, hatch five
 * fish), then the story quest to push. A quest done turns it gold: a click opens the Quests book to claim it.
 */
export function GoalTracker(props: GoalTrackerProps) {
	const display = describe(props.goal, props.data);
	if (!display) return undefined;
	return <GoalCard key={display.key} display={display} scale={props.scale} onOpenQuests={props.onOpenQuests} />;
}
