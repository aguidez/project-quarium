// FigCraft script: UI redesign V2 ("arcade aquatic"): the UI kit, then HUD, Quests and Fish Index mock-ups.
// Usage: node design/ui/redesign-v2.build.js <script.json> [previewDir]
//        figcraft-cli run <script.json> --out design/ui/redesign-v2.figcraft
// The fonts are the ones Roblox ships (Enum.Font.LuckiestGuy, Enum.Font.FredokaOne), loaded from the local
// Roblox install (Windows / macOS; robloxFontsDir in workspace.local.json otherwise). With a previewDir, the run
// also exports each board as a PNG (in the same session: a later `figcraft-cli render` wouldn't have the fonts).
//
// Depth recipe, the same for every clickable thing (it maps 1:1 to Roblox frames):
//   <Name>        container, height = face + depth
//   <Name>_Shadow the face's shape, darker, `depth` px lower (the button's side)
//   <Name>_Face   vertical gradient light -> base, 3 px dark outline (UIStroke Border), white Gloss on top
//   pressed       the face moves down by depth - 2 and its gradient darkens
const fs = require("fs");
const path = require("path");
const localConfig = require("../../tools/local-config");

const OUT = process.argv[2] || path.join(__dirname, "redesign-v2.json");
const PREVIEW = process.argv[3];
const UI = __dirname.split(path.sep).join("/");

function robloxFonts() {
	return localConfig.robloxFontsDir().split(path.sep).join("/");
}

// ---- Tokens ----
const C = {
	outline: "#071320", // every outline: buttons, cards, slots, text strokes on light faces
	navy: "#0F1B29",
	navy2: "#162436",
	text: "#FFFFFF",
	muted: "#A9CBEF",
	track: "#0A1624",
};
const TITLE = "Luckiest Guy";
const BODY = "Fredoka One";

/** light (top of the gradient), base (bottom), dark (pressed bottom), shadow (bevel side, text stroke). */
const PAL = {
	green: { light: "#8CF5A8", base: "#2ECC71", dark: "#1C9C52", shadow: "#0E6332" },
	blue: { light: "#7CC8FF", base: "#0A84FF", dark: "#0866CC", shadow: "#053D80" },
	lagoon: { light: "#8AF7F9", base: "#00C2CB", dark: "#00939C", shadow: "#005A61" },
	gold: { light: "#FFF3A0", base: "#FFD233", dark: "#F0A500", shadow: "#8F5A00" },
	red: { light: "#FF9AA6", base: "#FF4D5E", dark: "#D92B45", shadow: "#7E0E22" },
	purple: { light: "#D9ABFF", base: "#A55CFF", dark: "#7C34D9", shadow: "#44167F" },
	pink: { light: "#FFA8C4", base: "#FF5C8A", dark: "#D93A6A", shadow: "#7A1236" },
	navy: { light: "#2F5684", base: "#1E3A5C", dark: "#162C46", shadow: "#08121D" },
	grey: { light: "#C9D3DC", base: "#8C99A6", dark: "#6A7682", shadow: "#3A434C" },
	ghost: { light: "#E6FAFF", base: "#9FE3FF", dark: "#6CC4EA", shadow: "#2A6A85" },
	amber: { light: "#FFE8A8", base: "#F5A623", dark: "#D9860C", shadow: "#7A4A06" },
};
const VARIANT_PAL = { Normal: PAL.blue, Anomaly: PAL.purple, Ghost: PAL.ghost, Shiny: PAL.gold };
const RARITY = {
	COMMON: "#CFE8F0",
	UNCOMMON: "#5BE37D",
	RARE: "#4FB3FF",
	EPIC: "#C08BFF",
	LEGENDARY: "#FFC93C",
	MYTHIC: "#FF5C8A",
};

// ---- Script plumbing ----
const steps = [];
const add = (command, params) => {
	steps.push({ command, params });
	return { $step: steps.length - 1 };
};
const grad = (top, bottom) => ({ type: "linearGradient", stops: [top, bottom] });
const radial = (inner, outer) => ({
	type: "radialGradient",
	stops: [
		{ position: 0, color: inner },
		{ position: 1, color: outer },
	],
});
const outline = (color = C.outline, weight = 3) => ({ stroke: color, strokeWeight: weight, strokeAlign: "inside" });
const frame = (parent, name, x, y, w, h, props = {}) =>
	add("frame.create", { parent, name, x, y, width: w, height: h, props: { fill: "none", clip: false, ...props } });
const rect = (parent, name, x, y, w, h, props = {}) =>
	add("node.create", { type: "rectangle", parent, name, x, y, width: w, height: h, props });
const ellipse = (parent, name, x, y, w, h, props = {}) =>
	add("node.create", { type: "ellipse", parent, name, x, y, width: w, height: h, props });
/** Without x / y, the path's coordinates are the parent's. */
const vector = (parent, name, d, props = {}, at = {}) =>
	add("vector.create", { path: d, parent, ...at, props: { name, stroke: "none", ...props } });
const image = (parent, name, file, x, y, w, h, props = {}) => {
	const id = add("image.place", { path: `${UI}/${file}`, parent, x, y, width: w, height: h, mode: "fit" });
	add("node.set", { ids: [id], name, ...props });
	return id;
};
function text(parent, str, x, y, w, h, o = {}) {
	const { font = BODY, size = 18, color = C.text, stroke, strokeWeight = 3, align = "center", valign = "middle" } = o;
	return add("text.create", {
		text: str,
		parent,
		x,
		y,
		props: {
			name: o.name || str.slice(0, 32),
			fontFamily: font,
			fontStyle: "Regular",
			fontSize: size,
			fill: color,
			width: w,
			height: h,
			textAutoResize: "none",
			textAlign: align,
			textAlignVertical: valign,
			...(stroke ? { stroke, strokeWeight, strokeAlign: "outside", strokeJoin: "round" } : {}),
		},
	});
}
const r = (n) => Math.round(n * 10) / 10;

// ---- Components ----

