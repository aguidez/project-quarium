import { ReplicatedStorage, RunService } from "@rbxts/services";
import { SfxName } from "./sounds";
import { SwimSegment } from "./swim";
import { EggType } from "./types/eggs";
import { FishType, HungerState } from "./types/fish";
import { PlayerData } from "./types/playerData";
import { FishEffect } from "./types/ufo";
import { LeaderboardSync } from "./types/leaderboards";
import { AdminTankInfo } from "./types/admin";
import { FishVariant } from "./types/variants";

// Define all client <-> server contracts here
export interface ServerToClientEvents {
	SyncPlayerData: (data: PlayerData) => void;
	/** Short message toast: "info" for gentle hints (tutorial), "warning" when an action failed. */
	Notify: (message: string, kind: NotifyKind) => void;
	/** Purely visual: the server has already credited the money. */
	MoneyPopup: (popup: MoneyPopup) => void;
	/** Plays a 2D sound effect for this player (e.g. one of their fish eating). */
	PlaySfx: (sfx: SfxName, playbackSpeed: number) => void;
	/** An egg of this player hatched: the client plays the reveal, the server drops the fish afterwards. */
	EggHatched: (hatch: EggHatch) => void;
	/** Purely visual celebration: the server has already credited the reward. */
	Reward: (reward: Reward) => void;
	/** Fish of the tanks this client watches (see FishMessage): the client builds and moves them itself. */
	FishSync: (message: FishMessage) => void;
	/** The lobby leaderboards (LeaderboardService, every 30 s and at join): the tops and the player's own scores. */
	LeaderboardSync: (sync: LeaderboardSync) => void;
	/** The admin panel's Aquariums tab: the players of this server and their tanks (AdminService, admins only). */
	AdminTanks: (tanks: AdminTankInfo[]) => void;
}

export interface ClientToServerEvents {
	/**
	 * "BuyEgg" | "OpenEgg" (payload: EggType) | "SetFocus" (payload: boolean, 2.5D view entered / left)
	 * | "RequestSync" (no payload) | "AdminStartEvent" (payload: GameEventType) | "AdminStopEvent" (no payload)
	 *   | "AdminRequestTanks" (no payload) | "AdminRemoveFish" ({ userId, fishId }) | "AdminAddFish" ({ userId,
	 *   fishType, variant }) | "AdminSetLeaderboardBan" ({ userId, banned }) (admin panel, see AdminService: refused
	 *   without its right)
	 * | "ClaimQuest" (payload: quest id) | "EquipCompanion" | "UnequipCompanion" (payload: CompanionType)
	 * | "ReleaseFish" (payload: FishType) | "FinishTutorial" (payload: Feature)
	 * | "WatchAquariums" (payload: PlotIndex[]: the tanks this client renders, see FishService)
	 * | "GiveLike" (payload: PlotIndex of the liked aquarium, from its like board, see LikeService)
	 * | "BuyGamePass" (payload: GamePass: the server shows Roblox's purchase prompt, see GamePassService)
	 */
	RequestAction: (actionName: string, payload?: unknown) => void;
	/**
	 * Every in-world interaction goes through this single remote so the server can
	 * rate-limit them all in one place (see InteractionService).
	 */
	Interact: (kind: InteractionKind, payload: unknown) => void;
}

/** In-world interactions. Payloads: DropFood -> Vector3, CollectCoin -> the coin BasePart, CatchStar -> the star's. */
export type InteractionKind = "DropFood" | "CollectCoin" | "CatchStar";

export type NotifyKind = "info" | "warning";

export interface MoneyPopup {
	position: Vector3;
	amount: number;
	special: boolean; // collected a sparkling coin
	/** Ocean Points (a fish released to the ocean) rather than money. */
	ocean?: boolean;
	/** A coin stolen by the lantern fish of the abyssal raid: money lost, shown as "-X$". */
	stolen?: boolean;
	/** A ghost fish's ghost coin. */
	ghost?: boolean;
}

/** Celebrated reward: money (`amount`), or an item such as a companion (`item`). */
export interface Reward {
	title: string;
	subtitle: string;
	amount: number;
	item?: RewardItem;
}

export interface RewardItem {
	/** Short text drawn as the icon when there is no image (e.g. "+1"). */
	icon: string;
	name: string;
	/** Image asset id shown instead of `icon` (companion sticker...). */
	image?: string;
	/** A fish's sticker (the client's FISH_ICONS, Normal) shown instead of `icon` / `image`. */
	fishType?: FishType;
}

/** A fish as the clients render it: no 3D model exists on the server (see FishService). */
export interface FishView {
	id: number;
	plot: number; // PlotIndex of its tank
	fishType: FishType;
	variant: FishVariant;
	scale: number; // adult scale (× the template), reached at the last growth stage
	growthStage: number;
	hunger: HungerState;
	paused: boolean; // owner AFK: hunger and coins frozen
	segment: SwimSegment;
	/** A UFO's mutation for a while (shared/types/ufo): asleep, or coins x2 / x0.5 with a green / red aura. */
	effect?: FishEffect;
}

/** Why a fish leaves the tank: eaten by a cannibal, released to the ocean, or gone (its owner left). */
export type FishRemoval = "Eaten" | "Released" | "Gone" | "Abducted"; // Abducted: beamed up into a UFO (it comes back)

/** What the server tells the clients watching a tank about its fish; positions are computed from the segments. */
export type FishMessage =
	| { kind: "Tank"; plot: number; fish: FishView[] } // full state, when the client starts watching the tank
	| { kind: "Spawn"; fish: FishView }
	| { kind: "Swim"; id: number; segment: SwimSegment }
	| { kind: "State"; id: number; hunger: HungerState; growthStage: number; paused: boolean; effect?: FishEffect }
	| { kind: "Scream"; id: number } // an alien fish screams: a wave through its tank (FishService)
	| { kind: "Remove"; id: number; cause: FishRemoval; by?: number }; // by: the predator

export interface EggHatch {
	eggType: EggType;
	fishType: FishType;
	variant: FishVariant;
	/** First fish of this type and variant the player hatches (a new fish index entry). */
	firstTime: boolean;
	/** Its variant was drawn with the player's star power (a starfall), spent by this egg. */
	starPowered: boolean;
}

function getOrCreateRemoteFolder(): Folder {
	let folder = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (!folder && RunService.IsServer()) {
		folder = new Instance("Folder");
		folder.Name = "Remotes";
		folder.Parent = ReplicatedStorage;
	} else if (!folder && RunService.IsClient()) {
		folder = ReplicatedStorage.WaitForChild("Remotes") as Folder;
	}
	return folder!;
}

export function getRemoteEvent(name: string): RemoteEvent {
	const folder = getOrCreateRemoteFolder();
	if (RunService.IsServer()) {
		let remote = folder.FindFirstChild(name) as RemoteEvent | undefined;
		if (!remote) {
			remote = new Instance("RemoteEvent");
			remote.Name = name;
			remote.Parent = folder;
		}
		return remote;
	} else {
		return folder.WaitForChild(name) as RemoteEvent;
	}
}
