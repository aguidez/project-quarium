// Installs the official Blender Lab MCP (add-on + MCP server) on this machine, on any OS. Run with Blender closed:
//   npm run blender-setup
// 1. downloads the pinned release files into tools/blender/vendor/ and checks their SHA-256;
// 2. installs and enables the add-on in Blender's "user_default" repository (Blender CLI, background);
// 3. allows Blender's online access (the add-on refuses to open its socket without it), binds the bridge to
//    127.0.0.1 on blenderMcpPort, auto-start on, and saves the preferences;
// 4. unpacks the MCP server and installs its Python packages with uv (uv sync).
// Running it again re-installs the same version (safe).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const bl = require("./blender-config");

function step(message) {
	console.log(`\n== ${message}`);
}

function fail(message) {
	console.error(`\nFAIL  ${message}`);
	process.exit(1);
}

function run(cmd, args, options = {}) {
	return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

function blenderIsRunning() {
	try {
		if (process.platform === "win32") {
			return /blender\.exe/i.test(run("tasklist", ["/FI", "IMAGENAME eq blender.exe", "/NH"]));
		}
		run("pgrep", ["-x", "Blender"]);
		return true;
	} catch {
		return false;
	}
}

async function download(file) {
	const target = path.join(bl.VENDOR_DIR, file.name);
	if (!fs.existsSync(target)) {
		const res = await fetch(`${bl.MCP_RELEASE}/${file.name}`, { headers: { "User-Agent": "project-quarium-setup" } });
		if (!res.ok) fail(`download of ${file.name}: HTTP ${res.status}`);
		fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
	}
	const hash = crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
	if (hash !== file.sha256) {
		fs.rmSync(target);
		fail(`${file.name}: SHA-256 ${hash} does not match the pinned ${file.sha256} (file removed)`);
	}
	console.log(`OK   ${file.name} (SHA-256 checked)`);
	return target;
}

// Python run inside Blender (background) once the add-on is installed: preferences of this machine's Blender.
function prefsScript(port) {
	return [
		"import addon_utils, bpy",
		`addon_utils.enable("${bl.ADDON_MODULE}", default_set=True, persistent=True)`,
		"prefs = bpy.context.preferences",
		"prefs.system.use_online_access = True",
		`addon = prefs.addons["${bl.ADDON_MODULE}"].preferences`,
		'addon.host = "127.0.0.1"',
		`addon.port = ${port}`,
		"addon.use_autostart = True",
		"bpy.ops.wm.save_userpref()",
		'print("QUARIUM_PREFS_OK", addon.host, addon.port)',
	].join("\n");
}

async function main() {
	const blender = bl.blenderPath();
	const port = bl.mcpPort();

	step("Blender");
	if (!fs.existsSync(blender)) fail(`Blender not found at ${blender}: install Blender ${bl.BLENDER_VERSION} LTS or set blenderPath in workspace.local.json`);
	const version = (run(blender, ["--version"]).match(/Blender (\d+\.\d+)\S*/) || [])[0] || "unknown version";
	console.log(`OK   ${version} (${blender})`);
	if (!version.includes(` ${bl.BLENDER_VERSION}`)) console.log(`WARN the project pins Blender ${bl.BLENDER_VERSION} LTS`);
	if (blenderIsRunning()) fail("Blender is open: close it first (it would overwrite the new preferences when it quits)");

	step(`Blender Lab MCP ${bl.MCP_VERSION}: downloads`);
	fs.mkdirSync(bl.VENDOR_DIR, { recursive: true });
	const addonZip = await download(bl.MCP_FILES.addon);
	const serverBundle = await download(bl.MCP_FILES.server);

	step("Add-on: install and enable");
	const background = ["--background", "-noaudio", "--online-mode"];
	process.stdout.write(
		run(blender, [...background, "--command", "extension", "install-file", "-r", "user_default", "-e", addonZip]),
	);

	step(`Add-on: preferences (online access, 127.0.0.1:${port}, auto start)`);
	const out = run(blender, [...background, "--python-expr", prefsScript(port)]);
	if (!out.includes("QUARIUM_PREFS_OK")) fail(`the preferences were not saved:\n${out}`);
	console.log("OK   preferences saved");

	step("MCP server: unpack and install its Python packages (uv)");
	fs.rmSync(bl.SERVER_DIR, { recursive: true, force: true });
	fs.mkdirSync(bl.SERVER_DIR, { recursive: true });
	// The .mcpb bundle is a zip; tar (bsdtar) reads zips on macOS and on Windows 10+.
	run("tar", ["-xf", serverBundle, "-C", bl.SERVER_DIR]);
	try {
		// --no-editable: the server's code is copied into the venv instead of being found through a .pth file. On a
		// Mac whose Documents folder is synced by iCloud Drive, iCloud flags `.venv` hidden, and Python 3.13+ skips
		// hidden .pth files ("No module named 'blmcp'").
		run(bl.uvPath(), ["sync", "--no-editable", "--directory", bl.SERVER_DIR], { stdio: "inherit" });
	} catch {
		fail("uv sync failed: install uv (https://docs.astral.sh/uv/) or set uvPath in workspace.local.json");
	}

	console.log("\nReady. Start Blender (or let the Blender MCP launcher start it), then /mcp in Claude Code.");
}

main().catch((err) => fail(err.message));
