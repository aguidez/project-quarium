// Minimal reader of Roblox binary places (.rbxl): decompresses the chunks (LZ4 or zstd), lists the classes and, for one
// class, the string properties of every instance (MeshId, TextureID, Name...), filtered by a needle. Read-only.
// Used to recover a property a later edit lost from an older copy of the place, e.g. Studio's auto-saves
// (Windows: %LOCALAPPDATA%/Roblox/RobloxStudio/AutoSaves/<placeId>_AutoRecovery_<n>.rbxl): the K-pop idol's TextureID.
// Usage: node tools/rbxl-read.js <file.rbxl> [ClassName] [needle]   (no class: the class list with counts)
const fs = require("fs");
const zlib = require("zlib");

function lz4Block(src, outLen) {
	const out = Buffer.alloc(outLen);
	let i = 0, o = 0;
	while (i < src.length) {
		const token = src[i++];
		let lit = token >> 4;
		if (lit === 15) { let b; do { b = src[i++]; lit += b; } while (b === 255); }
		src.copy(out, o, i, i + lit); i += lit; o += lit;
		if (i >= src.length) break;
		const off = src[i] | (src[i + 1] << 8); i += 2;
		let len = token & 15;
		if (len === 15) { let b; do { b = src[i++]; len += b; } while (b === 255); }
		len += 4;
		for (let k = 0; k < len; k++) { out[o] = out[o - off]; o++; }
	}
	return out;
}

function chunks(buf) {
	if (buf.toString("latin1", 0, 8) !== "<roblox!") throw new Error("not a binary place");
	let p = 32;
	const list = [];
	while (p < buf.length) {
		const name = buf.toString("latin1", p, p + 4).replace(/\0/g, "");
		const clen = buf.readUInt32LE(p + 4), ulen = buf.readUInt32LE(p + 8);
		p += 16;
		let data;
		if (clen === 0) { data = buf.subarray(p, p + ulen); p += ulen; }
		else {
			const raw = buf.subarray(p, p + clen); p += clen;
			data = raw.readUInt32BE(0) === 0x28b52ffd ? zlib.zstdDecompressSync(raw) : lz4Block(raw, ulen);
		}
		list.push({ name, data });
		if (name === "END") break;
	}
	return list;
}

function readStr(d, p) { const n = d.readUInt32LE(p); return [d.toString("utf8", p + 4, p + 4 + n), p + 4 + n]; }

const [file, wantClass, needle] = process.argv.slice(2);
const cs = chunks(fs.readFileSync(file));
const classes = {};
for (const c of cs.filter((c) => c.name === "INST")) {
	const d = c.data;
	const id = d.readUInt32LE(0);
	const [cls, p] = readStr(d, 4);
	const count = d.readUInt32LE(p + 1);
	classes[id] = { cls, count, props: {} };
}
for (const c of cs.filter((c) => c.name === "PROP")) {
	const d = c.data;
	const id = d.readUInt32LE(0);
	const [prop, p] = readStr(d, 4);
	const type = d[p];
	const k = classes[id];
	if (!k) continue;
	// 0x01 String, 0x22? Content: read as strings when they look like a u32-length list
	if (type === 0x01) {
		const vals = []; let q = p + 1;
		for (let i = 0; i < k.count; i++) { const [s, n] = readStr(d, q); vals.push(s); q = n; }
		k.props[prop] = vals;
	} else {
		k.props[prop] = { type, bytes: d.length - p - 1 };
	}
}
if (!wantClass) {
	for (const k of Object.values(classes)) console.log(k.cls, k.count);
	process.exit(0);
}
for (const k of Object.values(classes).filter((k) => k.cls === wantClass)) {
	console.log("props:", Object.entries(k.props).map(([n, v]) => (Array.isArray(v) ? n : `${n}(0x${v.type.toString(16)})`)).join(", "));
	const names = k.props.Name || [];
	for (let i = 0; i < k.count; i++) {
		const row = {};
		for (const [n, v] of Object.entries(k.props)) if (Array.isArray(v)) row[n] = v[i];
		if (!needle || JSON.stringify(row).includes(needle)) console.log(i, JSON.stringify(row));
	}
}
