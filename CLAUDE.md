# Project Rules & Architecture: roblox-ts (Full AI Workflow)

## 0. Project Context (READ FIRST, KEEP UP TO DATE)
- **Before any research or change**, read `PROJECT_CONTEXT.md` (stack & conventions, annotated tree, data & events flow, known limits). Use it to go straight to the right files instead of browsing the whole project; only open what the task needs.
- **Every change must keep `PROJECT_CONTEXT.md` accurate, in the same task**: new / renamed / removed file, service, controller, UI component, remote or action, PlayerData field, tag or attribute, quest, feature, game system, balance rule or known limit. Update its "Last updated" date. A task isn't finished while the context file is stale.

## 0b. Release Notes (KEEP UP TO DATE)
- `RELEASE_NOTES.md` records every change to the game, patch by patch, newest version at the top.
- **Every task that changes the game opens a new patch in the same task**: a sub-patch (+0.01, e.g. V0.01 → V0.02) unless the user asks for a bigger version step. All the changes of the task go into it, under **New**, **Changes**, **Balance** and **Fixes**. Bug fixes are always listed.
- **Never delete or rewrite old versions**: only add the new patch on top. A task isn't finished while its changes are missing from the release notes.

## 0c. Balance (KEEP UP TO DATE)
- `BALANCE.md` describes the game's balance: the average player's expected progression (what after how long, and why), the numbers (species, eggs, rebirths, Ocean milestones, variants), the design rules and the history of the balance changes.
- **Every change to a number of the economy** (fish income or interval, egg price / hatch / odds, rebirth price / multiplier, Ocean milestones, variants, food, capacity…) **updates, in the same task**: `tools/economy-sim.js` (mirror of the config), a run of `node tools/economy-sim.js`, and `BALANCE.md` (timeline, tables, a new line in its history). A task isn't finished while BALANCE.md is stale.
- When the owner gives a target ("rebirth 2 at ~1h45"), tune with the simulator until the median hits it, and write the p10–p90 spread too.

## 0d. Agent Notes (SHARED MEMORY, KEEP UP TO DATE)
- `docs/agent-notes/` holds the durable working knowledge of the project (owner preferences, asset pipelines, Studio MCP testing tricks, tool quirks), indexed in its `README.md`. **Read the notes a task touches before starting it.**
- When you learn something durable, **write it there** (new note or update + its index line), not only in Claude's per-machine auto-memory: the project moves between machines and the auto-memory does not follow.

## 0e. Portability (any machine, any OS)
- The workspace must work on Windows and macOS from a fresh clone by following `SETUP.md` (prerequisites, install, machine config). `npm run doctor` (`tools/check-setup.js`) checks a machine.
- **Never commit a machine-specific value** (absolute paths like `C:\...` or `F:\...`, user names, install folders, GPU flags): read it from `workspace.local.json` (git-ignored; template `workspace.local.example.json`) through `tools/local-config.js`, and document the new key in the template and `SETUP.md`.
- Scripts and launchers are cross-platform Node (`path.join`, no `cmd.exe` / PowerShell / Bash-only syntax); MCP servers in `.mcp.json` start through `node tools/mcp/*.js`.
- A new prerequisite, tool, npm script or local config key updates `SETUP.md` (and `tools/check-setup.js` when it can be checked) in the same task.

## 1. Environment & Compiler Constraints
- **Target**: `roblox-ts` (TypeScript compiled to Luau). `noLib: true` is active.
- **FORBIDDEN**: Never use Node.js/Browser globals (`setTimeout`, `fetch`, `window`, `document`, `Math.random`, `console.log`).
- **REQUIRED Globals**: Use `task.wait()`, `task.spawn()`, `task.delay()`, `math.random()`, `os.clock()`, `print()`, `warn()`, `error()`.
- **Arrays & Maps**: ALWAYS use `.size()` instead of `.length`. Use `ipairs` / `pairs` or standard `for (const x of arr)` loops.
- **Services**: Always import from `@rbxts/services` (e.g., `import { Players, Workspace, CollectionService, TweenService } from "@rbxts/services";`).

