import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService, Workspace } from "@rbxts/services";
import { COMPANION_TYPES } from "shared/types/companions";
import { Button3D, CoinIcon, NotifBadge, Outline, Plate, SoftGlow, TextStroke } from "./kit";
import { getWrappedHeight } from "./Panel";
import { FONT_BOLD, FONT_TITLE, NAVY, Palette, PALETTES, V2_IMAGES } from "./theme";

const BUTTON_SIZE = 86;
const BUTTON_DEPTH = 6;
const ICON_SIZE = 54; // leaves the bottom of the face to the label
const SIDE_MARGIN = 16;
const REFERENCE_HEIGHT = 1080;

export interface SideButtonsProps {
	/** A quest reward is waiting to be claimed. */
	questBadge: boolean;
	/** Just after the onboarding: a bubble invites the player to read the story quests until the book is opened. */
	questCoach: boolean;
	onQuests: () => void;
	/** Once the first companion is earned (undefined before). */
	onCompanions?: () => void;
	onFishIndex: () => void;
	/** The Ocean, once unlocked (undefined before). */
	onOcean?: () => void;
	/** Just unlocked: a bubble points at the Ocean button until it's opened (FigCraft: OceanCoach). */
	oceanCoach: boolean;
	/** An Ocean milestone is reached and waiting to be claimed. */
	oceanBadge: boolean;
	/** The rebirth menu, once a first rebirth has been affordable (undefined before). */
	onRebirth?: () => void;
	/** A rebirth is affordable right now: the button pulses in a gold halo, so it is hard to miss. */
	rebirthBadge: boolean;
	/**
	 * A rebirth just became affordable (and again now and then while it stays so): a bubble says what it
	 * brings (FigCraft: RebirthReadyReminder), so the player doesn't forget it if they want it.
	 */
	rebirthReminder?: { multiplier: string; theme: string };
	/** Just unlocked: a bubble explains the Rebirth button until it's opened. */
	rebirthCoach: boolean;
	/**
	 * The player tried to open an egg with a full aquarium: for a few seconds, a bubble reminds them
	 * how to make room (FigCraft: OceanFullReminder). On the Ocean button, or on the quest book while
	 * the Ocean is still the reward of "Full House".
	 */
	fullReminder?: "Ocean" | "Quests";
	/** The gamepass shop (once the tutorial is over, like every menu). */
	onShop: () => void;
}

const FULL_TITLE = "AQUARIUM FULL";

const COACH_BOB = 6; // px, the bubble nudges toward the button
const COACH_WIDTH = 320;
const COACH_TEXT_SIZE = 15;
const COACH_PADDING = 14;
const WHITE = new Color3(1, 1, 1);

/** "New!" bubble right of a side button, bobbing toward it (FigCraft redesign-v2: CoachBubble_Rebirth). */
function CoachBubble(props: { title: string; text: string }) {
	const [time, setTime] = useBinding(0);
	useEffect(() => {
		const start = os.clock();
		const connection = RunService.Heartbeat.Connect(() => setTime(os.clock() - start));
		return () => connection.Disconnect();
	}, []);
	const textWidth = COACH_WIDTH - COACH_PADDING * 2;
	return (
		<Plate
			key="Coach"
			top={NAVY.windowTop}
			bottom={NAVY.windowBottom}
			shadow={NAVY.windowShadow}
			outline={PALETTES.gold.base}
			size={UDim2.fromOffset(COACH_WIDTH, 0)}
			autoHeight={true}
			anchorPoint={new Vector2(0, 0.5)}
			position={time.map((t) => new UDim2(1, 18 + math.abs(math.sin(t * 4)) * COACH_BOB, 0.5, 0))}
			radius={18}
			zIndex={6}
			overlay={
				// Pointer toward the button: a gold square turned 45 degrees, half hidden behind the bubble
				<frame
					key="Pointer"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0, 0, 0.5, -3)}
					Size={UDim2.fromOffset(16, 16)}
					Rotation={45}
					BackgroundColor3={PALETTES.gold.base}
					BorderSizePixel={0}
					ZIndex={1}
				>
					<Outline />
				</frame>
			}
		>
			<uipadding
				PaddingTop={new UDim(0, 10)}
				PaddingBottom={new UDim(0, 12)}
				PaddingLeft={new UDim(0, COACH_PADDING)}
				PaddingRight={new UDim(0, COACH_PADDING)}
			/>
			<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
			<textlabel
				key="Title"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 26)}
				BackgroundTransparency={1}
				Font={FONT_TITLE}
				Text={props.title}
				TextSize={22}
				TextColor3={PALETTES.gold.base}
				TextXAlignment={Enum.TextXAlignment.Left}
				ZIndex={7}
			>
				<TextStroke thickness={2.5} />
			</textlabel>
			<textlabel
				key="Text"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, getWrappedHeight(props.text, COACH_TEXT_SIZE, FONT_BOLD, textWidth))}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={props.text}
				TextSize={COACH_TEXT_SIZE}
				TextColor3={WHITE}
				TextWrapped={true}
				TextXAlignment={Enum.TextXAlignment.Left}
				ZIndex={7}
			/>
		</Plate>
	);
}

