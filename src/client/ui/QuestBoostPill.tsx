import React, { useBinding, useEffect } from "@rbxts/react";
import { Players } from "@rbxts/services";
import { formatCountdown } from "shared/types/likes";
import { QUEST_COIN_BOOST_MULTIPLIER } from "shared/types/quests";
import { CoinIcon, Plate, TextStroke } from "./kit";
import { PILL_HEIGHT } from "./LikeBoostPill";
import { FONT_BOLD, PALETTES } from "./theme";

const PILL_WIDTH = 262;
const TIMER_WIDTH = 78;
const WHITE = new Color3(1, 1, 1);

/** Player attributes written by the server (FishService.runCoinBoost). */
export const BOOST_SECONDS_ATTRIBUTE = "CoinBoostSeconds";
const BOOST_RUNNING_ATTRIBUTE = "CoinBoostRunning";

export interface QuestBoostPillProps {
	/** Pixels from the top of the screen (under the top HUD and the like pill). */
	top: number;
	scale: number;
}

/**
 * The quest coin boost (daily / weekly rewards) the local player still has, with its time left: it runs down only
 * while their tank produces, so it says PAUSED in the lobby. Same look as the like pill, in gold.
 */
export function QuestBoostPill(props: QuestBoostPillProps) {
	const player = Players.LocalPlayer;
	const read = () => ({
		seconds: (player.GetAttribute(BOOST_SECONDS_ATTRIBUTE) as number | undefined) ?? 0,
		running: player.GetAttribute(BOOST_RUNNING_ATTRIBUTE) === true,
	});
	const [state, setState] = useBinding(read());
	useEffect(() => {
		const update = () => setState(read());
		const connections = [
			player.GetAttributeChangedSignal(BOOST_SECONDS_ATTRIBUTE).Connect(update),
			player.GetAttributeChangedSignal(BOOST_RUNNING_ATTRIBUTE).Connect(update),
		];
		update();
		return () => connections.forEach((connection) => connection.Disconnect());
	}, []);
	const palette = PALETTES.gold;
	const text = palette.shadow;

	return (
		<frame
			key="QuestBoostPill"
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, props.top)}
			Size={UDim2.fromOffset(PILL_WIDTH, PILL_HEIGHT + 5)}
			BackgroundTransparency={1}
		>
			<uiscale Scale={props.scale} />
			<Plate
				key="Pill"
				top={palette.light}
				bottom={palette.base}
				shadow={palette.shadow}
				size={UDim2.fromOffset(PILL_WIDTH, PILL_HEIGHT)}
				radius={new UDim(0.5, 0)}
				gloss={true}
			>
				<CoinIcon key="Coin" size={28} position={UDim2.fromOffset(8, 6)} zIndex={3} />
				<textlabel
					key="Label"
					Position={UDim2.fromOffset(42, 0)}
					Size={new UDim2(1, -(42 + TIMER_WIDTH + 12), 1, 0)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={`QUEST BOOST x${QUEST_COIN_BOOST_MULTIPLIER}`}
					TextSize={17}
					TextColor3={WHITE}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={3}
				>
					<TextStroke color={text} thickness={2.5} />
				</textlabel>
				<frame
					key="Timer"
					AnchorPoint={new Vector2(1, 0.5)}
					Position={new UDim2(1, -8, 0.5, 0)}
					Size={UDim2.fromOffset(TIMER_WIDTH, 26)}
					BackgroundColor3={state.map((s) => (s.running ? WHITE : PALETTES.grey.light))}
					BorderSizePixel={0}
					ZIndex={3}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uistroke Color={text} Thickness={2.5} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					<textlabel
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={state.map((s) => (s.running ? formatCountdown(s.seconds) : "PAUSED"))}
						TextSize={16}
						TextColor3={text}
						ZIndex={3}
					/>
				</frame>
			</Plate>
		</frame>
	);
}
