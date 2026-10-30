// Sticker icons of the fish (Fish Index, Ocean, hatch reveal): from two Studio captures of the same
// sheet of fish (unlit black and white SurfaceGui backdrops, FOV 20, post effects and haze off),
// difference matting gives exact alpha (ghosts included), then a thick outline (white, pale blue for a
// ghost, gold for a shiny), a thin dark rim, a soft drop shadow and, for a shiny, gold sparkles.
// Sheets: 3 columns (species) x 4 rows (Normal, Anomaly, Ghost, Shiny), see the sheet JSON below.
//   node tools/fish-sticker-icons.js <out dir> <sheets.json>
//   (companions: "cols": 2, "rows": 1, "prefix": "Companion_" -> design/ui/companions)
//   sheets.json: [{ "black": "...jpg", "white": "...jpg", "types": ["Basic", "Big", "RedTetra"], "rowTop": 60, "rowH": 241 }]
// Results: design/ui/fish/stickers, uploaded with the Studio MCP upload_image, ids in src/client/ui/theme.ts.
const path = require("path");
const fs = require("fs");
// jimp 0.22 is a devDependency (npm install); JIMP=<path> still points to another copy
const Jimp = require(process.env.JIMP || "jimp");

const [outDir, sheetJson] = process.argv.slice(2);
const sheets = JSON.parse(fs.readFileSync(sheetJson, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const ICON_W = 256;
const ICON_H = 160;
const PAD = 14; // room for the outline and the shadow
const OUTLINE = 7; // px
const RIM = 2; // thin dark line around the outline, so the sticker pops on light backgrounds
const RIM_COLOR = [13, 29, 38];
const RIM_ALPHA = 0.55;
const SHADOW_OFFSET = 5;
const SHADOW_BLUR = 4;
const SHADOW_ALPHA = 0.35;
const OUTLINE_COLORS = {
	Normal: [255, 255, 255],
	Anomaly: [255, 255, 255],
	Ghost: [214, 246, 255],
	Shiny: [255, 213, 74],
};
const ROWS = ["Normal", "Anomaly", "Ghost", "Shiny"];

function sample(img, x, y) {
	const i = (y * img.bitmap.width + x) * 4;
	return [img.bitmap.data[i], img.bitmap.data[i + 1], img.bitmap.data[i + 2]];
}

/** RGBA float buffer of a cell: alpha from the black / white difference, colour un-premultiplied. */
function matte(black, white, x0, y0, w, h, bgB, bgW) {
	const out = new Float32Array(w * h * 4);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const b = sample(black, x0 + x, y0 + y);
			const wv = sample(white, x0 + x, y0 + y);
			let a = 0;
			for (let c = 0; c < 3; c++) a += 1 - (wv[c] - b[c]) / (bgW[c] - bgB[c]);
			a = Math.min(1, Math.max(0, a / 3));
			if (a < 0.06) a = 0; // JPEG noise on the backdrop
			const o = (y * w + x) * 4;
			for (let c = 0; c < 3; c++)
				out[o + c] = a > 0 ? Math.min(255, Math.max(0, (b[c] - (1 - a) * bgB[c]) / a)) : 0;
			out[o + 3] = a;
		}
	}
	return out;
}

function bbox(buf, w, h) {
	let x0 = w,
		y0 = h,
		x1 = -1,
		y1 = -1;
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			if (buf[(y * w + x) * 4 + 3] > 0.1) {
				x0 = Math.min(x0, x);
				y0 = Math.min(y0, y);
				x1 = Math.max(x1, x);
				y1 = Math.max(y1, y);
			}
		}
	return { x0, y0, x1, y1 };
}

function toJimp(buf, w, h) {
	const img = new Jimp(w, h, 0x00000000);
	for (let i = 0; i < w * h; i++) {
		img.bitmap.data[i * 4] = buf[i * 4];
		img.bitmap.data[i * 4 + 1] = buf[i * 4 + 1];
		img.bitmap.data[i * 4 + 2] = buf[i * 4 + 2];
		img.bitmap.data[i * 4 + 3] = Math.round(buf[i * 4 + 3] * 255);
	}
	return img;
}

