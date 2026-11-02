import React, { useBinding } from "@rbxts/react";
import { COSMETICS, CosmeticId, getBestTitle, TITLE_ORDER } from "shared/types/cosmetics";
import {
	getDisplayedTheme,
	getThemeOrder,
	getUnlockedThemes,
	isCosmeticShown,
	isHideable,
	ThemeChoice,
	TitleChoice,
} from "shared/types/customization";
import { AQUARIUM_THEMES, AquariumTheme } from "shared/types/rebirths";
import { Button3D, Chip, Plate, TextStroke } from "./kit";
import { Panel, PANEL_INNER_WIDTH } from "./Panel";
import { FONT_BOLD, NAVY, Palette, PALETTES, THEME_PALETTES } from "./theme";

const WHITE = new Color3(1, 1, 1);
// The sections grow with what the player earned up to this height, then scroll (the panel must fit small screens)
const LIST_MAX_HEIGHT = 470;
const SCROLL_ROOM = 14; // right of the content, for the scroll bar
const SECTION_GAP = 18;
const THEME_COLUMNS = 5;
const CELL_GAP = 12;
const THEME_CARD = new Vector2((PANEL_INNER_WIDTH - CELL_GAP * (THEME_COLUMNS - 1)) / THEME_COLUMNS, 84);
const ITEM_CARD = new Vector2((PANEL_INNER_WIDTH - CELL_GAP) / 2, 64);
const TITLE_BUTTON = new Vector2((PANEL_INNER_WIDTH - CELL_GAP * 2) / 3, 40);
const LOCKED: Palette = {
	light: NAVY.missingTop,
	base: NAVY.missingBottom,
	dark: NAVY.missingBottom,
	shadow: NAVY.cardShadow,
};
const AUTO_PALETTE = PALETTES.gold;

export interface AquariumPanelProps {
	rebirths: number;
	cosmetics: readonly CosmeticId[];
	themeChoice: ThemeChoice;
	hiddenCosmetics: readonly CosmeticId[];
	titleChoice: TitleChoice;
	onSetTheme: (theme: ThemeChoice) => void;
	onSetShown: (id: CosmeticId, shown: boolean) => void;
	onSetTitle: (title: TitleChoice) => void;
	onClose: () => void;
}

