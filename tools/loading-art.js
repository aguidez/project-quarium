// Loading screen artwork, made from the owner's picture design/ui/loading/LoadingArt.png (1672 x 941).
// Usage: node tools/loading-art.js
//   design/ui/loading/LoadingBackground.png  the picture at 1024 px wide (the size Roblox keeps)
//   design/ui/loading/LoadingLogo.png         the "Project: Quarium" logo cut out at full resolution, as a sheet:
//                                             top half = the logo as painted (full), bottom half = its letters empty
//   design/previews/loading-screen-mockup.png the screen at 62 %, as the game draws it
// The game lays the logo sheet exactly over the logo of the background (LOGO_RECT, printed here, in source pixels)
// and reveals the full logo from the bottom up, slice by slice (src/first/LoadingScreen.client.ts).
// A new picture: run this again and copy the printed LOGO_RECT and ART_SIZE into LoadingScreen.client.ts.
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "design", "ui", "loading");
const UPLOAD_WIDTH = 1024;

/** Where to look for the logo: below the tank's top rail, between the fish. */
const LOGO_SEARCH = { x0: 400, x1: 1300, y0: 90, y1: 425 };
/** The logo's outline: a very dark navy (the water, the rails and the fish are all lighter). */
const isOutline = (r, g, b) => r < 70 && g < 78 && b < 190;
/** Empty letters: dark glass, keeping a trace of the letters' shading. */
const EMPTY_DARK = [14, 44, 102];
const EMPTY_LIGHT = [58, 104, 168];

const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;

async function main() {
	const art = await Jimp.read(path.join(DIR, "LoadingArt.png"));
	const W = art.bitmap.width;
	const H = art.bitmap.height;
	const src = art.bitmap.data;
	const at = (x, y) => (y * W + x) * 4;

	// The logo: everything enclosed by its outline (flood the water from the search box's border)
	const S = LOGO_SEARCH;
	const sw = S.x1 - S.x0;
	const sh = S.y1 - S.y0;
	const outside = new Uint8Array(sw * sh);
	const stack = [];
	for (let x = 0; x < sw; x++) stack.push(x, 0, x, sh - 1);
	for (let y = 0; y < sh; y++) stack.push(0, y, sw - 1, y);
	while (stack.length) {
		const y = stack.pop();
		const x = stack.pop();
		if (x < 0 || y < 0 || x >= sw || y >= sh) continue;
		const k = y * sw + x;
		const i = at(S.x0 + x, S.y0 + y);
		if (outside[k] || isOutline(src[i], src[i + 1], src[i + 2])) continue;
		outside[k] = 1;
		stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
	}
	// Keep the big pieces only (the two words), not a fish's dark edge caught at the border
	const label = new Int32Array(sw * sh).fill(-1);
	const sizes = [];
	for (let k = 0; k < sw * sh; k++) {
		if (outside[k] || label[k] >= 0) continue;
		const id = sizes.length;
		let size = 0;
		const q = [k];
		label[k] = id;
		while (q.length) {
			const p = q.pop();
			size++;
			const px = p % sw;
			const py = (p - px) / sw;
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const nx = px + dx;
				const ny = py + dy;
				if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
				const n = ny * sw + nx;
				if (!outside[n] && label[n] < 0) {
					label[n] = id;
					q.push(n);
				}
			}
		}
		sizes.push(size);
	}
	const keep = sizes.map((s) => s > 8000);
	console.log("logo pieces (px):", sizes.filter((s) => s > 200).sort((a, b) => b - a).join(", "));
	const mask = new Float32Array(W * H);
	let lx0 = W;
	let ly0 = H;
	let lx1 = 0;
	let ly1 = 0;
	for (let y = 0; y < sh; y++)
		for (let x = 0; x < sw; x++) {
			const l = label[y * sw + x];
			if (l < 0 || !keep[l]) continue;
			const gx = S.x0 + x;
			const gy = S.y0 + y;
			mask[gy * W + gx] = 1;
			lx0 = Math.min(lx0, gx);
			ly0 = Math.min(ly0, gy);
			lx1 = Math.max(lx1, gx);
			ly1 = Math.max(ly1, gy);
		}

	// The sheet: soft edge (3 x 3 average of the mask: the edge lies on the outline, the same in both halves)
	const PAD = 3;
	const rect = { x: lx0 - PAD, y: ly0 - PAD, w: lx1 - lx0 + 1 + PAD * 2, h: ly1 - ly0 + 1 + PAD * 2 };
	const alphaAt = (x, y) => {
		let s = 0;
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += mask[(y + dy) * W + (x + dx)] || 0;
		return s / 9;
	};
	const sheet = new Jimp(rect.w, rect.h * 2, 0x00000000);
	for (let y = 0; y < rect.h; y++)
		for (let x = 0; x < rect.w; x++) {
			const i = at(rect.x + x, rect.y + y);
			const a = Math.round(alphaAt(rect.x + x, rect.y + y) * 255);
			const r = src[i];
			const g = src[i + 1];
			const b = src[i + 2];
			sheet.bitmap.data.set([r, g, b, a], (y * rect.w + x) * 4);
			const fill = Math.max(0, Math.min(1, (g - 80) / 70)); // 0 on the outline, 1 inside the letters
			const shade = Math.pow(lum(r, g, b) / 255, 2.2);
			const e = EMPTY_DARK.map((d, c) => d + (EMPTY_LIGHT[c] - d) * shade);
			const mix = (v, w) => Math.round(v + (w - v) * fill);
			sheet.bitmap.data.set([mix(r, e[0]), mix(g, e[1]), mix(b, e[2]), a], ((y + rect.h) * rect.w + x) * 4);
		}
	console.log(`ART_SIZE ${W} x ${H}; LOGO_RECT { x: ${rect.x}, y: ${rect.y}, w: ${rect.w}, h: ${rect.h} }; sheet ${rect.w} x ${rect.h * 2}`);

	const background = art.clone().resize(UPLOAD_WIDTH, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
	await background.writeAsync(path.join(DIR, "LoadingBackground.png"));
	await sheet.writeAsync(path.join(DIR, "LoadingLogo.png"));
	console.log("wrote LoadingBackground.png, LoadingLogo.png");

	// Preview at 62 %, the way the game draws it (the background at its uploaded size, a wave over 40 slices)
	const preview = background.clone().resize(W, H, Jimp.RESIZE_BICUBIC);
	const progress = 0.62;
	const SLICES = 40;
	const WAVE = 0.03;
	for (let x = 0; x < rect.w; x++) {
		const slice = Math.floor((x / rect.w) * SLICES);
		const level = 1 + WAVE - progress * (1 + WAVE * 3) + Math.sin((slice / SLICES) * 1.6 * Math.PI * 2) * WAVE;
		const cut = Math.round(level * rect.h);
		for (let y = 0; y < rect.h; y++) {
			const k = ((y >= cut ? y : y + rect.h) * rect.w + x) * 4;
			const a = sheet.bitmap.data[k + 3] / 255;
			const j = at(rect.x + x, rect.y + y);
			for (let c = 0; c < 3; c++) preview.bitmap.data[j + c] = Math.round(preview.bitmap.data[j + c] * (1 - a) + sheet.bitmap.data[k + c] * a);
		}
	}
	await preview.writeAsync(path.join(ROOT, "design", "previews", "loading-screen-mockup.png"));
	console.log("wrote design/previews/loading-screen-mockup.png");
}

main();
