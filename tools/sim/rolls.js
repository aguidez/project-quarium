// The random draws of one player (eggs, variants, Size score) and the fish's coin rates.
// Each player has its own seeded generator (mulberry32: one 32-bit state, saved in the segment snapshots), so a
// player plays the same game every run for a given seed: two runs differ only by what the config changed.

/** A player's generator state from the run's seed and the player's index. */
function seedFor(seed, index) {
	let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0;
	h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
	h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
	return (h ^ (h >>> 16)) >>> 0;
}
/** One draw in [0, 1); advances state.rng. */
function random(state) {
	let a = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
	a = Math.imul(a ^ (a >>> 15), a | 1);
	a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
	return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

const NORMAL = { name: "Normal", mult: 1, ocean: 1 };
function rollVariant(cfg, state) {
	let r = random(state);
	for (const v of cfg.VARIANTS) if ((r -= v.chance) < 0) return v;
	return NORMAL;
}
/**
 * The Size score: a whole number in [-sizeMax, +sizeMax], the sum of two dice (triangular), drawn
 * at hatch; the fish's coins are worth x(1 + size / 100), its Ocean Points don't change (live since V1.1.16).
 */
function rollSize(cfg, state) {
	if (!cfg.P.sizeMax) return 0;
	return Math.round((random(state) + random(state) - 1) * cfg.P.sizeMax);
}
/** An egg's odds as drawn (eggs.ts getDrawOdds): the easter eggs' chance comes out of the most common fish. */
function drawOdds(cfg, egg) {
	const odds = { ...egg.odds };
	const common = Object.keys(odds).reduce((a, k) => (odds[k] > odds[a] ? k : a));
	for (const [type, e] of Object.entries(cfg.EASTER)) {
		odds[common] -= e.chance;
		odds[type] = e.chance;
	}
	return odds;
}
/** Draws a key of `odds` (an array of [key, weight] and its total, precomputed per egg). */
function roll(state, entries, total) {
	let r = random(state) * total;
	for (const [k, v] of entries) if ((r -= v) < 0) return k;
	return entries[entries.length - 1][0];
}

function growthMult(cfg, type, age) {
	const g = cfg.FISH[type].growth || cfg.DEFAULT_GROWTH;
	let m = g[0][1];
	for (const [a, mm] of g) if (age >= a) m = mm;
	return m;
}
/** Coins per second of a fish of `type` aged `age` s with a variant / size multiplier. */
function ips(cfg, type, age, variantMult = 1) {
	const f = cfg.FISH[type];
	return (f.income / f.interval) * growthMult(cfg, type, age) * variantMult;
}
/** An egg's expected coins per second for a newborn fish (its value vs the weakest fish of the tank). */
function expected(cfg, egg) {
	const total = Object.values(egg.odds).reduce((a, b) => a + b, 0);
	return Object.entries(egg.odds).reduce((a, [k, v]) => a + (v / total) * ips(cfg, k, 0), 0);
}

module.exports = { seedFor, random, rollVariant, rollSize, drawOdds, roll, growthMult, ips, expected };
