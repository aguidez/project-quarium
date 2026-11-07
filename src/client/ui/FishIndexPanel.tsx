import React, { useState } from "@rbxts/react";
import { EGG_TYPES, EggType, getHatchChance } from "shared/types/eggs";
import { FISH_TYPES, FishType, getFishIndexOrder, isEasterEgg } from "shared/types/fish";
import { getHatchedVariant, PlayerData } from "shared/types/playerData";
import { FISH_VARIANTS, FishVariant, formatVariantChance, VARIANT_ORDER } from "shared/types/variants";
import { formatSize, getSizeTier, SIZE_TIERS } from "shared/types/size";
import { Card, Chip, ItemSlot, Outline, ProgressBar, TextStroke } from "./kit";
import { formatNumber, getWrappedHeight, Panel, PANEL_PADDING } from "./Panel";
import {
	FISH_ICONS,
	FONT_BOLD,
	FONT_TITLE,
	getFishRarity,
	getSizePalette,
	NAVY,
	PALETTES,
	RARITY_STYLES,
	VARIANT_PALETTES,
} from "./theme";

const INDEX_PANEL_WIDTH = 820;
const SLOT = 88;
const SLOT_DEPTH = 4;
const GAP = 12;
const ROW_PADDING = 12;
const ROW_DEPTH = 5;
const ROW_HEIGHT = SLOT + SLOT_DEPTH + ROW_PADDING * 2 + ROW_DEPTH;
const ROW_GAP = 10;
const SCROLLBAR = 10;
const TABLE_INSET = 4; // room for the row outlines, which the scrolling frame would clip
const INNER_WIDTH = INDEX_PANEL_WIDTH - PANEL_PADDING * 2;
/** Info column of a row: what the slots and paddings leave. */
const INFO_WIDTH = INNER_WIDTH - TABLE_INSET * 2 - SCROLLBAR - ROW_PADDING * 2 - 4 * (SLOT + GAP);
const SECTION_HEIGHT = 30; // "EASTER EGGS" title row
/** Rows shown before the table scrolls. */
const VISIBLE_ROWS = 3;
const HEADER_HEIGHT = 46; // column chips and their odds
// Tooltip of a variant (FigCraft: VariantTooltip), under its column header while the header or one of its cells is hovered
const TOOLTIP_WIDTH = 250;
const TOOLTIP_PADDING = 12;
const TOOLTIP_GAP = 6;
const WHITE = new Color3(1, 1, 1);

type HoverHandler = (variant: FishVariant | undefined) => void;

export interface FishIndexPanelProps {
	/** Fish hatched so far, per type and per rare variant (PlayerData). */
	collection: Pick<PlayerData, "hatched" | "hatchedVariants" | "bestSize">;
	/** The player's variant luck (getPlayerVariantLuck): the chances shown are the ones they hatch with. */
	luck: number;
	onClose: () => void;
}

/** Eggs a fish hatches from, with the odds: "Common Egg 80% · Improved Egg 30%", in shop order. */
function getSources(fishType: FishType): string {
	const easterEgg = FISH_TYPES[fishType].easterEgg;
	if (easterEgg) return easterEgg.source;
	const eggTypes = new Array<EggType>();
	for (const [eggType] of pairs(EGG_TYPES)) {
		if (getHatchChance(eggType, fishType) > 0) eggTypes.push(eggType);
	}
	eggTypes.sort((a, b) => EGG_TYPES[a].order < EGG_TYPES[b].order);
	const lines = eggTypes.map((eggType) => `${EGG_TYPES[eggType].displayName} ${getHatchChance(eggType, fishType)}%`);
	return lines.size() > 0 ? lines.join(" · ") : "Not found in eggs yet";
}

function Text(props: {
	order: number;
	text: string;
	size: number;
	color: Color3;
	height: number;
	stroke?: boolean;
	wrapped?: boolean;
}) {
	return (
		<textlabel
			key={`Text${props.order}`}
			LayoutOrder={props.order}
			Size={new UDim2(1, 0, 0, props.height)}
			BackgroundTransparency={1}
			Font={FONT_BOLD}
			Text={props.text}
			TextSize={props.size}
			TextColor3={props.color}
			TextXAlignment={Enum.TextXAlignment.Left}
			TextWrapped={props.wrapped}
			TextTruncate={props.wrapped ? undefined : Enum.TextTruncate.AtEnd}
		>
			{props.stroke && <TextStroke thickness={2.5} />}
		</textlabel>
	);
}

