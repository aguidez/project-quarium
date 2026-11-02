// FigCraft script: the three lobby leaderboards (V2 arcade style on driftwood signs), LeaderboardBoard.tsx.
// Usage: node design/ui/leaderboards.build.js <script.json>
//        figcraft-cli run <script.json> --out design/ui/leaderboards.figcraft
// The run also exports design/previews/leaderboards-mockup.png and leaderboard-titles-mockup.png (in the same session, which has the Roblox fonts).
const fs = require("fs");
const path = require("path");
const localConfig = require("../../tools/local-config");

const SCRIPT = process.argv[2] || path.join(__dirname, "leaderboards.json");
const PREVIEW = path.join(__dirname, "..", "previews", "leaderboards-mockup.png").split(path.sep).join("/");
const TITLES_PREVIEW = path.join(__dirname, "..", "previews", "leaderboard-titles-mockup.png").split(path.sep).join("/");
const UI = __dirname.split(path.sep).join("/");
const FONTS = localConfig.robloxFontsDir().split(path.sep).join("/");
const cmds = [];
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/LuckiestGuy-Regular.ttf" } });
cmds.push({ command: "text.loadFont", params: { path: FONTS + "/FredokaOne-Regular.ttf" } });
const OUT = "#071320";
const TITLE = "Luckiest Guy";
const BODY = "Fredoka One";
const PAL = {
	green: ["#8CF5A8", "#2ECC71", "#1C9C52", "#0E6332"],
	lagoon: ["#8AF7F9", "#00C2CB", "#00939C", "#005A61"],
	gold: ["#FFF3A0", "#FFD233", "#F0A500", "#8F5A00"],
	silver: ["#F4F7FA", "#AEBBC8", "#8C99A6", "#4A5866"],
	bronze: ["#F7B48A", "#C0672F", "#93461C", "#4E220C"], // copper: far from the gold
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
function image(parent, name, file, x, y, w, h) {
	cmds.push({ command: "image.place", params: { path: `${UI}/${file}`, parent: { $step: parent }, x, y, width: w, height: h, mode: "fit" } });
	const id = cmds.length - 1;
	cmds.push({ command: "node.set", params: { ids: [{ $step: id }], name } });
	return id;
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
const line = (color, weight) => ({ strokes: [color], strokeWeight: weight, strokeAlign: "inside" });
/** A round frame (an ellipse cannot hold children). */
const circle = (parent, name, x, y, s, props) => add("frame", parent, name, x, y, s, s, { cornerRadius: s / 2, ...props });

// --- Icons (drawn, nothing uploaded but the Ocean side icon the game already has) ---
function coinIcon(parent, x, y, s) {
	const c = circle(parent, "Coin", x, y, s, { fills: vgrad("#FFE680", "#E89A00"), ...line(OUT, Math.max(s * 0.06, 1.5)) });
	add("ellipse", c, "Inner", s * 0.17, s * 0.17, s * 0.66, s * 0.66, { fills: vgrad("#FFF4B0", "#FFC21A"), ...line("#C27C00", Math.max(s * 0.04, 1)) });
	label(c, "Symbol", 0, s * 0.06, s, s, "$", { font: TITLE, size: Math.floor(s * 0.46), color: "#B86E00" });
}
function clockIcon(parent, x, y, s) {
	const c = circle(parent, "Clock", x, y, s, { fills: vgrad("#FFFFFF", "#D8F7E2"), ...line(OUT, Math.max(s * 0.08, 1.5)) });
	const w = Math.max(s * 0.1, 2);
	add("rectangle", c, "HandUp", s / 2 - w / 2, s * 0.2, w, s * 0.32, { fill: OUT, cornerRadius: w / 2 });
	add("rectangle", c, "HandRight", s / 2 - w / 2, s / 2 - w / 2, s * 0.26, w, { fill: "#1C9C52", cornerRadius: w / 2 });
}
function boardIcon(parent, kind, x, y, s) {
	if (kind === "ocean") image(parent, "Ocean", "v2/Icon_Ocean.png", x, y, s, s);
	else if (kind === "income") coinIcon(parent, x, y, s);
	else clockIcon(parent, x, y, s);
}

// --- One board face: 440 x 540 design px, scaled by k (the side boards are smaller signs) ---
const BOARDS = {
	ocean: {
		title: "OCEAN LEGENDS",
		subtitle: "MOST OCEAN POINTS",
		pal: PAL.lagoon,
		value: "#8AF7F9",
		rows: [["DeepBlueKai", "48,210"], ["CoralQueen", "41,975"], ["Bubbles_77", "39,402"], ["NemoHunter", "31,880"], ["TideRider", "27,515"], ["SaltyPearl", "25,040"], ["ReefWalker", "22,318"], ["Moonjelly", "19,906"], ["Captain_Fin", "18,422"], ["LagoonLuna", "16,730"]],
		you: ["#27", "6,412"],
	},
	income: {
		title: "RICHEST TANKS",
		subtitle: "COINS PER SECOND",
		pal: PAL.gold,
		value: "#FFD233",
		rows: [["CoralQueen", "$18.4M/s"], ["DeepBlueKai", "$12.9M/s"], ["GoldenGill", "$9.75M/s"], ["SaltyPearl", "$7.2M/s"], ["Bubbles_77", "$5.1M/s"], ["TideRider", "$3.8M/s"], ["ReefWalker", "$2.6M/s"], ["NemoHunter", "$1.9M/s"], ["Moonjelly", "$1.2M/s"], ["Captain_Fin", "$980K/s"]],
		you: ["#4", "$7.2M/s"],
		youRow: 3,
	},
	time: {
		title: "DEVOTED KEEPERS",
		subtitle: "TIME WITH THEIR AQUARIUM",
		pal: PAL.green,
		value: "#8CF5A8",
		rows: [["ReefWalker", "212h 05m"], ["Moonjelly", "187h 40m"], ["DeepBlueKai", "164h 12m"], ["LagoonLuna", "150h 58m"], ["CoralQueen", "133h 21m"], ["TideRider", "121h 09m"], ["Bubbles_77", "98h 44m"], ["Captain_Fin", "87h 30m"], ["SaltyPearl", "76h 02m"], ["GoldenGill", "64h 18m"]],
		you: ["100+", "3h 42m"],
	},
};
function face(parent, kind, x, y, k) {
	const b = BOARDS[kind];
	const r = (v) => Math.round(v * k);
	const W = 440;
	const H = 540;
	const root = add("frame", parent, `Board_${kind}`, x, y, r(W), r(H + 8), {});
	add("rectangle", root, "Shadow", 0, r(8), r(W), r(H), { fill: "#050B12", cornerRadius: r(26) });
	const body = add("frame", root, "Face", 0, 0, r(W), r(H), { fills: vgrad("#23446E", "#0F1B29"), cornerRadius: r(26), ...line(OUT, r(4)), clip: true });
	add("rectangle", body, "InnerRim", r(7), r(7), r(W - 14), r(H - 14), { fills: [], cornerRadius: r(20), ...line("#FFFFFF26", r(2)) });

	// Ribbon title with the board's medallion on its left
	const band = add("frame", body, "Banner", r(46), r(16), r(370), r(58), { fills: vgrad(b.pal[0], b.pal[1]), cornerRadius: r(14), ...line(OUT, r(4)) });
	add("rectangle", band, "Gloss", r(6), r(4), r(358), r(22), { fill: "#FFFFFF", opacity: 0.3, cornerRadius: r(10) });
	label(band, "Title", r(40), r(2), r(322), r(56), b.title, { font: TITLE, size: r(29), stroke: b.pal[3], strokeWeight: r(3) });
	const medal = circle(body, "Medallion", r(14), r(8), r(74), { fills: vgrad(b.pal[0], b.pal[2]), ...line(OUT, r(4)) });
	boardIcon(medal, kind, r(13), r(13), r(48));
	label(body, "Subtitle", r(40), r(80), r(360), r(24), b.subtitle, { size: r(16), color: "#A9CBEF" });

	// Ten visible rows (36 px each), a scroll bar on the right: the list goes on to the 100th
	const list = add("frame", body, "List", r(16), r(112), r(408), r(362), { clip: true });
	b.rows.forEach(([name, value], i) => {
		const you = b.youRow === i;
		const row = add("frame", list, `Row${i + 1}`, 0, r(i * 36), r(392), r(32), { fills: vgrad(you ? "#2E6B4A" : "#2B5182", you ? "#1B4732" : "#1A3456"), cornerRadius: r(10), ...line(you ? PAL.green[1] : OUT, r(you ? 3 : 2)) });
		const medalPal = [PAL.gold, PAL.silver, PAL.bronze][i];
		if (medalPal) {
			const m = circle(row, "Medal", r(5), r(3), r(26), { fills: vgrad(medalPal[0], medalPal[1]), ...line(OUT, r(2)) });
			label(m, "Rank", 0, r(1), r(26), r(26), String(i + 1), { font: TITLE, size: r(16), stroke: medalPal[3], strokeWeight: r(2) });
		} else {
			label(row, "Rank", r(2), 0, r(32), r(32), String(i + 1), { font: TITLE, size: r(16), color: "#A9CBEF", stroke: OUT, strokeWeight: r(2) });
		}
		const avatar = circle(row, "Avatar", r(38), r(3), r(26), { fill: "#9FC3E8", ...line(OUT, r(2)) });
		add("ellipse", avatar, "Head", r(8), r(5), r(10), r(10), { fill: "#FFE0BD" });
		label(row, "Name", r(72), 0, r(170), r(32), name, { size: r(17), align: "left", stroke: OUT, strokeWeight: r(1.5) });
		label(row, "Value", r(232), 0, r(126), r(32), value, { font: TITLE, size: r(18), color: b.value, align: "right", stroke: OUT, strokeWeight: r(2) });
		boardIcon(row, kind, r(364), r(5), r(22));
	});
	add("rectangle", list, "ScrollTrack", r(400), 0, r(6), r(362), { fill: "#0A1624", cornerRadius: r(3) });
	add("rectangle", list, "ScrollThumb", r(400), 0, r(6), r(40), { fill: b.pal[1], cornerRadius: r(3) });

	// The local player: their rank and value, even beyond the 100th
	const foot = add("frame", body, "You", r(16), r(484), r(408), r(42), { fills: vgrad("#2E6B4A", "#1B4732"), cornerRadius: r(12), ...line(PAL.green[1], r(3)) });
	const chip = add("frame", foot, "YouChip", r(8), r(7), r(56), r(28), { fills: vgrad(PAL.green[0], PAL.green[1]), cornerRadius: r(14), ...line(OUT, r(2.5)) });
	label(chip, "Text", 0, r(1), r(56), r(28), "YOU", { font: TITLE, size: r(17), stroke: PAL.green[3], strokeWeight: r(2) });
	label(foot, "Rank", r(72), 0, r(90), r(42), b.you[0], { font: TITLE, size: r(22), align: "left", stroke: OUT, strokeWeight: r(2) });
	label(foot, "Value", r(170), 0, r(196), r(42), b.you[1], { font: TITLE, size: r(20), color: b.value, align: "right", stroke: OUT, strokeWeight: r(2) });
	boardIcon(foot, kind, r(372), r(9), r(24));
	return root;
}

// --- The scene: three driftwood signs on the promenade, the Ocean one in the middle and taller ---
const SCENE_W = 1600;
const SCENE_H = 940;
const scene = add("frame", undefined, "Leaderboards_Mockup", 0, 0, SCENE_W, SCENE_H, { fills: vgrad("#7FD3F7", "#D6F4FF") });
add("rectangle", scene, "Sea", 0, 560, SCENE_W, 120, { fills: vgrad("#2BC4D3", "#17707F") });
add("rectangle", scene, "Sand", 0, 680, SCENE_W, SCENE_H - 680, { fills: vgrad("#F6E6C2", "#F0DDB2") });
add("rectangle", scene, "Deck", 0, 820, SCENE_W, SCENE_H - 820, { fills: vgrad("#E2C79C", "#D2AE82") });
label(scene, "Caption", 30, 16, 1200, 30, "LEADERBOARDS: north-west corner of the beach, along the north fence, facing the tanks. Top 10 shown, scroll to 100, own rank at the bottom", { size: 18, color: "#0F3550", align: "left" });

function sign(kind, x, yBottom, k, starfish) {
	const w = Math.round(440 * k);
	const h = Math.round(540 * k);
	const y = yBottom - h - 90;
	const g = add("frame", scene, `Sign_${kind}`, x - 24, y - 24, w + 48, yBottom - y + 24, {});
	// Driftwood posts down to the sand, rope wraps
	for (const px of [6, w + 18]) {
		add("rectangle", g, "Post", px, 30, 24, yBottom - y - 6, { fills: vgrad("#B9946A", "#8E6B44"), cornerRadius: 8, ...line(OUT, 2) });
		add("rectangle", g, "Rope", px - 3, h + 60, 30, 14, { fill: "#F6F1E7", cornerRadius: 6, ...line("#B9A98A", 2) });
	}
	// Whitewashed plank frame around the face
	add("rectangle", g, "Frame", 0, 0, w + 48, h + 48, { fills: vgrad("#F6F1E7", "#DCCFB8"), cornerRadius: 22, ...line("#8E6B44", 3) });
	add("rectangle", g, "PlankLine", 0, Math.round((h + 48) / 2), w + 48, 3, { fill: "#C9B79A" });
	face(g, kind, 24, 24, k);
	if (starfish) {
		// Coral starfish nailed on the top edge, like the welcome sign's
		const R = 46;
		const rr = 20;
		const pts = [];
		for (let i = 0; i < 10; i++) {
			const a = -Math.PI / 2 + (i * Math.PI) / 5;
			const rad = i % 2 === 0 ? R : rr;
			pts.push(`${(R + Math.cos(a) * rad).toFixed(1)} ${(R + Math.sin(a) * rad).toFixed(1)}`);
		}
		cmds.push({ command: "vector.create", params: { path: `M ${pts.join(" L ")} Z`, parent: { $step: g }, x: (w + 48) / 2 - R, y: -38, props: { name: "Starfish", fills: vgrad("#FFB08F", "#FF7A5C"), stroke: OUT, strokeWeight: 3 } } });
	}
}
const K_SIDE = 0.74;
const yGround = 870;
sign("ocean", 580, yGround, 1, true);
sign("income", 580 - 48 - 30 - Math.round(440 * K_SIDE), yGround, K_SIDE, false);
sign("time", 580 + 440 + 48 + 30, yGround, K_SIDE, false);

cmds.push({ command: "file.export", params: { ids: [{ $step: scene }], format: "png", scale: 1, path: PREVIEW } });

// --- The leaderboard titles: a nameplate above the head, one per board, in four tiers (TitleService) ---
// Gold = #1, Silver = #2, Bronze = #3 (copper, far from the gold), Common = #4 to #10 (navy, the real rank in its badge)
const TIERS = {
	Gold: { face: ["#FFF3A0", "#FFD233"], badge: ["#FFF3A0", "#F0A500"], shadow: "#8F5A00", sparkles: 2 },
	Silver: { face: ["#FFFFFF", "#C3CEDA"], badge: ["#FFFFFF", "#8C99A6"], shadow: "#46525E", sparkles: 1 },
	Bronze: { face: ["#F7B48A", "#C0672F"], badge: ["#F7B48A", "#93461C"], shadow: "#4E220C", sparkles: 0 },
	Common: { face: ["#2F5684", "#1E3A5C"], badge: ["#8AF7F9", "#00939C"], shadow: "#08121D", badgeShadow: "#005A61", sparkles: 0 },
};
const TITLES = [
	["ocean", "OCEAN LEGEND", 232],
	["income", "TANK TYCOON", 214],
	["time", "DEVOTED KEEPER", 268],
];
function nameplate(parent, x, y, tierName, rank, kind, text, textW) {
	const tier = TIERS[tierName];
	const H = 56;
	const w = 74 + textW + 58;
	const root = add("frame", parent, `Plate_${kind}_${tierName}`, x, y, w, H + 6, {});
	add("rectangle", root, "Shadow", 0, 6, w, H, { fill: tier.shadow, cornerRadius: H / 2, ...line(OUT, 3) });
	const face = add("frame", root, "Face", 0, 0, w, H, { fills: vgrad(tier.face[0], tier.face[1]), cornerRadius: H / 2, ...line(OUT, 3) });
	add("rectangle", face, "Gloss", 30, 4, w - 60, 20, { fill: "#FFFFFF", opacity: tierName === "Common" ? 0.12 : 0.35, cornerRadius: 10 });
	label(face, "Title", 70, 1, textW + 4, H, text, { font: TITLE, size: 28, stroke: tier.shadow === "#08121D" ? OUT : tier.shadow, strokeWeight: 3 });
	boardIcon(face, kind, w - 50, 9, 38);
	const badge = circle(root, "RankBadge", -8, -5, 66, { fills: vgrad(tier.badge[0], tier.badge[1]), ...line(OUT, 3) });
	label(badge, "Rank", 0, 2, 66, 66, String(rank), { font: TITLE, size: rank >= 10 ? 26 : 32, stroke: tier.badgeShadow || tier.shadow, strokeWeight: 3 });
	if (tier.sparkles >= 1) image(root, "Sparkle1", "v2/Sparkle.png", w - 30, -12, 26, 26);
	if (tier.sparkles >= 2) image(root, "Sparkle2", "v2/Sparkle.png", 52, H - 8, 18, 18);
	return root;
}
const TITLE_SCENE_W = 1640;
const titleScene = add("frame", undefined, "LeaderboardTitles_Mockup", 0, SCENE_H + 80, TITLE_SCENE_W, 500, { fills: vgrad("#7FD3F7", "#D6F4FF") });
label(titleScene, "Caption", 30, 16, 1500, 30, "LEADERBOARD TITLES: the day's top 10 of each board (taken at midnight UTC). Gold #1, Silver #2, Bronze #3, Common #4 to #10", { size: 18, color: "#0F3550", align: "left" });
const tierNames = ["Gold", "Silver", "Bronze", "Common"];
tierNames.forEach((tierName, col) => {
	label(titleScene, `Tier_${tierName}`, 40 + col * 400, 62, 360, 30, tierName.toUpperCase() + (col < 3 ? `  (#${col + 1})` : "  (#4 TO #10)"), { font: TITLE, size: 22, color: "#FFFFFF", stroke: OUT, strokeWeight: 3, align: "left" });
	TITLES.forEach(([kind, text, textW], row) => {
		nameplate(titleScene, 50 + col * 400, 120 + row * 110, tierName, col < 3 ? col + 1 : 7, kind, text, textW);
	});
});
label(titleScene, "Permanent", 40, 450, 900, 30, "The quest / Ocean titles keep their plain gold text: the plate marks a title that is held, not owned.", { size: 16, color: "#0F3550", align: "left" });
cmds.push({ command: "file.export", params: { ids: [{ $step: titleScene }], format: "png", scale: 1, path: TITLES_PREVIEW } });
fs.writeFileSync(SCRIPT, JSON.stringify(cmds, null, 1));
console.log(`${cmds.length} steps -> ${SCRIPT}`);