/** The pseudo-3D button (see the header). */
function button(parent, name, x, y, w, h, pal, label, o = {}) {
	const { pressed = false, depth = 6, radius = 14, size = Math.round(h * 0.46), font = TITLE, color = C.text } = o;
	const root = frame(parent, pressed ? `${name}_Pressed` : name, x, y, w, h + depth);
	rect(root, `${name}_Shadow`, 0, depth, w, h, { fill: pal.shadow, cornerRadius: radius, ...outline() });
	const face = frame(root, `${name}_Face`, 0, pressed ? depth - 2 : 0, w, h, {
		fills: [pressed ? grad(pal.base, pal.dark) : grad(pal.light, pal.base)],
		cornerRadius: radius,
		clip: true,
		...outline(),
	});
	const gr = Math.max(radius - 4, 2);
	rect(face, "Gloss", 5, 4, w - 10, Math.round(h * 0.4), {
		fill: "#FFFFFF",
		opacity: pressed ? 0.12 : 0.3,
		cornerRadius: [gr, gr, 4, 4],
	});
	if (label) text(face, label, 4, 1, w - 8, h - 2, { font, size, color, stroke: pal.shadow, name: "Label" });
	return { root, face };
}

function closeButton(parent, x, y, pressed = false) {
	const s = 52;
	const { root, face } = button(parent, "CloseButton", x, y, s, s, PAL.red, undefined, { pressed, radius: 26, depth: 5 });
	const d = "M18 18 L34 34 M34 18 L18 34";
	vector(face, "Cross_Outline", d, { fill: "none", stroke: PAL.red.shadow, strokeWeight: 12, strokeCap: "round" });
	vector(face, "Cross", d, { fill: "none", stroke: "#FFFFFF", strokeWeight: 6, strokeCap: "round" });
	return root;
}

/** Ribbon title: a band with two notched tails folding behind it; it overhangs the modal's top edge. */
function banner(parent, name, cx, y, w, pal, title, size = 34) {
	const root = frame(parent, name, Math.round(cx - w / 2), y, w, 72);
	const tw = 64;
	const bx = 34;
	const line = { stroke: C.outline, strokeWeight: 3, strokeJoin: "round" };
	vector(root, "TailLeft", `M2 18 L${tw} 18 L${tw} 70 L2 70 L18 44 Z`, { fills: [grad(pal.base, pal.dark)], ...line });
	vector(root, "TailRight", `M${w - 2} 18 L${w - tw} 18 L${w - tw} 70 L${w - 2} 70 L${w - 18} 44 Z`, {
		fills: [grad(pal.base, pal.dark)],
		...line,
	});
	vector(root, "FoldLeft", `M${bx} 56 L${tw} 56 L${tw} 70 Z`, { fill: pal.shadow, ...line });
	vector(root, "FoldRight", `M${w - bx} 56 L${w - tw} 56 L${w - tw} 70 Z`, { fill: pal.shadow, ...line });
	const band = frame(root, "Band", bx, 0, w - 2 * bx, 58, {
		fills: [grad(pal.light, pal.base)],
		cornerRadius: 14,
		clip: true,
		...outline(C.outline, 4),
	});
	rect(band, "Gloss", 6, 5, w - 2 * bx - 12, 20, { fill: "#FFFFFF", opacity: 0.32, cornerRadius: [10, 10, 4, 4] });
	text(band, title, 0, 2, w - 2 * bx, 56, { font: TITLE, size, stroke: pal.shadow, strokeWeight: 4, name: "Title" });
	return root;
}

function coin(parent, name, x, y, s) {
	const root = frame(parent, name, x, y, s, s);
	ellipse(root, "Rim", 0, 0, s, s, { fills: [grad("#FFE680", "#E89A00")], ...outline(C.outline, 3) });
	ellipse(root, "Inner", r(s * 0.17), r(s * 0.17), r(s * 0.66), r(s * 0.66), {
		fills: [grad("#FFF4B0", "#FFC21A")],
		...outline("#C27C00", 2),
	});
	text(root, "$", 0, r(s * 0.04), s, s, { font: TITLE, size: Math.round(s * 0.46), color: "#B86E00", name: "Symbol" });
	ellipse(root, "Shine", r(s * 0.24), r(s * 0.16), r(s * 0.22), r(s * 0.12), { fill: "#FFFFFF", opacity: 0.75 });
	return root;
}

function badge(parent, x, y, label = "!", s = 28) {
	const root = frame(parent, "NotifBadge", x, y, s, s);
	ellipse(root, "Dot", 0, 0, s, s, { fills: [grad(PAL.red.light, PAL.red.base)], ...outline(C.outline, 3) });
	text(root, label, 0, 1, s, s, { font: TITLE, size: Math.round(s * 0.62), stroke: PAL.red.shadow, strokeWeight: 2 });
	return root;
}

function sparkle(parent, cx, cy, s, color = "#FFFFFF") {
	add("node.create", {
		type: "star",
		parent,
		name: "Sparkle",
		x: r(cx - s / 2),
		y: r(cy - s / 2),
		width: s,
		height: s,
		props: { fill: color, pointCount: 4, innerRadius: 0.32, stroke: C.outline, strokeWeight: 1.5 },
	});
}

function progress(parent, name, x, y, w, h, ratio, pal, label) {
	const root = frame(parent, name, x, y, w, h, {
		fill: C.track,
		cornerRadius: h / 2,
		clip: true,
		...outline(C.outline, 3),
	});
	const fw = Math.max(h, Math.round(w * ratio));
	rect(root, "Fill", 0, 0, fw, h, { fills: [grad(pal.light, pal.base)], cornerRadius: h / 2 });
	rect(root, "Gloss", 5, 4, Math.max(fw - 10, 4), r(h * 0.3), { fill: "#FFFFFF", opacity: 0.4, cornerRadius: h / 4 });
	text(root, label, 0, 1, w, h, { size: Math.round(h * 0.66), stroke: C.outline, strokeWeight: 2, name: "Label" });
	return root;
}

function chip(parent, name, x, y, w, h, fill, label, o = {}) {
	const root = frame(parent, name, x, y, w, h, { fill, cornerRadius: h / 2, ...outline(C.outline, 2.5) });
	text(root, label, 0, 0, w, h, {
		font: o.font || BODY,
		size: o.size || Math.round(h * 0.6),
		color: o.color || C.outline,
		stroke: o.stroke,
		strokeWeight: 2,
		name: "Label",
	});
	return root;
}

