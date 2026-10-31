import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, Workspace } from "@rbxts/services";
import { EggHatch, Reward } from "shared/network";
import { SfxName } from "shared/sounds";
import { CompanionType } from "shared/types/companions";
import { EggType } from "shared/types/eggs";
import { ActiveEvent, GameEventType, TEST_EVENT_ORDER } from "shared/types/events";
import { Feature } from "shared/types/features";
import { FishType, FOOD_PRICE, getIncomePerSecond } from "shared/types/fish";
import { isOnboardingDone, STORY_QUEST_HINT_DELAY } from "shared/types/onboarding";
import { getCompanionSlots, getPlayerVariantLuck, getTotalFish, PlayerData } from "shared/types/playerData";
import { GamePass, getPassCoinMultiplier } from "shared/types/gamepasses";
import { hasClaimableQuest } from "shared/types/quests";
import { FishVariant } from "shared/types/variants";
import { hasClaimableOceanReward, OceanRewardId } from "shared/types/oceanRewards";
import { AQUARIUM_THEMES, formatMultiplier, getNextRebirth, getRebirthMultiplier } from "shared/types/rebirths";
import { CompanionPanel } from "./CompanionPanel";
import { EggReveal } from "./EggReveal";
import { EventBanner, TestEventButton } from "./EventBanner";
import { FishIndexPanel } from "./FishIndexPanel";
import { LikeBoostPill } from "./LikeBoostPill";
import { OceanPanel } from "./OceanPanel";
import { RebirthPanel } from "./RebirthPanel";
import { OnboardingPanel } from "./OnboardingPanel";
import { QuestPanel } from "./QuestPanel";
import { formatNumber } from "./Panel";
import { RewardPopup } from "./RewardPopup";
import { ShopPanel } from "./ShopPanel";
import { BAR_HEIGHT, BAR_WIDTH, ShopBar } from "./ShopBar";
import { SideButtons } from "./SideButtons";
import { TextStroke } from "./kit";
import { COLORS, FONT_BOLD } from "./theme";

const MIN_SCALE = 0.4;
const SIDE_MARGIN = 16; // gap kept between the bar and Roblox's topbar buttons
const HINT_GAP = 6; // between the bar and the hint line below it
const HINT_HEIGHT = 24;
const EVENT_BANNER_GAP = 10; // under the top HUD
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
	/** Starts a test event; only given in Studio (the server ignores it elsewhere). */
	onTestEvent?: (eventType: GameEventType) => void;
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
}

type MenuPanel = "Quests" | "Companions" | "FishIndex" | "Ocean" | "Rebirth" | "Shop";

interface BarPlacement {
	centerX: number;
	scale: number;
}

/**
 * Places the bar in the free area of Roblox's topbar (GuiService.TopbarInset) rather than
 * the middle of the screen: on PC the menu / chat buttons sit on the left, so the bar
 * shifts right and shrinks if needed to never cover them.
 */
function computeBarPlacement(): BarPlacement {
	const camera = Workspace.CurrentCamera;
	if (!camera) return { centerX: 0, scale: 1 };
	const viewportWidth = camera.ViewportSize.X;
	const inset = GuiService.TopbarInset;
	const left = inset.Width > 0 ? inset.Min.X : 0;
	const right = inset.Width > 0 ? inset.Max.X : viewportWidth;
	const room = right - left - SIDE_MARGIN * 2;
	return {
		centerX: (left + right) / 2,
		scale: math.clamp(room / BAR_WIDTH, MIN_SCALE, 1),
	};
}

/** Bottom edge of the top HUD (bar + hint), in pixels from the top of the screen. */
export function getTopHudBottom(): number {
	return (BAR_HEIGHT + HINT_GAP + HINT_HEIGHT) * computeBarPlacement().scale;
}

function useBarPlacement(): BarPlacement {
	const [placement, setPlacement] = useState(computeBarPlacement);
	useEffect(() => {
		const update = () => setPlacement(computeBarPlacement());
		const connections = [GuiService.GetPropertyChangedSignal("TopbarInset").Connect(update)];
		const camera = Workspace.CurrentCamera;
		if (camera) connections.push(camera.GetPropertyChangedSignal("ViewportSize").Connect(update));
		update();
		return () => {
			for (const connection of connections) connection.Disconnect();
		};
	}, []);
	return placement;
}

