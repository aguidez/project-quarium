// Headless Blender runner (no window, no MCP): `blender --background --python <script> -- <args>` with the
// project's pinned Blender (tools/blender/blender-config.js: blenderPath in workspace.local.json, else the default
// install folder). Usage:
//   npm run blender -- <script.py> [args...]      any script, a path from the repo root
//   npm run blender -- convert <Fish> [<Fish>...]  the bone pipeline's Blender step for a batch (batch_convert.py)
// Blender's own output goes through; the exit code is the script's (a Python error exits 1).
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const config = require("../local-config");
const bl = require("./blender-config");

const SHORTCUTS = { convert: path.join("tools", "blender", "batch_convert.py") };

const [first, ...rest] = process.argv.slice(2);
if (!first) {
	console.error("Usage: npm run blender -- <script.py> [args...]   |   npm run blender -- convert <Fish> [<Fish>...]");
	process.exit(2);
}
const script = path.resolve(config.ROOT, SHORTCUTS[first] || first);
if (!fs.existsSync(script)) {
	console.error(`No such script: ${script}`);
	process.exit(2);
}
const blender = bl.blenderPath();
if (!fs.existsSync(blender)) {
	console.error(`Blender not found at ${blender}: install Blender ${bl.BLENDER_VERSION} LTS or set blenderPath in workspace.local.json`);
	process.exit(2);
}
const result = spawnSync(blender, ["--background", "--python-exit-code", "1", "--python", script, "--", ...rest], {
	cwd: config.ROOT,
	stdio: "inherit",
});
process.exit(result.status === null ? 1 : result.status);