/** Square slot (UIAspectRatioConstraint 1): a sticker on a gradient by variant, or a dark "?" while not found. */
function itemSlot(parent, name, x, y, s, o = {}) {
	const pal = o.missing ? PAL.navy : o.pal;
	const depth = 4;
	const root = frame(parent, name, x, y, s, s + depth);
	rect(root, "Shadow", 0, depth, s, s, { fill: pal.shadow, cornerRadius: 16, ...outline() });
	const face = frame(root, "Face", 0, 0, s, s, {
		fills: [o.missing ? grad("#24456B", "#132A44") : grad(pal.light, pal.base)],
		cornerRadius: 16,
		clip: true,
		...outline(),
	});
	if (!o.missing) ellipse(face, "Glow", r(s * 0.08), r(s * 0.12), r(s * 0.84), r(s * 0.76), { fills: [radial("#FFFFFFB0", "#FFFFFF00")] });
	rect(face, "Gloss", 5, 4, s - 10, r(s * 0.3), { fill: "#FFFFFF", opacity: o.missing ? 0.08 : 0.28, cornerRadius: [12, 12, 4, 4] });
	const iw = r(s * 0.9);
	const ih = r(iw / 1.6);
	if (o.icon) {
		const img = image(face, "Icon", o.icon, r((s - iw) / 2), r((s - ih) / 2), iw, ih, o.missing ? { opacity: 0.55 } : {});
		if (o.missing) add("image.adjust", { ids: [img], filters: { exposure: -1, contrast: -0.4, saturation: -1 } });
	}
	if (o.missing) text(face, "?", 0, 2, s, s, { font: TITLE, size: Math.round(s * 0.42), color: "#CFE3F7", stroke: C.outline, strokeWeight: 3 });
	if (o.shiny) {
		sparkle(face, s * 0.2, s * 0.24, r(s * 0.2), "#FFFFFF");
		sparkle(face, s * 0.82, s * 0.7, r(s * 0.16), "#FFF3A0");
		sparkle(face, s * 0.78, s * 0.2, r(s * 0.1), "#FFFFFF");
	}
	return { root, face };
}

/** Panel card: same bevel as buttons but navy, so the content stays readable. */
function card(parent, name, x, y, w, h, o = {}) {
	const depth = 5;
	const root = frame(parent, name, x, y, w, h + depth);
	rect(root, `${name}_Shadow`, 0, depth, w, h, { fill: "#08121D", cornerRadius: 18, ...outline() });
	const face = frame(root, `${name}_Face`, 0, 0, w, h, {
		fills: [grad(o.top || "#2B5182", o.bottom || "#1A3456")],
		cornerRadius: 18,
		clip: true,
		...outline(o.stroke || C.outline, o.strokeWeight || 3),
	});
	rect(face, "TopLight", 10, 3, w - 20, 3, { fill: "#FFFFFF", opacity: 0.18, cornerRadius: 2 });
	return { root, face };
}

/** Modal: dark bevel, navy gradient, 4 px outline, faint inner rim, decorative bubbles. */
function modal(parent, name, x, y, w, h) {
	const root = frame(parent, name, x, y - 36, w, h + 36 + 10);
	rect(root, "MainModal_Shadow", 0, 46, w, h, { fill: "#050B12", cornerRadius: 30 });
	const body = frame(root, "MainModal", 0, 36, w, h, {
		fills: [grad("#23446E", C.navy)],
		cornerRadius: 30,
		clip: true,
		...outline(C.outline, 4),
	});
	rect(body, "InnerRim", 7, 7, w - 14, h - 14, { fill: "none", cornerRadius: 24, ...outline("#FFFFFF26", 2) });
	const bubbles = [
		[w - 96, h - 120, 64],
		[w - 46, h - 58, 26],
		[26, h - 64, 34],
		[w - 150, h - 44, 18],
	];
	bubbles.forEach(([bx, by, bs], i) =>
		ellipse(body, `Bubble${i + 1}`, bx, by, bs, bs, { fill: "#FFFFFF0D", ...outline("#FFFFFF24", 2) }),
	);
	return { root, body };
}

