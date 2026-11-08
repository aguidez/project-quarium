import React, { useEffect, useRef, useState } from "@rbxts/react";
import { MIN_FISH_KEPT } from "shared/types/features";
import { FISH_TYPES, FishType, getFishIndexOrder } from "shared/types/fish";
import { getLivingVariant, PlayerData } from "shared/types/playerData";
import { FISH_VARIANTS, FishVariant, getOceanPoints, VARIANT_ORDER } from "shared/types/variants";
import { formatSize } from "shared/types/size";
import { getPassOceanMultiplier } from "shared/types/gamepasses";
import { COMPANION_TYPES } from "shared/types/companions";
import { PERKS } from "shared/types/perks";
import {
	OCEAN_MILESTONES,
	OceanMilestone,
	OceanRewardId,
} from "shared/types/oceanRewards";
import { Button3D, Card, Chip, ItemSlot, Outline, Plate, ProgressBar, TextStroke } from "./kit";
import { formatNumber, getWrappedHeight, Panel, PANEL_INNER_WIDTH } from "./Panel";
import {
	EGG_SPRITES,
	FISH_ICONS,
	FONT_BLACK,
	FONT_BOLD,
	FONT_TITLE,
	getFishRarity,
	getSizePalette,
	NAVY,
	OCEAN_COLORS,
	Palette,
	PALETTES,
	VARIANT_PALETTES,
	VARIANT_STYLES,
	verticalGradient,
} from "./theme";

const ROW_CONTENT = 70; // name, details and the row's Size chips
const ROW_PADDING = 10;
const ROW_DEPTH = 5;
const ROW_HEIGHT = ROW_CONTENT + ROW_PADDING * 2 + ROW_DEPTH;
const WHITE = new Color3(1, 1, 1);
const ROW_GAP = 8;
/** Rows shown before the list scrolls. */
const VISIBLE_ROWS = 5;
const LIST_INSET = 4; // room for the row strokes, which the scrolling frame would clip
const SUBTITLE = "Release fish back to the ocean to earn Ocean Points. The rarer the fish, the more points!";
const COACH_TEXT =
	"Press Release to send a fish back to the ocean. It frees a spot in your tank, and rarer fish give more points!";
/** Reassures the player: the server releases the fish of the row that earns the least (FishService.releaseFish). */
const RELEASE_RULE =
	"Each row is a kind and a variant: Release lets go of its smallest fish (the lowest Size, marked NEXT). Rare variants give more points and ask you to confirm.";
/** Size chips shown per row (the smallest ones), then "+N more" (FigCraft size.figcraft: OceanRow). */
const MAX_SIZE_CHIPS = 6;
/** A rare variant's Release button stays armed ("Sure?") this long after the first click. */
const CONFIRM_TIME = 3;
const COACH_PADDING_X = 14 + 10;
// Two columns: releasing fish on the left (as wide as the other panels' content), milestones on the right
const COLUMN_GAP = 20;
const MILESTONE_COLUMN_WIDTH = 340;
const OCEAN_PANEL_WIDTH = PANEL_INNER_WIDTH + COLUMN_GAP + MILESTONE_COLUMN_WIDTH + 44; // + the panel's padding
const MILESTONE_PADDING = 14;
const MILESTONE_INNER_WIDTH = MILESTONE_COLUMN_WIDTH - MILESTONE_PADDING * 2;
const MILESTONE_ICON = 64;
const MILESTONE_LIST_INSET = 4; // room for the card strokes, which the scrolling frame would clip
const MILESTONE_LIST_RIGHT = 12; // room for the scroll bar
// Text width of a card (to wrap its description): list insets, card padding, icon, gap
const MILESTONE_INFO_WIDTH =
	MILESTONE_INNER_WIDTH - MILESTONE_LIST_INSET - MILESTONE_LIST_RIGHT - 20 - MILESTONE_ICON - 10;
const MILESTONES_TEXT = "Ocean Points are never spent: reach each milestone to claim its reward.";
/** Height of the milestone list: about four cards, then it scrolls (V1 has ~17 milestones). */
const MILESTONE_LIST_HEIGHT = 470;
const MILESTONE_GAP = 10;
const COACH_BUTTON_ROOM = 108; // "Got it!" button and the gap before it

