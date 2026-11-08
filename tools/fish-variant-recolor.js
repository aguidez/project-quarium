// Fish variant recolouring (offline), used to make the Anomaly / Shiny textures (Ghost needs none; the icons are
// the stickers of tools/fish-sticker-icons.js).
// Pipeline: pull each species ColorMap out of Studio (EditableImage -> raw RGBA, ≤ 1024², POSTed to a local
// server while HttpService.HttpEnabled is on for a moment) into TEX_DIR as <Type>.rgba + <Type>.json {w, h};
// run "build" with design/ui/fish/variants/variant-spec.json ([hue°, saturation ×, lightness +] per variant);
// serve the PNGs on 127.0.0.1 and upload them with the Studio MCP upload_image; ids go to variant-spec.json
// "_colorMaps" and into the FishVariantAppearance instances (ServerStorage.Assets.FishVariants).
// Hue rotation in HSL that keeps neutrals (black / white / grey) as they are.
//   node fish-variant-recolor.js sheet <Type>    -> TEX_DIR/out/sheet_<Type>.png: the texture at hues 0, 60 ... 300
//                                                  (to choose the angles)
//   node fish-variant-recolor.js build <json>    -> TEX_DIR/out/<Type>_<Variant>.png
//   node fish-variant-recolor.js sticker <in.png> <out.png> <deg> [sat] [light] [tintHue tintSat]
//                                                 a sticker of tools/fish-sticker-icons.js recoloured like its texture
//                                                 (its white / gold outline, sparkles and shadow kept): the Anomaly /
//                                                 Shiny stickers without uploading the textures first (V1.1.21)
const path = require("path");
const fs = require("fs");
// jimp 0.22 is a devDependency (npm install); JIMP=<path> still points to another copy
const Jimp = require(process.env.JIMP || "jimp");

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

function readTexture(type) {
	const size = JSON.parse(fs.readFileSync(path.join(TEX, type + ".json"), "utf8"));
	const raw = fs.readFileSync(path.join(TEX, type + ".rgba"));
	return new Jimp({ data: Buffer.from(raw), width: size.w, height: size.h });
}

async function sheet(type) {
	const hues = [0, 60, 120, 180, 240, 300];
	const cell = 256;
	const texture = readTexture(type);
	texture.contain(cell, cell);
	const out = new Jimp(cell * hues.length, cell, 0x1b2a35ff);
	for (const [col, deg] of hues.entries()) {
		const copy = texture.clone();
		recolor(copy.bitmap.data, deg);
		out.composite(copy, col * cell, 0);
	}
	fs.mkdirSync(path.join(TEX, "out"), { recursive: true });
	await out.writeAsync(path.join(TEX, "out", `sheet_${type}.png`));
	console.log(`sheet_${type}.png written`);
}

async function build(spec) {
	fs.mkdirSync(path.join(TEX, "out"), { recursive: true });
	for (const [type, variants] of Object.entries(spec)) {
		if (type.startsWith("_")) continue; // notes / uploaded ids
		for (const [variant, [deg, sat, light, tint]] of Object.entries(variants)) {
			const tex = readTexture(type);
			recolor(tex.bitmap.data, deg, sat, light, tint);
			await tex.writeAsync(path.join(TEX, "out", `${type}_${variant}.png`));
			console.log(type, variant, "done");
		}
	}
}

// The Shiny stickers' gold outline and sparkles (fish-sticker-icons.js OUTLINE_COLORS.Shiny and its sparkles)
const STICKER_GOLD = [255, 213, 74];

async function sticker(input, output, deg, sat = 1, light = 0, tint) {
	const image = await Jimp.read(input);
	const data = image.bitmap.data;
	const keep = [];
	for (let i = 0; i < data.length; i += 4) {
		const d = Math.abs(data[i] - STICKER_GOLD[0]) + Math.abs(data[i + 1] - STICKER_GOLD[1]) + Math.abs(data[i + 2] - STICKER_GOLD[2]);
		// the outline, the sparkles and the soft shadow stay (neutrals are kept by recolor itself)
		if (data[i + 3] < 200 || d < 60) keep.push([i, data[i], data[i + 1], data[i + 2]]);
	}
	recolor(data, deg, sat, light, tint);
	for (const [i, r, g, b] of keep) {
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
	}
	await image.writeAsync(output);
	console.log(`sticker -> ${output}`);
}

const [mode, arg] = process.argv.slice(2);
if (mode === "sheet") sheet(arg);
else if (mode === "sticker") {
	const [, , inFile, outFile, deg, sat, light, tintHue, tintSat] = process.argv.slice(1);
	// a grey fish (a black and white one, V1.1.24) is tinted like its texture: [hue, saturation]
	const tint = tintHue === undefined ? undefined : [Number(tintHue), Number(tintSat)];
	sticker(inFile, outFile, Number(deg), sat === undefined ? 1 : Number(sat), light === undefined ? 0 : Number(light), tint);
}
else if (mode === "build") build(JSON.parse(fs.readFileSync(arg, "utf8")));
