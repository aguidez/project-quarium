// Economy simulator for Project: Quarium (Monte Carlo over many "average players", BALANCE.md).
// The numbers it plays are in tools/sim/config.js (the mirror of the live config: keep it in sync), the player model in
// tools/sim/player.js, the report in tools/sim/report.js.
// The timeline is played in segments of 3 rebirths (start → 3, 3 → 6, 6 → 9, 9 → the end), each saved in
// tools/.sim-cache/ (git-ignored): a run only replays the segments whose numbers changed (tools/sim/segments.js),
// on all the machine's cores, with a progress line. Every player draws from its own seeded generator, so the same
// config always gives the same report.
// Usage: node tools/economy-sim.js [options] ['{"P":{"collect":0.6}}']
//   (npm run sim -- [options])
//   (nothing)        the whole timeline: replays what changed, then the full report (the reference for BALANCE.md)
//   --segment <k>    one segment only, from the saved end of segment k - 1, and its part of the report
//   --status         lists the segments and whether each one is saved and up to date
//   --fresh          replays everything, ignoring the saved segments
//   --no-cache       plays the whole timeline in one go, without reading or writing the cache
//   --players <n>    players (default 2,000; e.g. 200 for a first look, saved separately)
//   --seed <n>       another sample of players (default 1)
//   --workers <n>    threads (default: the cores - 1; 1 = no thread)
//   --plan <file>    plays a planned economy (a module exporting FISH, EGGS, REBIRTHS, CAPACITY, OCEAN_MILESTONES,
//                    INCUBATORS, HATCH, QUEST_REWARDS, SIDE_QUESTS, VARIANTS, P) instead of the live config: write one
//                    to preview a future update (the V1 and V1.2 ones were removed once in the game)
//   e.g. no rebirth: node tools/economy-sim.js '{"P":{"rebirths":0}}'
//   gamepass x2 coins (an estimate, never a target): '{"P":{"coinBoost":2}}', x2 Ocean Points: oceanBoost
const { buildConfig } = require("./sim/config");
const { playAll, defaultWorkers } = require("./sim/pool");
const { report } = require("./sim/report");
const seg = require("./sim/segments");

const args = process.argv.slice(2);
const flag = (name) => {
	const i = args.indexOf(name);
	if (i < 0) return undefined;
	const value = args[i + 1];
	args.splice(i, 2);
	return value;
};
const has = (name) => {
	const i = args.indexOf(name);
	if (i >= 0) args.splice(i, 1);
	return i >= 0;
};
const planPath = flag("--plan");
const players = flag("--players");
const seed = flag("--seed");
const workersArg = flag("--workers");
const workers = workersArg !== undefined ? Number(workersArg) : defaultWorkers();
const segmentArg = flag("--segment");
const status = has("--status");
const fresh = has("--fresh");
const noCache = has("--no-cache");
const overrides = JSON.parse(args[0] || "{}");

const cfgArgs = { planPath, overrides, players, seed };
const cfg = buildConfig(cfgArgs);
const segs = seg.segmentsOf(cfg);
const run = seg.runKey({ planPath, overrides, cfg });
const header = () => {
	if (planPath) console.log(`plan: ${cfg.planName}, ${cfg.P.players} players`);
};
const fail = (text) => {
	console.error(text);
	process.exit(1);
};

async function playSegment(s, states, chain) {
	const res = await playAll({ cfgArgs, states, stopAt: s.to, workers, label: seg.segName(s) });
	return { states: res.states, chain: seg.saveSegment(cfg, run, s, res.states, chain), seconds: res.seconds };
}

async function main() {
	const blank = () => new Array(cfg.P.players).fill(null);
	if (status) {
		console.log(`${run.label} (${cfg.P.players} players, seed ${cfg.P.seed}), cache ${seg.CACHE_DIR}`);
		for (const s of segs) {
			const c = seg.loadSegment(cfg, run, segs, s);
			console.log(`  ${seg.segName(s)}: ${c.ok ? "up to date (" + c.savedAt + ")" : c.why}`);
		}
		return;
	}
	if (noCache) {
		const res = await playAll({ cfgArgs, states: blank(), stopAt: null, workers, label: "full run" });
		header();
		report(cfg, res.states);
		return;
	}
	if (segmentArg !== undefined) {
		const k = Number(segmentArg);
		const s = segs[k - 1];
		if (!s) fail(`--segment: 1 to ${segs.length} (${segs.map(seg.segName).join(", ")})`);
		let start = blank();
		let chain = [];
		if (k > 1) {
			const prev = seg.loadSegment(cfg, run, segs, segs[k - 2]);
			if (!prev.ok) {
				const first = segs.find((x) => !seg.loadSegment(cfg, run, segs, x).ok);
				fail(
					`${seg.segName(segs[k - 2])} is not ready (${prev.why}): play it first, ` +
						`npm run sim -- --segment ${first.index}${players ? " --players " + players : ""} (or npm run sim)`,
				);
			}
			start = prev.states;
			chain = seg.chainOf(run, segs[k - 2]);
		}
		const cached = fresh ? { ok: false } : seg.loadSegment(cfg, run, segs, s);
		let states;
		if (cached.ok) {
			console.error(`${seg.segName(s)}: up to date (saved ${cached.savedAt})`);
			states = cached.states;
		} else states = (await playSegment(s, start, chain)).states;
		header();
		console.log(`${seg.segName(s)}${s.to === null ? "" : " (the steps reached so far)"}:`);
		report(cfg, states, { partial: s.to !== null });
		return;
	}
	let states = blank();
	let chain = [];
	let replaying = fresh;
	const times = [];
	for (const s of segs) {
		const cached = replaying ? { ok: false } : seg.loadSegment(cfg, run, segs, s);
		if (cached.ok) {
			console.error(`${seg.segName(s)}: up to date`);
			states = cached.states;
			chain = seg.chainOf(run, s);
			continue;
		}
		if (!replaying && !fresh) console.error(`${seg.segName(s)}: ${cached.why}, replaying from here`);
		replaying = true;
		const res = await playSegment(s, states, chain);
		states = res.states;
		chain = res.chain;
		times.push(res.seconds);
	}
	if (times.length) console.error(`played in ${times.reduce((a, b) => a + b, 0).toFixed(0)} s on ${workers} thread(s)`);
	header();
	report(cfg, states);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
