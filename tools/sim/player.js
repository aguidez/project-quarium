// One "average player" second by second: collects cfg.P.collect of the coins, feeds its fish (free food), saves for
// the best unlocked egg, fills empty slots, swaps the weakest fish once the tank is full, completes the Fish Index,
// rebirths as soon as it can, releases the weakest fish for room once the Ocean is open.
// The whole player is one plain object (`state`, JSON-safe), so a run can stop right after a rebirth, be saved in a
// segment snapshot (segments.js) and go on later from there with the same result as a run in one go.
const { seedFor, rollVariant, rollSize, drawOdds, roll, expected } = require("./rolls");
const { claimSideQuests, claimOceanMilestones } = require("./quests");

/** Per-config lookups the hot loop needs (computed once per worker). */
function prepare(cfg) {
	if (cfg._prep) return cfg._prep;
	const eggs = cfg.EGGS.map((egg) => {
		const odds = drawOdds(cfg, egg);
		const entries = Object.entries(odds);
		return {
			egg,
			entries,
			total: Object.values(odds).reduce((a, b) => a + b, 0),
			species: Object.keys(egg.odds),
			expected: expected(cfg, egg),
		};
	});
	const byName = Object.fromEntries(eggs.map((e, i) => [e.egg.name, i]));
	const rate = Object.fromEntries(Object.entries(cfg.FISH).map(([k, f]) => [k, f.income / f.interval]));
	const growth = Object.fromEntries(Object.keys(cfg.FISH).map((k) => [k, cfg.FISH[k].growth || cfg.DEFAULT_GROWTH]));
	const prep = {
		eggs,
		byName,
		rate,
		growth,
		species: Object.keys(cfg.FISH).length,
		checkpoints: new Set(cfg.P.checkpoints.map((m) => m * 60)),
		checkpointList: cfg.P.checkpoints.map((m) => m * 60),
	};
	Object.defineProperty(cfg, "_prep", { value: prep, enumerable: false });
	return prep;
}

/** A new player, right after the tutorial (its onboarding fish in the tank). */
function newPlayer(cfg, index) {
	const P = cfg.P;
	const t = P.onboarding;
	return {
		index,
		rng: seedFor(P.seed, index),
		t,
		money: P.onboardingReward,
		mult: 1,
		capacity: P.capacity,
		fish: [{ type: "Basic", born: t }],
		unlockedCount: 1, // the unlocked eggs are always EGGS[0 .. unlockedCount - 1] (buying an egg opens the next)
		incubating: {}, // egg name -> readyAt[]
		incubators: 1,
		hatchMult: 1,
		discovered: { Basic: t },
		discoveredCount: 1,
		oceanUnlocked: false,
		rebirthAt: [],
		ocean: 0,
		capacityAt: {},
		oceanAtRebirth: [],
		income: {}, // checkpoint -> collected money per second
		oceanAtCheckpoint: {},
		oceanAt: {}, // Ocean milestone -> time reached
		easterAt: null,
		opened: 0, // eggs opened (Hatchery quests)
		openedAt: {},
		hatcheryStep: 0,
		collectorStep: 0,
		released: 0, // fish released to make room
		oceanLineStep: 0,
		bigCatchStep: 0,
		bestSize: -1e9, // best Size score hatched so far
		cells: {}, // Fish Index cells: "type:variant" -> 1
		cellsCount: 0,
		variantsFound: {},
		boostLeft: 0, // seconds of quest coin boost
		sideAt: {}, // side quest -> time done ("Hatchery 100 fish", "Collector Shiny"...)
		maxEggs: 1, // dependency tracking for the segment cache: most eggs unlocked at once
		earned: 0, // the last second's income (a snapshot resumes in the middle of that second)
		midTick: false, // true: the snapshot was taken right after this second's rebirth
		finished: false, // reached the end of the content (or the horizon)
	};
}

/**
 * Plays `s` until rebirth `stopAt` has just happened (then returns with s.midTick), or to the end of the content /
 * the horizon (stopAt null). Mutates and returns `s`.
 */
