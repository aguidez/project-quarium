import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService, TweenService } from "@rbxts/services";
import { getUiScale } from "./screenScale";
import { formatNumber } from "shared/format";
import { RewardItem } from "shared/network";
import { SfxName } from "shared/sounds";
import { CoinIcon, HeaderBanner, TextStroke } from "./kit";
import { COLORS, FISH_ICONS, FONT_BOLD, FONT_TITLE, NAVY, OUTLINE, PALETTES, verticalGradient } from "./theme";

// Timeline (seconds)
const POP_IN_TIME = 0.45; // the rays
const FADE_IN_TIME = 0.25; // the panel
const COUNT_DELAY = 0.3; // the amount counts up from 0 after the pop-in starts
const COUNT_TIME = 0.9;
const DURATION = 4.5;
const FADE_TIME = 0.4; // at the end
const BACKDROP_TRANSPARENCY = 0.45;
const RAY_COUNT = 8;
const SUBTITLE_MAX_WIDTH = 520; // a longer subtitle wraps (the stage is 720 px wide)

export interface RewardPopupProps {
	title: string;
	amount: number;
	/** Shown instead of the money amount (e.g. a companion). */
	item?: RewardItem;
	subtitle: string;
	playSfx: (name: SfxName, playbackSpeed?: number) => void;
	onEnd: () => void;
}

function phase(time: number, start: number, duration: number): number {
	return math.clamp((time - start) / duration, 0, 1);
}

function getScreenScale(): number {
	return getUiScale(1.6);
}

/**
 * Centered reward celebration (FigCraft: RewardPopup frame, V2 window with a ribbon title): "+300$" counting up over gold rays.
 * Purely visual: the server has already credited the money.
 */
