# SETUP — work on Project: Quarium from a new machine

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
| **FigCraft** | 0.11–0.12 | *optional*: UI design (`design/ui/*.figcraft`, FigCraft MCP); needs **both** the app and `figcraft-cli` (the MCP attaches to the running app) | Windows: portable build (both side by side), unzip it anywhere outside the repo. macOS: the `.dmg` holds the app only, the CLI is a separate download (e.g. `/Applications/FigCraft CLI/figcraft-cli`) |

Accounts: the **Roblox account that owns the game** (or Team Create access to it) to open the place and publish.

## 2. Get the project

```sh
git clone https://github.com/aguidez/project-quarium.git ProjectQuarium
# or, with an SSH key on your GitHub account: git clone git@github.com:aguidez/project-quarium.git ProjectQuarium
cd ProjectQuarium
npm install            # packages (roblox-ts, @rbxts/*, eslint, jimp and @resvg/resvg-js for the image tools)
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
| `figcraftApp`, `figcraftCli` | the FigCraft executables have other names / places (macOS: always) | exact paths, e.g. `/Applications/FigCraft.app/Contents/MacOS/FigCraft` and `/Applications/FigCraft CLI/figcraft-cli` |
| `figcraftPort` | port 7979 is taken | the FigCraft control port |
| `wgpuBackend` | FigCraft crashes at startup ("Shader translation error") | `"vulkan"` (the old Windows PC needed it), `"dx12"`, `"metal"`... or remove the key |
| `robloxStudioMcp` | the Studio MCP server isn't found automatically | path of `StudioMCP` (macOS) or `mcp.bat` / `StudioMCP.exe` (Windows) |
| `robloxFontsDir` | the Roblox fonts aren't found (FigCraft V2 build script) | Studio's `content/fonts` folder |
| `robloxOpenCloudKey` | you read the real players' statistics (`npm run stats`) | an Open Cloud API key, see below. **Secret**: only in this file, never in git |
| `robloxGroupOpenCloudKey` | you upload meshes for the game (`npm run group-mesh-upload`) | an Open Cloud key made **under the group** (see below). **Secret** |
| `robloxUniverseId` | another experience than Project: Quarium's (10774507209) | its universe id (`game.GameId`) |

Each key can also be given as an environment variable (`FIGCRAFT_DIR`, `ROBLOX_STUDIO_MCP`, `ROBLOX_FONTS_DIR`,
`ROBLOX_OPEN_CLOUD_KEY`...).
Default locations searched without config: Studio MCP in `%LOCALAPPDATA%\Roblox\mcp.bat` (Windows) or
`/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP` (macOS); fonts in the newest Studio version folder.

**Open Cloud key (players' statistics, optional).** `npm run stats` (`tools/player-stats.js`) reads every player
profile of the live DataStore to compare the real players with the balance simulator (ROADMAP M7). On the Creator
Dashboard: *Open Cloud → API Keys → Create API Key*; name it (e.g. "Project Quarium stats"), add the API system **Data
Stores**, pick the experience **[ALPHA] Project: Quarium** (the owner's group's, universe 10774507209: a key that
only has the API system Universes reads the game but answers 403 "Scope not authorized" on its saves) and only the
operations **List entry keys** and **Read entry**
(`universe-datastores.objects:list` / `:read`: the tool never writes); accepted IP addresses: your own, or
`0.0.0.0/0`; an expiration date is wise. Copy the key into `robloxOpenCloudKey`. Each machine can have its own key.
For `npm run share-assets` (`tools/share-assets.js`) the same key, made by the account that owns the assets, also
needs the API system **Asset Permissions** with **write** (`asset-permissions:write`).

**Group key (meshes the clients animate, optional).** The game belongs to the owner's group: a mesh the clients
animate must belong to the group too. `npm run group-mesh-upload` (`tools/group-mesh-upload.js`) uploads meshes as the
group, so it needs a key created with the **group** picked as the creator on the Creator Dashboard: API systems
**Assets** (Read, Write) and **Asset Permissions** (Write); Data Stores (List entry keys, Read entry) can be added for
`npm run stats`. Copy it into `robloxGroupOpenCloudKey`. A personal key can't create assets as a group ("unauthorized
to create an Model asset as Group").

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
- Rules and context the agent reads: `CLAUDE.md`, `PROJECT_CONTEXT.md`, `BALANCE.md`, `ROADMAP_V1.1.md`,
  `RELEASE_NOTES.md` and the notes in `docs/agent-notes/` (the working knowledge that used to live in the old
  machine's Claude memory).
- Personal Claude settings for this machine go in `.claude/settings.local.json` (git-ignored); shared ones in
  `.claude/settings.json`.

## 6. Check

```sh
npm run doctor        # Node, packages, Rojo version, Studio MCP, fonts, FigCraft
npx rbxtsc            # zero errors
npm run sim           # economy simulator (BALANCE.md)
npm run stats         # real players' statistics vs the simulator (needs robloxOpenCloudKey)
npm run share-assets <id...>  # lets the group's game use assets of the owner's account: audio (robloxOpenCloudKey)
npm run group-mesh-upload <file.obj...>  # uploads meshes as the group, for the clients to animate (robloxGroupOpenCloudKey)
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

## Switching machines (every time)

After `git pull` on the other machine, run `npm install` if `package.json` changed (a dev tool added on the other
machine, e.g. `@resvg/resvg-js`, is missing until then), and **rebuild before opening a playtest**: `npx rbxtsc` (or
keep `npm run watch` running). `out/` is git-ignored, so without a build Rojo keeps syncing that machine's last build into Studio: the
game then runs old code (e.g. V0.44 content pulled, a V0.40 build played: no shop at the huts, the new species'
templates "ignored").
