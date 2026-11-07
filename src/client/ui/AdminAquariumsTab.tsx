import React, { useEffect, useState } from "@rbxts/react";
import { formatShort } from "shared/format";
import { ADMIN_TANKS_REFRESH, AdminTankFish, AdminTankInfo } from "shared/types/admin";
import { FISH_TYPES, FishType, getFishIndexOrder, isEasterEgg } from "shared/types/fish";
import { FishVariant, VARIANT_ORDER } from "shared/types/variants";
import { Button3D, Card, Chip, ItemSlot, TextStroke } from "./kit";
import { PANEL_INNER_WIDTH } from "./Panel";
import { FISH_ICONS, FONT_BOLD, FONT_TITLE, getFishRarity, NAVY, OUTLINE, PALETTES, VARIANT_PALETTES } from "./theme";

const WHITE = new Color3(1, 1, 1);
const PLAYER_ROW = 94;
const AVATAR = 64;
const BOX = 34;
// The tank's fish: 6 a row, three rows shown, the rest scrolls
const SLOT = 78;
const SLOT_DEPTH = 4;
const GAP = 12;
const COLUMNS = 6;
const GRID_ROOM = 10; // around the grid inside its scrolling frame: the remove buttons overhang the slots
const GRID_MAX_HEIGHT = GRID_ROOM + 3 * (SLOT + SLOT_DEPTH + GAP);
const REMOVE_SIZE = 28;
const ARMED_TIME = 3; // seconds a REMOVE? cover waits for its confirmation
// Add a fish: the species strip
const PICK = 64;
const PICK_GAP = 9;
const STRIP_HEIGHT = PICK + 16;
const VARIANT_BUTTON = new Vector2(94, 40);

/** The tab's intents (UiController): the server checks the admin right again for each one (AdminService). */
export interface AdminTankActions {
	onRequestTanks: () => void;
	subscribeTanks: (listener: (tanks: AdminTankInfo[]) => void) => () => void;
	onRemoveFish: (userId: number, fishId: number) => void;
	onAddFish: (userId: number, fishType: FishType, variant: FishVariant) => void;
	onSetLeaderboardBan: (userId: number, banned: boolean) => void;
}

function headshot(userId: number): string {
	return `rbxthumb://type=AvatarHeadShot&id=${userId}&w=150&h=150`;
}

