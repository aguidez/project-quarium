---
name: two-machines-windows-mac
description: The owner works on both a Windows PC and a Mac; setup docs and config must keep both, never replace one by the other
type: feedback
---

The owner develops on **both** a Windows PC (where the project and SETUP.md were first written) and a Mac
(since 2026-10). They switch between the two.

**Why:** a doc or script fixed "for the Mac" by replacing the Windows instructions breaks the next session on the PC.

**How to apply:**
- In `SETUP.md`, `workspace.local.example.json`, `tools/check-setup.js` and the MCP launchers, **add** the macOS
  variant next to the Windows one; never delete or rewrite the Windows paths, commands or quirks.
- Machine paths go only in each machine's own `workspace.local.json` (git-ignored), never in committed files.
- FigCraft differs per OS: Windows uses the portable build (`figcraftDir`, app + CLI side by side); the Mac needs
  `/Applications/FigCraft.app` **and** the separate `/Applications/FigCraft CLI/figcraft-cli`
  (`figcraftApp` + `figcraftCli`). The CLI alone is not enough: the MCP attaches to the running app.
- **Stale build after switching machines**: `out/` is git-ignored, so after a pull Studio runs the last build made
  on *this* machine until `npx rbxtsc` runs (2026-11-01: V0.41–V0.44 made on the Mac, the PC still played a V0.40
  build, reported as "the shop no longer opens"). Symptoms in the output: `Template "...<recent species/theme>"
  ignored: needs a PrimaryPart and a valid ...`, and recent services / controllers missing from the "started"
  lines. Before chasing a "regression" after a machine switch, check `out/` dates and rebuild.
- **Missing dev packages after switching** (2026-11-02): `Cannot find module '@resvg/resvg-js'` on the PC: added on
  the Mac, never installed here. `npm install` after a pull that touched package.json.
- On the Mac, Node comes from Homebrew (`/opt/homebrew/bin`, may need adding to the PATH in shell commands).
- **Pull before anything** (2026-11-09): a whole task (analysis, V1.2.15 code, a Studio test) was done on a PC clone 66
  commits behind (V1.0.1 while the game was at V1.2.14); the push refused it and it had to be rebased, renumbered and
  tested again, and meanwhile Rojo had synced the old scripts into the owner's Studio. Run `git fetch` and compare with
  `origin/main` (then pull, `npm install`, `npx rbxtsc`) before reading the code or connecting Rojo. After a rebase that
  adds files, Rojo may miss them: check them in Studio and recreate the `out/` file to trigger the sync.
