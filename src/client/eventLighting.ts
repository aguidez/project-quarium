import { Lighting } from "@rbxts/services";

/** The world look an event's night tweens to (local Lighting changes). */
export interface EventNight {
	/** May run past 24 (the day runs on through the sunset): applied modulo 24. */
	clockTime: number;
	brightness: number;
	exposure: number;
	ambient: Color3;
	outdoorAmbient: Color3;
	atmosphere: Color3;
	decay: Color3;
}

interface Baseline {
	clockTime: number;
	brightness: number;
	exposure: number;
	ambient: Color3;
	outdoorAmbient: Color3;
	atmosphere?: { instance: Atmosphere; color: Color3; decay: Color3 };
}

interface Layer {
	night: EventNight;
	amount: number;
}

// Every event's night blends over one snapshot of the place's own lighting, taken before the first one starts: an
// event starting while another's night is still on (one replacing another) never mistakes that night for the day
let baseline: Baseline | undefined;
const layers = new Map<string, Layer>();
const order = new Array<string>();

function snapshot(): Baseline {
	const atmosphere = Lighting.FindFirstChildOfClass("Atmosphere");
	return {
		clockTime: Lighting.ClockTime,
		brightness: Lighting.Brightness,
		exposure: Lighting.ExposureCompensation,
		ambient: Lighting.Ambient,
		outdoorAmbient: Lighting.OutdoorAmbient,
		atmosphere: atmosphere && { instance: atmosphere, color: atmosphere.Color, decay: atmosphere.Decay },
	};
}

/**
 * Sets how far an event's night is (0 = the place's own lighting, 1 = full night) and repaints Lighting: the nights
 * still on are lerped over the snapshot one after another, and once all are back to 0 the snapshot comes back exactly.
 */
export function setEventNight(name: string, night: EventNight, amount: number) {
	if (!layers.has(name)) order.push(name);
	layers.set(name, { night, amount });

	let anyOn = false;
	for (const [, layer] of layers) if (layer.amount > 0) anyOn = true;
	if (anyOn && !baseline) baseline = snapshot();
	const base = baseline;
	if (!base) return;

	let clockTime = base.clockTime;
	let brightness = base.brightness;
	let exposure = base.exposure;
	let ambient = base.ambient;
	let outdoorAmbient = base.outdoorAmbient;
	let color = base.atmosphere?.color;
	let decay = base.atmosphere?.decay;
	for (const key of order) {
		const layer = layers.get(key)!;
		const t = layer.amount;
		if (t <= 0) continue;
		clockTime += (layer.night.clockTime - clockTime) * t;
		brightness += (layer.night.brightness - brightness) * t;
		exposure += (layer.night.exposure - exposure) * t;
		ambient = ambient.Lerp(layer.night.ambient, t);
		outdoorAmbient = outdoorAmbient.Lerp(layer.night.outdoorAmbient, t);
		color = color?.Lerp(layer.night.atmosphere, t);
		decay = decay?.Lerp(layer.night.decay, t);
	}

	Lighting.ClockTime = clockTime % 24;
	Lighting.Brightness = brightness;
	Lighting.ExposureCompensation = exposure;
	Lighting.Ambient = ambient;
	Lighting.OutdoorAmbient = outdoorAmbient;
	// Only its colours: FocusController owns the atmosphere's density / haze (clear 2.5D view)
	if (base.atmosphere && color && decay) {
		base.atmosphere.instance.Color = color;
		base.atmosphere.instance.Decay = decay;
	}
	if (!anyOn) baseline = undefined;
}
