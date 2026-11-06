# ROADMAP — Project: Quarium V1.1 "Animations"

> The animation revamp: every fish, companion, event guest and NPC moves through a **skeleton made in Blender**
> instead of the EditableMesh deformation of V1. It starts **once V1 is complete** (the owner's calibration with real players done). Tick the
> boxes as tasks ship, and move what a step ships into `PROJECT_CONTEXT.md` / `RELEASE_NOTES.md` as usual.
> Last updated: 2026-11-06 (A1–A4 done; A5.1–A5.8: every species on bones, a new Pirate Fish, V1.1.5; next A5.9).

**V1.1 in one line**: Blender joins the toolchain (Windows and Mac) **as an MCP server**, like Roblox Studio and
FigCraft, so the agent drives it itself; a script rigs every model by itself, the game
animates bones instead of EditableMeshes: every species of every visible tank swims, on PC and on mobile, each fish
at its own rhythm, with behaviour animations (eat, turn, dash, rest...) and real animations for the companions.

---

## 1. Why (measured on 2026-11-01)

- V1 swims by **EditableMesh**: the client copies a species' mesh and moves its thousands of vertices ~30 times a
  second (FishAnimationController). Each copy uses a **client memory budget counted in triangles**: ~81,000 on the
  owner's PC (filled with 5 different meshes, it always stops between 75k and 81k triangles). Studio, plugins and the
  server have no budget; **a phone has its own, most likely smaller**.
- When the budget is full, `CreateEditableMeshAsync` **returns nil** (no error): the species glides frozen, retried
  every 10 s ("Fish animation paused ... attempt to index nil with 'GetVertices'").
- The cap counts species, not their weight: 6 species x 2 copies. The 6 heaviest species (Husky Dogfish 8,364
  triangles, Bunny Shark 8,282, Flame Gourami 6,950, Imperial Discus 6,346, Red Tetra 5,776, Clownfish 5,744) need
  ~83k on their own, more than the whole budget; the Swordfish (+7.3k) and the K-pop idol (+11.9k) come on top, and a
  rig stays held 15 s after leaving the view (lobby → tank: up to 12 species at once).
- **A skinned mesh (bones) uses no Editable budget**: the GPU deforms it, the game only turns ~7 bones per fish.
  It is the standard Roblox way (avatars), and each fish gets its own phase (V1 shares 2 copies per species).

---

## 2. Principles

- **V1 first.** Nothing here starts before the V1 calibration with real players is done.
- **Both systems live side by side** until the end: a template says which one it uses (attribute `Rig = "Bones"`),
  the EditableMesh path stays the fallback of the species not converted yet. Species are converted in batches, each
  batch playable on its own.
- **The agent drives Blender through MCP** (`.mcp.json`, started by `node tools/mcp/blender.js` like the other two
  servers): it imports the meshes, runs the rig scripts, checks the bones and weights, renders previews and exports,
  without the owner touching Blender. The owner only looks at the previews.
- **Automate, don't hand-rig.** One Blender script rigs every fish from its shape (the same position rules as V1's
  weights: tail, dorsal, pectorals, mouth), so a new species costs one command, not an evening in Blender. The
  scripts are versioned files in `tools/blender/` that the MCP runs (never code typed only in a session), so a batch
  can be replayed on the other machine, or headless (`--background`) when no Blender window is open.
- **Same looks.** The UVs survive the round trip, so the uploaded textures, SurfaceAppearances and variant looks
  (Anomaly / Ghost / Shiny) are reused as they are: no texture is uploaded again.
- **Moderation first** (CLAUDE.md §7): each re-imported model is a new upload under the owner's account. Same shapes
  as the approved ones, previewed locally (Blender renders), uploaded once, never test batches. One species (the
  Golden Guppy) goes through the whole pipeline before any batch.
- **Portable** (CLAUDE.md §0e): Blender's path in `workspace.local.json`, scripts in cross-platform Node + Blender
  Python, documented in SETUP.md for Windows and macOS, checked by `npm run doctor`.
- **Performance gate**: every step ends with a measure (client ms, PC and mobile emulator), compared to V1's numbers
  (PROJECT_CONTEXT §4 load test).

---

## 3. Steps

Sizes: S = a session, M = a few sessions, L = a big chunk. Owner actions are marked **Owner**.

### A0 — Before V1.1 (decision, during V1 M7)