// ---- Icons (64 x 64, drawn, no emoji) ----
function iconScroll(parent, x, y) {
	const f = frame(parent, "Icon_Quests", x, y, 64, 64);
	rect(f, "Paper", 14, 12, 36, 40, { fills: [grad("#FFF8E1", "#F3D493")], cornerRadius: 3, ...outline() });
	for (const [ly, lw] of [
		[23, 24],
		[30, 24],
		[37, 15],
	])
		rect(f, "Line", 20, ly, lw, 3.5, { fill: "#B07A2A", cornerRadius: 2 });
	rect(f, "RollTop", 8, 6, 48, 12, { fills: [grad("#F7CF7E", "#C98A2C")], cornerRadius: 6, ...outline() });
	rect(f, "RollBottom", 8, 46, 48, 12, { fills: [grad("#F7CF7E", "#C98A2C")], cornerRadius: 6, ...outline() });
	return f;
}
function iconBook(parent, x, y) {
	const f = frame(parent, "Icon_FishIndex", x, y, 64, 64);
	rect(f, "Pages", 15, 13, 40, 44, { fill: "#FFFFFF", cornerRadius: 6, ...outline() });
	rect(f, "Cover", 8, 7, 42, 46, { fills: [grad("#7CC8FF", "#0A6FD8")], cornerRadius: 7, ...outline() });
	rect(f, "Spine", 11, 10, 7, 40, { fill: "#0759B8", cornerRadius: [4, 0, 0, 4] });
	vector(f, "FishTail", "M24 30 L17 23 L17 37 Z", { fill: "#FFFFFF" });
	ellipse(f, "FishBody", 22, 23, 22, 14, { fill: "#FFFFFF" });
	ellipse(f, "FishEye", 37, 27, 4, 4, { fill: C.outline });
	return f;
}
function iconWave(parent, x, y) {
	const f = frame(parent, "Icon_Ocean", x, y, 64, 64);
	vector(
		f,
		"Wave",
		"M5 46 C8 28 20 14 36 15 C49 16 57 27 53 37 C49 29 39 29 37 37 C35 45 45 50 59 44 L59 56 C40 58 22 58 5 56 Z",
		{ fills: [grad("#8AF7F9", "#0A84FF")], stroke: C.outline, strokeWeight: 3, strokeJoin: "round" },
	);
	vector(f, "Foam", "M22 26 C27 19 36 18 42 21 C35 21 29 24 26 30 Z", { fill: "#FFFFFF", opacity: 0.85 });
	ellipse(f, "Drop1", 52, 8, 7, 7, { fill: "#FFFFFF", ...outline(C.outline, 2) });
	return f;
}
function iconRebirth(parent, x, y) {
	const f = frame(parent, "Icon_Rebirth", x, y, 64, 64);
	const cx = 32;
	const cy = 33;
	const rad = 18;
	const a0 = -50;
	const a1 = 215;
	const pts = [];
	for (let a = a0; a <= a1; a += 10) {
		const t = (a * Math.PI) / 180;
		pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]);
	}
	const d = "M" + pts.map(([px, py]) => `${r(px)} ${r(py)}`).join(" L");
	const end = (a1 * Math.PI) / 180;
	const [ex, ey] = [cx + rad * Math.cos(end), cy + rad * Math.sin(end)];
	const tan = [-Math.sin(end), Math.cos(end)];
	const nor = [Math.cos(end), Math.sin(end)];
	const tip = [ex + tan[0] * 12, ey + tan[1] * 12];
	const b1 = [ex + nor[0] * 10, ey + nor[1] * 10];
	const b2 = [ex - nor[0] * 10, ey - nor[1] * 10];
	vector(f, "Arc_Outline", d, { fill: "none", stroke: C.outline, strokeWeight: 14, strokeCap: "round", strokeJoin: "round" });
	vector(f, "Arrow", `M${r(b1[0])} ${r(b1[1])} L${r(tip[0])} ${r(tip[1])} L${r(b2[0])} ${r(b2[1])} Z`, {
		fill: "#FFE680",
		stroke: C.outline,
		strokeWeight: 3,
		strokeJoin: "round",
	});
	vector(f, "Arc", d, { fill: "none", stroke: "#FFD233", strokeWeight: 8, strokeCap: "round", strokeJoin: "round" });
	sparkle(f, 32, 33, 14, "#FFFFFF");
	return f;
}
function iconCompanion(parent, x, y) {
	const f = frame(parent, "Icon_Companions", x, y, 64, 64);
	image(f, "Snail", "companions/Companion_Snail.png", -4, 10, 72, 45);
	return f;
}
function heart(parent, x, y, s, color) {
	const k = s / 24;
	const p = (n) => r(n * k);
	return vector(
		parent,
		"Heart",
		`M${p(12)} ${p(21)} C${p(4)} ${p(15)} 0 ${p(11)} 0 ${p(6.5)} C0 ${p(3)} ${p(2.7)} 0 ${p(6)} 0 C${p(8.4)} 0 ${p(10.6)} ${p(1.4)} ${p(12)} ${p(3.5)} C${p(13.4)} ${p(1.4)} ${p(15.6)} 0 ${p(18)} 0 C${p(21.3)} 0 ${p(24)} ${p(3)} ${p(24)} ${p(6.5)} C${p(24)} ${p(11)} ${p(20)} ${p(15)} ${p(12)} ${p(21)} Z`,
		{ fill: color, stroke: C.outline, strokeWeight: 2.5, strokeJoin: "round" },
		{ x, y },
	);
}

/**
 * Side menu button: square 3D button, drawn icon and stroked label both inside the face (V0.34: a label over the
 * bottom edge got cut by the outline).
 */
function sideButton(parent, name, x, y, pal, label, drawIcon) {
	const { root, face } = button(parent, `SideBtn_${name}`, x, y, 86, 86, pal, undefined, { radius: 20 });
	drawIcon(face, 11, -2);
	text(face, label, 3, 62, 80, 18, { size: 12, stroke: pal.shadow, strokeWeight: 2.5, name: "Label" });
	return root;
}

// ---- Screen pieces ----
function aquariumBackground(parent) {
	rect(parent, "Water", 0, 0, 1280, 720, { fills: [grad("#63DDEE", "#0A5A88")] });
	for (const [x0, w0, x1, w1] of [
		[160, 70, 60, 200],
		[520, 50, 470, 170],
		[900, 80, 860, 230],
	])
		vector(parent, "LightRay", `M${x0} 0 L${x0 + w0} 0 L${x1 + w1} 620 L${x1} 620 Z`, { fill: "#FFFFFF", opacity: 0.07 });
	vector(parent, "Weed", "M120 640 C100 560 150 520 120 440 C160 500 150 560 150 640 Z", { fill: "#2E9E5B" });
	vector(parent, "Weed", "M150 640 C150 580 190 540 175 480 C205 540 190 590 180 640 Z", { fill: "#3DBA6C" });
	vector(parent, "Weed", "M1150 640 C1130 570 1180 520 1160 460 C1200 520 1190 580 1185 640 Z", { fill: "#2E9E5B" });
	vector(parent, "Sand", "M0 610 C200 585 420 625 640 600 C880 575 1080 620 1280 595 L1280 720 L0 720 Z", {
		fills: [grad("#F4DCA0", "#D7AE62")],
	});
	ellipse(parent, "Rock", 980, 590, 140, 70, { fills: [grad("#9AA9B4", "#5E6E7A")] });
	ellipse(parent, "Rock", 260, 600, 90, 46, { fills: [grad("#9AA9B4", "#5E6E7A")] });
	image(parent, "Fish_Clownfish", "fish/stickers/Icon_Clownfish_Normal.png", 690, 300, 190, 119);
	image(parent, "Fish_Guppy", "fish/stickers/Icon_Basic_Normal.png", 430, 420, 150, 94);
	image(parent, "Fish_Gourami", "fish/stickers/Icon_FlameGourami_Normal.png", 900, 420, 170, 106);
	image(parent, "Fish_Neon", "fish/stickers/Icon_Big_Normal.png", 520, 220, 140, 88);
	for (const [bx, by, bs] of [
		[640, 470, 18],
		[652, 430, 12],
		[630, 400, 9],
		[1040, 300, 16],
		[1050, 262, 10],
		[300, 330, 14],
	])
		ellipse(parent, "Bubble", bx, by, bs, bs, { fill: "#FFFFFF22", ...outline("#FFFFFF88", 2) });
}

