# Agent notes

Durable working knowledge for the AI agent (Claude Code), versioned with the project so it follows it from one
machine to another (Claude's own auto-memory lives in the user's home folder and stays on the old machine).
One note per topic, with a front matter (`name`, `description`, `type`: feedback = the owner's guidance,
project = how things are done here, reference = tools and environment quirks).

Read the notes a task touches before starting it. When you learn something durable (an owner preference, a pipeline
step, a tool quirk), add or update a note here and its line below, in the same task.

- [Lobby decor constraints](lobby-decor-constraints.md) — beach lobby layout, focus-camera cones to keep clear, 80/20 palette, terrain/MCP quirks
- [Studio MCP UI testing](studio-mcp-ui-testing.md) — clicking React UI in playtests: scaled captures vs mouse coords, instance names, camera/require quirks, saves, dev chat commands
- [Fish asset pipeline](fish-asset-pipeline.md) — generate_mesh quirks, templates, sprite upload, EditableMesh budget, playtest shortcuts
- [No emoji in the UI](no-emoji-in-ui.md) — player-facing texts, designs and notes stay emoji-free; draw icons instead
- [Roblox moderation risk](roblox-moderation-risk.md) — a firefighter-fish icon got the account a ToS warning; no bomb/weapon-like shapes, ask before risky themes
- [UI V2 arcade style](ui-v2-arcade-style.md) — owner-approved Pet Sim-like UI; build every screen from client/ui/kit.tsx, never flat
- [Shell heredoc quirk](shell-heredoc-quirk.md) — (Windows Git Bash) heredocs with apostrophes break; write scripts with the Write tool
