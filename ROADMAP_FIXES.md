# ROADMAP — Small fixes to plan

> Small fixes and polish noted along the way, outside the big roadmaps (ROADMAP_V1.1.md). Each one ships in the next
> patch that has room for it; tick it and move what it ships into `PROJECT_CONTEXT.md` / `RELEASE_NOTES.md` as usual.
> Last updated: 2026-11-06 (file created: the K-pop idol's texture, the other tanks' fish badges).

- [ ] **The K-pop idol is grey** (found 2026-11-06, ROADMAP_V1.1 A5.9). `ServerStorage.Assets.EventFish.KpopIdol.Mesh`
      has no texture: its look was a `TextureID`, which `ApplyMesh` cleared in V0.60.5's group mesh swap (a
      SurfaceAppearance survives it). The original is on the **Windows PC** (the owner, 2026-11-06): read the idol's
      TextureID there (an older local copy of the place, or a place version from before 2026-11-03 opened in Studio),
      put it back on the template as a **SurfaceAppearance ColorMap** (no new upload), check it with a capture, ask the
      owner to save + publish. Then the idol joins the bone rig (the batch checklist of the agent note
      blender-pipeline, template in `Assets.EventFish`), and its beat dance comes with ROADMAP_V1.1 A6.
- [ ] **Hide the hunger and AFK badges of the other aquariums** (owner, 2026-11-06). FishIndicatorController puts a
      badge over every fish it sees (Hungry / Weak 🍽️, Paused "AFK"), so everyone sees the state of the other players'
      fish. Show them only over the fish of the local player's own tank (the aquarium's `OwnerUserId` attribute, or
      `FocusController.getOwnAquarium()`); the fish of other tanks get none. Check in the lobby next to an other
      player's tank (a second Studio test player) and in the 2.5D view.