/** What a variant brings, under its column header (right-aligned: the last column sits by the panel's edge). */
function VariantTooltip(props: { variant: FishVariant; luck: number }) {
	const config = FISH_VARIANTS[props.variant];
	const palette = VARIANT_PALETTES[props.variant];
	const textWidth = TOOLTIP_WIDTH - TOOLTIP_PADDING * 2;
	return (
		<frame
			key="Tooltip"
			AnchorPoint={new Vector2(1, 0)}
			Position={new UDim2(1, 0, 1, TOOLTIP_GAP)}
			Size={UDim2.fromOffset(TOOLTIP_WIDTH, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={NAVY.windowBottom}
			BorderSizePixel={0}
			ZIndex={10}
		>
			<uicorner CornerRadius={new UDim(0, 14)} />
			<Outline color={palette.base} />
			<uipadding
				PaddingTop={new UDim(0, 10)}
				PaddingBottom={new UDim(0, 12)}
				PaddingLeft={new UDim(0, TOOLTIP_PADDING)}
				PaddingRight={new UDim(0, TOOLTIP_PADDING)}
			/>
			<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
			<textlabel
				key="Title"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 22)}
				BackgroundTransparency={1}
				Font={FONT_TITLE}
				Text={`${config.displayName.upper()}  ${formatVariantChance(props.variant, props.luck)}`}
				TextSize={18}
				TextColor3={props.variant === "Normal" ? WHITE : palette.base}
				TextXAlignment={Enum.TextXAlignment.Left}
				ZIndex={10}
			>
				<TextStroke />
			</textlabel>
			<textlabel
				key="Text"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, getWrappedHeight(config.description, 14, FONT_BOLD, textWidth))}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={config.description}
				TextSize={14}
				TextColor3={WHITE}
				TextWrapped={true}
				TextXAlignment={Enum.TextXAlignment.Left}
				ZIndex={10}
			/>
		</frame>
	);
}

