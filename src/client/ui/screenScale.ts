import { useEffect, useState } from "@rbxts/react";
import { Workspace } from "@rbxts/services";

/**
 * One UI scale for the whole screen UI, from the viewport: the layouts are drawn in design pixels for a
 * 1920 x 1080 screen (scale 1). Bigger screens grow in proportion. Smaller ones shrink less than in
 * proportion (exponent below 1), so a phone keeps readable text and tappable buttons without the UI
 * eating the screen: a phone in landscape (~390 px tall) gets ~0.5, a 768 px laptop ~0.8.
 * Every element sizes from this (with its own cap on big screens) rather than its own formula.
 */
export const REFERENCE_SIZE = new Vector2(1920, 1080);
/** A width ratio counts from this width: a 16:9 screen is limited by its height, a narrow window by its width. */
const REFERENCE_WIDTH_LIMIT = 1700;
const SMALL_SCREEN_EXPONENT = 0.7;
const MIN_UI_SCALE = 0.4;
const DEFAULT_MAX_UI_SCALE = 1.4;
const MIN_WORLD_LABEL_SCALE = 0.6;

export function getViewportSize(): Vector2 {
	return Workspace.CurrentCamera?.ViewportSize ?? REFERENCE_SIZE;
}

/** The UI scale for the current viewport, capped at `maxScale` on big screens. */
export function getUiScale(maxScale = DEFAULT_MAX_UI_SCALE): number {
	const viewport = getViewportSize();
	const ratio = math.min(viewport.Y / REFERENCE_SIZE.Y, viewport.X / REFERENCE_WIDTH_LIMIT);
	const scale = ratio >= 1 ? ratio : ratio ** SMALL_SCREEN_EXPONENT;
	return math.clamp(scale, MIN_UI_SCALE, math.max(maxScale, MIN_UI_SCALE));
}

/**
 * Scale of the pixel-sized billboards over the tanks (hunger badges, coin popups, the Pelican's charges, the
 * onboarding pointer): they shrink with the screen too, the tank being smaller on it, but less than the
 * screen UI so a badge stays readable from the far 2.5D camera. Read when a billboard is made.
 */
export function getWorldLabelScale(): number {
	return math.max(getUiScale(1), MIN_WORLD_LABEL_SCALE);
}

/** Calls `callback` whenever the viewport changes size (rotation, window resized). Returns the disconnect. */
export function onViewportChanged(callback: () => void): () => void {
	const camera = Workspace.CurrentCamera;
	if (!camera) return () => {};
	const connection = camera.GetPropertyChangedSignal("ViewportSize").Connect(callback);
	return () => connection.Disconnect();
}

/** `getUiScale(maxScale)`, re-rendering the component when the viewport changes size. */
export function useUiScale(maxScale = DEFAULT_MAX_UI_SCALE): number {
	const [scale, setScale] = useState(() => getUiScale(maxScale));
	useEffect(() => {
		const update = () => setScale(getUiScale(maxScale));
		update();
		return onViewportChanged(update);
	}, [maxScale]);
	return scale;
}
