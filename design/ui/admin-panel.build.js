// FigCraft script: the admin panel mock-up (V2 arcade style), the Studio admin tools (AdminPanel.tsx).
// Usage: node design/ui/admin-panel.build.js <script.json>
//        figcraft-cli run <script.json> --out design/ui/admin-panel.figcraft
// The run also exports design/previews/admin-panel-mockup.png (in the same session, which has the Roblox fonts).
const fs = require("fs");
const path = require("path");
const localConfig = require("../../tools/local-config");

const SCRIPT = process.argv[2] || path.join(__dirname, "admin-panel.json");
const PREVIEW = path.join(__dirname, "..", "previews", "admin-panel-mockup.png").split(path.sep).join("/");
const FONTS = localConfig.robloxFontsDir().split(path.sep).join("/");
const cmds = [];
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/LuckiestGuy-Regular.ttf" } });
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/FredokaOne-Regular.ttf" } });
const OUT = "#071320";
const TITLE = "Luckiest Guy";
const BODY = "Fredoka One";
const PAL = {
	green: ["#8CF5A8", "#2ECC71", "#1C9C52", "#0E6332"],
	red: ["#FF9AA6", "#FF4D5E", "#D92B45", "#7E0E22"],
	purple: ["#D9ABFF", "#A55CFF", "#7C34D9", "#44167F"],
	lagoon: ["#8AF7F9", "#00C2CB", "#00939C", "#005A61"],
	amber: ["#FFE8A8", "#F5A623", "#D9860C", "#7A4A06"],
	gold: ["#FFF3A0", "#FFD233", "#F0A500", "#8F5A00"],
	navy: ["#2F5684", "#1E3A5C", "#162C46", "#08121D"],
};
const vgrad = (a, b) => [{ type: "linearGradient", stops: [a, b], from: [0.5, 0], to: [0.5, 1] }];
function add(type, parent, name, x, y, w, h, props = {}, text) {
	const p = parent !== undefined ? { $step: parent } : undefined;
	if (type === "text") {
		// Like redesign-v2.build.js: the box size in the props, set after the text, so it doesn't hug it
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
function button(parent, name, x, y, w, h, pal, text, o = {}) {
	const depth = o.depth || 6;
	const r = o.radius || 14;
	const root = add("frame", parent, name, x, y, w, h + depth, {});
	add("rectangle", root, "Shadow", 0, depth, w, h, { fill: pal[3], cornerRadius: r, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const face = add("frame", root, "Face", 0, 0, w, h, { fills: vgrad(pal[0], pal[1]), cornerRadius: r, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	add("rectangle", face, "Gloss", 6, 4, w - 12, Math.round(h * 0.4), { fill: "#FFFFFF", opacity: 0.25, cornerRadius: Math.max(r - 4, 2) });
	label(face, "Label", 4, 1, w - 8, h - 2, text, { font: TITLE, size: o.size || 22, stroke: pal[3] });
	return root;
}
function chip(parent, name, x, y, w, h, color, text, textColor = OUT) {
	const c = add("frame", parent, name, x, y, w, h, { fill: color, cornerRadius: h / 2, strokes: [OUT], strokeWeight: 2.5, strokeAlign: "inside" });
	label(c, "Text", 0, 0, w, h, text, { size: Math.floor(h * 0.6), color: textColor });
	return c;
}
function card(parent, name, x, y, w, h, outline = OUT) {
	const root = add("frame", parent, name, x, y, w, h + 5, {});
	add("rectangle", root, "Shadow", 0, 5, w, h, { fill: "#08121D", cornerRadius: 18, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const face = add("frame", root, "Face", 0, 0, w, h, { fills: vgrad("#2B5182", "#1A3456"), cornerRadius: 18, strokes: [outline], strokeWeight: 3, strokeAlign: "inside" });
	return face;
}

// Board (dark game backdrop)
const board = add("frame", undefined, "AdminPanel_Mockup", 0, 0, 980, 820, { fill: "#16293D" });
label(board, "Caption", 30, 16, 900, 30, "ADMIN PANEL  (Studio only, this server)", { size: 18, color: "#A9CBEF", align: "left" });

// Window
const W = 600;
const win = add("frame", board, "AdminPanel", 60, 110, W, 680, {});
add("rectangle", win, "Shadow", 0, 10, W, 660, { fill: "#050B12", cornerRadius: 30 });
const body = add("frame", win, "Body", 0, 0, W, 660, { fills: vgrad("#23446E", "#0F1B29"), cornerRadius: 30, strokes: [OUT], strokeWeight: 4, strokeAlign: "inside" });
add("rectangle", body, "InnerRim", 7, 7, W - 14, 646, { fills: [], cornerRadius: 24, strokes: ["#FFFFFF26"], strokeWeight: 2, strokeAlign: "inside" });

// Banner ribbon + close button (overhang the top)
const band = add("frame", win, "Banner", W / 2 - 170, -36, 340, 58, { fills: vgrad(PAL.red[0], PAL.red[1]), cornerRadius: 14, strokes: [OUT], strokeWeight: 4, strokeAlign: "inside" });
label(band, "Title", 0, 2, 340, 56, "ADMIN", { font: TITLE, size: 36, stroke: PAL.red[3], strokeWeight: 4 });
button(win, "Close", W - 30, -22, 50, 50, PAL.red, "X", { radius: 25, depth: 5, size: 28 });

// Header chip
chip(body, "Scope", W / 2 - 150, 40, 300, 30, PAL.amber[1], "STUDIO ONLY - THIS SERVER");

// Tabs (QuestPanel's style: gold = open, navy = the others); Events is the first one, more admin tools come later
button(body, "Tab_Events", W / 2 - 75, 84, 150, 44, PAL.gold, "EVENTS", { size: 22 });

// Now playing
const now = card(body, "NowPlaying", 22, 146, W - 44, 78, PAL.gold[1]);
label(now, "Caption", 18, 10, 300, 20, "NOW PLAYING", { size: 15, color: "#A9CBEF", align: "left" });
label(now, "Name", 18, 30, 300, 36, "ISLAND BREEZE", { font: TITLE, size: 26, stroke: OUT, align: "left" });
chip(now, "Timer", 300, 24, 76, 30, PAL.gold[1], "0:42");
button(now, "Stop", W - 44 - 150, 12, 132, 50, PAL.red, "STOP");

// Section title
label(body, "Section", 22, 244, 400, 24, "START AN EVENT", { size: 18, color: "#A9CBEF", align: "left" });

const EVENTS = [
	{ name: "K-POP LIVE", icon: "♪", accents: ["#FF4FD8", "#9B5CFF"], kind: ["ADMIN ONLY", PAL.purple[1]] },
	{ name: "ISLAND BREEZE", icon: "♫", accents: ["#FFD23F", "#FF7A59"], kind: ["RECURRING", PAL.lagoon[1]] },
	{ name: "ABYSSAL RAID", icon: "", accents: ["#9CFFEA", "#FF4A3D"], kind: ["RECURRING", PAL.lagoon[1]] },
	{ name: "UFO NIGHT", icon: "UFO", accents: ["#5CFF7A", "#FF7AD9"], kind: ["RECURRING", PAL.lagoon[1]] },
];
EVENTS.forEach((e, i) => {
	const c = card(body, `Event_${e.name}`, 22, 276 + i * 90, W - 44, 76);
	const badge = add("ellipse", c, "Badge", 14, 12, 52, 52, { fills: vgrad(e.accents[0], e.accents[1]), strokes: ["#FFFFFF"], strokeWeight: 2, strokeAlign: "inside" });
	if (e.icon) label(c, "Icon", 14, 12, 52, 52, e.icon, { font: TITLE, size: e.icon.length > 1 ? 16 : 28, stroke: OUT, strokeWeight: 2 });
	label(c, "Name", 80, 8, 300, 34, e.name, { font: TITLE, size: 24, stroke: OUT, align: "left" });
	chip(c, "Kind", 80, 42, e.kind[0] === "RECURRING" ? 110 : 116, 24, e.kind[1], e.kind[0]);
	chip(c, "Duration", e.kind[0] === "RECURRING" ? 198 : 204, 42, 64, 24, "#9FC3E8", "1 MIN");
	button(c, "Start", W - 44 - 150, 12, 132, 50, PAL.green, "START");
});

// The button that opens it (bottom-left of the screen, instead of the 4 test buttons)
label(board, "ToggleCaption", 700, 560, 260, 24, "Opens the panel (bottom-left):", { size: 15, color: "#A9CBEF", align: "left" });
button(board, "AdminToggle", 700, 592, 150, 50, PAL.purple, "ADMIN");

cmds.push({ command: "file.export", params: { ids: [{ $step: board }], format: "png", scale: 1, path: PREVIEW } });
fs.writeFileSync(SCRIPT, JSON.stringify(cmds, null, 1));
console.log(`${cmds.length} steps -> ${SCRIPT}`);
