import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, UserInputService } from "@rbxts/services";
import { Button3D, Plate, TextStroke } from "./kit";
import { getUiScale, getViewportSize, onViewportChanged } from "./screenScale";
import { FONT_TITLE, NAVY, OUTLINE, PALETTES, V2_IMAGES, verticalGradient } from "./theme";

// Design pixels: the button matches Roblox's own topbar buttons (44 px in a 58 px topbar)
const BUTTON = 44;
const BUTTON_DEPTH = 4;
const TOPBAR_BUTTON_MARGIN = 7; // above and below Roblox's topbar buttons
const RIGHT_MARGIN = 12;
const FALLBACK_TOPBAR = new Rect(0, 0, 0, 58);
// The drop-down under the button
const PANEL_GAP = 8;
const PANEL_WIDTH = 64;
const PANEL_PADDING = 10;
const LABEL_HEIGHT = 22;
const TRACK_WIDTH = 16;
const TRACK_HEIGHT = 140;
const KNOB = 30;
const MUTE_SIZE = new Vector2(44, 36);
const MUTE_DEPTH = 4;
const TRACK_TOP = PANEL_PADDING + LABEL_HEIGHT + 8 + KNOB / 2;
const MUTE_TOP = TRACK_TOP + TRACK_HEIGHT + KNOB / 2 + 10;
const PANEL_HEIGHT = MUTE_TOP + MUTE_SIZE.Y + MUTE_DEPTH + PANEL_PADDING;
/** The drop-down never shrinks below this share of its size (a phone's UI scale is ~0.5: the slider stays easy to drag). */
const MIN_PANEL_SCALE = 0.7;
const SNAP_TO_ZERO = 0.03;
const WHITE = new Color3(1, 1, 1);

export interface SoundControlProps {
	/** The saved volume (PlayerData.soundVolume), read once: afterwards the control owns it. */
	initialVolume: number;
	/** Every change while dragging, to hear it at once (AudioController.setMasterVolume). */
	onChange: (volume: number) => void;
	/** The settled value (released slider, mute toggle), to save it (SetSoundVolume intent). */
	onCommit: (volume: number) => void;
}

interface Placement {
	right: number;
	top: number;
	/** The button's scale: Roblox's topbar height for its 58 px. */
	scale: number;
}

function computePlacement(): Placement {
	const viewport = getViewportSize();
	const inset = GuiService.TopbarInset.Width > 0 ? GuiService.TopbarInset : undefined;
	const bar = inset ?? FALLBACK_TOPBAR;
	const height = bar.Height > 0 ? bar.Height : FALLBACK_TOPBAR.Height;
	const scale = math.clamp((height - TOPBAR_BUTTON_MARGIN * 2) / BUTTON, 0.6, 1.5);
	return {
		right: (inset ? inset.Max.X : viewport.X) - RIGHT_MARGIN * scale,
		top: bar.Min.Y + (height - BUTTON * scale) / 2,
		scale,
	};
}

/** Pixels the control takes from the right end of the topbar's free room: the shop bar keeps clear of them. */
export function getSoundControlRoom(): number {
	const { scale } = computePlacement();
	return (BUTTON + RIGHT_MARGIN) * scale;
}

function usePlacement(): Placement {
	const [placement, setPlacement] = useState(computePlacement);
	useEffect(() => {
		const update = () => setPlacement(computePlacement());
		const connection = GuiService.GetPropertyChangedSignal("TopbarInset").Connect(update);
		const disconnect = onViewportChanged(update);
		return () => {
			connection.Disconnect();
			disconnect();
		};
	}, []);
	return placement;
}

/**
 * Screen position of an input, comparable to AbsolutePosition: both count from under Roblox's topbar inset, even in
 * the ReactUi (IgnoreGuiInset), whose topbar row is at negative AbsolutePosition.Y.
 */
function getInputPosition(input: InputObject): Vector2 {
	return new Vector2(input.Position.X, input.Position.Y);
}

function isPress(input: InputObject): boolean {
	return input.UserInputType === Enum.UserInputType.MouseButton1 || input.UserInputType === Enum.UserInputType.Touch;
}

