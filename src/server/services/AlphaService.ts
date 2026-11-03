import { Lifecycle } from "shared/framework";
import { getRemoteEvent, Reward } from "shared/network";
import { ALPHA_ENABLED, ALPHA_TITLE, hasFinishedAlpha, isAlphaLimited } from "shared/types/alpha";
import { COSMETICS } from "shared/types/cosmetics";
import { DataService } from "./DataService";
import { FishService } from "./FishService";

/**
 * The end of the alpha (shared/types/alpha): the first time a player has every species of the alpha, they earn its
 * title and a thank-you message inviting their feedback. Checked when a fish joins the tank (after its egg's reveal),
 * and at join for a save that got there without the message (no popup then).
 */
class AlphaServiceSingleton implements Lifecycle {
	private rewardRemote = getRemoteEvent("Reward");

	public onInit() {
		if (!ALPHA_ENABLED) return;
		FishService.onFishSpawned((owner) => this.check(owner, true));
		DataService.onLoaded((player) => this.check(player, false));
	}

	public onStart() {
		print("[Server] AlphaService started.");
	}

	private check(player: Player, celebrate: boolean) {
		const data = DataService.getData(player);
		if (!data || data.cosmetics.includes(ALPHA_TITLE) || !hasFinishedAlpha(data.hatched)) return;
		DataService.addCosmetic(player, ALPHA_TITLE); // syncs
		// A save past the alpha (made before it) gets the title quietly: the message is the alpha's own ending
		if (!celebrate || !isAlphaLimited(data.rebirths)) return;
		const reward: Reward = {
			title: "ALPHA COMPLETE!",
			subtitle:
				"You found every fish of the alpha. Thank you for testing! Tell us what you loved and what you would change: your feedback shapes the full game.",
			amount: 0,
			item: { icon: "NEW TITLE", name: COSMETICS[ALPHA_TITLE].displayName },
		};
		this.rewardRemote.FireClient(player, reward);
		print(`[Server] ${player.Name} finished the alpha.`);
	}
}

export const AlphaService = new AlphaServiceSingleton();
