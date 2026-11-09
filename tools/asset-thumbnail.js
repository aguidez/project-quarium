// Downloads an image asset's public thumbnail (the whole UV atlas, 420x420 PNG; no auth), polling until it is ready.
// Studio's HTTP no longer reaches a local server, so a template's texture comes out this way (agent note
// blender-pipeline: the colour texture of a rig preview). Usage: node tools/asset-thumbnail.js <assetId> <out.png>
const fs = require("fs");
const [id, out] = process.argv.slice(2);
(async () => {
	for (let i = 0; i < 20; i++) {
		const res = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=420x420&format=Png`);
		const json = await res.json();
		const d = json.data && json.data[0];
		if (d && d.state === "Completed" && d.imageUrl) {
			const img = Buffer.from(await (await fetch(d.imageUrl)).arrayBuffer());
			fs.writeFileSync(out, img);
			console.log(`saved ${out} (${img.length} bytes)`);
			return;
		}
		console.log(`state ${d && d.state}, retry`);
		await new Promise((r) => setTimeout(r, 2000));
	}
	process.exit(1);
})();
