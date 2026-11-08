// FigCraft script: the Size score's mock-ups (V1.1.16, V2 arcade style): the hatch reveal's Size pill
// (EggReveal.tsx), the Ocean panel row's sizes (OceanPanel.tsx FishRow) and the Fish Index row's best Size
// (FishIndexPanel.tsx FishRow).
// Usage: node design/ui/size.build.js <script.json>
//        figcraft-cli run <script.json> --out design/ui/size.figcraft
// The run also exports design/previews/size-mockup.png (in the same session, which has the Roblox fonts).
const fs = require("fs");
const path = require("path");
const localConfig = require("../../tools/local-config");

const SCRIPT = process.argv[2] || path.join(__dirname, "size.json");
const UI = path.join(__dirname).split(path.sep).join("/");
const PREVIEW = path.join(__dirname, "..", "previews", "size-mockup.png").split(path.sep).join("/");
const FONTS = localConfig.robloxFontsDir().split(path.sep).join("/");
const cmds = [];
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/LuckiestGuy-Regular.ttf" } });
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/FredokaOne-Regular.ttf" } });
const OUT = "#071320";
const TITLE = "Luckiest Guy";
const BODY = "Fredoka One";
const MUTED = "#A9CBEF";
// Size tiers (theme.ts SIZE_TIER_STYLES): [light, base, dark, shadow]. Negative sizes in soft greys, never red
const TIER = {
	Tiny: ["#C9D3DC", "#8C99A6", "#6A7682", "#3A434C"],
	Small: ["#E4EBF1", "#B8C4CF", "#93A1AE", "#4E5A66"],
	Normal: ["#FFFFFF", "#DCE9F2", "#B5C8D6", "#5E7486"],
	Big: ["#C2FFD3", "#5BE37D", "#2EB357", "#11602A"],
	Huge: ["#BFF3FF", "#4FD2FF", "#1C9FD6", "#0A4F70"],
	Giant: ["#FFD9A8", "#FF9F43", "#E07816", "#7A3C06"],
	Titan: ["#FFF6B0", "#FFD233", "#FF7AB8", "#8F2A5A"],
};
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
function image(parent, file, x, y, w, h) {
	cmds.push({ command: "image.place", params: { path: `${UI}/${file}`, parent: { $step: parent }, x, y, width: w, height: h, mode: "fit" } });
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
// A 3D pill (kit Button3D look, not clickable): shadow, gradient face, gloss
function pill(parent, name, x, y, w, h, pal, text, o = {}) {
	const root = add("frame", parent, name, x, y, w, h + 5, {});
	add("rectangle", root, "Shadow", 0, 5, w, h, { fill: pal[3], cornerRadius: h / 2, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const face = add("frame", root, "Face", 0, 0, w, h, { fills: vgrad(o.top || pal[0], o.bottom || pal[1]), cornerRadius: h / 2, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	add("rectangle", face, "Gloss", 6, 4, w - 12, h * 0.36, { fill: "#FFFFFF", opacity: 0.35, cornerRadius: h * 0.18 });
	label(face, "Label", 0, 0, w, h, text, { font: o.font || TITLE, size: o.size || 22, stroke: pal[3], strokeWeight: o.strokeWeight || 3 });
	return root;
}
// A flat chip (kit Chip): outlined, dark text
function chip(parent, name, x, y, w, h, color, text, o = {}) {
	const root = add("frame", parent, name, x, y, w, h, { fill: color, cornerRadius: h / 2, strokes: [OUT], strokeWeight: 2.5, strokeAlign: "inside" });
	label(root, "Label", 0, 0, w, h, text, { size: o.size || 13, color: o.textColor || OUT });
	return root;
}
function sparkle(parent, name, x, y, s) {
	add("star", parent, name, x, y, s, s, { pointCount: 4, innerRadius: 0.3, fills: vgrad("#FFFFFF", "#FFF3A0"), strokes: [OUT], strokeWeight: 2, strokeAlign: "inside" });
}

const W = 1800;
const H = 980;
const board = add("frame", undefined, "Size_Mockup", 0, 0, W, H, { fill: "#0B1B2E", cornerRadius: 0 });
label(board, "Title", 30, 20, 1200, 44, "SIZE SCORE: every fish hatches -15% to +15% big, its coins as much", { font: TITLE, size: 30, align: "left", stroke: OUT });
label(board, "Sub", 30, 66, 1500, 24, "Hatch reveal (under the rarity line), Ocean panel (each row's fish, the smallest goes first), Fish Index (best of each species)", { size: 17, color: MUTED, align: "left" });

// --- A. Hatch reveal: the stage's caption (EggReveal), four cases ---------------------------------------------------
const REVEALS = [
	{ fish: "Clownfish", rarity: ["UNCOMMON  •  15%", "#5BE37D"], tier: "Huge", text: "SIZE +12%  •  HUGE", note: "NEW BEST SIZE FOR THIS SPECIES!" },
	{ fish: "ZebraDanio", rarity: ["UNCOMMON  •  40%", "#5BE37D"], tier: "Normal", text: "SIZE +2%  •  NORMAL" },
	{ fish: "RedTetra", rarity: ["COMMON  •  50%", "#CFE8F0"], tier: "Tiny", text: "SIZE -11%  •  TINY" },
	{ fish: "ImperialDiscus", rarity: ["RARE  •  20%", "#4FB3FF"], tier: "Titan", text: "SIZE +15%  •  TITAN!", note: "A PERFECT FISH! ONE EGG IN 1,800" },
];
const names = { Clownfish: "Clownfish", ZebraDanio: "Zebra Danio", RedTetra: "Red Tetra", ImperialDiscus: "Imperial Discus" };
REVEALS.forEach((r, i) => {
	const x = 30 + i * 440;
	const stage = add("frame", board, `Reveal_${r.tier}`, x, 110, 420, 430, { fill: "#000000", opacity: 1, cornerRadius: 24, fills: vgrad("#1B2E45", "#0E1A2A"), strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	if (r.tier === "Titan") {
		add("ellipse", stage, "Glow", 60, 20, 300, 220, { fills: [{ type: "radialGradient", stops: ["#FFD23399", "#FFD23300"] }] });
		sparkle(stage, "Spark1", 70, 50, 26);
		sparkle(stage, "Spark2", 320, 70, 20);
		sparkle(stage, "Spark3", 300, 190, 16);
	}
	image(stage, `fish/stickers/Icon_${r.fish}_Normal.png`, 82, 40, 256, 160);
	label(stage, "Title", 10, 214, 400, 38, `You hatched a ${names[r.fish]}!`, { font: TITLE, size: 26, stroke: OUT });
	label(stage, "Rarity", 10, 254, 400, 26, r.rarity[0], { size: 20, color: r.rarity[1], stroke: OUT, strokeWeight: 2.5 });
	const titan = r.tier === "Titan";
	pill(stage, "SizePill", 60, 292, 300, 42, TIER[r.tier], r.text, { font: BODY, size: 21, strokeWeight: 2.5, top: titan ? "#FFE45C" : undefined, bottom: titan ? "#FF7AB8" : undefined });
	if (r.note) label(stage, "Note", 10, 346, 400, 24, r.note, { size: 17, color: r.tier === "Titan" ? "#FFD233" : "#FFE27A", stroke: OUT, strokeWeight: 2.5 });
	label(stage, "Caption", 10, 386, 400, 30, ["New record: the pill pops, then the line", "An ordinary fish: a quiet grey-white pill", "A small one: soft grey, never red", "Titan: gold-to-pink pill, glow and sparkles"][i], { size: 14, color: MUTED });
});

// --- B. Ocean panel: a release row (OceanPanel FishRow) with its fish's sizes ---------------------------------------
label(board, "OceanTitle", 30, 566, 900, 28, "OCEAN PANEL: the sizes of the row's fish, smallest first (it is the one Release lets go)", { size: 18, color: MUTED, align: "left" });
function oceanRow(y, fish, name, rarity, count, sizes, extra) {
	const ROW_W = 860;
	const root = add("frame", board, `OceanRow_${fish}`, 30, y, ROW_W, 92, {});
	add("rectangle", root, "Shadow", 0, 5, ROW_W, 87, { fill: "#08121D", cornerRadius: 16, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const card = add("frame", root, "Card", 0, 0, ROW_W, 87, { fills: vgrad("#2B5182", "#1E3A5C"), cornerRadius: 16, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const icon = add("frame", card, "Icon", 10, 10, 100, 67, { fills: vgrad("#E9F3F8", "#B5C8D6"), cornerRadius: 12, strokes: [OUT], strokeWeight: 2.5, strokeAlign: "inside" });
	image(icon, `fish/stickers/Icon_${fish}_Normal.png`, 4, 4, 92, 58);
	label(card, "Name", 124, 8, 420, 24, name, { size: 19, align: "left", stroke: OUT, strokeWeight: 2.5 });
	label(card, "Details", 124, 32, 420, 18, `${rarity}  •  x${count} in your tank`, { size: 14, color: MUTED, align: "left" });
	// Sizes: one chip per fish, smallest first, the first one marked as the next to go
	let cx = 124;
	sizes.forEach((s, k) => {
		const tier = s <= -10 ? "Tiny" : s <= -4 ? "Small" : s <= 3 ? "Normal" : s <= 9 ? "Big" : s <= 12 ? "Huge" : s <= 14 ? "Giant" : "Titan";
		const text = (s > 0 ? `+${s}` : `${s}`) + "%";
		const w = k === 0 ? 92 : 50;
		chip(card, `Size${k}`, cx, 54, w, 22, TIER[tier][1], k === 0 ? `NEXT ${text}` : text, { size: 13 });
		cx += w + 6;
	});
	if (extra) label(card, "More", cx, 54, 80, 22, extra, { size: 13, color: MUTED, align: "left" });
	chip(card, "Gain", 594, 31, 84, 26, "#8AF7F9", "+15 PTS", { size: 15 });
	pill(card, "Release", 692, 22, 156, 40, ["#8AF7F9", "#00C2CB", "#00939C", "#005A61"], "RELEASE", { size: 17 });
}
oceanRow(604, "Clownfish", "Clownfish", "UNCOMMON", 4, [-6, 1, 8, 12]);
oceanRow(708, "ZebraDanio", "Zebra Danio", "UNCOMMON", 9, [-13, -4, 0, 2, 5, 9], "+3 more");
label(board, "OceanNote", 30, 812, 860, 40, "A long row shows its 6 smallest, then \"+3 more\". The rule line above the list becomes:\n\"Release lets go of the row's smallest fish (lowest Size).\"", { size: 14, color: MUTED, align: "left" });

// --- C. Fish Index: the row's info column (FishIndexPanel FishRow) with the species' best Size ----------------------
label(board, "IndexTitle", 940, 566, 840, 28, "FISH INDEX: the best Size ever hatched of each species, next to its rarity", { size: 18, color: MUTED, align: "left" });
function indexRow(y, fish, name, rarity, rarityColor, best, stats) {
	const ROW_W = 830;
	const root = add("frame", board, `IndexRow_${fish}`, 940, y, ROW_W, 126, {});
	add("rectangle", root, "Shadow", 0, 5, ROW_W, 121, { fill: "#08121D", cornerRadius: 16, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	const card = add("frame", root, "Card", 0, 0, ROW_W, 121, { fills: vgrad("#2B5182", "#1E3A5C"), cornerRadius: 16, strokes: [OUT], strokeWeight: 3, strokeAlign: "inside" });
	chip(card, "Rarity", 14, 14, 104, 22, rarityColor, rarity, { size: 13 });
	if (best) {
		const [s, tier] = best;
		const text = `BEST ${s > 0 ? "+" + s : s}%  •  ${tier.toUpperCase()}`;
		chip(card, "BestSize", 126, 14, 150, 22, TIER[tier][1], text, { size: 12 });
	} else {
		chip(card, "BestSize", 126, 14, 110, 22, "#3A5A80", "BEST: NONE YET", { size: 11, textColor: "#C9D3DC" });
	}
	label(card, "Name", 14, 40, 300, 26, name, { size: 22, align: "left", stroke: OUT, strokeWeight: 2.5 });
	label(card, "Stats", 14, 68, 300, 18, stats, { size: 15, color: "#FFD233", align: "left" });
	label(card, "Sources", 14, 88, 300, 16, "Freshwater Egg 40%", { size: 13, color: MUTED, align: "left" });
	["Normal", "Anomaly", "Ghost", "Shiny"].forEach((v, k) => {
		const slot = add("frame", card, `Slot_${v}`, 334 + k * 100, 14, 88, 88, { fills: vgrad("#E9F3F8", "#B5C8D6"), cornerRadius: 14, strokes: [OUT], strokeWeight: 2.5, strokeAlign: "inside" });
		image(slot, `fish/stickers/Icon_${fish}_${k < 2 ? v : "Normal"}.png`, 6, 18, 76, 52);
	});
}
indexRow(604, "ZebraDanio", "Zebra Danio", "UNCOMMON", "#5BE37D", [14, "Giant"], "150$ every 5s");
indexRow(742, "Clownfish", "Clownfish", "UNCOMMON", "#5BE37D", undefined, "180$ every 12s");
label(board, "IndexNote", 940, 876, 830, 40, "Titan cells get a gold-pink BEST chip; a species never hatched since the Size score came shows \"BEST: NONE YET\".", { size: 14, color: MUTED, align: "left" });

cmds.push({ command: "file.export", params: { ids: [{ $step: board }], format: "png", scale: 1, path: PREVIEW } });
fs.writeFileSync(SCRIPT, JSON.stringify(cmds, null, 1));
console.log(`${cmds.length} steps -> ${SCRIPT}`);