export interface OceanPanelProps {
	/** Living fish per type and rare variant (PlayerData.fish, fishVariants). */
	tank: Pick<PlayerData, "fish" | "fishVariants" | "passes" | "tankSizes">;
	oceanPoints: number;
	/** First visit after unlocking it: a short explanation on top (FigCraft: PanelCoach). */
	showTutorial: boolean;
	onRelease: (fishType: FishType, variant: FishVariant) => void;
	/** Ocean milestones already claimed (PlayerData.oceanRewardsClaimed). */
	claimed: readonly OceanRewardId[];
	onClaimReward: (id: OceanRewardId) => void;
	onFinishTutorial: () => void;
	onClose: () => void;
}

/** The panel's buttons: the kit's 3D button with a smaller label. */
function GradientButton(props: { label: string; size: UDim2; palette: Palette; order?: number; onClick?: () => void }) {
	return (
		<Button3D
			key="Button"
			layoutOrder={props.order}
			palette={props.palette}
			size={props.size}
			depth={5}
			radius={12}
			text={props.label}
			textSize={17}
			disabled={props.onClick === undefined}
			onClick={props.onClick}
		/>
	);
}

/**
 * One kind of fish of the tank in one variant (FigCraft: OceanPanel / Row, Row_Variant): how many, the
 * points it gives and its release button. A rare variant asks for a second click ("Sure?").
 */
function FishRow(props: {
	order: number;
	fishType: FishType;
	variant: FishVariant;
	count: number;
	/** The Size scores of the row's fish, smallest first (PlayerData.tankSizes): the first goes on Release. */
	sizes: readonly number[];
	canRelease: boolean;
	/** The x2 Ocean Points pass. */
	pointsMultiplier: number;
	onRelease: () => void;
}) {
	const fish = FISH_TYPES[props.fishType];
	const rarity = getFishRarity(props.fishType);
	const variant = FISH_VARIANTS[props.variant];
	const variantStyle = VARIANT_STYLES[props.variant];
	const rare = props.variant !== "Normal";
	const points = getOceanPoints(props.fishType, props.variant) * props.pointsMultiplier;
	const [armed, setArmed] = useState(false);
	useEffect(() => {
		if (!armed) return;
		const thread = task.delay(CONFIRM_TIME, () => setArmed(false));
		return () => task.cancel(thread);
	}, [armed]);
	const name = rare
		? `<font color="#${variantStyle.color.ToHex()}">${variant.displayName}</font> ${fish.displayName}`
		: fish.displayName;
	const onClick = () => {
		if (rare && !armed) {
			setArmed(true);
			return;
		}
		setArmed(false);
		props.onRelease();
	};
	return (
		<Card
			key={`${props.fishType}_${props.variant}`}
			layoutOrder={props.order}
			highlight={rare ? variantStyle.color : undefined}
		>
			<uipadding
				PaddingTop={new UDim(0, ROW_PADDING)}
				PaddingBottom={new UDim(0, ROW_PADDING)}
				PaddingLeft={new UDim(0, ROW_PADDING)}
				PaddingRight={new UDim(0, 12)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, 12)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<frame key="Icon" LayoutOrder={1} Size={UDim2.fromOffset(100, ROW_CONTENT)} BackgroundColor3={WHITE}>
				<uicorner CornerRadius={new UDim(0, 12)} />
				<uigradient
					Color={verticalGradient(
						VARIANT_PALETTES[props.variant].light,
						VARIANT_PALETTES[props.variant].base,
					)}
					Rotation={90}
				/>
				<Outline />
				<imagelabel
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.5)}
					Size={UDim2.fromOffset(92, 58)}
					BackgroundTransparency={1}
					Image={FISH_ICONS[props.fishType][props.variant]}
					ScaleType={Enum.ScaleType.Fit}
				/>
			</frame>
			{/* Takes what the icon, the gain chip and the button leave */}
			<frame key="Info" LayoutOrder={2} Size={new UDim2(1, -324, 0, ROW_CONTENT)} BackgroundTransparency={1}>
				<uilistlayout
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 2)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				<textlabel
					key="Name"
					LayoutOrder={1}
					Size={new UDim2(1, 0, 0, 24)}
					BackgroundTransparency={1}
					Font={FONT_BLACK}
					RichText={true}
					Text={name}
					TextSize={19}
					TextColor3={WHITE}
					TextXAlignment={Enum.TextXAlignment.Left}
					TextTruncate={Enum.TextTruncate.AtEnd}
				>
					<TextStroke thickness={2.5} />
				</textlabel>
				<textlabel
					key="Details"
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					RichText={true}
					Text={`<font color="#${rarity.color.ToHex()}">${rarity.label}</font>  •  ×${props.count} in your tank`}
					TextSize={14}
					TextColor3={NAVY.muted}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
				{props.sizes.size() > 0 && (
					<frame key="Sizes" LayoutOrder={3} Size={new UDim2(1, 0, 0, 20)} BackgroundTransparency={1}>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 5)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						{props.sizes
							.filter((_, index) => index < MAX_SIZE_CHIPS)
							.map((size, index) => (
								<Chip
									key={`Size${index}`}
									layoutOrder={index}
									text={index === 0 && props.canRelease ? `NEXT ${formatSize(size)}` : formatSize(size)}
									color={getSizePalette(size).base}
									height={20}
									textSize={12}
								/>
							))}
						{props.sizes.size() > MAX_SIZE_CHIPS && (
							<textlabel
								key="More"
								LayoutOrder={MAX_SIZE_CHIPS}
								Size={UDim2.fromOffset(0, 20)}
								AutomaticSize={Enum.AutomaticSize.X}
								BackgroundTransparency={1}
								Font={FONT_BOLD}
								Text={`+${props.sizes.size() - MAX_SIZE_CHIPS} more`}
								TextSize={12}
								TextColor3={NAVY.muted}
							/>
						)}
					</frame>
				)}
			</frame>
			<Chip
				key="Gain"
				layoutOrder={3}
				text={`+${points} PTS`}
				color={rare ? variantStyle.color : PALETTES.lagoon.light}
				width={84}
				height={26}
				textSize={15}
			/>
			<GradientButton
				order={4}
				label={props.canRelease ? (armed ? "SURE?" : "RELEASE") : "KEEP 1"}
				size={UDim2.fromOffset(108, 40)}
				palette={!props.canRelease ? PALETTES.grey : armed ? PALETTES.red : PALETTES.lagoon}
				onClick={props.canRelease ? onClick : undefined}
			/>
		</Card>
	);
}

