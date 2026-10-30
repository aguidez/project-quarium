// UI kit V2 "arcade aquatic" (FigCraft: design/ui/redesign-v2.figcraft, UIKit_V2): the pieces every
// screen is built from. One depth recipe for everything that looks touchable:
//   container (face height + depth) > Shadow (the face's shape, darker, `depth` px lower) + Face (vertical
//   gradient light -> base, 3 px dark outline, white gloss on its top 40 %). Pressed: the face sinks to
//   depth - 2 and its gradient darkens.
import React, { useState } from "@rbxts/react";
import { TextService } from "@rbxts/services";
import { FONT_TITLE, NAVY, OUTLINE, Palette, PALETTES, V2_IMAGES, verticalGradient } from "./theme";

const GLOSS_TRANSPARENCY = 0.7;
const PRESSED_GLOSS_TRANSPARENCY = 0.88;
const HOVER_SCALE = 1.04;
const WHITE = new Color3(1, 1, 1);

type Bindable<T> = T | React.Binding<T>;

/** Dark outline of a text (a UIStroke under a TextLabel strokes the glyphs). */
export function TextStroke(props: { color?: Color3; thickness?: number; transparency?: Bindable<number> }) {
	return (
		<uistroke
			key="TextStroke"
			Color={props.color ?? OUTLINE}
			Thickness={props.thickness ?? 2}
			Transparency={props.transparency}
			LineJoinMode={Enum.LineJoinMode.Round}
		/>
	);
}

/** Border outline of a frame. */
export function Outline(props: { color?: Color3; thickness?: number; transparency?: number }) {
	return (
		<uistroke
			key="Outline"
			Color={props.color ?? OUTLINE}
			Thickness={props.thickness ?? 3}
			Transparency={props.transparency}
			ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			LineJoinMode={Enum.LineJoinMode.Round}
		/>
	);
}

/** White shine over the top of a face. */
function Gloss(props: { radius: UDim; pressed?: boolean }) {
	return (
		<frame
			key="Gloss"
			Position={UDim2.fromOffset(5, 4)}
			Size={new UDim2(1, -10, 0.4, 0)}
			BackgroundColor3={WHITE}
			BackgroundTransparency={props.pressed ? PRESSED_GLOSS_TRANSPARENCY : GLOSS_TRANSPARENCY}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={props.radius} />
		</frame>
	);
}

function toUDim(radius: UDim | number): UDim {
	return typeIs(radius, "number") ? new UDim(0, radius) : radius;
}

/** The face size plus the bevel below it. */
function withDepth(size: UDim2, depth: number): UDim2 {
	return new UDim2(size.X.Scale, size.X.Offset, size.Y.Scale, size.Y.Offset + depth);
}

export interface Button3DProps {
	palette: Palette;
	/** Size of the face; the bevel adds `depth` px below it. */
	size: UDim2;
	position?: Bindable<UDim2>;
	anchorPoint?: Vector2;
	layoutOrder?: number;
	zIndex?: number;
	visible?: boolean;
	depth?: number;
	radius?: UDim | number;
	text?: Bindable<string>;
	textSize?: number;
	textColor?: Color3;
	font?: Enum.Font;
	/** Shown but not clickable: no press, no hover. */
	disabled?: boolean;
	onClick?: () => void;
	onHover?: (hovered: boolean) => void;
	/** Drawn on the face, over its gloss (icons, extra labels). */
	children?: React.ReactNode;
	/** Drawn on the container, outside the face (badges, halos, bubbles). */
	overlay?: React.ReactNode;
}

