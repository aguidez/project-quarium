// Segments of the run: the timeline is played in slices of 3 rebirths (start → rebirth 3, 3 → 6, 6 → 9, 9 → the end),
// each one saved as a snapshot of every player right after its last rebirth (tools/.sim-cache/, git-ignored).
// A slice is played again only when something it used changed. What a slice used is tracked while it plays (the
// eggs the players unlocked, the Ocean Points they reached): a slice's fingerprint covers only that part of the config
// (the eggs, species, rebirths and milestones below that point, the player model, the simulator's code), so tuning the
// Heart Egg only replays the last slice, and tuning rebirth 5 replays from the second one.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SEGMENT_REBIRTHS = 3;
const CACHE_DIR = path.join(__dirname, "..", ".sim-cache");
const CACHE_VERSION = 1;
const CODE_FILES = ["player.js", "quests.js", "rolls.js"];

/** The slices of a config: [{ index, from, to }] (to: the rebirth it stops after, null = to the end). */
function segmentsOf(cfg, size = SEGMENT_REBIRTHS) {
	const segs = [];
	let from = 0;
	while (from + size < cfg.REBIRTHS.length) {
		segs.push({ index: segs.length + 1, from, to: from + size });
		from += size;
	}
	segs.push({ index: segs.length + 1, from, to: null });
	return segs;
}
const segName = (seg) => `segment ${seg.index} (${seg.from === 0 ? "start" : "rebirth " + seg.from} → ${seg.to === null ? "end" : "rebirth " + seg.to})`;

/** JSON with sorted keys (a stable hash whatever the order fields were written in). */
function stable(x) {
	if (Array.isArray(x)) return `[${x.map(stable).join(",")}]`;
	if (x && typeof x === "object")
		return `{${Object.keys(x)
			.sort()
			.map((k) => JSON.stringify(k) + ":" + stable(x[k]))
			.join(",")}}`;
	return JSON.stringify(x === undefined ? null : x);
}
const sha1 = (text) => crypto.createHash("sha1").update(text).digest("hex");
let codeHash = null;
const simCode = () =>
	(codeHash ??= sha1(CODE_FILES.map((f) => fs.readFileSync(path.join(__dirname, f), "utf8")).join("\n")));

/** What a slice depends on, measured on its players at its end: eggs unlocked, Ocean Points reached. */
function depsOf(states) {
	return {
		maxEggs: Math.max(1, ...states.map((s) => s.maxEggs)),
		maxOcean: Math.max(0, ...states.map((s) => s.ocean)),
	};
}
/** The part of the config a slice used (the last slice: all of it). */
function sliceOf(cfg, seg, deps) {
	if (seg.to === null) return { code: simCode(), all: cfg };
	const eggs = cfg.EGGS.slice(0, deps.maxEggs);
	const species = [...new Set(["Basic", ...eggs.flatMap((e) => Object.keys(e.odds))])].sort();
	const below = (list) => list.filter((m) => (typeof m === "number" ? m : m.points) <= deps.maxOcean);
	const rebirthRewards = {};
	for (let n = 1; n <= seg.to; n++) rebirthRewards[n] = cfg.QUEST_REWARDS.rebirth[n] ?? null;
	return {
		code: simCode(),
		P: cfg.P,
		EASTER: cfg.EASTER,
		VARIANTS: cfg.VARIANTS,
		SIDE_QUESTS: cfg.SIDE_QUESTS,
		DEFAULT_GROWTH: cfg.DEFAULT_GROWTH,
		eggs,
		eggsBeyond: cfg.EGGS.length > deps.maxEggs,
		fish: Object.fromEntries(species.map((k) => [k, cfg.FISH[k] ?? null])),
		discover: Object.fromEntries(species.map((k) => [k, cfg.QUEST_REWARDS.discover[k] ?? null])),
		rebirths: cfg.REBIRTHS.slice(0, seg.to),
		rebirthRewards,
		capacity: below(cfg.CAPACITY),
		incubators: below(cfg.INCUBATORS),
		hatch: below(cfg.HATCH),
		milestones: below(cfg.OCEAN_MILESTONES),
	};
}
const fingerprint = (cfg, seg, deps) => sha1(stable(sliceOf(cfg, seg, deps)));

/** The cache files of one run setup (plan, overrides, players, seed): one key, a file per slice. */
function runKey({ planPath, overrides, cfg }) {
	const plan = planPath ? path.relative(path.join(__dirname, "..", ".."), path.resolve(planPath)) : "live";
	return {
		key: sha1(stable({ plan, overrides, players: cfg.P.players, seed: cfg.P.seed })).slice(0, 10),
		label: `${plan === "live" ? "live" : path.basename(plan, ".js")}-${cfg.P.players}p`,
	};
}
const cacheFile = (run, seg) => path.join(CACHE_DIR, `${run.label}-${run.key}-seg${seg.index}.json`);

/** The saved snapshot at the end of `seg`, or why it can't be used. */
function loadSegment(cfg, run, segs, seg) {
	const file = cacheFile(run, seg);
	if (!fs.existsSync(file)) return { ok: false, why: "not played yet" };
	let data;
	try {
		data = JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return { ok: false, why: "unreadable cache file" };
	}
	if (data.version !== CACHE_VERSION || data.chain.length !== seg.index) return { ok: false, why: "old cache format" };
	for (let j = 0; j < seg.index; j++) {
		const link = data.chain[j];
		const s = segs[j];
		if (link.from !== s.from || link.to !== s.to) return { ok: false, why: "segments changed" };
		if (fingerprint(cfg, s, link.deps) !== link.hash)
			return { ok: false, why: j + 1 === seg.index ? "its numbers changed" : `segment ${j + 1} changed` };
	}
	return { ok: true, states: data.states, savedAt: data.savedAt };
}
function saveSegment(cfg, run, seg, states, prevChain) {
	const deps = depsOf(states);
	const chain = [...prevChain, { from: seg.from, to: seg.to, deps, hash: fingerprint(cfg, seg, deps) }];
	fs.mkdirSync(CACHE_DIR, { recursive: true });
	fs.writeFileSync(
		cacheFile(run, seg),
		JSON.stringify({ version: CACHE_VERSION, savedAt: new Date().toISOString(), chain, states }),
	);
	prune();
	return chain;
}
/** Keeps the files of the KEEP_RUNS run setups saved last (overrides and player counts each get their own). */
const KEEP_RUNS = 6;
function prune() {
	const runs = new Map(); // "label-key" -> newest mtime
	const files = fs.readdirSync(CACHE_DIR).filter((f) => /-seg\d+\.json$/.test(f));
	for (const f of files) {
		const id = f.replace(/-seg\d+\.json$/, "");
		runs.set(id, Math.max(runs.get(id) ?? 0, fs.statSync(path.join(CACHE_DIR, f)).mtimeMs));
	}
	const old = [...runs.entries()].sort((a, b) => b[1] - a[1]).slice(KEEP_RUNS).map(([id]) => id);
	for (const f of files) if (old.includes(f.replace(/-seg\d+\.json$/, ""))) fs.rmSync(path.join(CACHE_DIR, f));
}
function chainOf(run, seg) {
	return JSON.parse(fs.readFileSync(cacheFile(run, seg), "utf8")).chain;
}

module.exports = { SEGMENT_REBIRTHS, CACHE_DIR, segmentsOf, segName, runKey, loadSegment, saveSegment, chainOf };
