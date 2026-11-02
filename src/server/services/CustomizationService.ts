import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { COSMETICS, isCosmeticId } from "shared/types/cosmetics";
import { getOwnedTitles, getUnlockedThemes, isHideable, isThemeChoice } from "shared/types/customization";
import { DataService } from "./DataService";

const isShownChange = t.interface({ id: t.string, shown: t.boolean });

/**
 * The player's aquarium choices (AquariumPanel): which reached theme the tank wears, which earned decor / finishes
 * show, which earned title floats above the head. Intents only: the server checks the theme is reached and the
 * cosmetic earned, then AquariumService and TitleService apply PlayerData's choices.
 */
class CustomizationServiceSingleton implements Lifecycle {
	public onInit() {
		DataService.registerAction("SetAquariumTheme", t.string, (player, theme) => {
			const data = DataService.getData(player);
			if (!data || !isThemeChoice(theme)) return;
			if (theme !== "Auto" && !getUnlockedThemes(data.rebirths).includes(theme)) return;
			data.themeChoice = theme;
			DataService.sync(player);
		});
		DataService.registerAction("SetCosmeticShown", isShownChange, (player, change) => {
			const data = DataService.getData(player);
			const id = change.id;
			if (!data || !isCosmeticId(id) || !isHideable(id) || !data.cosmetics.includes(id)) return;
			const index = data.hiddenCosmetics.indexOf(id);
			if (change.shown && index >= 0) data.hiddenCosmetics.remove(index);
			else if (!change.shown && index < 0) data.hiddenCosmetics.push(id);
			DataService.sync(player);
		});
		DataService.registerAction("SetTitle", t.string, (player, title) => {
			const data = DataService.getData(player);
			if (!data) return;
			if (title === "Auto" || title === "None") data.titleChoice = title;
			// An earned title, or a leaderboard title held today
			else if (isCosmeticId(title) && COSMETICS[title].kind === "Title" && getOwnedTitles(data).includes(title))
				data.titleChoice = title;
			else return;
			DataService.sync(player);
		});
	}

	public onStart() {
		print("[Server] CustomizationService started.");
	}
}

export const CustomizationService = new CustomizationServiceSingleton();
