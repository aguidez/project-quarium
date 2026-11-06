// Turns the PNG frames rendered by tools/blender/preview_swim.py into a looping GIF for the owner (opens in VS Code).
// Several frame folders make one sheet (a batch of species side by side, each tile labelled with its folder's fish
// name), so the owner approves a whole batch in one look.
// Usage: node tools/blender/frames-to-gif.js <out.gif> <framesDir...> [--fps 24] [--cols 3] [--tile 360]
// (--tile: width of a tile in a sheet, px; a single fish keeps its render size). Each frame is quantised on its own:
// all of a sheet's frames at once run Node out of memory.
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");
const { GifFrame, GifUtil, BitmapImage } = require("gifwrap");

function option(args, name, fallback) {
	const i = args.indexOf(name);
	if (i < 0) return fallback;
	const value = Number(args[i + 1]);
	args.splice(i, 2);
	return value;
}

async function main() {
	const args = process.argv.slice(2);
	const fps = option(args, "--fps", 24);
	const colsWanted = option(args, "--cols", 3);
	const tileWanted = option(args, "--tile", 360);
	const [out, ...dirs] = args;
	if (!out || dirs.length === 0) {
		console.error("Usage: node tools/blender/frames-to-gif.js <out.gif> <framesDir...> [--fps 24] [--cols 3] [--tile 360]");
		process.exit(1);
	}
	const cols = Math.min(colsWanted, dirs.length);
	const lists = dirs.map((dir) => fs.readdirSync(dir).filter((f) => /^frame_\d+\.png$/.test(f)).sort());
	const count = Math.min(...lists.map((list) => list.length));
	if (count === 0) throw new Error("no frame_*.png in one of the folders");
	const first = await Jimp.read(path.join(dirs[0], lists[0][0]));
	const tileW = dirs.length > 1 ? Math.min(tileWanted, first.bitmap.width) : first.bitmap.width;
	const tileH = Math.round((first.bitmap.height * tileW) / first.bitmap.width);
	const rows = Math.ceil(dirs.length / cols);
	const font = dirs.length > 1 ? await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE) : undefined;
	const names = dirs.map((dir) => path.basename(path.resolve(dir)).replace(/_frames.*$/, ""));
	const delay = Math.round(100 / fps); // GIF delays are in 1/100 s
	const frames = [];
	for (let f = 0; f < count; f++) {
		const sheet = new Jimp(tileW * cols, tileH * rows, 0x0d3850ff);
		for (let i = 0; i < dirs.length; i++) {
			const tile = await Jimp.read(path.join(dirs[i], lists[i][f]));
			if (tile.bitmap.width !== tileW) tile.resize(tileW, tileH);
			const x = (i % cols) * tileW;
			const y = Math.floor(i / cols) * tileH;
			sheet.composite(tile, x, y);
			if (font) sheet.print(font, x + 8, y + 6, names[i]);
		}
		const frame = new GifFrame(new BitmapImage(sheet.bitmap), { delayCentisecs: delay });
		GifUtil.quantizeDekker([frame], 256);
		frames.push(frame);
	}
	await GifUtil.write(out, frames, { loops: 0 });
	console.log(`wrote ${out} (${frames.length} frames, ${dirs.length} fish)`);
}

main().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
