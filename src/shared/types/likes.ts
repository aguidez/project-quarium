import { PlayerData } from "./playerData";

/**
 * Likes: next to each aquarium, a small board shows how many likes its owner has received.
 * Any other player can like it from the board (one like per hour per player, whatever the
 * aquarium). A like received doubles the coins of the owner's fish for LIKE_BOOST_DURATION: each
 * new like restarts the boost at that duration (it doesn't add up). The boost isn't saved: it is
 * lost when the owner leaves.
 */
export const LIKE_COOLDOWN = 60 * 60; // seconds between two likes given by a player
export const LIKE_BOOST_DURATION = 5 * 60; // seconds of boosted coins per like received
export const LIKE_BOOST_MULTIPLIER = 2; // coin value multiplier while boosted
/** Max distance (studs) between a player and a board to like it (prompt range + latency slack). */
export const LIKE_RANGE = 14;
export const LIKE_PROMPT_RANGE = 10;
/** The board stands beside the tank's front corner, on the right of a player facing the glass (aquarium frame). */
export const LIKE_BOARD_OFFSET = new CFrame(-30.6, -1, -8);

/** When the player may give their next like (Workspace.GetServerTimeNow() time). */
export function getNextLikeAt(data: PlayerData): number {
	return data.lastLikeGivenAt + LIKE_COOLDOWN;
}

/** "4:32" / "1:02:05" */
export function formatCountdown(seconds: number): string {
	const total = math.max(math.ceil(seconds), 0);
	const hours = math.floor(total / 3600);
	const minutes = math.floor((total % 3600) / 60);
	const secs = total % 60;
	const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}
