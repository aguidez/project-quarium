import React, { useBinding, useEffect, useState } from "@rbxts/react";
import { RunService, Workspace } from "@rbxts/services";
import { COMPANION_TYPES } from "shared/types/companions";
import { COSMETICS } from "shared/types/cosmetics";
import { FEATURES } from "shared/types/features";
import { GAME_PASSES, GamePass } from "shared/types/gamepasses";
import { PERKS } from "shared/types/perks";
import {
	getQuestConfig,
	isQuestLocked,
	QuestConfig,
	getQuestPeriod,
	getQuestPeriodEnd,
	isQuestComplete,
	QuestBoardCategory,
	QuestCategory,
	QuestProgress,
	QuestReward,
	QuestStat,
	QuestsData,
	getActiveStoryQuests,
	getStoryLine,
	STORY_LINES,
	StoryLine,
} from "shared/types/quests";
import { Button3D, Card, Chip, CoinIcon, ItemSlot, NotifBadge, ProgressBar, TextStroke } from "./kit";
import { formatNumber, formatShort, getWrappedHeight, Panel, PANEL_PADDING } from "./Panel";
import { EGG_SPRITES, FISH_ICONS, FONT_BOLD, FONT_TITLE, NAVY, OUTLINE, Palette, PALETTES, V2_IMAGES } from "./theme";

const TABS: { category: QuestCategory; label: string }[] = [
	{ category: "Story", label: "Story" },
	{ category: "Daily", label: "Daily" },
	{ category: "Weekly", label: "Weekly" },
];
const QUEST_PANEL_WIDTH = 640;
const INNER_WIDTH = QUEST_PANEL_WIDTH - PANEL_PADDING * 2;
const TAB_SIZE = new Vector2(150, 44);
const TAB_GAP = 14;
const CARD_PADDING = 14;
const CARD_GAP = 12;
const ICON_SIZE = 64;
const REWARD_SIZE = 72;
const CLAIM_SIZE = new Vector2(96, 48);
const DESCRIPTION_SIZE = 15;
const WHITE = new Color3(1, 1, 1);

/** Colour of each story line's tag (FigCraft redesign-v2: LineTag). */
const LINE_PALETTES: Record<StoryLine, Palette> = {
	Start: PALETTES.gold,
	Ocean: PALETTES.lagoon,
	Rebirth: PALETTES.purple,
	Snail: PALETTES.green,
	Pelican: PALETTES.blue,
};

export interface QuestPanelProps {
	quests: QuestsData;
	/** Gamepasses owned: the quests of a line needing another one are shown locked. */
	passes: readonly GamePass[];
	onClaim: (questId: string) => void;
	/** A locked quest's Buy button: asks the server for the pass's purchase prompt. */
	onBuyPass: (pass: GamePass) => void;
	onClose: () => void;
}

function getTabQuests(quests: QuestsData, category: QuestCategory): QuestProgress[] {
	// One quest per open story line (a finished line keeps its last quest, claimed, out of the list)
	if (category === "Story") return getActiveStoryQuests(quests.lines);
	return category === "Daily" ? quests.daily.quests : quests.weekly.quests;
}

function isClaimable(quest: QuestProgress, passes: readonly GamePass[]): boolean {
	return !quest.claimed && isQuestComplete(quest) && !isQuestLocked(quest.id, passes);
}

