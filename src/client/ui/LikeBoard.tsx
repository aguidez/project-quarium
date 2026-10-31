import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService, Workspace } from "@rbxts/services";
import { formatCountdown, LIKE_BOOST_DURATION, LIKE_BOOST_MULTIPLIER } from "shared/types/likes";
import { formatNumber } from "./Panel";
import { COLORS, FONT_BLACK, FONT_BOLD, LIKE_COLORS, verticalGradient } from "./theme";

/**
 * Width in pixels of the board's face (the FigCraft design's 360 × 220 px): the SurfaceGui's density follows the
 * "Board" part's real size, so the board can be scaled in Studio without touching the layout.
 */
export const BOARD_CANVAS_WIDTH = 360;

export interface LikeBoardProps {
	/** Likes of the aquarium's owner; undefined while the aquarium is free. */
	likes?: number;
	/** Coins boosted until then (server time). */
	boostEndsAt?: number;
}

/** Remaining boost time, refreshed every frame while the board exists. */
function useBoostRemaining(boostEndsAt: number) {
	const [remaining, setRemaining] = useBinding(boostEndsAt - Workspace.GetServerTimeNow());
	useEffect(() => {
		const connection = RunService.Heartbeat.Connect(() => setRemaining(boostEndsAt - Workspace.GetServerTimeNow()));
		return () => connection.Disconnect();
	}, [boostEndsAt]);
	return remaining;
}

/**
 * Face of the like board beside each aquarium (FigCraft: LikeBoard / LikeBoard_Boosted): the owner's
 * likes, and either what a like gives or the boost still running. Liking goes through the board's
 * ProximityPrompt (LikeBoardController).
 */
export function LikeBoard(props: LikeBoardProps) {
	const remaining = useBoostRemaining(props.boostEndsAt ?? 0);
	const boosted = remaining.map((seconds) => seconds > 0);
	const free = props.likes === undefined;

	return (
		<frame key="Board" Size={UDim2.fromScale(1, 1)} BackgroundColor3={COLORS.white}>
			<uigradient Color={verticalGradient(LIKE_COLORS.boardTop, LIKE_COLORS.boardBottom)} Rotation={90} />
			<uicorner CornerRadius={new UDim(0, 30)} />
			<uistroke Color={LIKE_COLORS.boardStroke} Thickness={6} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
			<uipadding
				PaddingTop={new UDim(0, 16)}
				PaddingBottom={new UDim(0, 18)}
				PaddingLeft={new UDim(0, 20)}
				PaddingRight={new UDim(0, 20)}
			/>
			<uilistlayout
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, 4)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<textlabel
				key="Title"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 28)}
				BackgroundTransparency={1}
				Font={FONT_BLACK}
				Text="AQUARIUM LIKES"
				TextSize={22}
				TextColor3={LIKE_COLORS.title}
			/>
			<frame
				key="Count"
				LayoutOrder={2}
				Size={UDim2.fromOffset(0, 84)}
				AutomaticSize={Enum.AutomaticSize.X}
				BackgroundTransparency={1}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 10)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				<textlabel
					key="Thumb"
					LayoutOrder={1}
					Size={UDim2.fromOffset(64, 70)}
					BackgroundTransparency={1}
					Text="👍"
					TextSize={58}
				/>
				<textlabel
					key="Value"
					LayoutOrder={2}
					Size={UDim2.fromOffset(0, 84)}
					AutomaticSize={Enum.AutomaticSize.X}
					BackgroundTransparency={1}
					Font={FONT_BLACK}
					Text={free ? "-" : formatNumber(props.likes!)}
					TextSize={72}
					TextColor3={LIKE_COLORS.count}
				/>
			</frame>
			<textlabel
				key="Hint"
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 34)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={
					free
						? "Free aquarium"
						: `A like = x${LIKE_BOOST_MULTIPLIER} coins for ${LIKE_BOOST_DURATION / 60} min`
				}
				TextSize={18}
				TextColor3={LIKE_COLORS.hint}
				Visible={boosted.map((on) => !on)}
			/>
			<frame
				key="Boost"
				LayoutOrder={4}
				Size={UDim2.fromOffset(0, 34)}
				AutomaticSize={Enum.AutomaticSize.X}
				BackgroundColor3={COLORS.white}
				Visible={boosted}
			>
				<uigradient Color={verticalGradient(LIKE_COLORS.coralTop, LIKE_COLORS.coral)} Rotation={90} />
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<uistroke Color={LIKE_COLORS.coralStroke} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
				<uipadding PaddingLeft={new UDim(0, 16)} PaddingRight={new UDim(0, 16)} />
				<textlabel
					// In a child label: the frame's gradient would tint it
					key="BoostText"
					Size={UDim2.fromScale(0, 1)}
					AutomaticSize={Enum.AutomaticSize.X}
					BackgroundTransparency={1}
					Font={FONT_BLACK}
					Text={remaining.map((seconds) => `x${LIKE_BOOST_MULTIPLIER} COINS  ${formatCountdown(seconds)}`)}
					TextSize={20}
					TextColor3={COLORS.white}
				/>
			</frame>
		</frame>
	);
}
