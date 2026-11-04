import React, { useEffect, useState } from "@rbxts/react";
import { AdminServerInfo, AdminServersSync } from "shared/types/admin";
import { Button3D, Card, Chip, TextStroke } from "./kit";
import { PANEL_INNER_WIDTH } from "./Panel";
import { FONT_BOLD, FONT_TITLE, NAVY, PALETTES } from "./theme";

const WHITE = new Color3(1, 1, 1);
const REFRESH = 5; // seconds between two looks at the servers while the tab is open
const ARMED_TIME = 4; // seconds the UPDATE button waits for its confirmation
const ROW_HEIGHT = 66;
/** Rows shown before the list scrolls. */
const MAX_ROWS = 5;
const ROW_GAP = 14;
/** Room around the rows inside the scrolling list: a ScrollingFrame clips, and a card's outline spills out of it. */
const EDGE_ROOM = 6;
const SCROLL_ROOM = 10;

/** The tab's intents (UiController): the server checks the admin right again (AdminService). */
export interface AdminServerActions {
	onRequestServers: () => void;
	subscribeServers: (listener: (sync: AdminServersSync) => void) => () => void;
	onUpdateOldServers: () => void;
}

function Label(props: {
	text: string;
	position: UDim2;
	size: Vector2;
	textSize: number;
	title?: boolean;
	color?: Color3;
	align?: Enum.TextXAlignment;
}) {
	return (
		<textlabel
			Position={props.position}
			Size={UDim2.fromOffset(props.size.X, props.size.Y)}
			BackgroundTransparency={1}
			Font={props.title ? FONT_TITLE : FONT_BOLD}
			Text={props.text}
			TextSize={props.textSize}
			TextColor3={props.color ?? WHITE}
			TextXAlignment={props.align ?? Enum.TextXAlignment.Left}
			ZIndex={3}
		>
			{props.title && <TextStroke thickness={2.5} />}
		</textlabel>
	);
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "S"}`;
}

/** The newest version and the counts (FigCraft admin-panel: AdminServers_Mockup, Newest). */
function Summary(props: { sync: AdminServersSync; old: number; players: number }) {
	const newest = props.sync.servers.find((server) => server.version === props.sync.latest);
	return (
		<Card key="Newest" layoutOrder={1} highlight={PALETTES.gold.base}>
			<frame key="Row" Size={new UDim2(1, 0, 0, 92)} BackgroundTransparency={1}>
				<Label
					text="NEWEST VERSION"
					position={UDim2.fromOffset(18, 8)}
					size={new Vector2(300, 20)}
					textSize={15}
					color={NAVY.muted}
				/>
				<Label
					text={`V${newest?.gameVersion ?? "?"}`}
					position={UDim2.fromOffset(18, 28)}
					size={new Vector2(220, 40)}
					textSize={32}
					title={true}
				/>
				<Label
					text={`place version ${props.sync.latest}`}
					position={UDim2.fromOffset(18, 64)}
					size={new Vector2(220, 20)}
					textSize={15}
					color={NAVY.muted}
				/>
				<frame
					key="Chips"
					AnchorPoint={new Vector2(1, 0)}
					Position={new UDim2(1, -14, 0, 34)}
					Size={UDim2.fromOffset(300, 28)}
					BackgroundTransparency={1}
					ZIndex={3}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						HorizontalAlignment={Enum.HorizontalAlignment.Right}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<Chip
						key="Servers"
						layoutOrder={1}
						text={plural(props.sync.servers.size(), "SERVER")}
						color={NAVY.inactiveText}
						height={28}
						textSize={16}
						zIndex={3}
					/>
					<Chip
						key="Old"
						layoutOrder={2}
						text={`${props.old} OLD`}
						color={props.old > 0 ? PALETTES.red.base : PALETTES.green.base}
						textColor={props.old > 0 ? WHITE : undefined}
						height={28}
						textSize={16}
						zIndex={3}
					/>
					<Chip
						key="Players"
						layoutOrder={3}
						text={plural(props.players, "PLAYER")}
						color={PALETTES.gold.base}
						height={28}
						textSize={16}
						zIndex={3}
					/>
				</frame>
			</frame>
		</Card>
	);
}

/** One live server: its version, NEWEST / OLD, THIS SERVER, its players. */
function ServerRow(props: { server: AdminServerInfo; newest: boolean; order: number }) {
	const { server, newest } = props;
	return (
		<Card key={server.jobId} layoutOrder={props.order} highlight={newest ? undefined : PALETTES.red.base}>
			<frame key="Row" Size={new UDim2(1, 0, 0, ROW_HEIGHT)} BackgroundTransparency={1}>
				<Label
					text={`V${server.gameVersion}`}
					position={UDim2.fromOffset(18, 6)}
					size={new Vector2(150, 32)}
					textSize={24}
					title={true}
				/>
				<Label
					text={`place v${server.version}`}
					position={UDim2.fromOffset(18, 38)}
					size={new Vector2(150, 20)}
					textSize={14}
					color={NAVY.muted}
				/>
				<frame
					key="Chips"
					Position={UDim2.fromOffset(170, 20)}
					Size={UDim2.fromOffset(240, 26)}
					BackgroundTransparency={1}
					ZIndex={3}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<Chip
						key="State"
						layoutOrder={1}
						text={newest ? "NEWEST" : "OLD"}
						color={newest ? PALETTES.green.base : PALETTES.red.base}
						textColor={newest ? undefined : WHITE}
						height={26}
						textSize={15}
						zIndex={3}
					/>
					{server.thisServer && (
						<Chip
							key="Here"
							layoutOrder={2}
							text="THIS SERVER"
							color={PALETTES.amber.base}
							height={26}
							textSize={15}
							zIndex={3}
						/>
					)}
				</frame>
				<Label
					text={plural(server.players, "PLAYER")}
					position={new UDim2(1, -150, 0, 16)}
					size={new Vector2(134, 34)}
					textSize={20}
					title={true}
					align={Enum.TextXAlignment.Right}
				/>
			</frame>
		</Card>
	);
}

/**
 * Servers tab (FigCraft admin-panel: AdminServers_Mockup): the live servers and their versions (ServerUpdateService's
 * registry), and UPDATE OLD SERVERS (click, then click again within ARMED_TIME): the players of every older server move
 * to the newest version. Refreshed every REFRESH seconds while open.
 */
export function ServersTab(props: { actions: AdminServerActions }) {
	const { actions } = props;
	const [sync, setSync] = useState<AdminServersSync | undefined>(undefined);
	const [armed, setArmed] = useState(false);
	useEffect(() => {
		const disconnect = actions.subscribeServers((received) => setSync(received));
		actions.onRequestServers();
		let open = true;
		task.spawn(() => {
			while (open) {
				task.wait(REFRESH);
				if (open) actions.onRequestServers();
			}
		});
		return () => {
			open = false;
			disconnect();
		};
	}, []);
	useEffect(() => {
		if (!armed) return;
		const thread = task.delay(ARMED_TIME, () => setArmed(false));
		return () => task.cancel(thread);
	}, [armed]);

	let old = 0;
	let oldPlayers = 0;
	let players = 0;
	for (const server of sync?.servers ?? []) {
		players += server.players;
		if (sync && server.version < sync.latest) {
			old += 1;
			oldPlayers += server.players;
		}
	}
	const newest = sync?.servers.find((server) => server.version === sync.latest)?.gameVersion ?? "?";
	const rows = sync?.servers.size() ?? 0;
	const listHeight = math.min(rows, MAX_ROWS) * (ROW_HEIGHT + 5 + ROW_GAP) + EDGE_ROOM;
	let hint = "Their players move to the newest version (a short teleport)";
	if (armed) hint = `Their ${plural(oldPlayers, "player").lower()} move to V${newest} in 5 s`;
	else if (old === 0) hint = "Every server runs the newest version";
	else if (sync?.studio) hint = "Studio can't teleport: the live servers would move their players";

	return (
		<frame
			key="Servers"
			LayoutOrder={2}
			Size={UDim2.fromOffset(PANEL_INNER_WIDTH, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
		>
			<uilistlayout Padding={new UDim(0, 12)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{sync ? (
				<>
					<Summary key="Summary" sync={sync} old={old} players={players} />
					<textlabel
						key="Section"
						LayoutOrder={2}
						Size={new UDim2(1, 0, 0, 24)}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={sync.listed ? "LIVE SERVERS" : "LIVE SERVERS (the list can't be read: this server only)"}
						TextSize={18}
						TextColor3={NAVY.muted}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					{/* As wide as the content (the panel centres it); the list's rooms spill into the panel's padding */}
					<frame
						key="ListArea"
						LayoutOrder={3}
						Size={UDim2.fromOffset(PANEL_INNER_WIDTH, listHeight)}
						BackgroundTransparency={1}
					>
						<scrollingframe
							key="List"
							Position={UDim2.fromOffset(-EDGE_ROOM, 0)}
							Size={UDim2.fromOffset(PANEL_INNER_WIDTH + EDGE_ROOM + SCROLL_ROOM, listHeight)}
							BackgroundTransparency={1}
							BorderSizePixel={0}
							CanvasSize={UDim2.fromOffset(0, rows * (ROW_HEIGHT + 5 + ROW_GAP) + EDGE_ROOM)}
							ScrollingDirection={Enum.ScrollingDirection.Y}
							ScrollBarThickness={6}
							ScrollBarImageColor3={NAVY.muted}
							ScrollBarImageTransparency={rows > MAX_ROWS ? 0 : 1}
							VerticalScrollBarInset={Enum.ScrollBarInset.ScrollBar}
						>
							<uilistlayout Padding={new UDim(0, ROW_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} />
							<uipadding
								PaddingLeft={new UDim(0, EDGE_ROOM)}
								PaddingRight={new UDim(0, SCROLL_ROOM)}
								PaddingTop={new UDim(0, 3)}
							/>
							{sync.servers.map((server, index) => (
								<ServerRow
									key={server.jobId}
									server={server}
									newest={server.version >= sync.latest}
									order={index}
								/>
							))}
						</scrollingframe>
					</frame>
					<Button3D
						key="Update"
						layoutOrder={4}
						palette={PALETTES.red}
						size={UDim2.fromOffset(PANEL_INNER_WIDTH, 58)}
						disabled={old === 0}
						text={
							armed
								? "SURE? CLICK AGAIN"
								: old > 0
									? `UPDATE ${plural(old, "OLD SERVER")}`
									: "NO OLD SERVER"
						}
						textSize={26}
						onClick={() => {
							if (!armed) return setArmed(true);
							setArmed(false);
							actions.onUpdateOldServers();
						}}
					/>
					<textlabel
						key="Hint"
						LayoutOrder={5}
						Size={new UDim2(1, 0, 0, 22)}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={hint}
						TextSize={15}
						TextColor3={armed ? PALETTES.red.light : NAVY.muted}
					/>
				</>
			) : (
				<textlabel
					key="Loading"
					LayoutOrder={1}
					Size={new UDim2(1, 0, 0, 24)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text="LOADING..."
					TextSize={18}
					TextColor3={NAVY.muted}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
			)}
		</frame>
	);
}