function isInside(position: Vector2, gui: GuiObject | undefined): boolean {
	if (!gui) return false;
	const min = gui.AbsolutePosition;
	const max = min.add(gui.AbsoluteSize);
	return position.X >= min.X && position.X <= max.X && position.Y >= min.Y && position.Y <= max.Y;
}

/**
 * The sound control, top-right in Roblox's topbar row: a round speaker button (crossed out at 0) that drops down a
 * volume slider (gold fill, white knob, the percentage on top) and a mute toggle. Muting remembers the volume and
 * the toggle brings it back. Purely local: the volume only goes to the server to be saved.
 */
export function SoundControl(props: SoundControlProps) {
	const placement = usePlacement();
	const [volume, setVolume] = useState(props.initialVolume);
	const [open, setOpen] = useState(false);
	const lastHeard = useRef(props.initialVolume > 0 ? props.initialVolume : 1);
	const rootRef = useRef<Frame>();
	const panelRef = useRef<Frame>();
	const trackRef = useRef<Frame>();
	const dragging = useRef(false);
	const volumeRef = useRef(volume);
	volumeRef.current = volume;
	const panelScale = math.min(placement.scale, math.max(getUiScale(1), MIN_PANEL_SCALE)) / placement.scale;

	const change = (value: number) => {
		const snapped = value < SNAP_TO_ZERO ? 0 : math.round(value * 100) / 100;
		if (snapped === volumeRef.current) return;
		volumeRef.current = snapped;
		setVolume(snapped);
		props.onChange(snapped);
	};
	const commit = () => {
		if (volumeRef.current > 0) lastHeard.current = volumeRef.current;
		props.onCommit(volumeRef.current);
	};
	const dragTo = (input: InputObject) => {
		const track = trackRef.current;
		if (!track || track.AbsoluteSize.Y <= 0) return;
		const y = getInputPosition(input).Y;
		change(math.clamp(1 - (y - track.AbsolutePosition.Y) / track.AbsoluteSize.Y, 0, 1));
	};

	// Dragging follows the pointer anywhere on the screen until released; a press outside the control closes it
	useEffect(() => {
		const moved = UserInputService.InputChanged.Connect((input) => {
			if (!dragging.current) return;
			const kind = input.UserInputType;
			if (kind === Enum.UserInputType.MouseMovement || kind === Enum.UserInputType.Touch) dragTo(input);
		});
		const released = UserInputService.InputEnded.Connect((input) => {
			if (!dragging.current || !isPress(input)) return;
			dragging.current = false;
			commit();
		});
		const pressed = UserInputService.InputBegan.Connect((input) => {
			if (!open || !isPress(input)) return;
			const position = getInputPosition(input);
			if (!isInside(position, rootRef.current) && !isInside(position, panelRef.current)) setOpen(false);
		});
		return () => {
			moved.Disconnect();
			released.Disconnect();
			pressed.Disconnect();
		};
	}, [open]);

	const muted = volume <= 0;
	const toggleMute = () => {
		change(muted ? lastHeard.current : 0);
		props.onCommit(volumeRef.current);
	};
	const knobY = TRACK_TOP + (1 - volume) * TRACK_HEIGHT;

	return (
		<frame
			key="SoundControl"
			ref={rootRef}
			AnchorPoint={new Vector2(1, 0)}
			Position={UDim2.fromOffset(placement.right, placement.top)}
			Size={UDim2.fromOffset(BUTTON, BUTTON + BUTTON_DEPTH)}
			BackgroundTransparency={1}
			ZIndex={6} // over the shop bar's tooltips (5), under the menus' Modal (20)
		>
			<uiscale Scale={placement.scale} />
			<Button3D
				palette={open ? PALETTES.lagoon : PALETTES.blue}
				size={UDim2.fromOffset(BUTTON, BUTTON)}
				depth={BUTTON_DEPTH}
				radius={new UDim(0.5, 0)}
				onClick={() => setOpen(!open)}
			>
				<imagelabel
					key="Icon"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.5)}
					Size={UDim2.fromOffset(34, 34)}
					BackgroundTransparency={1}
					Image={muted ? V2_IMAGES.soundOff : V2_IMAGES.soundOn}
					ZIndex={3}
				/>
			</Button3D>
			{open && (
				<frame
					key="Panel"
					ref={panelRef}
					AnchorPoint={new Vector2(0.5, 0)}
					Position={new UDim2(0.5, 0, 1, PANEL_GAP)}
					Size={UDim2.fromOffset(PANEL_WIDTH, PANEL_HEIGHT)}
					BackgroundTransparency={1}
				>
					<uiscale Scale={panelScale} />
					<Plate
						top={NAVY.windowTop}
						bottom={NAVY.windowBottom}
						shadow={NAVY.windowShadow}
						size={UDim2.fromOffset(PANEL_WIDTH, PANEL_HEIGHT - 5)}
						radius={18}
					>
						<textlabel
							key="Percent"
							Position={UDim2.fromOffset(0, PANEL_PADDING)}
							Size={new UDim2(1, 0, 0, LABEL_HEIGHT)}
							BackgroundTransparency={1}
							Font={FONT_TITLE}
							Text={muted ? "OFF" : `${math.round(volume * 100)}`}
							TextSize={20}
							TextColor3={muted ? PALETTES.red.light : WHITE}
							ZIndex={3}
						>
							<TextStroke color={OUTLINE} thickness={2} />
						</textlabel>
						<frame
							key="Track"
							ref={trackRef}
							AnchorPoint={new Vector2(0.5, 0)}
							Position={new UDim2(0.5, 0, 0, TRACK_TOP)}
							Size={UDim2.fromOffset(TRACK_WIDTH, TRACK_HEIGHT)}
							BackgroundColor3={NAVY.track}
							BorderSizePixel={0}
							ZIndex={3}
						>
							<uicorner CornerRadius={new UDim(0.5, 0)} />
							<uistroke Color={OUTLINE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
							<frame
								key="Fill"
								AnchorPoint={new Vector2(0, 1)}
								Position={UDim2.fromScale(0, 1)}
								Size={UDim2.fromScale(1, volume)}
								Visible={volume > 0}
								BackgroundColor3={WHITE}
								BorderSizePixel={0}
								ZIndex={4}
							>
								<uicorner CornerRadius={new UDim(0.5, 0)} />
								<uigradient
									Color={verticalGradient(PALETTES.gold.light, PALETTES.gold.dark)}
									Rotation={90}
								/>
							</frame>
						</frame>
						<frame
							key="Knob"
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={new UDim2(0.5, 0, 0, knobY)}
							Size={UDim2.fromOffset(KNOB, KNOB)}
							BackgroundColor3={WHITE}
							BorderSizePixel={0}
							ZIndex={5}
						>
							<uicorner CornerRadius={new UDim(0.5, 0)} />
							<uigradient Color={verticalGradient(WHITE, Color3.fromHex("#CFE3F5"))} Rotation={90} />
							<uistroke Color={OUTLINE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
						</frame>
						{/* The slider's hit area: the whole column around the track, knob included */}
						<textbutton
							key="SliderHit"
							Position={UDim2.fromOffset(0, TRACK_TOP - KNOB / 2)}
							Size={new UDim2(1, 0, 0, TRACK_HEIGHT + KNOB)}
							BackgroundTransparency={1}
							Text=""
							AutoButtonColor={false}
							ZIndex={6}
							Event={{
								InputBegan: (_, input) => {
									if (!isPress(input)) return;
									dragging.current = true;
									dragTo(input);
								},
							}}
						/>
						<Button3D
							palette={muted ? PALETTES.green : PALETTES.red}
							size={UDim2.fromOffset(MUTE_SIZE.X, MUTE_SIZE.Y)}
							depth={MUTE_DEPTH}
							radius={12}
							anchorPoint={new Vector2(0.5, 0)}
							position={new UDim2(0.5, 0, 0, MUTE_TOP)}
							zIndex={3}
							onClick={toggleMute}
						>
							<imagelabel
								key="Icon"
								AnchorPoint={new Vector2(0.5, 0.5)}
								Position={UDim2.fromScale(0.5, 0.5)}
								Size={UDim2.fromOffset(30, 30)}
								BackgroundTransparency={1}
								Image={muted ? V2_IMAGES.soundOn : V2_IMAGES.soundOff}
								ZIndex={3}
							/>
						</Button3D>
					</Plate>
				</frame>
			)}
		</frame>
	);
}
