import { COSMETICS, CosmeticId, getBestTitle } from "./cosmetics";
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

/** The title above the head: the one picked if earned, none, or the best one ("Auto"). */
export function getDisplayedTitle(data: {
	cosmetics: readonly CosmeticId[];
	titleChoice: TitleChoice;
}): CosmeticId | undefined {
	const choice = data.titleChoice;
	if (choice === "None") return undefined;
	if (choice !== "Auto" && data.cosmetics.includes(choice)) return choice;
	return getBestTitle(data.cosmetics);
}