export function RewardPopup(props: RewardPopupProps) {
	const [time, setTime] = useBinding(0);
	const fishType = props.item?.fishType;
	const image = fishType !== undefined ? FISH_ICONS[fishType].Normal : props.item?.image;

	useEffect(() => {
		props.playSfx("FishObtained");
		const start = os.clock();
		const connection = RunService.RenderStepped.Connect(() => {
			const elapsed = os.clock() - start;
			setTime(elapsed);
			if (elapsed >= DURATION) {
				connection.Disconnect();
				props.onEnd();
			}
		});
		return () => connection.Disconnect();
	}, []);

	const fadeOut = (t: number) => phase(t, DURATION - FADE_TIME, FADE_TIME);
	// Only the rays pop (scale): the panel and its text fade in at their final size, or the text wobbles
	const popIn = (t: number) =>
		TweenService.GetValue(phase(t, 0, POP_IN_TIME), Enum.EasingStyle.Back, Enum.EasingDirection.Out);
	const fadeIn = (t: number) =>
		TweenService.GetValue(phase(t, 0, FADE_IN_TIME), Enum.EasingStyle.Quad, Enum.EasingDirection.Out);

	const rays = new Array<React.Element>();
	for (let index = 0; index < RAY_COUNT; index++) {
		rays.push(
			<frame
				key={`Ray${index}`}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={UDim2.fromScale(0.5, 0.5)}
				Size={new UDim2(0, 40, 1, 0)}
				Rotation={(index * 180) / RAY_COUNT}
				BackgroundColor3={COLORS.gold}
				BorderSizePixel={0}
			>
				<uigradient
					Rotation={90}
					Transparency={
						new NumberSequence([
							new NumberSequenceKeypoint(0, 1),
							new NumberSequenceKeypoint(0.5, 0.35),
							new NumberSequenceKeypoint(1, 1),
						])
					}
				/>
			</frame>,
		);
	}

	return (
		<frame key="RewardPopup" Size={UDim2.fromScale(1, 1)} BackgroundTransparency={1} ZIndex={25}>
			<frame
				key="Backdrop"
				Size={UDim2.fromScale(1, 1)}
				BackgroundColor3={new Color3(0, 0, 0)}
				BackgroundTransparency={time.map(
					(t) => 1 - (1 - BACKDROP_TRANSPARENCY) * phase(t, 0, 0.3) * (1 - fadeOut(t)),
				)}
				BorderSizePixel={0}
			/>
			<canvasgroup
				key="Stage"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={UDim2.fromScale(0.5, 0.5)}
				Size={UDim2.fromOffset(720, 720)}
				BackgroundTransparency={1}
				GroupTransparency={time.map((t) => math.max(1 - fadeIn(t), fadeOut(t)))}
				ZIndex={2}
			>
				<uiscale Scale={getScreenScale()} />

				<frame
					key="Rays"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.5)}
					Size={UDim2.fromOffset(700, 700)}
					BackgroundTransparency={1}
					Rotation={time.map((t) => t * 20)}
				>
					<uiscale Scale={time.map(popIn)} />
					{rays}
				</frame>

				<frame
					key="Panel"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.5)}
					Size={UDim2.fromOffset(0, 0)}
					AutomaticSize={Enum.AutomaticSize.XY}
					BackgroundColor3={COLORS.white}
					ZIndex={2}
				>
					<uicorner CornerRadius={new UDim(0, 30)} />
					<uistroke Color={OUTLINE} Thickness={4} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					<uigradient Color={verticalGradient(NAVY.windowTop, NAVY.windowBottom)} Rotation={90} />
					<HeaderBanner
						key="Banner"
						title={props.title.upper()}
						palette={PALETTES.gold}
						position={new UDim2(0.5, 0, 0, -36)}
						zIndex={4}
					/>
					{/* The content has its own frame: the panel's padding and list would move the banner too */}
					<frame
						key="Content"
						Size={UDim2.fromOffset(0, 0)}
						AutomaticSize={Enum.AutomaticSize.XY}
						BackgroundTransparency={1}
						ZIndex={2}
					>
						{/* Never narrower than its ribbon title */}
						<uisizeconstraint MinSize={new Vector2(440, 0)} />
						<uipadding
							PaddingTop={new UDim(0, 46)}
							PaddingBottom={new UDim(0, 26)}
							PaddingLeft={new UDim(0, 40)}
							PaddingRight={new UDim(0, 40)}
						/>
						<uilistlayout
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							Padding={new UDim(0, 6)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						{image !== undefined && image !== "" ? (
							<imagelabel
								key="Gift"
								LayoutOrder={1}
								Size={UDim2.fromOffset(128, 80)}
								BackgroundTransparency={1}
								Image={image}
								ScaleType={Enum.ScaleType.Fit}
								Rotation={time.map((t) => math.sin(t * 6) * 8)}
							/>
						) : props.item !== undefined ? (
							// A short label instead of a picture (a perk, the new tank size, one more slot)
							<textlabel
								key="Gift"
								LayoutOrder={1}
								Size={UDim2.fromOffset(120, 80)}
								BackgroundTransparency={1}
								Font={FONT_BOLD} // "+1s": in Luckiest Guy the "s" reads like a 5
								Text={props.item.icon}
								TextSize={64}
								TextColor3={PALETTES.gold.base}
								Rotation={time.map((t) => math.sin(t * 6) * 8)}
								ZIndex={3}
							>
								<TextStroke color={PALETTES.gold.shadow} thickness={4} />
							</textlabel>
						) : (
							<frame
								key="Gift"
								LayoutOrder={1}
								Size={UDim2.fromOffset(84, 84)}
								BackgroundTransparency={1}
								Rotation={time.map((t) => math.sin(t * 6) * 8)}
							>
								<CoinIcon size={84} zIndex={3} />
							</frame>
						)}
						<textlabel
							key="Amount"
							LayoutOrder={3}
							Size={UDim2.fromOffset(0, 84)}
							AutomaticSize={Enum.AutomaticSize.X}
							BackgroundTransparency={1}
							Font={FONT_TITLE}
							Text={time.map((t) => {
								if (props.item) return props.item.name.upper();
								const counted = TweenService.GetValue(
									phase(t, COUNT_DELAY, COUNT_TIME),
									Enum.EasingStyle.Quad,
									Enum.EasingDirection.Out,
								);
								return `+${formatNumber(math.floor(props.amount * counted + 0.5))}$`;
							})}
							TextSize={72}
							TextColor3={props.item ? COLORS.white : PALETTES.green.light}
							ZIndex={3}
						>
							<TextStroke
								color={props.item ? PALETTES.gold.shadow : PALETTES.green.shadow}
								thickness={4}
							/>
						</textlabel>
						<textlabel
							key="Subtitle"
							LayoutOrder={4}
							Size={UDim2.fromOffset(0, 0)}
							AutomaticSize={Enum.AutomaticSize.XY}
							BackgroundTransparency={1}
							Font={FONT_BOLD}
							Text={props.subtitle}
							TextSize={22}
							TextColor3={COLORS.white}
							TextWrapped={true}
							ZIndex={3}
						>
							<TextStroke />
							<uisizeconstraint MaxSize={new Vector2(SUBTITLE_MAX_WIDTH, math.huge)} />
						</textlabel>
					</frame>
				</frame>
			</canvasgroup>
		</frame>
	);
}
