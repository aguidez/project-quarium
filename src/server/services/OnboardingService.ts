import { Players, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, Reward } from "shared/network";
import {
	isOnboardingEggStep,
	ONBOARDING_COIN_DELAY,
	ONBOARDING_FEED_DELAY,
	ONBOARDING_REWARD,
} from "shared/types/onboarding";
import { AquariumService } from "./AquariumService";
import { CoinService } from "./CoinService";
import { DataService } from "./DataService";
import { FishService } from "./FishService";

const TICK = 0.25;

/** Runtime state of a player's onboarding (the step itself lives in PlayerData). */
interface OnboardingTimers {
	fishBornAt?: number; // os.clock() when the onboarding fish was dropped in the tank
	coinDropped: boolean;
	coinCollectedAt?: number;
}

/**
 * Drives the main onboarding (steps in shared/types/onboarding): validates each step from
 * server-side facts only (the player is tending their tank, the fish was born, the coin was
 * collected, the fish ate) and triggers the scripted moments (first coin, first hunger).
 * EggService / FoodService / FishService read the step to block or hold what isn't unlocked yet.
 */
class OnboardingServiceSingleton implements Lifecycle {
	private timers = new Map<Player, OnboardingTimers>();
	private rewardRemote = getRemoteEvent("Reward");

	public onInit() {
		FishService.onFishSpawned((owner) => {
			if (!isOnboardingEggStep(DataService.getOnboardingStep(owner))) return;
			this.getTimers(owner).fishBornAt = os.clock();
			DataService.setOnboardingStep(owner, "CollectCoin");
		});

		CoinService.onCollected((player, frozen) => {
			if (!frozen || DataService.getOnboardingStep(player) !== "CollectCoin") return;
			this.getTimers(player).coinCollectedAt = os.clock();
			DataService.setOnboardingStep(player, "CoinCollected");
		});

		FishService.onFishFed((owner) => {
			if (DataService.getOnboardingStep(owner) !== "Feed") return;
			DataService.setOnboardingStep(owner, "Done");
			this.timers.delete(owner);

			// Credited here (once: the step can only reach Done once), the client only celebrates it
			DataService.addMoney(owner, ONBOARDING_REWARD);
			const reward: Reward = {
				title: "Tutorial complete!",
				subtitle: "Spend it on eggs to grow your aquarium!",
				amount: ONBOARDING_REWARD,
			};
			this.rewardRemote.FireClient(owner, reward);
		});

		Players.PlayerRemoving.Connect((player) => this.timers.delete(player));
	}

	public onStart() {
		print("[Server] OnboardingService started.");

		while (true) {
			task.wait(TICK);
			for (const player of Players.GetPlayers()) this.update(player, os.clock());
		}
	}

	private getTimers(player: Player): OnboardingTimers {
		let timers = this.timers.get(player);
		if (!timers) {
			timers = { coinDropped: false };
			this.timers.set(player, timers);
		}
		return timers;
	}

	/** Timed / polled transitions. Scripted moments wait for the player to be at their tank. */
	private update(player: Player, now: number) {
		const step = DataService.getOnboardingStep(player);
		if (step === "Done") return;
		const tending = AquariumService.isTending(player);

		if (step === "EnterView") {
			if (tending) DataService.setOnboardingStep(player, "BuyEgg");
		} else if (step === "Hatching") {
			// The egg is ready: the player now has to open it themselves
			const serverNow = Workspace.GetServerTimeNow();
			for (const [, eggs] of pairs(DataService.getData(player)?.incubating ?? {})) {
				const hatchAt = eggs[0];
				if (hatchAt !== undefined && serverNow >= hatchAt) DataService.setOnboardingStep(player, "OpenEgg");
			}
		} else if (step === "CollectCoin") {
			const timers = this.getTimers(player);
			const bornAt = timers.fishBornAt ?? now;
			timers.fishBornAt = bornAt;
			if (!timers.coinDropped && tending && now >= bornAt + ONBOARDING_COIN_DELAY) {
				timers.coinDropped = FishService.dropFrozenCoin(player);
			}
		} else if (step === "CoinCollected") {
			const timers = this.getTimers(player);
			const collectedAt = timers.coinCollectedAt ?? now;
			timers.coinCollectedAt = collectedAt;
			if (tending && now >= collectedAt + ONBOARDING_FEED_DELAY) {
				FishService.makeHungry(player);
				DataService.setOnboardingStep(player, "Feed");
			}
		}
	}
}

export const OnboardingService = new OnboardingServiceSingleton();
