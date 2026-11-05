import { Players } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { formatShort } from "shared/format";
import { INCOME_ATTRIBUTES } from "shared/types/aquarium";
import { AquariumService } from "./AquariumService";
import { DataService } from "./DataService";

const UPDATE_INTERVAL = 1; // seconds between two refreshes (FishService publishes the income every second)
const INCOME_STAT = "$/s";
const REBIRTH_STAT = "Rebirth";

interface Stats {
	income: StringValue;
	rebirth: IntValue;
}

/**
 * The columns of Roblox's player list (top right): each player's "$/s" (what their tank earns, read from the
 * aquarium's IncomePerSecond attribute, the brass plaque's number, shortened: "25K") and their current rebirth.
 * A `leaderstats` folder per player, written only here.
 */
class PlayerListServiceSingleton implements Lifecycle {
	private stats = new Map<Player, Stats>();

	public onInit() {}

	public onStart() {
		print("[Server] PlayerListService started.");
		Players.PlayerRemoving.Connect((player) => this.stats.delete(player));
		while (true) {
			for (const player of Players.GetPlayers()) this.refresh(player);
			task.wait(UPDATE_INTERVAL);
		}
	}

	private refresh(player: Player) {
		const data = DataService.getData(player);
		if (!data) return; // profile not loaded yet
		let stats = this.stats.get(player);
		if (!stats || stats.income.Parent === undefined) {
			stats = this.build(player);
			this.stats.set(player, stats);
		}
		const perSecond = AquariumService.getAquarium(player)?.model.GetAttribute(INCOME_ATTRIBUTES.perSecond);
		const income = formatShort(typeIs(perSecond, "number") ? perSecond : 0);
		if (stats.income.Value !== income) stats.income.Value = income;
		if (stats.rebirth.Value !== data.rebirths) stats.rebirth.Value = data.rebirths;
	}

	private build(player: Player): Stats {
		player.FindFirstChild("leaderstats")?.Destroy();
		const folder = new Instance("Folder");
		folder.Name = "leaderstats";
		// The player list shows the columns in the order they are added
		const income = new Instance("StringValue");
		income.Name = INCOME_STAT;
		income.Value = "0";
		income.Parent = folder;
		const rebirth = new Instance("IntValue");
		rebirth.Name = REBIRTH_STAT;
		rebirth.Parent = folder;
		folder.Parent = player;
		return { income, rebirth };
	}
}

export const PlayerListService = new PlayerListServiceSingleton();