function Avatar(props: { userId: number; size: number; position: UDim2 }) {
	return (
		<imagelabel
			key="Avatar"
			Position={props.position}
			Size={UDim2.fromOffset(props.size, props.size)}
			BackgroundColor3={PALETTES.navy.light}
			Image={headshot(props.userId)}
			ZIndex={3}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uistroke Color={WHITE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
		</imagelabel>
	);
}

function Label(props: { text: string; position: UDim2; size: Vector2; textSize: number; title?: boolean; color?: Color3 }) {
	return (
		<textlabel
			Position={props.position}
			Size={UDim2.fromOffset(props.size.X, props.size.Y)}
			BackgroundTransparency={1}
			Font={props.title ? FONT_TITLE : FONT_BOLD}
			Text={props.text}
			TextSize={props.textSize}
			TextColor3={props.color ?? WHITE}
			TextXAlignment={Enum.TextXAlignment.Left}
			TextTruncate={Enum.TextTruncate.AtEnd}
			ZIndex={3}
		>
			{props.title && <TextStroke thickness={2.5} />}
		</textlabel>
	);
}

/** A white tick drawn with two rounded bars (no glyph: the fonts may lack one). */
function Tick() {
	const bar = (key: string, position: Vector2, length: number, rotation: number) => (
		<frame
			key={key}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={UDim2.fromOffset(position.X, position.Y)}
			Size={UDim2.fromOffset(length, 5)}
			Rotation={rotation}
			BackgroundColor3={WHITE}
			BorderSizePixel={0}
			ZIndex={5}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
		</frame>
	);
	return (
		<>
			{bar("Short", new Vector2(11.5, 20), 10, 45)}
			{bar("Long", new Vector2(20, 16.5), 19, -48)}
		</>
	);
}

/**
 * The LB BAN checkbox (FigCraft admin-panel: LbBan): red with a tick when the player is kept off the leaderboards.
 * A test profile is off them anyway: a grey tick, "TEST", not clickable.
 */
function LbBanBox(props: { banned: boolean; test: boolean; position: UDim2; onToggle: () => void }) {
	const checked = props.banned || props.test;
	const palette = props.test ? PALETTES.grey : PALETTES.red;
	return (
		<textbutton
			key="LbBan"
			Position={props.position}
			Size={UDim2.fromOffset(112, BOX)}
			BackgroundTransparency={1}
			Text=""
			AutoButtonColor={false}
			Active={!props.test}
			ZIndex={3}
			Event={{ Activated: () => !props.test && props.onToggle() }}
		>
			<frame
				key="Box"
				Size={UDim2.fromOffset(BOX, BOX)}
				BackgroundColor3={checked ? palette.base : Color3.fromHex("#0F2236")}
				BorderSizePixel={0}
				ZIndex={4}
			>
				<uicorner CornerRadius={new UDim(0, 9)} />
				<uistroke
					Color={checked ? OUTLINE : Color3.fromHex("#9FC3E8")}
					Thickness={3}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				{checked && <Tick />}
			</frame>
			<textlabel
				key="Caption"
				Position={UDim2.fromOffset(BOX + 8, 0)}
				Size={UDim2.fromOffset(70, BOX)}
				BackgroundTransparency={1}
				Font={FONT_BOLD}
				Text={props.test ? "TEST" : "LB BAN"}
				TextSize={18}
				TextColor3={props.test ? PALETTES.grey.light : props.banned ? PALETTES.red.light : NAVY.muted}
				TextXAlignment={Enum.TextXAlignment.Left}
				ZIndex={4}
			/>
		</textbutton>
	);
}

function incomeText(tank: AdminTankInfo): string {
	return `${formatShort(tank.income)} $/S`;
}

function SectionTitle(props: { text: string; order: number }) {
	return (
		<textlabel
			key="Section"
			LayoutOrder={props.order}
			Size={new UDim2(1, 0, 0, 24)}
			BackgroundTransparency={1}
			Font={FONT_BOLD}
			Text={props.text}
			TextSize={18}
			TextColor3={NAVY.muted}
			TextXAlignment={Enum.TextXAlignment.Left}
		/>
	);
}

/** One player of the server (FigCraft admin-panel: Player_*): avatar, name, chips, LB BAN, MANAGE. */
function PlayerRow(props: { tank: AdminTankInfo; order: number; onManage: () => void; onToggleBan: () => void }) {
	const { tank } = props;
	return (
		<Card key={`Player${tank.userId}`} layoutOrder={props.order}>
			<frame key="Row" Size={new UDim2(1, 0, 0, PLAYER_ROW)} BackgroundTransparency={1}>
				<Avatar userId={tank.userId} size={AVATAR} position={UDim2.fromOffset(14, 15)} />
				<Label
					text={tank.name.upper()}
					position={UDim2.fromOffset(90, 10)}
					size={new Vector2(290, 34)}
					textSize={24}
					title={true}
				/>
				<frame
					key="Chips"
					Position={UDim2.fromOffset(90, 50)}
					Size={UDim2.fromOffset(300, 24)}
					BackgroundTransparency={1}
					ZIndex={3}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 6)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<Chip
						key="Rebirth"
						layoutOrder={1}
						text={tank.rebirths > 0 ? `REBIRTH ${tank.rebirths}` : "NO REBIRTH"}
						color={PALETTES.purple.base}
						height={24}
						textSize={14}
						zIndex={3}
					/>
					<Chip
						key="Fish"
						layoutOrder={2}
						text={`${tank.fish.size()}/${tank.capacity}`}
						color={NAVY.inactiveText}
						height={24}
						textSize={14}
						zIndex={3}
					/>
					<Chip
						key="Income"
						layoutOrder={3}
						text={incomeText(tank)}
						color={PALETTES.gold.base}
						height={24}
						textSize={14}
						zIndex={3}
					/>
				</frame>
				<LbBanBox
					banned={tank.leaderboardBanned}
					test={tank.testProfile}
					position={new UDim2(1, -136, 0, 6)}
					onToggle={props.onToggleBan}
				/>
				<Button3D
					key="Manage"
					palette={PALETTES.lagoon}
					size={UDim2.fromOffset(120, 38)}
					position={new UDim2(1, -16, 0, 46)}
					anchorPoint={new Vector2(1, 0)}
					depth={5}
					zIndex={3}
					text="MANAGE"
					textSize={18}
					onClick={props.onManage}
				/>
			</frame>
		</Card>
	);
}

