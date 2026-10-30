// Egg sprites (100x120 each, same canvas so they stack in Roblox), written as SVG then imported
// into FigCraft (design/ui/shopbar.figcraft, "Eggs" frame) and exported at 2x as PNG.
// Run: node design/ui/eggs.build.js
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "eggs");
fs.mkdirSync(OUT, { recursive: true });

const EGG = "M50 4 C76 4 94 46 94 74 C94 100 74 116 50 116 C26 116 6 100 6 74 C6 46 24 4 50 4 Z";

// Break line: the last crack stage follows it exactly, and the two shell halves are cut along it
const ZIG = [[0, 62], [10, 55], [20, 67], [30, 55], [40, 67], [50, 55], [60, 67], [70, 55], [80, 67], [90, 55], [100, 62]];
const zigPath = (points) => points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
const zigLine = (points) => points.map(([x, y], i) => `${i ? "L" : ""}${x} ${y}`).join(" ");
const TOP_CLIP = `M0 0 H100 V62 ${zigLine([...ZIG].reverse())} Z`;
const BOTTOM_CLIP = `M0 62 ${zigLine(ZIG)} V120 H0 Z`;

const sparkle = (x, y, r, fill) =>
	`<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${fill}"/>`;

/** A pointed leaf from (x, y), `len` long, turned by `angle` degrees, with its middle vein. */
const leaf = (x, y, len, angle, fill, vein) => {
	const w = len * 0.32;
	return (
		`<g transform="translate(${x} ${y}) rotate(${angle})">` +
		`<path d="M0 0 C${len * 0.3} ${-w} ${len * 0.75} ${-w} ${len} 0 C${len * 0.75} ${w} ${len * 0.3} ${w} 0 0 Z" fill="${fill}" stroke="${vein}" stroke-width="1.4"/>` +
		`<path d="M2 0 L${len * 0.88} 0" stroke="${vein}" stroke-width="1.2" stroke-linecap="round"/></g>`
	);
};

/** A glowing coral branch: a wide faint stroke under a bright core, with a glowing bud at each tip. */
const neonCoral = (d, tips, color, core) =>
	`<path d="${d}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>` +
	`<path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
	`<path d="${d}" fill="none" stroke="${core}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
	tips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" opacity="0.35"/><circle cx="${x}" cy="${y}" r="2.4" fill="${core}"/>`).join("");

