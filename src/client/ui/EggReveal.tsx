import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService, TweenService } from "@rbxts/services";
import { SfxName } from "shared/sounds";
import { EGG_TYPES, EggType, getHatchChance, HATCH_REVEAL_TIME } from "shared/types/eggs";
import { FISH_TYPES, FishType } from "shared/types/fish";
import { FISH_VARIANTS, FishVariant, formatVariantChance } from "shared/types/variants";
import { formatSize, getSizeTier, SIZE_TIERS } from "shared/types/size";
import { Outline, TextStroke } from "./kit";
import { getViewportSize } from "./screenScale";
import {
	COLORS,
	EGG_CRACKS,
	EGG_SPRITES,
	FISH_ICONS,
	FONT_BLACK,
	FONT_BOLD,
	FONT_TITLE,
	VARIANT_STYLES,
	getFishRarity,
	getSizePalette,
} from "./theme";

// Timeline (seconds). It lasts HATCH_REVEAL_TIME, after which the server drops the fish in the tank.
const POP_IN_TIME = 0.3;
const CRACK_TIMES = [0.7, 1.15, 1.6]; // one crack sprite (and sound) each
const BREAK_TIME = 1.95;
const SHELL_TIME = 0.6; // the two halves fly apart
const FISH_POP_TIME = 0.45;
const TEXT_DELAY = 0.15; // after the break
const CAPTION_FADE_TIME = 0.3;
const FADE_TIME = 0.3; // at the very end
const SIZE_DELAY = 0.35; // the Size pill pops after the caption (FigCraft size.figcraft)
const SIZE_POP_TIME = 0.35;
const BACKDROP_TRANSPARENCY = 0.5;

const STAGE_SIZE = 600; // room under the fish for the caption and the Size pill
const EGG_SIZE = UDim2.fromOffset(150, 180);
const FISH_SIZE = UDim2.fromOffset(256, 160); // the sticker icon at its own size
const FISH_WOBBLE = 4; // degrees: the hatched fish sways a little while it floats
const RAY_COUNT = 8; // each ray crosses the whole burst, so this draws twice as many beams

export interface EggRevealProps {
	eggType: EggType;
	fishType: FishType;
	variant: FishVariant;
	/** First fish of this type and variant: it just joined the fish index. */
	firstTime: boolean;
	/** Its variant came from the player's star power (a starfall): shown instead of the usual chance. */
	starPowered: boolean;
	/** Its Size score (shared/types/size); undefined for a special fish, which has none. */
	size?: number;
	/** The best Size of its species so far. */
	newBestSize: boolean;
	/** The player's variant luck: the chance shown is the one they hatched with. */
	luck: number;
	/** Its Galaxy luck (the Lucky pass counts x3 there). */
	galaxyLuck: number;
	playSfx: (name: SfxName, playbackSpeed?: number) => void;
	onEnd: () => void;
}

/** 0 -> 1 over [start, start + duration]. */
function phase(time: number, start: number, duration: number): number {
	return math.clamp((time - start) / duration, 0, 1);
}

function ease(alpha: number, style: Enum.EasingStyle): number {
	return TweenService.GetValue(alpha, style, Enum.EasingDirection.Out);
}

/** 1 right after a crack, back to 0 within `duration`: a jolt at each crack. */
function crackKick(time: number, duration: number): number {
	let kick = 0;
	for (const at of CRACK_TIMES) {
		if (time >= at) kick = math.max(kick, 1 - (time - at) / duration);
	}
	return kick;
}

/** The egg rocks harder and harder until it breaks. */
function shakeAngle(time: number): number {
	if (time < POP_IN_TIME || time >= BREAK_TIME) return 0;
	const build = (time - POP_IN_TIME) / (BREAK_TIME - POP_IN_TIME);
	return math.sin(time * 38) * (3 + build * 9 + crackKick(time, 0.25) * 10);
}

function crackStage(time: number): number {
	return CRACK_TIMES.filter((at) => time >= at).size();
}

