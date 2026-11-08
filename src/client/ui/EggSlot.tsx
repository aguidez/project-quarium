import React, { useBinding, useEffect, useState } from "@rbxts/react";
import { RunService, Workspace } from "@rbxts/services";
import { EggOdds } from "shared/types/eggs";
import { FISH_TYPES } from "shared/types/fish";
import { Button3D, Chip, CoinIcon, Outline, Plate, SoftGlow, Sparkle, TextStroke } from "./kit";
import {
	EGG_CRACKS,
	FONT_BOLD,
	FONT_TITLE,
	GATE_ICON,
	getFishRarity,
	NAVY,
	Palette,
	PALETTES,
	SlotState,
} from "./theme";

const FACE_SIZE = 84;
const DEPTH = 6;
const TAG_HEIGHT = 26;
const TAG_TOP = 70; // the price tag hangs over the face's bottom edge
/** Room a slot takes in the bar: its face, bevel and the tag below. */
export const SLOT_SIZE = new Vector2(FACE_SIZE, TAG_TOP + TAG_HEIGHT + 4);
const WOBBLE_TIME = 1; // the egg wobbles during its last second of incubation
const TOOLTIP_WIDTH = 190;
const HIGHLIGHT_PULSE_SPEED = 5; // radians per second of the highlight ring
const READY_SHAKE_PERIOD = 1.4; // a ready egg shakes for READY_SHAKE_TIME every READY_SHAKE_PERIOD seconds
const READY_SHAKE_TIME = 0.45;
const WHITE = new Color3(1, 1, 1);
const PRICE_COLOR = Color3.fromHex("#FFD233");
const PRICE_TOO_HIGH = Color3.fromHex("#FF8A8A");

/** Face colours per state (FigCraft redesign-v2: EggSlot_*): green buyable, grey too expensive, amber hatching, gold ready. */
const STATE_PALETTES: Record<SlotState, Palette> = {
	buyable: PALETTES.green,
	unaffordable: PALETTES.grey,
	hatching: PALETTES.amber,
	ready: PALETTES.gold,
	locked: PALETTES.navy,
};

export interface EggSlotProps {
	layoutOrder: number;
	/** Egg icon; undefined renders a locked "coming soon" slot. */
	icon?: string;
	name?: string;
	priceText?: string;
	/** The player can pay the current price (a free egg is always affordable). */
	affordable?: boolean;
	odds?: readonly EggOdds[];
	/** While eggs of this type incubate: when the soonest one hatches (server time) and the egg's total hatch time. */
	hatchAt?: number;
	hatchTime?: number;
	/** Eggs of this type incubating or ready, out of `incubators` (the chip shows "1/2" once there are several). */
	eggCount?: number;
	incubators?: number;
	/** Egg not unlocked yet: a closed gate replaces it, with this hint on hover (e.g. "Buy a Common Egg to unlock"). */
	gatedHint?: string;
	/** Shown but not buyable yet (onboarding before the 2.5D view). */
	disabled?: boolean;
	/** Onboarding: pulsing ring and a hand pointing at the slot. */
	highlight?: boolean;
	onBuy?: () => void;
	/**
	 * With eggs already in the slot and an incubator free: a small gold "+" on the slot buys one more (the slot
	 * itself opens the ready egg). FigCraft redesign-v2: ShopBar_V1.
	 */
	canBuyAnother?: boolean;
	/** Opens the incubated egg once it is ready (eggs never open by themselves). */
	onOpen?: () => void;
	/** The aquarium has no room for another fish: a ready egg can't be opened (the server refuses it too). */
	aquariumFull?: boolean;
	/**
	 * The Hermit Crab owned and an egg in the slot: the share (0..1) of the soonest egg's incubation spent with it so
	 * far (playerData getCrabShare), read every frame; its mark shows once above 0 (ROADMAP_V1.2 §8).
	 */
	crabShare?: () => number;
	/** The crab's sticker for that mark. */
	crabImage?: string;
}

