import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService, TweenService, Workspace } from "@rbxts/services";
import { ActiveEvent } from "shared/types/events";
import { TextStroke } from "./kit";
import {
	COLORS,
	EVENT_BANNER_STYLES,
	FONT_BLACK,
	FONT_BOLD,
	FONT_TITLE,
	verticalGradient,
} from "./theme";

const POP_IN_TIME = 0.45;
const BEAT_TIME = 0.3; // the icon bounces and the border flashes for this long on each beat
const GLOW_PERIOD = 2.4; // seconds of one slow glow of an event without beats (the abyssal raid)
const GLOW_STRENGTH = 0.6; // its peak, on the beat pulse's 0..1 scale
const ICON_BOUNCE = 0.18;
const STROKE_MIN = 3;
const STROKE_MAX = 6;
const STROKE_ROOM = STROKE_MAX + 2; // px kept around the banner for its border
const SIDE_MARGIN = 16;
// Above FocusController's "Back to lobby" button (16 px margin + 50 px high + 6 px bevel) in the bottom-left corner
const TEST_BUTTON_BOTTOM = 82;
const TEST_BUTTON_HEIGHT = 36;
const TEST_BUTTON_GAP = 8;

export interface EventBannerProps {
	event: ActiveEvent;
	/** Pixels from the top of the screen (under the top HUD). */
	top: number;
	scale: number;
	/** Subscribes to the beats of the event's track (music events only); returns the unsubscribe function. */
	subscribeBeat: (listener: (beat: number) => void) => () => void;
}

/** "m:ss" of a countdown (the banner's timer, the admin panel's). */
export function formatTime(seconds: number): string {
	const total = math.max(math.ceil(seconds), 0);
	return `${math.floor(total / 60)}:${"%02d".format(total % 60)}`;
}

/**
 * Top-right banner of a running event (FigCraft: EventBanner, EventBannerAbyss): name, countdown,
 * and a bounce + colour flash on every beat of a music event's track, or a slow glow for the raid.
 */
