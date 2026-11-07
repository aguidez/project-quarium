import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, Workspace } from "@rbxts/services";
import { EggHatch, Reward } from "shared/network";
import { SfxName } from "shared/sounds";
import { CompanionType } from "shared/types/companions";
import { EggType } from "shared/types/eggs";
import { ActiveEvent, GameEventType } from "shared/types/events";
import { Feature } from "shared/types/features";
import { FishType } from "shared/types/fish";
import { canDropFood, isOnboardingDone, STORY_QUEST_HINT_DELAY } from "shared/types/onboarding";
import {
	getCompanionSlots,
	getPlayerGalaxyLuck,
	getPlayerVariantLuck,
	getTotalFish,
	PlayerData,
} from "shared/types/playerData";
import { GamePass } from "shared/types/gamepasses";
import { hasClaimableQuest } from "shared/types/quests";
import { FishVariant } from "shared/types/variants";
import { hasClaimableOceanReward, OceanRewardId } from "shared/types/oceanRewards";
import { AQUARIUM_THEMES, formatMultiplier, getNextRebirth } from "shared/types/rebirths";
import { CompanionPanel } from "./CompanionPanel";
import { EggReveal } from "./EggReveal";
import { AdminActions, AdminPanel } from "./AdminPanel";
import { EventBanner } from "./EventBanner";
import { FishIndexPanel } from "./FishIndexPanel";
import { FoodReserve, getFoodReserveTop } from "./FoodReserve";
import { AquariumPanel } from "./AquariumPanel";
import { CosmeticId } from "shared/types/cosmetics";
import { getOwnedTitles, ThemeChoice, TitleChoice } from "shared/types/customization";
import { LikeBoostPill, PILL_HEIGHT } from "./LikeBoostPill";
import { QuestBoostPill } from "./QuestBoostPill";
import { OceanPanel } from "./OceanPanel";
import { RebirthPanel } from "./RebirthPanel";
import { OnboardingPanel } from "./OnboardingPanel";
import { QuestPanel } from "./QuestPanel";
import { RewardPopup } from "./RewardPopup";
import { ShopPanel } from "./ShopPanel";
import { BAR_HEIGHT, BAR_WIDTH, ShopBar } from "./ShopBar";
import { SideButtons } from "./SideButtons";
import { StarGauge } from "./StarGauge";
import { StarPowerPill } from "./StarPowerPill";
import { getSoundControlRoom, SoundControl } from "./SoundControl";
import { Button3D, Chip, TextStroke } from "./kit";
import { FONT_BOLD, FONT_TITLE, PALETTES, V2_IMAGES } from "./theme";
import { getVersionLabel } from "shared/version";
import { getUiScale, onViewportChanged } from "./screenScale";

const MIN_SCALE = 0.4;
const SIDE_MARGIN = 16; // gap kept between the bar and Roblox's topbar buttons
const BAR_GAP = 6; // kept under the shop bar (the top of the free screen area)
const EVENT_BANNER_GAP = 10; // under the top HUD
// Admin button: bottom-left, above FocusController's "Back to lobby" button (16 px margin + 50 px high + 6 px bevel)
const ADMIN_BUTTON_SIZE = new Vector2(150, 50);
const ADMIN_BUTTON_MARGIN = 16;
const ADMIN_BUTTON_BOTTOM = 82;
const CUSTOMIZE_SIZE = new Vector2(200, 50);
// FocusController's "Back to lobby" / "My aquarium" button: 220 px wide, 16 px from the bottom-left corner
const BACK_BUTTON_RIGHT = 16 + 220;
const CUSTOMIZE_GAP = 12;
const ONBOARDING_ABOVE_RESERVE = 6; // px between the food reserve and the onboarding card above it
// "Aquarium full" reminder (opening a ready egg with no room): shown this long, at most once per cooldown,
// and never again in the session once the player has released a fish (they know the way)
const FULL_REMINDER_TIME = 8;
const FULL_REMINDER_COOLDOWN = 180;
// "Rebirth ready" reminder: shown this long when a rebirth becomes affordable, then again every cooldown
// while it stays so (opening the menu restarts the cooldown). The button's gold halo stays all along.
const REBIRTH_REMINDER_TIME = 8;
const REBIRTH_REMINDER_COOLDOWN = 240;

