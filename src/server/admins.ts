import { RunService } from "@rbxts/services";

/**
 * Who may use the admin commands (events for every server...). Checked on the server, every time a
 * command runs: never trust anything the client says about it.
 */

/** Extra admins by UserId, on top of the game's owner and its group's admin roles. */
const ADMIN_USER_IDS: number[] = [];
const GROUP_OWNER_RANK = 255;
/**
 * In a group game, the roles from this rank up are admins: the Manager role (254) the game's developer has, the owner
 * (255). The group's other roles (Guppy, Member: 1) are players.
 */
const GROUP_ADMIN_RANK = 254;

function getGroupRank(player: Player): number {
	if (game.CreatorType !== Enum.CreatorType.Group) return 0;
	const [ok, rank] = pcall(() => player.GetRankInGroup(game.CreatorId));
	return ok ? rank : 0;
}

/** The game's owner: the user who owns the place, or the owner (rank 255) of the group that does. */
export function isGameOwner(player: Player): boolean {
	if (game.CreatorType === Enum.CreatorType.User) return player.UserId === game.CreatorId;
	return getGroupRank(player) >= GROUP_OWNER_RANK;
}

/** Admins: the game's owner, its group's admin roles (GROUP_ADMIN_RANK) and ADMIN_USER_IDS. */
export function isAdmin(player: Player): boolean {
	return isGameOwner(player) || getGroupRank(player) >= GROUP_ADMIN_RANK || ADMIN_USER_IDS.includes(player.UserId);
}

/**
 * Who may open the admin panel (AdminService). For now everyone in a Studio playtest, never on a live server;
 * for the release it becomes `isAdmin(player)`.
 */
export function canUseAdminPanel(_player: Player): boolean {
	return RunService.IsStudio();
}
