// Economy simulator for Projet Quarium. Mirrors src/shared/types/fish.ts, eggs.ts, rebirths.ts and the
// capacity milestones of oceanRewards.ts: keep the numbers below in sync when the balance changes, and
// write the results in BALANCE.md.
// Monte Carlo over many "average players" (collect 50% of the coins, feed their fish, save for the
// best unlocked egg, fill empty slots, swap the weakest fish once the tank is full, complete the
// Fish Index, rebirth as soon as they can, release the weakest fish for room once the Ocean is open).
// Prints median / p10 / p90 times of each step, and the median income at a few checkpoints.
// Usage: node tools/economy-sim.js [--plan tools/balance-v1-plan.js] [--players 500] ['{"P":{"collect":0.6}}']
//   --plan: plays a planned economy (a module exporting FISH, EGGS, REBIRTHS, CAPACITY, OCEAN_MILESTONES,
//           P) instead of the live config below: BALANCE.md's V1 preview is balance-v1-plan.js
//   e.g. no rebirth: node tools/economy-sim.js '{"P":{"rebirths":0}}'
//   gamepass x2 coins (an estimate, never a target): '{"P":{"coinBoost":2}}', x2 Ocean Points: oceanBoost
const args = process.argv.slice(2);
const flag = (name) => {
	const i = args.indexOf(name);
	if (i < 0) return undefined;
	const value = args[i + 1];
	args.splice(i, 2);
	return value;
};
const planPath = flag("--plan");
const playersFlag = flag("--players");
const overrides = JSON.parse(args[0] || "{}");
const plan = planPath ? require(require("path").resolve(planPath)) : {};

