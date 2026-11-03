import React, { useBinding, useEffect, useRef, useState } from "@rbxts/react";
import { Players, RunService, Workspace } from "@rbxts/services";
import { decodeFoodRefills, FOOD_REFILL_TIME, FOOD_RESERVE_ATTRIBUTES, FOOD_RESERVE_SLOTS } from "shared/types/food";
import { TextStroke } from "./kit";
import { FONT_BOLD, FONT_TITLE, NAVY, OUTLINE, PALETTES, verticalGradient } from "./theme";

// FigCraft food-reserve.figcraft (FoodReserve_Mockup)
const SLOT_SIZE = 52;
const SLOT_GAP = 10;
const PADDING = 16;
const PLATE_HEIGHT = 76;
const PLATE_DEPTH = 6;
const PELLET_SIZE = 38;
const CHIP_HEIGHT = 32;
const CHIP_RISE = 18; // the chip sits on the plate's top edge, this much above it
const BOTTOM_MARGIN = 16;
const SIDE_GAP = 12; // kept from the bottom-left buttons
const ALARM_TIME = 0.7; // seconds the plate flashes red after a click with no food
const SHAKE_PIXELS = 7;
const SHAKE_SPEED = 55; // radians per second
const WHITE = new Color3(1, 1, 1);
// The pellet of the game (FoodService's brown ball, PelicanChargesController's colours)
const PELLET_LIGHT = Color3.fromHex("#F0A65A");
const PELLET_DARK = Color3.fromHex("#A85A1C");
const PELLET_SHINE = Color3.fromHex("#FFE2B8");
const REFILL_TRANSPARENCY = 0.45;

/** The reserve's whole height (chip, plate and bevel), in design pixels. */
const RESERVE_HEIGHT = CHIP_RISE + PLATE_HEIGHT + PLATE_DEPTH;

/** Pixels from the bottom of the screen to the top of the reserve: the onboarding card sits above it. */
export function getFoodReserveTop(scale: number): number {
	return (BOTTOM_MARGIN + RESERVE_HEIGHT) * scale;
}

export interface FoodReserveProps {
	scale: number;
	/** Pixels taken by the buttons of the bottom-left corner ("Back to lobby", Customize): the reserve never covers them. */
	leftClear: number;
	/** Called back on every click on the water while the reserve is empty (AquariumInteractionController). */
	subscribeDenied: (listener: () => void) => () => void;
}

interface Reserve {
	slots: number;
	refills: number[];
}

function readReserve(): Reserve {
	const player = Players.LocalPlayer;
	const slots = player.GetAttribute(FOOD_RESERVE_ATTRIBUTES.slots);
	return {
		slots: typeIs(slots, "number") ? slots : FOOD_RESERVE_SLOTS,
		refills: decodeFoodRefills(player.GetAttribute(FOOD_RESERVE_ATTRIBUTES.refills)),
	};
}

function useViewportWidth(): number {
	const read = () => Workspace.CurrentCamera?.ViewportSize.X ?? 0;
	const [width, setWidth] = useState(read);
	useEffect(() => {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		const connection = camera.GetPropertyChangedSignal("ViewportSize").Connect(() => setWidth(read()));
		return () => connection.Disconnect();
	}, []);
	return width;
}

/** A food pellet: round, lit from the top left, a shine spot (also the onboarding card's Feed icon). */
export function FoodPellet(props: {
	size?: UDim2;
	transparency?: number;
	scale?: React.Binding<number>;
	visible?: React.Binding<boolean>;
}) {
	const transparency = props.transparency ?? 0;
	return (
		<frame
			key="Pellet"
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={UDim2.fromScale(0.5, 0.5)}
			Size={props.size ?? UDim2.fromOffset(PELLET_SIZE, PELLET_SIZE)}
			BackgroundColor3={WHITE}
			BackgroundTransparency={transparency}
			BorderSizePixel={0}
			Visible={props.visible}
		>
			{props.scale && <uiscale Scale={props.scale} />}
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uigradient Color={new ColorSequence(PELLET_LIGHT, PELLET_DARK)} Rotation={60} />
			<uistroke Color={OUTLINE} Thickness={3} Transparency={transparency} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
			<frame
				key="Shine"
				Position={UDim2.fromScale(0.2, 0.18)}
				Size={UDim2.fromScale(0.3, 0.22)}
				Rotation={25}
				BackgroundColor3={PELLET_SHINE}
				BackgroundTransparency={1 - 0.85 * (1 - transparency)}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
			</frame>
		</frame>
	);
}

