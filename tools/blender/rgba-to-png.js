// Turns a texture pulled out of Studio (tools/obj-receiver.js <Name>.b64: "W H\n" + base64 RGBA) into a PNG, for the
// Blender previews only (never uploaded). Usage: node tools/blender/rgba-to-png.js <in.b64> [out.png]
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
const [width, height] = text.slice(0, newline).split(" ").map(Number);
const data = Buffer.from(text.slice(newline + 1), "base64");
if (data.length !== width * height * 4) {
	console.error(`expected ${width * height * 4} bytes for ${width}x${height}, got ${data.length}`);
	process.exit(1);
}
new Jimp({ data, width, height }).writeAsync(output).then(() => console.log(`wrote ${output} (${width}x${height})`));
