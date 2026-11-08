// The Galaxy variant's look (V1.1.20), offline: turns a fish texture or sticker into a night-sky
// version that keeps the fish readable (its light and dark areas: eyes, stripes, fins) and sprinkles it with stars.
//   node tools/fish-galaxy.js texture <in.png> <out.png> [seed]   a species ColorMap (UV atlas): every pixel recoloured
//   node tools/fish-galaxy.js sticker <in.png> <out.png> [seed]   a sticker icon: the white outline and the shadow kept
// Where the textures come from: the Normal ColorMap of each species, fetched as a PNG from the public thumbnails API
// (thumbnails.roblox.com/v1/assets?assetIds=<id>&size=420x420&format=Png; Studio's HTTP is closed to local servers now).
// Moderation (CLAUDE.md §7): only colours and dots, no shape is added.
const Jimp = require(process.env.JIMP || "jimp");

// Night palette, from the darkest to the lightest tone of the fish (luminance)
const PALETTE = [
	[0.0, [6, 8, 30]],
	[0.25, [22, 24, 92]],
	[0.5, [62, 46, 168]],
	[0.72, [118, 96, 230]],
	[0.9, [178, 176, 255]],
	[1.0, [236, 236, 255]],
];
const NEBULA = [255, 96, 200]; // pink clouds
const NEBULA_2 = [70, 200, 255]; // cyan clouds

function lerp(a, b, t) {
	return a + (b - a) * t;
}
function paletteAt(l) {
	for (let i = 1; i < PALETTE.length; i++) {
		const [t1, c1] = PALETTE[i];
		const [t0, c0] = PALETTE[i - 1];
		if (l <= t1) {
			const k = (l - t0) / (t1 - t0);
			return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
		}
	}
	return PALETTE[PALETTE.length - 1][1];
}
// Deterministic random (a species always gets the same stars)
function rng(seed) {
	let s = seed >>> 0 || 1;
	return () => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		return ((s >>> 0) % 1e6) / 1e6;
	};
}
// Smooth value noise for the nebulae
function noise2(width, height, cell, rand) {
	const gw = Math.ceil(width / cell) + 2;
	const gh = Math.ceil(height / cell) + 2;
	const grid = new Float32Array(gw * gh).map(() => rand());
	const smooth = (t) => t * t * (3 - 2 * t);
	return (x, y) => {
		const gx = x / cell;
		const gy = y / cell;
		const x0 = Math.floor(gx);
		const y0 = Math.floor(gy);
		const tx = smooth(gx - x0);
		const ty = smooth(gy - y0);
		const v = (i, j) => grid[(j % gh) * gw + (i % gw)];
		return lerp(lerp(v(x0, y0), v(x0 + 1, y0), tx), lerp(v(x0, y0 + 1), v(x0 + 1, y0 + 1), tx), ty);
	};
}

async function galaxy(mode, input, output, seed = 7) {
	const image = await Jimp.read(input);
	const { width, height, data } = image.bitmap;
	const rand = rng(seed);
	const n1 = noise2(width, height, Math.max(width / 7, 8), rand);
	const n2 = noise2(width, height, Math.max(width / 4, 8), rand);
	const keep = new Uint8Array(width * height); // sticker outline / shadow pixels kept as they are
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
			if (a === 0) continue;
			const max = Math.max(r, g, b), min = Math.min(r, g, b);
			const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
			// A sticker's white outline (bright, grey) and its soft shadow (dark, half transparent) stay
			if (mode === "sticker" && ((l > 0.86 && max - min < 28) || a < 200)) {
				keep[y * width + x] = 1;
				continue;
			}
			let [nr, ng, nb] = paletteAt(Math.pow(l, 0.9));
			// Nebulae: soft pink and cyan clouds, stronger in the mid tones (never over the eyes' black or white)
			const mid = 1 - Math.abs(l - 0.5) * 2;
			const c1 = Math.max(0, n1(x, y) - 0.55) * 1.6 * mid;
			const c2 = Math.max(0, n2(x, y) - 0.6) * 1.4 * mid;
			nr = lerp(nr, NEBULA[0], c1 * 0.55);
			ng = lerp(ng, NEBULA[1], c1 * 0.55);
			nb = lerp(nb, NEBULA[2], c1 * 0.55);
			nr = lerp(nr, NEBULA_2[0], c2 * 0.45);
			ng = lerp(ng, NEBULA_2[1], c2 * 0.45);
			nb = lerp(nb, NEBULA_2[2], c2 * 0.45);
			data[i] = nr;
			data[i + 1] = ng;
			data[i + 2] = nb;
		}
	}
	// Stars: tiny dots, a few bigger ones with a soft cross (only on the recoloured body)
	const area = width * height;
	const count = Math.round(area * (mode === "sticker" ? 0.0034 : 0.0022));
	const plot = (x, y, strength) => {
		if (x < 0 || y < 0 || x >= width || y >= height) return;
		const p = y * width + x;
		const i = p * 4;
		if (keep[p] || data[i + 3] === 0) return;
		data[i] = lerp(data[i], 255, strength);
		data[i + 1] = lerp(data[i + 1], 255, strength);
		data[i + 2] = lerp(data[i + 2], 255, strength);
	};
	for (let k = 0; k < count; k++) {
		const x = Math.floor(rand() * width);
		const y = Math.floor(rand() * height);
		const big = rand() < (mode === "sticker" ? 0.22 : 0.12);
		plot(x, y, 1);
		if (big) {
			const reach = mode === "sticker" ? 2 : 3;
			for (let d = 1; d <= reach; d++) {
				const s = 0.75 * (1 - d / (reach + 1));
				plot(x + d, y, s);
				plot(x - d, y, s);
				plot(x, y + d, s);
				plot(x, y - d, s);
			}
		} else if (rand() < 0.5) {
			plot(x + 1, y, 0.5);
			plot(x, y + 1, 0.5);
		}
	}
	await image.writeAsync(output);
}

const [mode, input, output, seed] = process.argv.slice(2);
if (!["texture", "sticker"].includes(mode) || !input || !output) {
	console.log("usage: node tools/fish-galaxy.js texture|sticker <in.png> <out.png> [seed]");
	process.exit(1);
}
galaxy(mode, input, output, Number(seed) || 7).then(() => console.log(`${mode} -> ${output}`));
