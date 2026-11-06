// Turns a texture pulled out of Studio (tools/blender/studio/export_fish.luau → tools/obj-receiver.js <Name>.b64:
// "W H [R G B]\n" + base64 RGBA) into a PNG, for the Blender previews only (never uploaded). R G B, the template's
// SurfaceAppearance tint, goes to <Name>.json ({ "tint": [r, g, b] }), read by tools/blender/convert_fish.py.
// Usage: node tools/blender/rgba-to-png.js <in.b64> [out.png]   (the .b64 is deleted once converted)
const fs = require("fs");
const Jimp = require("jimp");

const input = process.argv[2];
if (!input) {
	console.error("Usage: node tools/blender/rgba-to-png.js <in.b64> [out.png]");
	process.exit(1);
}
const output = process.argv[3] || input.replace(/\.b64$/, ".png");
const text = fs.readFileSync(input, "utf8");
const newline = text.indexOf("\n");
const [width, height, ...tint] = text.slice(0, newline).split(" ").map(Number);
const data = Buffer.from(text.slice(newline + 1), "base64");
if (data.length !== width * height * 4) {
	console.error(`expected ${width * height * 4} bytes for ${width}x${height}, got ${data.length}`);
	process.exit(1);
}
new Jimp({ data, width, height }).writeAsync(output).then(() => {
	if (tint.length === 3) {
		const side = output.replace(/_color\.png$|\.png$/, ".json");
		fs.writeFileSync(side, JSON.stringify({ tint }, null, "\t") + "\n");
	}
	fs.rmSync(input);
	console.log(`wrote ${output} (${width}x${height})${tint.length === 3 ? `, tint ${tint.join(" ")}` : ""}`);
});
