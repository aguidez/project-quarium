import { FishVariant, VARIANT_ORDER } from "./variants";

/**
 * UFO night (GAME_EVENTS.Ufo, UfoService): a UFO over every owned tank beams fish up one at a time and drops them
 * back a few seconds later, changed. The odds and effects are the owner's design (V0.49).
 */

/** What a kidnapped fish comes back with. */
export type UfoOutcome = "Sleep" | "Green" | "Red" | "Variant" | "Alien";

/** Percent chance of each outcome (they add up to 100). */
export const UFO_OUTCOME_ODDS: Record<UfoOutcome, number> = {
	Sleep: 20, // fast asleep for a minute: doesn't swim, eat nor drop coins
	Green: 55, // green aura for a minute: its coins are worth x2
	Red: 20, // red aura for a minute: its coins are worth x0.5
	Variant: 4.5, // the next variant for good (Normal → Anomaly → Ghost → Shiny); a Shiny gets Green instead
	Alien: 0.5, // turns into the alien fish (an easter egg that stays and screams)
};
export const UFO_OUTCOME_ORDER: readonly UfoOutcome[] = ["Sleep", "Green", "Red", "Variant", "Alien"];

/** A temporary mutation on a fish, shown to the clients (FishView.effect). */
export type FishEffect = "Sleep" | "Green" | "Red";
/** Seconds a mutation lasts (of play: frozen while the tank doesn't produce). */
export const FISH_EFFECT_DURATION = 60;
/** Coin value multiplier of a fish under a mutation. */
export const FISH_EFFECT_COIN_MULTIPLIER: Record<FishEffect, number> = { Sleep: 1, Green: 2, Red: 0.5 };

/** Draws an outcome with UFO_OUTCOME_ODDS (`roll` in [0, 1[). */
export function drawUfoOutcome(roll: number): UfoOutcome {
	let left = roll * 100;
	for (const outcome of UFO_OUTCOME_ORDER) {
		left -= UFO_OUTCOME_ODDS[outcome];
		if (left < 0) return outcome;
	}
	return "Green";
}

/** The variant one step better (Normal → Anomaly → Ghost → Shiny), or undefined for a Shiny. */
export function getNextVariant(variant: FishVariant): FishVariant | undefined {
	const index = VARIANT_ORDER.indexOf(variant);
	return index >= 0 && index < VARIANT_ORDER.size() - 1 ? VARIANT_ORDER[index + 1] : undefined;
}

/**
 * Pace of a kidnapping (seconds), one UFO per tank, one fish at a time: 10 s, then a pause (gap), about 12.2 s in
 * all, so 4 to 5 in the event's minute when the tank has enough fish (a fish is kidnapped once per event). No new
 * one starts unless it can end before the night does (UFO_KIDNAP_TIME).
 */
export const UFO_TIMING = {
	arrive: 1.6, // flies in from high up to above its target
	beamUp: 1.8, // the fish rises in the beam into the UFO
	leave: 1.5, // flies off with it
	away: 2.2, // "a little while" out of sight
	comeBack: 1.6,
	beamDown: 1.3, // the fish drops back into the water
	gap: 2.2, // hovers a moment before the next one
};
export const UFO_KIDNAP_TIME =
	UFO_TIMING.arrive +
	UFO_TIMING.beamUp +
	UFO_TIMING.leave +
	UFO_TIMING.away +
	UFO_TIMING.comeBack +
	UFO_TIMING.beamDown;

/** Attribute of a UFO model (tag Ufo): true while its beam shines (UfoEventController draws it). */
export const UFO_BEAM_ATTRIBUTE = "Beaming";
