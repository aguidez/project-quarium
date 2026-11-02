import React from "@rbxts/react";
import { formatLeaderboardValue, LeaderboardEntry, LeaderboardId } from "shared/types/leaderboards";
import { CoinIcon, Outline, TextStroke } from "./kit";
import {
	FONT_BOLD,
	FONT_TITLE,
	LEADERBOARD_COLORS,
	NAVY,
	OUTLINE,
	Palette,
	PALETTES,
	V2_IMAGES,
	verticalGradient,
} from "./theme";

/**
 * Size in pixels of a board's face (FigCraft leaderboards.figcraft, Board_*): the SurfaceGui's density follows the
 * "Screen" part's real width, so the signs can be resized in Studio as long as they keep this aspect.
 */
export const LEADERBOARD_CANVAS = new Vector2(440, 540);

const WHITE = new Color3(1, 1, 1);
const ROW_HEIGHT = 32;
const ROW_GAP = 4;

interface BoardStyle {
	title: string;
	subtitle: string;
	palette: Palette;
	/** Colour of the scores. */
	value: Color3;
	/** Luckiest Guy for plain numbers; Fredoka for "$7.2M/s" and "212h 05m" (Luckiest Guy's capital S reads like a 5). */
	valueFont: Enum.Font;
}

const BOARD_STYLES: Record<LeaderboardId, BoardStyle> = {
	OceanPoints: {
		title: "OCEAN LEGENDS",
		subtitle: "MOST OCEAN POINTS",
		palette: PALETTES.lagoon,
		value: PALETTES.lagoon.light,
		valueFont: FONT_TITLE,
	},
	Income: {
		title: "RICHEST TANKS",
		subtitle: "COINS PER SECOND",
		palette: PALETTES.gold,
		value: PALETTES.gold.base,
		valueFont: FONT_BOLD,
	},
	PlayTime: {
		title: "DEVOTED KEEPERS",
		subtitle: "TIME WITH THEIR AQUARIUM",
		palette: PALETTES.green,
		value: PALETTES.green.light,
		valueFont: FONT_BOLD,
	},
};

const MEDALS = [PALETTES.gold, LEADERBOARD_COLORS.silver, LEADERBOARD_COLORS.bronze];

/** White clock with two hands (the time board's icon), drawn with frames. */
function ClockIcon(props: { size: number; position: UDim2; zIndex?: number }) {
	const s = props.size;
	const hand = math.max(math.floor(s * 0.1), 2);
	return (
		<frame Position={props.position} Size={UDim2.fromOffset(s, s)} BackgroundColor3={WHITE} ZIndex={props.zIndex}>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uigradient Color={verticalGradient(WHITE, LEADERBOARD_COLORS.clockFace)} Rotation={90} />
			<Outline thickness={math.max(s * 0.08, 1.5)} />
			<frame
				key="HandUp"
				Position={new UDim2(0.5, -hand / 2, 0.2, 0)}
				Size={new UDim2(0, hand, 0.32, 0)}
				BackgroundColor3={OUTLINE}
				BorderSizePixel={0}
				ZIndex={props.zIndex}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
			</frame>
			<frame
				key="HandRight"
				Position={new UDim2(0.5, -hand / 2, 0.5, -hand / 2)}
				Size={new UDim2(0.26, 0, 0, hand)}
				BackgroundColor3={PALETTES.green.dark}
				BorderSizePixel={0}
				ZIndex={props.zIndex}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
			</frame>
		</frame>
	);
}

function BoardIcon(props: { board: LeaderboardId; size: number; position: UDim2; zIndex?: number }) {
	if (props.board === "Income") return <CoinIcon size={props.size} position={props.position} zIndex={props.zIndex} />;
	if (props.board === "PlayTime")
		return <ClockIcon size={props.size} position={props.position} zIndex={props.zIndex} />;
	return (
		<imagelabel
			Position={props.position}
			Size={UDim2.fromOffset(props.size, props.size)}
			BackgroundTransparency={1}
			Image={V2_IMAGES.iconOcean}
			ScaleType={Enum.ScaleType.Fit}
			ZIndex={props.zIndex}
		/>
	);
}

/** Gold / silver / bronze medal for the podium, a plain number below. */
function RankBadge(props: { rank: number }) {
	const medal = MEDALS[props.rank - 1];
	if (!medal) {
		return (
			<textlabel
				key="Rank"
				Position={UDim2.fromOffset(2, 0)}
				Size={UDim2.fromOffset(32, ROW_HEIGHT)}
				BackgroundTransparency={1}
				Font={FONT_TITLE}
				Text={tostring(props.rank)}
				TextSize={props.rank >= 100 ? 13 : 16}
				TextColor3={NAVY.muted}
			>
				<TextStroke />
			</textlabel>
		);
	}
	return (
		<frame key="Medal" Position={UDim2.fromOffset(5, 3)} Size={UDim2.fromOffset(26, 26)} BackgroundColor3={WHITE}>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uigradient Color={verticalGradient(medal.light, medal.base)} Rotation={90} />
			<Outline thickness={2} />
			<textlabel
				key="Rank"
				Position={UDim2.fromOffset(0, 1)}
				Size={UDim2.fromScale(1, 1)}
				BackgroundTransparency={1}
				Font={FONT_TITLE}
				Text={tostring(props.rank)}
				TextSize={16}
				TextColor3={WHITE}
			>
				<TextStroke color={medal.shadow} />
			</textlabel>
		</frame>
	);
}

