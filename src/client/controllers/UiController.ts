import { GamePass } from "shared/types/gamepasses";
import React from "@rbxts/react";
import { createRoot, Root } from "@rbxts/react-roblox";
import { ContentProvider, Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { EggHatch, getRemoteEvent, Reward } from "shared/network";
import { COMPANION_TYPES, CompanionType } from "shared/types/companions";
import { EGG_TYPES, EggType } from "shared/types/eggs";
import { ADMIN_PANEL_ATTRIBUTE } from "shared/types/admin";
import { GameEventType } from "shared/types/events";
import { Feature } from "shared/types/features";
import { FISH_TYPES, FishType } from "shared/types/fish";
import { PlayerData } from "shared/types/playerData";
import { FISH_VARIANTS, FishVariant } from "shared/types/variants";
import { App } from "client/ui/App";
import { BOOST_SECONDS_ATTRIBUTE } from "client/ui/QuestBoostPill";
import { FISH_ICONS } from "client/ui/theme";
import { AquariumInteractionController } from "./AquariumInteractionController";
import { AudioController } from "./AudioController";
import { FocusController } from "./FocusController";
import { LikeBoardController } from "./LikeBoardController";
import { MusicEventController } from "./MusicEventController";
import { ShopKeeperController } from "./ShopKeeperController";

const isEggHatch = t.interface({
	eggType: t.keyOf(EGG_TYPES),
	fishType: t.keyOf(FISH_TYPES),
	variant: t.keyOf(FISH_VARIANTS),
	firstTime: t.boolean,
	starPowered: t.boolean,
});
const isReward = t.interface({
	title: t.string,
	subtitle: t.string,
	amount: t.number,
	item: t.optional(t.interface({ icon: t.string, name: t.string, image: t.optional(t.string) })),
});

type QueuedReveal = EggHatch & { id: number };
type QueuedReward = Reward & { id: number };

/**
 * Mounts the @rbxts/react UI (src/client/ui, designed in FigCraft) and feeds it the
 * server's player data snapshots. The UI only displays data and sends intents.
 */
class UiControllerSingleton implements Lifecycle {
	private syncRemote = getRemoteEvent("SyncPlayerData");
	private actionRemote = getRemoteEvent("RequestAction");
	private hatchRemote = getRemoteEvent("EggHatched");
	private rewardRemote = getRemoteEvent("Reward");
	private adminTanksRemote = getRemoteEvent("AdminTanks");
	private root?: Root;
	private data?: PlayerData;
	/** Hatches waiting for their reveal, played one after another (the server times the fish drops the same way). */
	private reveals = new Array<QueuedReveal>();
	private nextRevealId = 0;
	/** Rewards to celebrate, one after another and only once no reveal is playing. */
	private rewards = new Array<QueuedReward>();
	private nextRewardId = 0;
	/** Whether the last render showed the quest boost pill. */
	private questBoosted = false;

	public onInit() {
		const screenGui = new Instance("ScreenGui");
		screenGui.Name = "ReactUi";
		screenGui.ResetOnSpawn = false;
		screenGui.IgnoreGuiInset = true;
		screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		screenGui.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");

		this.root = createRoot(screenGui);
		this.syncRemote.OnClientEvent.Connect((data: PlayerData) => {
			// The saved volume, once: afterwards the sound control owns it (a later sync may predate its last change)
			if (!this.data) AudioController.setMasterVolume(data.soundVolume);
			this.data = data;
			this.render();
			// The save is loaded: the loading screen (src/first/LoadingScreen) can go. Local attribute only
			Players.LocalPlayer.SetAttribute("DataLoaded", true);
		});
		this.hatchRemote.OnClientEvent.Connect((hatch: unknown) => {
			if (!isEggHatch(hatch)) return;
			this.reveals.push({ ...hatch, id: ++this.nextRevealId });
			this.render();
		});
		this.rewardRemote.OnClientEvent.Connect((reward: unknown) => {
			if (!isReward(reward)) return;
			this.rewards.push({ ...reward, id: ++this.nextRewardId });
			this.render();
		});
		MusicEventController.onEventChanged(() => this.render());
		LikeBoardController.onOwnBoostChanged(() => this.render());
		Players.LocalPlayer.GetAttributeChangedSignal("TestSpeed").Connect(() => this.render());
		Players.LocalPlayer.GetAttributeChangedSignal("TestNoPasses").Connect(() => this.render());
		Players.LocalPlayer.GetAttributeChangedSignal(ADMIN_PANEL_ATTRIBUTE).Connect(() => this.render());
		// The quest boost pill shows / hides as the boost starts or ends (it counts down by itself)
		Players.LocalPlayer.GetAttributeChangedSignal(BOOST_SECONDS_ATTRIBUTE).Connect(() => {
			if (this.isQuestBoosted() !== this.questBoosted) this.render();
		});
		ShopKeeperController.onNearbyChanged(() => this.render());
		FocusController.onViewChanged(() => this.render());
		this.render();
	}

	public onStart() {
		print("[Client] UiController started.");
		this.preloadFishIcons();
	}

	/**
	 * Downloads every fish icon right away: the hatch reveal shows one the instant the egg breaks,
	 * and its variant is only known when the egg opens, so all of them must be ready.
	 */
	private preloadFishIcons() {
		const images = new Array<Instance>();
		for (const [, companion] of pairs(COMPANION_TYPES)) {
			const image = new Instance("ImageLabel");
			image.Image = companion.image;
			images.push(image);
		}
		for (const [, variants] of pairs(FISH_ICONS)) {
			for (const [, id] of pairs(variants)) {
				const image = new Instance("ImageLabel");
				image.Image = id;
				images.push(image);
			}
		}
		task.spawn(() => {
			ContentProvider.PreloadAsync(images);
			for (const image of images) image.Destroy();
		});
	}

	/** "TEST SPEED x6 · NO PASSES": the owner's test modes, from the server's attributes (DevCommandService). */
	private getTestMode(): string | undefined {
		const parts = new Array<string>();
		const speed = Players.LocalPlayer.GetAttribute("TestSpeed");
		if (typeIs(speed, "number")) parts.push(`TEST SPEED x${speed}`);
		if (Players.LocalPlayer.GetAttribute("TestNoPasses") === true) parts.push("NO PASSES");
		return parts.size() > 0 ? parts.join(" · ") : undefined;
	}

	private isQuestBoosted(): boolean {
		const seconds = Players.LocalPlayer.GetAttribute(BOOST_SECONDS_ATTRIBUTE);
		return typeIs(seconds, "number") && seconds > 0;
	}

	private render() {
		this.questBoosted = this.isQuestBoosted();
		this.root?.render(
			React.createElement(App, {
				data: this.data,
				// Intent only: the server checks the price, the player's money and draws the fish
				onBuy: (eggType: EggType) => this.actionRemote.FireServer("BuyEgg", eggType),
				// The server checks the egg exists and its incubation is over
				onOpen: (eggType: EggType) => this.actionRemote.FireServer("OpenEgg", eggType),
				reveal: this.reveals[0],
				onRevealEnd: () => {
					this.reveals.shift();
					this.render();
				},
				reward: this.reveals.size() === 0 ? this.rewards[0] : undefined,
				onRewardEnd: () => {
					this.rewards.shift();
					this.render();
				},
				playSfx: (name, playbackSpeed) => AudioController.play(name, playbackSpeed),
				event: MusicEventController.getEvent(),
				likeBoostEndsAt: LikeBoardController.getOwnBoostEndsAt(),
				questBoosted: this.questBoosted,
				// Intents only: the server checks the theme is reached and the cosmetic earned
				onSetTheme: (theme) => this.actionRemote.FireServer("SetAquariumTheme", theme),
				onSetCosmeticShown: (id, shown) => this.actionRemote.FireServer("SetCosmeticShown", { id, shown }),
				onSetTitle: (title) => this.actionRemote.FireServer("SetTitle", title),
				testMode: this.getTestMode(),
				shopNearby: ShopKeeperController.isNearby(),
				inView: FocusController.isInView(),
				subscribeFoodDenied: (listener) => AquariumInteractionController.onFoodDenied(listener),
				onVolumeChange: (volume) => AudioController.setMasterVolume(volume),
				// A preference: the server only checks the range and saves it
				onVolumeCommit: (volume) => this.actionRemote.FireServer("SetSoundVolume", volume),
				subscribeBeat: (listener) => MusicEventController.onBeat(listener),
				// Intents only: the server checks the quest is complete / the companion is owned and a slot is free
				onClaimQuest: (questId: string) => this.actionRemote.FireServer("ClaimQuest", questId),
				onEquipCompanion: (companionType: CompanionType) =>
					this.actionRemote.FireServer("EquipCompanion", companionType),
				onUnequipCompanion: (companionType: CompanionType) =>
					this.actionRemote.FireServer("UnequipCompanion", companionType),
				// The server checks the Ocean is unlocked, the fish exists and one is kept, then credits the points
				onReleaseFish: (fishType: FishType, variant: FishVariant) =>
					this.actionRemote.FireServer("ReleaseFish", { fishType, variant }),
				onFinishTutorial: (feature: Feature) => this.actionRemote.FireServer("FinishTutorial", feature),
				// The server checks the points and that it wasn't claimed before
				onClaimOceanReward: (id: string) => this.actionRemote.FireServer("ClaimOceanReward", id),
				// Intent only: the server checks the price, resets the run and applies the multiplier
				onRebirth: () => this.actionRemote.FireServer("Rebirth"),
				// Intent only: the server shows Roblox's prompt; the pass comes from Roblox, never from the client
				onBuyPass: (pass: GamePass) => this.actionRemote.FireServer("BuyGamePass", pass),
				// Admin panel: only when the server allows it (AdminService), which checks every action again
				admin:
					Players.LocalPlayer.GetAttribute(ADMIN_PANEL_ATTRIBUTE) === true
						? {
								onStartEvent: (eventType: GameEventType) =>
									this.actionRemote.FireServer("AdminStartEvent", eventType),
								onStopEvent: () => this.actionRemote.FireServer("AdminStopEvent"),
								// Aquariums tab: this server's tanks, refreshed while it is open; intents checked again
								onRequestTanks: () => this.actionRemote.FireServer("AdminRequestTanks"),
								subscribeTanks: (listener) => {
									const connection = this.adminTanksRemote.OnClientEvent.Connect(listener);
									return () => connection.Disconnect();
								},
								onRemoveFish: (userId, fishId) =>
									this.actionRemote.FireServer("AdminRemoveFish", { userId, fishId }),
								onAddFish: (userId, fishType, variant) =>
									this.actionRemote.FireServer("AdminAddFish", { userId, fishType, variant }),
								onSetLeaderboardBan: (userId, banned) =>
									this.actionRemote.FireServer("AdminSetLeaderboardBan", { userId, banned }),
							}
						: undefined,
			}),
		);
	}
}

export const UiController = new UiControllerSingleton();
