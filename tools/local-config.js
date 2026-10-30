// Machine-specific settings of the workspace (install paths of FigCraft, Roblox Studio...), read from
// workspace.local.json at the repo root (git-ignored; template: workspace.local.example.json). An environment
// variable of the same name in UPPER_SNAKE_CASE wins over the file (FIGCRAFT_DIR, ROBLOX_STUDIO_MCP...).
// Never print anything here: the MCP launchers use stdout as their protocol channel.
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "workspace.local.json");

function readFile() {
	if (!fs.existsSync(FILE)) return {};
	try {
		return JSON.parse(fs.readFileSync(FILE, "utf8"));
	} catch (err) {
		throw new Error(`workspace.local.json is not valid JSON: ${err.message}`);
	}
}

const fileConfig = readFile();

function envName(key) {
	return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}

/** The value of `key` (env var first, then workspace.local.json), or `fallback`. Strings starting with "~" are expanded. */
function get(key, fallback) {
	const fromEnv = process.env[envName(key)];
	let value = fromEnv !== undefined && fromEnv !== "" ? fromEnv : fileConfig[key];
	if (value === undefined || value === null || value === "") return fallback;
	if (typeof value === "string" && value.startsWith("~")) value = path.join(os.homedir(), value.slice(1));
	return value;
}

/** The fonts folder of the local Roblox Studio install (holds LuckiestGuy-Regular.ttf, FredokaOne-Regular.ttf). */
function robloxFontsDir() {
	const override = get("robloxFontsDir");
	if (override) return override;
	const candidates = [];
	if (process.platform === "win32" && process.env.LOCALAPPDATA) {
		const versions = path.join(process.env.LOCALAPPDATA, "Roblox", "Versions");
		if (fs.existsSync(versions)) {
			for (const d of fs.readdirSync(versions)) candidates.push(path.join(versions, d, "content", "fonts"));
		}
	} else if (process.platform === "darwin") {
		for (const app of ["/Applications", path.join(os.homedir(), "Applications")]) {
			candidates.push(path.join(app, "RobloxStudio.app", "Contents", "Resources", "content", "fonts"));
		}
	}
	const found = candidates.filter((d) => fs.existsSync(path.join(d, "LuckiestGuy-Regular.ttf")));
	if (found.length === 0) {
		throw new Error("Roblox fonts not found: install Roblox Studio or set robloxFontsDir in workspace.local.json");
	}
	return found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

module.exports = { ROOT, FILE, get, robloxFontsDir };