const EGGS = {
	Common: {
		outline: "#5A3D22",
		defs: `<radialGradient id="shell" cx="0.38" cy="0.3" r="0.8">
			<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#FBEFD2"/><stop offset="1" stop-color="#E0BF84"/>
		</radialGradient>`,
		decor: [
			[32, 38, 7, 9], [67, 28, 5, 6], [72, 76, 9, 8], [27, 86, 8, 7], [55, 100, 6, 5], [84, 96, 4, 5], [46, 70, 4, 4], [58, 46, 4, 5],
		]
			.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#5FBCD3" stroke="#2F7E95" stroke-width="1.5"/>`)
			.join(""),
	},
	Improved: {
		outline: "#3E1670",
		defs: `<radialGradient id="shell" cx="0.38" cy="0.3" r="0.8">
			<stop offset="0" stop-color="#F1DDFF"/><stop offset="0.5" stop-color="#B275F5"/><stop offset="1" stop-color="#5E22B4"/>
		</radialGradient>
		<linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#FFE98A"/><stop offset="1" stop-color="#E7A21E"/>
		</linearGradient>`,
		decor:
			`<path d="M0 40 L12 33 L24 40 L36 33 L48 40 L60 33 L72 40 L84 33 L100 40 V49 L84 42 L72 49 L60 42 L48 49 L36 42 L24 49 L12 42 L0 49 Z" fill="url(#band)" stroke="#9A6A0C" stroke-width="1.5"/>` +
			`<path d="M0 88 L12 82 L24 88 L36 82 L48 88 L60 82 L72 88 L84 82 L100 88 V94 L84 88 L72 94 L60 88 L48 94 L36 88 L24 94 L12 88 L0 94 Z" fill="url(#band)" stroke="#9A6A0C" stroke-width="1.2"/>` +
			sparkle(30, 22, 6, "#FFFFFF") + sparkle(72, 70, 5, "#FFF3B0") + sparkle(34, 104, 4, "#FFFFFF") + sparkle(66, 20, 3, "#FFF3B0"),
	},
	Superior: {
		outline: "#16236A",
		defs: `<radialGradient id="shell" cx="0.38" cy="0.3" r="0.8">
			<stop offset="0" stop-color="#E6F1FF"/><stop offset="0.5" stop-color="#4F86FF"/><stop offset="1" stop-color="#1A33A0"/>
		</radialGradient>
		<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#FFF1A8"/><stop offset="1" stop-color="#E2A21A"/>
		</linearGradient>`,
		decor:
			`<rect x="0" y="54" width="100" height="10" fill="url(#gold)" stroke="#8C5E08" stroke-width="1.5"/>` +
			[10, 30, 50, 70, 90]
				.map((x) => `<path d="M${x} 47 L${x + 7} 59 L${x} 71 L${x - 7} 59 Z" fill="url(#gold)" stroke="#8C5E08" stroke-width="1.5"/>`)
				.join("") +
			[30, 70].map((x) => `<circle cx="${x}" cy="59" r="2.6" fill="#FF4F7B"/>`).join("") +
			`<circle cx="50" cy="59" r="3" fill="#5CF2FF"/>` +
			sparkle(30, 24, 6, "#FFFFFF") + sparkle(70, 34, 4, "#FFF3B0") + sparkle(64, 92, 5, "#FFFFFF") + sparkle(30, 98, 3, "#FFF3B0"),
	},
	Freshwater: {
		outline: "#0D4A3A",
		defs: `<radialGradient id="shell" cx="0.38" cy="0.3" r="0.8">
			<stop offset="0" stop-color="#EFFFF4"/><stop offset="0.5" stop-color="#6FD6A8"/><stop offset="1" stop-color="#1B8268"/>
		</radialGradient>
		<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#C4F3FF"/><stop offset="1" stop-color="#4FB8E0"/>
		</linearGradient>`,
		decor:
			`<path d="M0 46 C10 40 20 40 30 46 C40 52 50 52 60 46 C70 40 80 40 90 46 C95 49 98 50 100 50 V58 C90 58 80 52 70 52 C60 52 50 60 40 60 C30 60 20 52 10 52 C5 52 2 54 0 55 Z" fill="url(#water)" stroke="#2C7FA3" stroke-width="1.5"/>` +
			`<path d="M0 84 C10 79 20 79 30 84 C40 89 50 89 60 84 C70 79 80 79 90 84 C95 87 98 88 100 88 V95 C90 95 80 90 70 90 C60 90 50 97 40 97 C30 97 20 90 10 90 C5 90 2 92 0 93 Z" fill="url(#water)" stroke="#2C7FA3" stroke-width="1.2"/>` +
			[[30, 28, 4], [40, 20, 2.5], [70, 68, 3.5], [78, 60, 2], [34, 70, 2.5]]
				.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" fill-opacity="0.35" stroke="#FFFFFF" stroke-width="1.3"/>`)
				.join("") +
			`<path d="M62 22 C70 14 80 16 82 22 C76 26 68 27 62 22 Z" fill="#2FA36B" stroke="#0D4A3A" stroke-width="1.2"/>`,
	},
	// Rainforest river: jungle leaves around a winding golden river (Amazon cichlids)
	Amazon: {
		outline: "#163A12",
		defs: `<radialGradient id="shell" cx="0.38" cy="0.3" r="0.8">
			<stop offset="0" stop-color="#F3FFD6"/><stop offset="0.5" stop-color="#7CC243"/><stop offset="1" stop-color="#25601E"/>
		</radialGradient>
		<linearGradient id="river" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#8FF0E6"/><stop offset="1" stop-color="#2496A8"/>
		</linearGradient>`,
		decor:
			`<path d="M0 58 C18 46 30 64 48 52 C64 41 76 54 100 38 V54 C80 68 66 56 50 68 C32 80 18 62 0 74 Z" fill="url(#river)" stroke="#E2A21A" stroke-width="2"/>` +
			`<path d="M8 64 C20 56 30 68 44 60 M58 52 C68 46 78 52 90 46" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>` +
			leaf(50, 124, 46, -90, "#24661D", "#123010") +
			leaf(44, 124, 44, -125, "#3A9A2C", "#123010") +
			leaf(56, 124, 44, -55, "#2E7D24", "#123010") +
			leaf(30, 126, 42, -150, "#2E7D24", "#123010") +
			leaf(70, 126, 42, -30, "#3A9A2C", "#123010") +
			leaf(-2, 8, 40, 40, "#2E7D24", "#123010") +
			leaf(102, 4, 38, 140, "#3A9A2C", "#123010") +
			sparkle(32, 30, 6, "#FFFFFF") + sparkle(68, 30, 4, "#FFF3B0") + sparkle(26, 60, 3, "#FFFFFF"),
	},
	// Night reef: glowing magenta and cyan corals on a deep indigo shell (Neon Coral Lagoon)
	NeonCoral: {
		outline: "#14093A",
		defs: `<radialGradient id="shell" cx="0.38" cy="0.3" r="0.8">
			<stop offset="0" stop-color="#C9B8FF"/><stop offset="0.45" stop-color="#4B2FA8"/><stop offset="1" stop-color="#160B46"/>
		</radialGradient>`,
		decor:
			neonCoral(
				"M24 122 C24 108 20 100 22 90 M22 104 C14 98 12 92 12 84 M22 90 C18 82 22 76 18 68 M22 90 C28 84 32 80 32 72",
				[[12, 84], [18, 68], [32, 72]],
				"#FF3FD2",
				"#FFD6F6",
			) +
			neonCoral(
				"M74 122 C74 110 78 102 76 94 M76 106 C84 100 88 94 88 86 M76 94 C70 88 70 82 66 76 M76 94 C80 86 78 80 82 74",
				[[88, 86], [66, 76], [82, 74]],
				"#2EF2FF",
				"#E0FFFF",
			) +
			neonCoral("M50 122 C50 114 46 108 48 100 M48 108 C54 104 56 100 58 94", [[48, 100], [58, 94]], "#B6FF3B", "#F4FFD6") +
			[[34, 46, 1.6], [62, 30, 1.2], [70, 52, 1.4], [44, 22, 1], [80, 38, 1], [28, 60, 1.1]]
				.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" opacity="0.85"/>`)
				.join("") +
			sparkle(30, 26, 6, "#FFFFFF") + sparkle(66, 44, 4, "#9CF7FF") + sparkle(56, 66, 3, "#FFB8F0"),
	},
	// Sunken wreck: deep sea-green shell, a band of old ship planks with brass nails, gold coins, bubbles
	// (no skull, no cannon, no bottle: CLAUDE.md §7)
	Wreck: {
		outline: "#0B2B26",
		defs: `<radialGradient id="shell" cx="0.38" cy="0.3" r="0.8">
			<stop offset="0" stop-color="#D8FFF0"/><stop offset="0.5" stop-color="#2E9C82"/><stop offset="1" stop-color="#0E4A40"/>
		</radialGradient>
		<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#B9814A"/><stop offset="1" stop-color="#6E4322"/>
		</linearGradient>
		<radialGradient id="coin" cx="0.4" cy="0.35" r="0.7">
			<stop offset="0" stop-color="#FFF4B0"/><stop offset="1" stop-color="#E2A21A"/>
		</radialGradient>`,
		decor:
			`<rect x="0" y="50" width="100" height="9" fill="url(#wood)" stroke="#3E2410" stroke-width="1.5"/>` +
			`<rect x="0" y="59" width="100" height="9" fill="url(#wood)" stroke="#3E2410" stroke-width="1.5"/>` +
			[[14, 54.5], [86, 54.5], [36, 63.5], [64, 63.5]]
				.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="1.8" fill="#F2C14E" stroke="#7A4A06" stroke-width="0.8"/>`)
				.join("") +
			[[30, 92, 7], [48, 98, 6], [66, 90, 7], [40, 106, 5]]
				.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#coin)" stroke="#8C5E08" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="none" stroke="#B57A0E" stroke-width="1"/>`)
				.join("") +
			[[30, 30, 4], [38, 20, 2.5], [72, 36, 3], [78, 26, 2]]
				.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" fill-opacity="0.3" stroke="#FFFFFF" stroke-width="1.3"/>`)
				.join("") +
			sparkle(70, 78, 4, "#FFF3B0") + sparkle(24, 76, 3, "#FFFFFF"),
	},
	// Atlantis: pale marble and turquoise shell, a golden Greek-key band, a glowing turquoise sun-crystal
	Atlantis: {
		outline: "#0B3446",
		defs: `<radialGradient id="shell" cx="0.38" cy="0.3" r="0.8">
			<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="#9FE8E6"/><stop offset="1" stop-color="#2A8FA6"/>
		</radialGradient>
		<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#FFF1A8"/><stop offset="1" stop-color="#E2A21A"/>
		</linearGradient>
		<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
			<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.45" stop-color="#5CF2FF"/><stop offset="1" stop-color="#5CF2FF" stop-opacity="0"/>
		</radialGradient>`,
		decor:
			`<rect x="0" y="66" width="100" height="12" fill="url(#gold)" stroke="#8C5E08" stroke-width="1.5"/>` +
			[0, 12, 24, 36, 48, 60, 72, 84, 96]
				.map((x) => `<path d="M${x + 2} 75 V69 H${x + 9} V73 H${x + 5}" fill="none" stroke="#8C5E08" stroke-width="1.6" stroke-linejoin="round"/>`)
				.join("") +
			`<circle cx="50" cy="42" r="17" fill="url(#glow)"/>` +
			`<path d="M50 30 L57 42 L50 54 L43 42 Z" fill="#7FF6FF" stroke="#0B6C80" stroke-width="1.6"/>` +
			`<path d="M50 30 L50 54 M43 42 L57 42" stroke="#FFFFFF" stroke-width="1" opacity="0.8"/>` +
			[[22, 96], [78, 96]]
				.map(([x, y]) => `<rect x="${x - 5}" y="${y - 10}" width="10" height="22" rx="1.5" fill="#F7F4EA" stroke="#9A9078" stroke-width="1.2"/><path d="M${x - 2.5} ${y - 8} V${y + 10} M${x + 2.5} ${y - 8} V${y + 10}" stroke="#C9C0A8" stroke-width="1"/>`)
				.join("") +
			sparkle(30, 26, 6, "#FFFFFF") + sparkle(72, 24, 4, "#FFF3B0") + sparkle(50, 100, 4, "#FFFFFF"),
	},
};

