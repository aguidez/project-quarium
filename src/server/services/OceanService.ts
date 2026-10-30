import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, MoneyPopup, Reward } from "shared/network";
import { Feature, FEATURES, MIN_FISH_KEPT } from "shared/types/features";
import { FISH_TYPES, FishType } from "shared/types/fish";
import { getPassOceanMultiplier } from "shared/types/gamepasses";
import { getCompanionSlots, getLivingVariant, getTotalFish } from "shared/types/playerData";
import { FISH_VARIANTS, FishVariant, getOceanPoints } from "shared/types/variants";
import { COMPANION_TYPES } from "shared/types/companions";
import { getOceanMilestone } from "shared/types/oceanRewards";
import { CompanionService } from "./CompanionService";
import { DataService } from "./DataService";
import { FishService } from "./FishService";
import { QuestService } from "./QuestService";

const isRelease = t.interface({
	fishType: t.keyOf(FISH_TYPES) as t.check<FishType>,
	variant: t.keyOf(FISH_VARIANTS) as t.check<FishVariant>,
});
const isFeature = t.keyOf(FEATURES) as t.check<Feature>;

/**
 * The Ocean (unlocked by a story quest): the player releases fish they don't need, freeing
 * their spot in the tank, and earns Ocean Points, a score that only grows.
 */
class OceanServiceSingleton implements Lifecycle {
	private popupRemote = getRemoteEvent("MoneyPopup");
	private rewardRemote = getRemoteEvent("Reward");

	public onInit() {
		DataService.registerAction("ReleaseFish", isRelease, (player, { fishType, variant }) =>
			this.release(player, fishType, variant),
		);
		DataService.registerAction("FinishTutorial", isFeature, (player, feature) =>
			this.finishTutorial(player, feature),
		);
		DataService.registerAction("ClaimOceanReward", t.string, (player, id) => this.claimReward(player, id));
		// An easter egg fish whose time is up goes to the ocean on its own: same points as a release
		FishService.onFishLeft((player, fishType, position) => {
			this.credit(player, getOceanPoints(fishType, "Normal"), position);
			const message = FISH_TYPES[fishType].easterEgg?.leaveMessage;
			if (message !== undefined) DataService.notify(player, message, "info");
		});
	}

	public onStart() {
		print("[Server] OceanService started.");
	}

	private release(player: Player, fishType: FishType, variant: FishVariant) {
		const data = DataService.getData(player);
		if (!data || !data.features.includes("Ocean") || getLivingVariant(data, fishType, variant) <= 0) return;
		if (getTotalFish(data) <= MIN_FISH_KEPT) {
			DataService.notify(player, "Keep at least one fish in your aquarium!");
			return;
		}

		const position = FishService.releaseFish(player, fishType, variant);
		if (!position) return;
		this.credit(player, getOceanPoints(fishType, variant), position);
		QuestService.addProgress(player, "FishReleased", 1, { fishType, variant });
		this.finishTutorial(player, "Ocean"); // releasing a fish is the whole lesson
	}

	/** Ocean Points of a fish gone to the ocean (x2 with the pass), with their popup where it was. */
	private credit(player: Player, basePoints: number, position: Vector3) {
		const points = basePoints * getPassOceanMultiplier(DataService.getData(player)?.passes ?? []);
		DataService.addOceanPoints(player, points);
		QuestService.addProgress(player, "OceanPoints", points);
		const popup: MoneyPopup = { position, amount: points, special: false, ocean: true };
		this.popupRemote.FireClient(player, popup);
	}

	/** An Ocean milestone reached and not claimed yet: grants its reward once (the points are never spent). */
	private claimReward(player: Player, id: string) {
		const data = DataService.getData(player);
		const milestone = getOceanMilestone(id);
		if (!data || !milestone || !data.features.includes("Ocean")) return;
		if (data.oceanPoints < milestone.points || data.oceanRewardsClaimed.includes(milestone.id)) return;

		data.oceanRewardsClaimed.push(milestone.id);
		let celebration: Reward;
		const reward = milestone.reward;
		if (reward.kind === "Companion") {
			const companion = COMPANION_TYPES[reward.companion];
			const equipped = CompanionService.grant(player, reward.companion, true); // syncs
			celebration = {
				title: "Ocean reward!",
				subtitle: equipped ? companion.ability : "Equip it from your companions.",
				amount: 0,
				item: { icon: "", name: companion.displayName, image: companion.image },
			};
		} else if (reward.kind === "CompanionUpgrade") {
			const companion = COMPANION_TYPES[reward.companion];
			DataService.sync(player); // CompanionService reads the upgrade from the claimed list
			celebration = {
				title: "Ocean reward!",
				subtitle: milestone.description,
				amount: 0,
				item: { icon: "", name: milestone.title, image: companion.image },
			};
		} else if (reward.kind === "Capacity") {
			data.capacity = math.max(data.capacity, reward.capacity);
			DataService.sync(player);
			celebration = {
				title: "Ocean reward!",
				subtitle: `Your aquarium now holds ${data.capacity} fish.`,
				amount: 0,
				item: { icon: `${data.capacity}`, name: milestone.title },
			};
		} else if (reward.kind === "Incubator") {
			data.incubators = math.max(data.incubators, reward.count);
			DataService.sync(player);
			celebration = {
				title: "Ocean reward!",
				subtitle: `${data.incubators} eggs of the same kind can now incubate at once.`,
				amount: 0,
				item: { icon: `x${data.incubators}`, name: milestone.title },
			};
		} else if (reward.kind === "VariantLuck") {
			DataService.sync(player); // EggService reads the luck from the claimed list
			celebration = {
				title: "Ocean reward!",
				subtitle: milestone.description,
				amount: 0,
				item: { icon: `x${reward.multiplier}`, name: milestone.title },
			};
		} else if (reward.kind === "Cosmetic") {
			for (const cosmetic of reward.cosmetics) DataService.addCosmetic(player, cosmetic); // syncs
			celebration = {
				title: "Ocean reward!",
				subtitle: milestone.description,
				amount: 0,
				item: { icon: "NEW", name: milestone.title },
			};
		} else {
			data.companionSlots += 1;
			DataService.sync(player);
			celebration = {
				title: "Ocean reward!",
				subtitle: `You can now have ${getCompanionSlots(data)} companions in your aquarium at once.`,
				amount: 0,
				item: { icon: "+1", name: "Companion slot" },
			};
		}
		this.rewardRemote.FireClient(player, celebration);
	}

	private finishTutorial(player: Player, feature: Feature) {
		const data = DataService.getData(player);
		if (!data || !data.features.includes(feature) || data.tutorialsDone.includes(feature)) return;
		data.tutorialsDone.push(feature);
		DataService.sync(player);
	}
}

export const OceanService = new OceanServiceSingleton();