let FISH = {
	Basic: { income: 4, interval: 4, ocean: 1, growth: [[0, 1]] },
	Big: {
		income: 25,
		interval: 10,
		ocean: 2,
		growth: [
			[0, 1],
			[300, 1.2],
		],
	},
	RedTetra: { income: 48, interval: 8, ocean: 4 },
	Clownfish: { income: 180, interval: 12, ocean: 15 },
	ZebraDanio: { income: 150, interval: 5, ocean: 25 },
	FlameGourami: { income: 1400, interval: 20, ocean: 80 },
	SilverAngelfish: { income: 2400, interval: 15, ocean: 150 },
	PirateFish: { income: 1500, interval: 5, ocean: 250 },
	ImperialDiscus: { income: 17500, interval: 25, ocean: 500 },
	// Rebirths 3–4 (V0.38, ROADMAP M2: the plan's numbers)
	Catfish: { income: 16000, interval: 10, ocean: 800 },
	BlueTang: { income: 19200, interval: 6, ocean: 1300 },
	BabySunfish: { income: 130000, interval: 20, ocean: 2000 },
};
if (plan.FISH) FISH = plan.FISH;
// Easter egg fish (fish.ts FishConfig.easterEgg): hidden chance (percent) per egg opened, taken from the egg's
// most common fish; no variant; a coin every `interval` s worth `share` of the tank's theoretical income per
// minute (other fish only), so it earns `share` x the tank's income; leaves for the ocean after `lifetime` s
// in the water. Not a species of the "all species" count.
const EASTER = { FrenchFish: { chance: 0.1, share: 0.5, interval: 60, lifetime: 3600, ocean: 100 } };
const FIRST_SIX = ["Basic", "Big", "RedTetra", "Clownfish", "ZebraDanio", "FlameGourami"];
const DEFAULT_GROWTH = [
	[0, 1],
	[300, 1.2],
	[600, 1.5],
];
// Fish variants (src/shared/types/variants.ts): chance at hatch, and income vs a normal fish of the type.
// A normal fish earns 1 + 1/15 (one coin in 15 sparkles, x2). Anomaly: coins 1.2x as often. Ghost: its
// sparkling coins become ghost coins worth 3 sparkling ones. Shiny: anomaly pace + 3x the sparkling coins
let VARIANTS = [
	{ name: "Shiny", chance: 0.01, mult: 1.2 * ((4 / 5 + (1 / 5) * 2) / (1 + 1 / 15)), ocean: 5 },
	{ name: "Ghost", chance: 0.05, mult: (14 / 15 + (1 / 15) * 6) / (1 + 1 / 15), ocean: 3 },
	{ name: "Anomaly", chance: 0.1, mult: 1.2, ocean: 2 },
];
if (overrides.VARIANTS) VARIANTS = overrides.VARIANTS;
function rollVariant() {
	let r = Math.random();
	for (const v of VARIANTS) if ((r -= v.chance) < 0) return v;
	return { name: "Normal", mult: 1, ocean: 1 };
}
let EGGS = [
	{ name: "Common", price: 100, hatch: 3, odds: { Basic: 80, Big: 20 } },
	{ name: "Improved", price: 500, hatch: 8, odds: { Basic: 30, Big: 52, RedTetra: 18 } },
	{ name: "Superior", price: 2500, hatch: 20, odds: { Big: 35, RedTetra: 50, Clownfish: 15 } },
	{ name: "Freshwater", price: 25000, hatch: 45, odds: { RedTetra: 45, ZebraDanio: 40, FlameGourami: 15 } },
	{ name: "Amazon", price: 150000, hatch: 75, odds: { FlameGourami: 55, SilverAngelfish: 45 } },
	{
		name: "NeonCoral",
		price: 2500000,
		hatch: 120,
		odds: { SilverAngelfish: 25, PirateFish: 55, ImperialDiscus: 20 },
	},
	{ name: "Wreck", price: 55e6, hatch: 135, odds: { ImperialDiscus: 55, Catfish: 45 } },
	{ name: "Atlantis", price: 144e6, hatch: 150, odds: { Catfish: 25, BlueTang: 55, BabySunfish: 20 } },
];
if (plan.EGGS) EGGS = plan.EGGS;
// Rebirth n is REBIRTHS[n - 1] (rebirths.ts): price, total coin multiplier, start money
let REBIRTHS = [
	{ price: 5000, mult: 2.5, start: 300 },
	{ price: 1300000, mult: 8, start: 300 },
	{ price: 45e6, mult: 25, start: 300 },
	{ price: 120e6, mult: 80, start: 300 },
];
if (plan.REBIRTHS) REBIRTHS = plan.REBIRTHS;
// Capacity milestones (oceanRewards.ts, kind "Capacity"): the tank holds `capacity` fish from `points` Ocean Points
let CAPACITY = [
	{ points: 1500, capacity: 15 },
	{ points: 8000, capacity: 17 },
	{ points: 25000, capacity: 19 },
];
if (plan.CAPACITY) CAPACITY = plan.CAPACITY;
let OCEAN_MILESTONES = [50, 100, 200, 500, 1500, 5000, 8000, 25000, 40000]; // oceanRewards.ts (only reported, except the capacity / incubator ones)
if (plan.OCEAN_MILESTONES) OCEAN_MILESTONES = plan.OCEAN_MILESTONES;
// Incubator milestones (oceanRewards.ts, kind "Incubator"): from `points` Ocean Points, `count` eggs of the same type
// can incubate at once
let INCUBATORS = plan.INCUBATORS || [{ points: 5000, count: 2 }];
// Hatch-time milestones (planned, the Water Hen companion): from `points` Ocean Points, eggs hatch in `mult` x their time
let HATCH = plan.HATCH || [];
// Story quest rewards that move the economy (quests.ts, the Voyage line): minutes of income when a species is
// discovered, Ocean Points when rebirth n is done. Other rewards (perks, cosmetics) are not modelled.
const LIVE_QUEST_REWARDS = {
	discover: { FlameGourami: 5, ImperialDiscus: 5, Catfish: 5, BabySunfish: 5 },
	rebirth: { 2: 500, 3: 1500, 4: 4000 },
};
const QUEST_REWARDS = Object.assign({ discover: {}, rebirth: {} }, plan.QUEST_REWARDS || LIVE_QUEST_REWARDS);
const P = Object.assign(
	{
		collect: 0.5, // share of coin value the player collects (0.5 = average player, calibrated)
		special: 1 + 1 / 15, // special coins x2 one time out of 15
		food: 10, // per pellet
		feedEvery: 35, // seconds between two meals of a fish
		capacity: 10,
		reveal: 3.8,
		onboarding: 90, // seconds to finish the tutorial
		onboardingReward: 300,
		rebirths: null, // how many rebirths the player does (null = all of REBIRTHS)
		cheapEggRatio: 0.2, // only buys an egg worth >= this share of the best unlocked egg
		coinBoost: 1, // a coin multiplier on top of everything (gamepass estimate only)
		hatchMult: null, // hatch-time multiplier once the Hen is owned, replacing HATCH's (paid Hen quests estimate only)
		oceanBoost: 1, // an Ocean Points multiplier (gamepass estimate only)
		checkpoints: [15, 30, 60, 90, 120, 150, 180, 240, 300, 360],
		horizon: 9 * 3600,
		players: 2000,
	},
	plan.P || {},
	overrides.P || {},
);
if (playersFlag) P.players = Number(playersFlag);
if (overrides.EGGS) EGGS = overrides.EGGS;
if (overrides.REBIRTHS) REBIRTHS = overrides.REBIRTHS;
if (overrides.CAPACITY) CAPACITY = overrides.CAPACITY;
if (P.rebirths !== null) REBIRTHS = REBIRTHS.slice(0, P.rebirths);
const CHECKPOINTS = P.checkpoints.map((m) => m * 60);
if (overrides.FISH) Object.assign(FISH, overrides.FISH);
const SPECIES = Object.keys(FISH);

