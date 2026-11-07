// FigCraft script: the star gauge with its 4th bar, the Galaxy's (V1.1.20, ROADMAP_V1.2 §3.7; StarGauge.tsx). Bars 1–3
// are the gold ones of starfall.build.js (Anomaly, Ghost, Shiny guaranteed); the 4th, on top, fills night blue to
// pink and guarantees a Galaxy. Its states: under 3 bars (unchanged), 3 bars and a bit (Shiny sure, Galaxy's chance
// growing), 4 bars (Galaxy sure).
// Usage: node design/ui/star-gauge-4.build.js <script.json>
//        figcraft-cli run <script.json> --out design/ui/star-gauge-4.figcraft
// The run also exports design/previews/star-gauge-4-mockup.png.
const fs = require("fs");
const path = require("path");
const localConfig = require("../../tools/local-config");

const SCRIPT = process.argv[2] || path.join(__dirname, "star-gauge-4.json");
const PREVIEW = path.join(__dirname, "..", "previews", "star-gauge-4-mockup.png").split(path.sep).join("/");
const FONTS = localConfig.robloxFontsDir().split(path.sep).join("/");
const cmds = [];
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/LuckiestGuy-Regular.ttf" } });
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/FredokaOne-Regular.ttf" } });
const OUT = "#071320";
const TITLE = "Luckiest Guy";
const BODY = "Fredoka One";
const PAL = {
	purple: ["#D9ABFF", "#A55CFF", "#7C34D9", "#44167F"],
	ghost: ["#E6FAFF", "#9FE3FF", "#6CC4EA", "#2A6A85"],
	gold: ["#FFF3A0", "#FFD233", "#F0A500", "#8F5A00"],
	galaxy: ["#B9A8FF", "#6C4CFF", "#4A2ED1", "#1E0E6B"],
};
const GALAXY_FILL = ["#FF8AD8", "#5B3BFF", "#1B1060"]; // top pink, middle indigo, bottom night
const STAR = { light: "#FFF6C8", base: "#FFD84A", edge: "#B8770A" };
const vgrad = (a, b) => [{ type: "linearGradient", stops: [a, b], from: [0.5, 0], to: [0.5, 1] }];
function add(type, parent, name, x, y, w, h, props = {}, text) {
	const p = parent !== undefined ? { $step: parent } : undefined;
	if (type === "text") {
		cmds.push({ command: "text.create", params: { text, parent: p, x, y, props: { name, width: w, height: h, ...props } } });
	} else if (type === "frame") {
		cmds.push({ command: "frame.create", params: { parent: p, name, x, y, width: w, height: h, props: { fill: "none", clip: false, ...props } } });
	} else {
		cmds.push({ command: "node.create", params: { type, parent: p, name, x, y, width: w, height: h, props } });
	}
	return cmds.length - 1;
}
function label(parent, name, x, y, w, h, text, o = {}) {
	const props = {
		fontFamily: o.font || BODY,
		fontStyle: "Regular",
		fontSize: o.size || 18,
		fill: o.color || "#FFFFFF",
		textAlign: o.align || "center",
		textAlignVertical: "middle",
		textAutoResize: "none",
	};
	if (o.stroke) Object.assign(props, { stroke: o.stroke, strokeWeight: o.strokeWeight || 3, strokeAlign: "outside", strokeJoin: "round" });
	return add("text", parent, name, x, y, w, h, props, text);
}
function star(parent, name, x, y, s, o = {}) {
	return add("star", parent, name, x, y, s, s, {
		pointCount: 5,
		innerRadius: 0.48,
		fills: vgrad(o.top || STAR.light, o.bottom || STAR.base),
		strokes: [o.edge || STAR.edge],
		strokeWeight: o.stroke || 3,
		strokeAlign: "inside",
		strokeJoin: "round",
		opacity: o.opacity === undefined ? 1 : o.opacity,
	});
}

