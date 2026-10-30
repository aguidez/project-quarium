import React from "@rbxts/react";
import { CoinIcon, Plate, TextStroke } from "./kit";
import { formatNumber } from "./Panel";
import { FONT_TITLE, NAVY, PALETTES } from "./theme";

export const MONEY_COUNTER_SIZE = new Vector2(270, 66);
const COIN_SIZE = 64;
const PILL_HEIGHT = 58;

export interface MoneyCounterProps {
	layoutOrder: number;
	money: number;
}

/** Money pill with a big coin over its left end (FigCraft redesign-v2: MoneyCounter). */
export function MoneyCounter(props: MoneyCounterProps) {
	return (
		<frame
			LayoutOrder={props.layoutOrder}
			Size={UDim2.fromOffset(MONEY_COUNTER_SIZE.X, MONEY_COUNTER_SIZE.Y)}
			BackgroundTransparency={1}
		>
			<Plate
				key="Pill"
				top={NAVY.windowTop}
				bottom={NAVY.windowBottom}
				shadow={NAVY.windowShadow}
				size={UDim2.fromOffset(MONEY_COUNTER_SIZE.X - 10, PILL_HEIGHT)}
				position={UDim2.fromOffset(10, 2)}
				depth={6}
				radius={new UDim(0.5, 0)}
			>
				<frame
					key="GoldRim"
					Position={UDim2.fromOffset(4, 4)}
					Size={new UDim2(1, -8, 1, -8)}
					BackgroundTransparency={1}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uistroke Color={PALETTES.gold.base} Transparency={0.5} Thickness={2} />
				</frame>
				<textlabel
					key="Amount"
					Position={UDim2.fromOffset(COIN_SIZE - 6, 2)}
					Size={new UDim2(1, -(COIN_SIZE - 6) - 18, 1, 0)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={formatNumber(props.money)}
					TextScaled={true}
					TextColor3={PALETTES.gold.base}
					TextXAlignment={Enum.TextXAlignment.Right}
					ZIndex={3}
				>
					<uitextsizeconstraint MaxTextSize={34} />
					<uipadding PaddingTop={new UDim(0, 10)} PaddingBottom={new UDim(0, 8)} />
					<TextStroke color={Color3.fromHex("#4A2E00")} thickness={3} />
				</textlabel>
			</Plate>
			<CoinIcon key="Coin" size={COIN_SIZE} position={UDim2.fromOffset(0, 0)} zIndex={4} />
		</frame>
	);
}