/**
 * One Ocean milestone (FigCraft: Milestone_Claimable / Milestone_Locked): its reward, the points it
 * needs and, depending on the player's points, a progress bar, a Claim button or "Claimed".
 */
function MilestoneCard(props: {
	order: number;
	milestone: OceanMilestone;
	oceanPoints: number;
	claimed: boolean;
	onClaim: () => void;
}) {
	const { milestone } = props;
	const reached = props.oceanPoints >= milestone.points || props.claimed;
	const claimable = reached && !props.claimed;
	const reward = milestone.reward;
	const image =
		reward.kind === "Companion" || reward.kind === "CompanionUpgrade"
			? COMPANION_TYPES[reward.companion].image
			: reward.kind === "Incubator"
				? EGG_SPRITES.Common.icon
				: undefined;
	// A short gold label: alone for the rewards without a picture (one more companion slot, the new tank size,
	// the luck multiplier, a cosmetic), in a corner of the egg for the incubators
	const badge =
		reward.kind === "Capacity"
			? `${reward.capacity}`
			: reward.kind === "Incubator"
				? `x${reward.count}`
				: reward.kind === "VariantLuck"
					? `x${reward.multiplier}`
					: reward.kind === "Cosmetic"
						? "NEW"
						: reward.kind === "Perk"
							? PERKS[reward.perk].label
							: "+1";
	const progress = math.clamp(props.oceanPoints / milestone.points, 0, 1);
	const descriptionHeight = getWrappedHeight(milestone.description, 13, FONT_BOLD, MILESTONE_INFO_WIDTH);
	return (
		<Card key={milestone.id} layoutOrder={props.order} highlight={claimable ? PALETTES.gold.base : undefined}>
			<uipadding
				PaddingTop={new UDim(0, 10)}
				PaddingBottom={new UDim(0, 10)}
				PaddingLeft={new UDim(0, 10)}
				PaddingRight={new UDim(0, 10)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, 10)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<ItemSlot
				key="Reward"
				layoutOrder={1}
				size={MILESTONE_ICON}
				palette={reached ? PALETTES.lagoon : PALETTES.grey}
				image={image}
				imageScale={new Vector2(1, 1)}
			>
				{(image === undefined || reward.kind === "Incubator") && (
					<textlabel
						key="Badge"
						AnchorPoint={image === undefined ? new Vector2(0, 0) : new Vector2(1, 1)}
						Position={image === undefined ? new UDim2() : new UDim2(1, -2, 1, -2)}
						Size={image === undefined ? UDim2.fromScale(1, 1) : UDim2.fromOffset(30, 24)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text={badge}
						TextSize={image === undefined ? (badge.size() > 3 ? 20 : 26) : 20}
						TextColor3={PALETTES.gold.base}
						ZIndex={3}
					>
						<TextStroke thickness={2.5} />
					</textlabel>
				)}
			</ItemSlot>
			<frame
				key="Info"
				LayoutOrder={2}
				// What is left of the card next to the icon: never wider than the card, whatever the scroll bar takes
				Size={new UDim2(1, -(MILESTONE_ICON + 10), 0, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
			>
				<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
				<textlabel
					key="Points"
					LayoutOrder={1}
					Size={new UDim2(1, 0, 0, 16)}
					BackgroundTransparency={1}
					Font={FONT_BLACK}
					Text={`${formatNumber(milestone.points)} OCEAN POINTS`}
					TextSize={13}
					TextColor3={OCEAN_COLORS.light}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
				<textlabel
					key="Title"
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					Font={FONT_BLACK}
					Text={milestone.title}
					TextSize={18}
					TextColor3={WHITE}
					TextXAlignment={Enum.TextXAlignment.Left}
				>
					<TextStroke />
				</textlabel>
				<textlabel
					key="Description"
					LayoutOrder={3}
					Size={new UDim2(1, 0, 0, descriptionHeight)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={milestone.description}
					TextSize={13}
					TextColor3={NAVY.muted}
					TextWrapped={true}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
				{claimable ? (
					<GradientButton
						order={4}
						label="CLAIM!"
						size={new UDim2(1, 0, 0, 36)}
						palette={PALETTES.green}
						onClick={props.onClaim}
					/>
				) : props.claimed ? (
					<textlabel
						key="Claimed"
						LayoutOrder={4}
						Size={new UDim2(1, 0, 0, 22)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text="CLAIMED"
						TextSize={17}
						TextColor3={PALETTES.gold.base}
						TextXAlignment={Enum.TextXAlignment.Left}
					>
						<TextStroke />
					</textlabel>
				) : (
					<ProgressBar
						key="Progress"
						layoutOrder={4}
						size={new UDim2(1, 0, 0, 20)}
						ratio={progress}
						palette={PALETTES.lagoon}
						text={`${formatNumber(props.oceanPoints)} / ${formatNumber(milestone.points)}`}
						textSize={13}
					/>
				)}
			</frame>
		</Card>
	);
}

/** First-visit explanation (FigCraft: PanelCoach), dismissed with "Got it!" or by releasing a fish. */
function PanelCoach(props: { onDone: () => void }) {
	return (
		<Plate
			key="Coach"
			layoutOrder={1}
			size={UDim2.fromScale(1, 0)}
			autoHeight={true}
			top={PALETTES.lagoon.base}
			bottom={PALETTES.lagoon.shadow}
			shadow={NAVY.cardShadow}
			radius={16}
		>
			<uipadding
				PaddingTop={new UDim(0, 10)}
				PaddingBottom={new UDim(0, 10)}
				PaddingLeft={new UDim(0, 14)}
				PaddingRight={new UDim(0, COACH_PADDING_X - 14)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, 12)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<textlabel
				key="Text"
				LayoutOrder={1}
				Size={
					new UDim2(
						1,
						-COACH_BUTTON_ROOM,
						0,
						getWrappedHeight(
							COACH_TEXT,
							14,
							FONT_BOLD,
							PANEL_INNER_WIDTH - COACH_PADDING_X - COACH_BUTTON_ROOM,
						),
					)
				}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={COACH_TEXT}
				TextSize={14}
				TextColor3={WHITE}
				TextWrapped={true}
				TextXAlignment={Enum.TextXAlignment.Left}
			>
				<TextStroke color={PALETTES.lagoon.shadow} />
			</textlabel>
			<GradientButton
				order={2}
				label="GOT IT!"
				size={UDim2.fromOffset(96, 38)}
				palette={PALETTES.green}
				onClick={props.onDone}
			/>
		</Plate>
	);
}

/** The Ocean (FigCraft: OceanPanel): release fish for Ocean Points. Releases are intents checked by the server. */
export function OceanPanel(props: OceanPanelProps) {
	let total = 0;
	for (const [, count] of pairs(props.tank.fish)) total += count;
	const canRelease = total > MIN_FISH_KEPT;

	// One row per kind and variant in the tank: the player picks exactly which fish goes
	const rows = new Array<React.Element>();
	for (const fishType of getFishIndexOrder()) {
		for (const variant of VARIANT_ORDER) {
			const count = getLivingVariant(props.tank, fishType, variant);
			if (count <= 0) continue;
			rows.push(
				<FishRow
					key={`${fishType}_${variant}`}
					order={rows.size()}
					fishType={fishType}
					variant={variant}
					count={count}
					sizes={props.tank.tankSizes[fishType]?.[variant] ?? []}
					canRelease={canRelease}
					pointsMultiplier={getPassOceanMultiplier(props.tank.passes)}
					onRelease={() => props.onRelease(fishType, variant)}
				/>,
			);
		}
	}
	const visible = math.max(math.min(rows.size(), VISIBLE_ROWS), 1);
	const listHeight = visible * (ROW_HEIGHT + ROW_GAP) - ROW_GAP + LIST_INSET * 2;

	const chip = (
		<Chip
			text={`${formatNumber(props.oceanPoints)} OCEAN POINTS`}
			color={PALETTES.lagoon.base}
			textColor={WHITE}
			textStroke={PALETTES.lagoon.shadow}
			font={FONT_TITLE}
			height={30}
			textSize={18}
		/>
	);

	const milestones = OCEAN_MILESTONES.map((milestone, index) => (
		<MilestoneCard
			key={milestone.id}
			order={index + 1}
			milestone={milestone}
			oceanPoints={props.oceanPoints}
			claimed={props.claimed.includes(milestone.id)}
			onClaim={() => props.onClaimReward(milestone.id)}
		/>
	));

	// The list opens on the first milestone not claimed yet (the claimed ones scroll out of the way)
	const listRef = useRef<ScrollingFrame>();
	const firstOpen = OCEAN_MILESTONES.findIndex((milestone) => !props.claimed.includes(milestone.id));
	useEffect(() => {
		if (firstOpen <= 0) return;
		// After the layout pass: the cards' heights depend on their wrapped descriptions
		const thread = task.delay(0.05, () => {
			const list = listRef.current;
			if (!list || list.Size.Y.Offset <= 0) return;
			const scale = list.AbsoluteSize.Y / list.Size.Y.Offset; // the UI's UIScale
			for (const child of list.GetChildren()) {
				if (!child.IsA("GuiObject") || child.LayoutOrder !== firstOpen + 1) continue;
				const top = (child.AbsolutePosition.Y - list.AbsolutePosition.Y) / scale + list.CanvasPosition.Y;
				list.CanvasPosition = new Vector2(0, math.max(top - MILESTONE_LIST_INSET, 0));
			}
		});
		return () => task.cancel(thread);
	}, []);

	return (
		<Panel
			title="OCEAN"
			banner={PALETTES.blue}
			headerExtra={chip}
			width={OCEAN_PANEL_WIDTH}
			onClose={props.onClose}
		>
			<frame
				key="Columns"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					Padding={new UDim(0, COLUMN_GAP)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{/* Left: releasing fish (as before) */}
				<frame
					key="Release"
					LayoutOrder={1}
					Size={UDim2.fromOffset(PANEL_INNER_WIDTH, 0)}
					AutomaticSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
				>
					<uilistlayout Padding={new UDim(0, 14)} SortOrder={Enum.SortOrder.LayoutOrder} />
					{props.showTutorial && <PanelCoach onDone={props.onFinishTutorial} />}
					<textlabel
						key="Subtitle"
						LayoutOrder={2}
						Size={new UDim2(1, 0, 0, getWrappedHeight(SUBTITLE, 14, FONT_BOLD, PANEL_INNER_WIDTH))}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={SUBTITLE}
						TextSize={14}
						TextColor3={NAVY.muted}
						TextWrapped={true}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<textlabel
						key="ReleaseRule"
						LayoutOrder={3}
						Size={new UDim2(1, 0, 0, getWrappedHeight(RELEASE_RULE, 12, FONT_BOLD, PANEL_INNER_WIDTH))}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={RELEASE_RULE}
						TextSize={12}
						TextColor3={OCEAN_COLORS.light}
						TextWrapped={true}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<scrollingframe
						key="List"
						LayoutOrder={4}
						Size={new UDim2(1, 0, 0, listHeight)}
						BackgroundTransparency={1}
						BorderSizePixel={0}
						CanvasSize={new UDim2()}
						AutomaticCanvasSize={Enum.AutomaticSize.Y}
						ScrollingDirection={Enum.ScrollingDirection.Y}
						ScrollBarThickness={rows.size() > VISIBLE_ROWS ? 6 : 0}
						ScrollBarImageColor3={PALETTES.lagoon.base}
						// Even at thickness 0 the bar leaves a sliver: hide it while there is nothing to scroll
						ScrollBarImageTransparency={rows.size() > VISIBLE_ROWS ? 0 : 1}
					>
						<uipadding
							PaddingTop={new UDim(0, LIST_INSET)}
							PaddingBottom={new UDim(0, LIST_INSET)}
							PaddingLeft={new UDim(0, LIST_INSET)}
							PaddingRight={new UDim(0, rows.size() > VISIBLE_ROWS ? 10 : LIST_INSET)}
						/>
						<uilistlayout Padding={new UDim(0, ROW_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} />
						{rows.size() > 0 ? (
							rows
						) : (
							<textlabel
								key="Empty"
								Size={new UDim2(1, 0, 0, ROW_HEIGHT)}
								BackgroundTransparency={1}
								Font={FONT_BOLD}
								Text="No fish in your tank yet."
								TextSize={15}
								TextColor3={NAVY.muted}
							/>
						)}
					</scrollingframe>
				</frame>
				{/* Right: the milestones the Ocean Points unlock (FigCraft: OceanPanel / Milestones) */}
				<frame
					key="Milestones"
					LayoutOrder={2}
					Size={UDim2.fromOffset(MILESTONE_COLUMN_WIDTH, 0)}
					AutomaticSize={Enum.AutomaticSize.Y}
					BackgroundColor3={NAVY.track}
					BackgroundTransparency={0.3}
				>
					<uicorner CornerRadius={new UDim(0, 18)} />
					<Outline />
					<uipadding
						PaddingTop={new UDim(0, MILESTONE_PADDING)}
						PaddingBottom={new UDim(0, MILESTONE_PADDING)}
						PaddingLeft={new UDim(0, MILESTONE_PADDING)}
						PaddingRight={new UDim(0, MILESTONE_PADDING)}
					/>
					<uilistlayout Padding={new UDim(0, 10)} SortOrder={Enum.SortOrder.LayoutOrder} />
					<textlabel
						key="Title"
						LayoutOrder={1}
						Size={new UDim2(1, 0, 0, 22)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text="OCEAN REWARDS"
						TextSize={21}
						TextColor3={OCEAN_COLORS.light}
						TextXAlignment={Enum.TextXAlignment.Left}
					>
						<TextStroke />
					</textlabel>
					<textlabel
						key="Subtitle"
						LayoutOrder={2}
						Size={
							new UDim2(1, 0, 0, getWrappedHeight(MILESTONES_TEXT, 12, FONT_BOLD, MILESTONE_INNER_WIDTH))
						}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={MILESTONES_TEXT}
						TextSize={12}
						TextColor3={NAVY.muted}
						TextWrapped={true}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<scrollingframe
						key="List"
						ref={listRef}
						LayoutOrder={3}
						Size={new UDim2(1, 0, 0, MILESTONE_LIST_HEIGHT)}
						BackgroundTransparency={1}
						BorderSizePixel={0}
						CanvasSize={new UDim2()}
						AutomaticCanvasSize={Enum.AutomaticSize.Y}
						ScrollingDirection={Enum.ScrollingDirection.Y}
						ScrollBarThickness={6}
						ScrollBarImageColor3={PALETTES.lagoon.base}
					>
						<uipadding
							PaddingTop={new UDim(0, MILESTONE_LIST_INSET)}
							PaddingBottom={new UDim(0, MILESTONE_LIST_INSET)}
							PaddingLeft={new UDim(0, MILESTONE_LIST_INSET)}
							PaddingRight={new UDim(0, MILESTONE_LIST_RIGHT)}
						/>
						<uilistlayout Padding={new UDim(0, MILESTONE_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} />
						{milestones}
					</scrollingframe>
				</frame>
			</frame>
		</Panel>
	);
}
