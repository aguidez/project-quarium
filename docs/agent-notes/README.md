# Agent notes

Durable working knowledge for the AI agent (Claude Code), versioned with the project so it follows it from one
machine to another (Claude's own auto-memory lives in the user's home folder and stays on the old machine).
One note per topic, with a front matter (`name`, `description`, `type`: feedback = the owner's guidance,
project = how things are done here, reference = tools and environment quirks).

Read the notes a task touches before starting it. When you learn something durable (an owner preference, a pipeline
step, a tool quirk), add or update a note here and its line below, in the same task.

- [Lobby decor constraints](lobby-decor-constraints.md) — beach lobby layout, focus-camera cones to keep clear, 80/20 palette, terrain/MCP quirks, where the leaderboards stand and why
- [Studio MCP UI testing](studio-mcp-ui-testing.md) — clicking React UI in playtests: scaled captures vs mouse coords, instance names, camera/require quirks, saves, dev chat commands (and sending them from a script), gamepasses in Studio, Rojo half-syncing, load test recipe (leave the 2.5D view first), driving an event test and catching short visuals, counting a music event's coins, measuring a track's BPM / first beat (AudioAnalyzer), previewing a world SurfaceGui board with fake data (FireClient from the server), comparing billboard variants side by side, previewing the loading screen in Edit at a fixed progress, the chat window missing from captures, testing a save at a given progress (a copy in a test store), a tank billboard hidden by the focus camera's distance, playing the onboarding on a fresh profile (an empty test store), catching a short UI flash, previewing the UI at a phone's size (844 x 390 box), clicking and measuring in the topbar row (negative AbsolutePosition.Y)
- [Fish asset pipeline](fish-asset-pipeline.md) — generate_mesh quirks, templates, sprite upload, EditableMesh budget, playtest shortcuts, UI icons without FigCraft (resvg), variant stickers before upload (EditableImage), name ↔ look checks with the owner, upright meshes pitched in the template, decor / title cosmetics, never save Studio mid-capture, generated fish with a face on one side only, raster edits with jimp (logo cutout; ask for a clean picture rather than erasing a baked element), meshes the group owns (re-upload as the group for the clients to animate them)
- [Content recipes](content-recipes.md) — step by step: a new fish species, aquarium theme, companion, egg, music event with a dancing guest or event run by its own service (assets, config, balance, checks); new content while the alpha is on
- [Previews in the project](previews-in-project.md) — show the owner images as a clickable link to design/previews/, never a temp path
- [No emoji in the UI](no-emoji-in-ui.md) — player-facing texts, designs and notes stay emoji-free; draw icons instead
- [Roblox moderation risk](roblox-moderation-risk.md) — a firefighter-fish icon got the account a ToS warning; no bomb/weapon-like shapes, ask before risky themes
- [UI V2 arcade style](ui-v2-arcade-style.md) — owner-approved Pet Sim-like UI; build every screen from client/ui/kit.tsx, never flat; FigCraft round parents are frames; scroll lists centred, with room for rings
- [Shell heredoc quirk](shell-heredoc-quirk.md) — (Windows Git Bash) heredocs with apostrophes break; write scripts with the Write tool
- [Two machines: Windows and Mac](two-machines-windows-mac.md) — the owner switches between a Windows PC and a Mac; add the Mac variant next to Windows, never replace it; FigCraft app + CLI per OS; rebuild (`npx rbxtsc`) after every pull or Studio plays a stale build
- [Player statistics](player-stats.md) — what the saves record (V0.47), reading profiles from Studio / Open Cloud, the DataStore's hourly version history; banning a player from the leaderboards
