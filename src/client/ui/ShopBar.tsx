import React, { useEffect, useState } from "@rbxts/react";
import { Workspace } from "@rbxts/services";
import { EGG_TYPES, EggType, getEggPrice, STARTER_EGG } from "shared/types/eggs";
import { canBuyEggs } from "shared/types/onboarding";
import {
	getFishAndEggs,
	getIncubating,
	getTotalFish,
	hasFreeIncubator,
	isEggUnlocked,
	PlayerData,
} from "shared/types/playerData";
import { EggSlot, SLOT_SIZE } from "./EggSlot";
import { Button3D, NotifBadge, Outline } from "./kit";
import { MONEY_COUNTER_SIZE, MoneyCounter } from "./MoneyCounter";
import { formatShort } from "./Panel";
import { EGG_SPRITES, NAVY, PALETTES, verticalGradient } from "./theme";

/** Eggs in shop order (EggConfig.order). */
function getShopOrder(): EggType[] {
	const eggTypes = new Array<EggType>();
	for (const [eggType] of pairs(EGG_TYPES)) eggTypes.push(eggType);
	eggTypes.sort((a, b) => EGG_TYPES[a].order < EGG_TYPES[b].order);
	return eggTypes;
}

/** Slots on the shelf: with more eggs than this, arrows move it along the eggs (FigCraft redesign-v2: ShopBar_V1). */
const SLOT_COUNT = 6;
const SLOT_GAP = 12;
const SHELF_PADDING = 18;
const SHELF_DEPTH = 6;
const ARROW_SIZE = new Vector2(36, 56);
const ARROW_MARGIN = 14; // shelf edge to arrow
const ARROW_GAP = 12; // arrow to the first / last slot
const SHOP_ORDER = getShopOrder();
/** The shelf keeps room for its arrows when the eggs don't all fit in it. */
const HAS_ARROWS = SHOP_ORDER.size() > SLOT_COUNT;
/** Shelf edge to the first slot. */
const SLOTS_INSET = HAS_ARROWS ? ARROW_MARGIN + ARROW_SIZE.X + ARROW_GAP : SHELF_PADDING;
const SLOTS_WIDTH = SLOT_COUNT * SLOT_SIZE.X + (SLOT_COUNT - 1) * SLOT_GAP;
const SHELF_WIDTH = SLOTS_WIDTH + SLOTS_INSET * 2;
/** How often the arrows look for a ready egg out of view (eggs get ready between two data syncs). */
const READY_CHECK_PERIOD = 0.5;
const MONEY_GAP = 16;
export const BAR_WIDTH = SHELF_WIDTH + MONEY_GAP + MONEY_COUNTER_SIZE.X;
export const BAR_HEIGHT = 10 + SLOT_SIZE.Y + 12 + SHELF_DEPTH;
/** The shelf extends this far above the screen so only its bottom corners look rounded. */
const HIDDEN_TOP = 28;

export interface ShopBarProps {
	data?: PlayerData;
	onBuy: (eggType: EggType) => void;
	onOpen: (eggType: EggType) => void;
}

/**
 * First egg shown when the player hasn't moved the shelf: the window ends on the first egg not unlocked yet
 * (its gate shows what comes next), or on the last egg, so the best eggs the player can buy are in view.
 */
function getAutoStart(data: PlayerData | undefined, order: readonly EggType[]): number {
	let last = order.size() - 1;
	for (let i = 0; i < order.size(); i++) {
		const unlocked = data ? isEggUnlocked(data, order[i]) : EGG_TYPES[order[i]].requires === undefined;
		if (!unlocked) {
			last = i;
			break;
		}
	}
	return math.clamp(last - (SLOT_COUNT - 1), 0, math.max(order.size() - SLOT_COUNT, 0));
}

/** Whether an egg of these types is ready to open (its soonest egg's time has come). */
function hasReadyEgg(data: PlayerData | undefined, eggTypes: readonly EggType[]): boolean {
	if (!data) return false;
	const now = Workspace.GetServerTimeNow();
	return eggTypes.some((eggType) => {
		const hatchAt = getIncubating(data, eggType)[0];
		return hatchAt !== undefined && hatchAt <= now;
	});
}