/**
 * Seconds left before the egg is ready to open, updated every frame while it incubates, and
 * whether it is ready (a state, so the slot re-renders into its "open me" look).
 */
function useHatchCountdown(hatchAt?: number): [React.Binding<number>, boolean] {
	const [remaining, setRemaining] = useBinding(0);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		if (hatchAt === undefined) {
			setReady(false);
			return;
		}
		const update = () => {
			const seconds = math.max(hatchAt - Workspace.GetServerTimeNow(), 0);
			setRemaining(seconds);
			setReady(seconds <= 0);
		};
		update();
		const connection = RunService.Heartbeat.Connect(update);
		return () => connection.Disconnect();
	}, [hatchAt]);
	return [remaining, ready];
}

/** Seconds since the highlight started, updated every frame while the slot is highlighted. */
function useHighlightClock(highlight?: boolean): React.Binding<number> {
	const [clock, setClock] = useBinding(0);
	useEffect(() => {
		if (!highlight) return;
		const start = os.clock();
		const connection = RunService.Heartbeat.Connect(() => setClock(os.clock() - start));
		return () => connection.Disconnect();
	}, [highlight]);
	return clock;
}

/** Navy hover card hanging below a slot. */
function Tooltip(props: { children: React.ReactNode }) {
	return (
		<frame
			key="Tooltip"
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 1, 10)}
			Size={UDim2.fromOffset(TOOLTIP_WIDTH, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={NAVY.windowBottom}
			BorderSizePixel={0}
			ZIndex={10}
		>
			<uicorner CornerRadius={new UDim(0, 14)} />
			<Outline color={PALETTES.gold.base} />
			<uipadding
				PaddingTop={new UDim(0, 8)}
				PaddingBottom={new UDim(0, 10)}
				PaddingLeft={new UDim(0, 12)}
				PaddingRight={new UDim(0, 12)}
			/>
			<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{props.children}
		</frame>
	);
}