function play(cfg, s, stopAt = null) {
	const P = cfg.P;
	const prep = prepare(cfg);
	const { eggs, byName, rate, growth, checkpoints, checkpointList } = prep;
	const EASTER = cfg.EASTER;
	const REBIRTHS = cfg.REBIRTHS;
	const lastCheckpoint = checkpointList[checkpointList.length - 1];
	const dayLength = P.hoursPerDay * 3600;
	const halfDay = Math.floor(dayLength / 2);
	let fish = s.fish;
	const fishIps = (f, t) => {
		if (f.easter) return 0;
		const g = growth[f.type];
		const age = t - f.born;
		let m = g[0][1];
		for (const [a, mm] of g) if (age >= a) m = mm;
		return rate[f.type] * m * (f.vm ?? 1);
	};
	// The tank's income per second (its fish, plus each easter egg fish's share of the others'), cached until a fish
	// comes or goes or one of them reaches its next growth step
	// (and the weakest regular fish's, for the egg choice: 0 without one)
	let ipsDirty = true;
	let ipsValue = 0;
	let ipsUntil = 0;
	let weakestValue = 0;
	const tankIps = (t) => {
		if (!ipsDirty && t < ipsUntil) return ipsValue;
		let base = 0;
		let share = 0;
		let until = Infinity;
		let weakest = Infinity;
		for (const f of fish) {
			if (f.easter) {
				share += EASTER[f.type].share;
				continue;
			}
			const v = fishIps(f, t);
			base += v;
			if (v < weakest) weakest = v;
			for (const [a] of growth[f.type]) if (t - f.born < a) until = Math.min(until, f.born + a);
		}
		ipsValue = base * (1 + share);
		weakestValue = weakest === Infinity ? 0 : weakest;
		ipsUntil = until;
		ipsDirty = false;
		return ipsValue;
	};
	let easterCount = fish.filter((f) => f.easter).length;
	let incubatingCount = Object.values(s.incubating).reduce((a, l) => a + l.length, 0);
	let nextReady = Infinity;
	const updateNextReady = () => {
		nextReady = Infinity;
		for (const list of Object.values(s.incubating)) for (const r of list) if (r < nextReady) nextReady = r;
	};
	updateNextReady();
	const bigCount = (size) => fish.filter((f) => !f.easter && f.size >= size).length;
	const release = (f) =>
		(s.ocean += (f.easter ? EASTER[f.type].ocean : cfg.FISH[f.type].ocean * (f.om || 1)) * P.oceanBoost);
	let checkedOcean = NaN; // the Ocean milestones are checked again only when the points move
	let resume = s.midTick;
	s.midTick = false;
	let earned = s.earned;

	while (resume || s.t < P.horizon) {
		if (!resume) {
			const t = ++s.t;
			// an easter egg fish's time is up: it leaves for the ocean on its own
			if (easterCount > 0) {
				for (const f of fish.filter((f) => f.easter && t - f.born >= EASTER[f.type].lifetime)) {
					release(f);
					fish.splice(fish.indexOf(f), 1);
					easterCount--;
					ipsDirty = true;
				}
			}
			earned = tankIps(t);
			earned *= P.collect * P.special * s.mult * P.coinBoost;
			const boost = s.boostLeft > 0 ? P.boostMult : 1;
			if (s.boostLeft > 0) s.boostLeft--;
			s.money += earned * boost - (fish.length * P.food) / P.feedEvery;
			if (s.money < 0) s.money = 0;
			claimSideQuests(cfg, s, earned, bigCount);
			// daily / weekly quests, mid-session (see P.hoursPerDay)
			if (dayLength > 0 && t % dayLength === halfDay) {
				if (s.rebirthAt.length >= P.dailyFromRebirth) s.boostLeft += P.dailyBoostMinutes * 60;
				if (s.rebirthAt.length >= P.weeklyFromRebirth && Math.floor(t / dayLength) % 7 === 3)
					s.boostLeft += P.weeklyBoostMinutes * 60;
			}
			if (checkpoints.has(t)) {
				s.income[t] = earned;
				s.oceanAtCheckpoint[t] = s.ocean;
			}
			if (s.ocean !== checkedOcean) {
				checkedOcean = s.ocean;
				claimOceanMilestones(cfg, s);
			}
			// rebirth as soon as the next one is affordable
			const next = REBIRTHS[s.rebirthAt.length];
			if (next && s.money >= next.price) {
				s.rebirthAt.push(t);
				for (const f of fish) release(f);
				s.ocean += cfg.QUEST_REWARDS.rebirth[s.rebirthAt.length] || 0; // that rebirth's story quest
				s.oceanAtRebirth.push(s.ocean);
				fish = s.fish = [];
				easterCount = 0;
				ipsDirty = true;
				s.incubating = {};
				incubatingCount = 0;
				nextReady = Infinity;
				s.unlockedCount = 1;
				s.money = next.start;
				s.mult = next.mult;
				if (stopAt !== null && s.rebirthAt.length >= stopAt) {
					s.earned = earned;
					s.midTick = true;
					return s;
				}
			}
		}
		resume = false;
		const t = s.t;
		// open ready eggs
		if (incubatingCount > 0 && t >= nextReady) {
			for (const [name, readyList] of Object.entries(s.incubating)) {
				const ready = readyList.filter((readyAt) => t >= readyAt);
				for (const readyAt of ready) {
					if (fish.length >= s.capacity) {
						if (!s.oceanUnlocked) continue;
						// release the weakest fish to make room (an easter egg fish is kept: it leaves by itself)
						fish.sort((a, b) => (a.easter ? 1 : 0) - (b.easter ? 1 : 0) || fishIps(a, t) - fishIps(b, t));
						const out = fish.shift();
						if (out.easter) easterCount--;
						release(out);
						s.released++;
					}
					const e = eggs[byName[name]];
					const type = roll(s, e.entries, e.total);
					s.opened++;
					for (const c of checkpointList) if (t <= c) s.openedAt[c] = s.opened;
					readyList.splice(readyList.indexOf(readyAt), 1);
					incubatingCount--;
					if (readyList.length === 0) delete s.incubating[name];
					ipsDirty = true;
					if (EASTER[type]) {
						fish.push({ type, born: t + P.reveal, easter: true });
						easterCount++;
						if (s.easterAt === null) s.easterAt = t;
						if (fish.length >= P.capacity) s.oceanUnlocked = true;
						continue;
					}
					const variant = rollVariant(cfg, s);
					const size = rollSize(cfg, s);
					s.bestSize = Math.max(s.bestSize, size);
					fish.push({ type, born: t + P.reveal, vm: variant.mult * (1 + size / 100), om: variant.ocean, size });
					const cell = `${type}:${variant.name}`;
					if (!s.cells[cell]) {
						s.cells[cell] = 1;
						s.cellsCount++;
					}
					if (variant.name !== "Normal") s.variantsFound[variant.name] = true;
					if (s.discovered[type] === undefined) {
						s.discovered[type] = t;
						s.discoveredCount++;
						// a story quest for this species pays minutes of the current income (claimed at once)
						s.money += earned * 60 * (cfg.QUEST_REWARDS.discover[type] || 0);
					}
					if (fish.length >= P.capacity) s.oceanUnlocked = true; // "Full House" story quest
				}
			}
			updateNextReady();
		}
		// buy eggs. The best unlocked egg is the goal (saved for); a cheaper egg is only bought to fill an
		// empty slot, or when it clearly beats the weakest fish (a full tank swaps that one out)
		const fishAndEggs = fish.length + incubatingCount;
		const unlocked = s.unlockedCount;
		const target = eggs[unlocked - 1].egg;
		for (let i = unlocked - 1; i >= 0; i--) {
			const e = eggs[i];
			const egg = e.egg;
			const list = s.incubating[egg.name];
			if ((list?.length ?? 0) >= s.incubators) continue;
			const price = i === 0 && fishAndEggs === 0 ? 0 : egg.price;
			const isTarget = egg === target;
			// a cheaper egg must not eat the savings for the target
			const reserve = isTarget || s.incubating[target.name] !== undefined ? 0 : target.price;
			if (s.money < price) continue; // (the test below would skip it too)
			if (s.money - price < (isTarget ? 0 : Math.min(reserve, s.money) * 0.5)) continue;
			if (!isTarget && fishAndEggs >= s.capacity && !e.species.some((k) => s.discovered[k] === undefined)) {
				tankIps(t);
				if (!(e.expected > weakestValue * 1.5)) continue;
			}
			if (s.money >= price) {
				s.money -= price;
				const readyAt = t + egg.hatch * s.hatchMult * P.hatchScale;
				(s.incubating[egg.name] ??= []).push(readyAt);
				incubatingCount++;
				if (readyAt < nextReady) nextReady = readyAt;
				if (i + 1 < eggs.length && i + 2 > s.unlockedCount) {
					s.unlockedCount = i + 2;
					if (s.unlockedCount > s.maxEggs) s.maxEggs = s.unlockedCount;
				}
			}
		}
		const done =
			s.rebirthAt.length === REBIRTHS.length &&
			s.discoveredCount === prep.species &&
			t >= lastCheckpoint &&
			cfg.CAPACITY.every((c) => s.capacityAt[c.capacity] !== undefined);
		if (done) break;
	}
	s.finished = true;
	s.earned = earned;
	return s;
}

module.exports = { newPlayer, play, prepare };
