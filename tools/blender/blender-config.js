// Where Blender and its MCP server live on this machine, shared by tools/blender/setup.js, the MCP launcher
// (tools/mcp/blender.js) and npm run doctor. Paths come from workspace.local.json (blenderPath, blenderMcpPort,
// uvPath), else the default install folder of each OS. Never print anything here: the launcher's stdout is MCP.
const fs = require("fs");
const os = require("os");
const path = require("path");
const config = require("../local-config");

// Blender LTS pinned for the project (the same on every machine) and the official Blender Lab MCP release
// (https://www.blender.org/lab/mcp-server/): the add-on runs a socket bridge inside Blender, the MCP server (Python,
// run by uv) talks to it. Both files are checked against these hashes before anything is installed.
const BLENDER_VERSION = "5.2";
const MCP_VERSION = "1.0.3";
const MCP_RELEASE = `https://projects.blender.org/lab/blender_mcp/releases/download/v${MCP_VERSION}`;
const MCP_FILES = {
	addon: {
		name: `mcp-${MCP_VERSION}.zip`,
		sha256: "a7a9da816192502e5a0a202a396444e266b47d8fc4f74ad4698048bd43040707",
	},
	server: {
		name: `blender-${MCP_VERSION}.mcpb`,
		sha256: "d6fe04dd17767f7c7fb452142f1f0e6787db575db49f3976a166142683b5b97e",
	},
};
// The add-on's module name once installed in Blender's local "user_default" extension repository.
const ADDON_MODULE = "bl_ext.user_default.mcp";

// Downloads and the unpacked MCP server (git-ignored, re-created by npm run blender-setup).
const VENDOR_DIR = path.join(config.ROOT, "tools", "blender", "vendor");
const SERVER_DIR = path.join(VENDOR_DIR, `mcp-server-${MCP_VERSION}`);

function defaultBlenderPath() {
	if (process.platform === "darwin") return "/Applications/Blender.app/Contents/MacOS/Blender";
	if (process.platform === "win32") {
		const programFiles = process.env.ProgramFiles || "C:/Program Files";
		return path.join(programFiles, "Blender Foundation", `Blender ${BLENDER_VERSION}`, "blender.exe");
	}
	return "blender";
}

// uv from uvPath, the PATH, or its usual install folders: an app opened from the Dock / Start menu (VS Code, so the
// MCP launcher) doesn't get the shell's PATH, Homebrew's /opt/homebrew/bin included on macOS.
function uvPath() {
	const override = config.get("uvPath");
	if (override) return override;
	const exe = process.platform === "win32" ? "uv.exe" : "uv";
	const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
	dirs.push(path.join(os.homedir(), ".local", "bin"), path.join(os.homedir(), ".cargo", "bin"));
	if (process.platform === "darwin") dirs.push("/opt/homebrew/bin", "/usr/local/bin");
	if (process.platform === "win32" && process.env.LOCALAPPDATA) {
		dirs.push(path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links"));
	}
	const found = dirs.map((d) => path.join(d, exe)).find((p) => fs.existsSync(p));
	return found || "uv";
}

module.exports = {
	BLENDER_VERSION,
	MCP_VERSION,
	MCP_RELEASE,
	MCP_FILES,
	ADDON_MODULE,
	VENDOR_DIR,
	SERVER_DIR,
	blenderPath: () => config.get("blenderPath", defaultBlenderPath()),
	mcpPort: () => Number(config.get("blenderMcpPort", 9876)),
	uvPath,
};
