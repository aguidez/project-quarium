import { CollectionService, Players, Workspace } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent } from "shared/network";
import { TAGS } from "shared/tags";
import {
	formatCountdown,
	getNextLikeAt,
	LIKE_BOARD_OFFSET,
	LIKE_BOOST_DURATION,
	LIKE_BOOST_MULTIPLIER,
	LIKE_RANGE,
} from "shared/types/likes";
import { Aquarium, AquariumService } from "./AquariumService";
import { DataService } from "./DataService";

const UPDATE_INTERVAL = 1; // seconds between two refreshes of the boards' attributes

/**
 * Likes between players (rules in shared/types/likes): places a like board beside every
 * aquarium, validates "GiveLike" intents (range, own tank, cooldown) and publishes each owner's
 * likes and boost on their aquarium (attributes read by the clients' LikeBoardController).
 * The boost lives only here, for the session (never saved); FishService doubles the coins
 * through getCoinMultiplier.
 */
class LikeServiceSingleton implements Lifecycle {
	private sfxRemote = getRemoteEvent("PlaySfx");
	private boards = new Map<Aquarium, Model>();
	/** When each boosted owner's boost ends (server time). Dropped when they leave: the boost is lost. */
	private boostEndsAt = new Map<Player, number>();
	private givenCallbacks = new Array<(giver: Player) => void>();
	private sentCallbacks = new Array<(giver: Player, owner: Player) => void>();

	/** Registers a callback fired when a player gives a like (QuestService counts them). */
	public onLikeGiven(callback: (giver: Player) => void) {
		this.givenCallbacks.push(callback);
	}

	/** Registers a callback fired with the giver and the liked owner once a like is given, after its notices (Sugar). */
	public onLikeSent(callback: (giver: Player, owner: Player) => void) {
		this.sentCallbacks.push(callback);
	}

	public onInit() {
		DataService.registerAction("GiveLike", t.integer, (player, plot) => this.giveLike(player, plot));
		Players.PlayerRemoving.Connect((player) => this.boostEndsAt.delete(player));
	}

	/** Coin value multiplier of the owner's fish right now. */
	public getCoinMultiplier(owner: Player): number {
		const endsAt = this.boostEndsAt.get(owner);
		return endsAt !== undefined && Workspace.GetServerTimeNow() < endsAt ? LIKE_BOOST_MULTIPLIER : 1;
	}

	public onStart() {
		this.placeBoards();
		print(`[Server] LikeService started with ${this.boards.size()} like boards.`);

		// Owners come and go and their data loads later: keep the boards' attributes in line
		while (true) {
			for (const aquarium of AquariumService.getAquariums()) this.publish(aquarium);
			task.wait(UPDATE_INTERVAL);
		}
	}

	private placeBoards() {
		const template = CollectionService.GetTagged(TAGS.LikeBoardTemplate).find((instance): instance is Model =>
			instance.IsA("Model"),
		);
		if (!template || !template.PrimaryPart || !template.FindFirstChild("Board")) {
			warn(`[Server] LikeService: no "${TAGS.LikeBoardTemplate}" model with a PrimaryPart and a "Board" part.`);
			return;
		}
		for (const aquarium of AquariumService.getAquariums()) {
			const board = template.Clone();
			board.Name = "LikeBoard";
			CollectionService.RemoveTag(board, TAGS.LikeBoardTemplate);
			board.SetAttribute("PlotIndex", aquarium.index);
			board.PivotTo(aquarium.cframe.mul(LIKE_BOARD_OFFSET));
			CollectionService.AddTag(board, TAGS.LikeBoard);
			board.Parent = aquarium.model;
			this.boards.set(aquarium, board);
		}
	}

	/** The owner's likes and boost, on the aquarium (nothing while it is free or its owner's data is loading). */
	private publish(aquarium: Aquarium) {
		const owner = aquarium.owner;
		const data = owner ? DataService.getData(owner) : undefined;
		const boostEndsAt = owner && data ? (this.boostEndsAt.get(owner) ?? 0) : undefined;
		const model = aquarium.model;
		if (model.GetAttribute("Likes") !== data?.likesReceived) model.SetAttribute("Likes", data?.likesReceived);
		if (model.GetAttribute("LikeBoostEndsAt") !== boostEndsAt) model.SetAttribute("LikeBoostEndsAt", boostEndsAt);
	}

	private giveLike(player: Player, plot: number) {
		const giver = DataService.getData(player);
		const aquarium = AquariumService.getAquariums().find((a) => a.index === plot);
		const owner = aquarium?.owner;
		if (!giver || !aquarium || !owner || owner === player) return;
		const receiver = DataService.getData(owner);
		const board = this.boards.get(aquarium);
		if (!receiver || !board) return;

		// The prompt only shows next to the board: anything farther is a forged request
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		if (!root || !root.IsA("BasePart")) return;
		if (root.Position.sub(board.GetPivot().Position).Magnitude > LIKE_RANGE) return;

		const now = Workspace.GetServerTimeNow();
		const nextLikeAt = getNextLikeAt(giver);
		if (now < nextLikeAt) {
			DataService.notify(player, `You can give your next like in ${formatCountdown(nextLikeAt - now)}.`, "info");
			return;
		}

		giver.lastLikeGivenAt = now;
		receiver.likesReceived += 1;
		// Each like restarts the boost at its full duration (likes don't add their durations up)
		this.boostEndsAt.set(owner, now + LIKE_BOOST_DURATION);
		DataService.sync(player);
		DataService.sync(owner);
		this.publish(aquarium);
		for (const callback of this.givenCallbacks) task.spawn(callback, player);

		const minutes = LIKE_BOOST_DURATION / 60;
		DataService.notify(
			owner,
			`${player.DisplayName} liked your aquarium! Coins x${LIKE_BOOST_MULTIPLIER} for ${minutes} min.`,
			"info",
		);
		DataService.notify(player, `You liked ${owner.DisplayName}'s aquarium!`, "info");
		this.sfxRemote.FireClient(owner, "OnboardingStep", 1.2);
		this.sfxRemote.FireClient(player, "OnboardingStep", 1.2);
		for (const callback of this.sentCallbacks) task.spawn(callback, player, owner);
	}
}

export const LikeService = new LikeServiceSingleton();
