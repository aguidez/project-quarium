// Uploads meshes as the owner's group, so the clients may animate them. The game belongs to the group: a mesh the
// clients load with AssetService.CreateEditableMeshAsync (fish, Swordfish, event guests) must be owned by the group,
// or every player but its owner gets "not allowed to be forked" (sharing it with the universe is not enough).
//
// Usage: node tools/group-mesh-upload.js design/meshes/<Name>.obj [more.obj...]
// For each OBJ (exported from Studio, see docs/agent-notes/fish-asset-pipeline.md "Meshes the group owns"): converts it
// to binary glTF, uploads it as a Model of the group (Open Cloud Assets API), grants its use to the owner's account
// (Studio) and to the game's universe (with its dependencies: the mesh inside), and prints { name: modelId } as JSON.
// Needs robloxGroupOpenCloudKey in workspace.local.json: a key made under the group with the API systems Assets
// (read, write) and Asset Permissions (write).

const fs = require("fs");
const path = require("path");
const config = require("./local-config");

const GROUP_ID = config.get("robloxGroupId", "815548702");
const UNIVERSE_ID = config.get("robloxUniverseId", "10774507209");
const OWNER_USER_ID = config.get("robloxOwnerUserId", "10580349267"); // the account that develops in Studio

/** OBJ (v / vt / vn / polygons) -> GLB. V flipped back (OBJ bottom-left origin), X and Z negated: Roblox's glTF import
 *  turns a mesh 180° around Y, so the uploaded mesh lands exactly as exported (checked vertex by vertex, V0.60.5). */
function objToGlb(file) {
	const v = [],
		vt = [],
		vn = [];
	const keys = new Map();
	const positions = [],
		normals = [],
		uvs = [],
		indices = [];
	for (const line of fs.readFileSync(file, "utf8").split("\n")) {
		const parts = line.trim().split(/\s+/);
		if (parts[0] === "v") v.push(parts.slice(1, 4).map(Number));
		else if (parts[0] === "vt") vt.push(parts.slice(1, 3).map(Number));
		else if (parts[0] === "vn") vn.push(parts.slice(1, 4).map(Number));
		else if (parts[0] === "f") {
			const corners = parts.slice(1).map((corner) => {
				let index = keys.get(corner);
				if (index === undefined) {
					const [a, b, c] = corner.split("/").map(Number);
					index = positions.length / 3;
					keys.set(corner, index);
					const p = v[a - 1];
					positions.push(-p[0], p[1], -p[2]);
					const uv = b ? vt[b - 1] : [0, 0];
					uvs.push(uv[0], 1 - uv[1]);
					const n = c ? vn[c - 1] : [0, 1, 0];
					normals.push(-n[0], n[1], -n[2]);
				}
				return index;
			});
			for (let k = 1; k + 1 < corners.length; k++) indices.push(corners[0], corners[k], corners[k + 1]);
		}
	}
	const count = positions.length / 3;
	const min = [Infinity, Infinity, Infinity];
	const max = [-Infinity, -Infinity, -Infinity];
	for (let i = 0; i < count; i++)
		for (let a = 0; a < 3; a++) {
			min[a] = Math.min(min[a], positions[i * 3 + a]);
			max[a] = Math.max(max[a], positions[i * 3 + a]);
		}
	const buffers = [
		Buffer.from(new Float32Array(positions).buffer),
		Buffer.from(new Float32Array(normals).buffer),
		Buffer.from(new Float32Array(uvs).buffer),
		Buffer.from(new Uint32Array(indices).buffer),
	];
	let offset = 0;
	const bufferViews = buffers.map((b, i) => {
		const view = { buffer: 0, byteOffset: offset, byteLength: b.length, target: i === 3 ? 34963 : 34962 };
		offset += b.length;
		return view;
	});
	const bin = Buffer.concat(buffers);
	const name = path.basename(file, ".obj");
	const gltf = {
		asset: { version: "2.0", generator: "project-quarium group-mesh-upload" },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ mesh: 0, name }],
		meshes: [
			{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, mode: 4 }] },
		],
		buffers: [{ byteLength: bin.length }],
		bufferViews,
		accessors: [
			{ bufferView: 0, componentType: 5126, count, type: "VEC3", min, max },
			{ bufferView: 1, componentType: 5126, count, type: "VEC3" },
			{ bufferView: 2, componentType: 5126, count, type: "VEC2" },
			{ bufferView: 3, componentType: 5125, count: indices.length, type: "SCALAR" },
		],
	};
	let json = Buffer.from(JSON.stringify(gltf));
	json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
	const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
	const chunk = (type, data) => {
		const header = Buffer.alloc(8);
		header.writeUInt32LE(data.length, 0);
		header.writeUInt32LE(type, 4);
		return Buffer.concat([header, data]);
	};
	const header = Buffer.alloc(12);
	header.writeUInt32LE(0x46546c67, 0);
	header.writeUInt32LE(2, 4);
	header.writeUInt32LE(12 + 8 + json.length + 8 + binPadded.length, 8);
	return { name, glb: Buffer.concat([header, chunk(0x4e4f534a, json), chunk(0x004e4942, binPadded)]) };
}