- [x] **V1 stopgap** (decided by the owner, shipped in V0.45): an animation budget counted in triangles that lowers
      itself when the device refuses a mesh, rigs built one at a time, idle rigs freed at once when another species
      needs the room, a whole-body sway for the visible fish without a rig (no fish ever frozen), and the EditableMesh
      destroyed when the MeshPart creation fails (small leak). The sway and the budget code go away in A8.
- [x] The M7 load test with 18 species records the V1 numbers (V0.46, PROJECT_CONTEXT §4): they are the "before" of
      this roadmap (aisle view 6.9 ms scripts / 11.0 ms render, 6 species animated, the rest swaying).

### A1 — Blender in the project, as an MCP server (S–M)

- [ ] **Owner**: install Blender (pinned LTS version, same on both machines) on the Windows PC and the Mac. Pinned:
      **5.2 LTS**; Mac done (5.2.3, 2026-11-06), Windows PC to do.
- [x] `workspace.local.json` key `blenderPath` (Windows `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`,
      macOS `/Applications/Blender.app/Contents/MacOS/Blender`), documented in `workspace.local.example.json` and
      SETUP.md (both OS); `tools/check-setup.js` checks it and the version.
- [x] **Choose the Blender MCP server** (2026-11-06: the official **Blender Lab MCP 1.0.3**, Blender 5.1+, add-on
      bridge + Python server run by `uv`; its code reviewed: local only, no asset features; agent note blender-pipeline), in this order: (1) an official Blender MCP if the Blender Foundation ships
      one (to verify on blender.org: only a reseller page claims it); (2) the community `ahujasid/blender-mcp` (a
      Blender add-on opening a local socket + a Python MCP server run by `uvx`: adds Python / `uv` as prerequisites);
      (3) our own minimal one (a small add-on in `tools/blender/addon/` + a Node MCP server: run a versioned script,
      scene / object info, viewport screenshot, render a preview, import / export). Criteria: works on Windows and
      macOS, runs our versioned scripts, returns images the agent can look at, nothing else exposed.
- [x] **Turn off every third-party asset feature** of the chosen server (the official one has none) (Poly Haven, Sketchfab, Hyper3D / AI
      generation...): no outside asset ever enters a model we upload (licences, CLAUDE.md §7). Local only
      (127.0.0.1).
