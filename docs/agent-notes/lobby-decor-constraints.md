---
name: lobby-decor-constraints
description: "Beach lobby (built in Studio 2026-10-28) — where decor may go without blocking the aquarium focus camera, plus terrain/MCP quirks"
metadata:
  type: project
  modified: 2026-10-28T16:23:15.561Z
---

The lobby is a beach island built directly in Studio (Workspace.Lobby: Environment/Boardwalk/Fence/Boundaries, Props; reusable meshes in ServerStorage.Assets.Lobby; old pieces kept in ServerStorage.LobbyBackup_Old). Art direction: 80/20 — 80% calm base (sand F0DDB2, driftwood D2AE82, whitewash F6F1E7, lagoon 17707F), 20% accents (coral FF7A5C, sun FFC94A, palm green).

**Why:** FocusController puts a FOV-20 camera ~90–115 studs in front of each tank glass (eye y≈13.5, x = tank x). Anything tall inside that cone hides the tank.

**How to apply:**
- In front of the tanks (|z| > 27): only low props (< ~3 studs) near tank x = -64 / 0 / 64; tall props (palms, umbrellas, torches) only in the corridors x ≈ ±32 or beyond |x| ≈ 92.
- Between tanks (gap x 24.5–39.5) palm fronds must not cross the glass: use small palms there.
- Verify with screen_capture after setting CurrentCamera.FieldOfView = 20 at (tankX, 13.5, ±139.9) for the 1.41 Studio viewport; restore FOV 70 after. In play mode, screen_capture/execute_luau reset the scripted camera, so read Camera.CFrame instead of trusting play captures.
- Never use Enum.Material.Glass on see-through parts: Roblox hides particles/transparent objects behind it. Aquarium glass was switched to SmoothPlastic (transp 0.7, reflectance 0.08) on 2026-10-28 for this reason.
- Smooth terrain: a solid top voxel renders its surface at voxelBottom + 2 + 4·occupancy (full voxel = +2). Plateau at y=0 uses occupancy 0.5 in the -4..0 layer; water (liquid) is linear (surface at -1).
- **Fishing huts (2026-10-31, V0.41)**: `Workspace.Lobby.FishingHutEast` (113, 0, 0, facing −X, behind the spawn) and `FishingHutWest` (−113, 0, 0, facing +X): the two ends of the central aisle between the tank rows (the aisle is narrow, |z| < 3.7, walled by the tank backs). The LobbySpawn and its sun moved to x 100, the WelcomeSign and its torches to (108, 0, 64) facing −Z; west palms moved from (−104, 12) / (−107, −4) to (−106, 20) / (−108, −18), the north-east palm from (114, 54) to (119, 50). The fisherman is raised 2.9 studs (no floor under him) so his chest shows above the counter (≈ 5.3 studs).
- **Boundaries**: the 4 invisible walls in Environment/Boundaries. On 2026-10-31 the south one (z −76, 244 long) was rotated 90° and cut the lobby along x = 0 in front of the middle tanks: if players hit "an invisible wall", raycast at player height and check that folder first.
