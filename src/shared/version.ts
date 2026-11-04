import { ALPHA_ENABLED } from "./types/alpha";

/** The game's patch, the top one of RELEASE_NOTES.md: bump it with every new patch (CLAUDE.md §0b). */
export const GAME_VERSION = "0.60.17";

/** Shown in a corner of the screen (App): "Alpha V0.60.0" during the alpha, "V0.60.0" without it. */
export function getVersionLabel(): string {
	return ALPHA_ENABLED ? `Alpha V${GAME_VERSION}` : `V${GAME_VERSION}`;
}
