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

const UNIVERSE_ID = config.get("robloxUniverseId", "10773319506"); // Project: Quarium's experience (game.GameId)
const args = process.argv.slice(2);
const flag = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const STORE = flag("--store") || "PlayerData_v1"; // DataService STORE_NAME
const LIMIT = Number(flag("--limit") || Infinity);

// What the simulator predicts for the reference player (BALANCE.md §2, V0.48: 1 h a day with the dailies), in minutes of
// play in front of the tank. Keep in line with BALANCE.md when the balance changes.
const REFERENCE = {
	Rebirth1: 25,
	Rebirth2: 92,
	Rebirth3: 167,
	Rebirth4: 264,
	Rebirth5: 354,
	Rebirth6: 487,
	Rebirth7: 603,
	Rebirth8: 665,
	"Species:FlameGourami": 54,
	"Species:ImperialDiscus": 135,
	"Species:Catfish": 219,
	"Species:BabySunfish": 324,
	"Species:Lanternfish": 410,
	"Species:Dragonfish": 557,
	"Species:WolfDogfish": 679,
	"Species:BunnyShark": 733,
	"Species:MiniLeviathan": 748,
	AllSpecies: 751,
};
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
		const page = await request(`${base}?maxPageSize=256${pageToken ? `&pageToken=${pageToken}` : ""}`, apiKey);
		for (const entry of page.dataStoreEntries || []) ids.push(entry.id);
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
	// The owner's test runs ("/speed") would skew everything: left out
	const testers = saves.filter((d) => d.stats && d.stats.testSpeedUsed);
	const tracked = saves.filter((d) => d.stats && d.stats.firstJoinAt > 0 && !d.stats.testSpeedUsed);
	const fresh = tracked.filter((d) => !d.stats.legacy);
	console.log(
		`Players: ${saves.length} profiles, ${tracked.length} with statistics (${fresh.length} new since V0.47)` +
			(testers.length ? `, ${testers.length} left out (test speed)` : ""),
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
	const dailiesPerDay = stats.filter((s) => s.days > 0).map((s) => s.questsClaimed.Daily / s.days);
	console.log("\nQuests");
	console.log(`  dailies a day      ${pct(dailiesPerDay, 0.5)?.toFixed(1) ?? "—"} of 3 (simulator: 3)`);
	console.log(
		`  weeklies           ${pct(
			stats.map((s) => s.questsClaimed.Weekly),
			0.5,
		)} per player, story ${pct(
			stats.map((s) => s.questsClaimed.Story),
			0.5,
		)}`,
	);
	console.log(
		`  boost earned       ${hm(
			pct(
				stats.map((s) => s.boostMinutesEarned),
				0.5,
			),
		)} per player, likes given ${pct(
			stats.map((s) => s.likesGiven),
			0.5,
		)}`,
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
