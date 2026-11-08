// Plays many players at once on the machine's cores (worker_threads), with a progress line on stderr.
// Each worker rebuilds the config from the same arguments (plan file, overrides, players, seed): only the players'
// states travel between the threads.
const os = require("os");
const path = require("path");
const { Worker } = require("worker_threads");
const { buildConfig } = require("./config");
const { newPlayer, play } = require("./player");

const defaultWorkers = () => Math.max(1, (os.availableParallelism?.() ?? os.cpus().length) - 1);

/** A progress line: "segment 2 (rebirth 3 → rebirth 6): 840/2000 players, 12 s, ~16 s left". */
function progress(label, total) {
	const start = Date.now();
	const tty = process.stderr.isTTY;
	let shownQuarter = 0;
	const text = (done) => {
		const s = (Date.now() - start) / 1000;
		const left = done > 0 && done < total ? `, ~${Math.ceil((s / done) * (total - done))} s left` : "";
		return `${label}: ${done}/${total} players, ${s.toFixed(0)} s${left}`;
	};
	return {
		update(done) {
			if (tty) process.stderr.write(`\r${text(done)}   `);
			else if (Math.floor((done / total) * 4) > shownQuarter) {
				shownQuarter = Math.floor((done / total) * 4);
				process.stderr.write(text(done) + "\n");
			}
		},
		end(done) {
			if (tty) process.stderr.write(`\r${text(done)}   \n`);
			return (Date.now() - start) / 1000;
		},
	};
}

/**
 * Plays every state (null = a new player of that index) until rebirth `stopAt` (null = the end). Returns the states,
 * in order.
 */
async function playAll({ cfgArgs, states, stopAt, workers = defaultWorkers(), label }) {
	const total = states.length;
	const bar = progress(label, total);
	const out = new Array(total);
	let done = 0;
	const todo = states.map((s, i) => i).filter((i) => states[i] && states[i].finished);
	for (const i of todo) out[i] = states[i]; // players already at the end: nothing to play
	done = todo.length;
	const pending = states.map((s, i) => i).filter((i) => !(states[i] && states[i].finished));
	if (workers <= 1 || pending.length < 40) {
		const cfg = buildConfig(cfgArgs);
		for (const i of pending) {
			out[i] = play(cfg, states[i] ?? newPlayer(cfg, i), stopAt);
			bar.update(++done);
		}
		return { states: out, seconds: bar.end(done) };
	}
	const chunk = Math.max(5, Math.ceil(pending.length / (workers * 12)));
	const tasks = [];
	for (let k = 0; k < pending.length; k += chunk) tasks.push(pending.slice(k, k + chunk));
	bar.update(done);
	await new Promise((resolve, reject) => {
		let running = 0;
		let failed = false;
		const pool = [];
		const next = (w) => {
			const task = tasks.shift();
			if (!task) {
				w.terminate();
				if (--running === 0) resolve();
				return;
			}
			w.postMessage({ indices: task, states: task.map((i) => states[i]), stopAt });
		};
		for (let n = 0; n < Math.min(workers, tasks.length); n++) {
			const w = new Worker(path.join(__dirname, "worker.js"), { workerData: cfgArgs });
			running++;
			pool.push(w);
			w.on("message", (msg) => {
				if (msg.played) {
					done += msg.played;
					bar.update(done);
					return;
				}
				msg.indices.forEach((i, k) => (out[i] = msg.states[k]));
				next(w);
			});
			w.on("error", (err) => {
				if (failed) return;
				failed = true;
				for (const p of pool) p.terminate();
				reject(err);
			});
			next(w);
		}
	});
	return { states: out, seconds: bar.end(done) };
}

module.exports = { playAll, defaultWorkers };
