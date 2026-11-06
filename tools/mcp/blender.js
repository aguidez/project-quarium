// Blender MCP launcher used by .mcp.json, on any OS (official Blender Lab MCP, installed by npm run blender-setup).
// Starts Blender unless its add-on's bridge is already listening (the add-on auto-starts it ~1 s after launch),
// waits for the port (up to ~60 s: the first launch is slow), then runs the MCP server with uv on stdio.
// Paths come from workspace.local.json (blenderPath, blenderMcpPort, uvPath).
// Nothing may be printed on stdout here: it is the MCP stdio channel.
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const bl = require("../blender/blender-config");
const { runStdio, fail } = require("./run-stdio");

const blender = bl.blenderPath();
const port = bl.mcpPort();

if (!fs.existsSync(bl.SERVER_DIR)) fail("Blender MCP server not installed: run npm run blender-setup (see SETUP.md).");

function isListening() {
	return new Promise((resolve) => {
		const socket = net.createConnection({ host: "127.0.0.1", port });
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
	if (!(await isListening()) && fs.existsSync(blender)) {
		spawn(blender, [], { detached: true, stdio: "ignore" }).unref();
		for (let i = 0; i < 240 && !(await isListening()); i++) {
			await new Promise((r) => setTimeout(r, 250));
		}
	}
	const env = {
		...process.env,
		BLENDER_MCP_HOST: "127.0.0.1",
		BLENDER_MCP_PORT: String(port),
		// Used by the server's tools that run `blender --background` on a saved .blend.
		BLENDER_PATH: blender,
	};
	runStdio(bl.uvPath(), ["run", "--directory", bl.SERVER_DIR, "--no-sync", "blender-mcp"], env);
}

main().catch((err) => fail(err.message));