function SectionTitle(props: { order: number; title: string; text: string }) {
	return (
		<frame key={props.title} LayoutOrder={props.order} Size={new UDim2(1, 0, 0, 44)} BackgroundTransparency={1}>
			<textlabel
				key="Title"
				Size={new UDim2(1, 0, 0, 24)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={props.title}
				TextSize={20}
				TextColor3={WHITE}
				TextXAlignment={Enum.TextXAlignment.Left}
			>
				<TextStroke thickness={2.5} />
			</textlabel>
			<textlabel
				key="Text"
				Position={UDim2.fromOffset(0, 24)}
				Size={new UDim2(1, 0, 0, 18)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={props.text}
				TextSize={13}
				TextColor3={NAVY.muted}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>
		</frame>
	);
}

/** A grid of cells, as tall as its rows. */
function Grid(props: { order: number; name: string; cell: Vector2; children: React.ReactNode }) {
	return (
		<frame
			key={props.name}
			LayoutOrder={props.order}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
		>
			<uigridlayout
				CellSize={UDim2.fromOffset(props.cell.X, props.cell.Y)}
				CellPadding={UDim2.fromOffset(CELL_GAP, CELL_GAP)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{props.children}
		</frame>
	);
}

/** White ring around the chosen card (gold would vanish on the gold Automatic card). */
function Selected() {
	return (
		<frame key="Selected" Size={UDim2.fromScale(1, 1)} BackgroundTransparency={1} ZIndex={6}>
			<uicorner CornerRadius={new UDim(0, 16)} />
			<uistroke Color={WHITE} Thickness={4} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
		</frame>
	);
}

/** One theme: its colour, its name; a theme not reached yet says which rebirth brings it. */
function ThemeCard(props: {
	order: number;
	name: string;
	palette: Palette;
	note?: string;
	locked: boolean;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<frame key={props.name} LayoutOrder={props.order} BackgroundTransparency={1}>
			<Button3D
				key="Button"
				palette={props.locked ? LOCKED : props.palette}
				size={new UDim2(1, 0, 1, -5)}
				depth={5}
				radius={16}
				disabled={props.locked}
				onClick={props.onClick}
				overlay={props.selected ? <Selected /> : undefined}
			>
				<textlabel
					key="Name"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, props.note !== undefined ? -8 : 0)}
					Size={new UDim2(1, -10, 0, 34)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={props.name}
					TextSize={14}
					TextWrapped={true}
					TextColor3={props.locked ? NAVY.inactiveText : WHITE}
					ZIndex={4}
				>
					{!props.locked && <TextStroke color={props.palette.shadow} thickness={2} />}
				</textlabel>
				{props.note !== undefined && (
					<textlabel
						key="Note"
						AnchorPoint={new Vector2(0.5, 1)}
						Position={new UDim2(0.5, 0, 1, -6)}
						Size={new UDim2(1, -8, 0, 14)}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={props.note}
						TextSize={11}
						TextColor3={props.locked ? NAVY.inactiveText : WHITE}
						ZIndex={4}
					/>
				)}
			</Button3D>
		</frame>
	);
}

/** An earned decor or finish, with its Shown / Hidden switch. */
function ItemCard(props: { order: number; id: CosmeticId; shown: boolean; onToggle: () => void }) {
	const config = COSMETICS[props.id];
	return (
		<Plate
			layoutOrder={props.order}
			top={NAVY.cardTop}
			bottom={NAVY.cardBottom}
			shadow={NAVY.cardShadow}
			size={new UDim2(1, 0, 1, -5)}
			depth={5}
			radius={16}
		>
			<Chip
				text={config.kind.upper()}
				color={config.kind === "Decor" ? PALETTES.lagoon.base : PALETTES.purple.base}
				textColor={WHITE}
				height={20}
				textSize={12}
				position={UDim2.fromOffset(12, 7)}
			/>
			<textlabel
				key="Name"
				Position={UDim2.fromOffset(12, 30)}
				Size={new UDim2(1, -130, 0, 22)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={config.displayName}
				TextSize={16}
				TextColor3={WHITE}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextTruncate={Enum.TextTruncate.AtEnd}
				ZIndex={3}
			>
				<TextStroke thickness={2} />
			</textlabel>
			<Button3D
				key="Toggle"
				palette={props.shown ? PALETTES.green : PALETTES.grey}
				size={UDim2.fromOffset(104, 36)}
				anchorPoint={new Vector2(1, 0.5)}
				position={new UDim2(1, -10, 0.5, -3)}
				text={props.shown ? "SHOWN" : "HIDDEN"}
				textSize={16}
				zIndex={3}
				onClick={props.onToggle}
			/>
		</Plate>
	);
}

/**
 * Aquarium customization (V0.48): the theme the tank wears among the aquariums reached ("Automatic": the newest),
 * the decor and finishes shown, the title above the head. Intents only, checked by CustomizationService.
 */
export function AquariumPanel(props: AquariumPanelProps) {
	const [contentHeight, setContentHeight] = useBinding(0);
	const unlocked = getUnlockedThemes(props.rebirths);
	const worn = getDisplayedTheme(props);

	// Themes: Automatic first, then every aquarium in rebirth order (the ones not reached yet, locked)
	const themeCards = [
		<ThemeCard
			key="Auto"
			order={0}
			name="Automatic"
			note={AQUARIUM_THEMES[getDisplayedTheme({ rebirths: props.rebirths, themeChoice: "Auto" })].displayName}
			palette={AUTO_PALETTE}
			locked={false}
			selected={props.themeChoice === "Auto"}
			onClick={() => props.onSetTheme("Auto")}
		/>,
	];
	for (const { theme, rebirth } of getThemeOrder()) {
		const locked = !unlocked.includes(theme);
		themeCards.push(
			<ThemeCard
				key={theme}
				order={themeCards.size()}
				name={AQUARIUM_THEMES[theme].displayName}
				note={locked ? `REBIRTH ${rebirth}` : undefined}
				palette={THEME_PALETTES[theme as AquariumTheme]}
				locked={locked}
				selected={props.themeChoice !== "Auto" && worn === theme}
				onClick={() => props.onSetTheme(theme)}
			/>,
		);
	}

	const items = new Array<React.Element>();
	for (const id of props.cosmetics) {
		if (!isHideable(id)) continue;
		const shown = isCosmeticShown(props, id);
		items.push(
			<ItemCard
				key={id}
				order={items.size()}
				id={id}
				shown={shown}
				onToggle={() => props.onSetShown(id, !shown)}
			/>,
		);
	}

	const titles = TITLE_ORDER.filter((id) => props.cosmetics.includes(id));
	const best = getBestTitle(props.cosmetics);
	const titleButtons = [
		{ choice: "Auto" as TitleChoice, label: best ? `BEST: ${COSMETICS[best].displayName.upper()}` : "AUTOMATIC" },
		...titles.map((id) => ({ choice: id as TitleChoice, label: COSMETICS[id].displayName.upper() })),
		{ choice: "None" as TitleChoice, label: "NO TITLE" },
	].map(({ choice, label }, index) => (
		<Button3D
			key={choice}
			layoutOrder={index}
			palette={props.titleChoice === choice ? PALETTES.gold : PALETTES.blue}
			size={new UDim2(1, 0, 1, -5)}
			depth={5}
			radius={14}
			text={label}
			textSize={14}
			onClick={() => props.onSetTitle(choice)}
		/>
	));

	return (
		<Panel title="AQUARIUM" banner={PALETTES.pink} onClose={props.onClose}>
			<scrollingframe
				key="List"
				LayoutOrder={1}
				Size={contentHeight.map((h) =>
					UDim2.fromOffset(PANEL_INNER_WIDTH + SCROLL_ROOM, math.min(h, LIST_MAX_HEIGHT)),
				)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				CanvasSize={contentHeight.map((h) => UDim2.fromOffset(0, h))}
				ScrollingDirection={Enum.ScrollingDirection.Y}
				ScrollBarThickness={6}
				ScrollBarImageColor3={PALETTES.pink.base}
				ScrollBarImageTransparency={contentHeight.map((h) => (h > LIST_MAX_HEIGHT ? 0 : 1))}
			>
				<frame
					key="Content"
					Size={UDim2.fromOffset(PANEL_INNER_WIDTH, 0)}
					AutomaticSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
					Change={{
						// Its height before the panel's UIScale: the list grows with it, then scrolls
						AbsoluteSize: (frame) =>
							setContentHeight(
								frame.AbsoluteSize.Y * (PANEL_INNER_WIDTH / math.max(frame.AbsoluteSize.X, 1)),
							),
					}}
				>
					<uipadding PaddingTop={new UDim(0, 4)} PaddingBottom={new UDim(0, 6)} />
					<uilistlayout Padding={new UDim(0, 10)} SortOrder={Enum.SortOrder.LayoutOrder} />
					<SectionTitle
						order={1}
						title="THEME"
						text="Pick any aquarium you reached. Automatic follows your newest one."
					/>
					<Grid order={2} name="Themes" cell={THEME_CARD}>
						{themeCards}
					</Grid>
					<frame
						key="Gap1"
						LayoutOrder={3}
						Size={UDim2.fromOffset(1, SECTION_GAP - 10)}
						BackgroundTransparency={1}
					/>
					<SectionTitle
						order={4}
						title="DECOR & FINISHES"
						text={
							items.size() > 0
								? "Show or hide what you earned in your tank."
								: "Earn decor and finishes with the quests and the Ocean."
						}
					/>
					{items.size() > 0 && (
						<Grid order={5} name="Items" cell={ITEM_CARD}>
							{items}
						</Grid>
					)}
					<frame
						key="Gap2"
						LayoutOrder={6}
						Size={UDim2.fromOffset(1, SECTION_GAP - 10)}
						BackgroundTransparency={1}
					/>
					<SectionTitle
						order={7}
						title="TITLE"
						text={
							titles.size() > 0
								? "The title floating above your head, for everyone to see."
								: "Earn titles with the quests and the Ocean."
						}
					/>
					{titles.size() > 0 && (
						<Grid order={8} name="Titles" cell={TITLE_BUTTON}>
							{titleButtons}
						</Grid>
					)}
				</frame>
			</scrollingframe>
		</Panel>
	);
}
