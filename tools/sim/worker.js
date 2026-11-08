// A worker thread of pool.js: plays the players it is sent and sends their states back.
const { parentPort, workerData } = require("worker_threads");
const { buildConfig } = require("./config");
const { newPlayer, play } = require("./player");

const cfg = buildConfig(workerData);
parentPort.on("message", ({ indices, states, stopAt }) => {
	const out = indices.map((i, k) => {
		const s = play(cfg, states[k] ?? newPlayer(cfg, i), stopAt);
		parentPort.postMessage({ played: 1 });
		return s;
	});
	parentPort.postMessage({ indices, states: out });
});
