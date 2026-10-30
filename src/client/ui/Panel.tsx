import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService, TextService, TweenService, Workspace } from "@rbxts/services";
import { BANNER_HEIGHT, CloseButton, HeaderBanner } from "./kit";
import { NAVY, Palette, PALETTES, verticalGradient } from "./theme";

export const PANEL_WIDTH = 600;
export const PANEL_PADDING = 22;
/** Room for content inside the panel's padding. */
export const PANEL_INNER_WIDTH = PANEL_WIDTH - PANEL_PADDING * 2;
const POP_IN_TIME = 0.2;
// Room the canvas group keeps around the window (it clips to its bounds): the banner overhangs the top,
// the close button the top-right corner, the bevel the bottom
const BANNER_OVERHANG = 36;
const ROOM_TOP = BANNER_OVERHANG + 4;
const ROOM_SIDE = 8;
const ROOM_RIGHT = 26;
const WINDOW_DEPTH = 10;
const ROOM_BOTTOM = WINDOW_DEPTH + 6;
/** The content starts below the part of the banner that hangs inside the window. */
const CONTENT_TOP = BANNER_HEIGHT - BANNER_OVERHANG + 14;
const WHITE = new Color3(1, 1, 1);
/** Decorative bubbles in the window's bottom corners: [x from the right or left, y from the bottom, size]. */
const BUBBLES: [number, number, number][] = [
	[-96, -120, 64],
	[-46, -58, 26],
	[26, -64, 34],
	[-150, -44, 18],
];
const BACKDROP_TRANSPARENCY = 0.5;
const REFERENCE_HEIGHT = 1080;

export interface PanelProps {
	title: string;
	/** First row of the content, centred under the banner (e.g. a counter chip). */
	headerExtra?: React.ReactNode;
	/** Window width in design pixels (PANEL_WIDTH by default). */
	width?: number;
	/** Colour of the title ribbon (gold by default). */
	banner?: Palette;
	onClose: () => void;
	children?: React.ReactNode;
}

function getScreenScale(): number {
	const viewport = Workspace.CurrentCamera?.ViewportSize;
	return viewport ? math.clamp(viewport.Y / REFERENCE_HEIGHT, 0.6, 1.4) : 1;
}

/**
 * Height of `text` wrapped at `width` design pixels. Wrapped text inside a panel gets this fixed
 * height rather than AutomaticSize: under a UIScale, the line breaks of a text close to a line's end
 * depend on the scale's rounding, and the whole panel would change height with them.
 */
export function getWrappedHeight(text: string, textSize: number, font: Enum.Font, width: number): number {
	return math.ceil(TextService.GetTextSize(text, textSize, font, new Vector2(width, math.huge)).Y) + 2;
}

export { formatNumber, formatShort } from "shared/format";

/**
 * Centered modal window shared by every menu (FigCraft redesign-v2: MainModal): dimmed backdrop (clicking
 * it closes), navy window with a dark bevel, a ribbon title overhanging its top edge and a round close
 * button on its corner, then the content stacked vertically.
 */
