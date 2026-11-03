/**
 * The food reserve: food is free, but the player holds at most FOOD_RESERVE_SLOTS portions. A portion used comes back
 * FOOD_REFILL_TIME seconds later, each slot on its own timer (several refill side by side). Only the player's own
 * clicks use it: the companions' pellets are free and unlimited. FoodService keeps it in memory (full at every join)
 * and publishes it on the Player for the HUD (FoodReserve.tsx) and the click handler (AquariumInteractionController).
 */
export const FOOD_RESERVE_SLOTS = 5;
export const FOOD_REFILL_TIME = 10; // seconds

/**
 * Player attributes: `FoodSlots` (the reserve's size) and `FoodRefills` (the server times at which the used portions
 * come back, soonest first, comma-separated: an attribute can't hold a list). A time already passed is a full slot.
 */
export const FOOD_RESERVE_ATTRIBUTES = { slots: "FoodSlots", refills: "FoodRefills" } as const;

export function encodeFoodRefills(times: readonly number[]): string {
	return times.map((time) => string.format("%.2f", time)).join(",");
}

export function decodeFoodRefills(value: unknown): number[] {
	const times = new Array<number>();
	if (!typeIs(value, "string")) return times;
	for (const part of value.split(",")) {
		const time = tonumber(part);
		if (time !== undefined) times.push(time);
	}
	return times;
}

/** Portions ready at `now` (server time) out of `slots`. */
export function getFoodReady(slots: number, refills: readonly number[], now: number): number {
	let waiting = 0;
	for (const time of refills) if (time > now) waiting++;
	return math.max(slots - waiting, 0);
}