/** "5h 12m" / "2d 4h" until the board resets. */
function formatDuration(seconds: number): string {
	const total = math.max(math.floor(seconds), 0);
	const days = math.floor(total / 86400);
	const hours = math.floor((total % 86400) / 3600);
	const minutes = math.floor((total % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m ${total % 60}s`;
}

/** What a reward slot shows: a coin (money), a picture, or a short text (perks). */
interface RewardDisplay {
	name: string;
	image?: string;
	text?: string;
	coin?: boolean;
}

function getRewardDisplay(reward: QuestReward): RewardDisplay {
	if (reward.kind === "Money") return { name: `${formatNumber(reward.amount)}$`, coin: true };
	if (reward.kind === "Feature")
		return { name: FEATURES[reward.feature].displayName, image: FEATURES[reward.feature].image };
	if (reward.kind === "Perk") return { name: PERKS[reward.perk].displayName, text: PERKS[reward.perk].label };
	// Minutes of the tank's income: the amount depends on the tank when it is claimed
	if (reward.kind === "IncomeMinutes") return { name: `${reward.minutes} min income`, coin: true };
	if (reward.kind === "OceanPoints")
		return { name: `${formatShort(reward.amount)} points`, image: FEATURES.Ocean.image };
	if (reward.kind === "Title") return { name: COSMETICS[reward.title].displayName, text: "TITLE" };
	if (reward.kind === "Decor") return { name: COSMETICS[reward.decor].displayName, text: "DECOR" };
	const companion = COMPANION_TYPES[reward.companion];
	return { name: companion.displayName, image: companion.image };
}

/** Picture of what a quest counts, in the disc left of its card (money: a coin). */
function getStatImage(config: QuestConfig): string | undefined {
	const stat: QuestStat = config.stat;
	if (stat === "FishInTank") return FISH_ICONS.Clownfish.Normal;
	if (stat === "OceanPoints" || stat === "FishReleased") return FEATURES.Ocean.image;
	if (stat === "CompanionStat") return config.companion && COMPANION_TYPES[config.companion].image;
	if (stat === "SpeciesHatched") return config.fishType && FISH_ICONS[config.fishType].Normal;
	if (stat === "VariantHatched") return FISH_ICONS.Clownfish[config.variant ?? "Normal"];
	if (stat === "EggsOpened") return EGG_SPRITES.Common.icon;
	if (stat === "Rebirths") return FEATURES.Rebirth.image;
	if (stat === "IndexCells") return V2_IMAGES.iconFishIndex;
	return undefined;
}

function Tab(props: { label: string; active: boolean; badge: boolean; order: number; onSelect: () => void }) {
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
			overlay={props.badge && <NotifBadge key="Badge" size={22} position={new UDim2(1, -4, 0, 2)} />}
		/>
	);
}

/** Square reward slot with its name on a chip over its bottom edge (FigCraft redesign-v2: RewardSlot). */
function RewardSlot(props: { reward: RewardDisplay; order: number }) {
	const { reward } = props;
	return (
		<ItemSlot
			key="Reward"
			layoutOrder={props.order}
			size={REWARD_SIZE}
			palette={PALETTES.lagoon}
			image={reward.image}
			imageScale={new Vector2(0.88, 0.88)}
		>
			{reward.coin && (
				<CoinIcon
					key="Coin"
					size={40}
					position={UDim2.fromScale(0.5, 0.45)}
					anchorPoint={new Vector2(0.5, 0.5)}
					zIndex={3}
				/>
			)}
			{reward.text !== undefined && (
				<textlabel
					key="Text"
					Size={new UDim2(1, 0, 1, -8)}
					BackgroundTransparency={1}
					Font={FONT_BOLD} // "+1s": in Luckiest Guy the "s" reads like a 5
					Text={reward.text}
					TextSize={24}
					TextColor3={WHITE}
					ZIndex={3}
				>
					<TextStroke color={PALETTES.lagoon.shadow} thickness={2.5} />
				</textlabel>
			)}
			<Chip
				key="Name"
				text={reward.name.upper()}
				color={NAVY.windowBottom}
				textColor={WHITE}
				height={20}
				textSize={12}
				position={new UDim2(0.5, 0, 1, -10)}
				anchorPoint={new Vector2(0.5, 0)}
				zIndex={5}
			/>
		</ItemSlot>
	);
}

/**
 * One quest (FigCraft redesign-v2: QuestCard): icon disc, title, description, progress bar, reward slot
 * and its claim button; a story quest wears its line's tag on the card's top edge.
 */
function QuestCard(props: {
	quest: QuestProgress;
	passes: readonly GamePass[];
	order: number;
	onClaim: () => void;
	onBuyPass: (pass: GamePass) => void;
}) {
	const line = getStoryLine(props.quest.id);
	const { quest } = props;
	const config = getQuestConfig(quest.id);
	if (!config) return undefined;
	const claimable = isClaimable(quest, props.passes);
	// A paid line's quest without its pass: what it would give, with the pass it needs instead of a progress bar
	const pass = line !== undefined && isQuestLocked(quest.id, props.passes) ? STORY_LINES[line].requiresPass : undefined;
	const ratio = math.clamp(quest.progress / config.target, 0, 1);
	const reward = config.rewards[0] !== undefined ? getRewardDisplay(config.rewards[0]) : undefined;
	const unit = config.stat === "CoinMoney" || config.stat === "MoneyHeld" ? "$" : "";
	const statImage = getStatImage(config);
	const infoWidth =
		INNER_WIDTH -
		CARD_PADDING * 2 -
		(ICON_SIZE + CARD_GAP) -
		(reward ? REWARD_SIZE + CARD_GAP : 0) -
		(claimable || pass !== undefined ? CLAIM_SIZE.X + CARD_GAP : 0);

	return (
		<Card
			key={quest.id}
			layoutOrder={props.order}
			highlight={claimable ? PALETTES.gold.base : undefined}
			overlay={
				line !== undefined && (
					<Chip
						key="LineTag"
						text={STORY_LINES[line].displayName.upper()}
						color={LINE_PALETTES[line].base}
						textColor={WHITE}
						textStroke={LINE_PALETTES[line].shadow}
						font={FONT_TITLE}
						textSize={14}
						height={22}
						position={UDim2.fromOffset(18, -11)}
						zIndex={4}
					/>
				)
			}
		>
			<uipadding
				PaddingTop={new UDim(0, CARD_PADDING + 2)}
				PaddingBottom={new UDim(0, CARD_PADDING + 4)}
				PaddingLeft={new UDim(0, CARD_PADDING)}
				PaddingRight={new UDim(0, CARD_PADDING)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, CARD_GAP)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<frame
				key="QuestIcon"
				LayoutOrder={1}
				Size={UDim2.fromOffset(ICON_SIZE, ICON_SIZE)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<uigradient Color={new ColorSequence(Color3.fromHex("#3B6CA6"), NAVY.cardBottom)} Rotation={90} />
				<uistroke Color={OUTLINE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
				{statImage !== undefined ? (
					<imagelabel
						key="Image"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={UDim2.fromScale(0.5, 0.5)}
						Size={UDim2.fromScale(0.92, 0.92)}
						BackgroundTransparency={1}
						Image={statImage}
						ScaleType={Enum.ScaleType.Fit}
					/>
				) : (
					<CoinIcon
						key="Coin"
						size={42}
						position={UDim2.fromScale(0.5, 0.5)}
						anchorPoint={new Vector2(0.5, 0.5)}
					/>
				)}
			</frame>
			<frame
				key="Info"
				LayoutOrder={2}
				Size={UDim2.fromOffset(infoWidth, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
			>
				<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
				<textlabel
					key="Title"
					LayoutOrder={1}
					Size={new UDim2(1, 0, 0, 26)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={config.title}
					TextSize={22}
					TextColor3={WHITE}
					TextXAlignment={Enum.TextXAlignment.Left}
				>
					<TextStroke thickness={2.5} />
				</textlabel>
				<textlabel
					key="Description"
					LayoutOrder={2}
					Size={
						new UDim2(1, 0, 0, getWrappedHeight(config.description, DESCRIPTION_SIZE, FONT_BOLD, infoWidth))
					}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={config.description}
					TextSize={DESCRIPTION_SIZE}
					TextColor3={NAVY.muted}
					TextWrapped={true}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
				{pass !== undefined ? (
					<Chip
						key="Locked"
						layoutOrder={3}
						text={`LOCKED: NEEDS THE ${GAME_PASSES[pass].displayName.upper()}`}
						color={PALETTES.purple.base}
						textColor={WHITE}
						textStroke={PALETTES.purple.shadow}
						height={22}
						textSize={13}
					/>
				) : (
					<ProgressBar
						key="ProgressBar"
						layoutOrder={3}
						size={new UDim2(1, 0, 0, 22)}
						ratio={ratio}
						palette={ratio >= 1 ? PALETTES.gold : PALETTES.green}
						text={
							quest.claimed
								? "Done"
								: `${formatNumber(quest.progress)} / ${formatNumber(config.target)}${unit}`
						}
					/>
				)}
			</frame>
			{reward && <RewardSlot reward={reward} order={3} />}
			{claimable && (
				<Button3D
					key="Claim"
					layoutOrder={4}
					palette={PALETTES.green}
					size={UDim2.fromOffset(CLAIM_SIZE.X, CLAIM_SIZE.Y)}
					text="CLAIM!"
					textSize={22}
					onClick={props.onClaim}
				/>
			)}
			{pass !== undefined && (
				<Button3D
					key="BuyPass"
					layoutOrder={4}
					palette={PALETTES.purple}
					size={UDim2.fromOffset(CLAIM_SIZE.X, CLAIM_SIZE.Y)}
					text="BUY"
					textSize={22}
					disabled={GAME_PASSES[pass].id <= 0}
					onClick={() => props.onBuyPass(pass)}
				/>
			)}
		</Card>
	);
}

/** Empty tab (FigCraft: EmptyState), with the countdown to the next board for daily / weekly. */
function EmptyState(props: { title: string; resetCategory?: QuestBoardCategory; order: number }) {
	const [now, setNow] = useBinding(Workspace.GetServerTimeNow());
	useEffect(() => {
		const connection = RunService.Heartbeat.Connect(() => setNow(Workspace.GetServerTimeNow()));
		return () => connection.Disconnect();
	}, []);
	const category = props.resetCategory;

	return (
		<Card key="Empty" layoutOrder={props.order}>
			<uipadding PaddingTop={new UDim(0, 22)} PaddingBottom={new UDim(0, 22)} />
			<uilistlayout
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<textlabel
				key="Title"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 24)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={props.title}
				TextSize={18}
				TextColor3={WHITE}
			>
				<TextStroke />
			</textlabel>
			{category && (
				<textlabel
					key="Reset"
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={now.map((time) => {
						const resetAt = getQuestPeriodEnd(category, getQuestPeriod(category, time));
						return `New quests in ${formatDuration(resetAt - time)}`;
					})}
					TextSize={15}
					TextColor3={NAVY.muted}
				/>
			)}
		</Card>
	);
}

/** Quest book (FigCraft redesign-v2: QuestPanel_V2): story, daily and weekly tabs. The server counts and rewards. */
export function QuestPanel(props: QuestPanelProps) {
	const [tab, setTab] = useState<QuestCategory>("Story");
	const quests = getTabQuests(props.quests, tab);

	const tabs = TABS.map(({ category, label }, index) => (
		<Tab
			key={category}
			label={label}
			order={index}
			active={category === tab}
			badge={getTabQuests(props.quests, category).some((quest) => isClaimable(quest, props.passes))}
			onSelect={() => setTab(category)}
		/>
	));

	let content: React.Element[];
	if (quests.size() > 0) {
		content = quests.map((quest, index) => (
			<QuestCard
				key={quest.id}
				quest={quest}
				passes={props.passes}
				order={index}
				onClaim={() => props.onClaim(quest.id)}
				onBuyPass={props.onBuyPass}
			/>
		));
	} else if (tab === "Story") {
		content = [<EmptyState key="Empty" title="You finished every story quest! More are coming soon." order={0} />];
	} else {
		const name = tab === "Daily" ? "daily" : "weekly";
		content = [
			<EmptyState key="Empty" title={`No ${name} quests yet. Come back soon!`} resetCategory={tab} order={0} />,
		];
	}

	return (
		<Panel title="QUESTS" width={QUEST_PANEL_WIDTH} onClose={props.onClose}>
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
					Padding={new UDim(0, TAB_GAP)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{tabs}
			</frame>
			<frame
				key="Content"
				LayoutOrder={2}
				Size={UDim2.fromOffset(INNER_WIDTH, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
			>
				{/* Room for the first card's line tag, above its top edge */}
				<uipadding PaddingTop={new UDim(0, 6)} />
				<uilistlayout Padding={new UDim(0, 18)} SortOrder={Enum.SortOrder.LayoutOrder} />
				{content}
			</frame>
		</Panel>
	);
}
