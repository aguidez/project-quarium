// Checks that this machine has what the workspace needs (SETUP.md): Node, the npm packages, Rojo at the version
// of aftman.toml, the machine config and the two MCP servers. Run: npm run doctor
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const config = require("./local-config");

const ROOT = config.ROOT;
let failures = 0;

function report(ok, label, hint) {
	if (!ok) failures++;
	console.log(`${ok ? " OK " : "FAIL"}  ${label}${!ok && hint ? `\n        -> ${hint}` : ""}`);
}

function warn(label, hint) {
	console.log(`WARN  ${label}${hint ? `\n        -> ${hint}` : ""}`);
}

function run(cmd, args) {
	try {
		return execFileSync(cmd, args, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			shell: process.platform === "win32",
		}).trim();
	} catch {
		return undefined;
	}
}

// Node
const major = Number(process.versions.node.split(".")[0]);
report(major >= 20, `Node ${process.versions.node} (>= 20)`, "install Node.js LTS from https://nodejs.org");

// npm packages
report(fs.existsSync(path.join(ROOT, "node_modules", "roblox-ts")), "npm packages installed", "run: npm install");

// Rojo, at the version pinned in aftman.toml (aftman or rokit both read it)
const wanted = (fs.readFileSync(path.join(ROOT, "aftman.toml"), "utf8").match(/^rojo\s*=\s*"[^@]+@([^"]+)"/m) || [])[1];
const rojo = run("rojo", ["--version"]);
if (!rojo) report(false, "Rojo on the PATH", "install aftman or rokit, then run: aftman install (or rokit install)");
else
	report(
		!wanted || rojo.includes(wanted),
		`${rojo} (aftman.toml wants ${wanted})`,
		"run: aftman install (or rokit install)",
	);

// Git line endings: .gitattributes forces LF, autocrlf only adds noise on Windows
const autocrlf = run("git", ["config", "core.autocrlf"]);
if (autocrlf === "true")
	warn("git core.autocrlf=true", ".gitattributes already keeps LF; optional: git config core.autocrlf false");

// Machine config
if (!fs.existsSync(config.FILE)) {
	warn(
		"workspace.local.json missing (only needed for FigCraft or non-standard installs)",
		"copy workspace.local.example.json to workspace.local.json",
	);
}

// Roblox Studio MCP
const studioMcp =
	config.get("robloxStudioMcp") ||
	(process.platform === "win32"
		? path.join(process.env.LOCALAPPDATA || "", "Roblox", "mcp.bat")
		: process.platform === "darwin"
			? "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP"
			: undefined);
report(
	!!studioMcp && fs.existsSync(studioMcp),
	`Roblox Studio MCP server (${studioMcp || "unknown on this OS"})`,
	"install Roblox Studio, enable its MCP server, or set robloxStudioMcp in workspace.local.json",
);

// Roblox fonts (only for design/ui/redesign-v2.build.js)
try {
	config.robloxFontsDir();
	report(true, "Roblox fonts (FigCraft V2 build script)");
} catch (err) {
	warn(
		"Roblox fonts not found (only needed by design/ui/redesign-v2.build.js)",
		"set robloxFontsDir in workspace.local.json",
	);
}

// FigCraft (optional: UI design)
const exe = process.platform === "win32" ? ".exe" : "";
const figDir = config.get("figcraftDir");
const figCli = config.get("figcraftCli", figDir && path.join(figDir, `figcraft-cli${exe}`));
if (figCli && fs.existsSync(figCli)) report(true, `FigCraft CLI (${figCli})`);
else warn("FigCraft not configured (optional, UI design only)", "set figcraftDir in workspace.local.json");

// Open Cloud key (optional: the real players' statistics, npm run stats)
if (config.get("robloxOpenCloudKey")) report(true, "Open Cloud key set (npm run stats)");
else warn("Open Cloud key not set (optional, players' statistics only)", "set robloxOpenCloudKey in workspace.local.json");

console.log(failures === 0 ? "\nReady." : `\n${failures} problem(s) to fix, see SETUP.md.`);
process.exit(failures === 0 ? 0 : 1);
