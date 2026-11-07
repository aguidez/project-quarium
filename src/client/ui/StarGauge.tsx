import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService } from "@rbxts/services";
import { getGuaranteedVariant, getStarVariantOdds, STAR_GOLD_BARS, STAR_MAX_BARS } from "shared/types/stars";
import { FishVariant, VARIANT_ORDER } from "shared/types/variants";
import { Outline, TextStroke } from "./kit";
import { FONT_BOLD, FONT_TITLE, NAVY, OUTLINE, PALETTES, STARFALL_COLORS, VARIANT_PALETTES, verticalGradient } from "./theme";

// FigCraft starfall.figcraft (StarGauge_Mockup), star-gauge-4.figcraft for the 4th bar (V1.1.20)
const PLATE_WIDTH = 104;
const BAR_HEIGHT = 80;
const PLATE_DEPTH = 6;
const TUBE_WIDTH = 44;
const TUBE_TOP = 88;
const TUBE_HEIGHT = BAR_HEIGHT * STAR_MAX_BARS;
const PLATE_HEIGHT = 88 + TUBE_HEIGHT + 44;
const CHIP_WIDTH = 104;
const CHIP_HEIGHT = 44;
const CHIP_GAP = 10;
const BADGE_SIZE = 64;
const CAPTION_HEIGHT = 34;
const RIGHT_MARGIN = 16 + 26; // the caption pill sticks out 26 px right of the plate
const FILL_SPEED = 2.5; // bars per second the fill moves toward its value
const WHITE = new Color3(1, 1, 1);
const STAR_GLYPH = "★";
/** The chips, from the bottom bar up. */
const BAR_VARIANTS: FishVariant[] = ["Anomaly", "Ghost", "Shiny", "Galaxy"];
/** The 4th bar's fill (the Galaxy's): night blue at the bottom to pink on top, like the Galaxy fish. */
const GALAXY_FILL = new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromHex("#FF8AD8")),
	new ColorSequenceKeypoint(0.5, Color3.fromHex("#5B3BFF")),
	new ColorSequenceKeypoint(1, Color3.fromHex("#1B1060")),
]);

export interface StarGaugeProps {
	/** The starfall's gauge so far. */
	bars: number;
	/** The star power kept from an earlier starfall, marked on the tube while a new one fills (0 = none). */
	saved: number;
	/** The player's own variant luck (Lucky ocean, the Lucky pass): the chances shown include it. */
	luck: number;
	/** Its Galaxy luck (the Lucky pass counts x3 there). */
	galaxyLuck: number;
	scale: number;
}

/** "19%"; with one decimal under 10 % ("2.5%", "0.3%": the Galaxy's chances are small). */
function percent(chance: number): string {
	if (chance >= 0.1) return `${math.floor(chance * 100 + 0.5)}%`;
	const [text] = string.format("%.1f", chance * 100).gsub("%.0$", "");
	return `${text}%`;
}