- [x] `tools/mcp/blender.js` (cross-platform Node, the FigCraft launcher's pattern): starts Blender with the add-on's
      server if its port isn't listening (`blenderPath`, port in `workspace.local.json` key `blenderMcpPort`), waits
      for it, then runs the MCP server on stdio; the `Blender` entry in `.mcp.json`. The add-on is installed and
      enabled by a script, not by hand.
- [ ] `tools/blender/`: the versioned Python scripts (rig, preview render, export) that the MCP runs, and a headless
      runner (`npm run blender -- <script> <args>`, `--background --python`) for batches without a window.
- [x] `.gitignore`: the work folder of exported / rigged meshes (`design/rigs/work/`); only the scripts, the
      settings per species and the final small files are committed.
- [ ] Check (Mac done 2026-11-06: from a Claude Code session, Blender opened by the launcher, a test OBJ imported
      with Blender's OBJ importer, window screenshot seen; the Windows PC to do): from a fresh session, the agent opens Blender through the MCP, imports a test mesh, takes a screenshot,
      on both machines. `npm run doctor` checks Blender, the add-on and the MCP prerequisites.
- [x] Agent note `docs/agent-notes/blender-pipeline.md` (MCP tools, quirks, the batch checklist) + its index line.

### A2 — Proof of concept: the Golden Guppy end to end (M, go / no-go)

The whole pipeline on one fish, to settle the open questions (§5) before converting anything else.

- [x] **Export from Studio** (2026-11-06: `design/meshes/GoldenGuppy.obj`, 1,586 vertices / 2,484 triangles, + its texture
      pulled at 512 into `design/rigs/work/`; Studio's MCP HTTP allowlist must hold 127.0.0.1:34999): read the template's mesh with an EditableMesh in Edit (positions, normals, UVs,
      faces; no budget in Edit) and POST it to a scratchpad Node server (same pattern as the texture pull,
      HttpEnabled on only during the call), written as `.obj` / `.glb` in the work folder. Texture pulled at 512 for
      the Blender preview only.
- [x] **Auto-rig** (`tools/blender/rig_fish.py`; Golden Guppy 2026-11-06: 10 bones, every vertex weighted, ≤ 3
      influences): armature along the fish's Z (head toward −Z): a spine chain of 4–6
      bones (root → tail tip), 2 pectoral bones, 1 dorsal, 1 jaw; weights from the vertex positions (V1's rules),
      smoothed, max 4 influences per vertex. Settings per species in `design/rigs/<FishType>.json` (bone count,
      fin zones), defaults for an ordinary fish.
- [x] **Preview** (`tools/blender/preview_swim.py` + `frames-to-gif.js`; Golden Guppy approved by the owner on
      2026-11-06, `design/previews/golden-guppy-bones-swim.gif`): through the MCP, Blender renders a short swim loop as PNGs (local, never uploaded); the agent
      checks them (weights bleeding into the head, fins tearing) before the owner sees them.
- [x] **Import into Roblox** (2026-11-06, no owner click: `tools/blender/export_fish.py` → GLB without material /
      image, uploaded as the group by the Studio MCP's `open_cloud_invoke` → Model **93278084123107**, moderation
      Approved at once; the MeshPart arrives `HasSkinnedMesh`, same MeshSize, the 10 Bones under it, nose at −Z; resized
      to the template's Size the bones follow; the template's SurfaceAppearance applies unchanged): FBX or glTF through the Studio 3D Importer (**Owner**, a few clicks), or through Open
      Cloud (see A3); the new MeshPart keeps its Bones. Check: size, orientation (head −Z), UVs (the existing
      SurfaceAppearance and the 3 variant looks apply unchanged).
- [ ] **Drive it**: (a) procedural, Luau sets `Bone.Transform` (V1's sine wave, per-fish phase); (b) an animation
      clip made in Blender, played by an `Animator`. Measure both (client ms for 30 / 180 Guppies, PC and mobile
      emulator) and pick the base mode (expected: procedural swim + clips for the special moves).
- [ ] Check in the places that show fish: tank (2.5D view), lobby, the hatch reveal and the Fish Index (ViewportFrame:
      does it render the bones? a WorldModel may be needed), beat puffs (K-pop), weak tint, growth stages.
- [x] **Go / no-go** (2026-11-06, Golden Guppy): **GO**.
      - Owner time per species: none at the mesh level (export, rig, preview, export, upload and test all run by the
        agent); the owner only judges the preview GIF and the result in the game.
      - Upload route: Open Cloud through the Studio MCP (`open_cloud_invoke`), GLB without material, as the group;
        moderation Approved at once. No Studio 3D Importer clicks. (A3 is mostly settled.)
      - Drive mode: **procedural** `Bone.Transform` from Luau (0.32 ms Edit / 1.02 ms playtest for 180 fish × 10 bones,
        root CFrame included); Animator clips kept for later special moves if ever needed.
      - Rendering: no visible render-CPU cost for 180 rigged fish on the Mac, no jitter; GPU and phone to measure in A4
        with real players' devices (an agent-driven playtest can't read them).
      - Kept as is: the template's SurfaceAppearance (and the variant looks), its Size (the bones follow).

### A3 — Upload route (S) — done 2026-11-06

- [x] Route: **Open Cloud through the Studio MCP** (`open_cloud_invoke`, which authenticates by itself: no API key,
      no `tools/blender/upload.js`), GLB as the group, then the template swap by MCP. No Studio 3D Importer clicks.
      Needs the MCP Permissions set once per place (agent note blender-pipeline).
- [x] The species recipe (`docs/agent-notes/content-recipes.md`) has its rig step (8); the batch checklist is in the
      agent note blender-pipeline, built on versioned tools: `tools/blender/studio/export_fish.luau` (mesh + 512
      texture + tint in one call), `tools/blender/convert_fish.py` (import → rig → swim → frames → GLB, ~7 s a fish),
      `frames-to-gif.js` (a labelled sheet: one approval per batch), `tools/blender/studio/swap_template.luau`.
      Checked on the Golden Guppy (same GLB, byte for byte in size) and the Blue Neon's export.

### A4 — The runtime: bones in the game (M)

- [x] `FishRigController` (client, registered in main.client.ts; V1.1.0): finds the bones of a fish built by
      FishRenderController, animates them (swim wave, fins, mouth) with a per-fish phase and speed; reads the same
      states as today (Hunger Weak / Dead → lazy swim, swim speed from the server's segments).
- [x] **LOD without a budget** (every frame ≤ 60 studs, every 2nd ≤ 110, every 4th beyond, frozen off screen; the
      6 tanks × 25 fish view still to measure once more species are converted): full rate for the watched tank, lower rate far away, frozen off screen; no species
      cap anymore. Measure the 6 tanks x 25 fish view.
- [x] Templates: `Assets.Fish.<Type>` with a skinned `Mesh` and attribute `Rig = "Bones"` (GoldenGuppy 2026-11-06); FishAnimationController
      skips them, the others keep the EditableMesh path. `server/fishAssets` replication unchanged.
- [x] Beat puff, weak tint, variant SurfaceAppearance swap, growth (ScaleTo scales the bones; the puff's Size
      change leaves them, checked visually: fine for a short puff): unchanged or adapted (a puff can become a bone
      scale).
- [x] Ship the Golden Guppy alone in a patch (first release of the system): **V1.1.0**, published by the owner and
      checked on a phone (2026-11-06: "impeccable, même sur le tel").

### A5 — Convert every species (L, in batches)

Versions: one sub-patch per ship, **V1.1.1, V1.1.2, V1.1.3...** (owner, 2026-11-06). Order of the aquariums. Each
sub-step fits one session and ends on something the owner looks at: a **prep** ends on
the batch's GIF sheet (nothing uploaded), a **ship** uploads the approved batch, swaps the templates, playtests and
opens a patch (the owner then saves + publishes the place). Each species follows the batch checklist of the agent note
blender-pipeline.

- [x] **A5.1 — Batch 1 prep** (Basic and Lagoon, 2026-11-06): Blue Neon, Zebra Danio, Red Tetra, Clownfish, Flame
      Gourami, rigged with the defaults (0 unweighted vertex, ≤ 4 influences), sheet `design/previews/v1.1-batch1.gif`
      approved by the owner. The heavy ones ship as they are (owner). Lighter copy test: the Flame Gourami at 3,999
      triangles (Decimate Collapse, delimit UV / seam / sharp) looks the same, approved by the owner as a spare for
      later (`design/previews/flame-gourami-light-compare.png`); nothing light is uploaded.
- [x] **A5.2 — Batch 1 ship** (2026-11-06): 5 uploads as the group, all Approved at once; 5 swaps
      (`swap_template.luau` now takes a batch); playtest: the 5 on bones, none on V1; **V1.1.1**.
- [x] **A5.3 — Batch 2 prep** (2026-11-06): sheet `design/previews/v1.1-batch2.gif`, approved except the Pirate Fish;
      new rig options: `fin_top` false + `rigid_top` for the French Fish's beret, `jaw` false for the Catfish's
      whiskers (design/rigs/<Fish>.json; checked at 3× the bend, no tearing).
- [x] **A5.4 — Batch 2 ship** (2026-11-06): Silver Angelfish, Imperial Discus, French Fish, Catfish (4 uploads, all
      Approved), swapped and playtested; **V1.1.2**.
- [x] **A5.4b — A new Pirate Fish** (2026-11-06, **V1.1.3**): owner picked candidate A of 3 (same details, a real
      fish body instead of a ball); 5.4 studs long; rig `design/rigs/PirateFish.json` (fin_top false, the tricorn rigid);
      Anomaly / Shiny recoloured with the old hues; 4 stickers; uploads: 6 images (owner's account) + the rig (group),
      all after the owner's look. Old assets the owner may archive: ball meshes 111915158254959 / 78117520516696,
      texture 76837327495535, variants 106089869843984 / 75123395235665, stickers 140042928133697 / 110288096561899 /
      134728004078355 / 107412512620557; dropped candidates B 139716735464675 and C 88927581992980.
- [x] **A5.5 — Batch 3 prep + ship** (2026-11-06, **V1.1.4**): Blue Tang, Baby Sunfish, Lanternfish (the species
      Lanternfish has no lure), rigged with the defaults, sheet `design/previews/v1.1-batch3.gif` approved, 3 uploads
      Approved, swapped and playtested.
- [x] **A5.6 — Rig extensions** (2026-11-06, code only): `rig_fish.py` takes any number of `joints` (bones Head,
      Spine1..n, Tail1, Tail2: the Dragonfish gets 6 joints / 7 spine bones) and per-species `extras` (bone boxes: the
      Bunny Shark's EarL / EarR); FishRigController and preview_swim.py share a spine curve by the bone's t (V1's
      4 / 6 / 9 / 12° at the default joints, shared out over the chain) and let `Ear*` bones flop and trail the turns.
      The default rig is unchanged (the Golden Guppy's GLB regenerated byte for byte). The Mini Leviathan is rigged in
      its own unpitched space like V1 deformed it (its template keeps the -30° pitch): no bake needed.
      Checked at 3× the bend with the batch 4 meshes (exported for A5.7).
- [x] **A5.7 — Batch 4 prep** (2026-11-06): the 5 rigged (Dragonfish 7-bone spine, Bunny Shark ears, the others
      default), sheet `design/previews/v1.1-batch4.gif` approved.
- [x] **A5.8 — Batch 4 ship** (2026-11-06, **V1.1.5**): 5 uploads Approved, swapped (the Mini Leviathan keeps its
      -30° template pitch), playtested (the Bunny Shark's ears trail its turns). Roblox's import drops a bone that no
      vertex follows (the Dragonfish's FinBottom: 11 bones in Roblox, 12 in Blender): harmless.
- [x] **A5.9 — Special and event fish** (prep 2026-11-06: FishRigController also tracks `EventFish`; the Studio
      snippets look in `Assets.EventFish` too and take "Template:FileName" (the abyss `LanternFish` vs the species
      `Lanternfish` on a case-blind disk: files `AbyssLantern`); new rig option `rigid_boxes` (the lantern's stalk under
      its welded lit ball); Sugar, AlienFish, AbyssLantern rigged, sheet `design/previews/v1.1-special-fish.gif`, the
      owner's go pending. **The K-pop idol is grey in the live game**: its template has no texture (it was a TextureID,
      wiped by ApplyMesh in the V0.60.5 group swap, which keeps a SurfaceAppearance only): owner's decision pending.
      The UFO and the SaxCrab stay off the fish rig (not fish; the UFO is decided in A8))
      Shipped 2026-11-06 in **V1.1.6**: Sugar, AlienFish, LanternFish (3 uploads Approved, swapped; a server-built,
      server-moved villain swims on bones on the client, its Lure 3.29 studs from the body at every frame). Left: the
      K-pop idol (texture first, then rig + its beat dance): moved to `ROADMAP_FIXES.md` (its original texture is on the
      Windows PC); A5 is done otherwise.: Sugar, the Alien Fish (UFO night), the Abyss Lanternfish villain and the
      K-pop idol (its dance: bone moves on the beat). FishRigController then also tracks `EventFish`. **V1.1.6**.

### A6 — Behaviour animations (M)

Owner, 2026-11-06: all of them, in two patches: the continuous ones (turn, sprint, rest, weak: **V1.1.7**, preview
`design/previews/v1.1-behaviours-1.gif`, from the fish's real speed against its species' wandering speed) then the
moments (bite, joy when fed, growth flourish, release flick, caught by the abyss lantern). The fish in its card waits
(the reveal and the Index show stickers) and so does the idol's dance (its texture, ROADMAP_FIXES.md).

Procedural layers on top of the swim, or clips made in Blender (A2 decides which). A first list, to review with the
owner before building:

- [x] Turn: the body bends into the curve when the fish changes direction (V1.1.7).
- [x] Dash: faster beats and a body snap when it chases a pellet (faster, wider beats: V1.1.7); a mouth snap when it
      eats (V1.1.8: the bite, at the meal).
- [x] Hungry / weak: slow beats, drooping fins (V1's lazy swim, richer) (V1.1.7: drooping pectorals, sagging tail).
- [x] Rest: hovering with soft fin paddling when it waits between two wander steps (V1.1.7).
- [x] Happy wiggle when fed, a little flourish when a fish grows a stage (V1.1.8).
- [x] Released: a strong tail flick as it darts up to the surface; eaten by the Abyss villain: a struggle (V1.1.8;
      the UFO's abduction and a cannibal's bite too).
- [ ] Hatch reveal and Fish Index: the fish swims in its card (if the ViewportFrame renders bones, A2). Not now: both
      show stickers; a WorldModel would be needed (A2).

> **Fix 2026-11-07 (V1.1.10)**: the swaps of V1.1.1 to V1.1.9 set the templates' `Size` without moving their bones,
> so every bone fish but the Golden Guppy looked crumpled (seen by the owner). All 23 skinned templates fitted
> (`fitBones`, now in `swap_template.luau`), checked in a playtest.

### A7 — Companions (M)

Each one gets a rig made by its own Blender script (not the fish one) and replaces its V1 wobble
(CompanionAnimationController) or tween-only move.

- [x] Swordfish: the fish rig (it swims like a fish today) (**V1.1.9**: no jaw for its bill; its cruise speed
      `SWORDFISH_CRUISE_SPEED` shared so FishRigController reads its pace; checked on the owner's equipped Swordfish).
- [x] Snail: the body stretches and contracts as it crawls, eye stalks sway (**V1.1.12**: tools/blender/rig_snail.py,
      6 bones; its TextureID carried by the snippets; the stalks' tilt on its own phase after the owner saw a jump).
- [ ] Pelican: wings fold / open, beak scoop when it drops food.
- [ ] Water Hen: feet paddle under the water, head nods, wings ruffle.
- [x] Jellyfish: the bell pulses through bones (not by scaling the whole mesh), the tentacles wave as a chain
      (**V1.1.11**: tools/blender/rig_jellyfish.py, 17 bones; the rim pivots near the dome's top, a first try with a
      low pivot dented the bell).
- [ ] The fisherman of the shop huts: idle breathing, head turn toward the player, a wave as they arrive (Studio's
      avatar auto-setup can be tried first: he is a humanoid shape).

### A8 — Finish (M)

- [ ] Remove the EditableMesh path once every template has `Rig = "Bones"` (or keep it only for a template without a
      rig, warned in the output); remove `MAX_ANIMATED_SPECIES` and the rig budget code.
- [ ] Load test with 18 species, 6 tanks x 25 fish, PC and mobile emulator: compare with A0's "before" numbers, and
      write the results in PROJECT_CONTEXT §4.
- [ ] Docs: PROJECT_CONTEXT (controllers, templates, tools/blender, the known limits), SETUP.md, the agent note,
      the species / companion recipes of `docs/agent-notes/content-recipes.md` with the rig step; release notes of the V1.1 version.
- [ ] **Owner**: archive the old fish meshes on the Creator Dashboard once nothing uses them (optional).

---

## 4. Moderation watch list (CLAUDE.md §7)

| Item | Risk | Rule |
|---|---|---|
| Every re-imported model | A new upload under the owner's account | Same approved shape and UVs; Blender preview first; uploaded once, the final file only |
| Decimated meshes | A simplified shape can change how it reads (a fin turning into a spike, a stick-like tail) | Owner compares before / after renders; nothing thin out of the mouth |
| Mouth and jaw animation | An open mouth with something near it | Only the lips move; nothing is ever held in a mouth |
| Swordfish, Lionfish | A bill or fins posed as a weapon / spines | No thrust pose; fins stay soft and rounded in every frame |
| Fisherman's wave | A raised arm holding something | Empty hands; a slow friendly wave |

---

## 5. Open questions (answered by A2)

- Studio 3D Importer vs Open Cloud for skinned models: can the whole route run without the owner's clicks? (Lead:
  the Studio MCP now has `open_cloud_invoke`, which uploads FBX / glTF through Open Cloud, and its `rbx-import-asset`
  skill; it needs `asset:read` / `asset:write` and an approved upload folder in MCP Permissions.)
- Does a ViewportFrame (reveal, Fish Index) render skinned deformations, with or without a WorldModel? (Answered
  2026-11-06: only inside a **WorldModel**; without one the fish stays straight. Today's reveal and Index show sticker
  images, so nothing depends on it; only A6's "fish swims in its card" would need a WorldModel.)
- Procedural `Bone.Transform` cost for ~180 fish x ~10 bones in Luau, vs Animator clips run by the engine. (Measured
  2026-11-06, Edit on the Mac: setting 10 `Bone.Transform` on 180 Guppies takes **0.32 ms** a frame, against V1's 6.9 ms of
  scripts: the procedural swim is the expected base mode; render cost still to measure in a playtest.)
- Bone animation on fish whose root is anchored and moved by CFrame every frame (FishRenderController): any jitter?
  (Playtest 2026-11-06, Mac: 180 rigged Guppies, root CFrame + 10 bones set every RenderStepped: our script 1.02 ms a
  frame; render CPU 4.8–6.5 ms with them vs 5.8 ms without, inside the noise; Studio unfocused caps the frame at
  15 fps, so frame time can't be read from an agent-driven playtest. Jitter: none, seen by the owner.)
- glTF or FBX out of Blender: which one keeps the UVs and the bone weights through the Roblox importer. (The UVs
  survive the Studio → OBJ → Blender leg: the Guppy shows its texture unchanged.)
- Blender version pinned on both machines; headless rendering on the Mac (Metal) and the PC.
- (A1) Which Blender MCP server: official, community or ours; how big are the meshes and images it can pass back.
