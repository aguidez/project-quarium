import React, { useBinding, useEffect, useState } from "@rbxts/react";
import { RunService, Workspace } from "@rbxts/services";
import { ADMIN_TABS, AdminTab } from "shared/types/admin";
import { ActiveEvent, ADMIN_EVENT_ORDER, GAME_EVENTS, GameEventType } from "shared/types/events";
import { formatTime } from "./EventBanner";
import { Button3D, Card, Chip, TextStroke } from "./kit";
import { Panel, PANEL_INNER_WIDTH } from "./Panel";
import { EVENT_BANNER_STYLES, FONT_BOLD, FONT_TITLE, NAVY, OUTLINE, PALETTES } from "./theme";

const TAB_SIZE = new Vector2(150, 44);
const ROW_HEIGHT = 76;
const BUTTON_SIZE = new Vector2(132, 50);
const BADGE_SIZE = 52;
const WHITE = new Color3(1, 1, 1);
/** Text drawn in an event's badge (no emoji: the K-pop's own icon is one). */
const BADGE_TEXT: Partial<Record<GameEventType, string>> = { Kpop: "♪", Island: "♫", Ufo: "UFO" };

export interface AdminPanelProps {
	/** The event running on this server, if any. */
	event?: ActiveEvent;
	/** Intents only: the server checks the admin right again (AdminService). */
	onStartEvent: (eventType: GameEventType) => void;
	onStopEvent: () => void;
	onClose: () => void;
}

function Tab(props: { label: string; active: boolean; order: number; onSelect: () => void }) {
	return (
		<Button3D
			key={props.label}
			layoutOrder={props.order}
			palette={props.active ? PALETTES.gold : PALETTES.navy}
			size={UDim2.fromOffset(TAB_SIZE.X, TAB_SIZE.Y)}
			text={props.label.upper()}
			textSize={22}
			textColor={props.active ? undefined : NAVY.inactiveText}
			onClick={props.onSelect}
		/>
	);
}

function Title(props: { text: string; position: UDim2; size: number }) {
	return (
		<textlabel
			key="Name"
			Position={props.position}
			Size={UDim2.fromOffset(320, 34)}
			BackgroundTransparency={1}
			Font={FONT_TITLE}
			Text={props.text}
			TextSize={props.size}
			TextColor3={WHITE}
			TextXAlignment={Enum.TextXAlignment.Left}
			ZIndex={3}
		>
			<TextStroke thickness={2.5} />
		</textlabel>
	);
}

