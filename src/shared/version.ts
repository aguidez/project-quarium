/** The game's patch, the top one of RELEASE_NOTES.md: bump it with every new patch (CLAUDE.md §0b). */
export const GAME_VERSION = "1.1.22";

/** Shown in a corner of the screen (App): "V1.0.0". */
export function getVersionLabel(): string {
	return `V${GAME_VERSION}`;
}