function boxBlur(a, w, h, r) {
	const tmp = new Float32Array(w * h);
	const out = new Float32Array(w * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			let s = 0,
				n = 0;
			for (let k = -r; k <= r; k++) {
				const xx = x + k;
				if (xx >= 0 && xx < w) {
					s += a[y * w + xx];
					n++;
				}
			}
			tmp[y * w + x] = s / n;
		}
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			let s = 0,
				n = 0;
			for (let k = -r; k <= r; k++) {
				const yy = y + k;
				if (yy >= 0 && yy < h) {
					s += tmp[yy * w + x];
					n++;
				}
			}
			out[y * w + x] = s / n;
		}
	return out;
}

/** 4-point sparkle star centred at (cx, cy). */
function drawStar(data, w, h, cx, cy, size, color) {
	for (let y = Math.floor(cy - size); y <= cy + size; y++)
		for (let x = Math.floor(cx - size); x <= cx + size; x++) {
			if (x < 0 || y < 0 || x >= w || y >= h) continue;
			const dx = Math.abs(x - cx) / size,
				dy = Math.abs(y - cy) / size;
			// astroid-like star: |dx|^0.5 + |dy|^0.5 <= 1
			const d = Math.sqrt(dx) + Math.sqrt(dy);
			if (d > 1) continue;
			const core = d < 0.45;
			const a = Math.min(1, (1 - d) * 3);
			const c = core ? [255, 255, 255] : color;
			const i = (y * w + x) * 4;
			const ia = data[i + 3] / 255;
			const na = a + ia * (1 - a);
			for (let k = 0; k < 3; k++) data[i + k] = (c[k] * a + data[i + k] * ia * (1 - a)) / (na || 1);
			data[i + 3] = na * 255;
		}
}

async function sticker(fish, variant) {
	// Fit the fish into the icon, leaving room for the outline and the shadow
	const scale = Math.min((ICON_W - PAD * 2) / fish.bitmap.width, (ICON_H - PAD * 2) / fish.bitmap.height);
	const fw = Math.round(fish.bitmap.width * scale),
		fh = Math.round(fish.bitmap.height * scale);
	const scaled = fish.clone().resize(fw, fh, Jimp.RESIZE_BICUBIC);
	const ox = Math.round((ICON_W - fw) / 2),
		oy = Math.round((ICON_H - fh) / 2) - 2;

	const alpha = new Float32Array(ICON_W * ICON_H);
	for (let y = 0; y < fh; y++)
		for (let x = 0; x < fw; x++) alpha[(oy + y) * ICON_W + ox + x] = scaled.bitmap.data[(y * fw + x) * 4 + 3] / 255;
	// The outline follows the silhouette (any coverage counts, so a ghost gets a full outline)
	const solid = alpha.map((a) => (a > 0.08 ? 1 : 0));
	const dilate = (radius) => {
		const out = new Float32Array(ICON_W * ICON_H);
		const r2 = radius * radius;
		for (let y = 0; y < ICON_H; y++)
			for (let x = 0; x < ICON_W; x++) {
				if (!solid[y * ICON_W + x]) continue;
				for (let dy = -radius; dy <= radius; dy++)
					for (let dx = -radius; dx <= radius; dx++) {
						const d2 = dx * dx + dy * dy;
						if (d2 > r2) continue;
						const xx = x + dx,
							yy = y + dy;
						if (xx < 0 || yy < 0 || xx >= ICON_W || yy >= ICON_H) continue;
						const v = Math.min(1, radius + 0.5 - Math.sqrt(d2));
						if (v > out[yy * ICON_W + xx]) out[yy * ICON_W + xx] = v;
					}
			}
		return out;
	};
	const rim = dilate(OUTLINE + RIM);
	const outline = new Float32Array(ICON_W * ICON_H);
	const r2 = OUTLINE * OUTLINE;
	for (let y = 0; y < ICON_H; y++)
		for (let x = 0; x < ICON_W; x++) {
			if (!solid[y * ICON_W + x]) continue;
			for (let dy = -OUTLINE; dy <= OUTLINE; dy++)
				for (let dx = -OUTLINE; dx <= OUTLINE; dx++) {
					const d2 = dx * dx + dy * dy;
					if (d2 > r2) continue;
					const xx = x + dx,
						yy = y + dy;
					if (xx < 0 || yy < 0 || xx >= ICON_W || yy >= ICON_H) continue;
					const v = Math.min(1, OUTLINE + 0.5 - Math.sqrt(d2)); // anti-aliased rim
					if (v > outline[yy * ICON_W + xx]) outline[yy * ICON_W + xx] = v;
				}
		}
	const shadow = boxBlur(rim, ICON_W, ICON_H, SHADOW_BLUR);

	const out = new Jimp(ICON_W, ICON_H, 0x00000000);
	const d = out.bitmap.data;
	const oc = OUTLINE_COLORS[variant];
	for (let y = 0; y < ICON_H; y++)
		for (let x = 0; x < ICON_W; x++) {
			const i = (y * ICON_W + x) * 4;
			// shadow (offset down)
			const sy = y - SHADOW_OFFSET;
			let a = sy >= 0 ? shadow[sy * ICON_W + x] * SHADOW_ALPHA : 0;
			let col = [6, 22, 31];
			// dark rim, then the outline over the shadow
			const ra = rim[y * ICON_W + x] * RIM_ALPHA;
			if (ra > 0) {
				col = col.map((c, k) => (RIM_COLOR[k] * ra + c * a * (1 - ra)) / (ra + a * (1 - ra)));
				a = ra + a * (1 - ra);
			}
			const o = outline[y * ICON_W + x];
			if (o > 0) {
				col = col.map((c, k) => (oc[k] * o + c * a * (1 - o)) / (o + a * (1 - o)));
				a = o + a * (1 - o);
			}
			// fish over the outline
			const fx = x - ox,
				fy = y - oy;
			if (fx >= 0 && fy >= 0 && fx < fw && fy < fh) {
				const fi = (fy * fw + fx) * 4;
				const fa = scaled.bitmap.data[fi + 3] / 255;
				if (fa > 0) {
					const fc = [scaled.bitmap.data[fi], scaled.bitmap.data[fi + 1], scaled.bitmap.data[fi + 2]];
					col = col.map((c, k) => (fc[k] * fa + c * a * (1 - fa)) / (fa + a * (1 - fa)));
					a = fa + a * (1 - fa);
				}
			}
			d[i] = col[0];
			d[i + 1] = col[1];
			d[i + 2] = col[2];
			d[i + 3] = Math.round(a * 255);
		}
	if (variant === "Shiny") {
		drawStar(d, ICON_W, ICON_H, ox + fw * 0.1, oy + fh * 0.14, 26, [255, 205, 60]);
		drawStar(d, ICON_W, ICON_H, ox + fw * 0.93, oy + fh * 0.84, 19, [255, 205, 60]);
		drawStar(d, ICON_W, ICON_H, ox + fw * 0.62, oy + 2, 13, [255, 236, 150]);
	}
	return out;
}