/** One chip beside its bar: lit with SURE! when the variant is guaranteed, dimmed when a better one is, else its chance. */
function BarChip(props: { variant: FishVariant; index: number; guaranteed: FishVariant; chance: number }) {
	const palette = VARIANT_PALETTES[props.variant];
	const rank = VARIANT_ORDER.indexOf(props.variant);
	const guaranteedRank = VARIANT_ORDER.indexOf(props.guaranteed);
	const lit = rank <= guaranteedRank;
	const dim = rank < guaranteedRank;
	const y = TUBE_TOP + TUBE_HEIGHT - (TUBE_HEIGHT * (props.index + 1)) / STAR_MAX_BARS - 6;
	const odds = lit ? (dim ? "" : "SURE!") : percent(props.chance);
	return (
		<frame key={props.variant} Position={UDim2.fromOffset(0, y)} Size={UDim2.fromOffset(CHIP_WIDTH + 14, CHIP_HEIGHT)} BackgroundTransparency={1}>
			<frame
				key="Pointer"
				Position={UDim2.fromOffset(CHIP_WIDTH - 2, 18)}
				Size={UDim2.fromOffset(14, 8)}
				BackgroundColor3={lit ? palette.base : NAVY.missingTop}
				BackgroundTransparency={dim ? 0.55 : 0}
				BorderSizePixel={0}
			>
				<Outline thickness={2} transparency={dim ? 0.55 : 0} />
			</frame>
			<frame
				key="Chip"
				Size={UDim2.fromOffset(CHIP_WIDTH, CHIP_HEIGHT)}
				BackgroundColor3={WHITE}
				BackgroundTransparency={dim ? 0.55 : 0}
				BorderSizePixel={0}
				ZIndex={2}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uigradient
					Color={lit ? verticalGradient(palette.light, palette.base) : verticalGradient(NAVY.missingTop, NAVY.missingBottom)}
					Rotation={90}
				/>
				<Outline transparency={dim ? 0.55 : 0} />
				<textlabel
					key="Name"
					Position={UDim2.fromOffset(0, odds === "" ? 11 : 3)}
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={string.upper(props.variant)}
					TextSize={15}
					TextColor3={lit ? WHITE : palette.base}
					TextTransparency={dim ? 0.4 : 0}
					ZIndex={3}
				>
					<TextStroke color={lit ? palette.shadow : OUTLINE} transparency={dim ? 0.5 : 0} />
				</textlabel>
				{odds !== "" && (
					<textlabel
						key="Odds"
						Position={UDim2.fromOffset(0, 22)}
						Size={new UDim2(1, 0, 0, 18)}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						Text={odds}
						TextSize={14}
						TextColor3={lit ? WHITE : NAVY.muted}
						ZIndex={3}
					>
						{lit && <TextStroke color={palette.shadow} />}
					</textlabel>
				)}
			</frame>
		</frame>
	);
}

/** A golden star drawn from the ★ glyph (gradient, dark outline), like the falling stars. */
function StarGlyph(props: { size: number; position: UDim2; anchorPoint?: Vector2; zIndex?: number }) {
	return (
		<textlabel
			key="Star"
			AnchorPoint={props.anchorPoint}
			Position={props.position}
			Size={UDim2.fromOffset(props.size, props.size)}
			BackgroundTransparency={1}
			Font={FONT_BOLD}
			Text={STAR_GLYPH}
			TextScaled={true}
			TextColor3={WHITE}
			ZIndex={props.zIndex}
		>
			<uigradient Color={verticalGradient(STARFALL_COLORS.starLight, STARFALL_COLORS.star)} Rotation={90} />
			<TextStroke thickness={3} />
		</textlabel>
	);
}

/**
 * The star gauge (the starfall): on the right edge of the screen, a tube of STAR_MAX_BARS bars filling with gold as stars
 * are caught, one chip per bar telling what it guarantees (or its chance, with the player's luck). Shown only while
 * the starfall runs: the star power it leaves is announced under the egg shop (StarPowerPill).
 */
