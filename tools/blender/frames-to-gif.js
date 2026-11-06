// Turns the PNG frames rendered by tools/blender/preview_swim.py into a looping GIF for the owner (opens in VS Code).
// Usage: node tools/blender/frames-to-gif.js <framesDir> <out.gif> [fps=24]
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");
const { GifFrame, GifUtil, BitmapImage } = require("gifwrap");

async function main() {
	const [dir, out, fpsArg] = process.argv.slice(2);
	if (!dir || !out) {
		console.error("Usage: node tools/blender/frames-to-gif.js <framesDir> <out.gif> [fps=24]");
		process.exit(1);
	}
	const delay = Math.round(100 / Number(fpsArg || 24)); // GIF delays are in 1/100 s
	const files = fs.readdirSync(dir).filter((f) => /^frame_\d+\.png$/.test(f)).sort();
	if (files.length === 0) throw new Error(`no frame_*.png in ${dir}`);
	const frames = [];
	for (const file of files) {
		const image = await Jimp.read(path.join(dir, file));
		frames.push(new GifFrame(new BitmapImage(image.bitmap), { delayCentisecs: delay }));
	}
	GifUtil.quantizeDekker(frames, 256);
	await GifUtil.write(out, frames, { loops: 0 });
	console.log(`wrote ${out} (${frames.length} frames)`);
}

main().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
