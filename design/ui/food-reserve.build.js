// FigCraft script: the food reserve mock-up (V2 arcade style), FoodReserve.tsx: in the tank view, in the onboarding's
// Feed step, and its states.
// Usage: node design/ui/food-reserve.build.js <script.json>
//        figcraft-cli run <script.json> --out design/ui/food-reserve.figcraft
// The run also exports design/previews/food-reserve-mockup.png (in the same session, which has the Roblox fonts).
const fs = require("fs");
const path = require("path");
const localConfig = require("../../tools/local-config");

const SCRIPT = process.argv[2] || path.join(__dirname, "food-reserve.json");
const PREVIEW = path.join(__dirname, "..", "previews", "food-reserve-mockup.png").split(path.sep).join("/");
const FONTS = localConfig.robloxFontsDir().split(path.sep).join("/");
const cmds = [];
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/LuckiestGuy-Regular.ttf" } });
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/FredokaOne-Regular.ttf" } });
const OUT = "#071320";
const TITLE = "Luckiest Guy";
const BODY = "Fredoka One";
const PAL = {
	amber: ["#FFE8A8", "#F5A623", "#D9860C", "#7A4A06"],
	red: ["#FF9AA6", "#FF4D5E", "#D92B45", "#7E0E22"],
	gold: ["#FFF3A0", "#FFD233", "#F0A500", "#8F5A00"],
	blue: ["#7CC8FF", "#0A84FF", "#0866CC", "#053D80"],
};
// The pellet of the game (FoodService's brown ball, PelicanChargesController's colours)
const PELLET = { light: "#F0A65A", dark: "#A85A1C", shine: "#FFE2B8" };
const vgrad = (a, b) => [{ type: "linearGradient", stops: [a, b], from: [0.5, 0], to: [0.5, 1] }];
const lit = (a, b) => [{ type: "linearGradient", stops: [a, b], from: [0.25, 0.1], to: [0.8, 0.95] }];
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
		opacity: o.opacity === undefined ? 1 : o.opacity,
	};
	if (o.stroke) Object.assign(props, { stroke: o.stroke, strokeWeight: o.strokeWeight || 3, strokeAlign: "outside", strokeJoin: "round" });
	return add("text", parent, name, x, y, w, h, props, text);
}
// A food pellet: round, lit from the top left, a shine spot
function pellet(parent, name, cx, cy, d, o = {}) {
	const opacity = o.opacity === undefined ? 1 : o.opacity;
	add("ellipse", parent, name, cx - d / 2, cy - d / 2, d, d, { fills: lit(PELLET.light, PELLET.dark), strokes: [OUT], strokeWeight: Math.max(2, d / 14), strokeAlign: "inside", opacity });
	add("ellipse", parent, `${name}_Shine`, cx - d * 0.28, cy - d * 0.3, d * 0.28, d * 0.2, { fill: PELLET.shine, opacity: 0.85 * opacity, rotation: 25 });
}