/** White chevron with a dark outline, pointing left or right (two rotated bars). */
function Chevron(props: { direction: -1 | 1; color: Color3 }) {
	const bar = (key: string, up: boolean) => (
		<frame
			key={key}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={new UDim2(0.5, 0, 0.5, up ? -6 : 6)}
			Size={UDim2.fromOffset(5, 18)}
			Rotation={(up ? -35 : 35) * props.direction}
			BackgroundColor3={props.color}
			BorderSizePixel={0}
			ZIndex={4}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<Outline thickness={2} />
		</frame>
	);
	return (
		<>
			{bar("Up", true)}
			{bar("Down", false)}
		</>
	);
}

/** One of the shelf's arrows: blue when it can move, navy at the end; a red "!" when a ready egg waits that way. */
function ShelfArrow(props: { direction: -1 | 1; enabled: boolean; readyAway: boolean; onClick: () => void }) {
	return (
		<Button3D
			key={props.direction < 0 ? "ArrowLeft" : "ArrowRight"}
			palette={props.enabled ? PALETTES.blue : PALETTES.navy}
			size={UDim2.fromOffset(ARROW_SIZE.X, ARROW_SIZE.Y)}
			position={UDim2.fromOffset(
				props.direction < 0 ? ARROW_MARGIN : SHELF_WIDTH - ARROW_MARGIN - ARROW_SIZE.X,
				HIDDEN_TOP + 22,
			)}
			depth={6}
			radius={14}
			zIndex={2}
			disabled={!props.enabled}
			onClick={props.onClick}
			overlay={props.readyAway && <NotifBadge key="Ready" text="!" size={22} position={UDim2.fromOffset(4, 2)} />}
		>
			<Chevron direction={props.direction} color={props.enabled ? new Color3(1, 1, 1) : NAVY.inactiveText} />
		</Button3D>
	);
}

