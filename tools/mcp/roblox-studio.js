// Roblox Studio MCP launcher used by .mcp.json, on any OS. Finds the StudioMCP server that Roblox Studio installs
// (Studio > Assistant settings > enable MCP), or the path set as robloxStudioMcp in workspace.local.json.
// Nothing may be printed on stdout here: it is the MCP stdio channel.
const fs = require("fs");
const os = require("os");
const path = require("path");
const config = require("../local-config");
const { runStdio, fail } = require("./run-stdio");

function candidates() {
	const override = config.get("robloxStudioMcp");
	if (override) return [override];
	if (process.platform === "win32") {
		// mcp.bat is written by Studio and follows its updates (the exe lives in a versioned folder).
		return [path.join(process.env.LOCALAPPDATA || "", "Roblox", "mcp.bat")];
	}
	if (process.platform === "darwin") {
		return ["/Applications", path.join(os.homedir(), "Applications")].map((dir) =>
			path.join(dir, "RobloxStudio.app", "Contents", "MacOS", "StudioMCP"),
		);
	}
	return [];
}

const found = candidates().find((p) => fs.existsSync(p));
if (!found) {
	fail(
		"Roblox Studio MCP server not found. Install Roblox Studio and enable its MCP server, " +
			"or set robloxStudioMcp in workspace.local.json (see SETUP.md).",
	);
}
runStdio(found, process.argv.slice(2));
