// FigCraft script: fish shop top bar, built with Auto Layout. IDs are sequential (page = 1).
const steps = [];
let nextId = 2;
const add = (command, params) => { steps.push({ command, params }); return nextId++; };
const frame = (parent, name, props, size = {}) => add("frame.create", { parent, name, ...size, props: { fill: "none", ...props } });
const text = (parent, t, props) => add("text.create", { text: t, parent, x: 0, y: 0, props: { fontFamily: "Inter", fontStyle: "Bold", ...props } });
const scalePath = (path, s) => path.replace(/-?d+(.d+)?/g, (n) => String(+(Number(n) * s).toFixed(2)));
const vec = (parent, name, path, s, props) => add("vector.create", { path: scalePath(path, s), parent, x: 0, y: 0, props: { name, stroke: "none", ...props } });
const ell = (parent, name, x, y, w, h, props) => add("node.create", { type: "ellipse", parent, name, x, y, width: w, height: h, props });

const C = {
	gold: "#E8B44A", goldDark: "#6E4A12", barTop: "#145A70", barBottom: "#0A2635",
	slotTop: "#FBE3A1", slotBottom: "#C98E32", lockedTop: "#9AA3AA", lockedBottom: "#5D666E",
	tag: "#4B2A86", tagStroke: "#2A1550", moneyBg: "#0D1D26", greenTop: "#3CEB78", greenBottom: "#12924A",
};

// ---- Fish icons (100x60, facing right), exported at 2x as PNG for Roblox ----
const icons = frame(undefined, "Icons", { layout: "horizontal", gap: 40, padding: 20, fill: "#1B3A4B" }, { x: 0, y: 200 });

function drawGuppy(parent, s) {
	vec(parent, "Tail", "M0 6 C18 12 30 24 40 30 C30 36 18 48 0 54 C9 40 9 20 0 6 Z", s, { fills: [{ type: "linearGradient", stops: ["#FF9A1F", "#FFD15A"] }] });
	vec(parent, "Dorsal", "M50 18 C56 4 70 4 76 16 Z", s, { fill: "#F5A623" });
	vec(parent, "Body", "M32 30 C40 15 62 11 80 17 C93 21 99 28 99 30 C99 32 93 39 80 43 C62 49 40 45 32 30 Z", s, { fills: [{ type: "linearGradient", stops: ["#FFE27A", "#E9A21C"] }] });
	ell(parent, "Eye", 81 * s, 23 * s, 8 * s, 8 * s, { fill: "#101418" });
	ell(parent, "Glint", 83 * s, 24 * s, 3 * s, 3 * s, { fill: "#FFFFFF" });
}
function drawNeon(parent, s) {
	vec(parent, "Tail", "M0 14 L26 30 L0 46 C7 36 7 24 0 14 Z", s, { fill: "#C9D8E6", opacity: 0.85 });
	vec(parent, "Body", "M20 30 C30 17 60 15 82 21 C94 24 100 29 100 30 C100 31 94 36 82 39 C60 45 30 43 20 30 Z", s, { fill: "#E8EEF5" });
	vec(parent, "RedRear", "M20 30 C28 38 44 42 62 42 L62 31 Z", s, { fill: "#E8394A" });
	vec(parent, "NeonStripe", "M28 29 C46 25 70 24 92 27 L92 31 C70 29 46 30 28 33 Z", s, { fills: [{ type: "linearGradient", stops: ["#2F6BFF", "#5CF2FF"] }] });
	ell(parent, "Eye", 83 * s, 25 * s, 8 * s, 8 * s, { fill: "#101418" });
	ell(parent, "Glint", 85 * s, 26 * s, 3 * s, 3 * s, { fill: "#FFFFFF" });
}
function drawRedTetra(parent, s) {
	vec(parent, "Tail", "M0 9 C10 17 18 25 27 30 C18 35 10 43 0 51 L9 30 Z", s, { opacity: 0.9, fills: [{ type: "linearGradient", stops: ["#FF7A66", "#C8102E"] }] });
	vec(parent, "AnalFin", "M47 42 C50 53 61 55 67 43 Z", s, { fill: "#D81E3A", opacity: 0.85 });
	vec(parent, "Dorsal", "M45 17 L55 1 L66 15 Z", s, { fill: "#17171C" });
	vec(parent, "DorsalTip", "M52.2 5.4 L55 1 L58 5.9 Z", s, { fill: "#FFFFFF" });
	vec(parent, "Body", "M22 30 C32 13 56 9 76 15 C90 19 98 27 98 30 C98 33 90 41 76 45 C56 51 32 47 22 30 Z", s, { fills: [{ type: "linearGradient", stops: ["#FF5A4E", "#B0102A"] }] });
	vec(parent, "Shine", "M32 27 C48 20 68 19 86 23 L86 25.5 C68 22.5 48 24 32 30 Z", s, { fill: "#FFB3A8", opacity: 0.7 });
	ell(parent, "Eye", 80 * s, 22 * s, 8 * s, 8 * s, { fill: "#101418" });
	ell(parent, "Glint", 82 * s, 23 * s, 3 * s, 3 * s, { fill: "#FFFFFF" });
}
const guppy = frame(icons, "GuppyIcon", {}, { width: 100, height: 60 });
drawGuppy(guppy, 1);
const neon = frame(icons, "NeonIcon", {}, { width: 100, height: 60 });
drawNeon(neon, 1);
const redTetra = frame(icons, "RedTetraIcon", {}, { width: 100, height: 60 });
drawRedTetra(redTetra, 1);