## 2. Architecture & File Structure
- `src/shared/framework.ts`: Lifecycle runner (`onInit` runs sync, `onStart` runs async via `task.spawn`).
- `src/shared/network.ts`: RemoteEvent definitions (`ServerToClientEvents`, `ClientToServerEvents`) and `getRemoteEvent(name)`.
- `src/shared/types/`: Shared TypeScript interfaces and game configuration constants (Items, Upgrades, Enemies).
- `src/server/services/`: Server Singletons implementing `Lifecycle`. **CRITICAL**: Whenever you create a new Service, you MUST register it inside `src/server/main.server.ts`.
- `src/client/controllers/`: Client Singletons implementing `Lifecycle`. **CRITICAL**: Whenever you create a new Controller, you MUST register it inside `src/client/main.client.ts`.

## 3. Studio vs Code Separation (Full-AI Rules)
- **Zero Pre-made UI Assumption**: Never assume a `ScreenGui` exists in `StarterGui`. All UI must be generated entirely through code inside Client Controllers (or `@rbxts/react` if installed) and parented to `Players.LocalPlayer.WaitForChild("PlayerGui")`.
- **3D World Interaction via Tags**: Never hardcode deep Workspace paths like `Workspace.Map.Folder.Part`. Use `CollectionService.GetTagged("TagName")` and `CollectionService.GetInstanceAddedSignal("TagName")` to attach logic to 3D models/parts. When you create a mechanic requiring 3D parts, tell the user which Tag to add in Studio, OR generate the 3D parts procedurally via `new Instance("Part")`.
- **Network Security**: Client input is never trusted. Validate all `OnServerEvent` parameters at runtime using `@rbxts/t`.
- **Server Authority (Anti-Cheat)**: The server is the single source of truth for money and every gameplay state (purchases, prices, income, inventory, entity states like fish hunger). The client only sends *intents* (e.g. `"BuyFish"`, `"DropFood"`) and renders data synced from the server. Never let the client send amounts, prices, or results: the server reads prices from shared config, checks affordability, deducts/credits money, enforces cooldowns/caps, and clamps any client-provided position into valid bounds.
- **Cleanup**: Always clean up connections and instances using `@rbxts/janitor` or `.Destroy()` when players/objects are removed.

## 4. Self-Verification Workflow
- After creating or modifying any `.ts` file, ALWAYS run `npx rbxtsc` in the terminal to verify that there are zero TypeScript compilation errors before finishing your response.

## 5. Hybrid Workflow: Rojo (TypeScript) + Roblox Studio MCP
You have access to both the local VS Code filesystem (TypeScript compiled via `roblox-ts` & synced via Rojo) AND the **Roblox Studio MCP server**. Follow this strict separation of concerns:

1. **NEVER Edit Scripts via MCP**:
   - Do NOT use MCP `multi_edit` to create or modify game scripts inside `ServerScriptService`, `ReplicatedStorage`, or `StarterPlayerScripts`. Rojo manages those folders and will overwrite any direct Studio script edits.
   - ALL persistent game logic MUST be written in TypeScript inside `src/` on the local disk and compiled via `npx rbxtsc`.

2. **Use MCP Exclusively for 3D World, Assets, Tags & Inspection**:
   - **Map & Level Design**: Use MCP (`execute_luau` in `Edit` datamodel, `generate_procedural_model`, `generate_mesh`, `generate_material`) to build 3D maps, terrain, lighting, and models inside `Workspace`.
   - **Creator Store Assets**: Use MCP (`search_asset`, `insert_asset`) to find and place 3D models, audio, and decals into `Workspace` or `ReplicatedStorage.Assets`.
   - **Linking 3D to TypeScript**: When you create or insert a 3D model via MCP that needs game logic (e.g., an NPC, a chest, a hazard), assign it a `CollectionService` tag or Attributes via MCP (`execute_luau`), and write the corresponding TypeScript handler in `src/` listening to that tag.
   - **Visual & Runtime Verification**: Use `screen_capture` to visually inspect the 3D scenes you build. Use `start_stop_play` and `get_console_output` to playtest the compiled TypeScript code and read runtime errors automatically.