function growthMult(type, age) {
	const g = FISH[type].growth || DEFAULT_GROWTH;
	let m = g[0][1];
	for (const [a, mm] of g) if (age >= a) m = mm;
	return m;
}
function ips(type, age, variantMult = 1) {
	const f = FISH[type];
	return (f.income / f.interval) * growthMult(type, age) * variantMult;
}
const fishIps = (f, t) => (f.easter ? 0 : ips(f.type, t - f.born, f.vm));
/** Income of a tank per second: its fish, plus each easter egg fish's share of the others'. */
function tankIps(fish, t) {
	let base = 0;
	let share = 0;
	for (const f of fish) {
		if (f.easter) share += EASTER[f.type].share;
		else base += fishIps(f, t);
	}
	return base * (1 + share);
}
/** An egg's odds as drawn (eggs.ts getDrawOdds): the easter eggs' chance comes out of the most common fish. */
function drawOdds(egg) {
	const odds = { ...egg.odds };
	const common = Object.keys(odds).reduce((a, k) => (odds[k] > odds[a] ? k : a));
	for (const [type, e] of Object.entries(EASTER)) {
		odds[common] -= e.chance;
		odds[type] = e.chance;
	}
	return odds;
}
function roll(odds) {
	const total = Object.values(odds).reduce((a, b) => a + b, 0);
	let r = Math.random() * total;
	for (const [k, v] of Object.entries(odds)) {
		if ((r -= v) < 0) return k;
	}
	return Object.keys(odds).pop();
}
const expected = (egg) => {
	const total = Object.values(egg.odds).reduce((a, b) => a + b, 0);
	return Object.entries(egg.odds).reduce((a, [k, v]) => a + (v / total) * ips(k, 0), 0);
};

