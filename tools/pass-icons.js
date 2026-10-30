// Gamepass icons (Shop panel, Shop side button), drawn as SVG in the UI V2 style and rendered to PNG with resvg.
// Usage: node tools/pass-icons.js [outDir]   (default design/ui/passes; also writes _sheet.png to review them)
// CLAUDE.md §7: no text, nothing near a mouth, soft rounded shapes. The values ("x2", "+50%") are drawn by the game.
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const OUT = process.argv[2] || path.join(__dirname, "..", "design", "ui", "passes");
const SIZE = 512;
const OUTLINE = "#071320";
const STROKE = 14; // the kit's 3 px outline at 128 px, scaled to the 512 px canvas

// V2 palettes (redesign-v2.build.js): light, base, dark, shadow
const PAL = {
	green: ["#8CF5A8", "#2ECC71", "#1C9C52", "#0E6332"],
	lagoon: ["#8AF7F9", "#00C2CB", "#00939C", "#005A61"],
	gold: ["#FFF3A0", "#FFD233", "#F0A500", "#8F5A00"],
	purple: ["#D9ABFF", "#A55CFF", "#7C34D9", "#44167F"],
	pink: ["#FFA8C4", "#FF5C8A", "#D93A6A", "#7A1236"],
	blue: ["#7CC8FF", "#0A84FF", "#0866CC", "#053D80"],
	navy: ["#2F5684", "#1E3A5C", "#162C46", "#08121D"],
};