export interface AppProps {
	data?: PlayerData;
	onBuy: (eggType: EggType) => void;
	onOpen: (eggType: EggType) => void;
	/** Hatch being revealed (one at a time); `id` makes each reveal a fresh animation. */
	reveal?: EggHatch & { id: number };
	onRevealEnd: () => void;
	/** Reward being celebrated (one at a time, never over a hatch reveal). */
	reward?: Reward & { id: number };
	onRewardEnd: () => void;
	playSfx: (name: SfxName, playbackSpeed?: number) => void;
	/** Event running for the whole server, if any. */
	event?: ActiveEvent;
	subscribeBeat: (listener: (beat: number) => void) => () => void;
	/** The local player's like boost ends then (server time; 0 = none). Session-only, not in PlayerData. */
	likeBoostEndsAt: number;
	/** The player has quest coin boost left (daily / weekly rewards): its pill shows, under the like pill. */
	questBoosted: boolean;
	/** Aquarium customization intents (CustomizationService checks them). */
	onSetTheme: (theme: ThemeChoice) => void;
	onSetCosmeticShown: (id: CosmeticId, shown: boolean) => void;
	onSetTitle: (title: TitleChoice) => void;
	/** The owner's test modes ("/speed", "/passes off" in Studio), shown so they are never forgotten; undefined for everyone else. */
	testMode?: string;
	/** The admin panel's intents, only given when the server allows this player (AdminService checks them again). */
	admin?: AdminActions;
	onClaimQuest: (questId: string) => void;
	onEquipCompanion: (companionType: CompanionType) => void;
	onUnequipCompanion: (companionType: CompanionType) => void;
	onReleaseFish: (fishType: FishType, variant: FishVariant) => void;
	onFinishTutorial: (feature: Feature) => void;
	onClaimOceanReward: (id: OceanRewardId) => void;
	onRebirth: () => void;
	onBuyPass: (pass: GamePass) => void;
	/** The player stands at the fisherman's counter on the beach: the Shop panel opens (ShopKeeperController). */
	shopNearby: boolean;
	/** In the tank view (FocusController.isInView): the food reserve shows there. */
	inView: boolean;
	/** Called back on each click on the water while the food reserve is empty (it flashes). */
	subscribeFoodDenied: (listener: () => void) => () => void;
	/** The sound control (top-right): live volume changes, and the settled value to save. */
	onVolumeChange: (volume: number) => void;
	onVolumeCommit: (volume: number) => void;
}

type MenuPanel = "Quests" | "Companions" | "FishIndex" | "Ocean" | "Rebirth" | "Shop" | "Aquarium" | "Admin";

interface BarPlacement {
	centerX: number;
	/** The shop bar's scale (and the pills / banner under it): the UI scale, smaller if the topbar's room is short. */
	scale: number;
	/** The UI scale (screenScale.ts): side buttons, bottom buttons, food reserve, star gauge. */
	uiScale: number;
}

/**
 * Places the bar in the free area of Roblox's topbar (GuiService.TopbarInset) rather than
 * the middle of the screen: on PC the menu / chat buttons sit on the left, so the bar
 * shifts right and shrinks if needed to never cover them.
 */
function computeBarPlacement(): BarPlacement {
	const camera = Workspace.CurrentCamera;
	const uiScale = getUiScale(1);
	if (!camera) return { centerX: 0, scale: uiScale, uiScale };
	const viewportWidth = camera.ViewportSize.X;
	const inset = GuiService.TopbarInset;
	const left = inset.Width > 0 ? inset.Min.X : 0;
	// The sound control takes the right end of the topbar row
	const right = (inset.Width > 0 ? inset.Max.X : viewportWidth) - getSoundControlRoom();
	const room = right - left - SIDE_MARGIN * 2;
	return {
		centerX: (left + right) / 2,
		scale: math.clamp(room / BAR_WIDTH, MIN_SCALE, uiScale),
		uiScale,
	};
}

/** Bottom edge of the top HUD (bar + hint), in pixels from the top of the screen. */
export function getTopHudBottom(): number {
	return (BAR_HEIGHT + BAR_GAP) * computeBarPlacement().scale;
}

function useBarPlacement(): BarPlacement {
	const [placement, setPlacement] = useState(computeBarPlacement);
	useEffect(() => {
		const update = () => setPlacement(computeBarPlacement());
		const connection = GuiService.GetPropertyChangedSignal("TopbarInset").Connect(update);
		const disconnectViewport = onViewportChanged(update);
		update();
		return () => {
			connection.Disconnect();
			disconnectViewport();
		};
	}, []);
	return placement;
}

