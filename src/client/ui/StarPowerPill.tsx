import React from "@rbxts/react";
import { getGuaranteedVariant, STAR_GOLD_BARS, STAR_MAX_BARS } from "shared/types/stars";
import { FISH_VARIANTS } from "shared/types/variants";
import { Plate, TextStroke } from "./kit";
import { PILL_HEIGHT } from "./LikeBoostPill";
import { FONT_BOLD, STARFALL_COLORS, VARIANT_PALETTES, verticalGradient } from "./theme";

const PILL_WIDTH = 340;
const STAR_SIZE = 32;
const WHITE = new Color3(1, 1, 1);

export interface StarPowerPillProps {
	/** PlayerData.starPower: bars kept from a starfall for the next egg. */
	power: number;
	/** Pixels from the top of the screen (under the top HUD and the boost pills). */
	top: number;
	scale: number;
}

/** What the star power promises the next egg ("NEXT EGG: AT LEAST A GHOST"). */
function describe(power: number): string {
	if (power >= STAR_MAX_BARS) return "NEXT EGG: GALAXY FOR SURE!";
	if (power >= STAR_GOLD_BARS) return "NEXT EGG: SHINY FOR SURE!";
	const guaranteed = getGuaranteedVariant(power);
	if (guaranteed === "Normal") return "NEXT EGG: BETTER VARIANT ODDS";
	const name = FISH_VARIANTS[guaranteed].displayName.upper();
	return `NEXT EGG: AT LEAST ${guaranteed === "Anomaly" ? "AN" : "A"} ${name}`;
}

/**
 * The star power a starfall left (PlayerData.starPower), under the egg shop until an egg spends it: a pill in the colour
 * of the variant it guarantees, with a golden star like the falling ones. Same build as the boost pills.
 */
export function StarPowerPill(props: StarPowerPillProps) {
	const palette = VARIANT_PALETTES[getGuaranteedVariant(props.power)];
	return (
		<frame
			key="StarPowerPill"
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, props.top)}
			Size={UDim2.fromOffset(PILL_WIDTH, PILL_HEIGHT + 5)}
			BackgroundTransparency={1}
		>
			<uiscale Scale={props.scale} />
			<Plate
				key="Pill"
				top={palette.light}
				bottom={palette.base}
				shadow={palette.shadow}
				size={UDim2.fromOffset(PILL_WIDTH, PILL_HEIGHT)}
				radius={new UDim(0.5, 0)}
				gloss={true}
			>
				<textlabel
					key="Star"
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 6, 0.5, 0)}
					Size={UDim2.fromOffset(STAR_SIZE, STAR_SIZE)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text="★"
					TextScaled={true}
					TextColor3={WHITE}
					ZIndex={3}
				>
					<uigradient Color={verticalGradient(STARFALL_COLORS.starLight, STARFALL_COLORS.star)} Rotation={90} />
					<TextStroke thickness={2.5} />
				</textlabel>
				<textlabel
					key="Label"
					Position={UDim2.fromOffset(STAR_SIZE + 10, 0)}
					Size={new UDim2(1, -(STAR_SIZE + 22), 1, 0)}
					BackgroundTransparency={1}
					Font={FONT_BOLD}
					Text={describe(props.power)}
					TextSize={17}
					TextColor3={WHITE}
					ZIndex={3}
				>
					<TextStroke color={palette.shadow} thickness={2.5} />
				</textlabel>
			</Plate>
		</frame>
	);
}
