// Lets the game use assets its owner's account made: the game belongs to the owner's group, while the meshes, audio
// and images generated or uploaded from Studio belong to the owner's user account. A private sound then stays silent
// for every player but the owner ("User is not authorized to access Asset") until the experience is granted its use.
//
// Usage: node tools/share-assets.js <assetId> [assetId...]
// Needs robloxOpenCloudKey (workspace.local.json, see SETUP.md) with the Asset Permissions API system (write), made by
// the account that owns the assets. The grant can't be taken back through the API.

const config = require("./local-config");

const UNIVERSE_ID = config.get("robloxUniverseId", "10774507209"); // Project: Quarium's experience (game.GameId)
const ENDPOINT = "https://apis.roblox.com/asset-permissions-api/v1/assets/permissions";

const ids = process.argv.slice(2).map(Number);
if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
	console.error("Usage: node tools/share-assets.js <assetId> [assetId...]");
	process.exit(1);
}
const apiKey = config.get("robloxOpenCloudKey");
if (!apiKey) {
	console.error("No Open Cloud key: set robloxOpenCloudKey in workspace.local.json (see SETUP.md).");
	process.exit(1);
}

(async () => {
	const res = await fetch(ENDPOINT, {
		method: "PATCH",
		headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
		body: JSON.stringify({
			subjectType: "Universe",
			subjectId: UNIVERSE_ID,
			action: "Use",
			requests: ids.map((assetId) => ({ assetId, grantToDependencies: false })),
		}),
	});
	const text = await res.text();
	if (!res.ok) {
		console.error(`${res.status} ${res.statusText}: ${text}`);
		if (res.status === 403) console.error("The key needs the Asset Permissions API system (write), see SETUP.md.");
		process.exit(1);
	}
	// The API may answer 200 without granting when the key lacks the scope: trust successAssetIds only
	const json = JSON.parse(text);
	const granted = new Set(json.successAssetIds || []);
	console.log(`Universe ${UNIVERSE_ID}: ${granted.size} / ${ids.length} assets granted.`);
	for (const error of json.errors || []) console.log(`  not granted: ${error.assetId} (${error.code})`);
	const missing = ids.filter((id) => !granted.has(id) && !(json.errors || []).some((e) => e.assetId === id));
	if (missing.length > 0) console.log(`  no answer for: ${missing.join(", ")}`);
	process.exit(granted.size === ids.length ? 0 : 1);
})().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