function eggSlot(parent, x, y, egg, state, tag) {
	const pal = { buyable: PAL.green, unaffordable: PAL.grey, hatching: PAL.amber, ready: PAL.gold, locked: PAL.navy }[state];
	const { root, face } = button(parent, `EggSlot_${egg}`, x, y, 84, 84, pal, undefined, { radius: 18 });
	ellipse(face, "Glow", 8, 6, 68, 66, { fills: [radial(state === "locked" ? "#FFFFFF20" : "#FFFFFFB0", "#FFFFFF00")] });
	if (state === "locked") {
		image(face, "Gate", "eggs/LockedGate.png", 13, 14, 58, 43);
	} else {
		image(face, "Egg", `eggs/${egg}Egg.png`, 18, 6, 48, 58, state === "unaffordable" ? { opacity: 0.55 } : {});
		if (state === "hatching") image(face, "Crack", "eggs/EggCrack2.png", 18, 6, 48, 58);
		if (state === "ready") {
			sparkle(face, 16, 18, 14);
			sparkle(face, 70, 50, 10, "#FFF3A0");
		}
	}
	if (state === "ready") {
		const t = button(root, "OpenTag", 4, 68, 76, 28, PAL.green, "OPEN!", { depth: 4, radius: 10, size: 17 });
		return t;
	}
	const pill = frame(root, "PriceTag", 5, 70, 74, 26, { fills: [grad("#24456B", C.navy)], cornerRadius: 13, ...outline(C.outline, 2.5) });
	if (state === "buyable" || state === "unaffordable") {
		coin(pill, "Coin", 3, 3, 20);
		text(pill, tag, 22, 0, 50, 26, { size: 15, color: state === "buyable" ? "#FFD233" : "#FF8A8A", stroke: C.outline, strokeWeight: 2 });
	} else {
		text(pill, tag, 0, 0, 74, 26, {
			size: state === "locked" ? 13 : 16,
			color: state === "locked" ? "#9FB3C8" : "#FFE8A8",
			stroke: C.outline,
			strokeWeight: 2,
		});
	}
	return root;
}

function shopBar(parent) {
	const eggs = [
		["Common", "ready", ""],
		["Improved", "hatching", "0:42"],
		["Superior", "buyable", "2,500"],
		["Freshwater", "unaffordable", "25K"],
		["Amazon", "locked", "LOCKED"],
		["NeonCoral", "locked", "LOCKED"],
	];
	const W = 6 * 84 + 5 * 12 + 2 * 18;
	const H = 122;
	const root = frame(parent, "ShopBar", Math.round((1280 - W) / 2), 0, W, H + 6);
	rect(root, "ShopBar_Shadow", 0, 6, W, H, { fill: "#050B12", cornerRadius: [0, 0, 28, 28] });
	const face = frame(root, "ShopBar_Face", 0, 0, W, H, {
		fills: [grad("#23446E", C.navy)],
		cornerRadius: [0, 0, 28, 28],
		clip: true,
		...outline(C.outline, 4),
	});
	rect(face, "InnerRim", 7, -20, W - 14, H + 13, { fill: "none", cornerRadius: 22, ...outline("#5FE8FF40", 2) });
	eggs.forEach(([egg, state, tag], i) => eggSlot(face, 18 + i * 96, 10, egg, state, tag));
	return root;
}

function moneyCounter(parent, x, y, amount) {
	const W = 250;
	const root = frame(parent, "MoneyCounter", x, y, W + 10, 66);
	rect(root, "MoneyCounter_Shadow", 10, 6, W, 58, { fill: "#050B12", cornerRadius: 29 });
	const face = frame(root, "MoneyCounter_Face", 10, 0, W, 58, {
		fills: [grad("#23446E", C.navy)],
		cornerRadius: 29,
		clip: true,
		...outline(C.outline, 3),
	});
	rect(face, "GoldRim", 4, 4, W - 8, 50, { fill: "none", cornerRadius: 25, ...outline("#FFD23380", 2) });
	rect(face, "Gloss", 40, 5, W - 56, 16, { fill: "#FFFFFF", opacity: 0.1, cornerRadius: 8 });
	text(face, amount, 54, 2, W - 70, 56, { font: TITLE, size: 34, color: "#FFD233", stroke: "#4A2E00", strokeWeight: 3, align: "right" });
	coin(root, "CoinIcon", 0, -2, 64);
	return root;
}

function likePill(parent, x, y) {
	const W = 252;
	const root = frame(parent, "LikeBoostPill", x, y, W, 46);
	rect(root, "LikeBoostPill_Shadow", 0, 5, W, 40, { fill: PAL.pink.shadow, cornerRadius: 20, ...outline() });
	const face = frame(root, "LikeBoostPill_Face", 0, 0, W, 40, {
		fills: [grad(PAL.pink.light, PAL.pink.base)],
		cornerRadius: 20,
		clip: true,
		...outline(),
	});
	rect(face, "Gloss", 6, 4, W - 12, 14, { fill: "#FFFFFF", opacity: 0.3, cornerRadius: 7 });
	heart(face, 12, 9, 24, "#FFFFFF");
	text(face, "LIKED! COINS x2", 42, 1, 140, 38, { size: 16, stroke: PAL.pink.shadow, strokeWeight: 2.5, align: "left" });
	chip(face, "Timer", W - 70, 8, 60, 24, "#FFFFFF", "4:32", { size: 15, color: PAL.pink.shadow });
	return root;
}

function coachBubble(parent, x, y, title, body) {
	const W = 270;
	const root = frame(parent, "CoachBubble_Rebirth", x, y, W + 14, 82);
	vector(root, "Pointer", "M16 30 L0 40 L16 50 Z", { fill: "#FFD233", stroke: C.outline, strokeWeight: 3, strokeJoin: "round" });
	rect(root, "Shadow", 14, 6, W, 72, { fill: "#050B12", cornerRadius: 18 });
	const face = frame(root, "Face", 14, 0, W, 72, { fills: [grad("#23446E", C.navy)], cornerRadius: 18, clip: true, ...outline("#FFD233", 3) });
	text(face, title, 14, 8, W - 28, 28, { font: TITLE, size: 22, color: "#FFD233", stroke: C.outline, strokeWeight: 3, align: "left" });
	text(face, body, 14, 38, W - 28, 24, { size: 15, color: C.muted, align: "left" });
	return root;
}

function sideButtons(parent) {
	const col = frame(parent, "SideButtons", 18, 150, 120, 520);
	const rebirthY = 4 * 104;
	ellipse(col, "RebirthHalo", -18, rebirthY - 18, 116, 116, { fills: [radial("#FFD233D0", "#FFD23300")] });
	sideButton(col, "Quests", 0, 0, PAL.gold, "Quests", iconScroll);
	badge(col, 62, -8);
	sideButton(col, "Companions", 0, 104, PAL.green, "Companions", iconCompanion);
	sideButton(col, "FishIndex", 0, 208, PAL.blue, "Fish Index", iconBook);
	sideButton(col, "Ocean", 0, 312, PAL.lagoon, "Ocean", iconWave);
	sideButton(col, "Rebirth", 0, rebirthY, PAL.purple, "Rebirth", iconRebirth);
	badge(col, 62, rebirthY - 8);
	return col;
}

