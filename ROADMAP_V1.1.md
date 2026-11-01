# ROADMAP — Projet Quarium V1.1 "Animations"

> The animation revamp: every fish, companion, event guest and NPC moves through a **skeleton made in Blender**
> instead of the EditableMesh deformation of V1. It starts **once V1 is complete** (`ROADMAP.md`, M7 ticked). Tick the
> boxes as tasks ship, and move what a step ships into `PROJECT_CONTEXT.md` / `RELEASE_NOTES.md` as usual.
> Last updated: 2026-11-01 (A0 stopgap shipped in V0.45; Blender driven by the agent through an MCP server, A1; first version, decided by the
> owner: V1 first, then this whole roadmap).

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

- **V1 first.** Nothing here starts before `ROADMAP.md` M7 is done.
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
- [ ] The M7 load test with 18 species records the V1 numbers (client ms, frozen species, PC and mobile emulator):
      they are the "before" of this roadmap.

### A1 — Blender in the project, as an MCP server (S–M)

- [ ] **Owner**: install Blender (pinned LTS version, same on both machines) on the Windows PC and the Mac.
- [ ] `workspace.local.json` key `blenderPath` (Windows `C:/Program Files/Blender Foundation/Blender 4.x/blender.exe`,
      macOS `/Applications/Blender.app/Contents/MacOS/Blender`), documented in `workspace.local.example.json` and
      SETUP.md (both OS); `tools/check-setup.js` checks it and the version.
- [ ] **Choose the Blender MCP server**, in this order: (1) an official Blender MCP if the Blender Foundation ships
      one (to verify on blender.org: only a reseller page claims it); (2) the community `ahujasid/blender-mcp` (a
      Blender add-on opening a local socket + a Python MCP server run by `uvx`: adds Python / `uv` as prerequisites);
      (3) our own minimal one (a small add-on in `tools/blender/addon/` + a Node MCP server: run a versioned script,
      scene / object info, viewport screenshot, render a preview, import / export). Criteria: works on Windows and
      macOS, runs our versioned scripts, returns images the agent can look at, nothing else exposed.
- [ ] **Turn off every third-party asset feature** of the chosen server (Poly Haven, Sketchfab, Hyper3D / AI
      generation...): no outside asset ever enters a model we upload (licences, CLAUDE.md §7). Local only
      (127.0.0.1).
- [ ] `tools/mcp/blender.js` (cross-platform Node, the FigCraft launcher's pattern): starts Blender with the add-on's
      server if its port isn't listening (`blenderPath`, port in `workspace.local.json` key `blenderMcpPort`), waits
      for it, then runs the MCP server on stdio; the `Blender` entry in `.mcp.json`. The add-on is installed and
      enabled by a script, not by hand.
- [ ] `tools/blender/`: the versioned Python scripts (rig, preview render, export) that the MCP runs, and a headless
      runner (`npm run blender -- <script> <args>`, `--background --python`) for batches without a window.
- [ ] `.gitignore`: the work folder of exported / rigged meshes (`design/rigs/work/`); only the scripts, the
      settings per species and the final small files are committed.
- [ ] Check: from a fresh session, the agent opens Blender through the MCP, imports a test mesh, takes a screenshot,
      on both machines. `npm run doctor` checks Blender, the add-on and the MCP prerequisites.
- [ ] Agent note `docs/agent-notes/blender-pipeline.md` (MCP tools, quirks, the batch checklist) + its index line.

### A2 — Proof of concept: the Golden Guppy end to end (M, go / no-go)

The whole pipeline on one fish, to settle the open questions (§5) before converting anything else.

- [ ] **Export from Studio**: read the template's mesh with an EditableMesh in Edit (positions, normals, UVs,
      faces; no budget in Edit) and POST it to a scratchpad Node server (same pattern as the texture pull,
      HttpEnabled on only during the call), written as `.obj` / `.glb` in the work folder. Texture pulled at 512 for
      the Blender preview only.