function Row(props: { board: LeaderboardId; entry: LeaderboardEntry; rank: number; own: boolean }) {
	const style = BOARD_STYLES[props.board];
	const entry = props.entry;
	return (
		<frame
			LayoutOrder={props.rank}
			Size={new UDim2(1, -12, 0, ROW_HEIGHT)}
			BackgroundColor3={WHITE}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 10)} />
			<uigradient
				Color={
					props.own
						? verticalGradient(LEADERBOARD_COLORS.ownTop, LEADERBOARD_COLORS.ownBottom)
						: verticalGradient(NAVY.cardTop, NAVY.cardBottom)
				}
				Rotation={90}
			/>
			<Outline color={props.own ? PALETTES.green.base : undefined} thickness={props.own ? 3 : 2} />
			<RankBadge rank={props.rank} />
			<imagelabel
				key="Avatar"
				Position={UDim2.fromOffset(38, 3)}
				Size={UDim2.fromOffset(26, 26)}
				BackgroundColor3={LEADERBOARD_COLORS.avatar}
				Image={`rbxthumb://type=AvatarHeadShot&id=${entry.userId}&w=48&h=48`}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<Outline thickness={2} />
			</imagelabel>
			<textlabel
				key="Name"
				Position={UDim2.fromOffset(72, 0)}
				Size={UDim2.fromOffset(160, ROW_HEIGHT)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={entry.name !== "" ? entry.name : "..."}
				TextSize={17}
				TextColor3={WHITE}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextTruncate={Enum.TextTruncate.AtEnd}
			>
				<TextStroke thickness={1.5} />
			</textlabel>
			<textlabel
				key="Value"
				Position={UDim2.fromOffset(232, 0)}
				Size={UDim2.fromOffset(126, ROW_HEIGHT)}
				BackgroundTransparency={1}
				Font={style.valueFont}
				Text={formatLeaderboardValue(props.board, entry.value)}
				TextSize={18}
				TextColor3={style.value}
				TextXAlignment={Enum.TextXAlignment.Right}
			>
				<TextStroke />
			</textlabel>
			<BoardIcon board={props.board} size={22} position={UDim2.fromOffset(364, 5)} />
		</frame>
	);
}

export interface LeaderboardBoardProps {
	board: LeaderboardId;
	/** The top (best first); undefined until the server sent it. */
	entries?: LeaderboardEntry[];
	/** The local player's own score; undefined while unknown or when the profile is kept off the boards. */
	own?: number;
	localUserId: number;
}

/**
 * Face of a leaderboard sign in the lobby (FigCraft: leaderboards.figcraft, Board_*), mounted by LeaderboardController
 * on the sign's Screen part: ribbon title with the board's medallion, ten rows that scroll to the 100th (wheel or
 * drag), and the local player's own rank and score at the bottom ("100+" beyond the top).
 */
