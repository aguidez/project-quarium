// Companion simulator for Projet Quarium: how many fish the Pelican keeps fed, and what share of the coins
// the Snail picks up, while the player stays in front of the tank without doing anything (AFK farming).
// Mirrors CompanionService (Pelican: perch animation, feed interval, pellets, charges; Snail: speed, reach,
// "soonest coin" choice), FishService (hunger: satiated -> hungry 15 s -> weak, a weak fish earns nothing),
// FoodService (pellets thrown from the beak, max 10 in the water) and CoinService (coins sink at 4 studs/s,
// stay 5 s on the sand + perks). Keep it in sync with them, and write the results in BALANCE.md.
// Usage: node tools/companion-sim.js [pelican|snail] [--plan tools/balance-v1-plan.js]
const which = process.argv[2] || "all";
const planIndex = process.argv.indexOf("--plan");
const plan = planIndex > 0 ? require(require("path").resolve(process.argv[planIndex + 1])) : {};

const DT = 0.05;
const DURATION = 1800; // seconds of AFK simulated per run
const RUNS = 40;

// ---------------------------------------------------------------------------------------------------
// Pelican
// ---------------------------------------------------------------------------------------------------
const HUNGRY_DURATION = 15; // fish.ts DEFAULT_HUNGER
const SATIATED = 30;
const MAX_FOOD = 10; // FoodService
// CompanionService: turn 0.6 + lean 0.25 before the pellet leaves the beak, then 0.15 between two pellets,
// lean back 0.375 and turn back 0.6. FoodService: 0.5 s in the air.
const THROW_RELEASE = 0.85;
const PELLET_DELAY = 0.15;
const THROW_RECOVER = 0.975;
const AIR_TIME = 0.5;
// A hungry fish reaches a pellet that landed near it in 1–3 s (chase at 2x its 2–8 studs/s through a
// 48 x 22 x 20 tank, the pellet sinking at 2.5 studs/s); an on-demand Pelican notices a hungry fish
// within ~0.3 s (0.25 s watch steps, or the end of a 0.6 s head turn).
const reachTime = () => 1 + Math.random() * 2;
const REACTION = 0.3;

/**
 * One AFK session of `n` fish with a Pelican: { interval, pellets, charges (0 = feeds on a timer), satiety }.
 * Returns the share of fish-time spent weak (= income lost) and the pellets thrown per fish per minute.
 */
function pelicanRun(n, cfg) {
	const satiated = SATIATED + cfg.satiety;
	// fish: time it turns hungry; spread so they don't all get hungry together
	const fish = Array.from({ length: n }, () => ({ hungryAt: Math.random() * satiated }));
	const pellets = []; // { landsAt, eatenAt? }
	let busyUntil = 0; // throw animation
	let nextFeedAt = cfg.interval;
	let charges = cfg.charges;
	let chargeAt = cfg.interval;
	let weakTime = 0;
	let thrown = 0;
	const isHungry = (f, t) => t >= f.hungryAt;
	for (let t = 0; t < DURATION; t += DT) {
		// pellets: the first hungry fish to reach one eats it (the weakest one first: the Pelican aims at it)
		for (const p of pellets) {
			if (p.eaterAt !== undefined || t < p.landsAt) continue;
			const hungry = fish.filter((f) => isHungry(f, t) && !f.chasing);
			if (hungry.length === 0) continue;
			hungry.sort((a, b) => a.hungryAt - b.hungryAt);
			const eater = hungry[0];
			eater.chasing = true;
			p.eater = eater;
			p.eaterAt = t + reachTime();
		}
		for (let i = pellets.length - 1; i >= 0; i--) {
			const p = pellets[i];
			if (p.eaterAt !== undefined && t >= p.eaterAt) {
				p.eater.hungryAt = t + satiated;
				p.eater.chasing = false;
				pellets.splice(i, 1);
			}
		}
		for (const f of fish) if (t >= f.hungryAt + HUNGRY_DURATION) weakTime += DT;
		// the Pelican
		const throwNow = (count) => {
			const release = t + REACTION * (cfg.charges > 0 ? 1 : 0) + THROW_RELEASE;
			for (let i = 0; i < count; i++) {
				if (pellets.length >= MAX_FOOD) break;
				pellets.push({ landsAt: release + i * PELLET_DELAY + AIR_TIME });
				thrown++;
			}
			busyUntil = release + (count - 1) * PELLET_DELAY + THROW_RECOVER;
		};
		if (t < busyUntil) continue;
		if (cfg.charges > 0) {
			if (charges >= cfg.charges) chargeAt = t + cfg.interval;
			else if (t >= chargeAt) {
				charges++;
				chargeAt = t + cfg.interval;
			}
			const needsFood = fish.some((f) => isHungry(f, t)) && pellets.length === 0;
			if (charges > 0 && needsFood) {
				charges--;
				throwNow(cfg.pellets);
			}
		} else if (t >= nextFeedAt) {
			nextFeedAt = t + cfg.interval;
			throwNow(cfg.pellets);
		}
	}
	return { weak: weakTime / (n * DURATION), perFishMinute: (thrown / n / DURATION) * 60 };
}

