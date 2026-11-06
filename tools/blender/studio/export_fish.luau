--!nocheck
-- Studio snippet (Edit, run by the agent through the Studio MCP's execute_luau; never a game script): exports a fish
-- template's mesh as OBJ (V flipped) and its colour texture at 512 as "W H R G B\n" + base64 RGBA, where R G B is the
-- SurfaceAppearance tint, to tools/obj-receiver.js on 127.0.0.1:34999 (the address in Studio's MCP HTTP allowlist).
-- Usage: set FISH below, start `node tools/obj-receiver.js design/rigs/work`, run, then
-- `node tools/blender/rgba-to-png.js design/rigs/work/<FISH>_color.b64` and move <FISH>.obj to design/meshes/.
local FISH = "GoldenGuppy"

local HttpService = game:GetService("HttpService")
local AssetService = game:GetService("AssetService")
local template = game:GetService("ServerStorage").Assets.Fish:FindFirstChild(FISH)
assert(template, "no template " .. FISH)
local part = template:FindFirstChild("Mesh")
assert(part and part:IsA("MeshPart"), FISH .. " has no Mesh MeshPart")
assert(not part.HasSkinnedMesh, FISH .. " is already rigged")

-- Mesh -> OBJ
local em = AssetService:CreateEditableMeshAsync(Content.fromUri(part.MeshId))
local lines = { "# " .. FISH .. ", exported from " .. part.MeshId .. " (EditableMesh, V flipped), MeshSize " .. tostring(part.MeshSize), "o " .. FISH }
local vIdx, tIdx, nIdx = {}, {}, {}
local nv, nt, nn = 0, 0, 0
for _, vid in em:GetVertices() do
	local p = em:GetPosition(vid)
	nv += 1; vIdx[vid] = nv
	table.insert(lines, string.format("v %.6f %.6f %.6f", p.X, p.Y, p.Z))
end
for _, uid in em:GetUVs() do
	local uv = em:GetUV(uid)
	nt += 1; tIdx[uid] = nt
	table.insert(lines, string.format("vt %.6f %.6f", uv.X, 1 - uv.Y))
end
for _, nid in em:GetNormals() do
	local n = em:GetNormal(nid)
	nn += 1; nIdx[nid] = nn
	table.insert(lines, string.format("vn %.6f %.6f %.6f", n.X, n.Y, n.Z))
end
local faces = em:GetFaces()
for _, fid in faces do
	local vs, us, ns = em:GetFaceVertices(fid), em:GetFaceUVs(fid), em:GetFaceNormals(fid)
	local f = { "f" }
	for i = 1, #vs do
		table.insert(f, string.format("%d/%s/%s", vIdx[vs[i]], us[i] and tIdx[us[i]] or "", ns[i] and nIdx[ns[i]] or ""))
	end
	table.insert(lines, table.concat(f, " "))
end
em:Destroy()
local obj = table.concat(lines, "\n") .. "\n"

-- Texture -> 512 RGBA (box downsample by strips) -> base64, with the tint in the header
local sa = part:FindFirstChildWhichIsA("SurfaceAppearance")
assert(sa and sa.ColorMap ~= "", FISH .. " has no SurfaceAppearance ColorMap")
local img = AssetService:CreateEditableImageAsync(Content.fromUri(sa.ColorMap))
local W = img.Size.X
local OUT = math.min(512, W)
local k = W // OUT
local px = buffer.create(OUT * OUT * 4)
for oy = 0, OUT - 1 do
	local strip = img:ReadPixelsBuffer(Vector2.new(0, oy * k), Vector2.new(W, k))
	for ox = 0, OUT - 1 do
		local r, g, b, a = 0, 0, 0, 0
		for sy = 0, k - 1 do
			for sx = 0, k - 1 do
				local i = ((sy * W) + ox * k + sx) * 4
				r += buffer.readu8(strip, i); g += buffer.readu8(strip, i + 1); b += buffer.readu8(strip, i + 2); a += buffer.readu8(strip, i + 3)
			end
		end
		local n = k * k
		local o = (oy * OUT + ox) * 4
		buffer.writeu8(px, o, r // n); buffer.writeu8(px, o + 1, g // n); buffer.writeu8(px, o + 2, b // n); buffer.writeu8(px, o + 3, a // n)
	end
	if oy % 64 == 0 then task.wait() end
end
img:Destroy()
local chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local map = {}
for i = 1, 64 do map[i - 1] = chars:sub(i, i) end
local len = buffer.len(px)
local parts, piece = {}, {}
for i = 0, len - 1, 3 do
	local b1 = buffer.readu8(px, i)
	local b2 = i + 1 < len and buffer.readu8(px, i + 1) or 0
	local b3 = i + 2 < len and buffer.readu8(px, i + 2) or 0
	local n = b1 * 65536 + b2 * 256 + b3
	table.insert(piece, map[n // 262144] .. map[(n // 4096) % 64] .. (i + 1 < len and map[(n // 64) % 64] or "=") .. (i + 2 < len and map[n % 64] or "="))
	if #piece >= 4096 then table.insert(parts, table.concat(piece)); piece = {} end
end
table.insert(parts, table.concat(piece))
local c = sa.Color
local texture = string.format("%d %d %d %d %d\n", OUT, OUT, math.round(c.R * 255), math.round(c.G * 255), math.round(c.B * 255)) .. table.concat(parts)

-- POST both, HttpEnabled on only for the calls
local function post(name, text)
	local CHUNK = 500000
	for i = 1, #text, CHUNK do
		local res = HttpService:RequestAsync({
			Url = "http://127.0.0.1:34999/" .. name,
			Method = "POST",
			Headers = { ["Content-Type"] = "text/plain", ["x-append"] = i > 1 and "1" or "0" },
			Body = text:sub(i, i + CHUNK - 1),
		})
		assert(res.Success, res.StatusMessage)
	end
end
local was = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local ok, err = pcall(function()
	post(FISH .. ".obj", obj)
	post(FISH .. "_color.b64", texture)
end)
HttpService.HttpEnabled = was
return string.format("%s ok=%s err=%s verts=%d tris=%d texture=%d tint=%s HttpEnabled=%s", FISH, tostring(ok), tostring(err), nv, #faces, OUT, tostring(c), tostring(HttpService.HttpEnabled))
