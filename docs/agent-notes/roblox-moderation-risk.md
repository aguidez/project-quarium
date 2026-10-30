---
name: roblox-moderation-risk
description: "Uploads (images, generated meshes) are moderated on the user's Roblox account: a firefighter-fish icon earned a ToS warning; avoid shapes that read as bombs, weapons, alcohol, drugs, tobacco"
metadata:
  type: feedback
  modified: 2026-10-29T20:22:04.506Z
---

On 2026-10-29 Roblox moderation gave the user's account a warning ("illegal or regulated content: alcohol, drugs, tobacco, bombs, weapons") for an uploaded sticker icon of a "firefighter fish" (red round body, red helmet, brass hose nozzle sticking out of the mouth). The user thinks Roblox's AI took the nozzle in the mouth for a **cigarette** (my first guess was a bomb / extinguisher). The rules now live in CLAUDE.md §7 (Roblox Moderation Safety). The user had to accept the ToS again to use Studio, and asked to drop that design. A generate_mesh prompt for a sea fan coral was also rejected by moderation ("Moderation failed").

**Why:** every upload_image / generate_mesh is published under the user's account; strikes put the account at risk.

**How to apply:**
- Before uploading, look at the image as a moderator would: no cylinder + fuse / nozzle / pipe shapes, nothing like bombs, guns, blades, bottles, cigarettes, syringes, pills.
- Ask the user before generating a design with a risky theme (firefighter gear, pirates with weapons, potions in bottles...). Prefer soft organic shapes for fish.
- If an asset was flagged, its sibling uploads (variant textures, other icons of the same design) can be flagged next: tell the user their ids so they can archive them in the Creator Dashboard.

Related: [[fish-asset-pipeline]]