/** Vertical gradient light -> base, like the kit's faces. */
function grad(id, pal) {
	return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></linearGradient>`;
}

const line = `stroke="${OUTLINE}" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"`;

/** 4-point sparkle star centred on (x, y). */
function sparkle(x, y, r, fill = "#FFFFFF") {
	const k = r * 0.28;
	return `<path d="M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r}Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="${STROKE * 0.6}" stroke-linejoin="round"/>`;
}

/** Five-point star path. */
function starPath(cx, cy, outer, inner) {
	const pts = [];
	for (let i = 0; i < 10; i++) {
		const r = i % 2 === 0 ? outer : inner;
		const a = -Math.PI / 2 + (i * Math.PI) / 5;
		pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
	}
	return `M${pts.join(" L")}Z`;
}

/** A gold coin seen from the front, with an embossed star (the game's coin look, no symbol). */
function coin(cx, cy, r, id) {
	return `
		<circle cx="${cx}" cy="${cy + r * 0.12}" r="${r}" fill="${PAL.gold[3]}" ${line}/>
		<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})" ${line}/>
		<circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="none" stroke="${PAL.gold[2]}" stroke-width="${STROKE * 0.6}"/>
		<path d="${starPath(cx, cy, r * 0.46, r * 0.2)}" fill="${PAL.gold[2]}" stroke-linejoin="round"/>
		<path d="M${cx - r * 0.62} ${cy - r * 0.35} A${r * 0.72} ${r * 0.72} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.7}" fill="none" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="${STROKE * 0.8}" stroke-linecap="round"/>`;
}

/** Thick up arrow (a rounded chevron with a stem). */
function upArrow(cx, top, w, h, pal, id) {
	const half = w / 2;
	const stem = w * 0.22;
	const head = h * 0.5;
	return `<path d="M${cx} ${top} L${cx + half} ${top + head} L${cx + stem} ${top + head} L${cx + stem} ${top + h} L${cx - stem} ${top + h} L${cx - stem} ${top + head} L${cx - half} ${top + head} Z" fill="url(#${id})" ${line}/>`;
}

const ICONS = {
	// Coins: a stack of coins and a green arrow going up
	Coins: () => `
		<defs>${grad("g", PAL.gold)}${grad("a", PAL.green)}</defs>
		<ellipse cx="200" cy="420" rx="130" ry="34" fill="${PAL.gold[3]}" ${line}/>
		<rect x="70" y="330" width="260" height="90" rx="20" fill="${PAL.gold[2]}" ${line}/>
		<ellipse cx="200" cy="330" rx="130" ry="34" fill="url(#g)" ${line}/>
		<rect x="70" y="250" width="260" height="80" rx="20" fill="${PAL.gold[2]}" ${line}/>
		<ellipse cx="200" cy="250" rx="130" ry="34" fill="url(#g)" ${line}/>
		${coin(215, 165, 105, "g")}
		${upArrow(390, 150, 170, 270, PAL.green, "a")}
		${sparkle(110, 90, 34)}`,

	// x2 Ocean Points: the Ocean wave with two gold chevrons going up
	OceanBoost: () => `
		<defs>${grad("w", PAL.lagoon)}${grad("c", PAL.gold)}</defs>
		<path d="M40 450 L40 330 C40 205 135 130 240 130 C325 130 380 185 380 250 C380 305 340 335 300 335 C262 335 240 310 240 280 C240 255 258 240 280 240 C265 220 240 212 215 216 C170 224 150 275 155 325 C160 380 190 420 240 450 Z" fill="${PAL.lagoon[3]}" ${line} transform="translate(0 12)"/>
		<path d="M40 450 L40 330 C40 205 135 130 240 130 C325 130 380 185 380 250 C380 305 340 335 300 335 C262 335 240 310 240 280 C240 255 258 240 280 240 C265 220 240 212 215 216 C170 224 150 275 155 325 C160 380 190 420 240 450 Z" fill="url(#w)" ${line}/>
		<path d="M85 360 C85 270 140 205 215 180" fill="none" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="${STROKE * 1.3}" stroke-linecap="round"/>
		<path d="M355 120 L420 55 L485 120" fill="none" stroke="${OUTLINE}" stroke-width="${STROKE * 4.2}" stroke-linecap="round" stroke-linejoin="round"/>
		<path d="M355 120 L420 55 L485 120" fill="none" stroke="url(#c)" stroke-width="${STROKE * 2.4}" stroke-linecap="round" stroke-linejoin="round"/>
		<path d="M355 205 L420 140 L485 205" fill="none" stroke="${OUTLINE}" stroke-width="${STROKE * 4.2}" stroke-linecap="round" stroke-linejoin="round"/>
		<path d="M355 205 L420 140 L485 205" fill="none" stroke="url(#c)" stroke-width="${STROKE * 2.4}" stroke-linecap="round" stroke-linejoin="round"/>
		<circle cx="110" cy="110" r="22" fill="#FFFFFF" ${line}/>
		<circle cx="160" cy="70" r="13" fill="#FFFFFF" stroke="${OUTLINE}" stroke-width="${STROKE * 0.7}"/>`,

	// Lucky: a purple star with sparkles (the rare variants' shine)
	Lucky: () => `
		<defs>${grad("s", PAL.purple)}
			<linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3A0"/><stop offset="0.5" stop-color="#FFA8C4"/><stop offset="1" stop-color="#8AF7F9"/></linearGradient></defs>
		<path d="${starPath(256, 280, 210, 95)}" fill="${PAL.purple[3]}" ${line} transform="translate(0 14)"/>
		<path d="${starPath(256, 280, 210, 95)}" fill="url(#s)" ${line}/>
		<path d="${starPath(256, 288, 105, 48)}" fill="url(#r)" stroke="${PAL.purple[2]}" stroke-width="${STROKE * 0.6}" stroke-linejoin="round"/>
		<path d="M175 215 L215 165" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="${STROKE * 1.2}" stroke-linecap="round"/>
		${sparkle(440, 110, 50)}
		${sparkle(80, 420, 36, "#FFF3A0")}
		${sparkle(450, 400, 28, "#8AF7F9")}`,

	// Third Companion Slot: two filled slots and a gold one with a big plus
	ThirdCompanionSlot: () => `
		<defs>${grad("n", PAL.green)}${grad("p", PAL.gold)}</defs>
		<rect x="40" y="96" width="150" height="150" rx="34" fill="${PAL.green[3]}" ${line} transform="translate(0 12)"/>
		<rect x="40" y="96" width="150" height="150" rx="34" fill="url(#n)" ${line}/>
		<rect x="40" y="290" width="150" height="150" rx="34" fill="${PAL.green[3]}" ${line} transform="translate(0 12)"/>
		<rect x="40" y="290" width="150" height="150" rx="34" fill="url(#n)" ${line}/>
		<circle cx="115" cy="171" r="34" fill="#FFFFFF" fill-opacity="0.85" stroke="${PAL.green[3]}" stroke-width="${STROKE * 0.6}"/>
		<circle cx="115" cy="365" r="34" fill="#FFFFFF" fill-opacity="0.85" stroke="${PAL.green[3]}" stroke-width="${STROKE * 0.6}"/>
		<rect x="232" y="140" width="250" height="250" rx="54" fill="${PAL.gold[3]}" ${line} transform="translate(0 16)"/>
		<rect x="232" y="140" width="250" height="250" rx="54" fill="url(#p)" ${line}/>
		<path d="M357 195 L357 335 M287 265 L427 265" stroke="${OUTLINE}" stroke-width="${STROKE * 5}" stroke-linecap="round"/>
		<path d="M357 195 L357 335 M287 265 L427 265" stroke="#FFFFFF" stroke-width="${STROKE * 2.8}" stroke-linecap="round"/>
		${sparkle(470, 110, 34)}`,

	// Shop side button: a pink shopping bag with a gold star
	Shop: () => `
		<defs>${grad("b", PAL.pink)}${grad("st", PAL.gold)}</defs>
		<path d="M180 200 L180 150 C180 95 215 62 256 62 C297 62 332 95 332 150 L332 200" fill="none" stroke="${OUTLINE}" stroke-width="${STROKE * 3.4}" stroke-linecap="round"/>
		<path d="M180 200 L180 150 C180 95 215 62 256 62 C297 62 332 95 332 150 L332 200" fill="none" stroke="${PAL.pink[0]}" stroke-width="${STROKE * 1.4}" stroke-linecap="round"/>
		<path d="M100 190 L412 190 L440 450 C442 470 430 480 410 480 L102 480 C82 480 70 470 72 450 Z" fill="${PAL.pink[3]}" ${line} transform="translate(0 14)"/>
		<path d="M100 190 L412 190 L440 450 C442 470 430 480 410 480 L102 480 C82 480 70 470 72 450 Z" fill="url(#b)" ${line}/>
		<path d="M130 230 L125 300" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="${STROKE * 1.2}" stroke-linecap="round"/>
		<path d="${starPath(256, 340, 100, 46)}" fill="url(#st)" ${line}/>
		${sparkle(450, 120, 36)}`,
};

fs.mkdirSync(OUT, { recursive: true });
const rendered = [];
for (const [name, draw] of Object.entries(ICONS)) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">${draw()}</svg>`;
	const png = new Resvg(svg, { fitTo: { mode: "width", value: SIZE } }).render().asPng();
	fs.writeFileSync(path.join(OUT, `Pass_${name}.png`), png);
	rendered.push({ name, svg });
	console.log(`wrote Pass_${name}.png`);
}