// ---- Shop bar ----
const bar = frame(undefined, "ShopBar", {
	layout: "horizontal", padding: [10, 24, 10, 24], gap: 24, mainAlign: "spaceBetween", crossAlign: "center",
	sizingH: "fixed", sizingV: "hug",
	fills: [{ type: "linearGradient", stops: [C.barTop, C.barBottom] }], cornerRadius: [0, 0, 28, 28],
	stroke: C.gold, strokeWeight: 4, strokeAlign: "inside",
}, { x: 0, y: 0, width: 1280, height: 124 });

const slots = frame(bar, "Slots", { layout: "horizontal", gap: 18, crossAlign: "center", sizingH: "hug", sizingV: "hug" });
add("node.create", { type: "rectangle", parent: slots, name: "Rail", x: 0, y: 46, width: 840, height: 14,
	props: { absolute: true, fills: [{ type: "linearGradient", stops: ["#F4CF7A", "#A8741F"] }], cornerRadius: 7, stroke: C.goldDark, strokeWeight: 2 } });

// Slot states: buyable = green highlight, unaffordable = grey, locked = dark slate ("Soon")
const SLOT_STATES = {
	buyable: { top: "#C9F7D2", bottom: "#3DBA62", stroke: "#145C2C", tag: "#1E9E52", tagStroke: "#0E5A2A", iconOpacity: 1 },
	unaffordable: { top: "#C3C9CE", bottom: "#7D868D", stroke: "#4A535A", tag: "#59626A", tagStroke: "#3A4148", iconOpacity: 0.45 },
	locked: { top: "#5A646C", bottom: "#333B42", stroke: "#22292E", tag: "#3A4148", tagStroke: "#252A2F", iconOpacity: 1 },
};
const fish = [
	{ key: "Guppy", draw: drawGuppy, price: "100$", state: "buyable" },
	{ key: "Neon", draw: drawNeon, price: "500$", state: "unaffordable" },
	{ key: "RedTetra", draw: drawRedTetra, price: "9000$", state: "unaffordable" },
	null, null, null,
];
fish.forEach((f, i) => {
	const st = SLOT_STATES[f ? f.state : "locked"];
	const slot = frame(slots, f ? `Slot_${f.key}_${f.state}` : `Slot_Locked${i}`, {
		layout: "vertical", padding: [8, 12, 8, 12], gap: 6, crossAlign: "center", sizingH: "fixed", sizingV: "hug",
		fills: [{ type: "linearGradient", stops: [st.top, st.bottom] }],
		cornerRadius: 20, stroke: st.stroke, strokeWeight: 3, strokeAlign: "inside",
	}, { width: 124 });
	const porthole = frame(slot, "Porthole", {
		layout: "horizontal", mainAlign: "center", crossAlign: "center", sizingH: "fixed", sizingV: "fixed",
		fills: [{ type: "radialGradient", stops: f ? ["#D8FAFF", "#2B93B5"] : ["#4A5A66", "#1C262E"] }],
		cornerRadius: 31, stroke: st.stroke, strokeWeight: 3, strokeAlign: "inside",
	}, { width: 84, height: 62 });
	if (f) {
		const icon = frame(porthole, `${f.key}Icon`, { opacity: st.iconOpacity, pluginData: { robloxImage: `${f.key}Icon.png` } }, { width: 66, height: 40 });
		f.draw(icon, 0.66);
	} else {
		text(porthole, "?", { fontSize: 34, fill: "#C9D2D8" });
	}
	const tag = frame(slot, "PriceTag", {
		layout: "horizontal", padding: [3, 12, 3, 12], mainAlign: "center", crossAlign: "center", sizingH: "fill", sizingV: "hug",
		fill: st.tag, cornerRadius: 12, stroke: st.tagStroke, strokeWeight: 2, strokeAlign: "inside",
	});
	text(tag, f ? f.price : "Soon", { fontSize: f ? 16 : 13, fill: f ? "#FFFFFF" : "#AEB7BE" });
});

const money = frame(bar, "Money", {
	layout: "horizontal", padding: [10, 12, 10, 14], gap: 10, crossAlign: "center", sizingH: "hug", sizingV: "hug",
	fill: C.moneyBg, cornerRadius: 16, stroke: C.gold, strokeWeight: 3, strokeAlign: "inside",
});
text(money, "$", { fontSize: 30, fill: C.gold });
const moneyBar = frame(money, "MoneyBar", {
	layout: "horizontal", padding: [6, 14, 6, 14], mainAlign: "max", crossAlign: "center", sizingH: "fixed", sizingV: "hug",
	fills: [{ type: "linearGradient", stops: [C.greenTop, C.greenBottom] }], cornerRadius: 10, stroke: "#0B5A2C", strokeWeight: 2, strokeAlign: "inside",
}, { width: 190 });
text(moneyBar, "255", { fontSize: 24, fill: "#FFFFFF" });

require("fs").writeFileSync("shopbar2.json", JSON.stringify(steps, null, 1));
console.log(steps.length + " steps");