/**
 * The food reserve (tank view, from the onboarding's Feed step): food is free, but only FoodSlots portions are ready
 * at once; an empty slot shows its pellet growing back with the seconds left (each slot refills on its own,
 * FOOD_REFILL_TIME after it was used). A click on the water with none ready flashes the plate red and shakes it.
 * Read from the attributes FoodService publishes on the local player.
 */
export function FoodReserve(props: FoodReserveProps) {
	const [reserve, setReserve] = useState(readReserve);
	const [now, setNow] = useBinding(Workspace.GetServerTimeNow());
	const deniedAt = useRef(-math.huge);

	useEffect(() => {
		const player = Players.LocalPlayer;
		const update = () => setReserve(readReserve());
		const connections = [
			player.GetAttributeChangedSignal(FOOD_RESERVE_ATTRIBUTES.slots).Connect(update),
			player.GetAttributeChangedSignal(FOOD_RESERVE_ATTRIBUTES.refills).Connect(update),
			RunService.RenderStepped.Connect(() => setNow(Workspace.GetServerTimeNow())),
		];
		const unsubscribe = props.subscribeDenied(() => (deniedAt.current = Workspace.GetServerTimeNow()));
		update();
		return () => {
			for (const connection of connections) connection.Disconnect();
			unsubscribe();
		};
	}, []);

	const slots = reserve.slots;
	// The portions still on their way, soonest first: the leftmost empty slot is the next one back
	const waitingAt = (time: number) => {
		const waiting = reserve.refills.filter((refill) => refill > time);
		waiting.sort((a, b) => a < b);
		return waiting;
	};
	const readyAt = (time: number) => math.max(slots - waitingAt(time).size(), 0);
	const alarm = now.map((time) => time - deniedAt.current < ALARM_TIME);

	const width = PADDING * 2 + slots * SLOT_SIZE + (slots - 1) * SLOT_GAP;
	const viewportWidth = useViewportWidth();
	const centerX = math.max(viewportWidth / 2, props.leftClear + SIDE_GAP + (width * props.scale) / 2);

	return (
		<frame
			key="FoodReserve"
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0, centerX, 1, -BOTTOM_MARGIN * props.scale)}
			Size={UDim2.fromOffset(width, RESERVE_HEIGHT)}
			BackgroundTransparency={1}
			ZIndex={2}
		>
			<uiscale Scale={props.scale} />
			<frame
				key="Shaker"
				Position={now.map((time) => {
					const age = time - deniedAt.current;
					if (age >= ALARM_TIME) return UDim2.fromOffset(0, 0);
					return UDim2.fromOffset(math.sin(age * SHAKE_SPEED) * SHAKE_PIXELS * (1 - age / ALARM_TIME), 0);
				})}
				Size={UDim2.fromScale(1, 1)}
				BackgroundTransparency={1}
			>
				<frame
					key="Shadow"
					Position={UDim2.fromOffset(0, CHIP_RISE + PLATE_DEPTH)}
					Size={UDim2.fromOffset(width, PLATE_HEIGHT)}
					BackgroundColor3={NAVY.cardShadow}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 24)} />
					<uistroke Color={OUTLINE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
				</frame>
				<frame
					key="Plate"
					Position={UDim2.fromOffset(0, CHIP_RISE)}
					Size={UDim2.fromOffset(width, PLATE_HEIGHT)}
					BackgroundColor3={WHITE}
					BorderSizePixel={0}
					ZIndex={2}
				>
					<uicorner CornerRadius={new UDim(0, 24)} />
					<uigradient Color={verticalGradient(NAVY.cardTop, NAVY.cardBottom)} Rotation={90} />
					<uistroke
						Color={alarm.map((on) => (on ? PALETTES.red.base : OUTLINE))}
						Thickness={alarm.map((on) => (on ? 4 : 3))}
						ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
					/>
					<frame
						key="Gloss"
						Position={UDim2.fromOffset(8, 5)}
						Size={new UDim2(1, -16, 0, 24)}
						BackgroundColor3={WHITE}
						BackgroundTransparency={0.9}
						BorderSizePixel={0}
					>
						<uicorner CornerRadius={new UDim(0, 12)} />
					</frame>
					{table.create(slots, 0).map((_, index) => {
						// This slot's portion: ready, or back at `refill` (server time)
						const refillOf = (time: number) => waitingAt(time)[index - readyAt(time)];
						const progress = now.map((time) => {
							const refill = refillOf(time);
							return refill === undefined ? 1 : math.clamp(1 - (refill - time) / FOOD_REFILL_TIME, 0, 1);
						});
						return (
							<frame
								key={`Slot${index + 1}`}
								Position={UDim2.fromOffset(PADDING + index * (SLOT_SIZE + SLOT_GAP), (PLATE_HEIGHT - SLOT_SIZE) / 2 + 4)}
								Size={UDim2.fromOffset(SLOT_SIZE, SLOT_SIZE)}
								BackgroundColor3={NAVY.track}
								BorderSizePixel={0}
								ZIndex={3}
							>
								<uicorner CornerRadius={new UDim(0.5, 0)} />
								<uistroke
									Color={alarm.map((on) => (on ? PALETTES.red.dark : OUTLINE))}
									Thickness={3}
									ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
								/>
								<FoodPellet visible={now.map((time) => index < readyAt(time))} />
								<FoodPellet
									transparency={REFILL_TRANSPARENCY}
									scale={progress}
									visible={now.map((time) => index >= readyAt(time))}
								/>
								<textlabel
									key="Seconds"
									Size={UDim2.fromScale(1, 1)}
									BackgroundTransparency={1}
									Font={FONT_BOLD}
									Text={now.map((time) => {
										const refill = refillOf(time);
										return refill === undefined ? "" : tostring(math.max(math.ceil(refill - time), 1));
									})}
									TextSize={20}
									TextColor3={WHITE}
									ZIndex={2}
								>
									<TextStroke thickness={2.5} />
								</textlabel>
							</frame>
						);
					})}
				</frame>
				<frame
					key="Chip"
					AnchorPoint={new Vector2(0.5, 0)}
					Position={UDim2.fromScale(0.5, 0)}
					Size={alarm.map((on) => UDim2.fromOffset(on ? 150 : 110, CHIP_HEIGHT))}
					BackgroundColor3={WHITE}
					BorderSizePixel={0}
					ZIndex={4}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uigradient
						Color={alarm.map((on) =>
							on
								? verticalGradient(PALETTES.red.light, PALETTES.red.base)
								: verticalGradient(PALETTES.amber.light, PALETTES.amber.base),
						)}
						Rotation={90}
					/>
					<uistroke Color={OUTLINE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					<textlabel
						key="Text"
						Position={UDim2.fromOffset(0, 1)}
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text={now.map((time) =>
							time - deniedAt.current < ALARM_TIME ? "REFILLING..." : `FOOD ${readyAt(time)}/${slots}`,
						)}
						TextSize={17}
						TextColor3={WHITE}
						ZIndex={2}
					>
						<uistroke
							Color={alarm.map((on) => (on ? PALETTES.red.shadow : PALETTES.amber.shadow))}
							Thickness={2.5}
							ApplyStrokeMode={Enum.ApplyStrokeMode.Contextual}
						/>
					</textlabel>
				</frame>
			</frame>
		</frame>
	);
}
