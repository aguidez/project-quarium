--!nocheck
-- Studio snippet (Edit, run by the agent through the Studio MCP's execute_luau; never a game script): puts the skinned
-- mesh of an uploaded rig (Model asset) in place of a fish template's static `Mesh`: same name, Size, CFrame, physics
-- flags, attributes (not Roblox's RBX_* marks), SurfaceAppearance and WeldConstraint to `Body`; then `Rig = "Bones"`
-- on the template (FishRigController). Undo with Ctrl+Z, or put the static mesh id back (design/meshes/manifest.json).
-- Usage: set SWAPS below (template name -> uploaded Model id), run, then ask the owner to save + publish the place.
-- A template that pitches its mesh (the Mini Leviathan) keeps that pitch: the rig was made in the mesh's own space.
local SWAPS = { GoldenGuppy = 93278084123107 }

local function swapOne(FISH, MODEL)
	local template = game:GetService("ServerStorage").Assets.Fish:FindFirstChild(FISH)
	assert(template, "no template " .. FISH)
	local old = template:FindFirstChild("Mesh")
	assert(old and old:IsA("MeshPart"), FISH .. " has no Mesh MeshPart")
	assert(not old.HasSkinnedMesh, FISH .. " is already rigged")
	local loaded = game:GetObjects("rbxassetid://" .. MODEL)[1]
	local rigged = loaded:FindFirstChildWhichIsA("MeshPart", true)
	rigged.Parent = nil -- out before the Model is destroyed, or its Parent gets locked
	loaded:Destroy()
	assert(rigged.HasSkinnedMesh, "the uploaded model's mesh is not skinned")

	for _, p in { "Anchored", "CanCollide", "CanQuery", "CanTouch", "Massless", "CastShadow", "Transparency", "Material", "Color", "RenderFidelity", "DoubleSided", "Locked" } do
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