export function StarGauge(props: StarGaugeProps) {
	const bars = math.clamp(props.bars, 0, STAR_MAX_BARS);
	const full = bars >= STAR_MAX_BARS;
	const shinySure = bars >= STAR_GOLD_BARS;
	const guaranteed = getGuaranteedVariant(bars);
	const odds = getStarVariantOdds(bars, props.luck, props.galaxyLuck);

	// The fill glides toward the gauge's value
	const [shown, setShown] = useBinding(bars);
	useEffect(() => {
		const connection = RunService.RenderStepped.Connect((dt) => {
			const current = shown.getValue();
			if (current === bars) return;
			const step = FILL_SPEED * dt;
			setShown(math.abs(bars - current) <= step ? bars : current + math.sign(bars - current) * step);
		});
		return () => connection.Disconnect();
	}, [bars]);

	const caption = full ? "GALAXY SURE!" : shinySure ? "SHINY SURE!" : "CATCH THE STARS!";
	const captionPalette = full ? VARIANT_PALETTES.Galaxy : PALETTES.gold;
	const plateX = CHIP_WIDTH + CHIP_GAP;
	const tubeX = (PLATE_WIDTH - TUBE_WIDTH) / 2;
	const width = plateX + PLATE_WIDTH;

	return (
		<frame
			key="StarGauge"
			AnchorPoint={new Vector2(1, 0.5)}
			Position={new UDim2(1, -RIGHT_MARGIN, 0.5, 0)}
			Size={UDim2.fromOffset(width, PLATE_HEIGHT + CAPTION_HEIGHT + 30)}
			BackgroundTransparency={1}
			ZIndex={2}
		>
			<uiscale Scale={props.scale} />
			{BAR_VARIANTS.map((variant, index) => (
				<BarChip key={variant} variant={variant} index={index} guaranteed={guaranteed} chance={odds[variant]} />
			))}
			<frame
				key="Shadow"
				Position={UDim2.fromOffset(plateX, PLATE_DEPTH)}
				Size={UDim2.fromOffset(PLATE_WIDTH, PLATE_HEIGHT)}
				BackgroundColor3={NAVY.cardShadow}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 24)} />
				<Outline />
			</frame>
			<frame
				key="Plate"
				Position={UDim2.fromOffset(plateX, 0)}
				Size={UDim2.fromOffset(PLATE_WIDTH, PLATE_HEIGHT)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 24)} />
				<uigradient Color={verticalGradient(NAVY.cardTop, NAVY.cardBottom)} Rotation={90} />
				<Outline
					color={full ? VARIANT_PALETTES.Galaxy.light : shinySure ? STARFALL_COLORS.star : OUTLINE}
					thickness={shinySure ? 4 : 3}
				/>
				<frame
					key="Gloss"
					Position={UDim2.fromOffset(8, 6)}
					Size={new UDim2(1, -16, 0, 40)}
					BackgroundColor3={WHITE}
					BackgroundTransparency={0.88}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 16)} />
				</frame>
				<textlabel
					key="Title"
					Position={UDim2.fromOffset(0, 40)}
					Size={new UDim2(1, 0, 0, 40)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={"STAR\nPOWER"}
					TextSize={17}
					TextColor3={WHITE}
					ZIndex={2}
				>
					<TextStroke thickness={3} />
				</textlabel>
				<frame
					key="Tube"
					Position={UDim2.fromOffset(tubeX, TUBE_TOP)}
					Size={UDim2.fromOffset(TUBE_WIDTH, TUBE_HEIGHT)}
					BackgroundColor3={NAVY.track}
					BorderSizePixel={0}
					ClipsDescendants={true}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<Outline />
					<frame
						key="Fill"
						AnchorPoint={new Vector2(0, 1)}
						Position={UDim2.fromScale(0, 1)}
						// The gold part: bars 1–3
						Size={shown.map((value) => UDim2.fromScale(1, math.min(value, STAR_GOLD_BARS) / STAR_MAX_BARS))}
						Visible={shown.map((value) => value > 0.01)}
						BackgroundColor3={WHITE}
						BorderSizePixel={0}
					>
						<uicorner CornerRadius={new UDim(0, TUBE_WIDTH / 2)} />
						<uigradient Color={verticalGradient(STARFALL_COLORS.starLight, STARFALL_COLORS.star)} Rotation={90} />
						<frame
							key="Shine"
							Position={UDim2.fromOffset(7, 6)}
							Size={new UDim2(0, 10, 1, -12)}
							BackgroundColor3={WHITE}
							BackgroundTransparency={0.55}
							BorderSizePixel={0}
						>
							<uicorner CornerRadius={new UDim(0, 5)} />
						</frame>
					</frame>
					<frame
						key="GalaxyFill"
						AnchorPoint={new Vector2(0, 1)}
						Position={UDim2.fromScale(0, 1 - STAR_GOLD_BARS / STAR_MAX_BARS)}
						Size={shown.map((value) =>
							UDim2.fromScale(1, math.max(value - STAR_GOLD_BARS, 0) / STAR_MAX_BARS),
						)}
						Visible={shown.map((value) => value > STAR_GOLD_BARS + 0.01)}
						BackgroundColor3={WHITE}
						BorderSizePixel={0}
					>
						<uicorner CornerRadius={new UDim(0, TUBE_WIDTH / 2)} />
						<uigradient Color={GALAXY_FILL} Rotation={90} />
						{[
							[10, 0.15, 3],
							[28, 0.35, 2],
							[18, 0.6, 3],
							[31, 0.8, 2],
						].map(([x, y, size], index) => (
							<frame
								key={`Dot${index}`}
								Position={new UDim2(0, x, y, 0)}
								Size={UDim2.fromOffset(size, size)}
								BackgroundColor3={WHITE}
								BorderSizePixel={0}
							>
								<uicorner CornerRadius={new UDim(0.5, 0)} />
							</frame>
						))}
					</frame>
					{[1, 2, 3].map((bar) => (
						<frame
							key={`Notch${bar}`}
							Position={new UDim2(0, 0, 1 - bar / STAR_MAX_BARS, -2)}
							Size={new UDim2(1, 0, 0, 4)}
							BackgroundColor3={bar === STAR_GOLD_BARS ? VARIANT_PALETTES.Galaxy.light : OUTLINE}
							BackgroundTransparency={0.15}
							BorderSizePixel={0}
							ZIndex={2}
						/>
					))}
					{props.saved > 0 && (
						// The star power kept from before: the new gauge must pass it to replace it
						<frame
							key="Saved"
							Position={new UDim2(0, 0, 1 - math.clamp(props.saved, 0, STAR_MAX_BARS) / STAR_MAX_BARS, -3)}
							Size={new UDim2(1, 0, 0, 6)}
							BackgroundColor3={VARIANT_PALETTES.Anomaly.light}
							BorderSizePixel={0}
							ZIndex={3}
						>
							<Outline thickness={2} />
						</frame>
					)}
				</frame>
				<textlabel
					key="Amount"
					Position={UDim2.fromOffset(0, TUBE_TOP + TUBE_HEIGHT + 6)}
					Size={new UDim2(1, 0, 0, 28)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					// Rounded down: "3.0" only once the gauge is really full
					Text={full ? "MAX!" : `${string.format("%.1f", math.floor(bars * 10) / 10)} / ${STAR_MAX_BARS}`}
					TextSize={20}
					TextColor3={full ? VARIANT_PALETTES.Galaxy.light : STARFALL_COLORS.star}
				>
					<TextStroke thickness={3} />
				</textlabel>
			</frame>
			<StarGlyph
				size={BADGE_SIZE}
				anchorPoint={new Vector2(0.5, 0.5)}
				position={UDim2.fromOffset(plateX + PLATE_WIDTH / 2, 0)}
				zIndex={4}
			/>
			<frame
				key="Caption"
				AnchorPoint={new Vector2(0.5, 0)}
				Position={UDim2.fromOffset(plateX + PLATE_WIDTH / 2, PLATE_HEIGHT + 20)}
				Size={UDim2.fromOffset(PLATE_WIDTH + 52, CAPTION_HEIGHT)}
				BackgroundColor3={WHITE}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<uigradient Color={verticalGradient(captionPalette.light, captionPalette.base)} Rotation={90} />
				<Outline />
				<textlabel
					key="Text"
					Size={UDim2.fromScale(1, 1)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={caption}
					TextSize={15}
					TextColor3={WHITE}
				>
					<TextStroke color={captionPalette.shadow} />
				</textlabel>
			</frame>
		</frame>
	);
}