const GLOW_SPEED = 3.5; // radians per second of the "ready" pulse

/** Gold glow pulsing behind a side button whose action is ready (a rebirth). */
function GlowHalo() {
	const [time, setTime] = useBinding(0);
	useEffect(() => {
		const start = os.clock();
		const connection = RunService.Heartbeat.Connect(() => setTime(os.clock() - start));
		return () => connection.Disconnect();
	}, []);
	const pulse = time.map((t) => (1 - math.cos(t * GLOW_SPEED)) / 2); // 0 → 1 → 0
	return (
		<>
			<uiscale key="Pulse" Scale={pulse.map((p) => 1 + p * 0.06)} />
			<SoftGlow
				size={UDim2.fromOffset(BUTTON_SIZE * 1.7, BUTTON_SIZE * 1.7)}
				position={UDim2.fromOffset(BUTTON_SIZE / 2, BUTTON_SIZE / 2 + 3)}
				color={PALETTES.gold.base}
				transparency={pulse.map((p) => 0.45 - p * 0.35)}
				zIndex={0}
			/>
		</>
	);
}

/**
 * One side menu button (FigCraft redesign-v2: SideBtn_*): a 3D square, its drawn icon and its label both inside
 * the face (a label over the edge got cut by the outline).
 */
function SideButton(props: {
	order: number;
	palette: Palette;
	image: string;
	label: string;
	badge?: boolean;
	glow?: boolean;
	coach?: React.ReactNode;
	onClick: () => void;
}) {
	return (
		<frame
			key={props.label}
			LayoutOrder={props.order}
			Size={UDim2.fromOffset(BUTTON_SIZE, BUTTON_SIZE + BUTTON_DEPTH)}
			BackgroundTransparency={1}
		>
			{props.glow && <GlowHalo />}
			<Button3D
				key="Button"
				palette={props.palette}
				size={UDim2.fromOffset(BUTTON_SIZE, BUTTON_SIZE)}
				depth={BUTTON_DEPTH}
				radius={20}
				zIndex={1}
				onClick={props.onClick}
			>
				{props.image !== "" ? (
					<imagelabel
						key="Icon"
						AnchorPoint={new Vector2(0.5, 0)}
						Position={new UDim2(0.5, 0, 0, 5)}
						Size={UDim2.fromOffset(ICON_SIZE, ICON_SIZE)}
						BackgroundTransparency={1}
						Image={props.image}
						ScaleType={Enum.ScaleType.Fit}
						ZIndex={3}
					/>
				) : (
					<CoinIcon
						key="Icon"
						size={ICON_SIZE - 10}
						position={new UDim2(0.5, 0, 0, 10)}
						anchorPoint={new Vector2(0.5, 0)}
						zIndex={3}
					/>
				)}
				<textlabel
					key="Label"
					AnchorPoint={new Vector2(0.5, 1)}
					Position={new UDim2(0.5, 0, 1, -6)}
					Size={new UDim2(1, -12, 0, 18)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={props.label}
					// "Companions" shrinks a little to stay inside the face
					TextScaled={true}
					TextColor3={WHITE}
					ZIndex={4}
				>
					<uitextsizeconstraint MaxTextSize={15} />
					<TextStroke color={props.palette.shadow} thickness={2.5} />
				</textlabel>
			</Button3D>
			{props.badge && <NotifBadge key="Badge" position={new UDim2(1, -4, 0, 2)} />}
			{props.coach}
		</frame>
	);
}

/** Left-edge menu buttons (FigCraft redesign-v2: SideButtons): quests, companions, fish index, Ocean, rebirth, shop. */
export function SideButtons(props: SideButtonsProps) {
	const viewport = Workspace.CurrentCamera?.ViewportSize;
	const scale = viewport ? math.clamp(viewport.Y / REFERENCE_HEIGHT, 0.7, 1.3) : 1;
	return (
		<frame
			key="SideButtons"
			AnchorPoint={new Vector2(0, 0.5)}
			Position={new UDim2(0, SIDE_MARGIN, 0.5, 0)}
			Size={UDim2.fromOffset(0, 0)}
			AutomaticSize={Enum.AutomaticSize.XY}
			BackgroundTransparency={1}
			ZIndex={2}
		>
			<uiscale Scale={scale} />
			<uilistlayout Padding={new UDim(0, 14)} SortOrder={Enum.SortOrder.LayoutOrder} />
			<SideButton
				order={1}
				palette={PALETTES.gold}
				image={V2_IMAGES.iconQuests}
				label="Quests"
				badge={props.questBadge}
				coach={
					props.questCoach ? (
						<CoachBubble
							title="STORY QUESTS!"
							text="Take a look at the Snail quest in your quest book. Good luck!"
						/>
					) : (
						props.fullReminder === "Quests" && (
							<CoachBubble
								title={FULL_TITLE}
								text={`Claim "Full House" to unlock the Ocean: release fish there to make room.`}
							/>
						)
					)
				}
				onClick={props.onQuests}
			/>
			{props.onCompanions && (
				<SideButton
					order={2}
					palette={PALETTES.green}
					image={COMPANION_TYPES.Snail.image}
					label="Companions"
					onClick={props.onCompanions}
				/>
			)}
			<SideButton
				order={3}
				palette={PALETTES.blue}
				image={V2_IMAGES.iconFishIndex}
				label="Fish Index"
				onClick={props.onFishIndex}
			/>
			{props.onOcean && (
				<SideButton
					order={4}
					palette={PALETTES.lagoon}
					image={V2_IMAGES.iconOcean}
					label="Ocean"
					badge={props.oceanCoach || props.oceanBadge}
					coach={
						props.oceanCoach ? (
							<CoachBubble
								title="NEW: THE OCEAN!"
								text="Release the fish you don't need to earn Ocean Points."
							/>
						) : (
							props.fullReminder === "Ocean" && (
								<CoachBubble
									title={FULL_TITLE}
									text="Release a fish in the Ocean to make room for a new one."
								/>
							)
						)
					}
					onClick={props.onOcean}
				/>
			)}
			{props.onRebirth && (
				<SideButton
					order={5}
					palette={PALETTES.purple}
					image={V2_IMAGES.iconRebirth}
					label="Rebirth"
					badge={props.rebirthBadge}
					glow={props.rebirthBadge}
					coach={
						props.rebirthCoach ? (
							<CoachBubble
								title="NEW: REBIRTH!"
								text="Start over with a permanent coin multiplier and a new aquarium."
							/>
						) : (
							props.rebirthReminder && (
								<CoachBubble
									title="REBIRTH READY!"
									text={`Coins ${props.rebirthReminder.multiplier} forever and the ${props.rebirthReminder.theme}. Whenever you want!`}
								/>
							)
						)
					}
					onClick={props.onRebirth}
				/>
			)}
			<SideButton
				order={6}
				palette={PALETTES.pink}
				image={V2_IMAGES.iconShop}
				label="Shop"
				onClick={props.onShop}
			/>
		</frame>
	);
}
