// Starfall simulator (the star gauge of the starfall event, src/shared/types/stars.ts: keep the numbers below in sync).
// Monte Carlo of one event per catch rate: bars filled (p10 / median / p90), share reaching 1 / 2 / 3 bars, and the
// variant the next egg hatches with that star power. Then what a 12 h run gets from its starfalls.
// Usage: node tools/starfall-sim.js [--events 20000] [--luck 1] [--perHour 1.25]
//   luck: the player's variant luck (Lucky ocean x1.5, the Lucky pass x2); perHour: starfalls an hour of play (one
//   recurring event every ~12 min, drawn among the recurring ones: 4 of them = 1.25 starfalls an hour)
const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const i = args.indexOf(name);
	return i < 0 ? fallback : Number(args[i + 1]);
};
const EVENTS = flag("--events", 20000);
const LUCK = flag("--luck", 1);
const PER_HOUR = flag("--perHour", 1.25);

// stars.ts STARFALL / STAR_SIZES / STAR_BARS
const STARS = { min: 16, max: 20, floor: 1.5, maxBars: 3 };
const SIZES = [
	{ name: "Small", weight: 56, power: [0.05, 0.09] },
	{ name: "Medium", weight: 30, power: [0.11, 0.18] },
	{ name: "Big", weight: 11, power: [0.25, 0.4] },
	{ name: "Huge", weight: 3, power: [0.6, 0.9] },
];
const BARS = [
	{ guaranteed: "Anomaly", better: { Shiny: [0.02, 0.06], Ghost: [0.1, 0.4] } },
	{ guaranteed: "Ghost", better: { Shiny: [0.05, 0.4] } },
	{ guaranteed: "Shiny", better: {} },
];
const BASE = { Shiny: 0.01, Ghost: 0.05, Anomaly: 0.1 }; // variants.ts chances
const EMPTY_BAR_LUCK = 2;

const rand = (a, b) => a + Math.random() * (b - a);
function drawSize() {
	let r = Math.random() * SIZES.reduce((a, s) => a + s.weight, 0);
	for (const s of SIZES) if ((r -= s.weight) < 0) return s;
	return SIZES[0];
}
/** One event's gauge at its end for a player catching `rate` of the stars. */
function event(rate) {
	const n = Math.floor(rand(STARS.min, STARS.max + 1));
	let charge = 0;
	let caught = 0;
	for (let i = 0; i < n; i++) {
		const size = drawSize();
		const power = rand(size.power[0], size.power[1]);
		if (Math.random() < rate) {
			charge = Math.min(charge + power, STARS.maxBars);
			caught++;
		}
	}
	return Math.min(Math.max(charge, (STARS.floor * caught) / n), STARS.maxBars);
}
/** getStarVariantOdds + rollStarVariant. */
function variant(power, luck) {
	const full = Math.floor(power);
	const part = power - full;
	const r = Math.random();
	const odds = {};
	if (full === 0) {
		for (const [name, chance] of Object.entries(BASE)) odds[name] = chance * luck * (1 + EMPTY_BAR_LUCK * part);
	} else {
		const bar = BARS[Math.min(full, BARS.length) - 1];
		for (const [name, [from, to]] of Object.entries(bar.better)) odds[name] = (from + (to - from) * part) * luck;
		odds[bar.guaranteed] = 1;
	}
	let acc = 0;
	for (const name of ["Shiny", "Ghost", "Anomaly"]) {
		acc += odds[name] || 0;
		if (r < acc) return name;
	}
	return "Normal";
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log(`Starfall: ${EVENTS} events per catch rate, luck x${LUCK}`);
for (const rate of [0.4, 0.6, 0.75, 0.9, 1]) {
	const fills = [];
	const v = { Normal: 0, Anomaly: 0, Ghost: 0, Shiny: 0 };
	for (let i = 0; i < EVENTS; i++) {
		const f = event(rate);
		fills.push(f);
		v[variant(f, LUCK)]++;
	}
	fills.sort((a, b) => a - b);
	const q = (x) => fills[Math.floor(x * (EVENTS - 1))].toFixed(2);
	const bars = [1, 2, 3].map((b) => pct(fills.filter((f) => f >= b).length / EVENTS));
	const perRun = PER_HOUR * 12;
	console.log(
		`catch ${(rate * 100).toFixed(0)}%: bars p10 ${q(0.1)} median ${q(0.5)} p90 ${q(0.9)} | >= 1/2/3 bars ${bars.join(" / ")}`,
	);
	console.log(
		`  next egg: ${Object.entries(v).map(([k, c]) => `${k} ${pct(c / EVENTS)}`).join(", ")}` +
			` | a 12 h run (${perRun} starfalls): ${["Anomaly", "Ghost", "Shiny"].map((k) => `${((v[k] / EVENTS) * perRun).toFixed(1)} ${k}`).join(", ")}`,
	);
}