/** Pressable pseudo-3D button (FigCraft: ActionBtn / ActionBtn_Pressed). */
export function Button3D(props: Button3DProps) {
	const [pressed, setPressed] = useState(false);
	const [hovered, setHovered] = useState(false);
	const depth = props.depth ?? 6;
	const radius = toUDim(props.radius ?? 14);
	const glossRadius = new UDim(radius.Scale, math.max(radius.Offset - 4, 2));
	const palette = props.palette;
	const down = pressed && !props.disabled;
	const hover = (value: boolean) => {
		setHovered(value);
		if (!value) setPressed(false);
		props.onHover?.(value);
	};

	return (
		<frame
			LayoutOrder={props.layoutOrder}
			Position={props.position}
			AnchorPoint={props.anchorPoint}
			Size={withDepth(props.size, depth)}
			BackgroundTransparency={1}
			ZIndex={props.zIndex}
			Visible={props.visible}
		>
			<uiscale Scale={hovered && !props.disabled ? HOVER_SCALE : 1} />
			<frame
				key="Shadow"
				Position={UDim2.fromOffset(0, depth)}
				Size={new UDim2(1, 0, 1, -depth)}
				BackgroundColor3={palette.shadow}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={radius} />
				<Outline />
			</frame>
			<textbutton
				key="Face"
				Position={UDim2.fromOffset(0, down ? depth - 2 : 0)}
				Size={new UDim2(1, 0, 1, -depth)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
				Text=""
				AutoButtonColor={false}
				Active={!props.disabled}
				ZIndex={2}
				Event={{
					Activated: () => {
						if (!props.disabled) props.onClick?.();
					},
					MouseButton1Down: () => setPressed(true),
					MouseButton1Up: () => setPressed(false),
					MouseEnter: () => hover(true),
					MouseLeave: () => hover(false),
				}}
			>
				<uicorner CornerRadius={radius} />
				<uigradient
					Color={
						down
							? verticalGradient(palette.base, palette.dark)
							: verticalGradient(palette.light, palette.base)
					}
					Rotation={90}
				/>
				<Outline />
				<Gloss radius={glossRadius} pressed={down} />
				{props.text !== undefined && (
					<textlabel
						key="Label"
						Position={UDim2.fromOffset(4, 1)}
						Size={new UDim2(1, -8, 1, 0)}
						BackgroundTransparency={1}
						Font={props.font ?? FONT_TITLE}
						Text={props.text}
						TextSize={props.textSize ?? 22}
						TextColor3={props.textColor ?? WHITE}
						ZIndex={3}
					>
						<TextStroke color={palette.shadow} thickness={2.5} />
					</textlabel>
				)}
				{props.children}
			</textbutton>
			{props.overlay}
		</frame>
	);
}

export interface PlateProps {
	/** Gradient of the face, top then bottom, and the colour of its bevel. */
	top: Color3;
	bottom: Color3;
	shadow: Color3;
	size: UDim2;
	/** Grow the plate with its content (the face's height comes from its children). */
	autoHeight?: boolean;
	position?: Bindable<UDim2>;
	anchorPoint?: Vector2;
	layoutOrder?: number;
	zIndex?: number;
	depth?: number;
	radius?: UDim | number;
	outline?: Color3;
	outlineThickness?: number;
	gloss?: boolean;
	children?: React.ReactNode;
	/** Drawn on the container, outside the face. */
	overlay?: React.ReactNode;
}

/**
 * Non-clickable relief surface (money counter, cards, bubbles): the button's recipe without the press.
 * With `autoHeight`, the face sizes to its children and the bevel follows (scale-sized siblings don't
 * feed a frame's AutomaticSize).
 */
export function Plate(props: PlateProps) {
	const depth = props.depth ?? 5;
	const radius = toUDim(props.radius ?? 18);
	const auto = props.autoHeight === true;
	return (
		<frame
			LayoutOrder={props.layoutOrder}
			Position={props.position}
			AnchorPoint={props.anchorPoint}
			Size={auto ? props.size : withDepth(props.size, depth)}
			AutomaticSize={auto ? Enum.AutomaticSize.Y : undefined}
			BackgroundTransparency={1}
			ZIndex={props.zIndex}
		>
			{auto && <uipadding key="DepthRoom" PaddingBottom={new UDim(0, depth)} />}
			<frame
				key="Shadow"
				Position={UDim2.fromOffset(0, depth)}
				Size={auto ? UDim2.fromScale(1, 1) : new UDim2(1, 0, 1, -depth)}
				BackgroundColor3={props.shadow}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={radius} />
				<Outline />
			</frame>
			<frame
				key="Face"
				Size={auto ? UDim2.fromScale(1, 0) : new UDim2(1, 0, 1, -depth)}
				AutomaticSize={auto ? Enum.AutomaticSize.Y : undefined}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
				ZIndex={2}
			>
				<uicorner CornerRadius={radius} />
				<uigradient Color={verticalGradient(props.top, props.bottom)} Rotation={90} />
				<Outline color={props.outline} thickness={props.outlineThickness} />
				{props.gloss && <Gloss radius={new UDim(radius.Scale, math.max(radius.Offset - 4, 2))} />}
				{props.children}
			</frame>
			{props.overlay}
		</frame>
	);
}

/** Navy card of the panels (FigCraft: QuestCard / SpeciesRow), growing with its content. */
export function Card(props: {
	layoutOrder?: number;
	size?: UDim2;
	/** Outline colour: gold for a card that wants attention (a quest to claim). */
	highlight?: Color3;
	transparency?: number;
	children?: React.ReactNode;
	overlay?: React.ReactNode;
}) {
	return (
		<Plate
			layoutOrder={props.layoutOrder}
			size={props.size ?? UDim2.fromScale(1, 0)}
			autoHeight={true}
			top={NAVY.cardTop}
			bottom={NAVY.cardBottom}
			shadow={NAVY.cardShadow}
			outline={props.highlight}
			radius={18}
			overlay={props.overlay}
		>
			{props.children}
		</Plate>
	);
}

/** Red round close button with an "X" (FigCraft: CloseButton). */
export function CloseButton(props: { position: UDim2; anchorPoint?: Vector2; zIndex?: number; onClick: () => void }) {
	return (
		<Button3D
			palette={PALETTES.red}
			size={UDim2.fromOffset(50, 50)}
			radius={new UDim(0.5, 0)}
			depth={5}
			position={props.position}
			anchorPoint={props.anchorPoint}
			zIndex={props.zIndex}
			text="X"
			textSize={28}
			onClick={props.onClick}
		/>
	);
}

const BANNER_BAND_HEIGHT = 58;
const BANNER_TAIL = new Vector2(64, 56);
const BANNER_BAND_INSET = 34; // the band starts this far in, over the tails
export const BANNER_HEIGHT = 18 + BANNER_TAIL.Y;
const BANNER_TEXT_SIZE = 34;

/** Ribbon title overhanging a window's top edge (FigCraft: HeaderBanner): a band over two notched tails. */
export function HeaderBanner(props: { title: string; palette: Palette; position: UDim2; zIndex?: number }) {
	const textWidth = TextService.GetTextSize(props.title, BANNER_TEXT_SIZE, FONT_TITLE, new Vector2(1000, 100)).X;
	const width = math.max(textWidth + 2 * BANNER_BAND_INSET + 80, 260);
	const palette = props.palette;
	const tail = (key: string, image: string, x: UDim) => (
		<imagelabel
			key={key}
			Position={new UDim2(x, new UDim(0, 18))}
			Size={UDim2.fromOffset(BANNER_TAIL.X, BANNER_TAIL.Y)}
			BackgroundTransparency={1}
			Image={image}
		>
			<uigradient Color={verticalGradient(palette.base, palette.dark)} Rotation={90} />
		</imagelabel>
	);
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 0)}
			Position={props.position}
			Size={UDim2.fromOffset(width, BANNER_HEIGHT)}
			BackgroundTransparency={1}
			ZIndex={props.zIndex}
		>
			{tail("TailLeft", V2_IMAGES.ribbonTailLeft, new UDim(0, 0))}
			{tail("TailRight", V2_IMAGES.ribbonTailRight, new UDim(1, -BANNER_TAIL.X))}
			<frame
				key="Band"
				Position={UDim2.fromOffset(BANNER_BAND_INSET, 0)}
				Size={new UDim2(1, -2 * BANNER_BAND_INSET, 0, BANNER_BAND_HEIGHT)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
				ZIndex={2}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uigradient Color={verticalGradient(palette.light, palette.base)} Rotation={90} />
				<Outline thickness={4} />
				<Gloss radius={new UDim(0, 10)} />
				<textlabel
					key="Title"
					Position={UDim2.fromOffset(0, 2)}
					Size={UDim2.fromScale(1, 1)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={props.title}
					TextSize={BANNER_TEXT_SIZE}
					TextColor3={WHITE}
					ZIndex={3}
				>
					<TextStroke color={palette.shadow} thickness={3} />
				</textlabel>
			</frame>
		</frame>
	);
}

