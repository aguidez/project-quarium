import React, { useEffect, useState } from "@rbxts/react";
import { MarketplaceService } from "@rbxts/services";
import { arePassesOnSale } from "shared/types/alpha";
import { GAME_PASSES, GamePass, getShopPasses } from "shared/types/gamepasses";
import { Button3D, Chip, ItemSlot, Plate, TextStroke } from "./kit";
import { Panel } from "./Panel";
import { FONT_BOLD, FONT_TITLE, NAVY, Palette, PALETTES } from "./theme";

const CARD_SIZE = new Vector2(268, 250);
const CARD_GAP = 14;
const CARD_DEPTH = 5;
const SLOT_SIZE = 96;
const WHITE = new Color3(1, 1, 1);

/** Each pass wears its own colour, like the side buttons. */
const PASS_PALETTES: Partial<Record<GamePass, Palette>> = {
	ThirdCompanionSlot: PALETTES.green,
	OceanBoost: PALETTES.lagoon,
	Lucky: PALETTES.purple,
	Coins: PALETTES.gold,
};

/** What Roblox says of a pass: its Robux price, or "OffSale" (no price set on the Creator Dashboard). */
type PassPrice = number | "OffSale";

/** Prices read from Roblox, kept for the session (the Creator Dashboard is the only place they are set). */
const priceCache = new Map<number, number>();

function fetchPrice(id: number): PassPrice | undefined {
	const cached = priceCache.get(id);
	if (cached !== undefined) return cached;
	const [ok, info] = pcall(() => MarketplaceService.GetProductInfo(id, Enum.InfoType.GamePass));
	if (!ok) return undefined;
	// Not cached: a pass put on sale meanwhile shows its price at the next opening
	if (!info.IsForSale || info.PriceInRobux === undefined) return "OffSale";
	priceCache.set(id, info.PriceInRobux);
	return info.PriceInRobux;
}

/** The passes' prices; filled in as Roblox answers (a card shows "BUY" until then, or if Roblox doesn't answer). */
function usePassPrices(passes: readonly GamePass[]): ReadonlyMap<GamePass, PassPrice> {
	const [prices, setPrices] = useState<ReadonlyMap<GamePass, PassPrice>>(new Map());
	useEffect(() => {
		const thread = task.spawn(() => {
			const found = new Map<GamePass, PassPrice>();
			for (const pass of passes) {
				const id = GAME_PASSES[pass].id;
				const price = id > 0 ? fetchPrice(id) : undefined;
				if (price !== undefined) found.set(pass, price);
			}
			setPrices(found);
		});
		return () => task.cancel(thread);
	}, []);
	return prices;
}

export interface ShopPanelProps {
	passes: readonly GamePass[];
	/** Intent: the server shows Roblox's purchase prompt and grants the pass once bought. */
	onBuy: (pass: GamePass) => void;
	onClose: () => void;
}

function PassCard(props: { order: number; pass: GamePass; owned: boolean; price?: PassPrice; onBuy: () => void }) {
	const config = GAME_PASSES[props.pass];
	const palette = PASS_PALETTES[props.pass] ?? PALETTES.blue;
	const onSale = config.id > 0 && props.price !== "OffSale" && arePassesOnSale(); // none during the alpha
	const label = props.owned ? "OWNED" : !onSale ? "SOON" : props.price !== undefined ? `R$ ${props.price}` : "BUY";
	return (
		<Plate
			layoutOrder={props.order}
			top={NAVY.cardTop}
			bottom={NAVY.cardBottom}
			shadow={NAVY.cardShadow}
			outline={props.owned ? PALETTES.gold.base : undefined}
			size={new UDim2(1, 0, 1, -CARD_DEPTH)}
			depth={CARD_DEPTH}
			radius={18}
		>
			<uipadding
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 12)}
				PaddingLeft={new UDim(0, 14)}
				PaddingRight={new UDim(0, 14)}
			/>
			<uilistlayout
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<frame key="Top" LayoutOrder={1} Size={new UDim2(1, 0, 0, SLOT_SIZE + 4)} BackgroundTransparency={1}>
				<ItemSlot
					key="Icon"
					size={SLOT_SIZE}
					palette={palette}
					image={config.image !== "" ? config.image : undefined}
					imageScale={new Vector2(0.85, 0.85)}
					position={UDim2.fromScale(0.5, 0)}
					anchorPoint={new Vector2(0.5, 0)}
				/>
				{config.badge !== undefined && (
					<Chip
						key="Badge"
						text={config.badge}
						color={palette.base}
						textColor={WHITE}
						textStroke={palette.shadow}
						font={FONT_TITLE}
						textSize={22}
						height={32}
						position={new UDim2(0.5, SLOT_SIZE / 2 - 14, 0, SLOT_SIZE - 26)}
						zIndex={6}
					/>
				)}
			</frame>
			<textlabel
				key="Name"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 24)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={config.displayName}
				TextSize={20}
				TextColor3={WHITE}
			>
				<TextStroke thickness={2.5} />
			</textlabel>
			<textlabel
				key="Text"
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 36)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={config.description}
				TextSize={14}
				TextColor3={NAVY.muted}
				TextWrapped={true}
				TextYAlignment={Enum.TextYAlignment.Top}
			/>
			<Button3D
				key="Button"
				layoutOrder={4}
				palette={props.owned ? PALETTES.gold : onSale ? PALETTES.green : PALETTES.navy}
				size={new UDim2(1, 0, 0, 38)}
				text={label}
				textSize={19}
				disabled={props.owned || !onSale}
				onClick={props.onBuy}
			/>
		</Plate>
	);
}

/** The gamepass shop: one card per pass, bought through Roblox's own prompt. */
export function ShopPanel(props: ShopPanelProps) {
	const shopPasses = getShopPasses();
	const prices = usePassPrices(shopPasses);
	const cards = shopPasses.map((pass, index) => (
		<PassCard
			key={pass}
			order={index}
			pass={pass}
			owned={props.passes.includes(pass)}
			price={prices.get(pass)}
			onBuy={() => props.onBuy(pass)}
		/>
	));
	return (
		<Panel title="SHOP" banner={PALETTES.pink} onClose={props.onClose}>
			<textlabel
				key="Subtitle"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 20)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text="Permanent boosts for your aquarium. Thank you for your support!"
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