/** A fish of the tank: its sticker on its variant's colour, a red X; armed, a REMOVE? cover that confirms. */
function FishSlot(props: { fish: AdminTankFish; armed: boolean; onArm: () => void; onConfirm: () => void }) {
	const { fish } = props;
	return (
		<frame key={`Fish${fish.id}`} Size={UDim2.fromOffset(SLOT, SLOT + SLOT_DEPTH)} BackgroundTransparency={1}>
			<ItemSlot
				size={SLOT}
				palette={VARIANT_PALETTES[fish.variant]}
				image={FISH_ICONS[fish.fishType][fish.variant]}
				shiny={fish.variant === "Shiny" || fish.variant === "Galaxy"}
				zIndex={2}
			/>
			{props.armed ? (
				<textbutton
					key="Confirm"
					Size={UDim2.fromOffset(SLOT, SLOT)}
					BackgroundColor3={PALETTES.red.dark}
					BackgroundTransparency={0.1}
					Font={FONT_TITLE}
					Text="REMOVE?"
					TextSize={15}
					TextColor3={WHITE}
					AutoButtonColor={false}
					ZIndex={8}
					Event={{ Activated: props.onConfirm }}
				>
					<uicorner CornerRadius={new UDim(0, 16)} />
					<uistroke Color={OUTLINE} Thickness={3} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					<TextStroke color={PALETTES.red.shadow} thickness={2} />
				</textbutton>
			) : (
				<Button3D
					key="Remove"
					palette={PALETTES.red}
					size={UDim2.fromOffset(REMOVE_SIZE, REMOVE_SIZE)}
					position={UDim2.fromOffset(SLOT - REMOVE_SIZE + 6, -8)}
					radius={new UDim(0.5, 0)}
					depth={3}
					zIndex={8}
					text="X"
					textSize={15}
					onClick={props.onArm}
				/>
			)}
		</frame>
	);
}

/** One species of the ADD A FISH strip. */
function SpeciesPick(props: { fishType: FishType; order: number; selected: boolean; onSelect: () => void }) {
	return (
		<textbutton
			key={props.fishType}
			LayoutOrder={props.order}
			Size={UDim2.fromOffset(PICK, PICK)}
			BackgroundColor3={PALETTES.navy.base}
			Text=""
			AutoButtonColor={false}
			ZIndex={3}
			Event={{ Activated: props.onSelect }}
		>
			<uicorner CornerRadius={new UDim(0, 12)} />
			<uistroke
				Color={props.selected ? PALETTES.gold.base : OUTLINE}
				Thickness={props.selected ? 4 : 3}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>
			<imagelabel
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={UDim2.fromScale(0.5, 0.5)}
				Size={UDim2.fromScale(0.9, 0.9 / 1.6)}
				BackgroundTransparency={1}
				Image={FISH_ICONS[props.fishType].Normal}
				ScaleType={Enum.ScaleType.Fit}
				ZIndex={4}
			/>
		</textbutton>
	);
}

