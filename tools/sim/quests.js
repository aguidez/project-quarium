// Quests and Ocean milestones of one player, checked every simulated second (see player.js).

const oceanLines = new WeakMap(); // cfg.SIDE_QUESTS -> its Ocean line as a list

/**
 * The side lines (cfg.SIDE_QUESTS), claimed as soon as they are done: Hatchery (fish hatched; +1, the onboarding fish
 * was hatched too), Collector (a variant or a number of Fish Index cells, after "Full House"), Ocean (fish released to
 * make room) and Big Catch (a Size score hatched, or `count` such fish held at once). `earned` is this second's
 * income: a reward of n minutes pays n x 60 of it.
 */
function claimSideQuests(cfg, s, earned, bigCount) {
	const SQ = cfg.SIDE_QUESTS;
	const hatchery = SQ.hatchery;
	while (s.hatcheryStep < hatchery.at.length && s.opened + 1 >= hatchery.at[s.hatcheryStep]) {
		s.money += earned * 60 * hatchery.minutes;
		s.sideAt[`Hatchery ${hatchery.at[s.hatcheryStep]} fish`] = s.t;
		s.hatcheryStep++;
	}
	while (s.oceanUnlocked && s.collectorStep < SQ.collector.length) {
		const q = SQ.collector[s.collectorStep];
		const found = q.species
			? q.species.some((type) => s.cells[`${type}:${q.variant}`])
			: q.variant
				? s.variantsFound[q.variant]
				: s.cellsCount >= q.cells;
		if (!found) break;
		s.ocean += q.ocean || 0;
		s.money += earned * 60 * (q.minutes || 0);
		s.sideAt[`Collector ${q.variant ? q.variant + (q.label ? " " + q.label : "") : q.cells + " cells"}`] = s.t;
		s.collectorStep++;
	}
	let oceanLine = oceanLines.get(SQ); // a list (one entry before V1.2)
	if (!oceanLine) oceanLines.set(SQ, (oceanLine = [].concat(SQ.ocean)));
	while (s.oceanLineStep < oceanLine.length && s.released >= oceanLine[s.oceanLineStep].releases) {
		s.money += earned * 60 * oceanLine[s.oceanLineStep].minutes;
		s.sideAt[`Ocean ${oceanLine[s.oceanLineStep].releases} released`] = s.t;
		s.oceanLineStep++;
	}
	const bigCatch = SQ.bigCatch || [];
	while (s.oceanUnlocked && s.bigCatchStep < bigCatch.length) {
		const q = bigCatch[s.bigCatchStep];
		const done = q.count ? bigCount(q.size) >= q.count : s.bestSize >= q.size;
		if (!done) break;
		s.money += earned * 60 * (q.minutes || 0);
		s.ocean += q.ocean || 0;
		s.sideAt[`Big Catch ${q.count ? q.count + " x " : ""}+${q.size}`] = s.t;
		s.bigCatchStep++;
	}
}

/**
 * The Ocean milestones reached (reported), and the ones that change the game, claimed at once (Ocean Points are never
 * spent): tank capacity, incubators per egg type, hatch time (the Water Hen).
 */
function claimOceanMilestones(cfg, s) {
	for (const m of cfg.OCEAN_MILESTONES) if (s.oceanAt[m] === undefined && s.ocean >= m) s.oceanAt[m] = s.t;
	for (const c of cfg.CAPACITY) {
		if (s.capacityAt[c.capacity] === undefined && s.ocean >= c.points) {
			s.capacityAt[c.capacity] = s.t;
			s.capacity = Math.max(s.capacity, c.capacity);
		}
	}
	for (const c of cfg.INCUBATORS) if (s.ocean >= c.points) s.incubators = Math.max(s.incubators, c.count);
	for (const h of cfg.HATCH) if (s.ocean >= h.points) s.hatchMult = Math.min(s.hatchMult, cfg.P.hatchMult ?? h.mult);
}

module.exports = { claimSideQuests, claimOceanMilestones };
