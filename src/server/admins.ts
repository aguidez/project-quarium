/**
 * Who may use the admin commands (events for every server...). Checked on the server, every time a
 * command runs: never trust anything the client says about it.
 */

/** Extra admins by UserId, on top of the game's owner (its user, or the owner of its group). */
const ADMIN_USER_IDS: number[] = [];
const GROUP_OWNER_RANK = 255;

/** The game's owner: the user who owns the place, or the owner (rank 255) of the group that does. */
export function isGameOwner(player: Player): boolean {
	if (game.CreatorType === Enum.CreatorType.User) return player.UserId === game.CreatorId;
	const [ok, rank] = pcall(() => player.GetRankInGroup(game.CreatorId));
	return ok && rank >= GROUP_OWNER_RANK;
}

export function isAdmin(player: Player): boolean {
	return isGameOwner(player) || ADMIN_USER_IDS.includes(player.UserId);
}