function simulate() {
	let t = P.onboarding;
	let money = P.onboardingReward;
	let mult = 1;
	let capacity = P.capacity;
	let fish = [{ type: "Basic", born: t }]; // onboarding fish
	let unlocked = new Set([EGGS[0].name]);
	let incubating = {}; // egg -> readyAt[]
	let incubators = 1;
	let hatchMult = 1;
	const discovered = new Map([["Basic", t]]);
	let oceanUnlocked = false;
	const rebirthAt = [];
	let ocean = 0;
	const capacityAt = {}; // capacity -> time reached
	const oceanAtRebirth = [];
	const income = {}; // checkpoint -> collected money per second
	const oceanAtCheckpoint = {}; // checkpoint -> Ocean Points
	const oceanAt = {}; // Ocean milestone -> time reached
	const release = (f) =>
		(ocean += (f.easter ? EASTER[f.type].ocean : FISH[f.type].ocean * (f.om || 1)) * P.oceanBoost);
	let easterAt = null; // first easter egg fish hatched
	let opened = 0; // eggs opened (Hatchery quests)
	const openedAt = {}; // checkpoint -> eggs opened by then
	const firstSixAt = () =>
		FIRST_SIX.every((k) => discovered.has(k)) ? Math.max(...FIRST_SIX.map((k) => discovered.get(k))) : null;
	const allAt = () => (discovered.size === SPECIES.length ? Math.max(...discovered.values()) : null);
	while (t < P.horizon) {
		t += 1;
		// income and feeding
		// an easter egg fish's time is up: it leaves for the ocean on its own
		for (const f of fish.filter((f) => f.easter && t - f.born >= EASTER[f.type].lifetime)) {
			release(f);
			fish.splice(fish.indexOf(f), 1);
		}
		let earned = tankIps(fish, t);
		earned *= P.collect * P.special * mult * P.coinBoost;
		money += earned - (fish.length * P.food) / P.feedEvery;
		if (money < 0) money = 0;
		if (CHECKPOINTS.includes(t)) {
			income[t] = earned;
			oceanAtCheckpoint[t] = ocean;
		}
		for (const m of OCEAN_MILESTONES) if (oceanAt[m] === undefined && ocean >= m) oceanAt[m] = t;
		// the capacity milestones, claimed as soon as they are reached (Ocean Points are never spent)
		for (const c of CAPACITY) {
			if (capacityAt[c.capacity] === undefined && ocean >= c.points) {
				capacityAt[c.capacity] = t;
				capacity = Math.max(capacity, c.capacity);
			}
		}
		for (const c of INCUBATORS) if (ocean >= c.points) incubators = Math.max(incubators, c.count);
		for (const h of HATCH) if (ocean >= h.points) hatchMult = Math.min(hatchMult, P.hatchMult ?? h.mult);
		// rebirth as soon as the next one is affordable
		const next = REBIRTHS[rebirthAt.length];
		if (next && money >= next.price) {
			rebirthAt.push(t);
			for (const f of fish) release(f);
			ocean += QUEST_REWARDS.rebirth[rebirthAt.length] || 0; // the story quest of that rebirth (the x2 pass leaves fixed rewards alone)
			oceanAtRebirth.push(ocean);
			fish = [];
			incubating = {};
			unlocked = new Set([EGGS[0].name]);
			money = next.start;
			mult = next.mult;
		}
		// open ready eggs
		for (const [name, readyList] of Object.entries(incubating)) {
			const ready = readyList.filter((readyAt) => t >= readyAt);
			for (const readyAt of ready) {
				if (fish.length >= capacity) {
					if (!oceanUnlocked) continue;
					// release the weakest fish to make room
					// (an easter egg fish is kept: it leaves by itself)
					fish.sort((a, b) => (a.easter ? 1 : 0) - (b.easter ? 1 : 0) || fishIps(a, t) - fishIps(b, t));
					release(fish.shift());
				}
				const egg = EGGS.find((e) => e.name === name);
				const type = roll(drawOdds(egg));
				opened++;
				for (const c of CHECKPOINTS) if (t <= c) openedAt[c] = opened;
				readyList.splice(readyList.indexOf(readyAt), 1);
				if (readyList.length === 0) delete incubating[name];
				if (EASTER[type]) {
					fish.push({ type, born: t + P.reveal, easter: true });
					if (easterAt === null) easterAt = t;
					if (fish.length >= P.capacity) oceanUnlocked = true;
					continue;
				}
				const variant = rollVariant();
				fish.push({ type, born: t + P.reveal, vm: variant.mult, om: variant.ocean });
				if (!discovered.has(type)) {
					discovered.set(type, t);
					// a story quest for this species pays minutes of the current income (claimed at once)
					money += earned * 60 * (QUEST_REWARDS.discover[type] || 0);
				}
				if (fish.length >= P.capacity) oceanUnlocked = true; // "Full House" story quest
			}
		}
		// buy eggs. The best unlocked egg is the goal (saved for); a cheaper egg is only bought to fill an
		// empty slot, or when it clearly beats the weakest fish (a full tank swaps that one out)
		const fishAndEggs = fish.length + Object.values(incubating).reduce((a, l) => a + l.length, 0);
		const unlockedEggs = EGGS.filter((e) => unlocked.has(e.name));
		const target = unlockedEggs[unlockedEggs.length - 1];
		const regular = fish.filter((f) => !f.easter);
		const weakest = regular.length ? Math.min(...regular.map((f) => fishIps(f, t))) : 0;
		for (let i = unlockedEggs.length - 1; i >= 0; i--) {
			const egg = unlockedEggs[i];
			if ((incubating[egg.name]?.length ?? 0) >= incubators) continue;
			const price = i === 0 && fishAndEggs === 0 ? 0 : egg.price;
			const isTarget = egg === target;
			const slotFree = fishAndEggs < capacity;
			const missing = Object.keys(egg.odds).some((k) => !discovered.has(k));
			const worth = isTarget || slotFree || missing || expected(egg) > weakest * 1.5;
			// a cheaper egg must not eat the savings for the target
			const reserve = isTarget || incubating[target.name] !== undefined ? 0 : target.price;
			if (!worth || money - price < (isTarget ? 0 : Math.min(reserve, money) * 0.5)) continue;
			if (money >= price) {
				money -= price;
				(incubating[egg.name] ??= []).push(t + egg.hatch * hatchMult);
				const nextEgg = EGGS[EGGS.indexOf(egg) + 1];
				if (nextEgg) unlocked.add(nextEgg.name);
			}
		}
		const done =
			allAt() !== null &&
			rebirthAt.length === REBIRTHS.length &&
			CAPACITY.every((c) => capacityAt[c.capacity] !== undefined) &&
			t >= CHECKPOINTS[CHECKPOINTS.length - 1];
		if (done) break;
	}
	return {
		easterAt,
		firstSix: firstSixAt(),
		all: allAt(),
		rebirthAt,
		oceanAtRebirth,
		capacityAt,
		ocean,
		oceanAt,
		oceanAtCheckpoint,
		openedAt,
		income,
		discovered,
	};
}

