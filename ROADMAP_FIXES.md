# ROADMAP — Small fixes to plan

> Small fixes and polish noted along the way. Each one ships in the next patch that has room for it; tick it and move
> what it ships into `PROJECT_CONTEXT.md` / `RELEASE_NOTES.md` as usual.
> Last updated: 2026-11-09 (Blender on the PC; the K-pop idol textured and on bones, V1.2.16).

- [ ] **Hide the hunger and AFK badges of the other aquariums** (owner, 2026-11-06). FishIndicatorController puts a
      badge over every fish it sees (Hungry / Weak 🍽️, Paused "AFK"), so everyone sees the state of the other players'
      fish. Show them only over the fish of the local player's own tank (the aquarium's `OwnerUserId` attribute, or
      `FocusController.getOwnAquarium()`); the fish of other tanks get none. Check in the lobby next to an other
      player's tank (a second Studio test player) and in the 2.5D view.
- [ ] *Optional*: a headless Blender runner (`npm run blender -- <script> <args>`, `--background --python`) for a batch
      without a Blender window; everything so far ran through the MCP.
- [ ] *Optional*: the fish swims in its card (hatch reveal, Fish Index). Both show stickers today; a ViewportFrame
      only shows bone deformations inside a WorldModel.
- [ ] *Optional*, **owner**: archive the old static fish meshes on the Creator Dashboard (ids `oldMeshId` /
      `staticMeshId` in design/meshes/manifest.json; nothing in the place uses them any more, but check the UFO's
      and the idol's current `MeshId` in the place before archiving: those two still have their static mesh).