/** The running event: its name, the time left and a STOP button (FigCraft admin-panel: NowPlaying). */
function NowPlaying(props: { event: ActiveEvent; onStop: () => void }) {
	const { event } = props;
	const [remaining, setRemaining] = useBinding(event.endsAt - Workspace.GetServerTimeNow());
	useEffect(() => {
		const connection = RunService.Heartbeat.Connect(() =>
			setRemaining(math.min(event.endsAt - Workspace.GetServerTimeNow(), event.endsAt - event.startsAt)),
		);
		return () => connection.Disconnect();
	}, [event.startsAt]);
	return (
		<Card key="NowPlaying" layoutOrder={1} highlight={PALETTES.gold.base}>
			<frame key="Row" Size={new UDim2(1, 0, 0, ROW_HEIGHT + 2)} BackgroundTransparency={1}>
				<textlabel
					key="Caption"
					Position={UDim2.fromOffset(18, 10)}
					Size={UDim2.fromOffset(300, 20)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text="NOW PLAYING"
					TextSize={15}
					TextColor3={NAVY.muted}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={3}
				/>
				<Title text={event.config.displayName.upper()} position={UDim2.fromOffset(18, 30)} size={26} />
				<frame
					key="Timer"
					Position={UDim2.fromOffset(300, 24)}
					Size={UDim2.fromOffset(76, 30)}
					BackgroundColor3={PALETTES.gold.base}
					BorderSizePixel={0}
					ZIndex={3}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uistroke Color={OUTLINE} Thickness={2.5} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					<textlabel
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={remaining.map(formatTime)}
						TextSize={18}
						TextColor3={OUTLINE}
						ZIndex={3}
					/>
				</frame>
				<Button3D
					key="Stop"
					palette={PALETTES.red}
					size={UDim2.fromOffset(BUTTON_SIZE.X, BUTTON_SIZE.Y)}
					position={new UDim2(1, -18, 0, 12)}
					anchorPoint={new Vector2(1, 0)}
					zIndex={3}
					text="STOP"
					onClick={props.onStop}
				/>
			</frame>
		</Card>
	);
}

function formatDuration(seconds: number): string {
	return seconds % 60 === 0 ? `${seconds / 60} MIN` : `${seconds} S`;
}

/** One event: badge, name, kind and length, START (FigCraft admin-panel: Event_*). */
function EventRow(props: { eventType: GameEventType; order: number; onStart: () => void }) {
	const config = GAME_EVENTS[props.eventType];
	const accents = EVENT_BANNER_STYLES[props.eventType].accents;
	const badgeText = BADGE_TEXT[props.eventType];
	return (
		<Card key={props.eventType} layoutOrder={props.order}>
			<frame key="Row" Size={new UDim2(1, 0, 0, ROW_HEIGHT)} BackgroundTransparency={1}>
				<frame
					key="Badge"
					Position={UDim2.fromOffset(14, 12)}
					Size={UDim2.fromOffset(BADGE_SIZE, BADGE_SIZE)}
					BackgroundColor3={WHITE}
					BorderSizePixel={0}
					ZIndex={3}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uigradient
						Color={new ColorSequence(accents[0], accents[1])}
						Rotation={90}
					/>
					<uistroke Color={WHITE} Thickness={2} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					{badgeText !== undefined && (
						// In a child label: the badge's gradient would tint text drawn on the badge itself
						// Scaled: Luckiest Guy has no music notes, and the fallback font draws them small at a fixed size
						<textlabel
							key="Icon"
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={UDim2.fromScale(0.5, 0.5)}
							Size={badgeText.size() > 1 ? UDim2.fromScale(0.7, 0.4) : UDim2.fromScale(0.62, 0.62)}
							BackgroundTransparency={1}
							Font={FONT_TITLE}
							Text={badgeText}
							TextScaled={true}
							TextColor3={WHITE}
							ZIndex={4}
						>
							<TextStroke thickness={2} />
						</textlabel>
					)}
				</frame>
				<Title text={config.displayName.upper()} position={UDim2.fromOffset(80, 8)} size={24} />
				<frame
					key="Chips"
					Position={UDim2.fromOffset(80, 42)}
					Size={UDim2.fromOffset(300, 24)}
					BackgroundTransparency={1}
					ZIndex={3}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<Chip
						key="Kind"
						layoutOrder={1}
						text={config.recurring ? "RECURRING" : "ADMIN ONLY"}
						color={config.recurring ? PALETTES.lagoon.base : PALETTES.purple.base}
						height={24}
						textSize={14}
						zIndex={3}
					/>
					<Chip
						key="Duration"
						layoutOrder={2}
						text={formatDuration(config.duration)}
						color={NAVY.inactiveText}
						height={24}
						textSize={14}
						zIndex={3}
					/>
				</frame>
				<Button3D
					key="Start"
					palette={PALETTES.green}
					size={UDim2.fromOffset(BUTTON_SIZE.X, BUTTON_SIZE.Y)}
					position={new UDim2(1, -18, 0, 12)}
					anchorPoint={new Vector2(1, 0)}
					zIndex={3}
					text="START"
					onClick={props.onStart}
				/>
			</frame>
		</Card>
	);
}

/** Events tab: the running event (STOP) and every event (START, replacing the running one). */
function EventsTab(props: AdminPanelProps) {
	return (
		<frame
			key="Events"
			LayoutOrder={2}
			Size={UDim2.fromOffset(PANEL_INNER_WIDTH, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
		>
			<uilistlayout Padding={new UDim(0, 12)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{props.event && (
				<NowPlaying key={`Now${props.event.startsAt}`} event={props.event} onStop={props.onStopEvent} />
			)}
			<textlabel
				key="Section"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 24)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text="START AN EVENT"
				TextSize={18}
				TextColor3={NAVY.muted}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>
			{ADMIN_EVENT_ORDER.map((eventType, index) => (
				<EventRow
					key={eventType}
					eventType={eventType}
					order={3 + index}
					onStart={() => props.onStartEvent(eventType)}
				/>
			))}
		</frame>
	);
}

/**
 * The admin panel (FigCraft: design/ui/admin-panel.figcraft), home of every administration tool, one tab per tool
 * (ADMIN_TABS). Shown only to players the server allows (ADMIN_PANEL_ATTRIBUTE); in Studio it acts on the playtest
 * server only.
 */
export function AdminPanel(props: AdminPanelProps) {
	const [tab, setTab] = useState<AdminTab>("Events");
	const scope = RunService.IsStudio() ? "STUDIO ONLY - THIS SERVER" : "LIVE - EVERY SERVER";
	return (
		<Panel
			title="ADMIN"
			banner={PALETTES.red}
			onClose={props.onClose}
			headerExtra={<Chip key="Scope" text={scope} color={PALETTES.amber.base} height={30} textSize={18} />}
		>
			<frame
				key="Tabs"
				LayoutOrder={1}
				Size={UDim2.fromScale(1, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					Padding={new UDim(0, 14)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{ADMIN_TABS.map(({ tab: id, label }, index) => (
					<Tab key={id} label={label} order={index} active={id === tab} onSelect={() => setTab(id)} />
				))}
			</frame>
			{tab === "Events" && <EventsTab {...props} />}
		</Panel>
	);
}