async function upload(key, name, glb) {
	const form = new FormData();
	form.append(
		"request",
		JSON.stringify({
			assetType: "Model",
			displayName: `Quarium_${name}`,
			description: "Project: Quarium mesh",
			creationContext: { creator: { groupId: GROUP_ID } },
		}),
	);
	form.append("fileContent", new Blob([glb], { type: "model/gltf-binary" }), `${name}.glb`);
	const res = await fetch("https://apis.roblox.com/assets/v1/assets", {
		method: "POST",
		headers: { "x-api-key": key },
		body: form,
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
	const op = JSON.parse(text);
	const opPath = op.path || `operations/${op.operationId}`;
	for (let i = 0; i < 60 && !op.done; i++) {
		await new Promise((r) => setTimeout(r, 2000));
		const poll = await fetch(`https://apis.roblox.com/assets/v1/${opPath}`, { headers: { "x-api-key": key } });
		Object.assign(op, await poll.json());
	}
	if (!op.done) throw new Error(`operation ${opPath} not done`);
	if (op.error) throw new Error(JSON.stringify(op.error));
	return Number(op.response.assetId);
}

async function grant(key, subjectType, subjectId, ids, dependencies) {
	const res = await fetch("https://apis.roblox.com/asset-permissions-api/v1/assets/permissions", {
		method: "PATCH",
		headers: { "x-api-key": key, "Content-Type": "application/json" },
		body: JSON.stringify({
			subjectType,
			subjectId,
			action: "Use",
			requests: ids.map((assetId) => ({ assetId, grantToDependencies: dependencies })),
		}),
	});
	const json = await res.json().catch(() => ({}));
	const granted = (json.successAssetIds || []).length;
	if (!res.ok || granted !== ids.length)
		throw new Error(
			`${subjectType} grant: ${res.status} ${granted}/${ids.length} ${JSON.stringify(json.errors || json.error || "")}`,
		);
}

(async () => {
	const files = process.argv.slice(2);
	const key = config.get("robloxGroupOpenCloudKey");
	if (files.length === 0 || !key) {
		console.error(
			"Usage: node tools/group-mesh-upload.js <file.obj> [more.obj...]  (needs robloxGroupOpenCloudKey, see SETUP.md)",
		);
		process.exit(1);
	}
	const models = {};
	for (const file of files) {
		const { name, glb } = objToGlb(file);
		models[name] = await upload(key, name, glb);
		console.error(`${name}: model ${models[name]}`);
	}
	const ids = Object.values(models);
	await grant(key, "User", OWNER_USER_ID, ids, false); // Studio loads it with the developer's rights
	await grant(key, "Universe", UNIVERSE_ID, ids, true); // the meshes inside, for the game
	console.error("Granted to the owner's account and the game.");
	console.log(JSON.stringify(models));
})().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
