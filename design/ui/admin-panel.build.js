// FigCraft script: the admin panel mock-up (V2 arcade style), the Studio admin tools (AdminPanel.tsx).
// Usage: node design/ui/admin-panel.build.js <script.json>
//        figcraft-cli run <script.json> --out design/ui/admin-panel.figcraft
// The run also exports design/previews/admin-panel-mockup.png, admin-aquariums-mockup.png (the Aquariums tab) and
// admin-servers-mockup.png (the Servers tab), in the same session, which has the Roblox fonts.
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
button(body, "Tab_Events", W / 2 - 157, 84, 150, 44, PAL.gold, "EVENTS", { size: 22 });
button(body, "Tab_Aquariums", W / 2 + 7, 84, 150, 44, PAL.navy, "AQUARIUMS", { size: 22 });

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

// ---------------------------------------------------------------------------------------------------------------
// Aquariums tab (V0.60.16): the players of this server (list), then one player's aquarium (its fish, remove / add)
// ---------------------------------------------------------------------------------------------------------------
const UI = __dirname.split(path.sep).join("/");
const PREVIEW_TANKS = path.join(__dirname, "..", "previews", "admin-aquariums-mockup.png").split(path.sep).join("/");
function image(parent, name, file, x, y, w, h) {
	const p = parent !== undefined ? { $step: parent } : undefined;
	cmds.push({ command: "image.place", params: { path: `${UI}/${file}`, parent: p, x, y, width: w, height: h, mode: "fit" } });
	const id = cmds.length - 1;
	cmds.push({ command: "node.set", params: { ids: [{ $step: id }], name } });
	return id;
}
/** The LB ban checkbox: a rounded box (red with a white tick when banned) and its caption. */
function checkbox(parent, name, x, y, checked) {
	const root = add("frame", parent, name, x, y, 112, 34, {});
	const box = add("frame", root, "Box", 0, 0, 34, 34, {
		fills: checked ? vgrad(PAL.red[0], PAL.red[1]) : vgrad("#0F2236", "#0A1826"),
		cornerRadius: 9,
		strokes: [checked ? OUT : "#9FC3E8"],
		strokeWeight: 3,
		strokeAlign: "inside",
	});
	if (checked)
		cmds.push({
			command: "vector.create",
			params: { path: "M 8 17 L 14 23 L 26 10", parent: { $step: box }, props: { name: "Tick", stroke: "#FFFFFF", strokeWeight: 5, strokeCap: "round", strokeJoin: "round", fill: "none" } },
		});
	label(root, "Caption", 42, 0, 70, 34, "LB BAN", { size: 18, color: checked ? PAL.red[0] : "#A9CBEF", align: "left" });
	return root;
}
/** A round avatar (in game: the player's headshot thumbnail). */
function avatar(parent, x, y, size, letter, pal) {
	const a = add("frame", parent, "Avatar", x, y, size, size, { fills: vgrad(pal[0], pal[2]), cornerRadius: size / 2, strokes: ["#FFFFFF"], strokeWeight: 3, strokeAlign: "inside" });
	label(a, "Letter", 0, 0, size, size, letter, { font: TITLE, size: Math.round(size * 0.5), stroke: OUT, strokeWeight: 2 });
	return a;
}
/** A window like the Events one, with the tabs, AQUARIUMS open. */
function window(parent, name, x, h) {
	const w = add("frame", parent, name, x, 110, W, h + 20, {});
	add("rectangle", w, "Shadow", 0, 10, W, h, { fill: "#050B12", cornerRadius: 30 });
	const b = add("frame", w, "Body", 0, 0, W, h, { fills: vgrad("#23446E", "#0F1B29"), cornerRadius: 30, strokes: [OUT], strokeWeight: 4, strokeAlign: "inside" });
	add("rectangle", b, "InnerRim", 7, 7, W - 14, h - 14, { fills: [], cornerRadius: 24, strokes: ["#FFFFFF26"], strokeWeight: 2, strokeAlign: "inside" });
	const ribbon = add("frame", w, "Banner", W / 2 - 170, -36, 340, 58, { fills: vgrad(PAL.red[0], PAL.red[1]), cornerRadius: 14, strokes: [OUT], strokeWeight: 4, strokeAlign: "inside" });
	label(ribbon, "Title", 0, 2, 340, 56, "ADMIN", { font: TITLE, size: 36, stroke: PAL.red[3], strokeWeight: 4 });
	button(w, "Close", W - 30, -22, 50, 50, PAL.red, "X", { radius: 25, depth: 5, size: 28 });
	chip(b, "Scope", W / 2 - 150, 40, 300, 30, PAL.amber[1], "THIS SERVER ONLY");
	button(b, "Tab_Events", W / 2 - 157, 84, 150, 44, PAL.navy, "EVENTS", { size: 22 });
	button(b, "Tab_Aquariums", W / 2 + 7, 84, 150, 44, PAL.gold, "AQUARIUMS", { size: 22 });
	return b;
}
const VARIANT_SLOT = { Normal: PAL.lagoon, Anomaly: PAL.purple, Ghost: ["#F2FBFF", "#CFEFFF", "#9FD6F0", "#4F8FB0"], Shiny: PAL.gold };
/** A fish of the tank: its sticker on its variant's colour, a small red X (or, armed, a red REMOVE? cover). */
function fishSlot(parent, x, y, size, fishType, variant, armed) {
	const pal = VARIANT_SLOT[variant];
	const root = add("frame", parent, `Fish_${fishType}_${variant}`, x, y, size, size + 4, {});
	add("rectangle", root, "Shadow", 0, 4, size, size, { fill: pal[3], cornerRadius: 14, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const face = add("frame", root, "Face", 0, 0, size, size, { fills: vgrad(pal[0], pal[1]), cornerRadius: 14, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	image(face, "Icon", `fish/stickers/Icon_${fishType}_${variant === "Normal" || fishType === "FrenchFish" || fishType === "Sugar" ? "Normal" : variant}.png`, 4, 10, size - 8, (size - 8) * 0.625);
	if (armed) {
		const cover = add("frame", face, "Confirm", 0, 0, size, size, { fills: [{ type: "solid", color: "#D92B45", opacity: 0.88 }], cornerRadius: 14, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
		label(cover, "Text", 0, 0, size, size, "REMOVE?", { font: TITLE, size: 15, stroke: PAL.red[3], strokeWeight: 2 });
	} else {
		button(root, "Remove", size - 22, -8, 28, 28, PAL.red, "X", { radius: 14, depth: 3, size: 15 });
	}
	return root;
}

const tanks = add("frame", undefined, "AdminAquariums_Mockup", 1040, 0, 1400, 1010, { fill: "#16293D" });
label(tanks, "Caption", 30, 16, 1300, 30, "ADMIN PANEL - AQUARIUMS TAB  (left: the players of this server;  right: MANAGE opens one aquarium)", { size: 18, color: "#A9CBEF", align: "left" });

// Left: the list
const list = window(tanks, "Players", 60, 640);
label(list, "Section", 22, 146, 400, 24, "PLAYERS ON THIS SERVER  (4)", { size: 18, color: "#A9CBEF", align: "left" });
const PLAYERS = [
	{ name: "DOT_Pinpin", letter: "D", pal: PAL.purple, rebirth: "REBIRTH 2", fish: "16/15", income: "143.9K $/S", ban: false },
	{ name: "CoralQueen", letter: "C", pal: PAL.lagoon, rebirth: "REBIRTH 2", fish: "15/15", income: "117.6K $/S", ban: false },
	{ name: "xXFishGodXx", letter: "X", pal: PAL.green, rebirth: "REBIRTH 1", fish: "12/15", income: "8.2K $/S", ban: true },
	{ name: "Bubbles", letter: "B", pal: PAL.amber, rebirth: "NO REBIRTH", fish: "4/10", income: "96 $/S", ban: false },
];
PLAYERS.forEach((p, i) => {
	const c = card(list, `Player_${p.name}`, 22, 178 + i * 108, W - 44, 94);
	avatar(c, 14, 15, 64, p.letter, p.pal);
	label(c, "Name", 90, 10, 280, 34, p.name.toUpperCase(), { font: TITLE, size: 24, stroke: OUT, align: "left" });
	chip(c, "Rebirth", 90, 50, 104, 24, PAL.purple[1], p.rebirth);
	chip(c, "Fish", 200, 50, 70, 24, "#9FC3E8", p.fish);
	chip(c, "Income", 276, 50, 104, 24, PAL.gold[1], p.income);
	checkbox(c, "LbBan", 398, 6, p.ban);
	button(c, "Manage", W - 44 - 136, 46, 120, 38, PAL.lagoon, "MANAGE", { size: 18, depth: 5 });
});

// Right: one aquarium
const tank = window(tanks, "Aquarium", 760, 860);
const head = card(tank, "Owner", 22, 146, W - 44, 76, PAL.gold[1]);
button(head, "Back", 12, 13, 96, 44, PAL.navy, "BACK", { size: 20, depth: 5 });
avatar(head, 120, 10, 56, "C", PAL.lagoon);
label(head, "Name", 186, 6, 240, 34, "CORALQUEEN", { font: TITLE, size: 24, stroke: OUT, align: "left" });
label(head, "Sub", 186, 40, 240, 24, "Rebirth 2 - 117.6K $/s", { size: 16, color: "#A9CBEF", align: "left" });
checkbox(head, "LbBan", W - 44 - 124, 21, false);

label(tank, "FishSection", 22, 240, 400, 24, "FISH  15 / 15", { size: 18, color: "#A9CBEF", align: "left" });
const TANK = [
	["ImperialDiscus", "Normal"], ["ImperialDiscus", "Normal"], ["ImperialDiscus", "Anomaly"], ["ImperialDiscus", "Normal"],
	["ImperialDiscus", "Ghost"], ["ImperialDiscus", "Normal"], ["PirateFish", "Normal"], ["PirateFish", "Shiny"],
	["SilverAngelfish", "Normal"], ["FlameGourami", "Normal"], ["ImperialDiscus", "Normal"], ["Sugar", "Normal"],
	["ImperialDiscus", "Normal"], ["FrenchFish", "Normal"], ["ImperialDiscus", "Normal"],
];
const SLOT = 78;
const GAP = 12;
const gridX = 22 + Math.floor((W - 44 - (6 * SLOT + 5 * GAP)) / 2);
TANK.forEach(([type, variant], i) => {
	fishSlot(tank, gridX + (i % 6) * (SLOT + GAP), 276 + Math.floor(i / 6) * (SLOT + GAP + 4), SLOT, type, variant, i === 9);
});

// Add a fish: species strip (scrolls), variant chips, ADD
const addCard = card(tank, "AddFish", 22, 566, W - 44, 262);
label(addCard, "Title", 18, 10, 300, 30, "ADD A FISH", { font: TITLE, size: 22, stroke: OUT, align: "left" });
const STRIP = ["Basic", "Big", "RedTetra", "Clownfish", "ZebraDanio", "FlameGourami", "SilverAngelfish"];
const PICK = 64;
STRIP.forEach((type, i) => {
	const x = 18 + i * (PICK + 9);
	const selected = type === "Clownfish";
	const s = add("frame", addCard, `Pick_${type}`, x, 48, PICK, PICK, { fills: vgrad("#2F5684", "#1E3A5C"), cornerRadius: 12, strokes: [selected ? PAL.gold[1] : OUT], strokeWeight: selected ? 4 : 3, strokeAlign: "inside" });
	image(s, "Icon", `fish/stickers/Icon_${type}_Normal.png`, 4, 12, PICK - 8, (PICK - 8) * 0.625);
});
add("rectangle", addCard, "ScrollBar", 18, 120, 230, 6, { fill: "#9FC3E8", cornerRadius: 3, opacity: 0.6 });
label(addCard, "Picked", 18, 132, 400, 28, "CLOWNFISH  -  Uncommon", { size: 18, color: "#FFFFFF", align: "left" });
const VARIANTS = [["NORMAL", PAL.lagoon], ["ANOMALY", PAL.purple], ["GHOST", ["#F2FBFF", "#CFEFFF", "#9FD6F0", "#4F8FB0"]], ["SHINY", PAL.gold]];
VARIANTS.forEach(([text, pal], i) => {
	button(addCard, `Variant_${text}`, 18 + i * 104, 176, 94, 40, i === 2 ? pal : PAL.navy, text, { size: 16, depth: 5 });
});
button(addCard, "Add", W - 44 - 124, 172, 108, 50, PAL.green, "ADD", { size: 24 });

cmds.push({ command: "file.export", params: { ids: [{ $step: tanks }], format: "png", scale: 1, path: PREVIEW_TANKS } });

// ---------------------------------------------------------------------------------------------------------------
// Servers tab (V0.60.18): the live servers and their versions, UPDATE OLD SERVERS (left: idle, right: armed)
// ---------------------------------------------------------------------------------------------------------------
const PREVIEW_SERVERS = path.join(__dirname, "..", "previews", "admin-servers-mockup.png").split(path.sep).join("/");
function serversWindow(parent, name, x, h) {
	const w = add("frame", parent, name, x, 110, W, h + 20, {});
	add("rectangle", w, "Shadow", 0, 10, W, h, { fill: "#050B12", cornerRadius: 30 });
	const b = add("frame", w, "Body", 0, 0, W, h, { fills: vgrad("#23446E", "#0F1B29"), cornerRadius: 30, strokes: [OUT], strokeWeight: 4, strokeAlign: "inside" });
	add("rectangle", b, "InnerRim", 7, 7, W - 14, h - 14, { fills: [], cornerRadius: 24, strokes: ["#FFFFFF26"], strokeWeight: 2, strokeAlign: "inside" });
	const ribbon = add("frame", w, "Banner", W / 2 - 170, -36, 340, 58, { fills: vgrad(PAL.red[0], PAL.red[1]), cornerRadius: 14, strokes: [OUT], strokeWeight: 4, strokeAlign: "inside" });
	label(ribbon, "Title", 0, 2, 340, 56, "ADMIN", { font: TITLE, size: 36, stroke: PAL.red[3], strokeWeight: 4 });
	button(w, "Close", W - 30, -22, 50, 50, PAL.red, "X", { radius: 25, depth: 5, size: 28 });
	chip(b, "Scope", W / 2 - 150, 40, 300, 30, PAL.amber[1], "LIVE - EVERY SERVER");
	button(b, "Tab_Events", W / 2 - 239, 84, 150, 44, PAL.navy, "EVENTS", { size: 22 });
	button(b, "Tab_Aquariums", W / 2 - 75, 84, 150, 44, PAL.navy, "AQUARIUMS", { size: 22 });
	button(b, "Tab_Servers", W / 2 + 89, 84, 150, 44, PAL.gold, "SERVERS", { size: 22 });
	return b;
}
const srv = add("frame", undefined, "AdminServers_Mockup", 2480, 0, 1400, 900, { fill: "#16293D" });
label(srv, "Caption", 30, 16, 1300, 30, "ADMIN PANEL - SERVERS TAB  (left: the live servers;  right: UPDATE clicked once, waiting for the confirmation)", { size: 18, color: "#A9CBEF", align: "left" });
const SERVERS = [
	{ version: "V0.60.18", place: 58, players: 8, newest: true, here: true },
	{ version: "V0.60.18", place: 58, players: 3, newest: true },
	{ version: "V0.60.17", place: 57, players: 6, newest: false },
	{ version: "V0.60.16", place: 56, players: 3, newest: false },
];
[false, true].forEach((armed, side) => {
	const win = serversWindow(srv, armed ? "Armed" : "Idle", 60 + side * 700, 740);
	const sum = card(win, "Newest", 22, 146, W - 44, 92, PAL.gold[1]);
	label(sum, "Caption", 18, 8, 300, 20, "NEWEST VERSION", { size: 15, color: "#A9CBEF", align: "left" });
	label(sum, "Version", 18, 28, 220, 40, "V0.60.18", { font: TITLE, size: 32, stroke: OUT, align: "left" });
	label(sum, "Place", 18, 64, 220, 20, "place version 58", { size: 15, color: "#A9CBEF", align: "left" });
	chip(sum, "Servers", 250, 34, 104, 28, "#9FC3E8", "4 SERVERS");
	chip(sum, "Old", 362, 34, 76, 28, PAL.red[1], "2 OLD", "#FFFFFF");
	chip(sum, "Players", 446, 34, 98, 28, PAL.gold[1], "20 PLAYERS");
	label(win, "Section", 22, 258, 400, 24, "LIVE SERVERS", { size: 18, color: "#A9CBEF", align: "left" });
	SERVERS.forEach((s, i) => {
		const row = card(win, `Server_${i}`, 22, 290 + i * 80, W - 44, 66, s.newest ? OUT : PAL.red[1]);
		label(row, "Version", 18, 6, 160, 32, s.version, { font: TITLE, size: 24, stroke: OUT, align: "left" });
		label(row, "Place", 18, 38, 160, 20, `place v${s.place}`, { size: 14, color: "#A9CBEF", align: "left" });
		chip(row, "State", 170, 20, s.newest ? 90 : 64, 26, s.newest ? PAL.green[1] : PAL.red[1], s.newest ? "NEWEST" : "OLD", s.newest ? OUT : "#FFFFFF");
		if (s.here) chip(row, "Here", s.newest ? 268 : 242, 20, 116, 26, PAL.amber[1], "THIS SERVER");
		label(row, "Players", W - 44 - 150, 16, 134, 34, `${s.players} PLAYERS`, { font: TITLE, size: 20, stroke: OUT, align: "right" });
	});
	button(win, "Update", 22, 624, W - 44, 58, PAL.red, armed ? "SURE? CLICK AGAIN" : "UPDATE 2 OLD SERVERS", { size: 26 });
	label(win, "Hint", 22, 692, W - 44, 24, armed ? "Their 9 players move to V0.60.18 in 5 s" : "Their players move to the newest version (a short teleport)", { size: 15, color: armed ? PAL.red[0] : "#A9CBEF" });
});
cmds.push({ command: "file.export", params: { ids: [{ $step: srv }], format: "png", scale: 1, path: PREVIEW_SERVERS } });
fs.writeFileSync(SCRIPT, JSON.stringify(cmds, null, 1));
console.log(`${cmds.length} steps -> ${SCRIPT}`);