// The reserve: a navy plate holding one round slot per portion (full = a pellet; refilling = a faint pellet growing
// from the centre with the seconds left), an amber "FOOD n/5" chip on its top edge. `slots`: 1 = full, else the
// refill progress 0..1 and `secs` the seconds left. `s` scales the whole thing (mock-up scenes).
const SLOT = 52;
const SLOT_GAP = 10;
const PAD = 16;
const PLATE_H = 76;
const DEPTH = 6;
function reserve(parent, name, x, y, o, s = 1) {
	const n = o.slots.length;
	const W = PAD * 2 + n * SLOT + (n - 1) * SLOT_GAP;
	const k = (v) => Math.round(v * s);
	const root = add("frame", parent, name, x, y, k(W), k(PLATE_H + DEPTH + 18), {});
	const top = k(18);
	const alarm = o.empty;
	add("rectangle", root, "Shadow", 0, top + k(DEPTH), k(W), k(PLATE_H), { fill: "#08121D", cornerRadius: k(24), strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const face = add("frame", root, "Plate", 0, top, k(W), k(PLATE_H), { fills: vgrad("#2B5182", "#1A3456"), cornerRadius: k(24), strokes: [alarm ? PAL.red[1] : OUT], strokeWeight: alarm ? 4 : 3, strokeAlign: "inside" });
	add("rectangle", face, "Gloss", k(8), k(5), k(W - 16), k(24), { fill: "#FFFFFF", opacity: 0.1, cornerRadius: k(12) });
	o.slots.forEach((v, i) => {
		const sx = k(PAD + i * (SLOT + SLOT_GAP));
		const sy = k((PLATE_H - SLOT) / 2 + 4);
		const slot = add("frame", face, `Slot${i + 1}`, sx, sy, k(SLOT), k(SLOT), { fill: "#0A1624", cornerRadius: k(SLOT / 2), strokes: [alarm ? PAL.red[2] : OUT], strokeWeight: 3, strokeAlign: "inside" });
		const c = k(SLOT / 2);
		if (v >= 1) {
			pellet(slot, "Pellet", c, c, k(38));
		} else {
			const d = Math.round(k(38) * v);
			if (d > 2) pellet(slot, "Refill", c, c, d, { opacity: 0.55 });
			label(slot, "Secs", 0, 0, k(SLOT), k(SLOT), String(o.secs[i]), { size: k(20), stroke: OUT, strokeWeight: 2.5 });
		}
	});
	// The chip on the top edge
	const full = o.slots.filter((v) => v >= 1).length;
	const chipPal = alarm ? PAL.red : PAL.amber;
	const CW = k(alarm ? 150 : 110);
	const chip = add("frame", root, "Chip", Math.round((k(W) - CW) / 2), 0, CW, k(32), { fills: vgrad(chipPal[0], chipPal[1]), cornerRadius: k(16), strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	label(chip, "Text", 0, 1, CW, k(30), alarm ? "REFILLING..." : `FOOD ${full}/${n}`, { font: TITLE, size: k(17), stroke: chipPal[3], strokeWeight: 2.5 });
	return root;
}

// A tank view (2.5D): water, sand, a few fish, the shop shelf at the top, "Back to lobby" bottom-left
function tankView(parent, name, x, y, w, h) {
	const scene = add("frame", parent, name, x, y, w, h, { fills: vgrad("#6FC6E8", "#2F86B8"), cornerRadius: 12, clip: true });
	add("rectangle", scene, "Water", 40, 70, w - 80, h - 140, { fills: vgrad("#43B4E0", "#1F6FA8"), opacity: 0.95, cornerRadius: 8, strokes: ["#CFF3FF"], strokeWeight: 4, strokeAlign: "inside" });
	add("rectangle", scene, "Sand", 44, h - 120, w - 88, 46, { fills: vgrad("#F3E2B0", "#C9A866"), cornerRadius: 6 });
	for (const [fx, fy, fw, c] of [[150, 170, 70, "#FF9A5C"], [400, 240, 90, "#FFD84A"], [560, 150, 60, "#9AE07A"], [250, 290, 56, "#FF7FA8"]]) {
		add("ellipse", scene, "Fish", fx, fy, fw, fw * 0.5, { fills: vgrad(c, "#E8603C"), strokes: [OUT], strokeWeight: 2, strokeAlign: "inside" });
	}
	// The egg shelf (top centre)
	add("rectangle", scene, "ShopShelf", w / 2 - 190, 8, 380, 54, { fills: vgrad("#23446E", "#0F1B29"), cornerRadius: 14, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	for (let i = 0; i < 6; i++) add("rectangle", scene, "EggSlot", w / 2 - 180 + i * 61, 14, 52, 42, { fills: vgrad("#8CF5A8", "#2ECC71"), cornerRadius: 10, strokes: [OUT], strokeWeight: 2, strokeAlign: "inside", opacity: 0.85 });
	// Back to lobby
	add("rectangle", scene, "BackShadow", 16, h - 50, 160, 36, { fill: PAL.blue[3], cornerRadius: 12 });
	const back = add("frame", scene, "Back", 16, h - 54, 160, 36, { fills: vgrad(PAL.blue[0], PAL.blue[1]), cornerRadius: 12, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	label(back, "Text", 0, 0, 160, 36, "BACK TO LOBBY", { font: TITLE, size: 14, stroke: PAL.blue[3], strokeWeight: 2 });
	return scene;
}

// Board (dark game backdrop)
const board = add("frame", undefined, "FoodReserve_Mockup", 0, 0, 1640, 860, { fill: "#16293D" });
label(board, "Caption", 30, 16, 1580, 30, "FOOD RESERVE - free food, 5 portions, each empty slot refills in 10 s (bottom centre, tank view only)", { size: 18, color: "#A9CBEF", align: "left" });

// In context: the tank view, a pellet sinking, the reserve bottom centre (3 portions left)
const W1 = 780;
const H1 = 470;
const sceneA = tankView(board, "TankView", 30, 60, W1, H1);
pellet(sceneA, "Sinking1", 330, 150, 14);
pellet(sceneA, "Sinking2", 470, 205, 14);
const sA = 0.8;
const wA = Math.round((PAD * 2 + 5 * SLOT + 4 * SLOT_GAP) * sA);
reserve(sceneA, "Reserve_InContext", Math.round((W1 - wA) / 2), H1 - 86, { slots: [1, 1, 1, 0.7, 0.2], secs: [0, 0, 0, 3, 8] }, sA);

// The onboarding's Feed step: the card sits right above the reserve and points to it
const sceneB = tankView(board, "Onboarding_Feed", 830, 60, W1, H1);
reserve(sceneB, "Reserve_Onboarding", Math.round((W1 - wA) / 2), H1 - 86, { slots: [1, 1, 1, 1, 1], secs: [] }, sA);
const CARD_W = 560;
const CARD_H = 118;
const card = add("frame", sceneB, "OnboardingCard", (W1 - CARD_W) / 2, H1 - 86 - CARD_H - 14, CARD_W, CARD_H, { fills: vgrad("#23446E", "#0F1B29"), cornerRadius: 18, strokes: [PAL.gold[1]], strokeWeight: 5, strokeAlign: "outside" });
const icon = add("frame", card, "Icon", 16, 25, 68, 68, { fills: vgrad(PAL.gold[0], PAL.gold[2]), cornerRadius: 34, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
pellet(icon, "IconPellet", 34, 34, 40);
label(card, "Step", 100, 10, 440, 16, "STEP 5 / 5", { size: 13, color: "#A9CBEF", align: "left" });
label(card, "Title", 100, 26, 440, 32, "YOUR FISH IS HUNGRY!", { font: TITLE, size: 25, color: PAL.gold[1], align: "left", stroke: OUT, strokeWeight: 3 });
label(card, "Body", 100, 58, 448, 52, "Click the water to drop food. Food is free! Your reserve\nbelow holds 5 portions: an empty one refills in 10 seconds.", { size: 15, align: "left", stroke: OUT, strokeWeight: 2 });
// A little arrow from the card down to the reserve
add("star", sceneB, "Arrow", W1 / 2 - 11, H1 - 86 - 16, 22, 16, { pointCount: 3, innerRadius: 0.5, fill: PAL.gold[1], strokes: [OUT], strokeWeight: 2, strokeAlign: "inside", rotation: 180 });

label(board, "SceneA_Note", 30, 536, W1, 22, "Tank view: 3 portions left, two refilling (each its own 10 s)", { size: 15, color: "#A9CBEF", align: "left" });
label(board, "SceneB_Note", 830, 536, W1, 22, "Onboarding step 5: the reserve shows up with the card right above it", { size: 15, color: "#A9CBEF", align: "left" });

// The states, at their real size
label(board, "StatesCaption", 30, 590, 1500, 24, "States (real size, 1080p)", { size: 18, color: "#A9CBEF", align: "left" });
const states = [
	["Reserve_Full", { slots: [1, 1, 1, 1, 1], secs: [] }, "Full: 5 portions ready"],
	["Reserve_Using", { slots: [1, 1, 0.9, 0.5, 0.1], secs: [0, 0, 1, 5, 9] }, "Clicking: the empty slots refill side by side\n(the seconds left in each)"],
	["Reserve_Empty", { slots: [0.6, 0.4, 0.3, 0.2, 0.05], secs: [4, 6, 7, 8, 10], empty: true }, "Empty and clicked: the plate flashes red\nand shakes, no food drops"],
];
states.forEach(([name, o, note], i) => {
	const x = 30 + i * 520;
	reserve(board, name, x, 630, o);
	label(board, `${name}_Note`, x, 740, 460, 44, note, { size: 15, color: "#A9CBEF", align: "left" });
});

cmds.push({ command: "file.export", params: { ids: [{ $step: board }], format: "png", scale: 1, path: PREVIEW } });
fs.writeFileSync(SCRIPT, JSON.stringify(cmds, null, 1));
console.log(`${cmds.length} steps -> ${SCRIPT}`);
