// "Closed gate" drawn in a shop porthole (84x62, same oval) for eggs the player hasn't unlocked yet.
// Imported into FigCraft (design/ui/shopbar.figcraft, "LockedGate" frame) and exported at 2x as PNG.
// Run: node design/ui/gate.build.js
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "eggs");
fs.mkdirSync(OUT, { recursive: true });

const bars = [14, 28, 42, 56, 70]
	.map((x) => `<rect x="${x - 3}" y="-2" width="6" height="66" fill="url(#iron)" stroke="#22292E" stroke-width="1.5"/>`)
	.join("");
const crossbars = [14, 46]
	.map((y) => `<rect x="-2" y="${y - 2.5}" width="88" height="5" rx="2" fill="url(#iron)" stroke="#22292E" stroke-width="1.5"/>`)
	.join("");
const rivets = [14, 28, 42, 56, 70]
	.flatMap((x) => [14, 46].map((y) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#D5DCE1"/>`))
	.join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="62" viewBox="0 0 84 62">
	<defs>
		<clipPath id="porthole"><rect x="0" y="0" width="84" height="62" rx="31"/></clipPath>
		<linearGradient id="iron" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#9AA4AC"/><stop offset="1" stop-color="#4A535A"/>
		</linearGradient>
		<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#FFE07A"/><stop offset="1" stop-color="#C98E32"/>
		</linearGradient>
	</defs>
	<g clip-path="url(#porthole)">
		<rect x="0" y="0" width="84" height="62" fill="#000000" opacity="0.25"/>
		${bars}${crossbars}${rivets}
	</g>
	<path d="M35 31 V25 A7 7 0 0 1 49 25 V31" fill="none" stroke="#2A2F33" stroke-width="6.5" stroke-linecap="round"/>
	<path d="M35 31 V25 A7 7 0 0 1 49 25 V31" fill="none" stroke="#C3CBD1" stroke-width="3.5" stroke-linecap="round"/>
	<rect x="30" y="29" width="24" height="19" rx="4" fill="url(#gold)" stroke="#6E4A12" stroke-width="2"/>
	<circle cx="42" cy="36.5" r="2.6" fill="#4A2E0A"/>
	<path d="M40.8 37.5 L43.2 37.5 L44 43 L40 43 Z" fill="#4A2E0A"/>
</svg>
`;

fs.writeFileSync(path.join(OUT, "LockedGate.svg"), svg);
console.log("LockedGate");
