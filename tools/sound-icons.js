// Sound button icons (the volume control, top-right: client/ui/SoundControl.tsx), drawn as SVG in the UI V2 style and
// rendered to PNG with resvg. Usage: node tools/sound-icons.js [outDir]   (default design/ui/sound; also _sheet.png)
// A white speaker outlined in navy, to sit on a blue 3D button: Sound_On (two sound waves), Sound_Off (a red cross).
// CLAUDE.md §7: plain rounded shapes, no text.
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const OUT = process.argv[2] || path.join(__dirname, "..", "design", "ui", "sound");
const SIZE = 256;
const OUTLINE = "#071320";
const STROKE = 14; // on the 512 px canvas (the kit's 3 px outline at 128 px)
const RED = ["#FF8A8A", "#FF4D5E"];

const line = `stroke="${OUTLINE}" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"`;

/** The speaker: a rounded box and its cone, one outlined shape filled white to a light blue-grey. */
const speaker = `
	<path d="M64 206 Q64 190 80 190 L148 190 L238 116 Q262 98 262 128 L262 384 Q262 414 238 396 L148 322 L80 322 Q64 322 64 306 Z"
		fill="url(#face)" ${line}/>
	<path d="M86 210 L146 210 L236 138" fill="none" stroke="#FFFFFF" stroke-opacity="0.9" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`;

/** A sound wave: an arc around the cone's mouth, white with a navy outline (a wide navy stroke under a white one). */
function wave(r) {
	const cx = 262;
	const cy = 256;
	const a = (40 * Math.PI) / 180;
	const x = (cx + r * Math.cos(a)).toFixed(1);
	const y1 = (cy - r * Math.sin(a)).toFixed(1);
	const y2 = (cy + r * Math.sin(a)).toFixed(1);
	const d = `M${x} ${y1} A${r} ${r} 0 0 1 ${x} ${y2}`;
	return `<path d="${d}" fill="none" stroke="${OUTLINE}" stroke-width="${30 + STROKE * 2}" stroke-linecap="round"/>
		<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round"/>`;
}

/** The muted mark: a red cross right of the cone. */
function cross(cx, cy, h) {
	const d = `M${cx - h} ${cy - h} L${cx + h} ${cy + h} M${cx + h} ${cy - h} L${cx - h} ${cy + h}`;
	return `<path d="${d}" fill="none" stroke="${OUTLINE}" stroke-width="${36 + STROKE * 2}" stroke-linecap="round"/>
		<path d="${d}" fill="none" stroke="url(#red)" stroke-width="36" stroke-linecap="round"/>`;
}

const defs = `<defs>
	<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#CFE3F5"/></linearGradient>
	<linearGradient id="red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${RED[0]}"/><stop offset="1" stop-color="${RED[1]}"/></linearGradient>
</defs>`;

const ICONS = {
	On: `${speaker}${wave(84)}${wave(160)}`,
	Off: `${speaker}${cross(392, 256, 56)}`,
};

fs.mkdirSync(OUT, { recursive: true });
const rendered = [];
for (const [name, body] of Object.entries(ICONS)) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${defs}${body}</svg>`;
	const png = new Resvg(svg, { fitTo: { mode: "width", value: SIZE } }).render().asPng();
	fs.writeFileSync(path.join(OUT, `Sound_${name}.png`), png);
	rendered.push(svg);
	console.log(`Sound_${name}.png`);
}

// Review sheet: each icon on the blue button face it will sit on, at its size in game and larger
const tile = 200;
const parts = rendered.map((svg, i) => {
	const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
	return `<g transform="translate(${i * tile + 20} 20)">
		<rect x="0" y="0" width="160" height="160" rx="40" fill="#0A84FF" stroke="${OUTLINE}" stroke-width="6"/>
		<g transform="translate(20 20) scale(0.234)">${inner}</g>
	</g>`;
});
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile * rendered.length}" height="200">${defs}<rect width="100%" height="100%" fill="#7FB8E8"/>${parts.join("")}</svg>`;
fs.writeFileSync(path.join(OUT, "_sheet.png"), new Resvg(sheet).render().asPng());