export function App(props: AppProps) {
	const { centerX, scale, uiScale } = useBarPlacement();
	const [openPanel, setOpenPanel] = useState<MenuPanel>();
	const data = props.data;
	// The shop lives in the fisherman's hut: it opens as the player walks up to him and closes as they leave (closed
	// by hand, it stays closed until they come back)
	useEffect(() => {
		if (props.shopNearby) setOpenPanel("Shop");
		else setOpenPanel((panel) => (panel === "Shop" ? undefined : panel));
	}, [props.shopNearby]);
	// The menus show up once the tutorial is over, so they never distract from it
	const menusVisible = data !== undefined && isOnboardingDone(data.onboarding);
	// Something to customize: a theme, a cosmetic, or a leaderboard title held today
	const canCustomize =
		data !== undefined && (data.rebirths > 0 || data.cosmetics.size() > 0 || getOwnedTitles(data).size() > 0);
	const oceanUnlocked = data !== undefined && data.features.includes("Ocean");
	const oceanTutorial = oceanUnlocked && !data.tutorialsDone.includes("Ocean");
	// Rebirth: the menu shows up the first time one is affordable, with a coach bubble until opened
	const rebirthUnlocked = data !== undefined && data.features.includes("Rebirth");
	const rebirthTutorial = rebirthUnlocked && !data.tutorialsDone.includes("Rebirth");
	const upcomingRebirth = data !== undefined ? getNextRebirth(data.rebirths) : undefined;
	const rebirthReady = upcomingRebirth !== undefined && data !== undefined && data.money >= upcomingRebirth.price;

	// Story quest hint: only right after an onboarding played in this session (not for a player who
	// joins with it already done), once the "Tutorial complete!" popup is gone. Ends when the book is opened.
	const onboardingStep = data?.onboarding;
	const sawOnboarding = useRef(false);
	const [questHint, setQuestHint] = useState(false);
	useEffect(() => {
		if (onboardingStep === undefined) return;
		if (!isOnboardingDone(onboardingStep)) {
			sawOnboarding.current = true;
			return;
		}
		if (!sawOnboarding.current) return;
		sawOnboarding.current = false;
		const thread = task.delay(STORY_QUEST_HINT_DELAY, () => setQuestHint(true));
		return () => task.cancel(thread);
	}, [onboardingStep]);
	const firstQuest = data?.quests.lines.Start;
	const questCoach = questHint && firstQuest?.id === "Story1" && !firstQuest.claimed;

	// "Aquarium full" reminder: the player taps a ready egg but has no room (the server refuses it anyway)
	const [fullReminder, setFullReminder] = useState<"Ocean" | "Quests">();
	const lastFullReminderAt = useRef(-math.huge);
	const releasedFish = useRef(false);
	const openEgg = (eggType: EggType) => {
		props.onOpen(eggType);
		const hatchAt = data?.incubating[eggType]?.[0];
		if (!data || hatchAt === undefined || hatchAt > Workspace.GetServerTimeNow()) return;
		if (getTotalFish(data) < data.capacity || releasedFish.current) return;
		if (os.clock() - lastFullReminderAt.current < FULL_REMINDER_COOLDOWN) return;
		const fullHouse = data.quests.lines.Ocean;
		let target: "Ocean" | "Quests" | undefined;
		// A brand new Ocean already has its "NEW" bubble
		if (oceanUnlocked) target = oceanTutorial ? undefined : "Ocean";
		else if (fullHouse?.id === "Story2" && !fullHouse.claimed) target = "Quests";
		if (!target) return;
		lastFullReminderAt.current = os.clock();
		setFullReminder(target);
	};
	useEffect(() => {
		if (!fullReminder) return;
		const thread = task.delay(FULL_REMINDER_TIME, () => setFullReminder(undefined));
		return () => task.cancel(thread);
	}, [fullReminder]);

	// "Rebirth ready" reminder (after the Rebirth's own "NEW" bubble is done)
	const [rebirthReminder, setRebirthReminder] = useState(false);
	const lastRebirthReminderAt = useRef(-math.huge);
	const remindRebirth = rebirthReady && rebirthUnlocked && !rebirthTutorial;
	useEffect(() => {
		if (!remindRebirth) {
			setRebirthReminder(false);
			return;
		}
		const thread = task.spawn(() => {
			while (true) {
				// Re-read after each wait: opening the menu meanwhile pushes the next one back
				const wait = lastRebirthReminderAt.current + REBIRTH_REMINDER_COOLDOWN - os.clock();
				if (wait > 0) {
					task.wait(wait);
					continue;
				}
				lastRebirthReminderAt.current = os.clock();
				setRebirthReminder(true);
				task.wait(REBIRTH_REMINDER_TIME);
				setRebirthReminder(false);
			}
		});
		return () => task.cancel(thread);
	}, [remindRebirth]);

	// Food reserve: in the tank view, from the onboarding's Feed step (the card then sits right above it)
	const foodReserveShown = props.inView && data !== undefined && canDropFood(data.onboarding);

	// Star gauge during a starfall; afterwards, the star power it left is a pill under the egg shop until an egg spends it
	const starfall = props.event?.config.kind === "Starfall";
	const starPower = data?.starPower ?? 0;

	// Like boost pill: shown until the boost ends (re-rendered then, nothing else changes at that moment)
	const likeBoostEndsAt = props.likeBoostEndsAt;
	const [likeBoosted, setLikeBoosted] = useState(false);
	useEffect(() => {
		const remaining = likeBoostEndsAt - Workspace.GetServerTimeNow();
		setLikeBoosted(remaining > 0);
		if (remaining <= 0) return;
		const thread = task.delay(remaining, () => setLikeBoosted(false));
		return () => task.cancel(thread);
	}, [likeBoostEndsAt]);

	return (
		<>
			<frame
				key="TopArea"
				AnchorPoint={new Vector2(0.5, 0)}
				Position={UDim2.fromOffset(centerX, 0)}
				Size={UDim2.fromOffset(BAR_WIDTH, BAR_HEIGHT)}
				BackgroundTransparency={1}
				ZIndex={5} // the eggs' odds tooltips hang over the boost pills below it (the menus' Modal is at 20)
			>
				<uiscale Scale={scale} />
				<ShopBar data={props.data} onBuy={props.onBuy} onOpen={openEgg} />
			</frame>
			<OnboardingPanel
				key="Onboarding"
				step={props.data?.onboarding}
				hidden={props.reveal !== undefined}
				playSfx={props.playSfx}
				bottom={foodReserveShown ? getFoodReserveTop(uiScale) + ONBOARDING_ABOVE_RESERVE * uiScale : undefined}
			/>
			{foodReserveShown && (
				<FoodReserve
					key="FoodReserve"
					scale={uiScale}
					leftClear={
						(BACK_BUTTON_RIGHT + (menusVisible && canCustomize ? CUSTOMIZE_GAP + CUSTOMIZE_SIZE.X : 0)) *
						uiScale
					}
					subscribeDenied={props.subscribeFoodDenied}
				/>
			)}
			{props.event && (
				<EventBanner
					key={`Event${props.event.startsAt}`}
					event={props.event}
					top={getTopHudBottom() + EVENT_BANNER_GAP}
					scale={scale}
					subscribeBeat={props.subscribeBeat}
				/>
			)}
			{props.admin && (
				<Button3D
					key="AdminButton"
					palette={PALETTES.purple}
					size={UDim2.fromOffset(ADMIN_BUTTON_SIZE.X, ADMIN_BUTTON_SIZE.Y)}
					position={new UDim2(0, ADMIN_BUTTON_MARGIN * uiScale, 1, -ADMIN_BUTTON_BOTTOM * uiScale)}
					anchorPoint={new Vector2(0, 1)}
					scale={uiScale}
					zIndex={3}
					text="ADMIN"
					onClick={() => setOpenPanel(openPanel === "Admin" ? undefined : "Admin")}
				/>
			)}
			{likeBoosted && (
				<LikeBoostPill
					key="LikeBoost"
					endsAt={likeBoostEndsAt}
					top={getTopHudBottom() + EVENT_BANNER_GAP}
					scale={scale}
				/>
			)}
			{/* The version, small and faded in the corner (above the owner's test chip when it shows) */}
			<textlabel
				key="Version"
				AnchorPoint={new Vector2(1, 1)}
				Position={new UDim2(1, -12, 1, props.testMode !== undefined ? -48 : -8)}
				Size={UDim2.fromOffset(160, 18)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={getVersionLabel()}
				TextSize={14}
				TextColor3={new Color3(1, 1, 1)}
				TextTransparency={0.35}
				TextXAlignment={Enum.TextXAlignment.Right}
			>
				<TextStroke transparency={0.6} thickness={1.5} />
			</textlabel>
			{data && (
				<SoundControl
					key="SoundControl"
					initialVolume={data.soundVolume}
					onChange={props.onVolumeChange}
					onCommit={props.onVolumeCommit}
				/>
			)}
			{props.testMode !== undefined && (
				<Chip
					key="TestSpeed"
					text={props.testMode}
					color={PALETTES.red.base}
					textColor={new Color3(1, 1, 1)}
					textStroke={PALETTES.red.shadow}
					height={30}
					anchorPoint={new Vector2(1, 1)}
					position={new UDim2(1, -12, 1, -12)}
				/>
			)}
			{props.questBoosted && menusVisible && (
				<QuestBoostPill
					key="QuestBoost"
					top={getTopHudBottom() + EVENT_BANNER_GAP + (likeBoosted ? (PILL_HEIGHT + 8) * scale : 0)}
					scale={scale}
				/>
			)}
			{menusVisible && starfall && (
				<StarGauge
					key="StarGauge"
					bars={data.starCharge}
					saved={starPower}
					luck={getPlayerVariantLuck(data)}
					galaxyLuck={getPlayerGalaxyLuck(data)}
					scale={uiScale}
				/>
			)}
			{menusVisible && !starfall && starPower > 0 && (
				<StarPowerPill
					key="StarPower"
					power={starPower}
					top={
						getTopHudBottom() +
						EVENT_BANNER_GAP +
						((likeBoosted ? 1 : 0) + (props.questBoosted ? 1 : 0)) * (PILL_HEIGHT + 8) * scale
					}
					scale={scale}
				/>
			)}
			{menusVisible && (
				<SideButtons
					key="SideButtons"
					scale={uiScale}
					questBadge={hasClaimableQuest(data.quests, data.passes)}
					questCoach={questCoach}
					onQuests={() => {
						setOpenPanel("Quests");
						setQuestHint(false);
						if (fullReminder === "Quests") setFullReminder(undefined);
					}}
					onCompanions={data.companions.size() > 0 ? () => setOpenPanel("Companions") : undefined}
					onFishIndex={() => setOpenPanel("FishIndex")}
					onOcean={
						oceanUnlocked
							? () => {
									setOpenPanel("Ocean");
									if (fullReminder === "Ocean") setFullReminder(undefined);
								}
							: undefined
					}
					oceanCoach={oceanTutorial && openPanel !== "Ocean"}
					oceanBadge={hasClaimableOceanReward(data.oceanPoints, data.oceanRewardsClaimed)}
					onRebirth={
						rebirthUnlocked
							? () => {
									setOpenPanel("Rebirth");
									if (rebirthTutorial) props.onFinishTutorial("Rebirth");
									setRebirthReminder(false);
									lastRebirthReminderAt.current = os.clock();
								}
							: undefined
					}
					rebirthBadge={rebirthReady}
					rebirthCoach={rebirthTutorial && openPanel !== "Rebirth"}
					rebirthReminder={
						rebirthReminder && openPanel === undefined && upcomingRebirth
							? {
									multiplier: formatMultiplier(upcomingRebirth.multiplier),
									theme: AQUARIUM_THEMES[upcomingRebirth.theme].displayName,
								}
							: undefined
					}
					fullReminder={openPanel === undefined ? fullReminder : undefined}
				/>
			)}
			{menusVisible && canCustomize && (
				// Next to FocusController's "Back to lobby" / "My aquarium" (220 x 50 face at 16 px from the bottom-left corner,
				// its 6 px bevel below): the same baseline, in the lobby and in the tank view
				<Button3D
					key="Customize"
					palette={PALETTES.pink}
					size={UDim2.fromOffset(CUSTOMIZE_SIZE.X, CUSTOMIZE_SIZE.Y)}
					anchorPoint={new Vector2(0, 1)}
					position={new UDim2(0, (BACK_BUTTON_RIGHT + CUSTOMIZE_GAP) * uiScale, 1, -16 * uiScale)}
					scale={uiScale}
					depth={6}
					radius={14}
					onClick={() => setOpenPanel(openPanel === "Aquarium" ? undefined : "Aquarium")}
				>
					<imagelabel
						key="Icon"
						AnchorPoint={new Vector2(0, 0.5)}
						Position={new UDim2(0, 8, 0.5, 0)}
						Size={UDim2.fromOffset(40, 40)}
						BackgroundTransparency={1}
						Image={V2_IMAGES.iconAquarium}
						ZIndex={3}
					/>
					<textlabel
						key="Label"
						Position={UDim2.fromOffset(52, 1)}
						Size={new UDim2(1, -60, 1, 0)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text="CUSTOMIZE"
						TextSize={22}
						TextColor3={new Color3(1, 1, 1)}
						ZIndex={4}
					>
						<TextStroke color={PALETTES.pink.shadow} thickness={2.5} />
					</textlabel>
				</Button3D>
			)}
			{menusVisible && openPanel === "Aquarium" && (
				<AquariumPanel
					key="AquariumPanel"
					rebirths={data.rebirths}
					cosmetics={data.cosmetics}
					themeChoice={data.themeChoice}
					hiddenCosmetics={data.hiddenCosmetics}
					titleChoice={data.titleChoice}
					leaderboardRanks={data.leaderboardRanks}
					onSetTheme={props.onSetTheme}
					onSetShown={props.onSetCosmeticShown}
					onSetTitle={props.onSetTitle}
					onClose={() => setOpenPanel(undefined)}
				/>
			)}
			{menusVisible && openPanel === "Quests" && (
				<QuestPanel
					key="QuestPanel"
					quests={data.quests}
					passes={data.passes}
					rebirths={data.rebirths}
					onClaim={props.onClaimQuest}
					onBuyPass={props.onBuyPass}
					onClose={() => setOpenPanel(undefined)}
				/>
			)}
			{menusVisible && data.companions.size() > 0 && openPanel === "Companions" && (
				<CompanionPanel
					key="CompanionPanel"
					owned={data.companions}
					equipped={data.equippedCompanions}
					slots={getCompanionSlots(data)}
					perks={data.perks}
					oceanRewardsClaimed={data.oceanRewardsClaimed}
					onEquip={props.onEquipCompanion}
					onUnequip={props.onUnequipCompanion}
					onClose={() => setOpenPanel(undefined)}
				/>
			)}
			{menusVisible && openPanel === "FishIndex" && (
				<FishIndexPanel
					key="FishIndexPanel"
					collection={data}
					luck={getPlayerVariantLuck(data)}
					galaxyLuck={getPlayerGalaxyLuck(data)}
					onClose={() => setOpenPanel(undefined)}
				/>
			)}
			{menusVisible && oceanUnlocked && openPanel === "Ocean" && (
				<OceanPanel
					key="OceanPanel"
					tank={data}
					oceanPoints={data.oceanPoints}
					showTutorial={oceanTutorial}
					onRelease={(fishType, variant) => {
						releasedFish.current = true;
						props.onReleaseFish(fishType, variant);
					}}
					claimed={data.oceanRewardsClaimed}
					onClaimReward={props.onClaimOceanReward}
					onFinishTutorial={() => props.onFinishTutorial("Ocean")}
					onClose={() => setOpenPanel(undefined)}
				/>
			)}
			{menusVisible && rebirthUnlocked && openPanel === "Rebirth" && (
				<RebirthPanel
					key="RebirthPanel"
					rebirths={data.rebirths}
					money={data.money}
					fish={data.fish}
					fishVariants={data.fishVariants}
					passes={data.passes}
					onRebirth={() => {
						setOpenPanel(undefined);
						props.onRebirth();
					}}
					onClose={() => setOpenPanel(undefined)}
				/>
			)}
			{props.admin && openPanel === "Admin" && (
				<AdminPanel
					key="AdminPanel"
					event={props.event}
					actions={props.admin}
					onClose={() => setOpenPanel(undefined)}
				/>
			)}
			{menusVisible && openPanel === "Shop" && (
				<ShopPanel
					key="ShopPanel"
					passes={data.passes}
					onBuy={props.onBuyPass}
					onClose={() => setOpenPanel(undefined)}
				/>
			)}
			{props.reward && (
				<RewardPopup
					key={`Reward${props.reward.id}`}
					title={props.reward.title}
					amount={props.reward.amount}
					item={props.reward.item}
					subtitle={props.reward.subtitle}
					playSfx={props.playSfx}
					onEnd={props.onRewardEnd}
				/>
			)}
			{props.reveal && (
				<EggReveal
					key={`Reveal${props.reveal.id}`}
					eggType={props.reveal.eggType}
					fishType={props.reveal.fishType}
					variant={props.reveal.variant}
					firstTime={props.reveal.firstTime}
					size={props.reveal.size}
					newBestSize={props.reveal.newBestSize}
					starPowered={props.reveal.starPowered}
					luck={data ? getPlayerVariantLuck(data) : 1}
					galaxyLuck={data ? getPlayerGalaxyLuck(data) : 1}
					playSfx={props.playSfx}
					onEnd={props.onRevealEnd}
				/>
			)}
		</>
	);
}