export function Panel(props: PanelProps) {
	const [time, setTime] = useBinding(0);
	useEffect(() => {
		const start = os.clock();
		const connection = RunService.Heartbeat.Connect(() => {
			const elapsed = os.clock() - start;
			setTime(elapsed);
			if (elapsed >= POP_IN_TIME) connection.Disconnect();
		});
		return () => connection.Disconnect();
	}, []);
	// Fades in without changing size: a scale animation re-renders the text at every step and it wobbles
	const fadeIn = time.map((t) =>
		TweenService.GetValue(math.min(t / POP_IN_TIME, 1), Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	);
	const width = props.width ?? PANEL_WIDTH;

	return (
		<frame key="Modal" Size={UDim2.fromScale(1, 1)} BackgroundTransparency={1} ZIndex={20}>
			<textbutton
				key="Backdrop"
				Size={UDim2.fromScale(1, 1)}
				BackgroundColor3={new Color3(0, 0, 0)}
				BackgroundTransparency={fadeIn.map((p) => 1 - (1 - BACKDROP_TRANSPARENCY) * p)}
				BorderSizePixel={0}
				Text=""
				AutoButtonColor={false}
				Event={{ Activated: () => props.onClose() }}
			/>
			<canvasgroup
				key="Panel"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={UDim2.fromScale(0.5, 0.5)}
				Size={UDim2.fromOffset(0, 0)}
				AutomaticSize={Enum.AutomaticSize.XY}
				BackgroundTransparency={1}
				GroupTransparency={fadeIn.map((p) => 1 - p)}
				ZIndex={2}
			>
				<uiscale Scale={getScreenScale()} />
				<uipadding
					PaddingTop={new UDim(0, ROOM_TOP)}
					PaddingBottom={new UDim(0, ROOM_BOTTOM)}
					PaddingLeft={new UDim(0, ROOM_SIDE)}
					PaddingRight={new UDim(0, ROOM_RIGHT)}
				/>
				<frame
					key="Window"
					Size={UDim2.fromOffset(width, 0)}
					AutomaticSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
				>
					{/* Scale-sized: it follows the body without feeding the window's automatic size */}
					<frame
						key="Shadow"
						Position={UDim2.fromOffset(0, WINDOW_DEPTH)}
						Size={UDim2.fromScale(1, 1)}
						BackgroundColor3={NAVY.windowShadow}
						BorderSizePixel={0}
					>
						<uicorner CornerRadius={new UDim(0, 30)} />
					</frame>
					{/* A button (doing nothing) rather than a frame: clicks on the panel must not reach the backdrop */}
					<textbutton
						key="Body"
						Size={UDim2.fromScale(1, 0)}
						AutomaticSize={Enum.AutomaticSize.Y}
						BackgroundColor3={WHITE}
						BorderSizePixel={0}
						Text=""
						AutoButtonColor={false}
						ZIndex={2}
					>
						<uigradient Color={verticalGradient(NAVY.windowTop, NAVY.windowBottom)} Rotation={90} />
						<uicorner CornerRadius={new UDim(0, 30)} />
						<uistroke
							Color={Color3.fromHex("#071320")}
							Thickness={4}
							ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
						/>
						<frame
							key="InnerRim"
							Position={UDim2.fromOffset(7, 7)}
							Size={new UDim2(1, -14, 1, -14)}
							BackgroundTransparency={1}
						>
							<uicorner CornerRadius={new UDim(0, 24)} />
							<uistroke Color={WHITE} Transparency={0.85} Thickness={2} />
						</frame>
						{BUBBLES.map(([x, y, size], index) => (
							<frame
								key={`Bubble${index + 1}`}
								Position={new UDim2(x < 0 ? 1 : 0, x, 1, y)}
								Size={UDim2.fromOffset(size, size)}
								BackgroundColor3={WHITE}
								BackgroundTransparency={0.95}
								BorderSizePixel={0}
							>
								<uicorner CornerRadius={new UDim(0.5, 0)} />
								<uistroke Color={WHITE} Transparency={0.86} Thickness={2} />
							</frame>
						))}
						<frame
							key="Content"
							Size={UDim2.fromScale(1, 0)}
							AutomaticSize={Enum.AutomaticSize.Y}
							BackgroundTransparency={1}
							ZIndex={2}
						>
							<uipadding
								PaddingTop={new UDim(0, CONTENT_TOP)}
								PaddingBottom={new UDim(0, PANEL_PADDING)}
								PaddingLeft={new UDim(0, PANEL_PADDING)}
								PaddingRight={new UDim(0, PANEL_PADDING)}
							/>
							<uilistlayout
								Padding={new UDim(0, 14)}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{props.headerExtra !== undefined && (
								<frame
									key="Header"
									LayoutOrder={-1}
									Size={UDim2.fromOffset(0, 0)}
									AutomaticSize={Enum.AutomaticSize.XY}
									BackgroundTransparency={1}
								>
									{props.headerExtra}
								</frame>
							)}
							{props.children}
						</frame>
					</textbutton>
					<HeaderBanner
						key="Banner"
						title={props.title}
						palette={props.banner ?? PALETTES.gold}
						position={new UDim2(0.5, 0, 0, -BANNER_OVERHANG)}
						zIndex={3}
					/>
					<CloseButton
						key="Close"
						position={new UDim2(1, -30, 0, -16)}
						zIndex={4}
						onClick={() => props.onClose()}
					/>
				</frame>
			</canvasgroup>
		</frame>
	);
}