export function EventBanner(props: EventBannerProps) {
	const { event } = props;
	const style = EVENT_BANNER_STYLES[event.eventType];
	const onBeat = event.config.kind === "Music";
	const [time, setTime] = useBinding(0); // seconds since mount
	const [remaining, setRemaining] = useBinding(event.endsAt - event.startsAt);
	const [beat, setBeat] = useBinding({ index: 0, at: -math.huge });

	useEffect(() => {
		const start = os.clock();
		const connection = RunService.Heartbeat.Connect(() => {
			setTime(os.clock() - start);
			setRemaining(math.min(event.endsAt - Workspace.GetServerTimeNow(), event.endsAt - event.startsAt));
		});
		const unsubscribe = props.subscribeBeat((index) => setBeat({ index, at: os.clock() }));
		return () => {
			connection.Disconnect();
			unsubscribe();
		};
	}, [event.startsAt]);

	// 1 right on the beat, back to 0 after BEAT_TIME; without beats, a slow glow
	const pulse = time.map((t) =>
		onBeat
			? math.clamp(1 - (os.clock() - beat.getValue().at) / BEAT_TIME, 0, 1)
			: (GLOW_STRENGTH * (1 - math.cos((t * 2 * math.pi) / GLOW_PERIOD))) / 2,
	);
	const beatColor = onBeat
		? beat.map((b) => style.accents[b.index % style.accents.size()])
		: pulse.map((p) => style.accents[0].Lerp(style.accents[1], p / GLOW_STRENGTH));
	// Fades in at its final size: a scale animation would make its text wobble
	const fadeIn = time.map((t) =>
		TweenService.GetValue(math.min(t / POP_IN_TIME, 1), Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	);

	return (
		<canvasgroup
			key="EventBanner"
			AnchorPoint={new Vector2(1, 0)}
			Position={new UDim2(1, -SIDE_MARGIN + STROKE_ROOM * props.scale, 0, props.top - STROKE_ROOM * props.scale)}
			Size={UDim2.fromOffset(0, 0)}
			AutomaticSize={Enum.AutomaticSize.XY}
			BackgroundTransparency={1}
			GroupTransparency={fadeIn.map((p) => 1 - p)}
			ZIndex={3}
		>
			<uiscale Scale={props.scale} />
			{/* Room for the pulsing border, drawn outside the banner (the group clips to its bounds) */}
			<uipadding
				PaddingTop={new UDim(0, STROKE_ROOM)}
				PaddingBottom={new UDim(0, STROKE_ROOM)}
				PaddingLeft={new UDim(0, STROKE_ROOM)}
				PaddingRight={new UDim(0, STROKE_ROOM)}
			/>
			<frame
				key="Banner"
				Size={UDim2.fromOffset(0, 0)}
				AutomaticSize={Enum.AutomaticSize.XY}
				BackgroundColor3={COLORS.white}
			>
				<uigradient Color={verticalGradient(style.top, style.bottom)} Rotation={90} />
				<uicorner CornerRadius={new UDim(0, 18)} />
				<uistroke
					Color={beatColor}
					Thickness={pulse.map((p) => STROKE_MIN + (STROKE_MAX - STROKE_MIN) * p)}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uipadding
					PaddingTop={new UDim(0, 10)}
					PaddingBottom={new UDim(0, 10)}
					PaddingLeft={new UDim(0, 10)}
					PaddingRight={new UDim(0, 14)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 12)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

				<frame key="Icon" LayoutOrder={1} Size={UDim2.fromOffset(48, 48)} BackgroundColor3={COLORS.white}>
					<uiscale Scale={pulse.map((p) => 1 + ICON_BOUNCE * p)} />
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uigradient Color={verticalGradient(style.accents[0], style.accents[1])} Rotation={90} />
					<uistroke Color={COLORS.white} Thickness={2} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					<textlabel
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={UDim2.fromScale(0.5, 0.5)}
						Size={UDim2.fromScale(0.6, 0.6)}
						BackgroundTransparency={1}
						Text={event.config.icon}
						TextScaled={true}
					/>
				</frame>

				<frame
					key="Texts"
					LayoutOrder={2}
					Size={UDim2.fromOffset(0, 0)}
					AutomaticSize={Enum.AutomaticSize.XY}
					BackgroundTransparency={1}
				>
					<uilistlayout Padding={new UDim(0, 2)} SortOrder={Enum.SortOrder.LayoutOrder} />
					<textlabel
						key="Title"
						LayoutOrder={1}
						Size={UDim2.fromOffset(0, 26)}
						AutomaticSize={Enum.AutomaticSize.X}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text={event.config.displayName.upper()}
						TextSize={24}
						TextColor3={COLORS.white}
						TextXAlignment={Enum.TextXAlignment.Left}
					>
						<TextStroke thickness={2.5} />
					</textlabel>
					<textlabel
						key="Subtitle"
						LayoutOrder={2}
						Size={UDim2.fromOffset(0, 16)}
						AutomaticSize={Enum.AutomaticSize.X}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={event.config.subtitle}
						TextSize={13}
						TextColor3={style.subtitle}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
				</frame>

				<frame
					key="Timer"
					LayoutOrder={3}
					Size={UDim2.fromOffset(0, 30)}
					AutomaticSize={Enum.AutomaticSize.X}
					BackgroundColor3={beatColor}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
					<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />
					<textlabel
						Size={UDim2.fromScale(0, 1)}
						AutomaticSize={Enum.AutomaticSize.X}
						BackgroundTransparency={1}
						Font={FONT_BLACK}
						Text={remaining.map(formatTime)}
						TextSize={19}
						TextColor3={COLORS.white}
					>
						<TextStroke />
					</textlabel>
				</frame>
			</frame>
		</canvasgroup>
	);
}
