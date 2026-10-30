import { Players, RunService, TextChatService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { isGameOwner } from "../admins";
import { CoinService } from "./CoinService";
import { DataService } from "./DataService";
import { EggService } from "./EggService";
import { FishService } from "./FishService";

const RESET_COMMAND = "/datareset";
const CONFIRM_WORD = "confirm";
/** "/datareset confirm" must follow "/datareset" within this many seconds. */
const CONFIRM_WINDOW = 15;
const NEXT_FRENCH_COMMAND = "/nextfrench";
const INCUBATORS_COMMAND = "/incubators";
/** The most incubators the test command gives (the V1 plan stops at 2). */
const MAX_TEST_INCUBATORS = 4;

/**
 * Developer chat commands, for playtests in Studio only. They don't exist at all on a live server
 * (the TextChatCommand is never created there), and even in Studio only the place's owner can use
 * them. Each one checks the player again when it runs.
 *
 *  /datareset           asks for a confirmation
 *  /datareset confirm   wipes the player's save to a brand new one and kicks them (stop / start the
 *                       playtest to begin again from the onboarding)
 *  /nextfrench          the next egg opened hatches a French Fish (the easter egg), to test it
 *  /incubators <n>      sets the player's incubators per egg type (saved: "/incubators 1" puts it back)
 */
class DevCommandServiceSingleton implements Lifecycle {
	private resetAskedAt = new Map<Player, number>();

	public onInit() {
		if (!RunService.IsStudio()) return;

		const command = new Instance("TextChatCommand");
		command.Name = "DevDataReset";
		command.PrimaryAlias = RESET_COMMAND;
		command.Triggered.Connect((source, text) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onReset(player, text);
		});
		command.Parent = TextChatService;

		const nextFrench = new Instance("TextChatCommand");
		nextFrench.Name = "DevNextFrench";
		nextFrench.PrimaryAlias = NEXT_FRENCH_COMMAND;
		nextFrench.Triggered.Connect((source) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onNextFrench(player);
		});
		nextFrench.Parent = TextChatService;

		const incubators = new Instance("TextChatCommand");
		incubators.Name = "DevIncubators";
		incubators.PrimaryAlias = INCUBATORS_COMMAND;
		incubators.Triggered.Connect((source, text) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onIncubators(player, text);
		});
		incubators.Parent = TextChatService;
		Players.PlayerRemoving.Connect((player) => this.resetAskedAt.delete(player));
	}

	public onStart() {
		if (RunService.IsStudio())
			print(
				`[Server] DevCommandService: ${RESET_COMMAND}, ${NEXT_FRENCH_COMMAND}, ${INCUBATORS_COMMAND} available (Studio, place owner only).`,
			);
	}

	/** Studio and the place's owner (its user, or the owner of its group): nobody else, ever. */
	private isAllowed(player: Player): boolean {
		return RunService.IsStudio() && isGameOwner(player);
	}

	private onNextFrench(player: Player) {
		if (!this.isAllowed(player)) {
			warn(`[Server] ${player.Name} tried ${NEXT_FRENCH_COMMAND}: refused (not the place's owner).`);
			return;
		}
		EggService.forceNextHatch(player, "FrenchFish");
		DataService.notify(player, "Your next egg will hatch a French Fish.", "info");
	}

	private onIncubators(player: Player, text: string) {
		const data = DataService.getData(player);
		if (!this.isAllowed(player) || !data) {
			warn(`[Server] ${player.Name} tried ${INCUBATORS_COMMAND}: refused (not the place's owner).`);
			return;
		}
		const count = tonumber(text.split(" ")[1]);
		if (count === undefined) return;
		data.incubators = math.clamp(math.floor(count), 1, MAX_TEST_INCUBATORS);
		DataService.sync(player);
		DataService.notify(player, `Incubators per egg type: ${data.incubators}.`, "info");
	}

	private onReset(player: Player, text: string) {
		if (!this.isAllowed(player)) {
			warn(`[Server] ${player.Name} tried ${RESET_COMMAND}: refused (not the place's owner).`);
			return;
		}
		const words = text
			.lower()
			.split(" ")
			.filter((word) => word !== "");
		const confirmed = words[1] === CONFIRM_WORD;
		const askedAt = this.resetAskedAt.get(player);
		if (!confirmed || askedAt === undefined || os.clock() - askedAt > CONFIRM_WINDOW) {
			this.resetAskedAt.set(player, os.clock());
			DataService.notify(
				player,
				`This erases ALL your progress (money, fish, Fish Index, quests, rebirths...). Type "${RESET_COMMAND} ${CONFIRM_WORD}" within ${CONFIRM_WINDOW} s to do it.`,
			);
			return;
		}
		this.resetAskedAt.delete(player);

		// Empty the tank first, so nothing of the old run is written back into the fresh save
		FishService.releaseAll(player);
		CoinService.clearOwner(player);
		if (DataService.resetSave(player, "Your data was reset. Stop and start the playtest to begin again.")) {
			warn(`[Server] ${player.Name}'s save was reset with ${RESET_COMMAND}.`);
		}
	}
}

export const DevCommandService = new DevCommandServiceSingleton();