(async () => {
	for (const sheet of sheets) {
		const black = await Jimp.read(sheet.black);
		const white = await Jimp.read(sheet.white);
		const W = black.bitmap.width,
			H = black.bitmap.height;
		// Backdrop values, from the corners
		const avg = (img) => {
			const pts = [
				[8, 8],
				[W - 9, 8],
				[8, H - 9],
				[W - 9, H - 9],
			];
			const s = [0, 0, 0];
			for (const [x, y] of pts) sample(img, x, y).forEach((v, k) => (s[k] += v / pts.length));
			return s;
		};
		const bgB = avg(black),
			bgW = avg(white);
		console.log(path.basename(sheet.black), "bg black", bgB.map(Math.round), "bg white", bgW.map(Math.round));
		const cols = sheet.cols ?? 3;
		const colW = W / cols;
		const rowTop = sheet.rowTop,
			rowH = sheet.rowH;
		for (let col = 0; col < cols; col++) {
			for (let row = 0; row < (sheet.rows ?? 4); row++) {
				const x0 = Math.round(col * colW),
					y0 = Math.round(rowTop + row * rowH);
				const w = Math.round(colW),
					h = Math.round(rowH);
				const buf = matte(black, white, x0, y0, w, h, bgB, bgW);
				const b = bbox(buf, w, h);
				const cw = b.x1 - b.x0 + 1,
					ch = b.y1 - b.y0 + 1;
				const crop = new Float32Array(cw * ch * 4);
				for (let y = 0; y < ch; y++)
					for (let x = 0; x < cw; x++)
						for (let k = 0; k < 4; k++)
							crop[(y * cw + x) * 4 + k] = buf[((b.y0 + y) * w + b.x0 + x) * 4 + k];
				const fish = toJimp(crop, cw, ch);
				const variant = ROWS[row];
				const icon = await sticker(fish, variant);
				const name = sheet.prefix ? `${sheet.prefix}${sheet.types[col]}.png` : `Icon_${sheet.types[col]}_${variant}.png`;
				await icon.writeAsync(path.join(outDir, name));
				console.log(name, `${cw}x${ch}`);
			}
		}
	}
})();
