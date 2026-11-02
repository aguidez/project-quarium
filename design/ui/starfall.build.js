// FigCraft script: the starfall's star gauge mock-up (V2 arcade style), StarGauge.tsx: in the tank view and its states.
// Usage: node design/ui/starfall.build.js <script.json>
//        figcraft-cli run <script.json> --out design/ui/starfall.figcraft
// The run also exports design/previews/star-gauge-mockup.png (in the same session, which has the Roblox fonts).
const fs = require("fs");
const path = require("path");
const localConfig = require("../../tools/local-config");

const SCRIPT = process.argv[2] || path.join(__dirname, "starfall.json");
const PREVIEW = path.join(__dirname, "..", "previews", "star-gauge-mockup.png").split(path.sep).join("/");
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
	navy: ["#2F5684", "#1E3A5C", "#162C46", "#08121D"],
};
const STAR = { light: "#FFF6C8", base: "#FFD84A", edge: "#B8770A", trail: "#8FD3FF" };
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
		rotation: o.rotation || 0,
		opacity: o.opacity === undefined ? 1 : o.opacity,
	});
}

// The gauge: a navy plate with a star badge on top, a tube in three bars filling with gold from the bottom, and on its
// left one chip per bar (lit = guaranteed, else its chance). `chips`: [{ name, pal, text, lit }] from the bottom bar up.
const PLATE_W = 104;
const PLATE_H = 392;
const TUBE_H = 270;
const CHIP_W = 104;
function gauge(parent, name, x, y, o) {
	const root = add("frame", parent, name, x, y, CHIP_W + 10 + PLATE_W, PLATE_H + 70, {});
	const px = CHIP_W + 10;
	add("rectangle", root, "Shadow", px, 6, PLATE_W, PLATE_H, { fill: "#08121D", cornerRadius: 24, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const face = add("frame", root, "Plate", px, 0, PLATE_W, PLATE_H, { fills: vgrad("#2B5182", "#1A3456"), cornerRadius: 24, strokes: [o.glow ? STAR.base : OUT], strokeWeight: o.glow ? 4 : 3, strokeAlign: "inside" });
	add("rectangle", face, "Gloss", 8, 6, PLATE_W - 16, 40, { fill: "#FFFFFF", opacity: 0.12, cornerRadius: 16 });
	label(face, "Title", 0, 40, PLATE_W, 40, o.title, { font: TITLE, size: 17, stroke: OUT, strokeWeight: 3 });
	// Tube
	const tx = (PLATE_W - 44) / 2;
	const ty = 88;
	const tube = add("frame", face, "Tube", tx, ty, 44, TUBE_H, { fill: "#0A1624", cornerRadius: 22, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside", clip: true });
	const fillH = Math.round((TUBE_H * o.fill) / 3);
	if (fillH > 0) {
		const fill = add("frame", tube, "Fill", 0, TUBE_H - fillH, 44, fillH, { fills: vgrad(STAR.light, STAR.base), cornerRadius: 22 });
		add("rectangle", fill, "Shine", 7, 6, 10, Math.max(fillH - 12, 4), { fill: "#FFFFFF", opacity: 0.45, cornerRadius: 5 });
	}
	for (let i = 1; i < 3; i++) {
		add("rectangle", tube, `Notch${i}`, 0, Math.round(TUBE_H - (TUBE_H * i) / 3) - 2, 44, 4, { fill: OUT, opacity: 0.85 });
	}
	// Little stars climbing the fill
	if (o.sparks) for (const [sx, sy, ss] of o.sparks) star(face, "Spark", tx + sx, ty + sy, ss, { stroke: 1.5 });
	label(face, "Amount", 0, ty + TUBE_H + 6, PLATE_W, 28, o.amount, { font: TITLE, size: 20, color: STAR.base, stroke: OUT });
	// Badge on top
	star(root, "Badge", px + PLATE_W / 2 - 32, -34, 64, { stroke: 4, edge: OUT });
	// Chips: at the top of each bar, on the gauge's left
	o.chips.forEach((c, i) => {
		const cy = Math.round(ty + TUBE_H - (TUBE_H * (i + 1)) / 3) - 6;
		const lit = c.lit;
		const chip = add("frame", root, `Chip_${c.name}`, 0, cy, CHIP_W, 44, {
			fills: lit ? vgrad(c.pal[0], c.pal[1]) : vgrad("#24456B", "#132A44"),
			cornerRadius: 14,
			strokes: [OUT],
			strokeWeight: 3,
			strokeAlign: "inside",
			opacity: c.dim ? 0.45 : 1,
		});
		label(chip, "Name", 0, 3, CHIP_W, 22, c.name, { font: TITLE, size: 15, color: lit ? "#FFFFFF" : c.pal[1], stroke: lit ? c.pal[3] : OUT, strokeWeight: 2 });
		label(chip, "Odds", 0, 22, CHIP_W, 18, c.text, { size: 14, color: lit ? "#FFFFFF" : "#A9CBEF", stroke: lit ? c.pal[3] : undefined, strokeWeight: 2 });
		// A pointer from the chip to its bar
		add("rectangle", root, `Pointer_${c.name}`, CHIP_W - 2, cy + 18, 14, 8, { fill: lit ? c.pal[1] : "#24456B", strokes: [OUT], strokeWeight: 2, strokeAlign: "inside" });
	});
	// Caption under the gauge
	const cap = add("frame", root, "Caption", px - 26, PLATE_H + 20, PLATE_W + 52, 34, { fills: vgrad(o.capPal[0], o.capPal[1]), cornerRadius: 17, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	label(cap, "Text", 0, 1, PLATE_W + 52, 32, o.caption, { font: TITLE, size: 15, stroke: o.capPal[3], strokeWeight: 2 });
	return root;
}

// Board (dark game backdrop)
const board = add("frame", undefined, "StarGauge_Mockup", 0, 0, 1640, 800, { fill: "#16293D" });
label(board, "Caption", 30, 16, 1500, 30, "STARFALL - star gauge (right edge of the screen, tank view)", { size: 18, color: "#A9CBEF", align: "left" });

// In context: the tank view at night, stars falling, the gauge on the right
const scene = add("frame", board, "TankView", 30, 60, 900, 560, { fills: vgrad("#0A1650", "#3B2A78"), cornerRadius: 12, clip: true });
for (let i = 0; i < 40; i++) {
	const s = 2 + ((i * 7) % 5);
	add("ellipse", scene, "Twinkle", (i * 137) % 880 + 10, (i * 59) % 300 + 10, s, s, { fill: i % 3 ? "#FFFFFF" : "#FFF3B0", opacity: 0.5 + ((i * 13) % 5) / 10 });
}
// Shooting streaks
for (const [sx, sy, len, rot] of [[120, 60, 180, 24], [520, 30, 140, 30], [330, 150, 110, 20]]) {
	add("rectangle", scene, "Streak", sx, sy, len, 4, { fills: [{ type: "linearGradient", stops: ["#8FD3FF00", STAR.light], from: [0, 0.5], to: [1, 0.5] }], rotation: -rot, cornerRadius: 2 });
}
// The tank: water, sand, a few fish shapes
add("rectangle", scene, "Water", 60, 120, 640, 400, { fills: vgrad("#1E3A8A", "#14245E"), opacity: 0.9, cornerRadius: 8, strokes: ["#9FE3FF"], strokeWeight: 4, strokeAlign: "inside" });
add("rectangle", scene, "Sand", 64, 470, 632, 46, { fills: vgrad("#E9D7A4", "#B89B5E"), cornerRadius: 6 });
for (const [fx, fy, fw] of [[160, 260, 70], [420, 330, 90], [560, 220, 60], [260, 390, 56]]) {
	add("ellipse", scene, "Fish", fx, fy, fw, fw * 0.5, { fills: vgrad("#FF9A5C", "#E8603C"), strokes: [OUT], strokeWeight: 2, strokeAlign: "inside" });
}
// Falling stars of every size (one streaking in, others sinking, one on the sand)
star(scene, "StarHuge", 470, 70, 64, { rotation: 12 });
add("rectangle", scene, "StarTrail", 520, 40, 120, 10, { fills: [{ type: "linearGradient", stops: [STAR.base, "#8FD3FF00"], from: [0, 0.5], to: [1, 0.5] }], rotation: 32, cornerRadius: 5 });
star(scene, "StarBig", 210, 180, 46, { rotation: -10 });
star(scene, "StarMedium", 600, 300, 34, { rotation: 20 });
star(scene, "StarSmall", 340, 250, 26);
star(scene, "StarSmall2", 150, 448, 24, { rotation: 30 });
// Banner (top centre)
const banner = add("frame", scene, "EventBanner", 250, 12, 300, 60, { fills: vgrad("#1B3A8C", "#070D2E"), cornerRadius: 16, strokes: [STAR.base], strokeWeight: 3, strokeAlign: "inside" });
label(banner, "Name", 0, 4, 300, 30, "STARFALL  0:41", { font: TITLE, size: 22, stroke: OUT });
label(banner, "Sub", 0, 32, 300, 22, "Catch the falling stars!", { size: 14, color: "#FFE89A" });
const ctx = { glow: false, title: "STAR\nPOWER", amount: "1.6 / 3", caption: "CATCH THE STARS!", capPal: PAL.gold };
gauge(scene, "Gauge_InContext", 900 - 44 - (CHIP_W + 10 + PLATE_W), 100, {
	...ctx,
	fill: 1.6,
	sparks: [[26, 120, 14]],
	chips: [
		{ name: "ANOMALY", pal: PAL.purple, text: "SURE!", lit: true },
		{ name: "GHOST", pal: PAL.ghost, text: "28%" },
		{ name: "SHINY", pal: PAL.gold, text: "4%" },
	],
});

// The states
label(board, "StatesCaption", 970, 60, 640, 24, "States", { size: 18, color: "#A9CBEF", align: "left" });
gauge(board, "Gauge_Event", 960, 140, {
	...ctx,
	amount: "0.6 / 3",
	fill: 0.55,
	chips: [
		{ name: "ANOMALY", pal: PAL.purple, text: "21%" },
		{ name: "GHOST", pal: PAL.ghost, text: "11%" },
		{ name: "SHINY", pal: PAL.gold, text: "2%" },
	],
});
label(board, "Event_Note", 960, 620, 220, 40, "During the starfall\n(under one bar)", { size: 14, color: "#A9CBEF" });
gauge(board, "Gauge_TwoBars", 1180, 140, {
	...ctx,
	amount: "2.4 / 3",
	fill: 2.4,
	chips: [
		{ name: "ANOMALY", pal: PAL.purple, text: "", lit: true, dim: true },
		{ name: "GHOST", pal: PAL.ghost, text: "SURE!", lit: true },
		{ name: "SHINY", pal: PAL.gold, text: "19%" },
	],
});
label(board, "TwoBars_Note", 1180, 620, 220, 40, "Two bars: a Ghost\nat least", { size: 14, color: "#A9CBEF" });
gauge(board, "Gauge_Full", 1400, 140, {
	glow: true,
	title: "STAR\nPOWER",
	amount: "MAX!",
	caption: "SHINY SURE!",
	capPal: PAL.gold,
	fill: 3,
	sparks: [[6, 30, 16], [24, 120, 12], [10, 200, 14]],
	chips: [
		{ name: "ANOMALY", pal: PAL.purple, text: "", lit: true, dim: true },
		{ name: "GHOST", pal: PAL.ghost, text: "", lit: true, dim: true },
		{ name: "SHINY", pal: PAL.gold, text: "SURE!", lit: true },
	],
});
label(board, "Full_Note", 1400, 620, 220, 40, "Three bars: a Shiny\nfor sure", { size: 14, color: "#A9CBEF" });

// After the event (the gauge is gone): the star power kept, a pill under the egg shop until an egg spends it
// (StarPowerPill), in the colour of the variant it guarantees
label(board, "PillCaption", 30, 680, 900, 24, "After the starfall: under the egg shop, until the next egg opens", { size: 18, color: "#A9CBEF", align: "left" });
[
	["NEXT EGG: AT LEAST AN ANOMALY", PAL.purple],
	["NEXT EGG: AT LEAST A GHOST", PAL.ghost],
	["NEXT EGG: SHINY FOR SURE!", PAL.gold],
].forEach(([text, pal], i) => {
	const root = add("frame", board, `StarPowerPill_${i}`, 30 + i * 370, 720, 340, 45, {});
	add("rectangle", root, "Shadow", 0, 5, 340, 40, { fill: pal[3], cornerRadius: 20, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const face = add("frame", root, "Face", 0, 0, 340, 40, { fills: vgrad(pal[0], pal[1]), cornerRadius: 20, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	add("rectangle", face, "Gloss", 6, 4, 328, 14, { fill: "#FFFFFF", opacity: 0.3, cornerRadius: 7 });
	star(face, "Star", 8, 5, 30, { edge: OUT, stroke: 2.5 });
	label(face, "Label", 42, 0, 292, 40, text, { size: 15, stroke: pal[3], strokeWeight: 2.5 });
});

cmds.push({ command: "file.export", params: { ids: [{ $step: board }], format: "png", scale: 1, path: PREVIEW } });
fs.writeFileSync(SCRIPT, JSON.stringify(cmds, null, 1));
console.log(`${cmds.length} steps -> ${SCRIPT}`);
