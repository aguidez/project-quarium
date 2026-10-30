---
name: ui-v2-arcade-style
description: "The owner approved the \"arcade aquatic\" UI V2 (Pet Sim 99 / Fish Sim style); every new UI must follow it, never flat dark rectangles"
metadata:
  type: feedback
  modified: 2026-10-30T11:24:01.353Z
---

On 2026-10-30 the owner rejected the old UI as "too flat, generic, AI-template looking" and approved the V2 "arcade aquatic" mock-ups (design/ui/redesign-v2.figcraft), then had them applied to the whole game (V0.33).

**Why:** they want an expressive, tactile UI in the style of Roblox hits (Pet Simulator 99, Fish Simulator), readable on mobile.

**How to apply:** build any new screen from `src/client/ui/kit.tsx` (Button3D with bevel + pressed state, ribbon HeaderBanner, Card / Plate, square ItemSlot, outlined Luckiest Guy / Fredoka One text). Forbidden: uniform translucent grey rectangles with small corners, tiny text in big empty areas, flat elements without depth. Design new screens first in FigCraft in that style (redesign-v2.build.js shows how) and show them before coding. Related: [[no-emoji-in-ui]], [[roblox-moderation-risk]].
