import { HttpService, MemoryStoreService, MessagingService, Players, RunService, TeleportService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { AdminServerInfo, AdminServersSync } from "shared/types/admin";
import { GAME_VERSION } from "shared/version";
import { DataService } from "./DataService";

/** Every live server lists itself here (key: its JobId), refreshed while it runs, so the admin panel sees them all. */
const REGISTRY = "QuariumServers";
const REGISTER_INTERVAL = 30; // seconds between two refreshes of this server's entry
const REGISTER_TTL = 90; // an entry not refreshed for this long is gone (a closed server)
const REGISTRY_READ_SIZE = 200;
/** MessagingService topic of the admin panel's "update the old servers" (payload: the newest place version). */
const UPDATE_TOPIC = "QuariumUpdate";
/**
 * MessagingService topic of the admin panel's "close the old servers" (payload: the newest place version). Its own topic:
 * a server on older code than this ignores it (the "update" message's shape must never change, old servers read it).
 */
const CLOSE_TOPIC = "QuariumClose";
const CLOSE_NOTICE_DELAY = 3; // seconds after the close before its players are told (the message lands first)
/** A player sent on this many times by closed servers stays where they land (never a loop of teleports). */
const MAX_UPDATE_HOPS = 2;
const MOVE_NOTICE = 5; // seconds between the notice and the move
/** Seconds the relay server keeps the players before sending them on: the old servers empty and close meanwhile. */
const RELAY_HOLD = 6;
const TELEPORT_TRIES = 3;
const TELEPORT_RETRY_DELAY = 4;

const isUpdateMessage = t.strictInterface({ version: t.integer });
const isEntry = t.interface({ version: t.integer, gameVersion: t.string, players: t.integer, closed: t.optional(t.boolean) });
const isHopData = t.interface({ updateHops: t.integer });

/** How many times a closed server already sent this player on (their teleport data), 0 for a normal join. */
function getUpdateHops(player: Player): number {
	const [ok, data] = pcall(() => player.GetJoinData().TeleportData);
	return ok && isHopData(data) ? data.updateHops : 0;
}

/**
 * A reserved server of this place (no private-server owner): the relay of an update, see ServerUpdateService. Only the
 * update creates them. main.server.ts runs nothing else there.
 */
export function isUpdateRelayServer(): boolean {
	return game.PrivateServerId !== "" && game.PrivateServerOwnerId === 0;
}

/**
 * Moves the players of servers on an old version of the place to the newest one (the admin panel's Servers tab).
 * Each live server lists itself in a MemoryStore sorted map (REGISTRY: its place version, GAME_VERSION and players).
 * "Update the old servers" sends the newest version listed over MessagingService; every server below it tells its
 * players, then teleports them all to a reserved server (a new server always runs the newest published version),
 * which sends them on to a public server a few seconds later. An old server keeps moving whoever joins it until it is
 * empty and closes. Teleports don't work in Studio: there, the move only says so.
 * "Close the old servers" is the soft way (V1.2.6, only on servers running that code or newer: CLOSE_TOPIC): an old
 * server keeps its players, tells them once that a new version is out, and sends every newcomer on through the relay;
 * it closes by itself once empty. The relay sends a group to a server of the newest version with room (the registry)
 * rather than to any public one, which could be an old server again; a player sent on MAX_UPDATE_HOPS times stays.
 */
class ServerUpdateServiceSingleton implements Lifecycle {
	private relay = isUpdateRelayServer();
	private key = game.JobId !== "" ? game.JobId : `Studio-${HttpService.GenerateGUID(false)}`;
	private moving = false;
	private closed = false;

	public onInit() {
		if (this.relay) {
			this.runRelay();
			return;
		}
		Players.PlayerAdded.Connect((player) => {
			// Matchmaking may still send someone to a server that is moving its players: they move too
			if (this.moving) task.spawn(() => this.moveToRelay([player]));
			// A closed server takes no one new: on to the newest version (unless they already hopped enough)
			else if (this.closed) {
				const hops = getUpdateHops(player);
				if (hops < MAX_UPDATE_HOPS) task.spawn(() => this.moveToRelay([player], hops + 1));
			}
		});
	}

	public onStart() {
		print(`[Server] ServerUpdateService started (place version ${game.PlaceVersion}${this.relay ? ", update relay" : ""}).`);
		if (this.relay) return;
		const [ok, problem] = pcall(() =>
			MessagingService.SubscribeAsync(UPDATE_TOPIC, (packet) => {
				const message = (packet as { Data: unknown }).Data;
				if (isUpdateMessage(message)) this.onUpdate(message.version);
			}),
		);
		if (!ok) warn(`[Server] Server updates: no MessagingService (${problem}).`);
		const [closeOk, closeProblem] = pcall(() =>
			MessagingService.SubscribeAsync(CLOSE_TOPIC, (packet) => {
				const message = (packet as { Data: unknown }).Data;
				if (isUpdateMessage(message)) this.onClose(message.version);
			}),
		);
		if (!closeOk) warn(`[Server] Server updates: no close topic (${closeProblem}).`);
		game.BindToClose(() => this.unregister());
		while (true) {
			if (!this.moving) this.register();
			task.wait(REGISTER_INTERVAL);
		}
	}

	/** The live servers as listed (this one always included, with its live count), for the admin panel. */
	public getServers(): AdminServersSync {
		const servers = new Array<AdminServerInfo>();
		const [ok, items] = pcall(() =>
			MemoryStoreService.GetSortedMap(REGISTRY).GetRangeAsync(Enum.SortDirection.Ascending, REGISTRY_READ_SIZE),
		);
		if (ok) {
			for (const item of items as ReadonlyArray<{ key: string; value: unknown }>) {
				if (item.key === this.key || !isEntry(item.value)) continue;
				const entry = item.value;
				servers.push({
					version: entry.version,
					gameVersion: entry.gameVersion,
					players: entry.players,
					closed: entry.closed === true,
					jobId: item.key,
					thisServer: false,
				});
			}
		}
		servers.push({
			jobId: this.key,
			version: game.PlaceVersion,
			gameVersion: GAME_VERSION,
			players: Players.GetPlayers().size(),
			closed: this.closed,
			thisServer: true,
		});
		let latest = 0;
		for (const server of servers) latest = math.max(latest, server.version);
		servers.sort((a, b) => (a.version !== b.version ? a.version > b.version : a.players > b.players));
		return { servers, latest, listed: ok, studio: RunService.IsStudio() };
	}

	/**
	 * The admin panel's button: every server below the newest listed version moves its players (this one too, when it
	 * is old). Returns the servers and players that will move.
	 */
	public updateOldServers(): { servers: number; players: number; latest: number } {
		const { servers, latest } = this.getServers();
		let oldServers = 0;
		let players = 0;
		for (const server of servers) {
			if (server.version >= latest) continue;
			oldServers += 1;
			players += server.players;
		}
		if (oldServers > 0) {
			task.spawn(() => {
				const [published] = pcall(() => MessagingService.PublishAsync(UPDATE_TOPIC, { version: latest }));
				if (!published) warn("[Server] Server updates: couldn't reach the other servers.");
			});
			this.onUpdate(latest); // MessagingService doesn't run in Studio; and this server may be an old one
		}
		return { servers: oldServers, players, latest };
	}

	/**
	 * The admin panel's soft button: every server below the newest listed version closes (keeps its players, sends the
	 * newcomers on). Returns the servers and players concerned (the old ones not closed yet).
	 */
	public closeOldServers(): { servers: number; players: number; latest: number } {
		const { servers, latest } = this.getServers();
		let oldServers = 0;
		let players = 0;
		for (const server of servers) {
			if (server.version >= latest || server.closed) continue;
			oldServers += 1;
			players += server.players;
		}
		if (oldServers > 0) {
			task.spawn(() => {
				const [published] = pcall(() => MessagingService.PublishAsync(CLOSE_TOPIC, { version: latest }));
				if (!published) warn("[Server] Server updates: couldn't reach the other servers.");
			});
			this.onClose(latest);
		}
		return { servers: oldServers, players, latest };
	}

	private register() {
		const entry = {
			version: game.PlaceVersion,
			gameVersion: GAME_VERSION,
			players: Players.GetPlayers().size(),
			closed: this.closed,
		};
		pcall(() => MemoryStoreService.GetSortedMap(REGISTRY).SetAsync(this.key, entry, REGISTER_TTL));
	}

	private unregister() {
		pcall(() => MemoryStoreService.GetSortedMap(REGISTRY).RemoveAsync(this.key));
	}

	/** A newer version is out (`version`): an older server moves its players, once. */
	private onUpdate(version: number) {
		if (this.moving || game.PlaceVersion >= version) return;
		this.moving = true;
		this.unregister();
		print(`[Server] Place version ${game.PlaceVersion} < ${version}: moving the players to the new version.`);
		for (const player of Players.GetPlayers())
			DataService.notify(player, "A new version of the game is out: taking you there...", "info");
		task.delay(MOVE_NOTICE, () => this.moveToRelay(Players.GetPlayers()));
	}

	/** A newer version is out (`version`): an older server closes to newcomers, once, and tells its players. */
	private onClose(version: number) {
		if (this.closed || this.moving || game.PlaceVersion >= version) return;
		this.closed = true;
		this.register(); // the panel sees it CLOSED at once
		print(`[Server] Place version ${game.PlaceVersion} < ${version}: closed to newcomers, open for its players.`);
		task.delay(CLOSE_NOTICE_DELAY, () => {
			for (const player of Players.GetPlayers())
				DataService.notify(player, "A new version of the game is out! Join again whenever you like to play it.", "info");
		});
	}

	/**
	 * Teleports the players to a new reserved server (the relay), retried a few times. `hops`: how many times a closed
	 * server sent them on (their teleport data, carried by the relay).
	 */
	private moveToRelay(players: Player[], hops = 1) {
		if (players.size() === 0) return;
		if (RunService.IsStudio()) {
			for (const player of players)
				DataService.notify(player, "Studio can't teleport: a live server would move you now.", "warning");
			this.moving = false;
			return;
		}
		for (let attempt = 1; attempt <= TELEPORT_TRIES; attempt++) {
			const present = players.filter((player) => player.IsDescendantOf(Players));
			if (present.size() === 0) return;
			const [ok, problem] = pcall(() => {
				const code = TeleportService.ReserveServerAsync(game.PlaceId) as unknown as string;
				const options = new Instance("TeleportOptions");
				options.ReservedServerAccessCode = code;
				options.SetTeleportData({ updateHops: hops });
				TeleportService.TeleportAsync(game.PlaceId, present, options);
			});
			if (ok) return;
			warn(`[Server] Server updates: teleport to the relay failed (${problem}), try ${attempt}/${TELEPORT_TRIES}.`);
			task.wait(TELEPORT_RETRY_DELAY);
		}
	}

	/**
	 * A live server of the newest version (the relay's own: a new server runs the newest) with room for `count` more
	 * players, the fullest first (players together); undefined when the registry lists none.
	 */
	private findNewestServer(count: number): string | undefined {
		const [ok, items] = pcall(() =>
			MemoryStoreService.GetSortedMap(REGISTRY).GetRangeAsync(Enum.SortDirection.Ascending, REGISTRY_READ_SIZE),
		);
		if (!ok) return undefined;
		let best: string | undefined;
		let bestPlayers = -1;
		for (const item of items as ReadonlyArray<{ key: string; value: unknown }>) {
			const entry = item.value;
			if (!isEntry(entry) || entry.closed === true || entry.version < game.PlaceVersion) continue;
			if (entry.players + count > Players.MaxPlayers || entry.players <= bestPlayers) continue;
			best = item.key;
			bestPlayers = entry.players;
		}
		return best;
	}

	/**
	 * The relay server: holds whoever arrives for RELAY_HOLD seconds, then sends them to a server of the newest version
	 * with room (else to a public server), with their hop count.
	 */
	private runRelay() {
		const waiting = new Array<Player>();
		const sendOn = () => {
			const group = waiting.filter((player) => player.IsDescendantOf(Players));
			waiting.clear();
			let hops = 0;
			for (const player of group) hops = math.max(hops, getUpdateHops(player));
			for (let attempt = 1; attempt <= TELEPORT_TRIES && group.size() > 0; attempt++) {
				const [ok, problem] = pcall(() => {
					const options = new Instance("TeleportOptions");
					options.SetTeleportData({ updateHops: hops });
					const target = this.findNewestServer(group.size());
					if (target !== undefined) options.ServerInstanceId = target;
					TeleportService.TeleportAsync(game.PlaceId, group, options);
				});
				if (ok) return;
				warn(`[Server] Update relay: teleport failed (${problem}), try ${attempt}/${TELEPORT_TRIES}.`);
				task.wait(TELEPORT_RETRY_DELAY);
			}
			// Nothing to play here (no game runs on the relay): better a clear message than a loading screen forever
			for (const player of group)
				if (player.IsDescendantOf(Players)) player.Kick("The game was updated: join again to play the new version.");
		};
		Players.PlayerAdded.Connect((player) => {
			waiting.push(player);
			if (waiting.size() === 1) task.delay(RELAY_HOLD, sendOn);
		});
	}
}

export const ServerUpdateService = new ServerUpdateServiceSingleton();