/** Gauge with a stroked count over it (FigCraft: ProgressBar). */
export function ProgressBar(props: {
	ratio: Bindable<number>;
	palette: Palette;
	text?: Bindable<string>;
	size: UDim2;
	layoutOrder?: number;
	position?: UDim2;
	textSize?: number;
}) {
	const fill = (ratio: number) => UDim2.fromScale(math.clamp(ratio, 0, 1), 1);
	const ratio = props.ratio;
	return (
		<frame
			LayoutOrder={props.layoutOrder}
			Position={props.position}
			Size={props.size}
			BackgroundColor3={NAVY.track}
			BorderSizePixel={0}
			ClipsDescendants={true}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<Outline />
			<frame
				key="Fill"
				Size={typeIs(ratio, "number") ? fill(ratio) : ratio.map(fill)}
				Visible={typeIs(ratio, "number") ? ratio > 0 : ratio.map((value) => value > 0)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<uigradient Color={verticalGradient(props.palette.light, props.palette.base)} Rotation={90} />
				<frame
					key="Shine"
					Position={UDim2.fromOffset(5, 3)}
					Size={new UDim2(1, -10, 0.3, 0)}
					BackgroundColor3={WHITE}
					BackgroundTransparency={0.6}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
				</frame>
			</frame>
			{props.text !== undefined && (
				<textlabel
					key="Count"
					Size={UDim2.fromScale(1, 1)}
					BackgroundTransparency={1}
					Font={Enum.Font.FredokaOne}
					Text={props.text}
					TextSize={props.textSize ?? 15}
					TextColor3={WHITE}
					ZIndex={2}
				>
					<TextStroke />
				</textlabel>
			)}
		</frame>
	);
}

/** Small outlined pill (rarity, story line, reward name). Without `width`, it hugs its text. */
export function Chip(props: {
	text: string;
	color: Color3;
	height: number;
	width?: number;
	textColor?: Color3;
	textStroke?: Color3;
	font?: Enum.Font;
	textSize?: number;
	layoutOrder?: number;
	position?: UDim2;
	anchorPoint?: Vector2;
	zIndex?: number;
}) {
	const hug = props.width === undefined;
	return (
		<frame
			LayoutOrder={props.layoutOrder}
			Position={props.position}
			AnchorPoint={props.anchorPoint}
			Size={UDim2.fromOffset(props.width ?? 0, props.height)}
			AutomaticSize={hug ? Enum.AutomaticSize.X : undefined}
			BackgroundColor3={props.color}
			BorderSizePixel={0}
			ZIndex={props.zIndex}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<Outline thickness={2.5} />
			{hug && <uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />}
			<textlabel
				Size={hug ? UDim2.fromScale(0, 1) : UDim2.fromScale(1, 1)}
				AutomaticSize={hug ? Enum.AutomaticSize.X : undefined}
				BackgroundTransparency={1}
				Font={props.font ?? Enum.Font.FredokaOne}
				Text={props.text}
				TextSize={props.textSize ?? math.floor(props.height * 0.6)}
				TextColor3={props.textColor ?? OUTLINE}
				ZIndex={props.zIndex}
			>
				{props.textStroke && <TextStroke color={props.textStroke} />}
			</textlabel>
		</frame>
	);
}

/** Gold coin drawn with frames (FigCraft: CoinIcon). */
export function CoinIcon(props: {
	size: number;
	position?: UDim2;
	anchorPoint?: Vector2;
	layoutOrder?: number;
	zIndex?: number;
}) {
	const s = props.size;
	return (
		<frame
			LayoutOrder={props.layoutOrder}
			Position={props.position}
			AnchorPoint={props.anchorPoint}
			Size={UDim2.fromOffset(s, s)}
			BackgroundColor3={WHITE}
			BorderSizePixel={0}
			ZIndex={props.zIndex}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uigradient Color={verticalGradient(Color3.fromHex("#FFE680"), Color3.fromHex("#E89A00"))} Rotation={90} />
			<Outline thickness={math.max(s * 0.06, 1.5)} />
			<frame
				key="Inner"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={UDim2.fromScale(0.5, 0.5)}
				Size={UDim2.fromScale(0.66, 0.66)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
				ZIndex={props.zIndex}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<uigradient
					Color={verticalGradient(Color3.fromHex("#FFF4B0"), Color3.fromHex("#FFC21A"))}
					Rotation={90}
				/>
				<uistroke Color={Color3.fromHex("#C27C00")} Thickness={math.max(s * 0.04, 1)} />
				<textlabel
					key="Symbol"
					Position={UDim2.fromScale(0, 0.06)}
					Size={UDim2.fromScale(1, 1)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text="$"
					TextSize={math.floor(s * 0.46)}
					TextColor3={Color3.fromHex("#B86E00")}
					ZIndex={props.zIndex}
				/>
			</frame>
			<frame
				key="Shine"
				Position={UDim2.fromScale(0.24, 0.16)}
				Size={UDim2.fromScale(0.22, 0.12)}
				BackgroundColor3={WHITE}
				BackgroundTransparency={0.25}
				BorderSizePixel={0}
				ZIndex={props.zIndex}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
			</frame>
		</frame>
	);
}

/** Red notification dot (FigCraft: NotifBadge). */
export function NotifBadge(props: { text?: string; size?: number; position: UDim2; zIndex?: number }) {
	const s = props.size ?? 28;
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={props.position}
			Size={UDim2.fromOffset(s, s)}
			BackgroundColor3={WHITE}
			BorderSizePixel={0}
			ZIndex={props.zIndex ?? 5}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uigradient Color={verticalGradient(PALETTES.red.light, PALETTES.red.base)} Rotation={90} />
			<Outline />
			<textlabel
				Position={UDim2.fromOffset(0, 1)}
				Size={UDim2.fromScale(1, 1)}
				BackgroundTransparency={1}
				Font={FONT_TITLE}
				Text={props.text ?? "!"}
				TextSize={math.floor(s * 0.62)}
				TextColor3={WHITE}
				ZIndex={props.zIndex ?? 5}
			>
				<TextStroke color={PALETTES.red.shadow} />
			</textlabel>
		</frame>
	);
}

/** 4-point star (shiny things, ready eggs). */
export function Sparkle(props: {
	size: number;
	position: Bindable<UDim2>;
	color?: Color3;
	rotation?: Bindable<number>;
	zIndex?: number;
}) {
	return (
		<imagelabel
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={props.position}
			Size={UDim2.fromOffset(props.size, props.size)}
			BackgroundTransparency={1}
			Image={V2_IMAGES.sparkle}
			ImageColor3={props.color ?? WHITE}
			Rotation={props.rotation}
			ZIndex={props.zIndex ?? 4}
		/>
	);
}

/** Soft radial light behind an icon. */
export function SoftGlow(props: {
	size: UDim2;
	position?: UDim2;
	color?: Color3;
	transparency?: Bindable<number>;
	zIndex?: number;
}) {
	return (
		<imagelabel
			key="Glow"
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={props.position ?? UDim2.fromScale(0.5, 0.5)}
			Size={props.size}
			BackgroundTransparency={1}
			Image={V2_IMAGES.softGlow}
			ImageColor3={props.color ?? WHITE}
			ImageTransparency={props.transparency ?? 0.3}
			ZIndex={props.zIndex}
		/>
	);
}

export interface ItemSlotProps {
	size: number;
	/** Face colours of a found item; a missing one is navy with a "?". */
	palette?: Palette;
	missing?: boolean;
	image?: string;
	/** Image size relative to the slot (sticker icons are 1.6:1). */
	imageScale?: Vector2;
	/** Missing: the image shows as a dark silhouette under the "?". */
	silhouette?: boolean;
	shiny?: boolean;
	layoutOrder?: number;
	position?: UDim2;
	anchorPoint?: Vector2;
	zIndex?: number;
	onHover?: (hovered: boolean) => void;
	children?: React.ReactNode;
}

const SILHOUETTE_COLOR = Color3.fromHex("#05121A");

/** Square collection slot (FigCraft: ItemSlot_<Variant> / ItemSlot_Missing). */
export function ItemSlot(props: ItemSlotProps) {
	const s = props.size;
	const depth = 4;
	const missing = props.missing === true;
	const palette = missing ? PALETTES.navy : (props.palette ?? PALETTES.blue);
	const imageScale = props.imageScale ?? new Vector2(0.9, 0.9 / 1.6);
	return (
		<frame
			LayoutOrder={props.layoutOrder}
			Position={props.position}
			AnchorPoint={props.anchorPoint}
			Size={UDim2.fromOffset(s, s + depth)}
			BackgroundTransparency={1}
			ZIndex={props.zIndex}
			Event={{
				MouseEnter: () => props.onHover?.(true),
				MouseLeave: () => props.onHover?.(false),
			}}
		>
			<frame
				key="Shadow"
				Position={UDim2.fromOffset(0, depth)}
				Size={UDim2.fromOffset(s, s)}
				BackgroundColor3={palette.shadow}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 16)} />
				<Outline />
			</frame>
			<frame key="Face" Size={UDim2.fromOffset(s, s)} BackgroundColor3={WHITE} BorderSizePixel={0} ZIndex={2}>
				<uicorner CornerRadius={new UDim(0, 16)} />
				<uigradient
					Color={
						missing
							? verticalGradient(NAVY.missingTop, NAVY.missingBottom)
							: verticalGradient(palette.light, palette.base)
					}
					Rotation={90}
				/>
				<Outline />
				{!missing && <SoftGlow size={UDim2.fromScale(0.9, 0.85)} zIndex={2} />}
				<frame
					key="Gloss"
					Position={UDim2.fromOffset(5, 4)}
					Size={new UDim2(1, -10, 0.3, 0)}
					BackgroundColor3={WHITE}
					BackgroundTransparency={missing ? 0.92 : 0.72}
					BorderSizePixel={0}
					ZIndex={2}
				>
					<uicorner CornerRadius={new UDim(0, 12)} />
				</frame>
				{props.image !== undefined && (!missing || props.silhouette) && (
					<imagelabel
						key="Icon"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={UDim2.fromScale(0.5, 0.5)}
						Size={UDim2.fromScale(imageScale.X, imageScale.Y)}
						BackgroundTransparency={1}
						Image={props.image}
						ImageColor3={missing ? SILHOUETTE_COLOR : WHITE}
						ImageTransparency={missing ? 0.35 : 0}
						ScaleType={Enum.ScaleType.Fit}
						ZIndex={3}
					/>
				)}
				{missing && (
					<textlabel
						key="Unknown"
						Position={UDim2.fromOffset(0, 2)}
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text="?"
						TextSize={math.floor(s * 0.42)}
						TextColor3={Color3.fromHex("#CFE3F7")}
						ZIndex={4}
					>
						<TextStroke thickness={2.5} />
					</textlabel>
				)}
				{props.shiny && (
					<>
						<Sparkle key="Sparkle1" size={math.floor(s * 0.22)} position={UDim2.fromScale(0.2, 0.24)} />
						<Sparkle
							key="Sparkle2"
							size={math.floor(s * 0.17)}
							position={UDim2.fromScale(0.82, 0.72)}
							color={PALETTES.gold.light}
						/>
						<Sparkle key="Sparkle3" size={math.floor(s * 0.11)} position={UDim2.fromScale(0.8, 0.2)} />
					</>
				)}
				{props.children}
			</frame>
		</frame>
	);
}