- [ ] **Auto-rig** (`tools/blender/rig_fish.py`): armature along the fish's Z (head toward −Z): a spine chain of 4–6
      bones (root → tail tip), 2 pectoral bones, 1 dorsal, 1 jaw; weights from the vertex positions (V1's rules),
      smoothed, max 4 influences per vertex. Settings per species in `design/rigs/<FishType>.json` (bone count,
      fin zones), defaults for an ordinary fish.
- [ ] **Preview**: through the MCP, Blender renders a short swim loop as PNGs (local, never uploaded); the agent
      checks them (weights bleeding into the head, fins tearing) before the owner sees them.
- [ ] **Import into Roblox**: FBX or glTF through the Studio 3D Importer (**Owner**, a few clicks), or through Open
      Cloud (see A3); the new MeshPart keeps its Bones. Check: size, orientation (head −Z), UVs (the existing
      SurfaceAppearance and the 3 variant looks apply unchanged).
- [ ] **Drive it**: (a) procedural, Luau sets `Bone.Transform` (V1's sine wave, per-fish phase); (b) an animation
      clip made in Blender, played by an `Animator`. Measure both (client ms for 30 / 180 Guppies, PC and mobile
      emulator) and pick the base mode (expected: procedural swim + clips for the special moves).
- [ ] Check in the places that show fish: tank (2.5D view), lobby, the hatch reveal and the Fish Index (ViewportFrame:
      does it render the bones? a WorldModel may be needed), beat puffs (K-pop), weak tint, growth stages.
- [ ] **Go / no-go** written here: owner time per species, upload route, drive mode, numbers. A "no-go" falls back to
      the V1 stopgap of A0 plus lighter meshes.

### A3 — Upload route (S)

- [ ] Choose between the Studio 3D Importer (**Owner** imports each model by hand, a checklist per batch) and
      **Open Cloud** (`tools/blender/upload.js`: Assets API, the model uploaded from the command line; then inserted
      into ServerStorage by MCP). Open Cloud needs an **Owner**-created API key, stored only in
      `workspace.local.json` (key `robloxOpenCloudKey`, never committed; documented in the template and SETUP.md).
- [ ] The species recipe (`ROADMAP.md` §3.1) gets its rig step; a one-page checklist per batch in the agent note.

### A4 — The runtime: bones in the game (M)

- [ ] `FishRigController` (client, registered in main.client.ts): finds the bones of a fish built by
      FishRenderController, animates them (swim wave, fins, mouth) with a per-fish phase and speed; reads the same
      states as today (Hunger Weak / Dead → lazy swim, swim speed from the server's segments).
- [ ] **LOD without a budget**: full rate for the watched tank, lower rate far away, frozen off screen; no species
      cap anymore. Measure the 6 tanks x 25 fish view.
- [ ] Templates: `Assets.Fish.<Type>` with a skinned `Mesh` and attribute `Rig = "Bones"`; FishAnimationController
      skips them, the others keep the EditableMesh path. `server/fishAssets` replication unchanged.
- [ ] Beat puff, weak tint, variant SurfaceAppearance swap, growth: unchanged or adapted (a puff can become a bone
      scale).
- [ ] Ship the Golden Guppy alone in a patch (first release of the system).

### A5 — Convert every species (L, in batches)

Order of the aquariums, so each batch is a coherent patch. Each species: export → rig → preview (owner) → upload →
template → playtest (hatch it, swim, weak, variants, reveal, index).

- [ ] Batch 1, Basic and Lagoon: Golden Guppy (A2), Blue Neon, Red Tetra, Clownfish, Zebra Danio, Flame Gourami.
- [ ] Batch 2, Neon Coral and Pirate Wreck: Silver Angelfish, Imperial Discus, Pirate Fish, French Fish, Catfish.
- [ ] Batch 3, Atlantis and Mariana Trench: Blue Tang, Baby Sunfish, Lanternfish.
- [ ] Batch 4, Volcanic Temple to Cosmic Sanctuary: Lionfish, Dragonfish (long body: more spine bones), Husky
      Dogfish, Bunny Shark (the ears: their own bones, a soft follow), Mini Leviathan (serpent: 8+ spine bones, the
      30° pitch of its template baked in Blender).
- [ ] **Lighter meshes on the way**: the heavy ones (Husky Dogfish, Bunny Shark, Flame Gourami, Imperial Discus, Red
      Tetra, Clownfish) decimated in Blender to ≤ ~4k triangles, UVs kept; the owner compares before / after renders.
- [ ] Event fish: the Abyss Lanternfish villain and the K-pop idol (the idol's dance becomes bone moves on the beat).

### A6 — Behaviour animations (M)

Procedural layers on top of the swim, or clips made in Blender (A2 decides which). A first list, to review with the
owner before building:

- [ ] Turn: the body bends into the curve when the fish changes direction.
- [ ] Dash: faster beats and a body snap when it chases a pellet; a mouth snap when it eats.
- [ ] Hungry / weak: slow beats, drooping fins (V1's lazy swim, richer).
- [ ] Rest: hovering with soft fin paddling when it waits between two wander steps.
- [ ] Happy wiggle when fed, a little flourish when a fish grows a stage.
- [ ] Released: a strong tail flick as it darts up to the surface; eaten by the Abyss villain: a struggle.
- [ ] Hatch reveal and Fish Index: the fish swims in its card (if the ViewportFrame renders bones, A2).

### A7 — Companions (M)

Each one gets a rig made by its own Blender script (not the fish one) and replaces its V1 wobble
(CompanionAnimationController) or tween-only move.

- [ ] Swordfish: the fish rig (it swims like a fish today).
- [ ] Snail: the body stretches and contracts as it crawls, eye stalks sway.
- [ ] Pelican: wings fold / open, beak scoop when it drops food.
- [ ] Water Hen: feet paddle under the water, head nods, wings ruffle.
- [ ] Jellyfish: the bell pulses through bones (not by scaling the whole mesh), the tentacles wave as a chain.
- [ ] The fisherman of the shop huts: idle breathing, head turn toward the player, a wave as they arrive (Studio's
      avatar auto-setup can be tried first: he is a humanoid shape).

### A8 — Finish (M)

- [ ] Remove the EditableMesh path once every template has `Rig = "Bones"` (or keep it only for a template without a
      rig, warned in the output); remove `MAX_ANIMATED_SPECIES` and the rig budget code.
- [ ] Load test with 18 species, 6 tanks x 25 fish, PC and mobile emulator: compare with A0's "before" numbers, and
      write the results in PROJECT_CONTEXT §4.
- [ ] Docs: PROJECT_CONTEXT (controllers, templates, tools/blender, the known limits), SETUP.md, the agent note,
      `ROADMAP.md` §3.1 / §3.3 recipes with the rig step; release notes of the V1.1 version.
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

- Studio 3D Importer vs Open Cloud for skinned models: can the whole route run without the owner's clicks?
- Does a ViewportFrame (reveal, Fish Index) render skinned deformations, with or without a WorldModel?
- Procedural `Bone.Transform` cost for ~180 fish x ~10 bones in Luau, vs Animator clips run by the engine.
- Bone animation on fish whose root is anchored and moved by CFrame every frame (FishRenderController): any jitter?
- glTF or FBX out of Blender: which one keeps the UVs and the bone weights through the Roblox importer.
- Blender version pinned on both machines; headless rendering on the Mac (Metal) and the PC.
- (A1) Which Blender MCP server: official, community or ours; how big are the meshes and images it can pass back.