/** Header of a variant column (FigCraft redesign-v2: ColumnHeader_<Variant>): its chip, and its chance at hatch. */
function ColumnHeader(props: {
	order: number;
	variant: FishVariant;
	luck: number;
	hovered: boolean;
	onHover: HoverHandler;
}) {
	const config = FISH_VARIANTS[props.variant];
	const palette = VARIANT_PALETTES[props.variant];
	return (
		<frame
			key={props.variant}
			LayoutOrder={props.order}
			Size={UDim2.fromOffset(SLOT, HEADER_HEIGHT)}
			BackgroundTransparency={1}
			Event={{
				MouseEnter: () => props.onHover(props.variant),
				MouseLeave: () => props.onHover(undefined),
			}}
		>
			<Chip
				key="Chip"
				text={config.displayName.upper()}
				color={palette.base}
				textColor={WHITE}
				textStroke={palette.shadow}
				font={FONT_TITLE}
				textSize={15}
				height={26}
				width={SLOT}
			/>
			<textlabel
				key="Chance"
				Position={UDim2.fromOffset(0, 28)}
				Size={new UDim2(1, 0, 0, 16)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={formatVariantChance(props.variant, props.luck)}
				TextSize={14}
				TextColor3={props.hovered ? WHITE : NAVY.muted}
			/>
			{props.hovered && <VariantTooltip variant={props.variant} luck={props.luck} />}
		</frame>
	);
}

/**
 * One fish of the index (FigCraft redesign-v2: SpeciesRow_*): its card, then one square slot per variant
 * (its sticker once found, until then the species' dark silhouette under a "?").
 */
function FishRow(props: {
	order: number;
	fishType: FishType;
	collection: FishIndexPanelProps["collection"];
	onHover: HoverHandler;
}) {
	const fish = FISH_TYPES[props.fishType];
	const rarity = getFishRarity(props.fishType);
	const species = props.collection.hatched[props.fishType] ?? 0;
	const discovered = species > 0;
	const easterEgg = isEasterEgg(props.fishType);
	const cells = VARIANT_ORDER.map((variant, index) => {
		// An easter egg fish has no variant: an empty slot keeps the columns lined up
		if (easterEgg && variant !== "Normal") {
			return (
				<frame
					key={variant}
					LayoutOrder={index + 2}
					Size={UDim2.fromOffset(SLOT, SLOT + SLOT_DEPTH)}
					BackgroundTransparency={1}
				/>
			);
		}
		const found = getHatchedVariant(props.collection, props.fishType, variant) > 0;
		return (
			<ItemSlot
				key={variant}
				layoutOrder={index + 2}
				size={SLOT}
				palette={VARIANT_PALETTES[variant]}
				missing={!found}
				silhouette={true}
				image={FISH_ICONS[props.fishType][found ? variant : "Normal"]}
				shiny={found && variant === "Shiny"}
				onHover={(hovered) => props.onHover(hovered ? variant : undefined)}
			/>
		);
	});
	return (
		<Card key={props.fishType} layoutOrder={props.order}>
			<uipadding
				PaddingTop={new UDim(0, ROW_PADDING)}
				PaddingBottom={new UDim(0, ROW_PADDING)}
				PaddingLeft={new UDim(0, ROW_PADDING)}
				PaddingRight={new UDim(0, ROW_PADDING)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, GAP)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<frame key="Info" LayoutOrder={1} Size={UDim2.fromOffset(INFO_WIDTH, SLOT)} BackgroundTransparency={1}>
				<uilistlayout
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 3)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{/* The rarity always shows, so players know what they are farming for; then the species' best Size */}
				<frame key="Chips" LayoutOrder={1} Size={new UDim2(1, 0, 0, 22)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<Chip key="Rarity" layoutOrder={1} text={rarity.label} color={rarity.color} height={22} textSize={13} />
					{discovered && !easterEgg && <BestSizeChip best={props.collection.bestSize[props.fishType]} />}
				</frame>
				<Text
					order={2}
					text={discovered ? fish.displayName : "???"}
					size={22}
					color={discovered ? WHITE : NAVY.inactiveText}
					height={26}
					stroke={true}
				/>
				<Text
					order={3}
					text={
						discovered
							? fish.easterEgg
								? fish.easterEgg.perk
								: `${formatNumber(fish.income)}$ every ${fish.incomeInterval}s`
							: "Hatch it to see its stats"
					}
					size={15}
					color={discovered ? PALETTES.gold.base : NAVY.muted}
					height={18}
				/>
				<Text
					order={4}
					text={getSources(props.fishType)}
					size={13}
					color={NAVY.muted}
					height={16}
					wrapped={false}
				/>
			</frame>
			{cells}
		</Card>
	);
}

/**
 * The best Size ever hatched of a species (FigCraft size.figcraft: IndexRow): "BEST +14%  •  GIANT" in its tier's
 * colour, or "BEST: NONE YET" for a species not hatched since the Size score came (V1.1.16).
 */
function BestSizeChip(props: { best?: number }) {
	if (props.best === undefined) {
		return (
			<Chip
				key="BestSize"
				layoutOrder={2}
				text="BEST: NONE YET"
				color={Color3.fromHex("#3A5A80")}
				textColor={NAVY.inactiveText}
				height={22}
				textSize={11}
			/>
		);
	}
	const tier = SIZE_TIERS.find(([name]) => name === getSizeTier(props.best!))![1];
	return (
		<Chip
			key="BestSize"
			layoutOrder={2}
			text={`BEST ${formatSize(props.best)}  •  ${tier.displayName.upper()}`}
			color={getSizePalette(props.best).base}
			height={22}
			textSize={12}
		/>
	);
}

/** Title of the "Easter eggs" category, above its rows. */
function SectionTitle(props: { order: number; text: string }) {
	return (
		<textlabel
			key="EasterEggs"
			LayoutOrder={props.order}
			Size={new UDim2(1, 0, 0, SECTION_HEIGHT)}
			BackgroundTransparency={1}
			Font={FONT_TITLE}
			Text={props.text}
			TextSize={20}
			TextColor3={RARITY_STYLES.Secret.color}
			TextXAlignment={Enum.TextXAlignment.Left}
			TextYAlignment={Enum.TextYAlignment.Bottom}
		>
			<TextStroke />
		</textlabel>
	);
}

/**
 * Fish index (FigCraft redesign-v2: FishIndex_V2): one row per fish of the game, one column per variant
 * (Normal, Anomaly, Ghost, Shiny); an entry is discovered by hatching that fish in that variant once.
 * Easter egg fish (no variant) have their own category at the bottom, invisible (not even a silhouette)
 * until hatched: the category itself only shows once one of them is found. They stay out of the
 * "Discovered" count, a bonus beside the collection.
 */
export function FishIndexPanel(props: FishIndexPanelProps) {
	const [hovered, setHovered] = useState<FishVariant>();
	// Every species of the eggs (the easter eggs have their own category)
	const order = getFishIndexOrder().filter((fishType) => !isEasterEgg(fishType));
	const secrets = getFishIndexOrder().filter(
		(fishType) => isEasterEgg(fishType) && (props.collection.hatched[fishType] ?? 0) > 0,
	);
	let discovered = 0;
	for (const fishType of order) {
		for (const variant of VARIANT_ORDER) {
			if (getHatchedVariant(props.collection, fishType, variant) > 0) discovered += 1;
		}
	}
	const total = order.size() * VARIANT_ORDER.size();
	const rows = order.map((fishType, index) => (
		<FishRow key={fishType} order={index} fishType={fishType} collection={props.collection} onHover={setHovered} />
	));
	if (secrets.size() > 0) {
		rows.push(<SectionTitle key="EasterEggs" order={order.size()} text="EASTER EGGS" />);
		secrets.forEach((fishType, index) =>
			rows.push(
				<FishRow
					key={fishType}
					order={order.size() + 1 + index}
					fishType={fishType}
					collection={props.collection}
					onHover={setHovered}
				/>,
			),
		);
	}
	const rowCount = order.size() + secrets.size();
	const scrolls = rowCount > VISIBLE_ROWS;
	const tableHeight = math.min(rowCount, VISIBLE_ROWS) * (ROW_HEIGHT + ROW_GAP) - ROW_GAP + TABLE_INSET * 2;

	const headers = VARIANT_ORDER.map((variant, index) => (
		<ColumnHeader
			key={variant}
			order={index + 2}
			variant={variant}
			luck={props.luck}
			hovered={hovered === variant}
			onHover={setHovered}
		/>
	));

	return (
		<Panel title="FISH INDEX" width={INDEX_PANEL_WIDTH} banner={PALETTES.lagoon} onClose={props.onClose}>
			<frame key="Discovered" LayoutOrder={1} Size={new UDim2(1, 0, 0, 30)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 14)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				<textlabel
					key="Label"
					LayoutOrder={1}
					Size={UDim2.fromOffset(0, 30)}
					AutomaticSize={Enum.AutomaticSize.X}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text="DISCOVERED"
					TextSize={22}
					TextColor3={WHITE}
				>
					<TextStroke thickness={2.5} />
				</textlabel>
				<ProgressBar
					key="Progress"
					layoutOrder={2}
					size={UDim2.fromOffset(300, 26)}
					ratio={total > 0 ? discovered / total : 0}
					palette={PALETTES.gold}
					text={`${discovered} / ${total}`}
					textSize={16}
				/>
				<textlabel
					key="Subtitle"
					LayoutOrder={3}
					Size={new UDim2(1, -480, 1, 0)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={
						discovered < total
							? "Hatch every fish in every variant!"
							: "Collection complete: every fish in every variant!"
					}
					TextSize={15}
					TextColor3={NAVY.muted}
					TextWrapped={true}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
			</frame>
			{/* Column headers, lined up with the slots (row padding, inset of the table) */}
			<frame
				key="ColumnHeader"
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, HEADER_HEIGHT)}
				BackgroundTransparency={1}
				ZIndex={2} // its tooltips go over the table below
			>
				<uipadding PaddingLeft={new UDim(0, ROW_PADDING + TABLE_INSET)} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					Padding={new UDim(0, GAP)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				<textlabel
					key="FishLabel"
					LayoutOrder={1}
					Size={UDim2.fromOffset(INFO_WIDTH, 26)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text="FISH"
					TextSize={20}
					TextColor3={NAVY.inactiveText}
					TextXAlignment={Enum.TextXAlignment.Left}
				>
					<TextStroke />
				</textlabel>
				{headers}
			</frame>
			<scrollingframe
				key="Table"
				LayoutOrder={4}
				Size={new UDim2(1, 0, 0, tableHeight)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				CanvasSize={new UDim2()}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
				ScrollingDirection={Enum.ScrollingDirection.Y}
				ScrollBarThickness={scrolls ? SCROLLBAR : 0}
				ScrollBarImageColor3={PALETTES.lagoon.base}
				// Even at thickness 0 the bar leaves a sliver: hide it while there is nothing to scroll
				ScrollBarImageTransparency={scrolls ? 0 : 1}
			>
				<uipadding
					PaddingTop={new UDim(0, TABLE_INSET)}
					PaddingBottom={new UDim(0, TABLE_INSET)}
					PaddingLeft={new UDim(0, TABLE_INSET)}
					PaddingRight={new UDim(0, TABLE_INSET + SCROLLBAR)}
				/>
				<uilistlayout Padding={new UDim(0, ROW_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} />
				{rows}
			</scrollingframe>
		</Panel>
	);
}
