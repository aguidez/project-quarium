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

FigCraft build scripts: an `ellipse` node can't hold children ("can't contain children"): make round parents (medallions, coins, avatars) a frame with `cornerRadius` = half its size. World boards (like / leaderboard signs) follow the same V2 style on a SurfaceGui; letters next to digits in a score ("$7.2M/s", "212h 05m") go in Fredoka, not Luckiest Guy.

Scrolling lists inside a Panel (V0.57, the owner spotted both): the Panel centres its children, so a list widened for its scroll bar shifts the content left; wrap it in a frame exactly `PANEL_INNER_WIDTH` wide and let the scroll bar room spill into the right padding. A ScrollingFrame clips, and a selection ring (Border stroke) spills out of its card: leave a few pixels of room on every side of the content (AquariumPanel's `RING_ROOM`). Round grid cell widths down and split the spare pixels on both sides. The QuestPanel had the same bug until V0.60.7
(the owner saw its cards cut on the left): any new scrolling list follows AquariumPanel's `ListArea` pattern (wrapper
frame of the content's width, scrolling frame at `-EDGE_ROOM` and `EDGE_ROOM + content + SCROLL_ROOM` wide, content at
`+EDGE_ROOM`), plus `VerticalScrollBarInset = ScrollBar`: without it, once the bar shows, the visible area shrinks by
its thickness while the canvas keeps its width, so the content becomes a few pixels wider than the window.