function screen(name, x, y) {
	const s = frame(undefined, name, x, y, 1280, 720, { fill: "#0A5A88", clip: true });
	aquariumBackground(s);
	return s;
}

// ================= BUILD =================
const FONTS = robloxFonts();
add("text.loadFont", { path: `${FONTS}/LuckiestGuy-Regular.ttf` });
add("text.loadFont", { path: `${FONTS}/FredokaOne-Regular.ttf` });
const boards = [];

// ---- 1. UI kit ----
{
	const kit = frame(undefined, "UIKit_V2", 0, 0, 1280, 1290, { fills: [grad("#163E60", "#0A1726")], clip: true });
	boards.push(["UIKit_V2", kit]);
	text(kit, "UI KIT V2", 40, 24, 600, 56, { font: TITLE, size: 48, stroke: C.outline, strokeWeight: 4, align: "left" });
	text(kit, "Arcade aquatic: Luckiest Guy titles, Fredoka One text, 3 px dark outlines, 6 px bevel under every button.", 40, 80, 1100, 26, {
		size: 18,
		color: C.muted,
		align: "left",
	});
	const section = (label, y) => text(kit, label, 40, y, 800, 32, { font: TITLE, size: 26, color: "#8AF7F9", stroke: C.outline, strokeWeight: 3, align: "left" });

	section("PALETTE", 124);
	const swatches = [
		["Lagoon", "#00C2CB"],
		["Ocean blue", "#0A84FF"],
		["Deep navy", "#0F1B29"],
		["Navy card", "#162436"],
		["Gold", "#FFD233"],
		["Mint action", "#2ECC71"],
		["Alert red", "#FF4D5E"],
		["Outline", "#071320"],
	];
	swatches.forEach(([n, hex], i) => {
		const sw = frame(kit, `Swatch_${n}`, 40 + i * 150, 164, 130, 110);
		rect(sw, "Color", 0, 0, 130, 62, { fill: hex, cornerRadius: 16, ...outline("#FFFFFF40", 3) });
		text(sw, n, 0, 66, 130, 22, { size: 16, align: "left" });
		text(sw, hex, 0, 88, 130, 18, { size: 14, color: C.muted, align: "left" });
	});

	section("BUTTONS: NORMAL / PRESSED", 296);
	const btns = [
		["ActionBtn", PAL.green, "CLAIM!"],
		["EquipBtn", PAL.blue, "EQUIP"],
		["BuyBtn", PAL.gold, "BUY"],
		["ConfirmBtn", PAL.red, "SURE?"],
		["ReleaseBtn", PAL.lagoon, "RELEASE"],
		["RebirthBtn", PAL.purple, "REBIRTH!"],
		["DisabledBtn", PAL.grey, "LOCKED"],
	];
	btns.forEach(([n, pal, label], i) => {
		const bx = 40 + (i % 3) * 410;
		const by = 340 + Math.floor(i / 3) * 84;
		button(kit, n, bx, by, 180, 58, pal, label);
		button(kit, n, bx + 196, by, 180, 58, pal, label, { pressed: true });
	});
	text(kit, "Each pair: normal, then pressed (face down 4 px, darker gradient, the bevel almost gone).", 40, 584, 780, 22, {
		size: 15,
		color: C.muted,
		align: "left",
	});

	section("CONTROLS", 620);
	closeButton(kit, 40, 664);
	closeButton(kit, 106, 664, true);
	button(kit, "Tab_Active", 190, 664, 150, 46, PAL.gold, "STORY", { size: 22 });
	button(kit, "Tab_Inactive", 356, 664, 150, 46, PAL.navy, "DAILY", { size: 22, color: "#9FC3E8" });
	badge(kit, 530, 672, "!", 30);
	badge(kit, 572, 672, "3", 30);
	coin(kit, "CoinIcon", 620, 664, 56);
	progress(kit, "ProgressBar", 700, 674, 320, 28, 0.35, PAL.green, "350 / 1,000$");
	chip(kit, "RarityChip_Common", 1050, 666, 96, 22, RARITY.COMMON, "COMMON", { size: 13 });
	chip(kit, "RarityChip_Rare", 1050, 694, 96, 22, RARITY.RARE, "RARE", { size: 13 });
	chip(kit, "RarityChip_Mythic", 1156, 666, 96, 22, RARITY.MYTHIC, "MYTHIC", { size: 13 });
	chip(kit, "RarityChip_Uncommon", 1156, 694, 96, 22, RARITY.UNCOMMON, "UNCOMMON", { size: 13 });

	section("HEADER BANNERS", 750);
	banner(kit, "HeaderBanner_Gold", 230, 794, 320, PAL.gold, "QUESTS");
	banner(kit, "HeaderBanner_Lagoon", 640, 794, 360, PAL.lagoon, "FISH INDEX");
	banner(kit, "HeaderBanner_Purple", 1050, 794, 320, PAL.purple, "REBIRTH");

	section("ITEM SLOTS (SQUARE) & SIDE MENU", 896);
	const slotDefs = [
		["Normal", "Icon_Basic_Normal.png", {}],
		["Anomaly", "Icon_Basic_Anomaly.png", {}],
		["Ghost", "Icon_Basic_Ghost.png", {}],
		["Shiny", "Icon_Basic_Shiny.png", { shiny: true }],
	];
	slotDefs.forEach(([v, file, o], i) => {
		itemSlot(kit, `ItemSlot_${v}`, 40 + i * 116, 944, 100, { pal: VARIANT_PAL[v], icon: `fish/stickers/${file}`, ...o });
		text(kit, v, 40 + i * 116, 1054, 100, 22, { size: 16, color: C.muted });
	});
	itemSlot(kit, "ItemSlot_Missing", 40 + 4 * 116, 944, 100, { missing: true, icon: "fish/stickers/Icon_Basic_Normal.png" });
	text(kit, "Not found", 40 + 4 * 116, 1054, 100, 22, { size: 16, color: C.muted });
	const side = [
		["Quests", PAL.gold, iconScroll],
		["Companions", PAL.green, iconCompanion],
		["Fish Index", PAL.blue, iconBook],
		["Ocean", PAL.lagoon, iconWave],
		["Rebirth", PAL.purple, iconRebirth],
	];
	side.forEach(([n, pal, icon], i) => sideButton(kit, n.replace(" ", ""), 660 + i * 120, 950, pal, n, icon));

	section("ROBLOX MAPPING", 1100);
	const notes = [
		"Button = Frame (height + 6) > Shadow (Position y +6, darker) + Face (UIGradient 90 deg light > base, UIStroke 3 #071320, UICorner).",
		"Gloss = white Frame, BackgroundTransparency 0.7, top 40 % of the face. Pressed: Face y +4, gradient base > dark (tween 0.06 s).",
		"Text = Enum.Font.LuckiestGuy (titles, buttons) / FredokaOne (body), UIStroke 2-3 px Contextual in the button's shadow colour.",
		"Item slots: UIAspectRatioConstraint 1, UIGridLayout cell 88-100 px, padding 12. Banners: 9-slice band + 2 tail images.",
	];
	notes.forEach((n, i) => text(kit, n, 40, 1142 + i * 30, 1200, 26, { size: 16, color: "#DCEBFA", align: "left" }));
}

