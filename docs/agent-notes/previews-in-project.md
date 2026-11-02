---
name: previews-in-project
description: Show the owner every image / preview through a clickable link to a file inside the project (design/previews/), never a temp or scratchpad path
metadata:
  type: feedback
---

Every image meant for the owner (Studio captures, design mock-ups, renders, sheets, comparisons) is copied into
`design/previews/` with a short readable name (`crab-sax-preview.jpg`), and the reply links it as a clickable relative
markdown link: `[crab-sax-preview.jpg](design/previews/crab-sax-preview.jpg)`. Never point the owner to the scratchpad,
`AppData\Local\Temp`, `.claude\projects\...\tool-results` or any other machine folder.

**Why:** the owner doesn't see the captures shown to the agent, and the long temp paths (hashed folder names) are too
hard to open (2026-11-02, the saxophone crab preview).

**How to apply:** right after a `screen_capture` or a rendered image the owner should look at, copy it into
`design/previews/` and give the link in the same reply. Replace a preview of the same design under the same name rather
than piling up variants; delete previews of dropped designs.