/** Hover panel of a gated egg: what unlocks it. */
function GateTooltip(props: { hint: string }) {
	return (
		<Tooltip>
			<textlabel
				Size={UDim2.fromScale(1, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={props.hint}
				TextSize={15}
				TextColor3={WHITE}
				TextWrapped={true}
				ZIndex={10}
			/>
		</Tooltip>
	);
}

/** Hover panel listing what the egg can hatch into, with the odds. */
function OddsTooltip(props: { name: string; odds: readonly EggOdds[] }) {
	const rows = props.odds.map((entry, index) => {
		const rarity = getFishRarity(entry.fishType);
		return (
			<frame
				key={entry.fishType}
				LayoutOrder={index + 1}
				Size={new UDim2(1, 0, 0, 20)}
				BackgroundTransparency={1}
			>
				<textlabel
					Size={UDim2.fromScale(1, 1)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={FISH_TYPES[entry.fishType].displayName}
					TextSize={15}
					TextColor3={WHITE}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={10}
				/>
				<textlabel
					Size={UDim2.fromScale(1, 1)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={`${entry.chance}%`}
					TextSize={15}
					TextColor3={rarity.color}
					TextXAlignment={Enum.TextXAlignment.Right}
					ZIndex={10}
				>
					<TextStroke />
				</textlabel>
			</frame>
		);
	});

	return (
		<Tooltip>
			<textlabel
				key="Title"
				LayoutOrder={0}
				Size={new UDim2(1, 0, 0, 24)}
				BackgroundTransparency={1}
				Font={FONT_TITLE}
				Text={props.name}
				TextSize={19}
				TextColor3={PRICE_COLOR}
				ZIndex={10}
			>
				<TextStroke />
			</textlabel>
			{rows}
		</Tooltip>
	);
}

/**
 * The Hermit Crab's mark on the slot's left edge: its sticker and how much of the soonest egg's incubation it was
 * there for ("62%"), live; hidden while that share is 0.
 */
function CrabMark(props: { share: () => number; image: string }) {
	const [share, setShare] = useBinding(0);
	useEffect(() => {
		const update = () => setShare(props.share());
		update();
		const connection = RunService.Heartbeat.Connect(update);
		return () => connection.Disconnect();
	}, [props.share]);
	return (
		<frame
			key="CrabMark"
			Position={UDim2.fromOffset(-10, 34)}
			Size={UDim2.fromOffset(32, 34)}
			BackgroundTransparency={1}
			Visible={share.map((value) => value > 0.005)}
			ZIndex={6}
		>
			<imagelabel
				key="Crab"
				Size={UDim2.fromOffset(32, 26)}
				BackgroundTransparency={1}
				Image={props.image}
				ScaleType={Enum.ScaleType.Fit}
				ZIndex={6}
			/>
			<textlabel
				key="Share"
				Position={UDim2.fromOffset(0, 20)}
				Size={UDim2.fromOffset(32, 14)}
				BackgroundTransparency={1}
				Font={FONT_TITLE}
				Text={share.map((value) => `${math.floor(value * 100 + 0.5)}%`)}
				TextSize={13}
				TextColor3={PALETTES.amber.light}
				ZIndex={7}
			>
				<TextStroke />
			</textlabel>
		</frame>
	);
}

/** Label of the tag under the slot: price, timer, or a word. */
function TagLabel(props: { text: string | React.Binding<string>; color: Color3; size?: number; inset?: number }) {
	return (
		<textlabel
			key="Label"
			Position={UDim2.fromOffset(props.inset ?? 0, 0)}
			Size={new UDim2(1, -(props.inset ?? 0), 1, 0)}
			BackgroundTransparency={1}
			Font={FONT_BOLD}
			Text={props.text}
			TextSize={props.size ?? 16}
			TextColor3={props.color}
			ZIndex={4}
		>
			<TextStroke />
		</textlabel>
	);
}

/** One slot of the egg shelf (FigCraft redesign-v2: EggSlot_*): a 3D square button with its tag below. */
export function EggSlot(props: EggSlotProps) {
	const [hovered, setHovered] = useState(false);
	const comingSoon = props.icon === undefined;
	const gated = props.gatedHint !== undefined;
	const locked = comingSoon || gated;
	const hatching = props.hatchAt !== undefined;
	const [remaining, ready] = useHatchCountdown(props.hatchAt);
	const buyable = !props.disabled && props.affordable;
	const state: SlotState = locked
		? "locked"
		: ready
			? "ready"
			: hatching
				? "hatching"
				: buyable
					? "buyable"
					: "unaffordable";
	const hatchTime = props.hatchTime ?? 1;
	// A ready egg invites the player to open it: pulsing ring and wobble (the hand is onboarding only),
	// unless the aquarium is full: it then waits quietly with a "FULL" tag
	const blocked = ready && props.aquariumFull === true;
	const showRing = props.highlight || (ready && !blocked);
	const highlightClock = useHighlightClock(showRing);
	const progress = remaining.map((seconds) => math.clamp(1 - seconds / hatchTime, 0, 1));
	const free = props.priceText === "FREE";

	let tag: React.Element;
	if (ready) {
		const palette = blocked ? PALETTES.red : PALETTES.green;
		tag = (
			<Plate
				key="Tag"
				top={palette.light}
				bottom={palette.base}
				shadow={palette.shadow}
				size={UDim2.fromOffset(FACE_SIZE - 6, TAG_HEIGHT + 2)}
				position={UDim2.fromOffset(3, TAG_TOP - 2)}
				depth={4}
				radius={10}
				gloss={true}
				zIndex={3}
			>
				<textlabel
					key="Label"
					Position={UDim2.fromOffset(0, 1)}
					Size={UDim2.fromScale(1, 1)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={blocked ? "FULL" : "OPEN!"}
					TextSize={18}
					TextColor3={WHITE}
					ZIndex={4}
				>
					<TextStroke color={palette.shadow} />
				</textlabel>
			</Plate>
		);
	} else {
		tag = (
			<frame
				key="Tag"
				Position={UDim2.fromOffset(5, TAG_TOP)}
				Size={UDim2.fromOffset(FACE_SIZE - 10, TAG_HEIGHT)}
				BackgroundColor3={NAVY.windowBottom}
				BorderSizePixel={0}
				ClipsDescendants={true}
				ZIndex={3}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<Outline thickness={2.5} />
				{hatching && (
					// Incubation progress: the tag fills with amber from the left
					<frame
						key="Progress"
						Size={progress.map((p) => UDim2.fromScale(p, 1))}
						BackgroundColor3={PALETTES.amber.base}
						BorderSizePixel={0}
						ZIndex={3}
					>
						<uicorner CornerRadius={new UDim(0.5, 0)} />
					</frame>
				)}
				{locked ? (
					<TagLabel text={gated ? "LOCKED" : "SOON"} color={Color3.fromHex("#9FB3C8")} size={13} />
				) : hatching ? (
					<TagLabel
						text={remaining.map((seconds) => string.format("%.1fs", seconds))}
						color={PALETTES.amber.light}
					/>
				) : free ? (
					<TagLabel text="FREE" color={PALETTES.green.light} />
				) : (
					<>
						<CoinIcon key="Coin" size={18} position={UDim2.fromOffset(4, 4)} zIndex={4} />
						<TagLabel
							text={props.priceText ?? ""}
							color={props.affordable ? PRICE_COLOR : PRICE_TOO_HIGH}
							size={15}
							inset={20}
						/>
					</>
				)}
			</frame>
		);
	}

	return (
		<frame
			LayoutOrder={props.layoutOrder}
			Size={UDim2.fromOffset(SLOT_SIZE.X, SLOT_SIZE.Y)}
			BackgroundTransparency={1}
		>
			{showRing && (
				<frame
					key="HighlightRing"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromOffset(FACE_SIZE / 2, FACE_SIZE / 2 + 2)}
					Size={highlightClock.map((time) => {
						const grow = 12 + 6 * math.sin(time * HIGHLIGHT_PULSE_SPEED);
						return UDim2.fromOffset(FACE_SIZE + grow, FACE_SIZE + DEPTH + grow);
					})}
					BackgroundTransparency={1}
				>
					<uicorner CornerRadius={new UDim(0, 22)} />
					<uistroke
						Color={PALETTES.gold.base}
						Thickness={4}
						Transparency={highlightClock.map((time) => 0.3 + 0.35 * math.sin(time * HIGHLIGHT_PULSE_SPEED))}
					/>
				</frame>
			)}
			<Button3D
				key="Button"
				palette={STATE_PALETTES[state]}
				size={UDim2.fromOffset(FACE_SIZE, FACE_SIZE)}
				depth={DEPTH}
				radius={18}
				zIndex={2}
				disabled={locked}
				onHover={setHovered}
				// Intents only: the server checks the price, the player's money and the incubation
				onClick={() => {
					if (ready) props.onOpen?.();
					else if (!locked && !hatching && !props.disabled) props.onBuy?.();
				}}
			>
				<SoftGlow size={UDim2.fromScale(0.85, 0.85)} transparency={locked ? 0.85 : 0.35} zIndex={2} />
				{gated ? (
					<imagelabel
						key="Gate"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={UDim2.fromScale(0.5, 0.48)}
						Size={UDim2.fromOffset(60, 44)}
						BackgroundTransparency={1}
						Image={GATE_ICON}
						ScaleType={Enum.ScaleType.Fit}
						ZIndex={3}
					/>
				) : comingSoon ? (
					<textlabel
						key="Unknown"
						Size={UDim2.fromScale(1, 0.9)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text="?"
						TextSize={36}
						TextColor3={Color3.fromHex("#CFE3F7")}
						ZIndex={3}
					>
						<TextStroke thickness={2.5} />
					</textlabel>
				) : (
					<imagelabel
						key="Icon"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={UDim2.fromScale(0.5, 0.44)}
						Size={UDim2.fromOffset(50, 60)}
						BackgroundTransparency={1}
						Image={props.icon}
						ImageTransparency={state === "unaffordable" ? 0.45 : 0}
						ScaleType={Enum.ScaleType.Fit}
						Rotation={
							ready && !blocked
								? // Ready: little bursts of shaking, as if the fish wanted out
									highlightClock.map((time) =>
										time % READY_SHAKE_PERIOD < READY_SHAKE_TIME ? math.sin(time * 40) * 12 : 0,
									)
								: remaining.map((seconds) =>
										hatching && seconds > 0 && seconds < WOBBLE_TIME
											? math.sin(os.clock() * 30) * 10 * (1 - seconds / WOBBLE_TIME)
											: 0,
									)
						}
						ZIndex={3}
					>
						{hatching && (
							// Cracks spread over the shell as the incubation goes on
							<imagelabel
								key="Crack"
								Size={UDim2.fromScale(1, 1)}
								BackgroundTransparency={1}
								Image={progress.map((p) => EGG_CRACKS[math.min(math.floor(p * 3), 2)])}
								ImageTransparency={progress.map((p) => (p < 0.15 ? 1 : 0))}
								ScaleType={Enum.ScaleType.Fit}
								ZIndex={4}
							/>
						)}
					</imagelabel>
				)}
				{(props.incubators ?? 1) > 1 && (props.eggCount ?? 0) > 0 && (
					<Chip
						key="IncubatorChip"
						text={`${props.eggCount}/${props.incubators}`}
						color={NAVY.windowBottom}
						textColor={WHITE}
						width={32}
						height={18}
						textSize={12}
						position={UDim2.fromOffset(5, 5)}
						zIndex={5}
					/>
				)}
				{ready && !blocked && (
					<>
						<Sparkle key="Sparkle1" size={16} position={UDim2.fromScale(0.18, 0.2)} />
						<Sparkle
							key="Sparkle2"
							size={12}
							position={UDim2.fromScale(0.84, 0.62)}
							color={PALETTES.gold.light}
						/>
					</>
				)}
			</Button3D>
			{tag}
			{props.crabShare && props.crabImage !== undefined && (
				<CrabMark share={props.crabShare} image={props.crabImage} />
			)}
			{props.canBuyAnother && (
				<Button3D
					key="BuyAnother"
					palette={PALETTES.gold}
					size={UDim2.fromOffset(25, 23)}
					position={UDim2.fromOffset(FACE_SIZE - 30, 4)}
					depth={3}
					radius={9}
					text="+"
					textSize={20}
					zIndex={6}
					onHover={setHovered}
					onClick={() => props.onBuy?.()}
				/>
			)}
			{props.highlight && !hovered && (
				<textlabel
					key="PointingHand"
					AnchorPoint={new Vector2(0.5, 0)}
					Position={highlightClock.map(
						(time) => new UDim2(0.5, 0, 1, 6 + 6 * math.abs(math.sin(time * HIGHLIGHT_PULSE_SPEED * 0.6))),
					)}
					Size={UDim2.fromOffset(48, 48)}
					BackgroundTransparency={1}
					Text="👆"
					TextScaled={true}
					ZIndex={10}
				/>
			)}
			{hovered && gated && <GateTooltip hint={props.gatedHint!} />}
			{hovered && !locked && props.name !== undefined && props.odds && (
				<OddsTooltip name={props.name} odds={props.odds} />
			)}
		</frame>
	);
}