## 6. UI Design & Implementation Workflow (FigCraft MCP -> @rbxts/react)
You have access to the **FigCraft MCP server** for visual UI design and prototyping. When creating or updating game UI, follow this pipeline:

1. **Design First in FigCraft**:
   - Use FigCraft MCP commands to create Frames, Auto-Layouts, Components, Text, and Vector Icons on the FigCraft canvas so the user can visually inspect and tweak the UI.
   - Always use FigCraft **Auto Layout** (horizontal, vertical, grid, padding, gap) rather than arbitrary absolute positioning whenever possible.
2. **Translate FigCraft Nodes to `@rbxts/react` (`.tsx`)**:
   - Inspect the finalized FigCraft node tree via MCP and translate it into `.tsx` components inside `src/client/ui/`.
   - **Mapping Rules**:
     - FigCraft `Frame` -> `<frame>` (use `BackgroundTransparency={1}` if no fill).
     - FigCraft `Auto Layout` -> `<uilistlayout>` or `<uigridlayout>`.
     - FigCraft `Padding` -> `<uipadding>` (`PaddingTop`, `PaddingBottom`, `PaddingLeft`, `PaddingRight`).
     - FigCraft `Corner Radius` -> `<uicorner CornerRadius={new UDim(0, radius)} />`.
     - FigCraft `Stroke` -> `<uistroke Color={...} Thickness={...} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />`.
     - FigCraft `Gradient` -> `<uigradient />`.
     - FigCraft `Vector / Complex Icon` -> Export node as 2x PNG via FigCraft, upload to Roblox via Roblox Studio MCP (`upload_image`), and render as `<imagelabel Image="rbxassetid://..." />`.
3. **Mount UI via Client Controller**:
   - Mount the root React tree inside a `ScreenGui` (`ResetOnSpawn={false}`, `IgnoreGuiInset={true}`) parented to `Players.LocalPlayer.WaitForChild("PlayerGui")` inside `UiController.ts`.

## 7. Roblox Moderation Safety (CRITICAL: the account can be banned)
Every `upload_image`, `generate_mesh`, `generate_texture`, `generate_material` and `insert_asset` is published or reviewed under the **owner's Roblox account**. Roblox's automated moderation is strict and literal: a single false positive gives the account a warning, and repeated strikes lead to a ban. On 2026-10-29 the sticker icon of a "firefighter fish" (a brass hose nozzle sticking out of its mouth) earned a ToS warning for "regulated content", most likely read as a **cigarette**.

1. **Review every image before uploading it**, as a suspicious moderator would, at the size it will be uploaded. Reject it if any part could be mistaken for:
   - smoking, vaping, drugs, alcohol: anything stick-, tube- or pipe-shaped in or near a mouth, smoke puffs, bottles, glasses, cans, pills, syringes, leaves resembling cannabis;
   - weapons and explosives: guns, blades, bombs, fuses, grenades, dynamite, round objects with a wick, cannons;
   - gore, blood, skulls used violently, adult or suggestive shapes, real brands, logos, text, faces of real people;
   - gambling imagery (dice, slot machines, casino chips).
2. **Design to stay far from the line**: soft, rounded, clearly cartoon shapes; nothing held in or coming out of a mouth (no straws, nozzles, pipes, cigars); no thin cylinders pointing out of a character; no fire next to a round object. Write `generate_mesh` prompts that exclude such details explicitly when a theme invites them.
3. **Ask the owner before generating or uploading anything with a risky theme** (firefighters, pirates, soldiers, chemists, potions, parties, police, hunting, fire, explosions, medicine), and describe the design first. When in doubt, don't upload.
4. **Upload as little as possible**: preview locally first (renders, sheets, FigCraft screenshots), upload only the final images, never test or candidate batches. Never upload a variant set of a design the owner hasn't seen.
5. **If an asset gets flagged**: stop all uploads at once, drop the design, tell the owner which other uploaded asset ids belong to it (variants, icons, textures, meshes) so they can archive them in the Creator Dashboard before they get flagged too. Never re-upload it in another form.