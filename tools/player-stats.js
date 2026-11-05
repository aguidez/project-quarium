// Real players' statistics (ROADMAP M7 calibration): reads every player profile of the live DataStore through Roblox
// Open Cloud, and prints what the balance simulator predicts next to what the players really do: play time at each
// milestone (median / p10 / p90), days, sessions, share of the coins picked up, daily quests, devices and frame rate.
// The profiles' `stats` are written by the game (src/server/services/StatsService.ts, src/server/playerStats.ts).
//
// Usage: node tools/player-stats.js                 (needs robloxOpenCloudKey in workspace.local.json, see SETUP.md)
//        node tools/player-stats.js --file dump.json (a JSON array of profiles, for tests without the API)
//        options: --out snapshot.json (saves the fetched profiles), --store PlayerData_v1, --limit n
const fs = require("fs");
const config = require("./local-config");

const UNIVERSE_ID = config.get("robloxUniverseId", "10774507209"); // Project: Quarium's experience (game.GameId)
const args = process.argv.slice(2);
const flag = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const STORE = flag("--store") || "PlayerData_v1"; // DataService STORE_NAME
const LIMIT = Number(flag("--limit") || Infinity);

// What the simulator predicts for the reference player (BALANCE.md §2, V0.60.6: 1 h a day with the dailies, free food), in minutes of
// play in front of the tank. Keep in line with BALANCE.md when the balance changes.
const REFERENCE = {
	Rebirth1: 19,
	Rebirth2: 84,
	Rebirth3: 160,
	Rebirth4: 259,
	Rebirth5: 344,
	Rebirth6: 477,
	Rebirth7: 590,
	Rebirth8: 656,
	"Species:FlameGourami": 46,
	"Species:ImperialDiscus": 124,
	"Species:Catfish": 214,
	"Species:BabySunfish": 316,
	"Species:Lanternfish": 404,
	"Species:Dragonfish": 544,
	"Species:WolfDogfish": 675,
	"Species:BunnyShark": 722,
	"Species:MiniLeviathan": 736,
	AllSpecies: 738,
};
// Rebirths a player needs before their daily / weekly boards open (src/shared/types/quests.ts BOARD_UNLOCK_REBIRTHS)
const BOARD_UNLOCK_REBIRTHS = { Daily: 2, Weekly: 3 };
const REFERENCE_PICKUP = 0.5; // the simulator's P.collect: share of the coins' value picked up (clicks + companions)
const MILESTONE_ORDER = [
	"Onboarding:Done",
	...Object.keys(REFERENCE).filter((k) => k.startsWith("Rebirth")),
	...Object.keys(REFERENCE).filter((k) => k.startsWith("Species:")),
	"AllSpecies",
];

// ---------------------------------------------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------------------------------------------

async function request(url, apiKey) {
	for (let attempt = 0; attempt < 6; attempt++) {
		const res = await fetch(url, { headers: { "x-api-key": apiKey } });
		if (res.status === 429 || res.status >= 500) {
			await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); // rate limited / outage: back off
			continue;
		}
		if (res.status === 404 && url.includes("/data-stores/")) {
			// The store is created by the first save: nobody has played the published game of this universe yet
			throw new Error(
				`No save yet: the data store ${STORE} doesn't exist in universe ${UNIVERSE_ID} (no player saved there).`,
			);
		}
		if (res.status === 403)
			throw new Error(
				`403 on ${url}: the key lacks the Data Stores scope (List entry keys, Read entry) for universe ${UNIVERSE_ID}, see SETUP.md.`,
			);
		if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}: ${await res.text()}`);
		return res.json();
	}
	throw new Error(`gave up on ${url} (rate limited)`);
}

async function fetchProfiles(apiKey) {
	const base = `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/data-stores/${encodeURIComponent(STORE)}/entries`;
	const ids = [];
	let pageToken = "";
	do {
		const page = await request(
			`${base}?maxPageSize=256${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
			apiKey,
		);
		// Listed as "<scope>/<key>" ("global/Player_123"); the entry is read by its key (default scope)
		for (const entry of page.dataStoreEntries || []) ids.push(entry.id.split("/").pop());
		pageToken = page.nextPageToken || "";
	} while (pageToken && ids.length < LIMIT);
	const keys = ids.filter((id) => id.startsWith("Player_")).slice(0, LIMIT);
	console.error(`${keys.length} player profiles in ${STORE}, fetching...`);
	const profiles = [];
	for (let i = 0; i < keys.length; i += 5) {
		const batch = await Promise.all(
			keys.slice(i, i + 5).map((key) => request(`${base}/${encodeURIComponent(key)}`, apiKey)),
		);
		for (const entry of batch) {
			const value = typeof entry.value === "string" ? JSON.parse(entry.value) : entry.value;
			profiles.push(value);
		}
	}
	return profiles;
}

