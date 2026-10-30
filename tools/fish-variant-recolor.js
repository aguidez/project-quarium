// Fish variant recolouring (offline), used to make the Anomaly / Shiny textures and icons (Ghost needs none).
// Pipeline: pull each species ColorMap out of Studio (EditableImage -> raw RGBA, ≤ 1024², POSTed to a local
// server while HttpService.HttpEnabled is on for a moment) into TEX_DIR as <Type>.rgba + <Type>.json {w, h};
// run "build" with design/ui/fish/variants/variant-spec.json ([hue°, saturation ×, lightness +] per variant);
// serve the PNGs on 127.0.0.1 and upload them with the Studio MCP upload_image; ids go to shared/types/variants.ts
// (textures) and client/ui/theme.ts (icons).
// Hue rotation in HSL that keeps neutrals (black / white / grey) as they are.
//   node recolor.js sheet          -> sheet.png: every icon at hues 0, 60 ... 300 (to choose the angles)
//   node recolor.js build <json>   -> textures/out/<Type>_<Variant>.png and icons/<Type>_<Variant>.png
const path = require("path");
const fs = require("fs");
// jimp 0.22 is a devDependency (npm install); JIMP=<path> still points to another copy
const Jimp = require(process.env.JIMP || "jimp");

const DESIGN = path.join(__dirname, "..", "design", "ui");
const ICONS = {
	Basic: DESIGN + "/GuppyIcon.png",
	Big: DESIGN + "/NeonIcon.png",
	RedTetra: DESIGN + "/RedTetraIcon.png",
	Clownfish: DESIGN + "/fish/ClownfishIcon.png",
	ZebraDanio: DESIGN + "/fish/ZebraDanioIcon.png",
	FlameGourami: DESIGN + "/fish/FlameGouramiIcon.png",
};
const TEX = process.env.TEX_DIR || path.join(__dirname, "textures"); // <Type>.rgba + .json pulled from Studio

function rgbToHsl(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h = 0,
		s = 0;
	const l = (max + min) / 2;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h /= 6;
	}
	return [h, s, l];
}
function hslToRgb(h, s, l) {
	if (s === 0) return [l * 255, l * 255, l * 255];
	const hue = (p, q, t) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}
/**
 * In place on RGBA data: rotate hue by `deg`, scale saturation by `sat`, shift lightness by `light`.
 * With `tint` = [hue°, saturation], every pixel takes that hue instead (at least that saturation, fading
 * out toward black and white): the only way to recolour a mostly grey fish such as the Silver Angelfish.
 */
function recolor(data, deg, sat = 1, light = 0, tint) {
	for (let i = 0; i < data.length; i += 4) {
		const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
		if (tint) {
			const lit = Math.max(0, Math.min(1, l + light));
			const tintSat = tint[1] * (1 - Math.abs(2 * lit - 1) ** 3);
			const [r, g, b] = hslToRgb(tint[0] / 360, Math.min(1, Math.max(s * sat, tintSat)), lit);
			data[i] = r;
			data[i + 1] = g;
			data[i + 2] = b;
			continue;
		}
		if (s < 0.08) continue; // neutrals: eyes, teeth, highlights
		const [r, g, b] = hslToRgb((h + deg / 360 + 1) % 1, Math.min(1, s * sat), Math.max(0, Math.min(1, l + light)));
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
	}
}

async function sheet() {
	const hues = [0, 60, 120, 180, 240, 300];
	const cell = 150;
	const types = Object.keys(ICONS);
	const out = new Jimp(cell * hues.length, cell * types.length * 0.6, 0x1b2a35ff);
	for (const [row, type] of types.entries()) {
		const icon = await Jimp.read(ICONS[type]);
		icon.contain(cell - 10, cell * 0.6 - 10);
		for (const [col, deg] of hues.entries()) {
			const copy = icon.clone();
			recolor(copy.bitmap.data, deg);
			out.composite(copy, col * cell + 5, row * cell * 0.6 + 5);
		}
	}
	await out.writeAsync(path.join(process.env.ICON_DIR || __dirname, "sheet.png"));
	console.log("sheet.png written");
}

async function build(spec) {
	fs.mkdirSync(path.join(TEX, "out"), { recursive: true });
	fs.mkdirSync(process.env.ICON_DIR || path.join(__dirname, "icons"), { recursive: true });
	for (const [type, variants] of Object.entries(spec)) {
		if (type.startsWith("_")) continue; // notes / uploaded ids
		const size = JSON.parse(fs.readFileSync(path.join(TEX, type + ".json"), "utf8"));
		const raw = fs.readFileSync(path.join(TEX, type + ".rgba"));
		for (const [variant, [deg, sat, light, tint]] of Object.entries(variants)) {
			const tex = new Jimp({ data: Buffer.from(raw), width: size.w, height: size.h });
			recolor(tex.bitmap.data, deg, sat, light, tint);
			await tex.writeAsync(path.join(TEX, "out", `${type}_${variant}.png`));
			// Species added after the sticker icons have no flat icon: their stickers come from Studio captures
			if (!ICONS[type]) {
				console.log(type, variant, "done (texture only)");
				continue;
			}
			const icon = await Jimp.read(ICONS[type]);
			recolor(icon.bitmap.data, deg, sat, light, tint);
			await icon.writeAsync(
				path.join(process.env.ICON_DIR || path.join(__dirname, "icons"), `${type}_${variant}.png`),
			);
			console.log(type, variant, "done");
		}
	}
}

const [mode, arg] = process.argv.slice(2);
if (mode === "sheet") sheet();
else if (mode === "build") build(JSON.parse(fs.readFileSync(arg, "utf8")));
