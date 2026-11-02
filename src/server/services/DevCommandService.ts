import { Players, RunService, TextChatService, Workspace } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { isGameOwner } from "../admins";
import { CoinService } from "./CoinService";
import { DataService } from "./DataService";
import { EggService } from "./EggService";
import { FishService } from "./FishService";
import { GamePassService } from "./GamePassService";
import { UfoService } from "./UfoService";
import { UFO_OUTCOME_ORDER, UfoOutcome } from "shared/types/ufo";
import { GAME_PASSES, isGamePass } from "shared/types/gamepasses";
import { MAX_TEST_SPEED } from "../playerStats";
import { getLeaderboardDay, LEADERBOARD_IDS, LEADERBOARD_TITLE_RANKS } from "shared/types/leaderboards";

const RESET_COMMAND = "/datareset";
const CONFIRM_WORD = "confirm";
/** "/datareset confirm" must follow "/datareset" within this many seconds. */
const CONFIRM_WINDOW = 15;
const NEXT_FRENCH_COMMAND = "/nextfrench";
const INCUBATORS_COMMAND = "/incubators";
const PASS_COMMAND = "/pass";
const BOOST_COMMAND = "/boost";
const SPEED_COMMAND = "/speed";
const PASSES_COMMAND = "/passes";
const UFO_COMMAND = "/ufo";
const LB_TITLE_COMMAND = "/lbtitle";
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
 *  /pass <Pass>         gives or takes a gamepass (e.g. "/pass Coins"), for this session only: the next join
 *                       asks Roblox again
 *  /boost <minutes>     sets the player's quest coin boost to that many minutes (saved: "/boost 0" clears it)
 *  /speed <x>           the owner's test speed: coins, hatching and Ocean Points x it (1–10), saved, so it also
 *                       applies when the owner plays the published game ("/speed 1" puts it back); the profile is
 *                       then left out of the players' statistics
 *  /passes off|on       the owner plays without their gamepasses (saved, also on the published game) or with them again
 *  /ufo <Outcome>|off   the UFOs of the next UFO nights bring the owner's fish back with that outcome (Sleep, Green, Red,
 *                       Variant, Alien), for this session; "/ufo off" puts the odds back
 *  /lbtitle <Board> <rank>|off  holds that board's leaderboard title at that rank (1–10) to see its nameplate (Board:
 *                       OceanPoints, Income, PlayTime); the next join or day's snapshot puts the real ranks back
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

		const pass = new Instance("TextChatCommand");
		pass.Name = "DevPass";
		pass.PrimaryAlias = PASS_COMMAND;
		pass.Triggered.Connect((source, text) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onPass(player, text);
		});
		pass.Parent = TextChatService;

		const boost = new Instance("TextChatCommand");
		boost.Name = "DevBoost";
		boost.PrimaryAlias = BOOST_COMMAND;
		boost.Triggered.Connect((source, text) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onBoost(player, text);
		});
		boost.Parent = TextChatService;

		const speed = new Instance("TextChatCommand");
		speed.Name = "DevSpeed";
		speed.PrimaryAlias = SPEED_COMMAND;
		speed.Triggered.Connect((source, text) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onSpeed(player, text);
		});
		speed.Parent = TextChatService;

		const passes = new Instance("TextChatCommand");
		passes.Name = "DevPasses";
		passes.PrimaryAlias = PASSES_COMMAND;
		passes.Triggered.Connect((source, text) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onPasses(player, text);
		});
		passes.Parent = TextChatService;

		const ufo = new Instance("TextChatCommand");
		ufo.Name = "DevUfo";
		ufo.PrimaryAlias = UFO_COMMAND;
		ufo.Triggered.Connect((source, text) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onUfo(player, text);
		});
		ufo.Parent = TextChatService;

		const lbTitle = new Instance("TextChatCommand");
		lbTitle.Name = "DevLeaderboardTitle";
		lbTitle.PrimaryAlias = LB_TITLE_COMMAND;
		lbTitle.Triggered.Connect((source, text) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player) this.onLeaderboardTitle(player, text);
		});
		lbTitle.Parent = TextChatService;
		Players.PlayerRemoving.Connect((player) => this.resetAskedAt.delete(player));
	}

	public onStart() {
		if (RunService.IsStudio())
			print(
				`[Server] DevCommandService: ${RESET_COMMAND}, ${NEXT_FRENCH_COMMAND}, ${INCUBATORS_COMMAND}, ${PASS_COMMAND}, ${BOOST_COMMAND}, ${SPEED_COMMAND}, ${PASSES_COMMAND}, ${UFO_COMMAND}, ${LB_TITLE_COMMAND} available (Studio, place owner only).`,
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

	private onLeaderboardTitle(player: Player, text: string) {
		if (!this.isAllowed(player)) {
			warn(`[Server] ${player.Name} tried ${LB_TITLE_COMMAND}: refused (not the place's owner).`);
			return;
		}
		const data = DataService.getData(player);
		const words = text.split(" ");
		const board = LEADERBOARD_IDS.find((id) => id.lower() === words[1]?.lower());
		const rank = tonumber(words[2]);
		const off = words[2]?.lower() === "off";
		if (
			!data ||
			board === undefined ||
			(!off && (rank === undefined || rank < 1 || rank > LEADERBOARD_TITLE_RANKS))
		) {
			DataService.notify(
				player,
				`Usage: ${LB_TITLE_COMMAND} ${LEADERBOARD_IDS.join(" | ")} <1-10> | off`,
				"info",
			);
			return;
		}
		data.leaderboardRanks[board] = off ? undefined : math.floor(rank!);
		data.leaderboardRanksDay = getLeaderboardDay(Workspace.GetServerTimeNow());
		DataService.sync(player);
		DataService.notify(
			player,
			off ? `${board} title: off.` : `${board} title held at #${math.floor(rank!)}.`,
			"info",
		);
	}

	private onUfo(player: Player, text: string) {
		if (!this.isAllowed(player)) {
			warn(`[Server] ${player.Name} tried ${UFO_COMMAND}: refused (not the place's owner).`);
			return;
		}
		const word = text.split(" ")[1]?.lower();
		const outcome = UFO_OUTCOME_ORDER.find((candidate) => candidate.lower() === word);
		if (word === "off") {
			UfoService.forceOutcome(player, undefined);
			DataService.notify(player, "UFO outcomes: normal odds again.", "info");
		} else if (outcome !== undefined) {
			UfoService.forceOutcome(player, outcome as UfoOutcome);
			DataService.notify(player, `Your fish will come back from the UFOs: ${outcome}.`, "info");
		} else {
			DataService.notify(player, `Usage: ${UFO_COMMAND} ${UFO_OUTCOME_ORDER.join(" | ")} | off`, "info");
		}
	}

	private onPasses(player: Player, text: string) {
		if (!this.isAllowed(player)) {
			warn(`[Server] ${player.Name} tried ${PASSES_COMMAND}: refused (not the place's owner).`);
			return;
		}
		const word = text.split(" ")[1]?.lower();
		if (word !== "off" && word !== "on") {
			DataService.notify(player, `Usage: ${PASSES_COMMAND} off | on`, "info");
			return;
		}
		GamePassService.setTestNoPasses(player, word === "off");
		DataService.notify(
			player,
			word === "off"
				? `Playing without gamepasses. "${PASSES_COMMAND} on" to get them back.`
				: "Gamepasses back.",
			"info",
		);
	}

	private onSpeed(player: Player, text: string) {
		const stats = DataService.getSave(player)?.stats;
		if (!this.isAllowed(player) || !stats) {
			warn(`[Server] ${player.Name} tried ${SPEED_COMMAND}: refused (not the place's owner).`);
			return;
		}
		const speed = tonumber(text.split(" ")[1]);
		if (speed === undefined) return;
		stats.testSpeed = math.clamp(math.floor(speed), 1, MAX_TEST_SPEED);
		if (stats.testSpeed > 1) stats.testSpeedUsed = true;
		player.SetAttribute("TestSpeed", stats.testSpeed > 1 ? stats.testSpeed : undefined);
		DataService.notify(
			player,
			stats.testSpeed > 1
				? `Test speed x${stats.testSpeed}: coins, hatching and Ocean Points. "${SPEED_COMMAND} 1" to stop.`
				: "Test speed off.",
			"info",
		);
	}

	private onBoost(player: Player, text: string) {
		const data = DataService.getData(player);
		if (!this.isAllowed(player) || !data) {
			warn(`[Server] ${player.Name} tried ${BOOST_COMMAND}: refused (not the place's owner).`);
			return;
		}
		const minutes = tonumber(text.split(" ")[1]);
		if (minutes === undefined) return;
		data.coinBoostSeconds = math.max(minutes, 0) * 60;
		DataService.sync(player);
		DataService.notify(player, `Quest coin boost: ${math.max(minutes, 0)} min.`, "info");
	}

	private onPass(player: Player, text: string) {
		if (!this.isAllowed(player)) {
			warn(`[Server] ${player.Name} tried ${PASS_COMMAND}: refused (not the place's owner).`);
			return;
		}
		const pass = text.split(" ")[1];
		if (!isGamePass(pass)) {
			const names = new Array<string>();
			for (const [name] of pairs(GAME_PASSES)) names.push(name);
			DataService.notify(player, `Usage: ${PASS_COMMAND} <${names.join(" | ")}>`, "info");
			return;
		}
		const owned = !GamePassService.owns(player, pass);
		GamePassService.setTestPass(player, pass, owned);
		DataService.notify(player, `${GAME_PASSES[pass].displayName}: ${owned ? "on" : "off"} (this session).`, "info");
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