// Review sheet: each icon on a card-coloured tile at its in-game size (96 px slot) and large
const tile = 200;
const sheetW = tile * rendered.length;
let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${tile + 70}">`;
sheet += `<rect width="100%" height="100%" fill="#162436"/>`;
rendered.forEach(({ svg }, i) => {
	const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
	// ids are per icon: prefix them so the sheet's gradients don't collide
	const scoped = inner.replace(/id="(\w+)"/g, `id="i${i}$1"`).replace(/url\(#(\w+)\)/g, `url(#i${i}$1)`);
	sheet += `<rect x="${i * tile + 10}" y="10" width="${tile - 20}" height="${tile - 20}" rx="24" fill="#2B5182"/>`;
	sheet += `<svg x="${i * tile + 20}" y="20" width="${tile - 40}" height="${tile - 40}" viewBox="0 0 512 512">${scoped}</svg>`;
	sheet += `<rect x="${i * tile + 72}" y="${tile + 4}" width="56" height="56" rx="10" fill="#2B5182"/>`;
	sheet += `<svg x="${i * tile + 76}" y="${tile + 8}" width="48" height="48" viewBox="0 0 512 512">${scoped.replace(/id="i/g, 'id="s').replace(/url\(#i/g, "url(#s")}</svg>`;
});
sheet += "</svg>";
fs.writeFileSync(path.join(OUT, "_sheet.png"), new Resvg(sheet).render().asPng());
console.log("wrote _sheet.png");
