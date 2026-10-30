import React, { useEffect, useState } from "@rbxts/react";
import { FishType } from "shared/types/fish";
import { GamePass } from "shared/types/gamepasses";
import { PlayerData } from "shared/types/playerData";
import {
	AQUARIUM_THEMES,
	formatMultiplier,
	getNextRebirth,
	getRebirthMultiplier,
	getRebirthOceanPoints,
} from "shared/types/rebirths";
import { Button3D, Card, Plate, ProgressBar, TextStroke } from "./kit";
import { formatNumber, getWrappedHeight, Panel, PANEL_INNER_WIDTH } from "./Panel";
import {
	EGG_SPRITES,
	FISH_ICONS,
	FONT_BOLD,
	FONT_TITLE,
	NAVY,
	OUTLINE,
	PALETTES,
	REBIRTH_COLORS,
	V2_IMAGES,
	verticalGradient,
} from "./theme";

const ROW_PADDING = 12;
const ROW_ICON = 52;
const ROW_GAP = 14;
const ROW_TEXT_WIDTH = PANEL_INNER_WIDTH - ROW_PADDING * 2 - ROW_ICON - ROW_GAP;
const BUTTON_WIDTH = 200;
const FOOTER_HEIGHT = 56;
/** Seconds the "click again to confirm" state lasts: a rebirth can't be undone. */
const CONFIRM_TIME = 4;
const WHITE = new Color3(1, 1, 1);

export interface RebirthPanelProps {
	rebirths: number;
	money: number;
	fish: Record<FishType, number>;
	/** Gamepasses owned (x2 Ocean Points doubles the rebirth's points). */
	passes: readonly GamePass[];
	/** Living rare variants (PlayerData.fishVariants): worth more Ocean Points. */
	fishVariants: PlayerData["fishVariants"];
	onRebirth: () => void;
	onClose: () => void;
}