export function App(props: AppProps) {
	const { centerX, scale } = useBarPlacement();
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
	const oceanUnlocked = data !== undefined && data.features.includes("Ocean");
	const oceanTutorial = oceanUnlocked && !data.tutorialsDone.includes("Ocean");
	// Rebirth: the menu shows up the first time one is affordable, with a coach bubble until opened
	const rebirthUnlocked = data !== undefined && data.features.includes("Rebirth");
	const rebirthTutorial = rebirthUnlocked && !data.tutorialsDone.includes("Rebirth");
	const upcomingRebirth = data !== undefined ? getNextRebirth(data.rebirths) : undefined;
	const rebirthReady = upcomingRebirth !== undefined && data !== undefined && data.money >= upcomingRebirth.price;
	// Shown in the income line: rebirths, the coins pass and the running event's bonus (not the like boost: it has
	// its pill)
	const coinMultiplier =
		getRebirthMultiplier(data?.rebirths ?? 0) *
		getPassCoinMultiplier(data?.passes ?? []) *
		(props.event?.config.coinMultiplier ?? 1);

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

	let incomePerSecond = 0;
	if (props.data) {
		for (const [fishType, count] of pairs(props.data.fish)) {
			incomePerSecond += count * getIncomePerSecond(fishType);
		}
	}
	incomePerSecond = math.floor(incomePerSecond * coinMultiplier * 10 + 0.5) / 10;
	const multiplierText = coinMultiplier > 1 ? ` (${formatMultiplier(coinMultiplier)})` : "";

	return (
		<>
			<frame
				key="TopArea"
				AnchorPoint={new Vector2(0.5, 0)}
				Position={UDim2.fromOffset(centerX, 0)}
				Size={UDim2.fromOffset(BAR_WIDTH, BAR_HEIGHT + HINT_GAP + HINT_HEIGHT)}
				BackgroundTransparency={1}
			>
				<uiscale Scale={scale} />
				<ShopBar data={props.data} onBuy={props.onBuy} onOpen={openEgg} />
				<textlabel
					key="Hint"
					Position={UDim2.fromOffset(0, BAR_HEIGHT + HINT_GAP)}
					Size={new UDim2(1, 0, 0, HINT_HEIGHT)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={`Coins: +${incomePerSecond >= 1000 ? formatNumber(incomePerSecond) : incomePerSecond}$/s${multiplierText}   •   Walk up to the glass: click coins to collect them, or the water to feed (${FOOD_PRICE}$)`}
					TextSize={17}
					TextColor3={COLORS.white}
				>
					<TextStroke thickness={2.5} />
				</textlabel>
			</frame>
			<OnboardingPanel
				key="Onboarding"
				step={props.data?.onboarding}
				hidden={props.reveal !== undefined}
				playSfx={props.playSfx}
			/>
			{props.event && (
				<EventBanner
					key={`Event${props.event.startsAt}`}
					event={props.event}
					top={getTopHudBottom() + EVENT_BANNER_GAP}
					scale={scale}
					subscribeBeat={props.subscribeBeat}
				/>
			)}
			{props.onTestEvent &&
				TEST_EVENT_ORDER.map((eventType, index) => (
					<TestEventButton
						key={`Test${eventType}`}
						eventType={eventType}
						index={index}
						onClick={() => props.onTestEvent?.(eventType)}
					/>
				))}
			{likeBoosted && (
				<LikeBoostPill
					key="LikeBoost"
					endsAt={likeBoostEndsAt}
					top={getTopHudBottom() + EVENT_BANNER_GAP}
					scale={scale}
				/>
			)}
			{menusVisible && (
				<SideButtons
					key="SideButtons"
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
			{menusVisible && openPanel === "Quests" && (
				<QuestPanel
					key="QuestPanel"
					quests={data.quests}
					passes={data.passes}
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
					luck={data ? getPlayerVariantLuck(data) : 1}
					playSfx={props.playSfx}
					onEnd={props.onRevealEnd}
				/>
			)}
		</>
	);
}