// The gauge: same plate as V1's, a taller tube of 4 bars (the same 90 px per bar as V1's 270 px for 3)
const PLATE_W = 104;
const BAR_H = 80;
const TUBE_H = BAR_H * 4;
const PLATE_H = 88 + TUBE_H + 44;
const CHIP_W = 104;
function gauge(parent, name, x, y, o) {
	const root = add("frame", parent, name, x, y, CHIP_W + 10 + PLATE_W, PLATE_H + 70, {});
	const px = CHIP_W + 10;
	add("rectangle", root, "Shadow", px, 6, PLATE_W, PLATE_H, { fill: "#08121D", cornerRadius: 24, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const glow = o.fill >= 4 ? PAL.galaxy[0] : o.fill >= 3 ? STAR.base : OUT;
	const face = add("frame", root, "Plate", px, 0, PLATE_W, PLATE_H, { fills: vgrad("#2B5182", "#1A3456"), cornerRadius: 24, strokes: [glow], strokeWeight: glow === OUT ? 3 : 4, strokeAlign: "inside" });
	add("rectangle", face, "Gloss", 8, 6, PLATE_W - 16, 40, { fill: "#FFFFFF", opacity: 0.12, cornerRadius: 16 });
	label(face, "Title", 0, 40, PLATE_W, 40, "STAR\nPOWER", { font: TITLE, size: 17, stroke: OUT, strokeWeight: 3 });
	const tx = (PLATE_W - 44) / 2;
	const ty = 88;
	const tube = add("frame", face, "Tube", tx, ty, 44, TUBE_H, { fill: "#0A1624", cornerRadius: 22, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside", clip: true });
	// Bars 1-3: gold; the 4th: the Galaxy's night-to-pink fill, with a few white dots
	const gold = Math.min(o.fill, 3);
	const goldH = Math.round(BAR_H * gold);
	if (goldH > 0) {
		const fill = add("frame", tube, "Fill", 0, TUBE_H - goldH, 44, goldH, { fills: vgrad(STAR.light, STAR.base), cornerRadius: o.fill > 3 ? 0 : 22 });
		add("rectangle", fill, "Shine", 7, 6, 10, Math.max(goldH - 12, 4), { fill: "#FFFFFF", opacity: 0.45, cornerRadius: 5 });
	}
	if (o.fill > 3) {
		const gh = Math.round(BAR_H * (o.fill - 3));
		const gfill = add("frame", tube, "GalaxyFill", 0, TUBE_H - goldH - gh, 44, gh, {
			fills: [{ type: "linearGradient", stops: GALAXY_FILL, from: [0.5, 0], to: [0.5, 1] }],
			cornerRadius: o.fill >= 4 ? 22 : 0,
		});
		for (const [dx, dy, s] of [[10, 10, 3], [28, 22, 2], [18, 40, 3], [32, 55, 2], [12, 66, 2]]) {
			if (dy < gh - 4) add("ellipse", gfill, "Dot", dx, dy, s, s, { fill: "#FFFFFF", opacity: 0.9 });
		}
	}
	for (let i = 1; i < 4; i++) {
		add("rectangle", tube, `Notch${i}`, 0, TUBE_H - BAR_H * i - 2, 44, 4, { fill: i === 3 ? PAL.galaxy[0] : OUT, opacity: 0.85 });
	}
	label(face, "Amount", 0, ty + TUBE_H + 6, PLATE_W, 28, o.amount, { font: TITLE, size: 20, color: o.fill >= 4 ? PAL.galaxy[0] : STAR.base, stroke: OUT });
	star(root, "Badge", px + PLATE_W / 2 - 32, -34, 64, { stroke: 4, edge: OUT });
	o.chips.forEach((c, i) => {
		const cy = ty + TUBE_H - BAR_H * (i + 1) - 6;
		const lit = c.lit;
		const chip = add("frame", root, `Chip_${c.name}`, 0, cy, CHIP_W, 44, {
			fills: lit ? vgrad(c.pal[0], c.pal[1]) : vgrad("#24456B", "#132A44"),
			cornerRadius: 14,
			strokes: [OUT],
			strokeWeight: 3,
			strokeAlign: "inside",
			opacity: c.dim ? 0.45 : 1,
		});
		label(chip, "Name", 0, c.text ? 3 : 11, CHIP_W, 22, c.name, { font: TITLE, size: 15, color: lit ? "#FFFFFF" : c.pal[1], stroke: lit ? c.pal[3] : OUT, strokeWeight: 2 });
		if (c.text) label(chip, "Odds", 0, 22, CHIP_W, 18, c.text, { size: 14, color: lit ? "#FFFFFF" : "#A9CBEF", stroke: lit ? c.pal[3] : undefined, strokeWeight: 2 });
		add("rectangle", root, `Pointer_${c.name}`, CHIP_W - 2, cy + 18, 14, 8, { fill: lit ? c.pal[1] : "#24456B", strokes: [OUT], strokeWeight: 2, strokeAlign: "inside" });
	});
	const cap = add("frame", root, "Caption", px - 26, PLATE_H + 20, PLATE_W + 52, 34, { fills: vgrad(o.capPal[0], o.capPal[1]), cornerRadius: 17, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	label(cap, "Text", 0, 1, PLATE_W + 52, 32, o.caption, { font: TITLE, size: 15, stroke: o.capPal[3], strokeWeight: 2 });
	return root;
}

const board = add("frame", undefined, "StarGauge4_Mockup", 0, 0, 1020, 640, { fill: "#16293D" });
label(board, "Caption", 30, 16, 960, 30, "STARFALL - the 4th bar (Galaxy): very hard to fill, it guarantees a Galaxy", { size: 18, color: "#A9CBEF", align: "left" });
const chips = (shiny, galaxy) => [
	{ name: "ANOMALY", pal: PAL.purple, lit: true, dim: true },
	{ name: "GHOST", pal: PAL.ghost, lit: true, dim: true },
	shiny,
	galaxy,
];
gauge(board, "Gauge_TwoBars", 40, 90, {
	fill: 2.4,
	amount: "2.4 / 4",
	caption: "CATCH THE STARS!",
	capPal: PAL.gold,
	chips: [
		{ name: "ANOMALY", pal: PAL.purple, lit: true, dim: true },
		{ name: "GHOST", pal: PAL.ghost, text: "SURE!", lit: true },
		{ name: "SHINY", pal: PAL.gold, text: "19%" },
		{ name: "GALAXY", pal: PAL.galaxy, text: "0.3%" },
	],
});
label(board, "Note1", 40, 590, 230, 40, "Under 3 bars: as today,\nGalaxy at its usual chance", { size: 14, color: "#A9CBEF" });
gauge(board, "Gauge_ThreeAndABit", 290, 90, {
	fill: 3.45,
	amount: "3.4 / 4",
	caption: "SHINY SURE!",
	capPal: PAL.gold,
	chips: chips({ name: "SHINY", pal: PAL.gold, text: "SURE!", lit: true }, { name: "GALAXY", pal: PAL.galaxy, text: "2.5%" }),
});
label(board, "Note2", 290, 590, 230, 40, "3 bars and a bit: Shiny sure,\nGalaxy 0.5 → 5 % as it fills", { size: 14, color: "#A9CBEF" });
gauge(board, "Gauge_Galaxy", 540, 90, {
	fill: 4,
	amount: "MAX!",
	caption: "GALAXY SURE!",
	capPal: PAL.galaxy,
	chips: chips({ name: "SHINY", pal: PAL.gold, lit: true, dim: true }, { name: "GALAXY", pal: PAL.galaxy, text: "SURE!", lit: true }),
});
label(board, "Note3", 540, 590, 230, 40, "4 bars: a Galaxy for sure\n(2.6 % of perfect starfalls)", { size: 14, color: "#A9CBEF" });
label(board, "Rule", 790, 120, 210, 300, "The 4th bar costs 0.9 bar of stars: what the stars bring past 3 bars, lost before, now fills it.\n\nIts notch and its chip are violet, its fill night blue to pink with a few stars, like the Galaxy fish.", { size: 15, color: "#DCE9F2", align: "left" });

cmds.push({ command: "file.export", params: { ids: [{ $step: board }], format: "png", scale: 1, path: PREVIEW } });
fs.writeFileSync(SCRIPT, JSON.stringify(cmds, null, 1));
console.log(`${cmds.length} steps -> ${SCRIPT}`);
