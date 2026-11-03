import { MarketplaceService, Players } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, Reward } from "shared/network";
import { arePassesOnSale } from "shared/types/alpha";
import { GAME_PASSES, GamePass, getPassById, isGamePass } from "shared/types/gamepasses";
import { getCompanionSlots } from "shared/types/playerData";
import { DataService } from "./DataService";

/** Tries of a Roblox ownership check before keeping what the save says. */
const OWNERSHIP_TRIES = 3;
const RETRY_DELAY = 2;

/**
 * Gamepasses: the server alone writes PlayerData.passes, from Roblox. At join it asks Roblox which passes the
 * player owns (a failed check keeps the saved answer, so an outage never takes a pass away); a purchase is granted
 * at once from PromptGamePassPurchaseFinished. The client only asks for the purchase prompt ("BuyGamePass").
 * The effects are read where they act (shared/types/gamepasses: coins, Ocean Points, variant luck, slots).
 */
class GamePassServiceSingleton implements Lifecycle {
	private rewardRemote = getRemoteEvent("Reward");

	public onInit() {
		DataService.registerAction("BuyGamePass", isGamePass, (player, pass) => this.prompt(player, pass));
		MarketplaceService.PromptGamePassPurchaseFinished.Connect((player, id, purchased) => {
			const pass = getPassById(id);
			if (purchased && pass) this.grant(player, pass);
		});
		DataService.onLoaded((player) => task.spawn(() => this.refresh(player)));
	}

	public onStart() {
		print("[Server] GamePassService started.");
	}

	public owns(player: Player, pass: GamePass): boolean {
		return DataService.getData(player)?.passes.includes(pass) ?? false;
	}

	/** Gives or takes a pass without Roblox: the Studio "/pass" test command. Undone by the next join's check. */
	public setTestPass(player: Player, pass: GamePass, owned: boolean) {
		if (owned) this.grant(player, pass);
		else this.revoke(player, pass);
	}

	private prompt(player: Player, pass: GamePass) {
		const id = GAME_PASSES[pass].id;
		if (id <= 0 || !arePassesOnSale()) {
			DataService.notify(player, `${GAME_PASSES[pass].displayName} isn't on sale yet.`, "info");
			return;
		}
		if (this.owns(player, pass)) return;
		MarketplaceService.PromptGamePassPurchase(player, id);
	}

	private grant(player: Player, pass: GamePass) {
		const data = DataService.getData(player);
		if (!data || data.passes.includes(pass)) return;
		data.passes.push(pass);
		DataService.sync(player);
		const config = GAME_PASSES[pass];
		const reward: Reward = {
			title: "Thank you!",
			subtitle: config.description,
			amount: 0,
			item: { icon: "PASS", name: config.displayName, image: config.image !== "" ? config.image : undefined },
		};
		this.rewardRemote.FireClient(player, reward);
	}

	private revoke(player: Player, pass: GamePass) {
		const data = DataService.getData(player);
		const index = data?.passes.indexOf(pass) ?? -1;
		if (!data || index < 0) return;
		data.passes.remove(index);
		this.trimCompanions(player);
		DataService.sync(player);
	}

	/**
	 * The owner's test without passes ("/passes off" in Studio, saved in PlayerStats.testNoPasses): all passes are taken
	 * now and at each join; "/passes on" asks Roblox again. "/pass" still gives one for the session.
	 */
	public setTestNoPasses(player: Player, noPasses: boolean) {
		const stats = DataService.getSave(player)?.stats;
		if (!stats) return;
		stats.testNoPasses = noPasses;
		player.SetAttribute("TestNoPasses", noPasses ? true : undefined);
		task.spawn(() => this.refresh(player));
	}

	/** Asks Roblox again for every pass on sale; passes not on sale (id 0) only live through a Studio test. */
	private refresh(player: Player) {
		if (DataService.getSave(player)?.stats.testNoPasses) {
			player.SetAttribute("TestNoPasses", true);
			for (const [pass] of pairs(GAME_PASSES)) this.revoke(player, pass);
			return;
		}
		for (const [pass, config] of pairs(GAME_PASSES)) {
			if (config.id <= 0) {
				this.revoke(player, pass);
				continue;
			}
			const owned = this.checkOwnership(player, config.id);
			if (player.Parent !== Players) return;
			if (owned === true) this.grantSilently(player, pass);
			else if (owned === false) this.revoke(player, pass);
		}
	}

	/** undefined when Roblox didn't answer. */
	private checkOwnership(player: Player, id: number): boolean | undefined {
		for (let i = 0; i < OWNERSHIP_TRIES; i++) {
			// The typings brand the user id (a plain UserId at run time)
			const userId = player.UserId as unknown as User;
			const [ok, owned] = pcall(() => MarketplaceService.UserOwnsGamePassAsync(userId, id));
			if (ok) return owned;
			warn(`[Server] GamePassService: ownership check of ${id} for ${player.Name} failed: ${owned}`);
			task.wait(RETRY_DELAY);
		}
		return undefined;
	}

	/** An owned pass found at join: no thank-you popup. */
	private grantSilently(player: Player, pass: GamePass) {
		const data = DataService.getData(player);
		if (!data || data.passes.includes(pass)) return;
		data.passes.push(pass);
		DataService.sync(player);
	}

	/** A lost slot pass (refund, test): the companions beyond the slots go back to the collection. */
	private trimCompanions(player: Player) {
		const data = DataService.getData(player);
		if (!data) return;
		const slots = getCompanionSlots(data);
		while (data.equippedCompanions.size() > slots) data.equippedCompanions.pop();
	}
}

export const GamePassService = new GamePassServiceSingleton();
