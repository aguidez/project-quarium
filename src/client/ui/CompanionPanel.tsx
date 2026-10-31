import React from "@rbxts/react";
import { COMPANION_TYPES, CompanionType } from "shared/types/companions";
import { getCompanionStats } from "shared/types/companionStats";
import { Perk } from "shared/types/perks";
import { Button3D, Chip, ItemSlot, Plate, TextStroke } from "./kit";
import { Panel } from "./Panel";
import { FONT_BOLD, NAVY, PALETTES } from "./theme";

const CARD_SIZE = new Vector2(172, 290);
const CARD_GAP = 12;
const CARD_DEPTH = 5;
const SLOT_SIZE = 88;
/** Mystery cards keep the grid from looking empty while few companions exist. */
const MIN_CARDS = 3;
const WHITE = new Color3(1, 1, 1);

export interface CompanionPanelProps {
	owned: CompanionType[];
	equipped: CompanionType[];
	slots: number;
	/** The player's bonuses: each card shows what its companion does with them (getCompanionStats). */
	perks: readonly Perk[];
	oceanRewardsClaimed: readonly string[];
	onEquip: (companionType: CompanionType) => void;
	onUnequip: (companionType: CompanionType) => void;
	onClose: () => void;
}

interface CardProps {
	order: number;
	/** Sticker icon; a locked card shows a "?" slot. */
	image?: string;
	name: string;
	text: string;
	/** Its numbers right now, with the bonuses unlocked. */
	stats?: string;
	locked: boolean;
	button?: { label: string; equipped: boolean; onClick: () => void };
}

/** One companion (FigCraft: Card_Owned / Card_Locked), in the V2 card style. */
function CompanionCard(props: CardProps) {
	const button = props.button;
	return (
		<Plate
			layoutOrder={props.order}
			top={props.locked ? NAVY.missingTop : NAVY.cardTop}
			bottom={props.locked ? NAVY.missingBottom : NAVY.cardBottom}
			shadow={NAVY.cardShadow}
			outline={button?.equipped ? PALETTES.gold.base : undefined}
			size={new UDim2(1, 0, 1, -CARD_DEPTH)}
			depth={CARD_DEPTH}
			radius={18}
		>
			<uipadding
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 12)}
				PaddingLeft={new UDim(0, 12)}
				PaddingRight={new UDim(0, 12)}
			/>
			<uilistlayout
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<ItemSlot
				key="Icon"
				layoutOrder={1}
				size={SLOT_SIZE}
				palette={PALETTES.green}
				missing={props.locked}
				image={props.image}
				imageScale={new Vector2(1, 0.7)}
			/>
			<textlabel
				key="Name"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 24)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={props.name}
				TextSize={20}
				TextColor3={props.locked ? NAVY.inactiveText : WHITE}
			>
				<TextStroke thickness={2.5} />
			</textlabel>
			<textlabel
				key="Text"
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 62)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={props.text}
				TextSize={13}
				TextColor3={NAVY.muted}
				TextWrapped={true}
				TextYAlignment={Enum.TextYAlignment.Top}
			/>
			{props.stats !== undefined && (
				<textlabel
					key="Stats"
					LayoutOrder={4}
					Size={new UDim2(1, 0, 0, 30)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={props.stats}
					TextSize={12}
					TextColor3={PALETTES.lagoon.light}
					TextWrapped={true}
					TextYAlignment={Enum.TextYAlignment.Top}
				/>
			)}
			{button && (
				<Button3D
					key="Button"
					layoutOrder={5}
					palette={button.equipped ? PALETTES.gold : PALETTES.green}
					size={new UDim2(1, 0, 0, 38)}
					text={button.label.upper()}
					textSize={19}
					onClick={button.onClick}
				/>
			)}
		</Plate>
	);
}

/** Companion selection (FigCraft: CompanionPanel). Equip / unequip are intents checked by the server. */
export function CompanionPanel(props: CompanionPanelProps) {
	const cards = new Array<React.Element>();
	for (const [companionType, config] of pairs(COMPANION_TYPES)) {
		if (!props.owned.includes(companionType)) continue;
		const equipped = props.equipped.includes(companionType);
		cards.push(
			<CompanionCard
				key={companionType}
				order={cards.size()}
				image={config.image}
				name={config.displayName}
				text={config.ability}
				stats={getCompanionStats(companionType, props)}
				locked={false}
				button={{
					label: equipped ? "Equipped" : "Equip",
					equipped,
					onClick: () => (equipped ? props.onUnequip(companionType) : props.onEquip(companionType)),
				}}
			/>,
		);
	}
	// Companions not earned yet stay a mystery
	const total = math.max(MIN_CARDS, cards.size() + 1);
	while (cards.size() < total) {
		cards.push(
			<CompanionCard
				key={`Locked${cards.size()}`}
				order={cards.size()}
				name="Locked"
				text="Complete quests and Ocean milestones to unlock new companions."
				locked={true}
			/>,
		);
	}

	const chip = (
		<Chip
			text={`EQUIPPED ${props.equipped.size()} / ${props.slots}`}
			color={NAVY.windowBottom}
			textColor={WHITE}
			height={28}
			textSize={16}
		/>
	);

	return (
		<Panel title="COMPANIONS" banner={PALETTES.green} headerExtra={chip} onClose={props.onClose}>
			<textlabel
				key="Subtitle"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 20)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text="Immortal helpers: they never eat and each one has its own ability."
				TextSize={15}
				TextColor3={NAVY.muted}
			/>
			<frame
				key="Grid"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
			>
				<uigridlayout
					CellSize={UDim2.fromOffset(CARD_SIZE.X, CARD_SIZE.Y)}
					CellPadding={UDim2.fromOffset(CARD_GAP, CARD_GAP)}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{cards}
			</frame>
		</Panel>
	);
}