// ---- 2. HUD ----
{
	const hud = screen("HUD_V2", 1380, 0);
	boards.push(["HUD_V2", hud]);
	shopBar(hud);
	moneyCounter(hud, 1280 - 16 - 260, 14, "12,450");
	likePill(hud, 1280 - 16 - 252, 92);
	sideButtons(hud);
	coachBubble(hud, 110, 150 + 416 + 2, "REBIRTH READY!", "x2.5 coins, Lagoon Aquarium");
	button(hud, "BackToLobby", 1280 - 16 - 168, 720 - 16 - 62, 168, 56, PAL.blue, "LOBBY", { size: 26 });
}

// ---- 3. Quests panel ----
{
	const scr = screen("QuestPanel_V2", 0, 1340);
	boards.push(["QuestPanel_V2", scr]);
	rect(scr, "Backdrop", 0, 0, 1280, 720, { fill: "#04101C", opacity: 0.55 });
	const MW = 680;
	const MH = 470;
	const { root, body } = modal(scr, "QuestPanel", (1280 - MW) / 2, 150, MW, MH);
	banner(root, "HeaderBanner", MW / 2, 0, 320, PAL.gold, "QUESTS");
	closeButton(root, MW - 40, 18);

	const tabsX = (MW - (3 * 150 + 2 * 14)) / 2;
	button(body, "Tab_Story", tabsX, 42, 150, 44, PAL.gold, "STORY", { size: 22 });
	button(body, "Tab_Daily", tabsX + 164, 42, 150, 44, PAL.navy, "DAILY", { size: 22, color: "#9FC3E8" });
	button(body, "Tab_Weekly", tabsX + 328, 42, 150, 44, PAL.navy, "WEEKLY", { size: 22, color: "#9FC3E8" });

	const quests = [
		{ line: "START", pal: PAL.gold, title: "Coin Collector", desc: "Collect 300$ worth of coins.", ratio: 1, bar: "300 / 300$", reward: "SNAIL", done: true },
		{ line: "OCEAN", pal: PAL.lagoon, title: "Full House", desc: "Fill your aquarium with 10 fish.", ratio: 0.7, bar: "7 / 10", reward: "OCEAN" },
		{ line: "REBIRTH", pal: PAL.purple, title: "Saving Up", desc: "Have 5,000$ at once to unlock the Rebirth.", ratio: 0.7, bar: "3,500 / 5,000$", reward: "REBIRTH" },
	];
	const CW = MW - 48;
	quests.forEach((q, i) => {
		const { root: c, face } = card(body, `QuestCard_${q.title.replace(" ", "")}`, 24, 112 + i * 112, CW, 92, q.done ? { stroke: "#FFD233", top: "#2F5A8C" } : {});
		const badgeRoot = frame(face, "QuestIcon", 14, 14, 64, 64);
		ellipse(badgeRoot, "Disc", 0, 0, 64, 64, { fills: [grad("#3B6CA6", "#1A3456")], ...outline() });
		if (i === 0) coin(badgeRoot, "Coin", 10, 10, 44);
		if (i === 1) image(badgeRoot, "Fish", "fish/stickers/Icon_Clownfish_Normal.png", 2, 13, 60, 38);
		if (i === 2) {
			coin(badgeRoot, "Coin3", 22, 8, 30);
			coin(badgeRoot, "Coin2", 8, 22, 30);
			coin(badgeRoot, "Coin1", 26, 28, 30);
		}
		text(face, q.title, 92, 8, 330, 30, { size: 23, stroke: C.outline, strokeWeight: 2.5, align: "left" });
		text(face, q.desc, 92, 36, 360, 20, { size: 15, color: C.muted, align: "left" });
		progress(face, "Progress", 92, 60, q.done ? 330 : 430, 22, q.ratio, q.done ? PAL.gold : PAL.green, q.bar);
		const sx = q.done ? 436 : CW - 14 - 76;
		const slot = itemSlot(face, "RewardSlot", sx, 6, 72, { pal: PAL.lagoon });
		if (i === 0) image(slot.face, "Reward", "companions/Companion_Snail.png", 4, 12, 64, 40);
		if (i === 1) iconWave(slot.face, 4, 2);
		if (i === 2) iconRebirth(slot.face, 4, 2);
		chip(face, "RewardLabel", sx + 4, 64, 64, 20, C.navy, q.reward, { size: 12, color: "#FFFFFF" });
		if (q.done) button(face, "ActionBtn_Claim", CW - 14 - 96, 20, 96, 48, PAL.green, "CLAIM!", { size: 22 });
		chip(c, "LineTag", 18, -10, 86, 22, q.pal.base, q.line, { font: TITLE, size: 14, color: "#FFFFFF", stroke: C.outline });
	});
}

