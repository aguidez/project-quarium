---
name: blender-pipeline
description: Blender in the toolchain (V1.1 animations): the official Blender Lab MCP, how it is installed and started, its tools, quirks
type: reference
---

**Versions (pinned in `tools/blender/blender-config.js`):** Blender **5.2 LTS** (supported to July 2028) on every
machine; **Blender Lab MCP 1.0.3**, the official one (https://www.blender.org/lab/mcp-server/, source
projects.blender.org/lab/blender_mcp, GPL). Chosen on 2026-11-06 over the community "MCP for Blender" (ahujasid):
official, no third-party asset features (no Poly Haven / Sketchfab / AI generation), no outbound network call in the
server's code (checked: the only URLs are in its bundled Blender docs).

**How it works.** Two pieces:
- the **add-on** (extension `mcp`, module `bl_ext.user_default.mcp`) runs a TCP bridge *inside* Blender
  (127.0.0.1:9876, `blenderMcpPort`); it receives Python code as null-terminated JSON, `exec`s it on the main thread
  and returns the `result` dict (must be JSON-serialisable) + stdout / stderr. Auto-starts ~1 s after Blender opens.
  It refuses to start while Blender's *Allow Online Access* is off (they count localhost as online).
- the **MCP server** (`blender-mcp`, Python ≥ 3.10, FastMCP, stdio) run by **uv** from
  `tools/blender/vendor/mcp-server-1.0.3/` (unpacked from the release's `.mcpb`, a zip). Env `BLENDER_MCP_HOST`,
  `BLENDER_MCP_PORT`, `BLENDER_PATH` (for its `blender --background` tools) are set by `tools/mcp/blender.js`.

**Install on a machine:** Blender 5.2 LTS + `uv` (macOS `brew install uv`, Windows `winget install astral-sh.uv`),
then, **Blender closed**, `npm run blender-setup` (`tools/blender/setup.js`). Closed because an open Blender saves
its preferences when it quits and wipes the add-on's activation. `npm run doctor` checks Blender's version, uv and
the installed server. Installing the add-on by drag-and-drop in Blender only adds the "Blender Lab" *repository*
(`extensions/lab_blender_org/` holds just `.blender_ext/index.json`); the add-on itself is a second step: the setup
script does both through `blender --command extension install-file -r user_default -e`.

**Startup (measured on the Mac, 2026-11-06):** if the bridge isn't listening, `tools/mcp/blender.js` opens Blender
(default scene: Camera, Cube, Light) and waits for the port; the MCP handshake answers in ~5 s cold, ~0.5 s with
Blender already open. Blender stays open after the session. `get_screenshot_of_window_as_image` returns a PNG
(~660 KB on the Mac's Retina screen). A new server in `.mcp.json` only shows up in Claude Code after a reload.

**Quirks met (2026-11-06, "Blender: Connection closed" in Claude Code while the terminal test worked):**
- VS Code opened from the Dock doesn't get the shell's PATH: `spawn uv ENOENT` (Homebrew's `/opt/homebrew/bin`
  missing). `blender-config.js` `uvPath()` also looks in the usual uv folders (Homebrew, `~/.local/bin`, WinGet
  Links); `uvPath` in workspace.local.json wins.
- The Mac's Documents folder is synced by **iCloud Drive**, which flags `.venv` (and its files) `hidden` a moment after
  `uv sync`; Python 3.13+ skips hidden `.pth` files, so an editable install loses its package (`No module named
  'blmcp'`). The setup runs `uv sync --no-editable`. Check flags with `ls -lO`.
- Blender's **splash screen** stays over the viewport in window screenshots until someone clicks in Blender (it
  can be turned off in Preferences > Interface > Splash Screen, the owner's choice).
- `bpy.ops.wm.obj_import(forward_axis="NEGATIVE_Z", up_axis="Y")` (Roblox axes: Y up, front −Z) brings the mesh in
  with a 90° X rotation on the object (Blender is Z up): apply or keep it consistently before rigging, and export back
  with the same axes.
- Reproduce what Claude Code sees with a bare environment:
  `env -i HOME=$HOME PATH=/usr/bin:/bin:/usr/sbin:/sbin <node> tools/mcp/blender.js` (errors go to stderr).

**Tools the server exposes** (1.0.3): `execute_blender_code` (run Python, the main one), `get_objects_summary`,
`get_object_detail_summary`, `get_blendfile_summary_*` (datablocks, usage, missing files, libraries, paths),
`get_screenshot_of_window_as_image` / `_area_as_image` (images the agent can see), `render_viewport_to_path`,
`render_thumbnail_to_path`, `jump_to_*` (focus an object / tab), `search_api_docs`, `get_python_api_docs`,
`search_manual_docs` (offline Blender docs: use them before guessing a `bpy` API).

**Batch checklist (one species = a few calls; ROADMAP_V1.1 A5).** Paths from the repo root.
1. *Export* (Studio, Edit): `node tools/obj-receiver.js design/rigs/work` in the background; for each fish, run
   `tools/blender/studio/export_fish.luau` with its `FISH` line set (execute_luau takes the text: copy the file with
   the line changed); then `node tools/blender/rgba-to-png.js design/rigs/work/<Fish>_color.b64` (PNG + `<Fish>.json`
   with the tint) and `mv design/rigs/work/<Fish>.obj design/meshes/`. Stop the receiver after the batch.
2. *Rig + preview + GLB* (Blender MCP): `ns = {}; exec(open("<repo>/tools/blender/convert_fish.py").read(), ns);
   ns["convert"]("<repo>", "<Fish>")` (~7 s a fish on the Mac). Read its summary: `unweighted` must be 0,
   `max_influences` ≤ 4, `export.triangles` = the mesh's. Per-species settings in `design/rigs/<Fish>.json`
   (rig_fish.py DEFAULTS keys + `"speed"`), committed.
3. *Check* yourself: a contact sheet of a few frames (weights bleeding into the head, fins tearing, a thin part
   reading as a stick near the mouth: CLAUDE.md §7); the GLB's JSON (skin joints, POSITION min / max, Head node at +Z).
4. *Owner preview*: `node tools/blender/frames-to-gif.js design/previews/v1.1-batch<N>.gif design/rigs/work/<Fish>_frames
   ...` (one labelled tile per fish), linked in the reply. **Wait for the owner's go before any upload.**
5. *Upload* (Studio MCP, once per fish, never again for the same file): `open_cloud_invoke` POST `/assets/v1/assets`
   with body `{"request":{"assetType":"Model","displayName":"<Fish> Rig","description":"Project Quarium: <Fish> fish
   mesh with a swim skeleton (V1.1 animations).","creationContext":{"creator":{"groupId":"815548702"}}}}`, files
   `[{name: "fileContent", path: "<repo>/design/rigs/work/<Fish>.glb"}]`, scopes asset:read / asset:write; poll
   `GET /assets/v1/operations/<id>` until `done`; `moderationState` must be Approved (pending: wait, never re-upload).
6. *Swap* (Studio, Edit): `tools/blender/studio/swap_template.luau` with `FISH` and `MODEL` set; record the ids in
   `design/meshes/manifest.json` (`staticMeshId`, `rigModelId`, `rigMeshId`).
7. *Playtest*: the fish on bones (`Rig` attribute, a bone's Transform changing), no V1 rig on it, variants, growth.
8. *Ship*: a patch (RELEASE_NOTES, `GAME_VERSION`), PROJECT_CONTEXT's "Converted so far", the roadmap box; ask the
   owner to **save + publish** the place (the templates live in it).

Axes and tricks behind the steps: OBJ imported forward −Z / up Y, so in Blender **nose +Y, tail −Y, back +Z, right
+X**; after `read_homefile(use_empty=True)` operators need `bpy.context.temp_override(window=...)`. Preview colours:
"Standard" view transform (AgX dulls the gold), a backdrop that doesn't light the fish (Light Path "Is Camera Ray"),
the SurfaceAppearance tint multiplied over the texture. The GLB copies are turned 180° around Blender Z (Roblox's glTF
import turns meshes 180°), rest pose, no material / image / animation. The uploaded Model holds the skinned MeshPart
(Bones as its children), `InitialPoses` (CFrameValues) and an `AnimationController`. Driving a bone:
`bone.Transform = CFrame.fromAxisAngle(<bone-space axis>, angle)` (FishRigController's `boneAxis`); it shows in
Edit too. Permissions it relies on (Studio's Assistant Settings → MCP Permissions, per place, set on the Mac
2026-11-06): HTTP allow list `127.0.0.1:34999`, asset:read / asset:write, upload directory `design/rigs/work`.

**Testing a rig in Studio (2026-11-06).**
- `game:GetObjects(...)[1]`: take the MeshPart out (`Parent = nil`) **before** destroying the loaded Model, or its
  Parent gets locked.
- A test source parked far away in Workspace never reaches the client in a playtest (StreamingEnabled): move it to
  ReplicatedStorage from the Server datamodel.
- An agent-driven playtest runs with Studio unfocused: frames are capped at 15 fps (66.7 ms), so read our own script
  time (`os.clock` around the work) and `Stats.RenderCPUFrameTime` instead of the frame time; GPU time reads 0.
- A ViewportFrame shows bone deformations only inside a WorldModel.

**Rules.**
- Real work goes in versioned scripts in `tools/blender/` (rig, preview render, export) that the MCP runs or that run
  headless (`blender --background --python`); never code that exists only in a session (ROADMAP_V1.1 §2).
- The add-on's sandbox is "weak" by design (it only blocks quitting Blender and resetting the preferences): it runs
  any code with the user's rights. Only send code that touches Blender data and the project's work folders.
- Work files (exported / rigged meshes) go in `design/rigs/work/` (git-ignored); settings per species in
  `design/rigs/<FishType>.json`.
- Previews (renders) are shown to the owner from `design/previews/` (agent note previews-in-project), never
  uploaded; every final upload follows CLAUDE.md §7 and the ROADMAP_V1.1 §4 watch list.