function svg(body, defs = "") {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" viewBox="0 0 100 120">
	<defs><clipPath id="egg"><path d="${EGG}"/></clipPath>${defs}</defs>
	${body}
</svg>
`;
}

/** The whole egg: shell, pattern clipped to the shell, shine, outline. */
function eggBody(egg) {
	return `<path d="${EGG}" fill="url(#shell)"/>
	<g clip-path="url(#egg)">${egg.decor}
		<path d="M6 92 C20 116 80 116 94 92 L94 120 L6 120 Z" fill="#000000" opacity="0.12"/>
	</g>
	<ellipse cx="33" cy="28" rx="7" ry="13" transform="rotate(25 33 28)" fill="#FFFFFF" opacity="0.75"/>
	<path d="${EGG}" fill="none" stroke="${egg.outline}" stroke-width="4"/>`;
}

// Crack overlays, shared by every egg (drawn over the intact egg), each one bigger than the last
const CRACK_STROKE = `fill="none" stroke="#2A1A0E" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
const CRACKS = [
	`<path d="M96 60 L90 55 L80 67 L74 60" ${CRACK_STROKE}/><path d="M80 67 L82 74" ${CRACK_STROKE}/>`,
	`<path d="${zigPath(ZIG.slice(4).reverse())}" ${CRACK_STROKE}/>` +
		`<path d="M80 67 L83 76 L79 82" ${CRACK_STROKE}/><path d="M70 55 L66 46" ${CRACK_STROKE}/>`,
	`<path d="${zigPath(ZIG)}" ${CRACK_STROKE}/>` +
		`<path d="M80 67 L83 76 L79 82" ${CRACK_STROKE}/><path d="M70 55 L66 46 L70 40" ${CRACK_STROKE}/>` +
		`<path d="M30 55 L27 45" ${CRACK_STROKE}/><path d="M20 67 L18 77 L23 84" ${CRACK_STROKE}/><path d="M50 55 L52 47" ${CRACK_STROKE}/>`,
];

const files = {};
for (const [name, egg] of Object.entries(EGGS)) {
	files[`${name}Egg`] = svg(eggBody(egg), egg.defs);
	// Shell halves: the egg cut along the break line, with the broken edge outlined
	const edge = `<g clip-path="url(#egg)"><path d="${zigPath(ZIG)}" fill="none" stroke="${egg.outline}" stroke-width="5" stroke-linejoin="round"/></g>`;
	files[`${name}EggTop`] = svg(
		`<defs><clipPath id="top"><path d="${TOP_CLIP}"/></clipPath></defs><g clip-path="url(#top)">${eggBody(egg)}${edge}</g>`,
		egg.defs,
	);
	files[`${name}EggBottom`] = svg(
		`<defs><clipPath id="bottom"><path d="${BOTTOM_CLIP}"/></clipPath></defs><g clip-path="url(#bottom)">${eggBody(egg)}${edge}</g>`,
		egg.defs,
	);
}
CRACKS.forEach((crack, i) => {
	files[`EggCrack${i + 1}`] = svg(`<g clip-path="url(#egg)">${crack}</g>`);
});

for (const [name, content] of Object.entries(files)) {
	fs.writeFileSync(path.join(OUT, `${name}.svg`), content);
}
console.log(Object.keys(files).join(", "));
