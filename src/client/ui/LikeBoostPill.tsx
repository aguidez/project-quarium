import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService, Workspace } from "@rbxts/services";
import { formatCountdown, LIKE_BOOST_MULTIPLIER } from "shared/types/likes";
import { Plate, TextStroke } from "./kit";
import { FONT_BOLD, PALETTES } from "./theme";

export const PILL_HEIGHT = 40;
const PILL_WIDTH = 262;
const WHITE = new Color3(1, 1, 1);

export interface LikeBoostPillProps {
	/** Coins boosted until then (server time). */
	endsAt: number;
	/** Pixels from the top of the screen (under the top HUD). */
	top: number;
	scale: number;
}

/** White heart drawn with frames: two discs over a square turned 45 degrees. */
function Heart(props: { size: number; position: UDim2 }) {
	const s = props.size;
	const lobe = s * 0.56;
	const piece = (key: string, position: UDim2, size: number, round: boolean, rotation = 0) => (
		<frame
			key={key}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={position}
			Size={UDim2.fromOffset(size, size)}
			Rotation={rotation}
			BackgroundColor3={WHITE}
			BorderSizePixel={0}
			ZIndex={3}
		>
			{round && <uicorner CornerRadius={new UDim(0.5, 0)} />}
		</frame>
	);
	return (
		<frame key="Heart" Position={props.position} Size={UDim2.fromOffset(s, s)} BackgroundTransparency={1}>
			{piece("Point", UDim2.fromScale(0.5, 0.56), s * 0.6, false, 45)}
			{piece("LobeLeft", UDim2.fromScale(0.3, 0.36), lobe, true)}
			{piece("LobeRight", UDim2.fromScale(0.7, 0.36), lobe, true)}
		</frame>
	);
}

/** The owner's own boost after a like (FigCraft redesign-v2: LikeBoostPill), centred under the top HUD. */
export function LikeBoostPill(props: LikeBoostPillProps) {
	const [remaining, setRemaining] = useBinding(props.endsAt - Workspace.GetServerTimeNow());
	useEffect(() => {
		const connection = RunService.Heartbeat.Connect(() =>
			setRemaining(props.endsAt - Workspace.GetServerTimeNow()),
		);
		return () => connection.Disconnect();
	}, [props.endsAt]);
	const palette = PALETTES.pink;

	return (
		<frame
			key="LikeBoostPill"
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
				<Heart size={22} position={UDim2.fromOffset(12, 9)} />
				<textlabel
					key="Label"
					Position={UDim2.fromOffset(42, 0)}
					Size={new UDim2(1, -120, 1, 0)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={`LIKED! COINS x${LIKE_BOOST_MULTIPLIER}`}
					TextSize={17}
					TextColor3={WHITE}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={3}
				>
					<TextStroke color={palette.shadow} thickness={2.5} />
				</textlabel>
				<frame
					key="Timer"
					AnchorPoint={new Vector2(1, 0.5)}
					Position={new UDim2(1, -8, 0.5, 0)}
					Size={UDim2.fromOffset(64, 26)}
					BackgroundColor3={WHITE}
					BorderSizePixel={0}
					ZIndex={3}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uistroke Color={palette.shadow} Thickness={2.5} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					<textlabel
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={remaining.map(formatCountdown)}
						TextSize={16}
						TextColor3={palette.shadow}
						ZIndex={3}
					/>
				</frame>
			</Plate>
		</frame>
	);
}
