// Receives the OBJ files a Studio script POSTs (HttpService, enabled for the export only) and writes them into a
// folder: how a mesh is exported from the place (docs/agent-notes/blender-pipeline.md, batch checklist step 1).
// Usage: node tools/obj-receiver.js design/meshes [port=34999]. Local only (127.0.0.1); header x-append: 1 appends a
// piece to the file (send big meshes in ~500 KB pieces). Also takes <Name>.b64: a texture as base64 RGBA (a 512 pull for the
// Blender previews), turned into a PNG by tools/blender/rgba-to-png.js. Studio's MCP only reaches the addresses of its
// HTTP allowlist (Assistant Settings → MCP Permissions): 127.0.0.1:34999 is the one approved, keep this port.
const http = require("http");
const fs = require("fs");
const path = require("path");

const outDir = process.argv[2];
const port = Number(process.argv[3] || 34999);
if (!outDir) {
	console.error("Usage: node tools/obj-receiver.js <folder> [port]");
	process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

http.createServer((req, res) => {
	const name = decodeURIComponent((req.url || "/").slice(1));
	if (req.method !== "POST" || !/^[A-Za-z0-9_]+\.(obj|b64)$/.test(name)) {
		res.writeHead(400);
		return res.end("bad request");
	}
	const chunks = [];
	req.on("data", (c) => chunks.push(c));
	req.on("end", () => {
		const body = Buffer.concat(chunks);
		const append = req.headers["x-append"] === "1";
		const file = path.join(outDir, name);
		if (append) fs.appendFileSync(file, body);
		else fs.writeFileSync(file, body);
		console.log(`${append ? "appended" : "wrote"} ${name} (${body.length} bytes)`);
		res.writeHead(200);
		res.end("ok");
	});
}).listen(port, "127.0.0.1", () => console.log(`listening on 127.0.0.1:${port} -> ${outDir}`));