/** ADD A FISH (FigCraft admin-panel: AddFish): the species strip, the variants (an easter egg is Normal only), ADD. */
function AddFish(props: { order: number; onAdd: (fishType: FishType, variant: FishVariant) => void }) {
	const species = getFishIndexOrder();
	const [fishType, setFishType] = useState<FishType>(species[0]);
	const [variant, setVariant] = useState<FishVariant>("Normal");
	const secret = isEasterEgg(fishType);
	const chosen = secret ? "Normal" : variant;
	const rarity = getFishRarity(fishType);
	return (
		<Card key="AddFish" layoutOrder={props.order}>
			<frame key="Body" Size={new UDim2(1, 0, 0, 236)} BackgroundTransparency={1}>
				<Label text="ADD A FISH" position={UDim2.fromOffset(18, 8)} size={new Vector2(300, 30)} textSize={22} title={true} />
				<scrollingframe
					key="Strip"
					Position={UDim2.fromOffset(12, 42)}
					Size={new UDim2(1, -24, 0, STRIP_HEIGHT)}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					CanvasSize={UDim2.fromOffset(species.size() * (PICK + PICK_GAP) + 12, 0)}
					ScrollingDirection={Enum.ScrollingDirection.X}
					ScrollBarThickness={6}
					ScrollBarImageColor3={NAVY.muted}
					HorizontalScrollBarInset={Enum.ScrollBarInset.ScrollBar}
					ZIndex={3}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, PICK_GAP)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<uipadding PaddingLeft={new UDim(0, 6)} PaddingTop={new UDim(0, 4)} />
					{species.map((speciesType, index) => (
						<SpeciesPick
							key={speciesType}
							fishType={speciesType}
							order={index}
							selected={speciesType === fishType}
							onSelect={() => setFishType(speciesType)}
						/>
					))}
				</scrollingframe>
				<Label
					text={`${FISH_TYPES[fishType].displayName.upper()}  -  ${rarity.label}`}
					position={UDim2.fromOffset(18, 126)}
					size={new Vector2(420, 28)}
					textSize={18}
					color={rarity.color}
				/>
				<frame
					key="Variants"
					Position={UDim2.fromOffset(18, 170)}
					Size={UDim2.fromOffset(410, VARIANT_BUTTON.Y + 6)}
					BackgroundTransparency={1}
					ZIndex={3}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 10)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{VARIANT_ORDER.map((v, index) => (
						<Button3D
							key={v}
							layoutOrder={index}
							palette={v === chosen ? VARIANT_PALETTES[v] : PALETTES.navy}
							size={UDim2.fromOffset(VARIANT_BUTTON.X, VARIANT_BUTTON.Y)}
							depth={5}
							zIndex={3}
							text={v.upper()}
							textSize={16}
							textColor={v === chosen ? undefined : NAVY.inactiveText}
							disabled={secret && v !== "Normal"}
							onClick={() => setVariant(v)}
						/>
					))}
				</frame>
				<Button3D
					key="Add"
					palette={PALETTES.green}
					size={UDim2.fromOffset(108, 50)}
					position={new UDim2(1, -16, 0, 164)}
					anchorPoint={new Vector2(1, 0)}
					zIndex={3}
					text="ADD"
					textSize={24}
					onClick={() => props.onAdd(fishType, chosen)}
				/>
			</frame>
		</Card>
	);
}