export function LeaderboardBoard(props: LeaderboardBoardProps) {
	const style = BOARD_STYLES[props.board];
	const palette = style.palette;
	const entries = props.entries;
	let ownRank: number | undefined;
	if (entries) {
		for (let i = 0; i < entries.size(); i++) {
			if (entries[i].userId === props.localUserId) ownRank = i + 1;
		}
	}
	const ranked = props.own !== undefined && props.own > 0;
	const message = entries === undefined ? "LOADING..." : entries.size() === 0 ? "NO ONE YET!" : undefined;

	const rows: Record<string, React.Element> = {};
	if (entries) {
		entries.forEach((entry, i) => {
			rows[`Row${i + 1}`] = (
				<Row board={props.board} entry={entry} rank={i + 1} own={entry.userId === props.localUserId} />
			);
		});
	}

	return (
		<frame key="Face" Size={UDim2.fromScale(1, 1)} BackgroundColor3={WHITE} BorderSizePixel={0}>
			<uicorner CornerRadius={new UDim(0, 26)} />
			<uigradient Color={verticalGradient(NAVY.windowTop, NAVY.windowBottom)} Rotation={90} />
			<Outline thickness={4} />
			<frame
				key="InnerRim"
				Position={UDim2.fromOffset(7, 7)}
				Size={new UDim2(1, -14, 1, -14)}
				BackgroundTransparency={1}
			>
				<uicorner CornerRadius={new UDim(0, 20)} />
				<Outline color={WHITE} thickness={2} transparency={0.85} />
			</frame>

			<frame
				key="Banner"
				Position={UDim2.fromOffset(46, 16)}
				Size={UDim2.fromOffset(370, 58)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
				ZIndex={2}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uigradient Color={verticalGradient(palette.light, palette.base)} Rotation={90} />
				<Outline thickness={4} />
				<frame
					key="Gloss"
					Position={UDim2.fromOffset(6, 4)}
					Size={new UDim2(1, -12, 0, 22)}
					BackgroundColor3={WHITE}
					BackgroundTransparency={0.7}
					BorderSizePixel={0}
					ZIndex={2}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
				</frame>
				<textlabel
					// In a child label: the band's gradient would tint it
					key="Title"
					Position={UDim2.fromOffset(40, 2)}
					Size={UDim2.fromOffset(322, 56)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={style.title}
					TextSize={29}
					TextColor3={WHITE}
					ZIndex={3}
				>
					<TextStroke color={palette.shadow} thickness={3} />
				</textlabel>
			</frame>
			<frame
				key="Medallion"
				Position={UDim2.fromOffset(14, 8)}
				Size={UDim2.fromOffset(74, 74)}
				BackgroundColor3={WHITE}
				ZIndex={4}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<uigradient Color={verticalGradient(palette.light, palette.dark)} Rotation={90} />
				<Outline thickness={4} />
				<BoardIcon board={props.board} size={48} position={UDim2.fromOffset(13, 13)} zIndex={5} />
			</frame>
			<textlabel
				key="Subtitle"
				Position={UDim2.fromOffset(40, 80)}
				Size={UDim2.fromOffset(360, 24)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={style.subtitle}
				TextSize={16}
				TextColor3={NAVY.muted}
			/>

			<scrollingframe
				key="List"
				Position={UDim2.fromOffset(16, 114)}
				Size={UDim2.fromOffset(408, 10 * ROW_HEIGHT + 9 * ROW_GAP)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				CanvasSize={new UDim2()}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
				ScrollingDirection={Enum.ScrollingDirection.Y}
				ScrollBarThickness={6}
				ScrollBarImageColor3={palette.base}
				ElasticBehavior={Enum.ElasticBehavior.Never}
			>
				<uilistlayout Padding={new UDim(0, ROW_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} />
				{rows}
			</scrollingframe>
			{message !== undefined && (
				<textlabel
					key="Message"
					Position={UDim2.fromOffset(16, 114)}
					Size={UDim2.fromOffset(408, 356)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={message}
					TextSize={26}
					TextColor3={NAVY.muted}
				>
					<TextStroke />
				</textlabel>
			)}

			<frame
				key="You"
				Position={UDim2.fromOffset(16, 484)}
				Size={UDim2.fromOffset(408, 42)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 12)} />
				<uigradient
					Color={verticalGradient(LEADERBOARD_COLORS.ownTop, LEADERBOARD_COLORS.ownBottom)}
					Rotation={90}
				/>
				<Outline color={PALETTES.green.base} thickness={3} />
				<frame
					key="YouChip"
					Position={UDim2.fromOffset(8, 7)}
					Size={UDim2.fromOffset(56, 28)}
					BackgroundColor3={WHITE}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uigradient Color={verticalGradient(PALETTES.green.light, PALETTES.green.base)} Rotation={90} />
					<Outline thickness={2.5} />
					<textlabel
						key="Text"
						Position={UDim2.fromOffset(0, 1)}
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text="YOU"
						TextSize={17}
						TextColor3={WHITE}
					>
						<TextStroke color={PALETTES.green.shadow} />
					</textlabel>
				</frame>
				<textlabel
					key="Rank"
					Position={UDim2.fromOffset(72, 0)}
					Size={UDim2.fromOffset(90, 42)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={!ranked ? "-" : ownRank !== undefined ? `#${ownRank}` : "100+"}
					TextSize={22}
					TextColor3={WHITE}
					TextXAlignment={Enum.TextXAlignment.Left}
				>
					<TextStroke />
				</textlabel>
				<textlabel
					key="Value"
					Position={UDim2.fromOffset(170, 0)}
					Size={UDim2.fromOffset(196, 42)}
					BackgroundTransparency={1}
					Font={style.valueFont}
					Text={props.own !== undefined ? formatLeaderboardValue(props.board, props.own) : ""}
					TextSize={20}
					TextColor3={style.value}
					TextXAlignment={Enum.TextXAlignment.Right}
				>
					<TextStroke />
				</textlabel>
				<BoardIcon board={props.board} size={24} position={UDim2.fromOffset(372, 9)} />
			</frame>
		</frame>
	);
}
