# ROADMAP — Small fixes to plan

> Small fixes and polish noted along the way. Each one ships in the next patch that has room for it; tick it and move
> what it ships into `PROJECT_CONTEXT.md` / `RELEASE_NOTES.md` as usual.
> Last updated: 2026-11-07 (the V1.1 animation roadmap closed: its leftovers moved here).

- [ ] **The K-pop idol is grey, and has no bones yet** (found 2026-11-06, during the V1.1 animation revamp). `ServerStorage.Assets.EventFish.KpopIdol.Mesh`
      has no texture: its look was a `TextureID`, which `ApplyMesh` cleared in V0.60.5's group mesh swap (a
      SurfaceAppearance survives it). The original is on the **Windows PC** (the owner, 2026-11-06): read the idol's
      TextureID there (an older local copy of the place, or a place version from before 2026-11-03 opened in Studio),
      put it back on the template as a **SurfaceAppearance ColorMap** (no new upload), check it with a capture, ask the
      owner to save + publish. Then the idol joins the bone rig (the batch checklist of the agent note
      blender-pipeline, template in `Assets.EventFish`): until then it glides without wiggling and only puffs on the
      beat (FishAnimationController). A dance of its own (bones on the beat) can come with it.
- [ ] **Hide the hunger and AFK badges of the other aquariums** (owner, 2026-11-06). FishIndicatorController puts a
      badge over every fish it sees (Hungry / Weak 🍽️, Paused "AFK"), so everyone sees the state of the other players'
      fish. Show them only over the fish of the local player's own tank (the aquarium's `OwnerUserId` attribute, or
      `FocusController.getOwnAquarium()`); the fish of other tanks get none. Check in the lobby next to an other
      player's tank (a second Studio test player) and in the 2.5D view.
- [ ] **Blender on the Windows PC** (from the V1.1 roadmap, A1). **Owner**: install Blender 5.2 LTS, then with Blender
      closed `npm run blender-setup` and `npm run doctor` (SETUP.md). Then check from a fresh session that the agent
      opens Blender through the MCP, imports a test mesh and takes a screenshot (done on the Mac 2026-11-06). Needed for
      the K-pop idol above (its texture is on that PC).
- [ ] *Optional*: a headless Blender runner (`npm run blender -- <script> <args>`, `--background --python`) for a batch
      without a Blender window; everything so far ran through the MCP.
- [ ] *Optional*: the fish swims in its card (hatch reveal, Fish Index). Both show stickers today; a ViewportFrame
      only shows bone deformations inside a WorldModel.
- [ ] *Optional*, **owner**: archive the old static fish meshes on the Creator Dashboard (ids `oldMeshId` /
      `staticMeshId` in design/meshes/manifest.json; nothing in the place uses them any more, but check the UFO's
      and the idol's current `MeshId` in the place before archiving: those two still have their static mesh).