/** Top-of-screen egg shop (FigCraft redesign-v2: ShopBar): a navy shelf of egg slots, then the money pill. */
export function ShopBar(props: ShopBarProps) {
	const data = props.data;
	const money = data?.money ?? 0;
	const fishAndEggs = data ? getFishAndEggs(data) : 0;

	const order = SHOP_ORDER;
	const showArrows = order.size() > SLOT_COUNT;

	// The shelf follows the player's best eggs until they move it; a new egg unlocking brings it back there
	const autoStart = getAutoStart(data, order);
	const [moved, setMoved] = useState<{ start: number; autoStart: number }>();
	const maxStart = math.max(order.size() - SLOT_COUNT, 0);
	const start = moved && moved.autoStart === autoStart ? math.min(moved.start, maxStart) : autoStart;
	const move = (step: number) => setMoved({ start: math.clamp(start + step, 0, maxStart), autoStart });
	const visible = order.filter((_, index) => index >= start && index < start + SLOT_COUNT);
	const before = order.filter((_, index) => index < start);
	const after = order.filter((_, index) => index >= start + SLOT_COUNT);
	// Re-checked now and then: an egg out of view gets ready between two syncs
	const [, setReadyTick] = useState(0);
	useEffect(() => {
		if (!HAS_ARROWS) return;
		let alive = true;
		task.spawn(() => {
			while (alive) {
				task.wait(READY_CHECK_PERIOD);
				if (alive) setReadyTick(os.clock());
			}
		});
		return () => {
			alive = false;
		};
	}, []);

	// Display only: the server applies the same rules (price, unlock, onboarding) when buying
	const step = data?.onboarding;
	const aquariumFull = data !== undefined && getTotalFish(data) >= data.capacity;
	const slots = new Array<React.Element>();
	visible.forEach((eggType, index) => {
		const config = EGG_TYPES[eggType];
		const eggs = data ? getIncubating(data, eggType) : [];
		const disabled = step === undefined || !canBuyEggs(step);
		const price = getEggPrice(eggType, fishAndEggs);
		const unlocked = data ? isEggUnlocked(data, eggType) : config.requires === undefined;
		const requires = config.requires;
		slots.push(
			<EggSlot
				key={eggType}
				layoutOrder={index}
				icon={EGG_SPRITES[eggType].icon}
				name={config.displayName}
				priceText={price === 0 ? "FREE" : formatShort(price)}
				affordable={money >= price}
				odds={config.odds}
				hatchAt={eggs[0]}
				// At the speed the timers run at now (the Water Hen's): its progress bar keeps the progress made
				hatchTime={config.hatchTime * (data?.incubationMultiplier ?? 1)}
				eggCount={eggs.size()}
				incubators={data?.incubators}
				canBuyAnother={
					data !== undefined &&
					eggs.size() > 0 &&
					unlocked &&
					!disabled &&
					money >= price &&
					hasFreeIncubator(data, eggType)
				}
				gatedHint={!unlocked && requires ? `Buy a ${EGG_TYPES[requires].displayName} to unlock` : undefined}
				disabled={disabled}
				highlight={(step === "BuyEgg" || step === "OpenEgg") && eggType === STARTER_EGG}
				onBuy={() => props.onBuy(eggType)}
				onOpen={() => props.onOpen(eggType)}
				aquariumFull={aquariumFull}
			/>,
		);
	});
	for (let index = slots.size(); index < SLOT_COUNT; index++) {
		slots.push(<EggSlot key={`Locked${index}`} layoutOrder={index} />);
	}

	return (
		<frame
			key="ShopBar"
			AnchorPoint={new Vector2(0.5, 0)}
			Position={UDim2.fromScale(0.5, 0)}
			Size={UDim2.fromOffset(BAR_WIDTH, BAR_HEIGHT)}
			BackgroundTransparency={1}
			ZIndex={2} // the odds tooltips hang below the bar, over the hint line
		>
			<frame
				key="Shelf"
				Position={UDim2.fromOffset(0, -HIDDEN_TOP)}
				Size={UDim2.fromOffset(SHELF_WIDTH, BAR_HEIGHT + HIDDEN_TOP)}
				BackgroundTransparency={1}
			>
				<frame
					key="Shadow"
					Position={UDim2.fromOffset(0, SHELF_DEPTH)}
					Size={new UDim2(1, 0, 1, -SHELF_DEPTH)}
					BackgroundColor3={NAVY.windowShadow}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 28)} />
				</frame>
				<frame
					key="Face"
					Size={new UDim2(1, 0, 1, -SHELF_DEPTH)}
					BackgroundColor3={new Color3(1, 1, 1)}
					BorderSizePixel={0}
					ZIndex={2}
				>
					<uicorner CornerRadius={new UDim(0, 28)} />
					<uigradient Color={verticalGradient(NAVY.windowTop, NAVY.windowBottom)} Rotation={90} />
					<Outline thickness={4} />
					<frame
						key="InnerRim"
						Position={UDim2.fromOffset(7, 7)}
						Size={new UDim2(1, -14, 1, -14)}
						BackgroundTransparency={1}
					>
						<uicorner CornerRadius={new UDim(0, 22)} />
						<uistroke Color={PALETTES.lagoon.light} Transparency={0.75} Thickness={2} />
					</frame>
					{showArrows && (
						<>
							<ShelfArrow
								direction={-1}
								enabled={start > 0}
								readyAway={hasReadyEgg(data, before)}
								onClick={() => move(-1)}
							/>
							<ShelfArrow
								direction={1}
								enabled={start < maxStart}
								readyAway={hasReadyEgg(data, after)}
								onClick={() => move(1)}
							/>
						</>
					)}
					<frame
						key="SlotsRow"
						Position={UDim2.fromOffset(SLOTS_INSET, HIDDEN_TOP + 10)}
						Size={UDim2.fromOffset(SLOTS_WIDTH, SLOT_SIZE.Y)}
						BackgroundTransparency={1}
						ZIndex={2}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							Padding={new UDim(0, SLOT_GAP)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						{slots}
					</frame>
				</frame>
			</frame>
			<frame
				key="MoneyArea"
				Position={UDim2.fromOffset(SHELF_WIDTH + MONEY_GAP, 14)}
				Size={UDim2.fromOffset(MONEY_COUNTER_SIZE.X, MONEY_COUNTER_SIZE.Y)}
				BackgroundTransparency={1}
			>
				<MoneyCounter layoutOrder={1} money={money} />
			</frame>
		</frame>
	);
}