function pct(arr, p) {
	const s = arr.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b);
	if (s.length === 0) return null;
	return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}
const runs = [];
for (let i = 0; i < P.players; i++) runs.push(simulate());
const min = (x) =>
	x === null
		? "never"
		: x >= 5400
			? `${Math.floor(x / 3600)}h${String(Math.round((x % 3600) / 60)).padStart(2, "0")}`
			: (x / 60).toFixed(1) + "min";
const line = (label, values) => {
	const never = values.filter((x) => x === null || x === undefined).length;
	console.log(
		`${label}: median ${min(pct(values, 0.5))}, p10 ${min(pct(values, 0.1))}, p90 ${min(pct(values, 0.9))}` +
			(never ? `, never ${never}/${P.players}` : ""),
	);
};
const short = (n) =>
	n >= 1e12
		? (n / 1e12).toFixed(1) + "T"
		: n >= 1e9
			? (n / 1e9).toFixed(1) + "B"
			: n >= 1e6
				? (n / 1e6).toFixed(1) + "M"
				: n >= 1e3
					? (n / 1e3).toFixed(1) + "k"
					: String(Math.round(n));
if (planPath) console.log(`plan: ${plan.name || planPath}, ${P.players} players`);
REBIRTHS.forEach((_, n) =>
	line(
		`rebirth ${n + 1}`,
		runs.map((r) => r.rebirthAt[n] ?? null),
	),
);
line(
	"first 6 species",
	runs.map((r) => r.firstSix),
);
line(
	`all ${SPECIES.length} species`,
	runs.map((r) => r.all),
);
line(
	"everything (all species and rebirths)",
	runs.map((r) => (r.all === null || r.rebirthAt.length < REBIRTHS.length ? null : Math.max(r.all, ...r.rebirthAt))),
);
for (const c of CAPACITY)
	line(
		`${c.capacity} slots (${c.points} Ocean Points)`,
		runs.map((r) => r.capacityAt[c.capacity] ?? null),
	);
console.log("species discovery (median, p10-p90):");
for (const ft of SPECIES) {
	const values = runs.map((r) => r.discovered.get(ft) ?? null);
	console.log(`  ${ft}: ${min(pct(values, 0.5))} (${min(pct(values, 0.1))}-${min(pct(values, 0.9))})`);
}
for (const type of Object.keys(EASTER)) {
	const got = runs.filter((r) => r.easterAt !== null);
	console.log(
		`${type} (easter egg): hatched by ${got.length}/${P.players} players during the run` +
			(got.length
				? `, first one at median ${min(
						pct(
							got.map((r) => r.easterAt),
							0.5,
						),
					)}`
				: ""),
	);
}
console.log(
	"median Ocean Points right after each rebirth:",
	REBIRTHS.map((_, n) =>
		short(
			pct(
				runs.map((r) => r.oceanAtRebirth[n] ?? null),
				0.5,
			) || 0,
		),
	).join(", "),
);
console.log(
	"median time to reach the Ocean milestones:",
	OCEAN_MILESTONES.map(
		(m) =>
			`${short(m)} ${min(
				pct(
					runs.map((r) => r.oceanAt[m] ?? null),
					0.5,
				),
			)}`,
	).join(", "),
);
console.log(
	"median Ocean Points at the end:",
	short(
		pct(
			runs.map((r) => r.ocean),
			0.5,
		),
	),
);
const perMinute = CHECKPOINTS.map(
	(c) =>
		`${min(c)} ${short(
			(pct(
				runs.map((r) => r.income[c] ?? null),
				0.5,
			) || 0) * 60,
		)}$`,
);
console.log("median money collected per minute:", perMinute.join(", "));
const oceanPerCheckpoint = CHECKPOINTS.map(
	(c) =>
		`${min(c)} ${short(
			pct(
				runs.map((r) => r.oceanAtCheckpoint[c] ?? null),
				0.5,
			) || 0,
		)}`,
);
console.log("median Ocean Points:", oceanPerCheckpoint.join(", "));
const openedPerCheckpoint = CHECKPOINTS.map(
	(c) =>
		`${min(c)} ${
			pct(
				runs.map((r) => r.openedAt[c] ?? null),
				0.5,
			) || 0
		}`,
);
console.log("median eggs opened:", openedPerCheckpoint.join(", "));
