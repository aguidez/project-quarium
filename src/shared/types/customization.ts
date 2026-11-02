import { COSMETICS, CosmeticId, LEADERBOARD_TITLES, TITLE_ORDER } from "./cosmetics";
import { LEADERBOARD_IDS, LeaderboardId } from "./leaderboards";
import { AquariumTheme, AQUARIUM_THEMES, getAquariumTheme, REBIRTHS } from "./rebirths";

/**
 * The player's aquarium choices (AquariumPanel, CustomizationService): which reached theme the tank wears, which
 * decor / finishes show, which title floats above the head. Every choice defaults to "everything earned shows":
 * the newest theme ("Auto"), every decor and finish, the best title. Purely cosmetic.
 */
export type ThemeChoice = AquariumTheme | "Auto";
export type TitleChoice = CosmeticId | "Auto" | "None";

/** The themes a player has reached: the basic one, then one per rebirth done. */
export function getUnlockedThemes(rebirths: number): AquariumTheme[] {
	const themes: AquariumTheme[] = ["Basic"];
	for (let i = 0; i < math.min(rebirths, REBIRTHS.size()); i++) themes.push(REBIRTHS[i].theme);
	return themes;
}

/** Every theme in rebirth order, and the rebirth that reaches it (0 for the basic one). */
export function getThemeOrder(): { theme: AquariumTheme; rebirth: number }[] {
	return [{ theme: "Basic", rebirth: 0 }, ...REBIRTHS.map((config, i) => ({ theme: config.theme, rebirth: i + 1 }))];
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
	return value === "Auto" || (typeIs(value, "string") && AQUARIUM_THEMES[value as AquariumTheme] !== undefined);
}

/** The theme the tank wears: the one chosen if still reached, else the newest one. */
export function getDisplayedTheme(data: { rebirths: number; themeChoice: ThemeChoice }): AquariumTheme {
	const choice = data.themeChoice;
	if (choice !== "Auto" && getUnlockedThemes(data.rebirths).includes(choice)) return choice;
	return getAquariumTheme(data.rebirths);
}

/** Decor and finishes can be hidden; titles are picked instead (getDisplayedTitle). */
export function isHideable(id: CosmeticId): boolean {
	return COSMETICS[id].kind === "Decor" || COSMETICS[id].kind === "Finish";
}

/** Whether an earned decor or finish shows in the tank. */
export function isCosmeticShown(
	data: { cosmetics: readonly CosmeticId[]; hiddenCosmetics: readonly CosmeticId[] },
	id: CosmeticId,
): boolean {
	return data.cosmetics.includes(id) && !data.hiddenCosmetics.includes(id);
}

/** What the title functions read from PlayerData. */
export interface TitleData {
	cosmetics: readonly CosmeticId[];
	/** The player's rank in the day's top 10 of each board (the leaderboard titles held). */
	leaderboardRanks: Partial<Record<LeaderboardId, number>>;
}

/** The leaderboard rank behind a held leaderboard title (undefined for an earned title or one not held). */
export function getTitleRank(data: TitleData, title: CosmeticId): number | undefined {
	const board = COSMETICS[title].leaderboard;
	return board !== undefined ? data.leaderboardRanks[board] : undefined;
}

/**
 * Every title the player may wear, the most prestigious first: the leaderboard titles held (best rank first, the boards'
 * order between equal ranks), then the earned ones (TITLE_ORDER).
 */
export function getOwnedTitles(data: TitleData): CosmeticId[] {
	const held = new Array<{ title: CosmeticId; rank: number; order: number }>();
	LEADERBOARD_IDS.forEach((board, order) => {
		const rank = data.leaderboardRanks[board];
		if (rank !== undefined) held.push({ title: LEADERBOARD_TITLES[board], rank, order });
	});
	held.sort((a, b) => (a.rank !== b.rank ? a.rank < b.rank : a.order < b.order));
	const titles = held.map((entry) => entry.title);
	for (const title of TITLE_ORDER) if (data.cosmetics.includes(title)) titles.push(title);
	return titles;
}

export function getBestTitle(data: TitleData): CosmeticId | undefined {
	return getOwnedTitles(data)[0];
}

/** The title above the head: the one picked if still held, none, or the best one ("Auto"). */
export function getDisplayedTitle(data: TitleData & { titleChoice: TitleChoice }): CosmeticId | undefined {
	const choice = data.titleChoice;
	if (choice === "None") return undefined;
	const owned = getOwnedTitles(data);
	if (choice !== "Auto" && owned.includes(choice)) return choice;
	return owned[0];
}
