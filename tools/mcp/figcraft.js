// FigCraft MCP launcher used by .mcp.json, on any OS. Starts the FigCraft app with its control channel unless it is
// already listening, waits (up to ~10 s) for the port, then runs `figcraft-cli mcp --attach <port>`.
// Paths come from workspace.local.json (figcraftDir, or figcraftApp / figcraftCli for exact paths).
// Nothing may be printed on stdout here: it is the MCP stdio channel.
const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");
const config = require("../local-config");
const { runStdio, fail } = require("./run-stdio");

const exe = process.platform === "win32" ? ".exe" : "";
const dir = config.get("figcraftDir");
const app = config.get("figcraftApp", dir && path.join(dir, `figcraft${exe}`));
const cli = config.get("figcraftCli", dir && path.join(dir, `figcraft-cli${exe}`));
const port = String(config.get("figcraftPort", 7979));

if (!cli || !fs.existsSync(cli)) {
	fail(`figcraft-cli not found (${cli || "no path"}): set figcraftDir in workspace.local.json (see SETUP.md).`);
}

const env = { ...process.env };
// Some GPUs crash FigCraft's default backend at startup (wgpu "Shader translation error" with DirectX): a backend
// set in workspace.local.json (e.g. "vulkan") is passed to both the app and the CLI.
const backend = config.get("wgpuBackend");
if (backend) env.WGPU_BACKEND = backend;

function isListening() {
	return new Promise((resolve) => {
		const socket = net.createConnection({ host: "127.0.0.1", port: Number(port) });
		socket.setTimeout(500);
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("timeout", () => {
			socket.destroy();
			resolve(false);
		});
		socket.once("error", () => resolve(false));
	});
}

async function main() {
	if (!(await isListening()) && app && fs.existsSync(app)) {
		spawn(app, ["--control", port], { detached: true, stdio: "ignore", env }).unref();
		for (let i = 0; i < 40 && !(await isListening()); i++) {
			await new Promise((r) => setTimeout(r, 250));
		}
	}
	runStdio(cli, ["mcp", "--attach", port], env);
}

main().catch((err) => fail(err.message));