/** Screen-size factor so the reveal fits small screens and doesn't look tiny on big ones. */
function getStageScale(): number {
	// A phone in landscape (~360-390 px tall) still fits the 600 px stage with its captions
	return math.clamp(getViewportSize().Y / 800, 0.45, 1.1);
}

/**
 * Full-screen hatching reveal: the egg pops in, shakes, cracks in 3 stages, breaks in two
 * halves and reveals the fish with its rarity. Purely visual: the server already drew the fish.
 */
export function EggReveal(props: EggRevealProps) {
	const [time, setTime] = useBinding(0);
	const sprites = EGG_SPRITES[props.eggType];
	const fish = FISH_TYPES[props.fishType];
	const chance = getHatchChance(props.eggType, props.fishType);
	const rarity = getFishRarity(props.fishType);
	const variant = FISH_VARIANTS[props.variant];
	const variantStyle = VARIANT_STYLES[props.variant];
	const rare = props.variant !== "Normal";
	// A rare variant bursts in its own colour, a normal fish in its rarity's
	const burstColor = rare ? variantStyle.color : rarity.color;
	const size = props.size;
	const titan = size !== undefined && getSizeTier(size) === "Titan";
	const sizePalette = size !== undefined ? getSizePalette(size) : undefined;
	const sizeTier = size !== undefined ? SIZE_TIERS.find(([tier]) => tier === getSizeTier(size))![1].displayName : "";
	const article = string.match(fish.displayName.lower(), "^[aeiou]")[0] !== undefined && !rare ? "an" : "a";
	const variantArticle = string.match(variant.displayName.lower(), "^[aeiou]")[0] !== undefined ? "an" : "a";

	useEffect(() => {
		const cues = [
			...CRACK_TIMES.map((at, index) => ({ at, play: () => props.playSfx("EggCrack", 1 + index * 0.12) })),
			{ at: BREAK_TIME, play: () => props.playSfx("EggHatch") },
			{ at: BREAK_TIME + TEXT_DELAY, play: () => props.playSfx("FishObtained") },
		];
		// A Titan rings once more when its pill pops
		if (titan) cues.push({ at: BREAK_TIME + TEXT_DELAY + SIZE_DELAY, play: () => props.playSfx("FishObtained", 1.35) });
		let nextCue = 0;
		const start = os.clock();
		const connection = RunService.RenderStepped.Connect(() => {
			const elapsed = os.clock() - start;
			setTime(elapsed);
			while (nextCue < cues.size() && elapsed >= cues[nextCue].at) {
				cues[nextCue].play();
				nextCue++;
			}
			if (elapsed >= HATCH_REVEAL_TIME) {
				connection.Disconnect();
				props.onEnd();
			}
		});
		return () => connection.Disconnect();
	}, []);

	const fadeOut = (t: number) => phase(t, HATCH_REVEAL_TIME - FADE_TIME, FADE_TIME);
	const broken = time.map((t) => t >= BREAK_TIME);
	const shell = (t: number) => ease(phase(t, BREAK_TIME, SHELL_TIME), Enum.EasingStyle.Quad);
	const shellFade = (t: number) => phase(t, BREAK_TIME + 0.25, 0.4);
	// The caption fades in at its final size (the images pop, but scaled text would wobble)
	const caption = time.map((t) => ease(phase(t, BREAK_TIME + TEXT_DELAY, CAPTION_FADE_TIME), Enum.EasingStyle.Quad));
	const captionText = () => ({
		TextTransparency: caption.map((a) => 1 - a),
	});
	const captionStroke = (thickness = 2.5) => (
		<TextStroke thickness={thickness} transparency={caption.map((a) => 1 - a)} />
	);
	const sizePop = time.map((t) =>
		ease(phase(t, BREAK_TIME + TEXT_DELAY + SIZE_DELAY, SIZE_POP_TIME), Enum.EasingStyle.Back),
	);
	const sizeNoteFade = time.map((t) => 1 - phase(t, BREAK_TIME + TEXT_DELAY + SIZE_DELAY + 0.2, CAPTION_FADE_TIME));

	const rays = new Array<React.Element>();
	for (let index = 0; index < RAY_COUNT; index++) {
		rays.push(
			<frame
				key={`Ray${index}`}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={UDim2.fromScale(0.5, 0.5)}
				Size={new UDim2(0, 30, 1, 0)}
				Rotation={(index * 180) / RAY_COUNT}
				BackgroundColor3={burstColor}
				BorderSizePixel={0}
			>
				<uigradient
					Rotation={90}
					Transparency={
						new NumberSequence([
							new NumberSequenceKeypoint(0, 1),
							new NumberSequenceKeypoint(0.5, 0.3),
							new NumberSequenceKeypoint(1, 1),
						])
					}
				/>
			</frame>,
		);
	}

	return (
		<frame key="EggReveal" Size={UDim2.fromScale(1, 1)} BackgroundTransparency={1} ZIndex={20}>
			<frame
				key="Backdrop"
				Size={UDim2.fromScale(1, 1)}
				BackgroundColor3={new Color3(0, 0, 0)}
				BackgroundTransparency={time.map(
					(t) => 1 - (1 - BACKDROP_TRANSPARENCY) * phase(t, 0, 0.25) * (1 - fadeOut(t)),
				)}
				BorderSizePixel={0}
			/>
			<canvasgroup
				key="Stage"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={UDim2.fromScale(0.5, 0.5)}
				Size={UDim2.fromOffset(STAGE_SIZE, STAGE_SIZE)}
				BackgroundTransparency={1}
				GroupTransparency={time.map(fadeOut)}
				ZIndex={2}
			>
				<uiscale Scale={getStageScale()} />

				<textlabel
					key="EggName"
					AnchorPoint={new Vector2(0.5, 0)}
					Position={new UDim2(0.5, 0, 0, 40)}
					Size={new UDim2(1, 0, 0, 34)}
					BackgroundTransparency={1}
					Font={FONT_TITLE}
					Text={EGG_TYPES[props.eggType].displayName.upper()}
					TextSize={34}
					TextColor3={COLORS.gold}
					Visible={broken.map((isBroken) => !isBroken)}
				>
					<TextStroke thickness={3} />
				</textlabel>

				<frame
					key="Rays"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.45)}
					Size={UDim2.fromOffset(460, 460)}
					BackgroundTransparency={1}
					Rotation={time.map((t) => t * 25)}
					Visible={broken}
				>
					<uiscale Scale={time.map((t) => ease(phase(t, BREAK_TIME, 0.5), Enum.EasingStyle.Quad))} />
					{rays}
				</frame>

				<frame
					key="Flash"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.45)}
					Size={time.map((t) => {
						const size = 120 + 320 * ease(phase(t, BREAK_TIME, 0.4), Enum.EasingStyle.Quad);
						return UDim2.fromOffset(size, size);
					})}
					BackgroundColor3={COLORS.white}
					BackgroundTransparency={time.map((t) => 0.1 + 0.9 * phase(t, BREAK_TIME, 0.4))}
					Visible={broken}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
				</frame>

				{/* Whole egg + crack overlay, shaking until it breaks */}
				<frame
					key="Egg"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.45)}
					Size={EGG_SIZE}
					BackgroundTransparency={1}
					Rotation={time.map(shakeAngle)}
					Visible={broken.map((isBroken) => !isBroken)}
				>
					<uiscale
						Scale={time.map(
							(t) =>
								ease(phase(t, 0, POP_IN_TIME), Enum.EasingStyle.Back) * (1 + crackKick(t, 0.15) * 0.08),
						)}
					/>
					<imagelabel
						key="Shell"
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Image={sprites.icon}
						ScaleType={Enum.ScaleType.Fit}
					/>
					<imagelabel
						key="Cracks"
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Image={time.map((t) => EGG_CRACKS[math.max(crackStage(t) - 1, 0)])}
						ScaleType={Enum.ScaleType.Fit}
						Visible={time.map((t) => crackStage(t) > 0)}
						ZIndex={2}
					/>
				</frame>

				{/* The two shell halves fly apart and fade */}
				<frame
					key="BrokenShell"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.45)}
					Size={EGG_SIZE}
					BackgroundTransparency={1}
					Visible={broken}
					ZIndex={3}
				>
					<imagelabel
						key="Top"
						Position={time.map((t) => UDim2.fromOffset(-60 * shell(t), -120 * shell(t)))}
						Size={UDim2.fromScale(1, 1)}
						Rotation={time.map((t) => -35 * shell(t))}
						BackgroundTransparency={1}
						Image={sprites.top}
						ImageTransparency={time.map(shellFade)}
						ScaleType={Enum.ScaleType.Fit}
					/>
					<imagelabel
						key="Bottom"
						Position={time.map((t) => UDim2.fromOffset(50 * shell(t), 80 * shell(t)))}
						Size={UDim2.fromScale(1, 1)}
						Rotation={time.map((t) => 25 * shell(t))}
						BackgroundTransparency={1}
						Image={sprites.bottom}
						ImageTransparency={time.map(shellFade)}
						ScaleType={Enum.ScaleType.Fit}
					/>
				</frame>

				{titan && (
					<frame
						key="TitanGlow"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={UDim2.fromScale(0.5, 0.45)}
						Size={UDim2.fromOffset(340, 260)}
						BackgroundColor3={COLORS.gold}
						BackgroundTransparency={time.map((t) => 0.45 + 0.1 * math.sin(t * 4))}
						Visible={broken}
						ZIndex={1}
					>
						<uicorner CornerRadius={new UDim(0.5, 0)} />
						{/* Soft on both sides (a UIGradient can't be radial) */}
						<uigradient
							Transparency={
								new NumberSequence([
									new NumberSequenceKeypoint(0, 1),
									new NumberSequenceKeypoint(0.5, 0.2),
									new NumberSequenceKeypoint(1, 1),
								])
							}
						/>
						<uiscale Scale={sizePop} />
					</frame>
				)}
				{titan &&
					[
						[-150, -70, 22],
						[140, -50, 16],
						[120, 70, 13],
						[-120, 60, 15],
					].map(([x, y, s], index) => (
						<frame
							key={`Sparkle${index}`}
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={new UDim2(0.5, x, 0.45, y)}
							Size={UDim2.fromOffset(s, s)}
							Rotation={45}
							BackgroundColor3={COLORS.white}
							BackgroundTransparency={time.map((t) => 0.2 + 0.6 * math.abs(math.sin(t * 3 + index)))}
							Visible={broken}
							ZIndex={3}
						>
							<uicorner CornerRadius={new UDim(0, 3)} />
							<uiscale Scale={sizePop} />
						</frame>
					))}
				<imagelabel
					key="Fish"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={time.map((t) => new UDim2(0.5, 0, 0.45, math.sin(t * 3) * 6))}
					Size={FISH_SIZE}
					Rotation={time.map((t) => math.sin(t * 2.2) * FISH_WOBBLE)}
					BackgroundTransparency={1}
					Image={FISH_ICONS[props.fishType][props.variant]}
					ScaleType={Enum.ScaleType.Fit}
					Visible={broken}
					ZIndex={2}
				>
					<uiscale
						Scale={time.map((t) => ease(phase(t, BREAK_TIME, FISH_POP_TIME), Enum.EasingStyle.Back))}
					/>
				</imagelabel>

				<frame
					key="Caption"
					AnchorPoint={new Vector2(0.5, 0)}
					Position={new UDim2(0.5, 0, 0.45, 100)}
					Size={new UDim2(1, 0, 0, 225)}
					BackgroundTransparency={1}
					Visible={broken}
					ZIndex={4}
				>
					<uilistlayout
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 6)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<textlabel
						key="Title"
						LayoutOrder={1}
						Size={new UDim2(1, 0, 0, 38)}
						BackgroundTransparency={1}
						Font={FONT_TITLE}
						Text={
							rare
								? `You hatched ${variantArticle} ${variant.displayName} ${fish.displayName}!`
								: `You hatched ${article} ${fish.displayName}!`
						}
						// Long names shrink to fit the stage (Luckiest Guy is wide)
						TextScaled={true}
						TextColor3={COLORS.white}
						{...captionText()}
					>
						<uitextsizeconstraint MaxTextSize={34} />
						<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} />
						{captionStroke(3)}
					</textlabel>
					<textlabel
						key="Rarity"
						LayoutOrder={2}
						Size={new UDim2(1, 0, 0, 26)}
						BackgroundTransparency={1}
						Font={FONT_BOLD}
						// An easter egg's chance is a secret: just its rarity
						Text={chance > 0 ? `${rarity.label}  •  ${chance}%` : rarity.label}
						TextSize={22}
						TextColor3={rarity.color}
						{...captionText()}
					>
						{captionStroke()}
					</textlabel>
					{rare && (
						<textlabel
							key="Variant"
							LayoutOrder={3}
							Size={new UDim2(1, 0, 0, 26)}
							BackgroundTransparency={1}
							Font={FONT_TITLE}
							// Drawn with star power (a starfall), not with the usual chance
							Text={`${variant.displayName.upper()}  •  ${props.starPowered ? "STAR POWER" : formatVariantChance(props.variant, props.luck, props.galaxyLuck)}`}
							TextSize={24}
							TextColor3={variantStyle.color}
							{...captionText()}
						>
							{captionStroke()}
						</textlabel>
					)}
					{size !== undefined && sizePalette && (
						<frame key="Size" LayoutOrder={4} Size={UDim2.fromOffset(300, 47)} BackgroundTransparency={1}>
							<uiscale Scale={sizePop} />
							<frame
								key="Shadow"
								Position={UDim2.fromOffset(0, 5)}
								Size={UDim2.fromOffset(300, 42)}
								BackgroundColor3={sizePalette.shadow}
								BorderSizePixel={0}
							>
								<uicorner CornerRadius={new UDim(0.5, 0)} />
								<Outline />
							</frame>
							<frame
								key="Face"
								Size={UDim2.fromOffset(300, 42)}
								BackgroundColor3={COLORS.white}
								BorderSizePixel={0}
								ZIndex={2}
							>
								<uicorner CornerRadius={new UDim(0.5, 0)} />
								<uigradient
									Color={new ColorSequence(sizePalette.light, sizePalette.base)}
									Rotation={90}
								/>
								<Outline />
								<frame
									key="Gloss"
									Position={UDim2.fromOffset(6, 4)}
									Size={new UDim2(1, -12, 0, 15)}
									BackgroundColor3={COLORS.white}
									BackgroundTransparency={0.65}
									BorderSizePixel={0}
									ZIndex={2}
								>
									<uicorner CornerRadius={new UDim(0.5, 0)} />
								</frame>
								<textlabel
									key="Label"
									Size={UDim2.fromScale(1, 1)}
									BackgroundTransparency={1}
									Font={FONT_BOLD}
									Text={`SIZE ${formatSize(size)}  •  ${sizeTier.upper()}${titan ? "!" : ""}`}
									TextSize={21}
									TextColor3={COLORS.white}
									ZIndex={3}
								>
									<TextStroke color={sizePalette.shadow} thickness={2.5} />
								</textlabel>
							</frame>
						</frame>
					)}
					{(titan || (props.newBestSize && !props.firstTime)) && (
						<textlabel
							key="SizeNote"
							LayoutOrder={5}
							Size={new UDim2(1, 0, 0, 24)}
							BackgroundTransparency={1}
							Font={FONT_BLACK}
							Text={titan ? "A PERFECT FISH! ONE EGG IN 1,800" : "NEW BEST SIZE FOR THIS SPECIES!"}
							TextSize={18}
							TextColor3={titan ? COLORS.gold : Color3.fromHex("#FFE27A")}
							TextTransparency={sizeNoteFade}
						>
							<TextStroke thickness={2.5} transparency={sizeNoteFade} />
						</textlabel>
					)}
					{props.firstTime && (
						<textlabel
							key="New"
							LayoutOrder={6}
							Size={new UDim2(1, 0, 0, 22)}
							BackgroundTransparency={1}
							Font={FONT_BLACK}
							Text="NEW! Added to your Fish Index"
							TextSize={19}
							TextColor3={COLORS.gold}
							{...captionText()}
						>
							{captionStroke()}
						</textlabel>
					)}
				</frame>
			</canvasgroup>
		</frame>
	);
}
