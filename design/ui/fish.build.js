// Fish icons (100x60, facing right, like GuppyIcon / NeonIcon / RedTetraIcon), written as SVG then
// imported into FigCraft (design/ui/shopbar.figcraft, "Icons" frame) and exported at 2x as PNG.
// Run: node design/ui/fish.build.js
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "fish");
fs.mkdirSync(OUT, { recursive: true });

const eye = (x, y) => `<circle cx="${x}" cy="${y}" r="4" fill="#101418"/><circle cx="${x + 1.5}" cy="${y - 1}" r="1.5" fill="#FFFFFF"/>`;

function svg(name, defs, body) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60">
	<defs>${defs}</defs>
	${body}
</svg>
`;
}

const CLOWN_BODY = "M22 30 C30 13 58 9 78 14 C92 18 99 26 99 30 C99 34 92 42 78 46 C58 51 30 47 22 30 Z";
const DANIO_BODY = "M14 30 C24 21 52 18 76 21 C90 23 99 28 99 30 C99 32 90 37 76 39 C52 42 24 39 14 30 Z";
const GOURAMI_BODY = "M20 30 C26 9 60 5 80 12 C94 18 99 26 99 30 C99 34 94 42 80 48 C60 55 26 51 20 30 Z";

const files = {
	ClownfishIcon: svg(
		"Clownfish",
		`<linearGradient id="orange" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB054"/><stop offset="1" stop-color="#E8590C"/></linearGradient>
		<clipPath id="body"><path d="${CLOWN_BODY}"/></clipPath>`,
		`<path d="M3 13 C13 17 21 24 27 30 C21 36 13 43 3 47 C-1 37 -1 23 3 13 Z" fill="url(#orange)" stroke="#2A1206" stroke-width="2"/>
		<path d="M38 17 C44 3 62 1 72 13 Z" fill="url(#orange)" stroke="#2A1206" stroke-width="2"/>
		<path d="M46 43 C50 55 62 55 66 43 Z" fill="url(#orange)" stroke="#2A1206" stroke-width="2"/>
		<path d="${CLOWN_BODY}" fill="url(#orange)"/>
		<g clip-path="url(#body)" stroke="#2A1206" stroke-width="2">
			<path d="M24 0 H33 V60 H24 Z" fill="#FFFFFF"/>
			<path d="M47 0 H57 C61 20 61 40 57 60 H47 C51 40 51 20 47 0 Z" fill="#FFFFFF"/>
			<path d="M72 0 H80 C84 20 84 40 80 60 H72 C76 40 76 20 72 0 Z" fill="#FFFFFF"/>
		</g>
		<path d="${CLOWN_BODY}" fill="none" stroke="#2A1206" stroke-width="2"/>
		${eye(87, 25)}`,
	),
	ZebraDanioIcon: svg(
		"ZebraDanio",
		`<linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6D6"/><stop offset="1" stop-color="#D8C27E"/></linearGradient>
		<clipPath id="body"><path d="${DANIO_BODY}"/></clipPath>`,
		`<path d="M0 16 L22 30 L0 44 L9 30 Z" fill="url(#silver)" stroke="#5E5230" stroke-width="1.5"/>
		<path d="M3 26 L15 30 L3 34" fill="none" stroke="#2846A8" stroke-width="2"/>
		<path d="M50 21 L58 12 L66 21 Z" fill="#E9DDB0" stroke="#5E5230" stroke-width="1.5"/>
		<path d="M54 39 L60 47 L68 39 Z" fill="#E9DDB0" stroke="#5E5230" stroke-width="1.5"/>
		<path d="${DANIO_BODY}" fill="url(#silver)"/>
		<g clip-path="url(#body)" fill="#2846A8">
			<path d="M12 24 C40 21 70 21 92 24 L92 26 C70 23.5 40 23.5 12 26.5 Z"/>
			<path d="M12 28.6 C40 27.6 70 27.6 96 28.6 L96 31.2 C70 30.2 40 30.2 12 31.2 Z"/>
			<path d="M12 33.5 C40 36 70 36 92 34 L92 36.2 C70 38.4 40 38.4 12 35.8 Z"/>
		</g>
		<path d="${DANIO_BODY}" fill="none" stroke="#5E5230" stroke-width="1.5"/>
		${eye(87, 27)}`,
	),
	FlameGouramiIcon: svg(
		"FlameGourami",
		`<linearGradient id="flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC24A"/><stop offset="0.45" stop-color="#FF5A1F"/><stop offset="1" stop-color="#B80F2A"/></linearGradient>
		<linearGradient id="fin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3D6BD8"/><stop offset="1" stop-color="#E8401C"/></linearGradient>
		<clipPath id="body"><path d="${GOURAMI_BODY}"/></clipPath>`,
		`<path d="M4 15 C14 19 20 25 24 30 C20 35 14 41 4 45 C0 36 0 24 4 15 Z" fill="url(#flame)" stroke="#5A0A12" stroke-width="1.8"/>
		<path d="M30 17 C40 1 68 0 80 11 L68 15 Z" fill="url(#fin)" stroke="#5A0A12" stroke-width="1.8"/>
		<path d="M28 43 C40 60 68 60 80 47 Z" fill="url(#fin)" stroke="#5A0A12" stroke-width="1.8"/>
		<path d="${GOURAMI_BODY}" fill="url(#flame)"/>
		<g clip-path="url(#body)">
			<path d="M78 0 C88 10 92 22 90 60 H100 V0 Z" fill="#8E1424" opacity="0.45"/>
			<path d="M32 22 C46 14 64 12 80 16 L80 19 C64 16 46 18 32 25 Z" fill="#FFE29A" opacity="0.7"/>
		</g>
		<path d="${GOURAMI_BODY}" fill="none" stroke="#5A0A12" stroke-width="1.8"/>
		<path d="M72 44 C68 52 60 57 50 59" fill="none" stroke="#FF8A3D" stroke-width="1.8" stroke-linecap="round"/>
		${eye(86, 25)}`,
	),
};

for (const [name, content] of Object.entries(files)) {
	fs.writeFileSync(path.join(OUT, `${name}.svg`), content);
}
console.log(Object.keys(files).join(", "));