/** One consequence of the rebirth (FigCraft: RebirthPanel / Row_*): picture, title and explanation. */
function Row(props: { order: number; image: string; title: string; body: string }) {
	return (
		<Card key={props.title} layoutOrder={props.order}>
			<uipadding
				PaddingTop={new UDim(0, ROW_PADDING)}
				PaddingBottom={new UDim(0, ROW_PADDING)}
				PaddingLeft={new UDim(0, ROW_PADDING)}
				PaddingRight={new UDim(0, ROW_PADDING)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, ROW_GAP)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<frame
				key="Icon"
				LayoutOrder={1}
				Size={UDim2.fromOffset(ROW_ICON, ROW_ICON)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<uigradient Color={verticalGradient(Color3.fromHex("#3B6CA6"), NAVY.cardBottom)} Rotation={90} />
				<uistroke Color={OUTLINE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
				<imagelabel
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.5)}
					Size={UDim2.fromScale(0.86, 0.86)}
					BackgroundTransparency={1}
					Image={props.image}
					ScaleType={Enum.ScaleType.Fit}
				/>
			</frame>
			<frame
				key="Texts"
				LayoutOrder={2}
				Size={UDim2.fromOffset(ROW_TEXT_WIDTH, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
			>
				<uilistlayout Padding={new UDim(0, 2)} SortOrder={Enum.SortOrder.LayoutOrder} />
				<textlabel
					key="Title"
					LayoutOrder={1}
					Size={new UDim2(1, 0, 0, 24)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={props.title}
					TextSize={19}
					TextColor3={WHITE}
					TextXAlignment={Enum.TextXAlignment.Left}
				>
					<TextStroke />
				</textlabel>
				<textlabel
					key="Body"
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, getWrappedHeight(props.body, 14, FONT_BOLD, ROW_TEXT_WIDTH))}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={props.body}
					TextSize={14}
					TextColor3={NAVY.muted}
					TextWrapped={true}
					TextXAlignment={Enum.TextXAlignment.Left}
					TextYAlignment={Enum.TextYAlignment.Top}
				/>
			</frame>
		</Card>
	);
}

/** "x1 -> x2.5 / COINS, FOREVER" (FigCraft: RebirthPanel / Hero), a gold relief plate. */
function Hero(props: { from: number; to: number }) {
	const palette = PALETTES.gold;
	return (
		<Plate
			key="Hero"
			layoutOrder={1}
			size={new UDim2(1, 0, 0, 92)}
			top={palette.light}
			bottom={palette.dark}
			shadow={palette.shadow}
			radius={20}
			depth={6}
			gloss={true}
		>
			<textlabel
				key="Multiplier"
				Position={UDim2.fromOffset(0, 10)}
				Size={new UDim2(1, 0, 0, 50)}
				BackgroundTransparency={1}
				Font={FONT_TITLE}
				Text={`${formatMultiplier(props.from)}  >  ${formatMultiplier(props.to)}`}
				TextSize={46}
				TextColor3={WHITE}
				ZIndex={3}
			>
				<TextStroke color={REBIRTH_COLORS.heroTextStroke} thickness={3.5} />
			</textlabel>
			<textlabel
				key="Caption"
				Position={UDim2.fromOffset(0, 62)}
				Size={new UDim2(1, 0, 0, 20)}
				BackgroundTransparency={1}
				Font={FONT_TITLE}
				Text="COINS, FOREVER"
				TextSize={18}
				TextColor3={REBIRTH_COLORS.heroText}
				ZIndex={3}
			/>
		</Plate>
	);
}

/**
 * Rebirth menu (FigCraft: RebirthPanel): what the next rebirth gives (permanent multiplier, new
 * aquarium, Ocean Points for the fish) and costs (the whole run). The button needs a second click
 * to confirm. The server checks everything again.
 */
export function RebirthPanel(props: RebirthPanelProps) {
	const upcoming = getNextRebirth(props.rebirths);
	const [confirming, setConfirming] = useState(false);
	useEffect(() => {
		if (!confirming) return;
		const thread = task.delay(CONFIRM_TIME, () => setConfirming(false));
		return () => task.cancel(thread);
	}, [confirming]);

	if (!upcoming) {
		return (
			<Panel title="REBIRTH" banner={PALETTES.purple} onClose={props.onClose}>
				<Hero from={getRebirthMultiplier(props.rebirths)} to={getRebirthMultiplier(props.rebirths)} />
				<Row
					order={2}
					image={V2_IMAGES.iconRebirth}
					title="More rebirths are coming"
					body="You have done every rebirth for now. The next ones arrive with the next eggs!"
				/>
			</Panel>
		);
	}

	let fishCount = 0;
	for (const [, count] of pairs(props.fish)) fishCount += count;
	const points = getRebirthOceanPoints({
		fish: props.fish,
		fishVariants: props.fishVariants,
		passes: props.passes as GamePass[],
	});
	const affordable = props.money >= upcoming.price;
	const ratio = math.clamp(props.money / upcoming.price, 0, 1);
	const buttonSize = UDim2.fromOffset(BUTTON_WIDTH, FOOTER_HEIGHT - 6);

	let button: React.Element;
	if (!affordable) {
		button = (
			<Button3D
				key="RebirthButton"
				layoutOrder={2}
				palette={PALETTES.grey}
				size={buttonSize}
				text={`${formatNumber(upcoming.price)}$`}
				textSize={22}
				disabled={true}
			/>
		);
	} else if (confirming) {
		button = (
			<Button3D
				key="RebirthButton"
				layoutOrder={2}
				palette={PALETTES.red}
				size={buttonSize}
				text="SURE? CLICK AGAIN"
				textSize={18}
				onClick={() => {
					setConfirming(false);
					props.onRebirth();
				}}
			/>
		);
	} else {
		button = (
			<Button3D
				key="RebirthButton"
				layoutOrder={2}
				palette={PALETTES.green}
				size={buttonSize}
				text="REBIRTH!"
				textSize={26}
				onClick={() => setConfirming(true)}
			/>
		);
	}

	const fishText =
		fishCount > 0
			? `Your ${fishCount} fish leave your tank and earn you +${formatNumber(points)} Ocean Points.`
			: "Your tank is empty: no Ocean Points this time.";
	return (
		<Panel title="REBIRTH" banner={PALETTES.purple} onClose={props.onClose}>
			<Hero from={getRebirthMultiplier(props.rebirths)} to={upcoming.multiplier} />
			<Row order={2} image={V2_IMAGES.iconOcean} title="Your fish return to the ocean" body={fishText} />
			<Row
				order={3}
				image={EGG_SPRITES.Common.icon}
				title="Your run starts over"
				body={`Money back to ${formatNumber(upcoming.startMoney)}$, eggs and egg unlocks reset. Fish Index, quests, companions and Ocean Points are kept.`}
			/>
			<Row
				order={4}
				image={FISH_ICONS.Clownfish.Normal}
				title="A brand new aquarium"
				body={`Your tank becomes the ${AQUARIUM_THEMES[upcoming.theme].displayName}, and your coins are worth ${formatMultiplier(upcoming.multiplier)} forever.`}
			/>
			<frame key="Footer" LayoutOrder={5} Size={new UDim2(1, 0, 0, FOOTER_HEIGHT)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 14)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				<ProgressBar
					key="Progress"
					layoutOrder={1}
					size={new UDim2(1, -(BUTTON_WIDTH + 14), 0, 40)}
					ratio={ratio}
					palette={PALETTES.gold}
					text={`${formatNumber(math.min(props.money, upcoming.price))} / ${formatNumber(upcoming.price)}$`}
					textSize={18}
				/>
				{button}
			</frame>
		</Panel>
	);
}
