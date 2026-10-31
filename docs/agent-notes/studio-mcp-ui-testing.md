---
name: studio-mcp-ui-testing
description: "How to click / inspect the React UI during a Studio MCP playtest (coordinates, instance names, camera, live state)"
metadata:
  type: reference
  modified: 2026-10-30T14:30:30.032Z
---

Playtesting UI through the Roblox Studio MCP:

- `screen_capture` images are scaled down (e.g. 1519x1080 for a 1621x1152 viewport): pixel positions read on a capture do NOT match `user_mouse_input` x/y. Prefer `moveTo` with `instance_path` ("LocalPlayer.PlayerGui.ReactUi.Modal.Panel.Body.Header.Close"; side buttons: "…ReactUi.SideButtons.Quests"), or read `AbsolutePosition`/`AbsoluteSize` via execute_luau (Client) and click their centre.
- @rbxts/react names instances by the `key` of the host element itself; a key put on a function component is not used if the component's root element has its own key (e.g. quest tabs are named by their label "☀️ Daily").
- execute_luau resets the camera to Custom, so captures right after it may show a stuck/odd camera; the 2.5D focus view only comes back by leaving and re-entering the focus zone.
- Plugin `require` gets separate module copies: drive the game through remotes (client FireServer, or Server datamodel firing remotes to clients) instead of calling services.
- A running playtest doesn't pick up Rojo changes: stop/start play after `npx rbxtsc`.
- Fish no longer die of hunger (they turn Weak and fart 1$ bubbles), so long tests keep their fish.
- screen_capture does NOT render BillboardGuis parented to PlayerGui (hunger badges, money popups): verify them by script (Enabled, text), not by capture.
- **Check that Rojo is really syncing** before trusting a playtest: the Studio plugin can be disconnected while `rojo serve` runs (the place then runs old code). Grep the script's `.Source` from execute_luau for a new *code* string (roblox-ts strips comments, so a `// TEMP TEST` marker is never in the Luau); if missing, ask the user to reconnect.
- **Camera for play captures**: execute_luau resets the camera to Custom when it returns. To capture a precise view in play, spawn a RenderStepped loop (task.spawn, ~10 s) that keeps `CameraType = Scriptable` and the CFrame, return, then screen_capture.
- **Blank captures**: Studio sometimes renders no 3D (only the view cube / the UI) for a while, in Edit too. Build in Edit by script anyway and check visuals in a playtest later (it came back on its own).
- **Tests that change the user's save** (rebirth...): back up the raw key first (`DataStore:GetAsync` in Edit, keep a copy in the scratchpad), test, stop play, wait for the final save, then `SetAsync(key, backup, {userId})` and check it.
- **Solo playtests have one player**: features between players (likes…) need a `// TEMP TEST` bypass (e.g. allow self-like in Studio) to test the server path, restored afterwards.
- **Saves (ProfileStore)**: Studio API access is on for this place (ProfileStore prints "Roblox API services available"). Check the saved profile with `DataStoreService:GetDataStore("PlayerData_v1"):GetAsync("Player_<UserId>")` (`.Data.player`, `.Data.tank`, `.MetaData.ActiveSession`); GetAsync is cached ~4 s, so re-read after a wait before concluding a save failed. Stop/start play = leave/rejoin test; the test account's progress persists between playtests.
- To get the 2.5D view back after execute_luau broke the camera: click LocalPlayer.PlayerGui.FocusUi.Back, then teleport out of / back into the zone with task.delay inside a script that returns immediately.

- **Perf measurements**: Studio caps at 60 fps, and at 15 fps when its window loses focus (steady 66.7 ms frames = that cap, not load; got fooled once). Use `Stats.HeartbeatTimeMs` (script time) and `Stats.RenderCPUFrameTime` / `RenderGPUFrameTime` averaged over a few seconds instead of fps. Solo play has one Player: to load other tanks, a temporary `// TEMP TEST` harness spawned real FishService fish with the player as owner but another tank (excluded from saves and quest callbacks), backed up and restored afterwards.

- **UI V2 instance paths** (2026-10-30): a kit Button3D's clickable part is its `Face` child: side buttons "…ReactUi.SideButtons.Quests.Button.Face", panel close "…ReactUi.Modal.Panel.Window.Close.Face".
- **Preview a component with fake data** (states the test account can't reach: quest cards, rewards): in a Client execute_luau, `require(ReplicatedStorage.rbxts_include.node_modules["@rbxts"].react)` and `["react-roblox"]` (the ModuleScript itself, not `.src`), require `LocalPlayer.PlayerScripts.TS.ui.<File>`, `createRoot` on a temporary ScreenGui (DisplayOrder 50) and render it with fake props; destroy it after the capture. Display only, nothing reaches the server. Set the preview ScreenGui's `ZIndexBehavior = Sibling` like ReactUi (the default Global hides titles, icons and bars under the card faces). To preview config that doesn't exist yet (new quest kinds), mutate the plugin's own copy of the shared module (e.g. `QUESTS`, `STORY_LINES`) before requiring the panel: the game never sees it.
- **Dev chat commands** (Studio, owner only): send them from a Client execute_luau with `TextChatService.TextChannels.RBXGeneral:SendAsync("/incubators 2")` inside `task.spawn` (a direct call can time the request out).

Related: [[lobby-decor-constraints]]

- **Gamepasses in Studio** (2026-10-30): Roblox counts the game's creator as owning every pass of the game, so the owner's playtests show all passes OWNED and active. Use `/pass <GamePass>` (session only) to see the buyer's side. `GetProductInfo(id, Enum.InfoType.GamePass)` returns `IsForSale = false` / no price until the owner sets a price on the Creator Dashboard.
- **Rojo half-syncing** (2026-10-30, macOS): with the plugin "connected", Studio got some edited files but not others nor any new file. Restarting `npm run serve` and reconnecting the plugin fixed it. Check a new file *and* an edited one before a playtest.
- **Clicking a side button reliably** (2026-10-31): `moveTo` with an instance path like "LocalPlayer.PlayerGui.ReactUi.SideButtons.Companions" clicked the wrong button (the names hold spaces, e.g. "Fish Index", and the path resolution misses). Read `AbsolutePosition` / `AbsoluteSize` of the buttons with execute_luau (Client) and click their centre with x / y: with the ScreenGui's IgnoreGuiInset on, those are the mouse coordinates. Same for a panel's `Close` (ReactUi.Modal.Panel.Window.Close).
- `require()` of a game module from execute_luau gives a separate copy: to read the live state, listen to `SyncPlayerData` / `PlaySfx` from a Client script, or read replicated attributes.