// ---------------------------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------------------------

function pct(values, p) {
	const s = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v)).sort((a, b) => a - b);
	if (s.length === 0) return null;
	return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}
const hm = (minutes) =>
	minutes === null
		? "—"
		: minutes >= 90
			? `${Math.floor(minutes / 60)}h${String(Math.round(minutes % 60)).padStart(2, "0")}`
			: `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
const percent = (x) => (x === null ? "—" : `${Math.round(x * 100)} %`);

function report(profiles) {
	// A profile is { Data: { player, tank, stats }, MetaData } (ProfileStore); a dump may hold the Data alone
	const saves = profiles.map((p) => (p && p.Data ? p.Data : p)).filter((d) => d && d.player);
	// The owner's test runs ("/speed") and the staff's profiles (StatsService: isAdmin) would skew everything: left out
	const testers = saves.filter((d) => d.stats && d.stats.testSpeedUsed);
	const staff = saves.filter((d) => d.stats && d.stats.staff && !d.stats.testSpeedUsed);
	const tracked = saves.filter(
		(d) => d.stats && d.stats.firstJoinAt > 0 && !d.stats.testSpeedUsed && !d.stats.staff,
	);
	const fresh = tracked.filter((d) => !d.stats.legacy);
	console.log(
		`Players: ${saves.length} profiles, ${tracked.length} with statistics (${fresh.length} new since V0.47)` +
			(testers.length ? `, ${testers.length} left out (test speed)` : "") +
			(staff.length ? `, ${staff.length} left out (staff)` : ""),
	);
	if (tracked.length === 0) return;
	const stats = tracked.map((d) => d.stats);

	// Time and attendance
	const days = stats.map((s) => s.days);
	const perDay = stats.filter((s) => s.days > 0).map((s) => s.tendingSeconds / 60 / s.days);
	const inGamePerDay = stats.filter((s) => s.days > 0).map((s) => s.playSeconds / 60 / s.days);
	const sessions = stats.map((s) => s.sessions);
	const producing = stats.filter((s) => s.playSeconds > 60).map((s) => s.tendingSeconds / s.playSeconds);
	console.log("\nAttendance (median, p10–p90)");
	console.log(`  days played      ${pct(days, 0.5)} (${pct(days, 0.1)}–${pct(days, 0.9)})`);
	console.log(`  sessions         ${pct(sessions, 0.5)} (${pct(sessions, 0.1)}–${pct(sessions, 0.9)})`);
	console.log(
		`  producing a day  ${hm(pct(perDay, 0.5))} (${hm(pct(perDay, 0.1))}–${hm(pct(perDay, 0.9))})   reference: 1h00`,
	);
	console.log(
		`  in game a day    ${hm(pct(inGamePerDay, 0.5))}   share of it producing: ${percent(pct(producing, 0.5))}`,
	);
	for (const d of [2, 3, 7, 14]) {
		console.log(
			`  came back on ${String(d).padStart(2)} days or more: ${percent(days.filter((x) => x >= d).length / days.length)}`,
		);
	}

	// Milestones (new players only: the legacy ones have no time for what they reached before the stats)
	console.log(
		"\nMilestones (new players; play time producing, the tutorial in game time; median p10–p90, vs the simulator)",
	);
	console.log("  milestone                  reached   median    p10–p90            days   simulator");
	for (const id of MILESTONE_ORDER) {
		const times = fresh.map((d) => d.stats.milestones && d.stats.milestones[id]).filter((m) => m && m.tending >= 0);
		// The tutorial happens before the production time starts counting: its time in the game instead
		const minutes = times.map((m) => (id.startsWith("Onboarding") ? m.play : m.tending) / 60);
		const reached = fresh.length ? times.length / fresh.length : 0;
		const ref = REFERENCE[id];
		const med = pct(minutes, 0.5);
		const gap =
			ref && med !== null
				? `${ref ? hm(ref) : ""} (${med >= ref ? "+" : ""}${Math.round(((med - ref) / ref) * 100)} %)`
				: ref
					? hm(ref)
					: "";
		console.log(
			`  ${id.padEnd(26)} ${percent(reached).padStart(6)}   ${hm(med).padEnd(8)}  ${`${hm(pct(minutes, 0.1))}–${hm(pct(minutes, 0.9))}`.padEnd(17)}  ${String(
				pct(
					times.map((m) => m.days),
					0.5,
				) ?? "—",
			).padStart(4)}   ${gap}`,
		);
	}

	// Coins: the simulator's main assumption
	const enough = stats.filter((s) => s.coinsDropped >= 50);
	const pickup = enough.map((s) => (s.coinValueClicked + s.coinValueByCompanion) / s.coinValueDropped);
	const pickupCount = enough.map((s) => (s.coinsClicked + s.coinsByCompanion) / s.coinsDropped);
	const byCompanion = enough.map((s) => s.coinsByCompanion / Math.max(1, s.coinsClicked + s.coinsByCompanion));
	console.log(`\nCoins (${enough.length} players with 50+ coins dropped)`);
	console.log(
		`  value picked up    ${percent(pct(pickup, 0.5))} (${percent(pct(pickup, 0.1))}–${percent(pct(pickup, 0.9))})   simulator: ${percent(REFERENCE_PICKUP)}`,
	);
	console.log(
		`  coins picked up    ${percent(pct(pickupCount, 0.5))}   by a companion: ${percent(pct(byCompanion, 0.5))}`,
	);
	console.log(
		`  meals by hand      ${pct(
			stats.map((s) => s.mealsByHand),
			0.5,
		)} per player (median)`,
	);

	// Quests and boosts
	// The boards only open after a few rebirths: counted over the players who have them, from the day they opened
	const withBoard = (category) => tracked.filter((d) => d.player.rebirths >= BOARD_UNLOCK_REBIRTHS[category]);
	const daysWithBoard = (d, category) => {
		const opened = d.stats.milestones && d.stats.milestones[`Rebirth${BOARD_UNLOCK_REBIRTHS[category]}`];
		return opened && opened.days > 0 ? d.stats.days - opened.days + 1 : d.stats.days;
	};
	const daily = withBoard("Daily").filter((d) => daysWithBoard(d, "Daily") > 0);
	const weekly = withBoard("Weekly");
	const dailiesPerDay = daily.map((d) => d.stats.questsClaimed.Daily / daysWithBoard(d, "Daily"));
	const median = (values) => pct(values, 0.5) ?? "—";
	console.log("\nQuests");
	console.log(
		`  dailies a day      ${pct(dailiesPerDay, 0.5)?.toFixed(1) ?? "—"} of 3 (simulator: 3)   ` +
			`${daily.length} players with the board (rebirth ${BOARD_UNLOCK_REBIRTHS.Daily}+)`,
	);
	console.log(
		`  weeklies           ${median(weekly.map((d) => d.stats.questsClaimed.Weekly))} per player   ` +
			`${weekly.length} players with the board (rebirth ${BOARD_UNLOCK_REBIRTHS.Weekly}+)`,
	);
	console.log(`  story              ${median(stats.map((s) => s.questsClaimed.Story))} per player`);
	console.log(
		`  boost earned       ${hm(pct(daily.map((d) => d.stats.boostMinutesEarned), 0.5))} per player with the daily board, ` +
			`likes given ${median(stats.map((s) => s.likesGiven))}`,
	);

	// Devices
	console.log("\nDevices (sessions; frame rate and memory over all their samples)");
	const platforms = {};
	for (const s of stats) {
		for (const [platform, n] of Object.entries(s.platforms || {}))
			platforms[platform] = (platforms[platform] || 0) + n;
	}
	for (const [platform, n] of Object.entries(platforms)) {
		const devices = stats.map((s) => s.devices && s.devices[platform]).filter((d) => d && d.samples > 0);
		const samples = devices.reduce((a, d) => a + d.samples, 0);
		const fps = devices.reduce((a, d) => a + d.fpsSum, 0) / Math.max(1, samples);
		const low = devices.reduce((a, d) => a + d.lowFps, 0) / Math.max(1, samples);
		const memory = pct(
			devices.map((d) => d.memoryMaxMb),
			0.5,
		);
		const budgets = devices.map((d) => d.swimBudgetMin).filter((b) => b > 0);
		console.log(
			`  ${platform.padEnd(9)} ${n} sessions, ${Math.round(fps)} fps on average, ${percent(low)} of the minutes under 30 fps, ` +
				`memory ${memory === null ? "—" : Math.round(memory) + " MB"} (median of the peaks)` +
				(budgets.length
					? `, swim budget lowered on ${budgets.length} players (median ${pct(budgets, 0.5)} triangles)`
					: ""),
		);
	}
}

(async () => {
	let profiles;
	const file = flag("--file");
	if (file) profiles = JSON.parse(fs.readFileSync(file, "utf8"));
	else {
		const apiKey = config.get("robloxOpenCloudKey");
		if (!apiKey) {
			console.error(
				"No Open Cloud key: set robloxOpenCloudKey in workspace.local.json (see SETUP.md), or use --file.",
			);
			process.exit(1);
		}
		profiles = await fetchProfiles(apiKey);
	}
	const out = flag("--out");
	if (out) fs.writeFileSync(out, JSON.stringify(profiles));
	report(profiles);
})().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
