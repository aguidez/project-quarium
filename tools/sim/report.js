// The simulator's report (copied into BALANCE.md): median / p10 / p90 of each step over every player, species
// discovery, Ocean milestones, income and Ocean Points per checkpoint, side quests.
// `partial`: a slice of the timeline only (`--segment`): the steps no player reached yet are left out.

function pct(arr, p) {
	const s = arr.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b);
	if (s.length === 0) return null;
	return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}
const min = (x) =>
	x === null
		? "never"
		: x >= 5400
			? `${Math.floor(Math.round(x / 60) / 60)}h${String(Math.round(x / 60) % 60).padStart(2, "0")}`
			: (x / 60).toFixed(1) + "min";
const short12 = (n) =>
	n >= 1e12
		? (n / 1e12).toFixed(1) + "T"
		: n >= 1e9
			? (n / 1e9).toFixed(1) + "B"
			: n >= 1e6
				? (n / 1e6).toFixed(1) + "M"
				: n >= 1e3
					? (n / 1e3).toFixed(1) + "k"
					: String(Math.round(n));
const short = (n) => (n >= 1e18 ? (n / 1e18).toFixed(1) + "Qi" : n >= 1e15 ? (n / 1e15).toFixed(1) + "Qa" : short12(n));

function report(cfg, runs, { partial = false, out = console.log } = {}) {
	const players = runs.length;
	const reached = (values) => !partial || values.some((x) => x !== null && x !== undefined);
	// a segment's report: a step only some players reached yet (its median is theirs only)
	const missing = (values) => {
		const n = values.filter((x) => x === null || x === undefined).length;
		return n ? `, ${partial ? "not yet" : "never"} ${n}/${players}` : "";
	};
	const line = (label, values) => {
		if (!reached(values)) return;
		out(`${label}: median ${min(pct(values, 0.5))}, p10 ${min(pct(values, 0.1))}, p90 ${min(pct(values, 0.9))}` + missing(values));
	};
	const species = Object.keys(cfg.FISH);
	const firstSix = (r) =>
		cfg.FIRST_SIX.every((k) => r.discovered[k] !== undefined)
			? Math.max(...cfg.FIRST_SIX.map((k) => r.discovered[k]))
			: null;
	const all = (r) => (Object.keys(r.discovered).length === species.length ? Math.max(...Object.values(r.discovered)) : null);
	cfg.REBIRTHS.forEach((_, n) =>
		line(
			`rebirth ${n + 1}`,
			runs.map((r) => r.rebirthAt[n] ?? null),
		),
	);
	line("first 6 species", runs.map(firstSix));
	line(`all ${species.length} species`, runs.map(all));
	line(
		"everything (all species and rebirths)",
		runs.map((r) =>
			all(r) === null || r.rebirthAt.length < cfg.REBIRTHS.length ? null : Math.max(all(r), ...r.rebirthAt),
		),
	);
	for (const c of cfg.CAPACITY)
		line(
			`${c.capacity} slots (${c.points} Ocean Points)`,
			runs.map((r) => r.capacityAt[c.capacity] ?? null),
		);
	out("species discovery (median, p10-p90):");
	for (const ft of species) {
		const values = runs.map((r) => r.discovered[ft] ?? null);
		if (!reached(values)) continue;
		out(`  ${ft}: ${min(pct(values, 0.5))} (${min(pct(values, 0.1))}-${min(pct(values, 0.9))})` + (partial ? missing(values) : ""));
	}
	for (const type of Object.keys(cfg.EASTER)) {
		const got = runs.filter((r) => r.easterAt !== null);
		out(
			`${type} (easter egg): hatched by ${got.length}/${players} players during the run` +
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
	const rebirthsDone = cfg.REBIRTHS.map((_, n) => n).filter((n) => reached(runs.map((r) => r.oceanAtRebirth[n])));
	out(
		"median Ocean Points right after each rebirth:",
		rebirthsDone
			.map((n) =>
				short(
					pct(
						runs.map((r) => r.oceanAtRebirth[n] ?? null),
						0.5,
					) || 0,
				),
			)
			.join(", "),
	);
	out(
		"median time to reach the Ocean milestones:",
		cfg.OCEAN_MILESTONES.filter((m) => reached(runs.map((r) => r.oceanAt[m])))
			.map(
				(m) =>
					`${short(m)} ${min(
						pct(
							runs.map((r) => r.oceanAt[m] ?? null),
							0.5,
						),
					)}`,
			)
			.join(", "),
	);
	out(
		partial ? "median Ocean Points at the end of the segment:" : "median Ocean Points at the end:",
		short(
			pct(
				runs.map((r) => r.ocean),
				0.5,
			),
		),
	);
	const checkpoints = cfg.P.checkpoints.map((m) => m * 60).filter((c) => reached(runs.map((r) => r.income[c])));
	if (checkpoints.length) {
		out(
			"median money collected per minute:",
			checkpoints
				.map(
					(c) =>
						`${min(c)} ${short(
							(pct(
								runs.map((r) => r.income[c] ?? null),
								0.5,
							) || 0) * 60,
						)}$`,
				)
				.join(", "),
		);
		out(
			"median Ocean Points:",
			checkpoints
				.map(
					(c) =>
						`${min(c)} ${short(
							pct(
								runs.map((r) => r.oceanAtCheckpoint[c] ?? null),
								0.5,
							) || 0,
						)}`,
				)
				.join(", "),
		);
		out(
			"median eggs opened:",
			checkpoints
				.map(
					(c) =>
						`${min(c)} ${
							pct(
								runs.map((r) => r.openedAt[c] ?? null),
								0.5,
							) || 0
						}`,
				)
				.join(", "),
		);
	}
	out("side quests (median, p10-p90):");
	const sideQuests = [...new Set(runs.flatMap((r) => Object.keys(r.sideAt)))];
	const median = (q) =>
		pct(
			runs.map((r) => r.sideAt[q] ?? null),
			0.5,
		);
	sideQuests.sort((a, b) => median(a) - median(b));
	for (const quest of sideQuests)
		line(
			`  ${quest}`,
			runs.map((r) => r.sideAt[quest] ?? null),
		);
}

module.exports = { report };
