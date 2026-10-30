# SETUP — work on Projet Quarium from a new machine

Works on **Windows** and **macOS** (Roblox Studio has no Linux version: on Linux you can code, build and run the
simulators, but not test in Studio). Run `npm run doctor` at the end: it checks everything below.

## 1. Prerequisites

| Tool | Version | Why | Install |
|---|---|---|---|
| **Git** | any recent | the repo | https://git-scm.com (Windows: Git for Windows, it also brings Git Bash) |
| **Node.js** | 20 or newer (LTS; 24 used today) | roblox-ts compiler, simulators, build scripts, MCP launchers | https://nodejs.org |
| **Aftman** (or **Rokit**) | latest | installs Rojo at the version pinned in `aftman.toml` (Rokit reads that file too) | https://github.com/LPGhatguy/aftman / https://github.com/rojo-rbx/rokit |
| **Rojo** | 7.7.1 (from `aftman.toml`) | syncs `out/` into Studio | `aftman install` (or `rokit install`) in the repo |
| **Roblox Studio** | latest | the place, playtests, the Studio MCP server | https://create.roblox.com |
| **Rojo Studio plugin** | matching Rojo 7.7 | connects Studio to `rojo serve` | `rojo plugin install`, or the Creator Store |
| **VS Code** | latest | editor; accept the recommended extensions (roblox-ts, ESLint, Rojo, Claude Code) | https://code.visualstudio.com |
| **Claude Code** | latest | the AI agent (CLI or VS Code extension) | https://claude.com/claude-code |
| **FigCraft** | 0.11.x | *optional*: UI design (`design/ui/*.figcraft`, FigCraft MCP) | portable build, unzip it anywhere outside the repo |

Accounts: the **Roblox account that owns the game** (or Team Create access to it) to open the place and publish.

## 2. Get the project

```sh
git clone https://github.com/aguidez/project-quarium.git ProjetQuarium
# or, with an SSH key on your GitHub account: git clone git@github.com:aguidez/project-quarium.git ProjetQuarium
cd ProjetQuarium
npm install            # packages (roblox-ts, @rbxts/*, eslint, jimp for the image tools)
aftman install         # or: rokit install  -> rojo 7.7.1 on the PATH
npx rbxtsc             # build: must end with no error, creates out/ and include/
```

## 3. Machine config (`workspace.local.json`, never committed)

Everything specific to one machine (install paths, GPU quirks) lives in `workspace.local.json` at the repo root,
ignored by git. Start from the template:

```sh
cp workspace.local.example.json workspace.local.json      # Windows PowerShell: Copy-Item ...
```

| Key | Needed when | Value |
|---|---|---|
| `figcraftDir` | you use FigCraft | folder holding `figcraft(.exe)` and `figcraft-cli(.exe)` |
| `figcraftApp`, `figcraftCli` | the FigCraft executables have other names / places (e.g. a macOS `.app`) | exact paths |
| `figcraftPort` | port 7979 is taken | the FigCraft control port |
| `wgpuBackend` | FigCraft crashes at startup ("Shader translation error") | `"vulkan"` (the old Windows PC needed it), `"dx12"`, `"metal"`... or remove the key |
| `robloxStudioMcp` | the Studio MCP server isn't found automatically | path of `StudioMCP` (macOS) or `mcp.bat` / `StudioMCP.exe` (Windows) |
| `robloxFontsDir` | the Roblox fonts aren't found (FigCraft V2 build script) | Studio's `content/fonts` folder |

Each key can also be given as an environment variable (`FIGCRAFT_DIR`, `ROBLOX_STUDIO_MCP`, `ROBLOX_FONTS_DIR`...).
Default locations searched without config: Studio MCP in `%LOCALAPPDATA%\Roblox\mcp.bat` (Windows) or
`/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP` (macOS); fonts in the newest Studio version folder.

## 4. Roblox Studio

1. Open the game's place **from Roblox** (File > Open from Roblox / the Creator Dashboard): the map, the 3D templates
   (`ServerStorage.Assets`...) and the aquariums live in the published place, **not in git**. Save / publish it after
   any change made in Studio.
2. Game Settings > Security: **Enable Studio Access to API Services** (player saves through ProfileStore).
3. Enable Studio's **MCP server** (Assistant / MCP settings) so Claude Code can drive Studio.
4. In a terminal at the repo root: `npm run watch` (rebuild on save) and `npm run serve` (`rojo serve`), then
   **Connect** in the Rojo plugin.

## 5. Claude Code

- Open the repo folder in VS Code (or run `claude` in it). The project's MCP servers come from `.mcp.json`; they start
  through `node tools/mcp/*.js`, which work on every OS and read `workspace.local.json`. Approve them on first launch,
  then check with `/mcp` that **Roblox_Studio** (Studio open) and **FigCraft** are connected.
- Rules and context the agent reads: `CLAUDE.md`, `PROJECT_CONTEXT.md`, `BALANCE.md`, `ROADMAP.md`,
  `RELEASE_NOTES.md` and the notes in `docs/agent-notes/` (the working knowledge that used to live in the old
  machine's Claude memory).
- Personal Claude settings for this machine go in `.claude/settings.local.json` (git-ignored); shared ones in
  `.claude/settings.json`.

## 6. Check

```sh
npm run doctor        # Node, packages, Rojo version, Studio MCP, fonts, FigCraft
npx rbxtsc            # zero errors
npm run sim           # economy simulator (BALANCE.md)
```

## What is shared, what stays on each machine

| Shared (in git) | Local (git-ignored or outside the repo) |
|---|---|
| `src/`, `tools/`, `design/`, the `.md` docs, `docs/agent-notes/` | `node_modules/`, `out/`, `include/` (rebuilt) |
| `package.json` + `package-lock.json`, `aftman.toml`, `tsconfig.json`, `default.project.json` | `workspace.local.json` (install paths) |
| `.mcp.json`, `.vscode/settings.json` + `extensions.json`, `.eslintrc`, `.prettierrc`, `.gitattributes` | `.claude/settings.local.json`, `CLAUDE.local.md`, other `.vscode/*` files |
| | Claude's auto-memory (`~/.claude/projects/...`), the FigCraft and Roblox Studio installs, local `.rbxl` copies |

## Moving from the old machine

1. Commit and push everything (`git status` must be clean apart from ignored files).
2. Save / publish the place in Studio.
3. Note the old `workspace.local.json` values if useful (the FigCraft folder is the only one that was needed).
4. Claude's auto-memory of the old machine (`%USERPROFILE%\.claude\projects\<project>\memory\`) is already copied into
   `docs/agent-notes/`; anything added there later must be copied over by hand.
