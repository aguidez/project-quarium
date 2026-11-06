--!nocheck
-- Studio snippet (Edit, run by the agent through the Studio MCP's execute_luau; never a game script): puts the skinned
-- mesh of an uploaded rig (Model asset) in place of a fish template's static `Mesh`: same name, Size, CFrame, physics
-- flags, attributes (not Roblox's RBX_* marks), SurfaceAppearance and WeldConstraint to `Body`; then `Rig = "Bones"`
-- on the template (FishRigController). Undo with Ctrl+Z, or put the static mesh id back (design/meshes/manifest.json).
-- Templates are looked up in Assets.Fish, then Assets.EventFish (the K-pop idol, the abyss LanternFish), then
-- Assets.Companions (the Swordfish).
-- Usage: set SWAPS below (template name -> uploaded Model id), run, then ask the owner to save + publish the place.
-- A template that pitches its mesh (the Mini Leviathan) keeps that pitch: the rig was made in the mesh's own space.
local SWAPS = { GoldenGuppy = 93278084123107 }

-- A skinned mesh resized through Size (not ScaleTo) keeps its bones where the import put them, for its MeshSize: the
-- skeleton then sits too small inside the mesh and the deformation crumples it (every swap of V1.1.1 to V1.1.9 but
-- the Golden Guppy's x1.3, fixed 2026-11-07). Move each bone to its mesh-space position x (Size / MeshSize), parents
-- first, keeping its orientation.
local function fitBones(mesh)
	local r = mesh.Size / mesh.MeshSize
	local bones = {}
	for _, b in mesh:GetDescendants() do
		if b:IsA("Bone") then
			table.insert(bones, { bone = b, pos = mesh.CFrame:PointToObjectSpace(b.WorldPosition), depth = #b:GetFullName():split(".") })
		end
	end
	table.sort(bones, function(a, b) return a.depth < b.depth end)
	for _, e in bones do
		e.bone.WorldPosition = mesh.CFrame:PointToWorldSpace(e.pos * r)
	end
end

local function swapOne(FISH, MODEL)
	local template = (game:GetService("ServerStorage").Assets.Fish:FindFirstChild(FISH) or game:GetService("ServerStorage").Assets.EventFish:FindFirstChild(FISH) or game:GetService("ServerStorage").Assets.Companions:FindFirstChild(FISH))
	assert(template, "no template " .. FISH)
	local old = template:FindFirstChild("Mesh")
	assert(old and old:IsA("MeshPart"), FISH .. " has no Mesh MeshPart")
	assert(not old.HasSkinnedMesh, FISH .. " is already rigged")
	local loaded = game:GetObjects("rbxassetid://" .. MODEL)[1]
	local rigged = loaded:FindFirstChildWhichIsA("MeshPart", true)
	rigged.Parent = nil -- out before the Model is destroyed, or its Parent gets locked
	loaded:Destroy()
	assert(rigged.HasSkinnedMesh, "the uploaded model's mesh is not skinned")

	-- TextureID too: a template whose look is a TextureID (the Snail) would come out grey otherwise (the K-pop idol)
	for _, p in { "Anchored", "CanCollide", "CanQuery", "CanTouch", "Massless", "CastShadow", "Transparency", "Material", "Color", "RenderFidelity", "DoubleSided", "Locked", "TextureID" } do
		pcall(function() rigged[p] = old[p] end)
	end
	rigged.Name = "Mesh"
	rigged.Size = old.Size
	rigged.CFrame = old.CFrame
	for k, v in old:GetAttributes() do
		if not k:match("^RBX_") then rigged:SetAttribute(k, v) end
	end
	local appearance = old:FindFirstChildWhichIsA("SurfaceAppearance")
	if appearance then appearance:Clone().Parent = rigged end
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = template:FindFirstChild("Body")
	weld.Part1 = rigged
	weld.Parent = rigged
	local oldId = old.MeshId
	old:Destroy()
	rigged.Parent = template
	fitBones(rigged) -- after the resize: the bones follow the mesh's new size
	template:SetAttribute("Rig", "Bones")
	local bones = 0
	for _, d in rigged:GetDescendants() do if d:IsA("Bone") then bones += 1 end end
	return string.format("%s: static %s -> skinned %s, %d bones, Size %s, weld %s->Mesh", FISH, oldId, rigged.MeshId, bones, tostring(rigged.Size), weld.Part0 and weld.Part0.Name or "NONE")
end

local report = {}
for fish, model in SWAPS do
	local ok, line = pcall(swapOne, fish, model)
	table.insert(report, ok and line or (fish .. " FAILED: " .. tostring(line)))
end
game:GetService("ChangeHistoryService"):SetWaypoint("Fish templates on skinned meshes (V1.1)")
table.sort(report)
return table.concat(report, "\n")
