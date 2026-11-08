import { t } from "@rbxts/t";
import { formatNumber } from "shared/format";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, Reward } from "shared/network";
import { FEATURES } from "shared/types/features";
import { isOnboardingDone } from "shared/types/onboarding";
import { DEFAULT_PLAYER_DATA } from "shared/types/playerData";
import { AQUARIUM_THEMES, formatMultiplier, getNextRebirth, getRebirthOceanPoints } from "shared/types/rebirths";
import { CoinService } from "./CoinService";
import { getTestSpeed } from "../playerStats";
import { DataService } from "./DataService";
import { EggService } from "./EggService";
import { FishService } from "./FishService";
import { QuestService } from "./QuestService";

/**
 * Rebirths (rules and balance in shared/types/rebirths). The "Rebirth" feature (menu + guided
 * tutorial) is the reward of the story quest "Saving Up" (have the first rebirth's price at once);
 * the "Rebirth" intent is then checked here: the run restarts and the coin multiplier / aquarium theme follow `PlayerData.rebirths`
 * (FishService, AquariumService).
 */
class RebirthServiceSingleton implements Lifecycle {
	private rewardRemote = getRemoteEvent("Reward");

	public onInit() {
		DataService.registerAction("Rebirth", t.nil, (player) => this.rebirth(player));
	}

	public onStart() {
		print("[Server] RebirthService started.");
	}

	private rebirth(player: Player) {
		const data = DataService.getData(player);
		if (!data || !isOnboardingDone(data.onboarding) || !data.features.includes("Rebirth")) return;
		const upcoming = getNextRebirth(data.rebirths);
		if (!upcoming) return;
		if (data.money < upcoming.price) {
			DataService.notify(player, `Not enough money! (${formatNumber(upcoming.price)}$ needed)`);
			return;
		}
		// An opened egg's fish isn't in the tank yet: it would come back after the reset
		if (EggService.isRevealing(player)) {
			DataService.notify(player, "Wait for your egg to hatch first!", "info");
			return;
		}

		// Every fish goes back to the ocean (counted from the data, the authority on the tank)
		const points = getRebirthOceanPoints(data) * getTestSpeed(DataService.getSave(player)?.stats);
		FishService.releaseAll(player);
		CoinService.clearOwner(player);

		// The run restarts: money, fish, eggs and the egg shop's gates. Everything else is kept
		data.money = upcoming.startMoney;
		data.fish = { ...DEFAULT_PLAYER_DATA.fish };
		data.fishVariants = {};
		data.incubating = {};
		data.eggCrab = {};
		data.eggsBought = {};
		data.rebirths += 1;
		if (!data.features.includes("Rebirth")) data.features.push("Rebirth");
		if (!data.tutorialsDone.includes("Rebirth")) data.tutorialsDone.push("Rebirth");
		DataService.addOceanPoints(player, points); // syncs
		QuestService.addProgress(player, "OceanPoints", points);
		QuestService.reportGauges(player); // Rebirths
		DataService.sync(player);

		const multiplier = formatMultiplier(upcoming.multiplier);
		const reward: Reward = {
			title: "REBIRTH!",
			subtitle: `Coins ${multiplier} forever • +${formatNumber(points)} Ocean Points • ${AQUARIUM_THEMES[upcoming.theme].displayName}`,
			amount: 0,
			item: { icon: "", name: `Coins ${multiplier}`, image: FEATURES.Rebirth.image },
		};
		this.rewardRemote.FireClient(player, reward);
		print(`[Server] ${player.Name} rebirthed (${data.rebirths}), +${points} Ocean Points.`);
	}
}

export const RebirthService = new RebirthServiceSingleton();