/** One player's aquarium: back, the owner and LB BAN, the fish (remove), ADD A FISH. */
function TankView(props: { tank: AdminTankInfo; actions: AdminTankActions; onBack: () => void }) {
	const { tank, actions } = props;
	const [armed, setArmed] = useState<number | undefined>(undefined);
	// An armed cover gives up after a while: a stray click never removes a fish later on
	useEffect(() => {
		if (armed === undefined) return;
		const thread = task.delay(ARMED_TIME, () => setArmed(undefined));
		return () => task.cancel(thread);
	}, [armed]);
	const rows = math.max(1, math.ceil(tank.fish.size() / COLUMNS));
	const gridHeight = GRID_ROOM * 2 + rows * (SLOT + SLOT_DEPTH) + (rows - 1) * GAP;
	return (
		<>
			<Card key="Owner" layoutOrder={1} highlight={PALETTES.gold.base}>
				<frame key="Row" Size={new UDim2(1, 0, 0, 76)} BackgroundTransparency={1}>
					<Button3D
						key="Back"
						palette={PALETTES.navy}
						size={UDim2.fromOffset(96, 44)}
						position={UDim2.fromOffset(12, 13)}
						depth={5}
						zIndex={3}
						text="BACK"
						textSize={20}
						onClick={props.onBack}
					/>
					<Avatar userId={tank.userId} size={56} position={UDim2.fromOffset(120, 10)} />
					<Label
						text={tank.name.upper()}
						position={UDim2.fromOffset(186, 6)}
						size={new Vector2(230, 34)}
						textSize={24}
						title={true}
					/>
					<Label
						text={`${tank.rebirths > 0 ? `Rebirth ${tank.rebirths}` : "No rebirth"} - ${formatShort(tank.income)} $/s`}
						position={UDim2.fromOffset(186, 40)}
						size={new Vector2(230, 24)}
						textSize={16}
						color={NAVY.muted}
					/>
					<LbBanBox
						banned={tank.leaderboardBanned}
						test={tank.testProfile}
						position={new UDim2(1, -124, 0, 21)}
						onToggle={() => actions.onSetLeaderboardBan(tank.userId, !tank.leaderboardBanned)}
					/>
				</frame>
			</Card>
			<SectionTitle text={`FISH  ${tank.fish.size()} / ${tank.capacity}`} order={2} />
			<scrollingframe
				key="Fish"
				LayoutOrder={3}
				Size={UDim2.fromOffset(PANEL_INNER_WIDTH, math.min(gridHeight, GRID_MAX_HEIGHT))}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				CanvasSize={UDim2.fromOffset(0, gridHeight)}
				ScrollingDirection={Enum.ScrollingDirection.Y}
				ScrollBarThickness={6}
				ScrollBarImageColor3={NAVY.muted}
				ScrollBarImageTransparency={gridHeight > GRID_MAX_HEIGHT ? 0 : 1}
				VerticalScrollBarInset={Enum.ScrollBarInset.ScrollBar}
			>
				<uigridlayout
					CellSize={UDim2.fromOffset(SLOT, SLOT + SLOT_DEPTH)}
					CellPadding={UDim2.fromOffset(GAP, GAP)}
					FillDirectionMaxCells={COLUMNS}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				<uipadding PaddingTop={new UDim(0, GRID_ROOM)} PaddingLeft={new UDim(0, GRID_ROOM)} />
				{tank.fish.map((fish) => (
					<FishSlot
						key={`Fish${fish.id}`}
						fish={fish}
						armed={armed === fish.id}
						onArm={() => setArmed(fish.id)}
						onConfirm={() => {
							setArmed(undefined);
							actions.onRemoveFish(tank.userId, fish.id);
						}}
					/>
				))}
			</scrollingframe>
			<AddFish order={4} onAdd={(fishType, variant) => actions.onAddFish(tank.userId, fishType, variant)} />
		</>
	);
}

/**
 * Aquariums tab (FigCraft admin-panel: AdminAquariums_Mockup): the players of this server (LB BAN, MANAGE), then one
 * player's aquarium. Asks the server for the tanks on open and every ADMIN_TANKS_REFRESH seconds while open.
 */
export function AquariumsTab(props: { actions: AdminTankActions }) {
	const { actions } = props;
	const [tanks, setTanks] = useState<AdminTankInfo[] | undefined>(undefined);
	const [selected, setSelected] = useState<number | undefined>(undefined);
	useEffect(() => {
		const disconnect = actions.subscribeTanks((list) => setTanks(list));
		actions.onRequestTanks();
		let open = true;
		task.spawn(() => {
			while (open) {
				task.wait(ADMIN_TANKS_REFRESH);
				if (open) actions.onRequestTanks();
			}
		});
		return () => {
			open = false;
			disconnect();
		};
	}, []);

	// The managed player left: back to the list
	const tank = selected !== undefined ? tanks?.find((entry) => entry.userId === selected) : undefined;
	return (
		<frame
			key="Aquariums"
			LayoutOrder={2}
			Size={UDim2.fromOffset(PANEL_INNER_WIDTH, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
		>
			<uilistlayout Padding={new UDim(0, 12)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{tank ? (
				<TankView key={`Tank${tank.userId}`} tank={tank} actions={actions} onBack={() => setSelected(undefined)} />
			) : (
				<>
					<SectionTitle
						text={tanks ? `PLAYERS ON THIS SERVER  (${tanks.size()})` : "LOADING..."}
						order={1}
					/>
					{(tanks ?? []).map((entry, index) => (
						<PlayerRow
							key={`Player${entry.userId}`}
							tank={entry}
							order={2 + index}
							onManage={() => setSelected(entry.userId)}
							onToggleBan={() => actions.onSetLeaderboardBan(entry.userId, !entry.leaderboardBanned)}
						/>
					))}
				</>
			)}
		</frame>
	);
}