// ---- 4. Fish Index ----
{
	const scr = screen("FishIndex_V2", 1380, 1340);
	boards.push(["FishIndex_V2", scr]);
	rect(scr, "Backdrop", 0, 0, 1280, 720, { fill: "#04101C", opacity: 0.55 });
	const MW = 880;
	const MH = 540;
	const { root, body } = modal(scr, "FishIndexPanel", (1280 - MW) / 2, 130, MW, MH);
	banner(root, "HeaderBanner", MW / 2, 0, 380, PAL.lagoon, "FISH INDEX");
	closeButton(root, MW - 40, 18);

	text(body, "DISCOVERED", 30, 44, 170, 34, { font: TITLE, size: 22, stroke: C.outline, strokeWeight: 3, align: "left" });
	progress(body, "DiscoveredBar", 196, 48, 370, 26, 14 / 37, PAL.gold, "14 / 37");
	text(body, "Hatch every fish in every variant!", 584, 44, 270, 34, { size: 15, color: C.muted, align: "left" });

	const COL0 = 380;
	const variants = [
		["Normal", "NORMAL", "84%"],
		["Anomaly", "ANOMALY", "10%"],
		["Ghost", "GHOST", "5%"],
		["Shiny", "SHINY", "1%"],
	];
	text(body, "FISH", 34, 88, 200, 28, { font: TITLE, size: 20, color: "#9FC3E8", align: "left" });
	variants.forEach(([v, label, odds], j) => {
		const pal = VARIANT_PAL[v];
		chip(body, `ColumnHeader_${v}`, COL0 + j * 102 - 2, 86, 92, 26, pal.base, label, { font: TITLE, size: 15, color: "#FFFFFF", stroke: pal.shadow });
		text(body, odds, COL0 + j * 102 - 2, 112, 92, 16, { size: 13, color: C.muted });
	});

	const rows = [
		{ name: "Golden Guppy", rarity: "COMMON", income: "Coin: 4$", type: "Basic", found: [1, 1, 1, 0] },
		{ name: "Blue Neon", rarity: "COMMON", income: "Coin: 25$", type: "Big", found: [1, 1, 0, 0] },
		{ name: "Clownfish", rarity: "UNCOMMON", income: "Coin: 180$", type: "Clownfish", found: [1, 0, 0, 1] },
		{ name: "Flame Gourami", rarity: "UNCOMMON", income: "Coin: 1,400$", type: "FlameGourami", found: [1, 0, 0, 0] },
	];
	const list = frame(body, "ItemSlot_Grid", 16, 136, MW - 32 - 22, MH - 136 - 18, { clip: true });
	rows.forEach((row, i) => {
		const { face } = card(list, `SpeciesRow_${row.type}`, 0, 4 + i * 118, MW - 32 - 30, 104);
		chip(face, "RarityChip", 16, 14, 104, 24, RARITY[row.rarity], row.rarity, { size: 14 });
		text(face, row.name, 16, 42, 330, 32, { size: 25, stroke: C.outline, strokeWeight: 2.5, align: "left" });
		text(face, row.income, 16, 72, 330, 20, { size: 15, color: C.muted, align: "left" });
		variants.forEach(([v], j) => {
			const found = row.found[j] === 1;
			itemSlot(face, `ItemSlot_${v}`, COL0 - 16 + j * 102, 6, 88, {
				pal: VARIANT_PAL[v],
				icon: `fish/stickers/Icon_${row.type}_${found ? v : "Normal"}.png`,
				missing: !found,
				shiny: found && v === "Shiny",
			});
		});
	});
	const track = rect(body, "ScrollTrack", MW - 30, 140, 12, MH - 140 - 24, { fill: C.track, cornerRadius: 6, ...outline(C.outline, 2) });
	rect(body, "ScrollThumb", MW - 30, 140, 12, 170, { fills: [grad(PAL.lagoon.light, PAL.lagoon.base)], cornerRadius: 6, ...outline(C.outline, 2) });
}

// ---- 5. Game sprites (exported at 2x, uploaded, ids in src/client/ui/theme.ts V2_IMAGES) ----
// Tintable ones are white (ImageColor3 / UIGradient multiply them) with the dark outline baked in.
const sprites = [];
{
	const sheet = frame(undefined, "Assets_V2", 0, 2160, 900, 200, { fill: "#7F8C99" });
	const cell = (name, x, w, h) => {
		const f = frame(sheet, name, x, 20, w, h, { clip: true });
		sprites.push([name, f]);
		return f;
	};
	for (const [name, draw] of [
		["Icon_Quests", iconScroll],
		["Icon_FishIndex", iconBook],
		["Icon_Ocean", iconWave],
		["Icon_Rebirth", iconRebirth],
	]) {
		const f = cell(name, 20 + sprites.length * 84, 64, 64);
		draw(f, 0, 0);
	}
	// Ribbon tails: the banner's tail and fold, in the banner's coordinates shifted up by 18 (64 x 56)
	const line = { stroke: C.outline, strokeWeight: 3, strokeJoin: "round" };
	const left = cell("RibbonTailLeft", 380, 64, 56);
	vector(left, "Tail", "M2 2 L64 2 L64 54 L2 54 L18 28 Z", { fill: "#FFFFFF", ...line });
	vector(left, "Fold", "M34 40 L64 40 L64 54 Z", { fill: "#808080", ...line });
	const right = cell("RibbonTailRight", 464, 64, 56);
	vector(right, "Tail", "M62 2 L0 2 L0 54 L62 54 L46 28 Z", { fill: "#FFFFFF", ...line });
	vector(right, "Fold", "M30 40 L0 40 L0 54 Z", { fill: "#808080", ...line });
	const star = cell("Sparkle", 548, 48, 48);
	add("node.create", {
		type: "star",
		parent: star,
		name: "Star",
		x: 3,
		y: 3,
		width: 42,
		height: 42,
		props: { fill: "#FFFFFF", pointCount: 4, innerRadius: 0.32, stroke: C.outline, strokeWeight: 3, strokeJoin: "round" },
	});
	const glow = cell("SoftGlow", 616, 128, 128);
	ellipse(glow, "Glow", 0, 0, 128, 128, { fills: [radial("#FFFFFFFF", "#FFFFFF00")] });
}

if (PREVIEW) {
	for (const [n, id] of sprites)
		add("file.export", { ids: [id], format: "png", scale: 2, path: `${UI}/v2/${n}.png` });
	for (const [n, id] of boards)
		add("file.export", { ids: [id], format: "png", scale: 1, path: `${PREVIEW.split(path.sep).join("/")}/${n}.png` });
}

fs.writeFileSync(OUT, JSON.stringify(steps, null, 1));
console.log(`${steps.length} steps -> ${OUT}`);