function pelican() {
	const upgrade = plan.PELICAN_UPGRADE ?? 1.33; // Ocean milestone "Hungry Pelican" (oceanRewards.ts)
	const STAGES = [
		{ name: "Pelican (Ocean 50)", interval: 10, pellets: 1, charges: 0, satiety: 0 },
		{ name: "+ Hearty meals (quest 50 feeds)", interval: 10, pellets: 1, charges: 0, satiety: 15 },
		{ name: "+ Double serving (quest 150)", interval: 10, pellets: 2, charges: 0, satiety: 15 },
		{ name: "+ Smart Pelican (quest 500)", interval: 10, pellets: 2, charges: 2, satiety: 15 },
		{ name: `+ Hungry Pelican x${upgrade} (Ocean)`, interval: 10 / upgrade, pellets: 2, charges: 2, satiety: 15 },
		...(plan.PELICAN_STAGES || []),
	];
	const SIZES = [5, 8, 10, 12, 15, 17, 19, 21, 23, 25];
	console.log("Pelican alone, AFK: share of fish-time weak (income lost), per tank size");
	console.log("stage".padEnd(40) + SIZES.map((n) => String(n).padStart(6)).join(""));
	for (const stage of STAGES) {
		const row = SIZES.map((n) => {
			let weak = 0;
			for (let r = 0; r < RUNS; r++) weak += pelicanRun(n, stage).weak;
			return (((weak / RUNS) * 100).toFixed(0) + "%").padStart(6);
		});
		console.log(stage.name.padEnd(40) + row.join(""));
	}
	console.log("(without any feeding every fish is weak 45 s after its last meal: ~100% over a long AFK)");
}

// ---------------------------------------------------------------------------------------------------
// Snail
// ---------------------------------------------------------------------------------------------------
const FLOOR_X = 48; // AQUARIUM_INNER_SIZE
const FLOOR_Z = 20;
const WATER_Y = 22;
const COIN_SINK = 4; // CoinService SINK_SPEED
const PICKUP_HEIGHT = 3; // CompanionService SNAIL_PICKUP_HEIGHT
const REACH = 1.8; // SNAIL_REACH
const SNAIL_SPEED = 3.6;

/**
 * One AFK session: coins dropped at `coinsPerSecond` from random spots; returns the share picked up by a collector
 * crawling on the sand (the Snail) or, with a `pickup` height up to the surface and a wider `reach`, swimming
 * through the water (the planned Swordfish: it grabs coins while they sink).
 */
function snailRun(coinsPerSecond, { speed, ground: groundTime, pickup = PICKUP_HEIGHT, reach = REACH }) {
	const coins = [];
	let snail = { x: 0, z: 0 };
	let dropped = 0;
	let picked = 0;
	for (let t = 0; t < DURATION; t += DT) {
		if (Math.random() < coinsPerSecond * DT) {
			const y = Math.random() * WATER_Y;
			coins.push({
				x: (Math.random() - 0.5) * (FLOOR_X - 2),
				z: (Math.random() - 0.5) * (FLOOR_Z - 2),
				lowAt: t + Math.max(y - pickup, 0) / COIN_SINK,
				goneAt: t + y / COIN_SINK + groundTime,
			});
			dropped++;
		}
		for (let i = coins.length - 1; i >= 0; i--) if (t >= coins[i].goneAt) coins.splice(i, 1);
		// the coin it can pick up the soonest (CoinService.findCoinToFetch)
		let best = null;
		let bestTime = Infinity;
		for (const c of coins) {
			const crawl = Math.hypot(c.x - snail.x, c.z - snail.z) / speed;
			const time = Math.max(crawl, c.lowAt - t);
			if (time < bestTime) {
				best = c;
				bestTime = time;
			}
		}
		if (!best) continue;
		const d = Math.hypot(best.x - snail.x, best.z - snail.z);
		if (d <= reach && t >= best.lowAt) {
			coins.splice(coins.indexOf(best), 1);
			picked++;
			continue;
		}
		if (d > reach * 0.5) {
			const step = Math.min(d, speed * DT);
			snail = { x: snail.x + ((best.x - snail.x) / d) * step, z: snail.z + ((best.z - snail.z) / d) * step };
		}
	}
	return picked / Math.max(dropped, 1);
}

function snail() {
	const upgrade = plan.SNAIL_UPGRADE ?? 1.15; // Ocean milestone "Faster Snail" (oceanRewards.ts)
	const STAGES = [
		{ name: "Snail", speed: 1, ground: 5 },
		{ name: "+ Lasting coins +1 s (quest 20)", speed: 1, ground: 6 },
		{ name: "+ Lasting coins II +2 s (quest 100)", speed: 1, ground: 8 },
		{ name: "+ Bouncy coins (quest 200)", speed: 1, ground: 9.5 },
		{ name: `+ Faster Snail x${upgrade} (Ocean 100)`, speed: upgrade, ground: 9.5 },
		...(plan.SNAIL_STAGES || []),
	];
	// coins per second of a tank: e.g. 10 Guppies 2.5/s, 15 Discus 0.6/s, 15 Pirates 3/s
	const RATES = [0.25, 0.5, 1, 1.5, 2, 3, 4];
	console.log("Coin collector alone, AFK: share of the coins picked up, per coins dropped per second");
	console.log("stage".padEnd(40) + RATES.map((r) => (r + "/s").padStart(7)).join(""));
	for (const stage of STAGES) {
		const row = RATES.map((rate) => {
			let share = 0;
			for (let r = 0; r < RUNS / 4; r++) share += snailRun(rate, { ...stage, speed: SNAIL_SPEED * stage.speed });
			return (((share / (RUNS / 4)) * 100).toFixed(0) + "%").padStart(7);
		});
		console.log(stage.name.padEnd(40) + row.join(""));
	}
}

if (which === "all" || which === "pelican") pelican();
if (which === "all" || which === "snail") snail();
