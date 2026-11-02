# PROJECT_CONTEXT — Projet Quarium

> Living map of the project. **Read it before exploring the code, and update it in the same change
> whenever you add / rename / remove a file, a service, a remote, a PlayerData field, a tag or a game system.**
> Last updated: 2026-11-02 (V0.48: daily boards from rebirth 2, weekly from rebirth 3; Customize button next to My aquarium / Back to lobby; aquarium customization: theme / decor / finishes / title choices, customization.ts, CustomizationService, AquariumPanel, Aquarium side button, THEME_PALETTES; V0.47: the owner's "/speed" test speed (x6: V1 in ~2h30), play statistics, SaveData.stats / playerStats.ts, StatsService (AnalyticsService funnels and events), StatsReportController, tools/player-stats.js (Open Cloud, npm run stats); V0.46, ROADMAP M7: daily / weekly coin boost (PlayerData.coinBoostSeconds, QuestBoostPill, "/boost"), rebirths 3–8 and their eggs x1.45, side lines Hatchery / Collector / Ocean, daily / weekly pools, quest stats CoinsCollected / FishFed / LikesGiven / VariantFound / TotalHatched, Golden Incubator decor, LikeService.onLikeGiven, simulator side lines + hoursPerDay, load test with 18 species in §4; V0.45: swim animation stopgap, rigs planned in triangles + sway; ROADMAP_V1.1.md: the post-V1 animation revamp plan, EditableMesh budget measured in §4;
> V0.44, ROADMAP M6: rebirths 7–8 → CrystalCaverns / CosmicSanctuary themes, WolfDogfish
> ("Husky Dogfish") / BunnyShark / MiniLeviathan (Mythic) with Moon / Star / Planet coins, Crystal and Cosmic eggs, Ocean
> milestones 450,000 (tank 25) and 1,000,000 (OceanGuardian: title + whale statue), Voyage 12–16 (gauge SpeciesFound,
> Master Aquarist), TitleService (best title above the head), decor in the tank (DECOR_SLOTS, tag DecorTemplate); V0.43: weak fish bubble sound instead of the fart one, coin chime with a combo pitch
> (CoinService.playCoinSfx), Ocean milestone cards fit their width, variant chances shown with the player's luck
> (getPlayerVariantLuck), companion cards show their live numbers (companionStats.ts); V0.42, ROADMAP M5: rebirth 6 → VolcanicTemple theme, Lionfish / Dragonfish (Legendary) +
> CoralFan / DragonScale coins, Volcano egg, Ocean milestones 180,000–300,000, the Jellyfish companion (on-demand feeder,
> FoodService.releaseFood) and its pass line (perks Jellyfish1–3), Pearl rims shown by AquariumService, Voyage 10–11, fed
> callbacks report which companion fed; V0.41: the shop moves into the lobby: Workspace.Lobby.FishingHutEast / FishingHutWest (hut +
> fisherman tagged ShopKeeper + SHOP sign) at both ends of the central aisle, ShopKeeperController opens the Shop panel at
> the counter, no Shop side button; like boards x1.8 (LIKE_BOARD_OFFSET x −30.6); spawn moved to x 100, Welcome sign to the north end, south Boundary fixed; V0.40, ROADMAP M4: rebirth 5 → MarianaTrench theme, Lanternfish (Legendary) + Nautilus coin,
> Trench egg, Ocean milestones 70,000–120,000, companions Water Hen (hatch x0.85 while equipped, floats on the surface) and
> Swordfish (swims after the coins), their pass lines WaterHen / Swordfish (perks WaterHen1–3, Swordfish1–3), Voyage 8–9,
> CoinService reports which companion collected, a `Water` style part in every theme; V0.39, ROADMAP M3: gamepasses: GamePassService (ownership from Roblox at join, purchase prompt,
> "/pass" Studio command), ShopPanel + Shop side button, passes Third Companion Slot / x2 Ocean Points / Lucky / +50% Coins
> with their effects, a BUY button on locked quests, tools/pass-icons.js (resvg); portable workspace: SETUP.md, workspace.local.json, cross-platform MCP launchers in tools/mcp, npm run doctor, docs/agent-notes; V0.38, ROADMAP M2: species Catfish / Blue Tang / Baby Sunfish (Epic) with coins Chest / Sapphire /
> SunMedallion, Wreck and Atlantis eggs, rebirths 3–4 wired to the PirateWreck / Atlantis themes, Ocean milestones
> 5,000–40,000, Voyage quest line to Atlantis; V0.37, ROADMAP M0 foundations: shared/format.ts (T / Qa, MAX_MONEY), incubators per egg type,
> 12-egg shelf with arrows, on-demand fish templates (server/fishAssets, templates moved to ServerStorage), Ocean milestone
> kinds Incubator / VariantLuck / Cosmetic + scrolling list, quest stats / rewards / requiresPass, cosmetics.ts,
> gamepasses.ts (names only); V0.36, ROADMAP M1: Snail's Ocean upgrade x1.15, Pelican's x1.33 (every 7.5 s); V1 plan rev. 2 in BALANCE.md §5 with the owner's species, aquariums and companions, ROADMAP.md, tools/balance-v1-plan.js, tools/companion-sim.js; aquarium themes PirateWreck and Atlantis built for rebirths 3–4, not wired to REBIRTHS yet;
> UI V2 "arcade aquatic" applied to the whole UI: client/ui/kit.tsx, V2 tokens in theme.ts,
> design/ui/redesign-v2.figcraft, sprites in design/ui/v2; French Fish easter egg; rebirth-ready halo and reminder).

**The game.** An incremental aquarium game on Roblox. Each player owns one of 6 aquariums placed around a
beach lobby. They walk up to the glass to enter a 2.5D "focus" view. In that view they buy eggs, which hatch
into fish of various rarities. Fish drop coins the player clicks to collect, and must be fed (food costs
money). An unfed fish never dies: it turns weak (very slow) and only lets out 1 $ fart bubbles instead of its
coins. Around that core loop:

- a story / daily / weekly quest book;
- companions (the Snail picks up coins on the sand, the Swordfish in the water, the Pelican and the Jellyfish feed, the
  Water Hen speeds up hatching);
- fish variants: every hatch can be an Anomaly (10 %), a Ghost (5 %) or a Shiny (1 %), rarer and richer;
- a Fish Index (collection): one row per species, one column per variant;
- the Ocean: release fish (the player picks the kind and the variant) for Ocean Points, a progression score that
  unlocks milestones (50: the Pelican companion, 100: Snail speed x1.15, 200: a second companion slot, 500: the
  Pelican feeds x1.33 as often, every 7.5 s, 1,500: the tank holds 15 fish, 5,000: a second incubator, 8,000 / 25,000: 17 / 19 fish, 40,000: rare variants x1.5, 70,000: 21 fish, 85,000: the Water Hen, 120,000: the Swordfish, 180,000: 23 fish, 200,000: the Jellyfish, 300,000: Pearl rims, 450,000: 25 fish, 1,000,000: the Ocean Guardian title and a whale statue);
- events: recurring ones drawn by each server every 5–15 min (the abyssal raid: the world goes dark, a lantern
  fish steals coins) and admin ones started on every server (the K-pop music event); never during the tutorial;
- likes between players: a board beside each tank, a like doubles the owner's coins for 5 min;
- gamepasses, sold in the Shop panel (BALANCE.md §5.10, never part of the balance): Third Companion Slot, x2 Ocean
  Points (fish released / rebirths), Lucky (rare variants x2) and +50% Coins;
- rebirths: restart the run for a permanent coin multiplier and a new aquarium theme (8 levels: Lagoon, Neon Coral, Pirate Wreck, Atlantis, Mariana Trench, Volcanic Temple, Crystal Caverns, Cosmic Sanctuary); while one is
  affordable the Rebirth button pulses and a bubble reminds the player now and then;
- cosmetics: titles above the head (the best one earned: TitleService), decor in the tank (whale statue, golden
  trophy), Pearl rims;
- easter eggs: secret fish hidden in every egg (the French Fish, see §3.4), their own Fish Index category.

18 species (+ 1 secret), 12 eggs, 8 rebirths (the whole V1 plan, since V0.44). The game is fast at first and slows down strongly after the first hours: **`BALANCE.md`** holds the
expected progression (rebirth 1 ~28 min, six species ~1 h, rebirth 2 ~1h40, rebirth 3 ~3h01, rebirth 4 ~4h47, rebirth 6
~8h06, rebirth 8 ~10h54, all eighteen ~12h16), the numbers and the rules,
and the **V1 plan** (§5: 18 species, 12 eggs, 8 rebirths, a tank of 25 fish, the Water Hen / Swordfish / Jellyfish
companions with paid upgrade quests, a "Voyage" main quest line, ~12h15 to see everything; played by
`tools/balance-v1-plan.js`). **`ROADMAP.md`** is the development plan of V1 (milestones M0–M7, recipes for a species /
theme / companion / egg, the moderation watch list of the new designs). **`ROADMAP_V1.1.md`** is the plan after V1:
the animation revamp (Blender in the toolchain as a third MCP server driven by the agent, auto-rigged skeletons instead of EditableMesh, behaviour and companion
animations), steps A0–A8.

---

## 1. Tech stack & conventions

| Topic | Choice |
|---|---|
| Language | TypeScript compiled to Luau by **roblox-ts 3** (`noLib`: no Node/browser globals; use `task.*`, `math.random`, `os.clock`, `print/warn`, `.size()`) |
| Sync | **Rojo 7.7.1** (aftman). `default.project.json` maps `out/server` → ServerScriptService.TS, `out/shared` → ReplicatedStorage.TS, `out/client` → StarterPlayerScripts.TS, `out/first` → ReplicatedFirst.TS (loading screen). Never edit those scripts in Studio. A change to `default.project.json` needs `rojo serve` restarted (and the plugin reconnected) |
| Packages | `@rbxts/react` + `react-roblox` (UI), `@rbxts/t` (runtime validation), `@rbxts/janitor` (cleanup), `@rbxts/services`, `@rbxts/profile-store` (player saves, see §3.1) |
| Build / check | `npx rbxtsc` after every change; it must report zero errors |
| Workspace | Windows or macOS, set up from `SETUP.md`; `npm run doctor` checks a machine. Machine-specific values (install paths, GPU flags) only in the git-ignored `workspace.local.json` (via `tools/local-config.js`), never in committed files; scripts are cross-platform Node. npm scripts: `build`, `watch`, `serve` (rojo serve), `sim` (economy simulator), `doctor`. `jimp` 0.22 and `@resvg/resvg-js` 2.6 (SVG → PNG without FigCraft: tools/pass-icons.js) are devDependencies for the image tools |
| Framework | `shared/framework.ts`: singletons implementing `Lifecycle { onInit (sync), onStart (task.spawn) }`, registered in order in `server/main.server.ts` / `client/main.client.ts` |
| Server authority | The client only sends **intents**. The server validates each one with `t`, reads prices and odds from shared config, and owns money, inventory, timers and every gameplay state. Even fish positions are server-computed (swim segments): clients only render them, never report them |
| World ↔ code | Studio models are found by **CollectionService tags** (`shared/tags.ts`) and attributes, never by deep paths. Templates live in `ServerStorage.Assets` / `ReplicatedStorage.Assets` (fish, cloned by clients) in the place file, which Rojo does not manage: **remind the user to save the place** after MCP edits |
| UI | Designed first in **FigCraft** (`design/ui/redesign-v2.figcraft` for the V2 style, `design/ui/shopbar.figcraft` for older pieces and the icons), then translated to `@rbxts/react` in `src/client/ui/*.tsx`. Colours, fonts and asset ids live in `client/ui/theme.ts`. **V2 style ("arcade aquatic")**: build screens from `client/ui/kit.tsx` (Button3D, Plate, Card, HeaderBanner, CloseButton, ItemSlot, ProgressBar, Chip, CoinIcon, NotifBadge, Sparkle, SoftGlow, TextStroke, Outline); fonts `FONT_TITLE` (Luckiest Guy: titles, buttons, big numbers) and `FONT_BOLD` (Fredoka One: the rest), every text with a `TextStroke`, every surface outlined in `OUTLINE` (3 px); colours from `PALETTES` (light / base / dark / shadow per role: green action, gold buy, red confirm / close, blue / lagoon secondary, navy inactive) and `NAVY`. Relief = a container of face height + depth holding a Shadow (darker, `depth` px lower) and the Face (gradient light → base, gloss); a frame's AutomaticSize ignores scale-sized children, which is how `Plate` / `Card` / `Panel` keep their bevel under content-sized faces. Luckiest Guy's lowercase "s" reads like a 5: short labels mixing digits and letters ("+1s") use Fredoka. Text drawn over a `UIGradient` goes in a child TextLabel, otherwise the gradient tints it. Wrapped text inside a `Panel` gets a fixed height from `getWrappedHeight` (Panel.tsx), never AutomaticSize. **Popups never animate the scale of text**: re-rendered at every size, it wobbles. Panels, the onboarding card, the event banner and the reward window fade in at their final size (CanvasGroup `GroupTransparency`, with padding for their border stroke); only images (rays, eggs, fish, icons) pop with a UIScale |
| Style | English identifiers and comments; comments explain the *why*. UI text is in English, with **no emoji in texts** (the owner finds them too "AI"); emoji used alone as an icon are being replaced by drawn icons. Tabs, Prettier, eslint-plugin-roblox-ts |
| Gotchas | Luau reserved words can't be identifiers (`next`, `end`…). Don't use the `in` operator or `??` on a macro union (`map.get(x) ?? []` in a `for…of` fails). In Node edit scripts, `String.replace` treats `$$`, `` $` `` and `$&` specially: prefer `split().join()` or the Edit tool. **A function declaration is not hoisted with its value**: a module-level `const X = f()` above `function f` compiles to a call of nil (declare the function first) |

---

## 2. Annotated tree

```
ProjetQuarium/
├─ CLAUDE.md                 Project rules (read first), incl. "keep PROJECT_CONTEXT.md and RELEASE_NOTES.md up to date"
├─ SETUP.md                  New machine / OS: prerequisites (Node ≥ 20, aftman/rokit → Rojo, Studio + MCP, VS Code,
│                            Claude Code, FigCraft optional), install steps, machine config, what is shared vs local
├─ PROJECT_CONTEXT.md        This file
├─ RELEASE_NOTES.md          Every change of the game, patch by patch (V0.01, V0.02…), newest on top, never deleted
├─ BALANCE.md                The balance: expected progression (what after how long, why), species / eggs / rebirths /
│                            Ocean milestones tables, design rules, the V1 plan (§5), history. Updated with every economy change
├─ ROADMAP.md                V1 development plan: milestones M0 (foundations) → M7 (launch calibration) with checkboxes,
│                            recipes (species, aquarium theme, companion, egg), moderation watch list of the new designs
├─ ROADMAP_V1.1.md           After V1: the animation revamp (Blender skeletons instead of EditableMesh), steps A0–A8
├─ default.project.json      Rojo mapping (see §1)
├─ .mcp.json                 Project MCP servers (Roblox_Studio, FigCraft), started by `node tools/mcp/*.js` on any OS
├─ workspace.local.example.json  Template of workspace.local.json (git-ignored): this machine's FigCraft folder / port /
│                            wgpu backend, Studio MCP and Roblox fonts overrides; read by tools/local-config.js
├─ .gitattributes            LF everywhere (CRLF for .bat/.cmd), binaries marked; .gitignore keeps local config out
├─ docs/agent-notes/         The agent's shared working knowledge (owner preferences, asset pipeline, Studio MCP
│                            testing, lobby decor, moderation), index in its README; replaces the per-machine auto-memory
├─ design/ui/
│  ├─ shopbar.figcraft       FigCraft source of every UI (ShopBar, panels, eggs, tutorial bubbles, LikeBoard); fish
│  │                         pictures in it are the sticker icons (design/ui/fish/stickers)
│  ├─ redesign-v2.figcraft   UI V2 "arcade aquatic" (in the game since V0.33): UIKit_V2 (palette, 3D buttons normal /
│  │                         pressed, ribbon banners, square item slots, drawn side icons, Roblox mapping), HUD_V2,
│  │                         QuestPanel_V2, FishIndex_V2, Assets_V2 (the game's V2 sprites), ShopBar_V1 (hand-made in
│  │                         FigCraft, not by the build script: shelf arrows, incubator chip "1/2", gold "+"). Built by
│  │                         redesign-v2.build.js (node → JSON → `figcraft-cli run`; with a preview folder it exports
│  │                         the boards and the sprites, in the same session: the fonts Luckiest Guy / Fredoka One
│  │                         are loaded from the Roblox install and a separate render wouldn't have them)
│  ├─ passes/                Gamepass icons Pass_<GamePass>.png + Pass_Shop.png (512 px, no text) and _sheet.png (review),
│  │                         rendered by tools/pass-icons.js; ids in GAME_PASSES.image / V2_IMAGES.iconShop
│  ├─ v2/                    V2 sprites (2x PNG, ids in theme.ts V2_IMAGES): Icon_Quests / FishIndex / Ocean / Rebirth,
│  │                         RibbonTailLeft / Right (white + grey fold, tinted in game), Sparkle, SoftGlow
│  ├─ shopbar.build.js       Fish icons Guppy/Neon/RedTetra + shop bar (FigCraft command script)
│  ├─ fish.build.js          → design/ui/fish/*.svg: Clownfish / ZebraDanio / FlameGourami icons
│  ├─ fish/variants/         variant-spec.json (hue angles, uploaded texture ids) + the old flat variant icons
│  ├─ fish/stickers/         Icon_<Type>_<Variant>.png: the UI's fish icons (sticker style), ids in theme.ts FISH_ICONS
│  ├─ eggs.build.js          → design/ui/eggs/*.svg: egg sprites (whole, top/bottom halves, 3 cracks), Common → Volcano
│  │                         (FigCraft shopbar.figcraft frames at y 460: Amazon / NeonCoral x 1200-1800, Wreck / Atlantis
│  │                         x 2000-2700; imported, exported 2x, never saved there). Trench / Volcano (V0.40 / V0.42): PNG ×2 rendered with @resvg/resvg-js
│  │                         (200×240) instead of FigCraft
│  ├─ gate.build.js          Locked-gate icon of gated eggs
│  │  (SVG → FigCraft file.import → export PNG ×2 → upload_image (local http server) → ids in theme.ts)
│  └─ loading/               LoadingBanner.png (the user's beach banner) → LoadingBannerClean.png (baked bar erased)
│                            + LoadingTail.png (fish tail of the bar); ids in src/first/LoadingScreen.client.ts.
│                            FigCraft: LoadingScreen, TailSprite
├─ tools/mcp/                MCP launchers (Node, any OS; nothing on stdout): figcraft.js starts the FigCraft app with
│                            its control port if needed then `figcraft-cli mcp --attach`; roblox-studio.js finds Studio's
│                            MCP server (Windows mcp.bat / macOS StudioMCP / override); run-stdio.js shared stdio pass-through
├─ tools/local-config.js     Reads workspace.local.json (+ UPPER_SNAKE env overrides), finds the Roblox fonts folder
├─ tools/check-setup.js      `npm run doctor`: checks Node, packages, Rojo version, Studio MCP, fonts, FigCraft
├─ tools/economy-sim.js      Monte Carlo balance simulator (node): eggs, fish, variants, every rebirth, the capacity
│                            milestones; reports each step's median / p10 / p90, each species' discovery, Ocean
│                            milestones, income and Ocean Points per checkpoint. Keep it in sync with the config and copy
│                            its results into BALANCE.md. `--plan <file>` plays a planned economy instead (incubator and
│                            hatch-speed milestones, quest bonuses), `--players n`, JSON overrides (coinBoost / oceanBoost /
│                            hatchMult: gamepass estimates; SIDE_QUESTS; P.hoursPerDay: 1 by default, the reference player
│                            of 1 h a day and its daily / weekly coin boosts, 0 = one long session), the side lines (Hatchery, Collector, Ocean: SIDE_QUESTS) and when each is done
├─ tools/balance-v1-plan.js  The V1 plan played by the simulators (BALANCE.md §5): 18 species, 12 eggs, 8 rebirths,
│                            Ocean milestones to 25 fish, second incubator, Water Hen, story quest bonuses, Pelican x1.33,
│                            Snail x1.15, Jellyfish and Swordfish stages. Not in the game: becomes the config when V1 is built
├─ tools/player-stats.js     Real players vs the simulator (node, `npm run stats`, V0.47): lists and reads every profile of
│                            PlayerData_v1 through Open Cloud (robloxOpenCloudKey, read-only key; universe 10773319506),
│                            prints attendance, play time at each milestone (median / p10–p90 vs REFERENCE = BALANCE.md
│                            §2), coin pickup share (vs the simulator's 50 %), daily quests, devices; `--file dump.json`
│                            to test without the API, `--out` to keep a snapshot
├─ tools/companion-sim.js    AFK simulator (node): share of fish-time weak with a feeder (Pelican, planned Jellyfish) per
│                            tank size (mirrors CompanionService, FishService hunger, FoodService), share of coins a
│                            collector picks up per coin rate (Snail on the sand, Swordfish in the water: its live stages; the Jellyfish's live
│                            feeding stages after the Pelican's;
│                            CoinService); `--plan` adds the plan's companion stages and upgrades
├─ tools/fish-variant-recolor.js  Hue rotation of a species' texture + icon into its Anomaly / Shiny looks (pipeline in its header);
│                                optional tint [hue, saturation] for grey fish (Silver Angelfish); species without a flat
│                                icon get the texture only (their icons are the stickers)
├─ tools/pass-icons.js       Gamepass, Shop and Aquarium (side button) icons drawn as SVG in the V2 style, rendered to PNG with @resvg/resvg-js
│                            (no FigCraft needed) → design/ui/passes, plus a review sheet
├─ tools/fish-sticker-icons.js    Sticker icons from black / white Studio captures of a fish sheet (difference matting,
│                                outline, rim, shadow, shiny sparkles; pipeline in its header)
└─ src/
   ├─ first/                 ReplicatedFirst (runs before anything else replicates)
   │  └─ LoadingScreen.client.ts  Loading screen: banner + live fish-shaped bar; imports NOTHING (no ReplicatedStorage
   │                         yet), plain instances. Steps: game.IsLoaded → preload ReplicatedStorage.Assets models →
   │                         wait for the local "DataLoaded" attribute (UiController, first sync). 2.5 s min, 45 s max;
   │                         also waits for the artwork (≤ 8 s) and shows it ≥ 1.5 s, then fades
   ├─ shared/                Code + config used by both sides (ReplicatedStorage)
   │  ├─ framework.ts        Lifecycle + bootstrap
   │  ├─ format.ts           formatNumber ("1,234,567", from 1e12 "1.23T") / formatShort ("25K", "1.5M", "6.1B", "1.8T", "1Qa"):
   │  │                      UI and server messages (Luau's tostring breaks from 1e14); Panel.tsx re-exports them
   │  ├─ network.ts          Remote contracts + getRemoteEvent(name) (Remotes folder in ReplicatedStorage), FishView / FishMessage
   │  ├─ swim.ts             SwimSegment + getSwimPose: fish movement computed identically by server and clients
   │  ├─ tags.ts             CollectionService tags and the attributes they carry
   │  ├─ sounds.ts           Music id + SFX ids (played in 2D by AudioController; CoinStolen = the lantern's gulp; WeakBubble = a weak
   │  │                      fish's bubble; CoinCollect / CompanionCoin = the coin chime)
   │  └─ types/
   │     ├─ fish.ts          FishType, FishRarity (… Mythic, Secret = easter eggs), CoinType (… Croissant), HungerState
   │     │                   (Satiated/Hungry/Weak, no death), FISH_TYPES (income, interval, coin, rarity, oceanPoints,
   │     │                   cannibal?, growth, hunger, easterEgg?: EasterEggConfig {hatchChance, incomeShare, lifetime,
   │     │                   leaveMessage}), FART_BUBBLE_VALUE, growth helpers, FOOD_PRICE, DEFAULT_FISH_CAPACITY,
   │     │                   isEasterEgg, getFishIndexOrder
   │     ├─ eggs.ts          EggType, EGG_TYPES (price, hatchTime, odds, order, requires: the odds the UI shows),
   │     │                   getDrawOdds (+ easter eggs, taken from the most common fish), rollEgg, starter egg, balance notes
   │     ├─ variants.ts      FishVariant (Normal / Anomaly / Ghost / Shiny), FISH_VARIANTS (chance, coinRate,
   │     │                   specialOddsMultiplier, ghostCoins, sparkles, rank, oceanPointsMultiplier), VARIANT_ORDER,
   │     │                   GHOST_COIN_MULTIPLIER, RECOLOURED_VARIANTS, rollVariant, formatVariantChance(variant, luck), getOceanPoints, getSpecialCoinOdds,
   │     │                   getVariantIncomeMultiplier, balance notes
   │     ├─ playerData.ts    PlayerData shape + defaults + helpers (getTotalFish, getFishAndEggs, isEggUnlocked,
   │     │                   getHatchedVariant, getLivingVariant, getIncubating, hasFreeIncubator…), MAX_MONEY (1e15),
   │     │                   DEFAULT_INCUBATORS (1), getCompanionSlots (Ocean slots + the slot pass: use it, never
   │     │                   companionSlots alone), getHatchMultiplier (Water Hen equipped: 0.85, or its perk's), getPlayerVariantLuck (Lucky ocean x the Lucky pass:
   │     │                   EggService's draw and the chances shown by the Fish Index / egg reveal),
   │     │                   syncIncubationSpeed (rescales the incubating timers to a new hatch speed, progress kept;
   │     │                   run by DataService.sync, buyEgg and sanitizeSave; timers are server times, so the eggs
   │     │                   keep the speed they had at the disconnection while offline)
   │     ├─ companionStats.ts getCompanionStats(companion, data): what a companion does now with its own bonuses
   │     │                   (Ocean upgrades, its perks), the line under its ability on the companion card; player-wide
   │     │                   perks of its quest line (lasting / bouncy coins, Hearty meals) work without it: not shown
   │     ├─ customization.ts The player's aquarium choices (V0.48): ThemeChoice (a reached theme or "Auto"), TitleChoice
   │     │                   (a title earned, "Auto" = the best, "None"); getUnlockedThemes / getThemeOrder, getDisplayedTheme
   │     │                   (the chosen one if reached, else the newest), isHideable (Decor / Finish), isCosmeticShown (earned and
   │     │                   not in hiddenCosmetics), getDisplayedTitle
   │     ├─ cosmetics.ts     CosmeticId / COSMETICS (kind Title / Decor / Finish): the V1 titles, decor and Pearl rims;
   │     │                   PlayerData.cosmetics. Pearl rims shown since V0.42 (AquariumService); titles (TITLE_ORDER, getBestTitle:
   │     │                   TitleService) and decor (DECOR_SLOTS: tank-local position per decor id, isDecor: AquariumService) since V0.44
   │     ├─ gamepasses.ts    GamePass / GAME_PASSES (name, shop text, Roblox id, icon, badge "x2"…, shopOrder: the four
   │     │                   Shop passes; WaterHenPass 2057906427, SwordfishPass 2058734507, JellyfishPass 2061499264, sold
   │     │                   from their quest line, picture = the companion's sticker), getShopPasses, getPassById,
   │     │                   effects getPassCoinMultiplier (x1.5) / getPassOceanMultiplier (x2) / getPassVariantLuck
   │     │                   (x2) / getPassCompanionSlots (+1)
   │     ├─ quests.ts        QUESTS (Story1 Snail, Story2 Ocean, Story3–5 the Snail's line, Story6–8 the Pelican's line,
   │     │                   Story9 then Voyage1–16 the main "Voyage" line, WaterHen1–3 / Swordfish1–3 / Jellyfish1–3 the paid
   │     │                   companion lines, Hatchery1–5 / Collector1–6 / Ocean1–2 the free side lines (V0.46), Daily* /
   │     │                   Weekly* the board quests), DAILY_QUEST_POOL / WEEKLY_QUEST_POOL (6 each, 3 drawn per period),
   │     │                   STORY_LINES (Start / Ocean / Rebirth (shown "Voyage") / Snail / Pelican / Hatchery / Collector / WaterHen / Swordfish /
   │     │                   Jellyfish (the last three: requiresCompanion + requiresPass): quests in
   │     │                   order, requires (a quest),
   │     │                   requiresCompanion, order), refreshStoryLines(lines, companions), getActiveStoryQuests,
   │     │                   isStoryQuestDone, getStoryLine, isQuestLocked (line `requiresPass`: shown, never counted
   │     │                   nor claimed without the pass); stats: counters CoinMoney, CoinsCollected, FishFed (meals from
   │     │                   food the player dropped), LikesGiven, OceanPoints, EggsOpened,
   │     │                   VariantHatched {variant}, FishReleased, CompanionStat {companion} (Snail / Swordfish coins, Pelican / Jellyfish feeds,
   │     │                   eggs opened with the Water Hen equipped),
   │     │                   BOARD_UNLOCK_REBIRTHS / isBoardUnlocked (V0.48: dailies from rebirth 2, weeklies from 3);
   │     │                   gauges (GAUGE_STATS) FishInTank, MoneyHeld, SpeciesHatched {fishType}, Rebirths, IndexCells, SpeciesFound,
   │     │                   VariantFound {variant} (species found in it), TotalHatched (every fish ever hatched)
   │     │                   (species hatched at least once, easter eggs excluded: Master Aquarist);
   │     │                   rewards Money / Companion / Feature / Perk / IncomeMinutes / OceanPoints / Title / Decor;
   │     │                   daily/weekly periods (UTC)
   │     ├─ perks.ts         Perk (CoinLinger1 +1 s, CoinLinger2 +2 s, CoinBounce, FishSatiety +15 s full, PelicanDouble
   │     │                   2 pellets, PelicanCharges 2 charges, WaterHen1–3 hatch x0.78 / 0.72 / 0.65, Swordfish1–3 speed x1.4 / 1.8 /
   │     │                   2.2 + reach 2.5 / 3 / 3.2, Jellyfish1–3 3 charges every 6 s / every 5 s / 3 pellets), PERKS, COIN_BOUNCE_TIME (1.5 s), getGroundTimeBonus,
   │     │                   hasCoinBounce, getSatietyBonus, getPelicanPellets, getPelicanCharges, getPerkHatchMultiplier,
   │     │                   getSwordfishStats, getJellyfishStats
   │     ├─ companions.ts    CompanionType (Snail, Pelican, WaterHen, Swordfish, Jellyfish), COMPANION_TYPES (+ sticker `image`),
   │     │                   DEFAULT_COMPANION_SLOTS, PELICAN_FEED_INTERVAL, WATER_HEN_HATCH_MULTIPLIER (0.85), JELLYFISH_FEED_INTERVAL /
   │     │                   JELLYFISH_CHARGES / JELLYFISH_PELLETS (7.5 s, 2, 2)
   │     ├─ foodLooks.ts     FoodLook (Pellet, Shrimp), FOOD_LOOKS (min satiety bonus per look: 0, 15), getFoodLook:
   │     │                   the more a meal feeds (perks' satiety bonus), the more filling the food looks
   │     ├─ oceanRewards.ts  OCEAN_MILESTONES (id, points, title, description, reward: Companion / CompanionSlot /
   │     │                   CompanionUpgrade {companion, multiplier} / Capacity {capacity} / Incubator {count} /
   │     │                   VariantLuck {multiplier} / Cosmetic {cosmetics}), getOceanMilestone, hasClaimableOceanReward,
   │     │                   getCompanionMultiplier (Snail: speed, Pelican: feeding rate), getVariantLuck (from the claimed list)
   │     ├─ features.ts      Feature ("Ocean" and "Rebirth" by quest), FEATURES (drawn `image` per feature: quest
   │     │                   book, reward popup), MIN_FISH_KEPT
   │     ├─ events.ts        GameEventType (Kpop, Abyss), GAME_EVENTS: kind "Music" (bpm, beat coins) or "Abyss",
   │     │                   subtitle, optional musicId and coinMultiplier (Abyss x1.5), EVENT_ATTRIBUTES,
   │     │                   LURKING_ATTRIBUTE, TEST_EVENT_ORDER, getActiveEvent, getEventCoinMultiplier(owner); duration,
   │     │                   recurring flag, EventSource, getRecurringEvents, getRecurringChance (minutes 5–15),
   │     │                   EVENT_IMMUNE_ATTRIBUTE + isEventImmune (tutorial)
   │     ├─ rebirths.ts      REBIRTHS (price, multiplier, start money, theme), AQUARIUM_THEMES (Basic, Lagoon,
   │     │                   NeonCoral, PirateWreck, Atlantis, MarianaTrench, VolcanicTemple, CrystalCaverns, CosmicSanctuary: rebirths 1–8), getNextRebirth,
   │     │                   getRebirthMultiplier, getAquariumTheme, getRebirthOceanPoints, rebirth balance notes
   │     ├─ likes.ts         Like rules (1 per hour given, x2 coins for 5 min, restarted by each like), board offset, helpers
   │     ├─ onboarding.ts    Onboarding steps + rules (what is allowed / free at each step), ONBOARDING_REWARD,
   │     │                   STORY_QUEST_HINT_DELAY
   │     └─ aquarium.ts      Tank dimensions, getAquariumFrame, isInFocusZone (front-of-glass zone)
   ├─ server/
   │  ├─ main.server.ts      Registers services (order matters for onInit)
   │  ├─ templates.ts        loadTemplates(tag, attribute, keys) (Studio templates found by tag), scaleModel
   │  ├─ fishAssets.ts       FishAssets: on-demand fish templates. Species models and variant textures live in
   │  │                      ServerStorage.Assets.Fish / FishVariants; require(fishType, variant) copies them into
   │  │                      ReplicatedStorage.Assets.Fish / FishVariants before a fish's Spawn message, sweep(inUse)
   │  │                      (FishService, every 10 s) removes copies no tank used for 60 s
   │  ├─ admins.ts           isGameOwner / isAdmin (owner of the place or its group + ADMIN_USER_IDS), checked server-side
   │  ├─ saveData.ts         SaveData (profile: PlayerData + saved tank + stats), SavedFish, SAVE_TEMPLATE, sanitizeSave
   │  ├─ playerStats.ts      PlayerStats (V0.47, server only, never synced): sessions, days, play / tending seconds,
   │  │                      milestones {tending, play, days, at} ("Onboarding:<step>", "Rebirth<n>", "Species:<type>",
   │  │                      "AllSpecies", "Ocean:<id>", "Quest:<id>"; tending -1 = reached before the stats: `legacy`),
   │  │                      coins dropped / clicked / by a companion (count + value), meals by hand, quests claimed,
   │  │                      boost minutes earned, likes given, platforms, per-device fps / memory / swim budget,
   │  │                      testSpeed / testSpeedUsed ("/speed"), testNoPasses ("/passes off"); createPlayerStats, sanitizePlayerStats, getTestSpeed
   │  └─ services/
   │     ├─ DataService      ProfileStore sessions (load, auto-save, final save, onLoaded / onSave hooks), sync(),
   │     │                   notify(), registerAction() (sync() also runs syncIncubationSpeed), money/fish helpers, resetSave (wipe + kick, see DevCommandService)
   │     ├─ InteractionService  "Interact" remote: token bucket (10/s) shared by DropFood / CollectCoin
   │     ├─ AquariumService  Registers Studio tanks, assigns one per player, owner nameplate (base), runtime folders
   │     │                   (Fish/Food/Coins/Companions), focus reports ("SetFocus") + isTending / isAtOwnAquarium; themes by rebirth
   │     │                   and the Pearl rims finish (FinishPearlRims cosmetic: pearly F3ECF7 rims, Reflectance 0.3, any theme);
   │     │                   decor cosmetics (DecorTemplate models) cloned into the theme decor at DECOR_SLOTS, rebuilt when the
   │     │                   theme, the rims or the decor change
   │     ├─ FoodService      Drops / sinks food pellets (DropFood), price per pellet, max 10 per player; throwFood (free
   │     │                   pellet thrown from above by the Pelican: falls through the air onto the surface, then sinks) and
   │     │                   releaseFood (a pellet let go in the water by the Jellyfish: sinks straight down from it);
   │     │                   Food.byCompanion names the companion, so FishService's fed callbacks know who fed that fish);
   │     │                   look from the owner's satiety bonus (getFoodLook): Pellet = brown ball, others = clone of
   │     │                   a FoodTemplate MeshPart; random turn, then a slow 120° spin while sinking (CFrame tweens)
   │     ├─ CoinService      Spawns coin models (sinking, ground lifetime) and fart bubbles (spawnBubble: rise, pop at the
   │     │                   surface, 1 $), collection + credit, onCollected callbacks (with the companion that collected, if any), the coin
   │     │                   chime (playCoinSfx: CoinCollect climbs +6 % per click chained within 1.2 s, up to 8 steps, x1.2
   │     │                   for sparkling / ghost coins; a companion's pickups play CompanionCoin, softer, every 0.35 s at most),
   │     │                   findCoinToFetch / collectForOwner(owner, coin, companion) (Snail, Swordfish), clearOwner,
   │     │                   findCoinToSteal / isCoinAlive / stealCoin (lantern fish: no credit, red "-X$" popup)
   │     ├─ FishService      Fish as data only (no server model): swim AI as SwimSegments, hunger (weak, never dies),
   │     │                   growth, coins / farts, cannibal eating, releases, beat coins, AFK freeze; easter egg fish:
   │     │                   coin from getTankIncomePerMinute, leave after their lifetime (onFishLeft); replication to the
   │     │                   clients that watch each tank ("WatchAquariums" → FishSync messages); the quest coin boost
   │     │                   (runCoinBoost: PlayerData.coinBoostSeconds runs down only while the tank produces, coins
   │     │                   x QUEST_COIN_BOOST_MULTIPLIER in dropCoin; Player attributes CoinBoostSeconds / CoinBoostRunning)
   │     ├─ EggService       BuyEgg / OpenEgg: price, gating, incubation (up to PlayerData.incubators eggs per type, the
   │     │                   soonest opens first), draw (or forceNextHatch, Studio tests), variant with getVariantLuck,
   │     │                   quest stats EggsOpened / VariantHatched (+ CompanionStat WaterHen when it is equipped), hatch time ×
   │     │                   PlayerData.incubationMultiplier (the Water Hen's speed, applied live: see syncIncubationSpeed), reveal timing, then FishService.spawnFish;
   │     │                   isRevealing (a hatched fish not in the tank yet)
   │     ├─ OnboardingService  Drives onboarding steps from server facts; scripted first coin / first hunger; reward
   │     ├─ EventService     Events: recurring clock (per server), admin events ("/event <name>" / "/event stop",
   │     │                   admins only; MessagingService topic QuariumAdminEvent + MemoryStore hash QuariumEvents so
   │     │                   new servers join; never from Studio), keeps the players' EventImmune attribute. Music: beats on
   │     │                   server clock, guest fish per tank. Abyss: hands the LanternFish template to AbyssService.
   │     │                   "StartTestEvent" (Studio only: an admin event of that server)
   │     ├─ AbyssService     Abyssal raid: one lantern fish raid per owned tank, passes until the event ends, no cap (emerge
   │     │                   from the back, dart at the most valuable coin, steal it if still there, flee into the dark, despawn)
   │     ├─ CompanionService Equip / unequip, spawns equipped companions, Snail AI (3.6 studs/s, goes for the coin it can pick up
   │     │                   soonest: crawl time vs sinking time; picks coins up on the way, never pauses between them),
   │     │                   Ocean upgrades: Snail speed × getCompanionMultiplier (fetch + stroll),
   │     │                   Pelican AI (perched on the back rim near the left corner, looks around; every 10 s (÷ its
   │     │                   upgrade x1.33: 7.5 s), when its
   │     │                   owner tends the tank, done with the tutorial, turns to a hungry fish (FishService.
   │     │                   findHungryFishPosition) or a random spot, leans and throws a pellet from its beak;
   │     │                   PelicanDouble: 2 pellets 1.6 studs apart; PelicanCharges: on demand instead, up to 2
   │     │                   charges (start full, +1 per interval while not full), spends one at once when a fish is
   │     │                   hungry (FishService.hasHungryFish) and no food is in the water, never throws otherwise;
   │     │                   publishes them on the Pelican model: attributes Charges, MaxCharges, NextChargeAt (server
   │     │                   time, absent when full), ChargeInterval); Water Hen AI (floats on the surface, a quarter of
   │     │                   its height above it, bobs, paddles at 1.6 studs/s to spots in the front 45 % of the tank and
   │     │                   rests; its ability is EggService's); Swordfish AI (swims anywhere in the water toward the
   │     │                   coin findCoinToFetch picks with the surface as pickup height: 0.95 × the Snail's speed across
   │     │                   the tank, dives / climbs at 6 studs/s to follow a sinking coin, grabs within reach 2 (perks
   │     │                   Swordfish1–3: getSwordfishStats; the reach also covers the gap between a coin and the closest
   │     │                   point its body may go, against the glass / under the surface, like the Snail's), cruises at 2 studs/s otherwise); Jellyfish AI (drifts in the top 35 % of
   │     │                   the water at 1.1 studs/s; on demand like the Smart Pelican: charges refill every interval while
   │     │                   not full, one spent at once when a fish is hungry and no food is in the water: it swoops over
   │     │                   the hungriest fish and releases its pellets 1.4 studs apart; getJellyfishStats from its perks;
   │     │                   same charge attributes as the Pelican, shown by PelicanChargesController)
   │     ├─ QuestService     Progress from server stats (addProgress(stat, amount, subject {fishType, variant, companion});
   │     │                   reportGauges reads every gauge from PlayerData), claims, rewards (money / companion / feature /
   │     │                   perk / CoinBoost (adds to PlayerData.coinBoostSeconds) / IncomeMinutes: minutes × FishService.getTankIncomePerMinute (at least one fish of the best
   │     │                   species hatched) × rebirth multiplier / Ocean Points / title / decor), daily / weekly boards;
   │     │                   quests of a line whose pass isn't owned are skipped; a board not unlocked yet (isBoardUnlocked)
   │     │                   stays empty (the Daily / Weekly tab says at which rebirth it opens); an empty board of the current period is
   │     │                   drawn again (boards drawn before the pools were filled, V0.46)
   │     ├─ OceanService     ReleaseFish (+ Ocean Points), FinishTutorial (any feature's tutorial), credits an easter egg
   │     │                   fish that leaves on its own (points, popup, its leaveMessage)
   │     ├─ RebirthService   "Rebirth" intent (needs the "Rebirth" feature, quest "Saving Up"): fish to the ocean,
   │     │                   run reset, rebirths + 1, reward popup
   │     ├─ StatsService     Play statistics (V0.47, ROADMAP M7 calibration): every 1 s counts play / tending time (tending =
   │     │                   AquariumService.isTending + onboarding done: the simulator's play time) and stamps the
   │     │                   milestones reached; counts coins (CoinService.onSpawned / onCollected), meals (onFishFed),
   │     │                   quests (QuestService.onQuestClaimed), likes (onLikeGiven); "ReportClientStats" action (once a
   │     │                   minute: platform, fps, memory, swim budget; validated, ≥ 45 s apart). Creator Dashboard
   │     │                   (AnalyticsService, all in pcall): onboarding funnel, one-time "Progression" funnel
   │     │                   (Onboarding:Done, Rebirth1–8, AllSpecies), custom events MilestoneMinutes (field 1 = milestone,
   │     │                   2 = days), SessionMinutes / SessionMinutesInGame (platform), CoinPickupPercent (rebirth level),
   │     │                   DailyQuestClaimed / WeeklyQuestClaimed (quest id); legacy saves stay out of the funnels, and
   │     │                   the owner's test profiles (testSpeedUsed / testNoPasses) send nothing (the dashboard can't
   │     │                   delete an event; Studio playtests never send any anyway)
   │     ├─ CustomizationService  "SetAquariumTheme" (a reached theme or "Auto"), "SetCosmeticShown" ({id, shown}: an earned
   │     │                   decor / finish), "SetTitle" (an earned title, "Auto" or "None"): checks, then PlayerData's choices
   │     │                   (V0.48); AquariumService (getDisplayedTheme, isCosmeticShown) and TitleService apply them
   │     ├─ TitleService     Polls every 1 s: a BillboardGui "PlayerTitle" on each character's Head with their title (getDisplayedTitle: the one picked, else the best)
   │     │                   (getBestTitle; gold LuckiestGuy text, 4.2 × 0.65 studs, MaxDistance 120), removed without one
   │     ├─ GamePassService  The only writer of PlayerData.passes: at join (onLoaded) asks Roblox for each pass on sale
   │     │                   (UserOwnsGamePassAsync, 3 tries; no answer keeps the saved state; passes without an id are
   │     │                   dropped), grants a purchase from PromptGamePassPurchaseFinished (thank-you Reward),
   │     │                   "BuyGamePass" intent → PromptGamePassPurchase; a lost slot pass unequips the extra companion.
   │     │                   setTestPass for "/pass". The game's creator owns every pass of the game (Studio shows OWNED)
   │     ├─ LikeService      Places a like board beside each tank, GiveLike (range / own tank / cooldown), onLikeGiven (QuestService),
   │     │                   keeps each owner's boost in memory (getCoinMultiplier), publishes likes + boost as aquarium attributes
   │     └─ DevCommandService  Studio-only chat commands (a TextChatCommand created only when RunService.IsStudio(),
   │                         and only the place's owner may use it): "/datareset" asks, "/datareset confirm" within 15 s
   │                         empties the tank, wipes the save to the template and kicks (stop / start the playtest);
   │                         "/nextfrench": the next egg opened hatches a French Fish (EggService.forceNextHatch);
   │                         "/incubators <n>": incubators per egg type (1–4, saved: "/incubators 1" puts it back);
   │                         "/pass <GamePass>": gives / takes a pass for the session (the next join asks Roblox again);
   │                         "/boost <minutes>": sets the quest coin boost (saved: "/boost 0" clears it);
   │                         "/speed <x>": the owner's test speed (1–10, PlayerStats.testSpeed, saved so it also applies on
   │                         the published game; coins in FishService.dropCoin, hatch time in EggService, Ocean Points in
   │                         OceanService.credit and RebirthService x it: getTestSpeed); "TestSpeed" Player attribute → a red
   │                         "TEST SPEED x6" chip bottom right (App); the profile is then left out of npm run stats;
   │                         "/passes off|on": the owner plays without their passes (PlayerStats.testNoPasses, saved:
   │                         GamePassService.setTestNoPasses / refresh grant none), "NO PASSES" on the same chip
   └─ client/
      ├─ main.client.ts      Registers controllers
      ├─ fishLook.ts         getFishTemplate / cloneFishTemplate (undefined until the server replicated the species),
      │                      hasVariantLook, onFishAssetAdded, applyVariantLook (recoloured appearance, ghost
      │                      translucency, shiny particles), used by FishRenderController (and by the icon captures)
      ├─ controllers/
      │  ├─ UiController     Mounts React <App/> in PlayerGui.ReactUi; feeds it PlayerData; queues hatch reveals / rewards;
      │  │                   turns UI callbacks into RequestAction intents; sets the local "DataLoaded" player attribute;
      │  │                   preloads every fish and companion icon at start (the hatch reveal shows one instantly)
      │  ├─ HudController    Toast notifications (Notify remote; V2 navy toast, gold / red border)
      │  ├─ FocusController  Lobby ↔ 2.5D focus camera, back button (FocusUi: blue V2 3D button in plain instances,
      │  │                   Global ZIndex so its bevel sits under it), reports SetFocus; isFocused(), getOwnAquarium();
      │  │                   in the lobby, a "My aquarium" button at the same spot (FocusUi.GoToAquarium) puts the character
      │  │                   on the ground in the middle of its tank's focus zone, facing the glass, and enters the view;
      │  │                   "clarity" tween in the view: less atmosphere haze, clearer own GlassFront / Water (local only);
      │  │                   6 studs of headroom above the tank while one of the player's companions is perched (Pelican) or floats on
      │  │                   the surface (Water Hen)
      │  ├─ AquariumInteractionController  Clicks in focus view → CollectCoin (coin under cursor) or DropFood
      │  ├─ FishRenderController  Builds / moves the local fish models of the watched tanks (own tank in 2.5D, else
      │  │                   tanks within 160 studs of the camera) from FishSync segments; growth, weak tint, exits;
      │  │                   a fish whose model (or rare variant texture) hasn't arrived waits in `pending` (kept up to
      │  │                   date by Swim / State), built when the asset arrives, in its normal look after 5 s
      │  ├─ FishIndicatorController  Hunger / AFK badges above fish (from attributes)
      │  ├─ StatsReportController  Once a minute sends "ReportClientStats" (platform Touch / Keyboard / Gamepad / VR, average
      │  │                   fps of the minute, Stats.GetTotalMemoryUsageMb, the SwimTriangleBudget attribute) (V0.47)
      │  ├─ ShopKeeperController  The fisherman's shop (tag ShopKeeper): isNearby / onNearbyChanged (opens within 9 studs:
      │  │                   at the counter, not at the spawn ~13 studs away; closes beyond 12; the nearest of the huts), read by UiController → App `shopNearby` (opens / closes the Shop panel;
      │  │                   closed by hand it stays closed until the player comes back); turns him toward a player
      │  │                   nearby (yaw ≤ 55°) and makes him breathe (local PivotTo)
      │  ├─ CompanionAnimationController  Local wobble of the Water Hen (unwelds its own copy of the Mesh and places it on
      │  │                   the server-moved Body every frame: rocks side to side, faster and with a nod while it
      │  │                   paddles); the Jellyfish's bell pulses (squeeze ±10 %, a small bob and sway, mesh size
      │  │                   follows the server-scaled Body); the Swordfish is animated by FishAnimationController
      │  │                   (SWIMMING_COMPANIONS)
      │  ├─ PelicanChargesController  Charge gauge above the local player's on-demand Pelican (and Jellyfish, V0.42) (BillboardGui, local
      │  │                   child of its Body): one round slot per charge, a pellet when full, a pellet growing from
      │  │                   the centre while it refills, a pop when one is earned; hidden while MaxCharges is 0
      │  ├─ FishAnimationController  EditableMesh swim deformation, shared per species, with camera LOD (also the Swordfish companion);
      │  │                   rigs planned in triangles (budget lowered when the device refuses a mesh, built one at a time),
      │  │                   visible fish without a rig sway on a local Weld (V0.45)
      │  │                   (own tank in 2.5D; else tanks on screen within 110 studs; max 6 species) + beat puffs
      │  ├─ IncomePopupController  Floating "+X$" / "-X$" / "+X Ocean" billboards (MoneyPopup remote)
      │  ├─ AudioController  Background music, event music crossfade, SFX (PlaySfx remote or UI)
      │  ├─ OnboardingController  3D onboarding hints (floor marker, pointer over the frozen coin)
      │  ├─ CapacityPlaqueController  "n / capacity" plaque on the own tank
      │  ├─ MusicEventController  Follows the replicated event (any kind): its track if any; for music events, beat
      │  │                   detection, Kpop guest effects, onBeat listeners; getEvent / onEventChanged
      │  ├─ AbyssEventController  Abyssal raid visuals (local): world darkness (Lighting + AbyssGrade, put back after), abyss
      │  │                   backdrop SurfaceGui on every tank, navy water, marine snow + cold light, lantern lure light, red eye-socket glows and fades
      │  └─ LikeBoardController  Local SurfaceGui (React LikeBoard) on every like board + local "Like" ProximityPrompt;
      │                   getOwnBoostEndsAt / onOwnBoostChanged (own tank's boost, for the pill)
      └─ ui/                 React components (one FigCraft frame each)
         ├─ App.tsx          Root: top bar placement, side menus, panels, reveal / reward overlays
         ├─ theme.ts         Fonts (FONT_TITLE, FONT_BOLD), V2 tokens (OUTLINE, PALETTES, NAVY, VARIANT_PALETTES,
         │                   V2_IMAGES), asset ids (FISH_ICONS per type and variant, egg sprites), rarity / variant styles,
         │                   ocean / rebirth / event colours
         ├─ kit.tsx          UI kit V2 (FigCraft UIKit_V2): Button3D (pressable relief), Plate / Card (relief surfaces,
         │                   content-sized with autoHeight), HeaderBanner (ribbon title), CloseButton, ItemSlot (square
         │                   slot, silhouette / "?" when missing, sparkles when shiny), ProgressBar, Chip, CoinIcon,
         │                   NotifBadge, Sparkle, SoftGlow, TextStroke / Outline
         ├─ ShopBar / EggSlot / MoneyCounter  Egg shop: navy shelf of 6 square 3D slots coloured by state (buy, timer +
         │                   cracks + filling tag, OPEN!, FULL, gated, "Soon"), prices shortened (formatShort: 25K), then
         │                   the money pill with its coin. With more than 6 eggs (V1: 12), arrows on the shelf's sides move
         │                   the window one egg at a time (navy at the ends, red "!" when a ready egg is out of view); it
         │                   follows the best unlocked egg + the next gated one until moved. Several incubators: a slot shows
         │                   its soonest egg, a "n/N" chip and a gold "+" that buys one more (FigCraft ShopBar_V1)
         ├─ EggReveal        Hatch animation (rarity, odds (an easter egg's are never shown), "NEW!" first discovery)
         ├─ OnboardingPanel  Onboarding instruction card
         ├─ RewardPopup      Reward celebration (money / companion / feature)
         ├─ EventBanner      Running event banner (style per event kind: beat flashes / slow glow; FigCraft EventBanner,
         │                   EventBannerAbyss) + one Studio test button per event (TEST_EVENT_ORDER)
         ├─ SideButtons      Left menu (3D squares, icon + label inside the face): Quests, Companions (once one is owned), Fish Index, Ocean (once unlocked), Rebirth (no Shop since V0.41: the shop is the fisherman's hut; the aquarium's customization is the Customize button next to "My aquarium" / "Back to lobby")
         │                   (gold halo pulsing + "!" while affordable, "REBIRTH READY!" bubble driven by App: when it
         │                   becomes affordable, then every 4 min while it stays so, 8 s each) + coach bubbles
         │                   (Quests: story quest hint after the onboarding; Ocean: just unlocked) and the "AQUARIUM FULL"
         │                   reminder (FigCraft OceanFullReminder): App shows it when a ready egg is tapped with a full tank,
         │                   8 s, at most once every 3 min, never again in the session once a fish was released; on the
         │                   Ocean button, or on Quests ("claim Full House") while the Ocean isn't unlocked; skipped while
         │                   the Ocean's own "NEW" bubble is up or a panel is open
         ├─ Panel            Shared modal (backdrop closes): navy window with a bevel, ribbon title (`banner` palette)
         │                   over its top edge, round close button on its corner, `headerExtra` centred under the ribbon
         ├─ QuestPanel / CompanionPanel / FishIndexPanel / OceanPanel   The four menus (Quests: the card list grows up to 470 px,
         │                   then scrolls (V0.47); Fish Index: a scrolling
         │                   table, one row per species, one cell per variant (its sticker icon once found, else the species' dark silhouette + "?"; no count);
         │                   then the "EASTER EGGS" category: only the easter egg fish already hatched (nothing at all
         │                   before), Normal cell only, out of the "Discovered" count; hovering a column header or a cell
         │                   shows the variant's description under its header (VariantTooltip, VariantConfig.description); FigCraft FishIndexPanel_Variants. Ocean:
         │                   two columns (Panel `width`): left, one row per kind *and* variant in the tank, a rare variant's
         │                   Release asks "Sure?" (3 s); right, Ocean milestones (progress bar / CLAIM! / Claimed) in a
         │                   470 px scrolling list that opens on the first milestone not claimed (V1: ~17 of them);
         │                   FigCraft OceanPanel / Row_Variant / Milestone_Claimable / Milestone_Locked). Quest book: a quest
         │                   of a paid line without its pass shows "LOCKED: NEEDS THE <PASS>" instead of its progress bar,
         │                   and a purple BUY button (BuyGamePass) in place of CLAIM!
         ├─ ShopPanel        Gamepass shop: a 2x2 grid of cards (icon slot in the pass's colour + badge "x2" / "+50%"
         │                   drawn in game, name, text, button). Prices read on the client with GetProductInfo (cached for
         │                   the session): "R$ <price>", "SOON" when Roblox says off sale (or no id), "OWNED" (gold)
         │                   Opened by walking up to the fisherman's hut (App `shopNearby`, ShopKeeperController)
         ├─ LikeBoard        Face of a like board (likes, "a like = x2" hint or boost countdown), mounted by LikeBoardController
         ├─ RebirthPanel     Rebirth menu: multiplier hero, what is lost / earned (Ocean Points preview), progress, 2-click confirm
         ├─ Customize button  (App, V0.48) Pink Button3D with V2_IMAGES.iconAquarium right of FocusController's "Back to lobby" /
         │                   "My aquarium" (same baseline), in the lobby and the tank view, once a first rebirth or cosmetic is
         │                   earned: opens AquariumPanel
         ├─ AquariumPanel    Aquarium customization (V0.48, V2 kit): THEME cards (Automatic, then every theme in rebirth order:
         │                   THEME_PALETTES colour, the ones not reached locked with their rebirth; white ring = chosen),
         │                   DECOR & FINISHES cards with a SHOWN / HIDDEN switch, TITLE buttons (best / each earned / none, once
         │                   a title is earned); grows up to 470 px then scrolls
         ├─ LikeBoostPill    The owner's own boost ("Liked! Coins x2 4:32"), under the top HUD
         ├─ QuestBoostPill   The quest coin boost left ("QUEST BOOST x2 4:32", "PAUSED" when the tank doesn't produce), from
         │                   the CoinBoostSeconds / CoinBoostRunning attributes, under the like pill (V0.46)
```

**Studio-side (place file, not in Rojo):**

- **`Workspace.Lobby`**: 6 `Aquarium` models (Aquarium1–6 at x = −64 / 0 / 64, z = ±16). Each has a PrimaryPart
  `Base`, an `AquariumWater` part and the Studio `Decorations` (basic theme). The owner's nameplate is a SurfaceGui
  `OwnerPlate` that AquariumService adds on the Base's front face (brass, like the capacity plaque; disabled while
  the tank is free). Plus the beach decor, and since V0.41 two identical fishing huts, the shop, at both ends of the
  central aisle between the two rows of tanks: `FishingHutEast` (113, 0, 0), right behind the spawn, facing −X, and
  `FishingHutWest` (−113, 0, 0), facing +X. Each: `Hut` (generated driftwood shack, teal planks, counter window,
  13.9 × 16 × 13.8, anchored), `Fisherman` (generated shopkeeper in a yellow raincoat, 6.2 studs, raised behind the
  counter, no collision; tag `ShopKeeper`, PrimaryPart = its MeshPart), `SignAnchor` (a BillboardGui "SHOP" plate in the
  V2 pink). For them the `LobbySpawn` and its painted sun moved 8 studs west (x 100) and the `WelcomeSign` with its two
  tiki torches went to the north end of the promenade (108, 0, 64), facing the spawn.
- **`ServerStorage.Assets.Fish`** (moved from ReplicatedStorage on 2026-10-30, V0.37; tag `FishTemplate`, attr
  `FishType`; invisible root `Body` + welded `Mesh` with a SurfaceAppearance, head toward −Z): the server reads their
  size and copies a species into `ReplicatedStorage.Assets.Fish` while one swims on the server (server/fishAssets),
  the clients clone that copy. `ReplicatedStorage.Assets` is an empty folder in the place (Rojo ignores it), filled at
  runtime. The Golden Guppy's ColorMap is a 1024² copy (the generated one was 4096²: 64 MB for a tiny fish).
- **`ServerStorage.Assets.FishVariants`** (tag `FishVariantAppearance`, attrs `FishType` + `Variant`): one
  SurfaceAppearance per species for Anomaly and Shiny (recoloured ColorMap), copied on demand into
  `ReplicatedStorage.Assets.FishVariants` like the models. A game script can't set a texture, so
  FishRenderController swaps a clone of it in place of the template's.
- **`ServerStorage.Assets`**:
  - `Coins/` (tag `CoinTemplate`, attr `CoinType`; root `Hitbox` ×1.25);
  - `EventFish/` (tag `EventFishTemplate`, attr `EventType`): `KpopIdol` (Kpop), `LanternFish` (Abyss: generated
    anglerfish mesh tinted near-black (SurfaceAppearance Color), model scale 1.15, root `Body` 4.2×6.4×6.9, head −Z,
    welded parts lit / faded by the client: `Lure` (pale cyan Neon ball on the antenna tip) and per eye an `EyeShell`
    (glossy black ball, R 0.44, hiding the mesh's cartoon eye), a red Neon `Eye` iris and a black slit `Pupil`
    (SpecialMesh ellipsoids sunk into the shell, facing 20° forward of the side). Eye / Pupil glow with the lure);
  - `Companions/` (tag `CompanionTemplate`, attr `CompanionType`; root `Body` + welded `Mesh`, head −Z): `Snail`,
    `Pelican` (generated mesh, 3.6×6.4×6 studs), `Jellyfish` (V0.42), `Swordfish` (round blue-silver body, sail fin, short rounded bill,
    4.9×4.1×6.5) and `WaterHen` (round moorhen, red and yellow beak, 3.2×3.9×4.6), both generated (V0.40, texture as
    SurfaceAppearance); `Lobby/` (decor);
  - `Food/` (tag `FoodTemplate`, attr `FoodLook`; a single anchored MeshPart, its size is the food's): `Shrimp`
    (generated mesh, 0.46×0.95×0.82 studs, curled pink and white shrimp: food of the Hearty meals perk);
  - `LikeBoards/LikeBoard` (tag `LikeBoardTemplate`): driftwood lectern (scaled x1.8 in V0.41: 7.2 × 7.1 studs, board face
    6.5 × 4; the SurfaceGui density is BOARD_CANVAS_WIDTH / the Board's width, so it can be rescaled freely), PrimaryPart `Root` at ground level, front
    −Z, invisible `Board` part whose Front face carries the counter. LikeService clones it into each aquarium at
    `aquarium frame × LIKE_BOARD_OFFSET` (beside the front corner, outside the focus camera's frame);
  - `AquariumThemes/<Theme>` (tag `AquariumThemeTemplate`, attr `Theme`): PrimaryPart `Origin` = the tank frame,
    `Style/` parts named like the tank's (Sand, Backdrop, Base, Plinth, Rim*, and since V0.40 `Water`: every theme has
    one, the old ones with the tank's default 288cdc / 0.8 so a tank changing owner gets its water back; look + children such as the Lagoon's
    painted backdrop SurfaceGui copied onto the tank), `Decor/` cloned into the tank (all CanQuery off). `Basic` =
    the original look (the tanks' Studio `Decorations` are removed at runtime); `Lagoon` = rebirth 1: light sand,
    teal plinth, gold rims, painted backdrop, sandcastle / coral / rocks / starfish / shells (lobby props scaled down),
    thin sea grass, pebbles, bubbler. Decor stays low along the back and the sides: fish and coins stay visible.
- **Rebirth 2 content** (2026-10-29): fish `SilverAngelfish` (5 × 6.5 studs, 4.1k vertices), `PirateFish` (4.2 × 4.9,
  3.6k, round), `ImperialDiscus` (5.8 × 5.1, 4.2k), with their `FishVariants` (Anomaly, Shiny); textures 512², except
  the Pirate's generated 1024² one (one upload less); coins `PearlShell` (CoinType Pearl), `RubyGem` (Ruby),
  `RoyalCrown` (Crown), mesh rotated so the generated front faces the glass, Ruby / Crown tinted by SurfaceAppearance
  Color like the Gold coin; theme `NeonCoral` (rebirth 2; clone of the Lagoon's layout: Neon cyan rims, Neon magenta
  plinth, indigo sand, `NeonReefPainting` backdrop SurfaceGui, corals with PointLights, `GlowPebbles` Neon balls, Bubbler).
- **Rebirth 3–4 content** (2026-10-30, V0.38): fish `Catfish` (corydoras-like, beige with dark spots and red fins, 4 short
  whiskers hanging under the chin, 3.4 × 3.3 × 6.5 studs), `BlueTang` (2 × 3.6 × 5.6), `BabySunfish` (round, pale with
  pastel spots, 2.2 × 5 × 5.5), generated meshes (≤ 4,000 triangles), Normal / Anomaly / Shiny textures re-uploaded
  at 512² (ids in design/ui/fish/variants/variant-spec.json); coins `TreasureChest` (CoinType Chest, generated grey,
  tinted gold), `SapphireGem` (Sapphire), `SunMedallion` (mesh turned -90° on X so the sun face looks at the glass,
  tinted gold like the Crown).
- **Rebirth 3–4 themes** (2026-10-30, wired to REBIRTHS 3–4 since V0.38). Props are
  generated meshes (texture as SurfaceAppearance, tinted by its Color), the backdrops are SurfaceGuis drawn with Frames
  only (no uploaded image). `PirateWreck` ("Sunken Pirate Wreck"): dark wet sand, dark wood base / plinth, rusty brass
  Metal rims, `WreckPainting` (green-blue water, light rays, sunken ship silhouette, rocks, bubbles); decor: sunken
  rowboat `Hull`, fallen `Mast` with its torn sail, `Chest` (PointLight) with `Loot` (Foil gold coins, pearls),
  iron-tinted `Anchor`, `Wheel`, `Crates`, darker sea grass, `Stones`, Bubbler. `Atlantis` ("Atlantis Ruins"): pale
  sand, Marble base, Neon turquoise plinth, gold Metal rims, `AtlantisPainting` (domes, towers, colonnades, a golden
  dome, glowing windows); decor: marble `Arch` on `Steps`, two standing `Column`s, three `FallenColumn` pieces,
  `Crystal` (turquoise PointLight) in a ring of Neon `GlowTiles`, marble slabs with round Neon inlays, Lagoon corals and
  sea grass, gold / marble `Pebbles`, Bubbler. Deliberately absent (CLAUDE.md §7): cannons, skulls / Jolly Roger,
  swords, bottles / barrels, trident, faces, torches; inlays are discs, not crosses.
- **Rebirth 5 content** (2026-10-31, V0.40): fish `Lanternfish` (slim midnight-blue body, rows of glowing cyan
  photophores, no lure; 2.6 × 2.5 × 6 studs, generated 1024² texture kept as Normal), `FishVariants`
  `Lanternfish_Anomaly` (crimson) / `_Shiny` (gold) at 512²; coin `NautilusShell` (CoinType Nautilus, white and teal
  spiral shell, a clone of the SunMedallion template with its mesh swapped). Theme `MarianaTrench` ("Mariana
  Trench", rebirth 5): blue-grey sand, Basalt base, Neon cyan plinth, steel Metal rims, darker `Water` (164c86 / 0.72),
  `TrenchPainting` backdrop (deep-blue gradient, light shafts, two layers of dark ridges, glowing cyan / violet dots);
  decor: generated columnar `Basalt` rock clusters (back corners, sides, back middle), three `GlassSponge`s, three
  glowing `Anemone`s, Bubbler. Deliberately absent (CLAUDE.md §7): hydrothermal vents (smoke), bones.
- **Rebirth 6 content** (2026-10-31, V0.42): fish `Lionfish` (red and white stripes, frilly dorsal fin, no spines, 2.9 ×
  3.6 × 5.6) and `Dragonfish` (long body with a red crest, SurfaceAppearance Color 1/0.85/0.45 so it reads gold, 1.8 ×
  2.9 × 6.6; any "dragon" prompt gave an upright seahorse-like creature: picked among 6 tries), both with Anomaly / Shiny
  FishVariants; coins `CoralFanCoin` (CoinType CoralFan) and `DragonScaleCoin` (DragonScale), clones of the SunMedallion
  template, tinted; companion `Jellyfish` (pink-violet bell, wavy tentacles, 3.5 × 4.6 × 3.1). Theme `VolcanicTemple`
  ("Volcanic Temple", rebirth 6): grey-brown sand, Basalt base, Neon orange plinth, Slate rims, warm `Water` (6e3c34 /
  0.78), `VolcanoPainting` backdrop (red-to-black gradient, low warm glow, dark ridges with orange veins, glow specks);
  decor: generated `TempleArch` (glowing carvings) on two Slate `Steps`, the Mariana basalt clusters tinted warm dark
  (SurfaceAppearance Color 110/72/62), flat Neon `MagmaVeins` on the sand, Bubbler. Deliberately absent (CLAUDE.md §7):
  flames, torches, smoke, round objects next to the glow (a generated "magma rocks" mesh looked like a campfire: dropped).
- **Rebirths 7–8 content** (2026-11-01, V0.44): fish `WolfDogfish` ("Husky Dogfish": round blue fish with a husky face,
  4.6 × 4.65 × 6; the wolf-head-on-a-shark versions read as sharks), `BunnyShark` (pink shark with bunny ears, wavy
  smile, no teeth, 5 × 4.9 × 6; replaces the Hammerhead: every hammerhead prompt put the hammer on top of the head) and
  `MiniLeviathan` (crested baby sea serpent: the mesh came out upright, so it is pitched −30° about X inside the
  template; 2.6 × 6.9 × 6.4), all with Anomaly / Shiny FishVariants; coins `MoonCoin` (Moon), `StarCoin` (Star),
  `PlanetCoin` (Planet), clones of the SunMedallion template; decor `Assets.Decor` (tag `DecorTemplate`, attr
  `Cosmetic`, PrimaryPart Mesh): `WhaleStatue` (DecorWhaleStatue), `GoldenTrophy` (DecorGoldenTrophy, gold tint) and
  `Incubator` (DecorIncubator, V0.46: a generated gem-rimmed nest with a spotted egg, 3 × 2.9 × 3, SurfaceAppearance tinted gold).
  Theme `CrystalCaverns` ("Crystal Caverns", rebirth 7): lavender sand, Slate base, Neon violet plinth, Slate rims,
  blue-violet `Water` (3a4f9a / 0.78), painted cave backdrop (stalactites, glowing crystals); decor: basalt tinted
  violet, crystal clusters tinted cyan / pink / violet with PointLights. Theme `CosmicSanctuary` ("Cosmic Sanctuary",
  rebirth 8): pale sand, Neon gold plinth, gold Metal rims, deep indigo `Water` (2c2a6e), painted nebula backdrop with
  stars and two ringed planets; decor: floating basalt stones with Neon geometric runes (diamonds and bars, no
  letters), gold / violet crystals, Neon sand stars. Deliberately absent (CLAUDE.md §7): alien faces.
- **Easter egg content** (2026-10-30): fish `FrenchFish` (4.2 × 4.6 × 4.4 studs, round, beret / Breton shirt / red
  scarf / baguette on its back, generated 1024² texture, no FishVariants), coin `CroissantCoin` (CoinType Croissant,
  mesh tilted −50° on X so the crescent faces the glass, SurfaceAppearance Color 1/0.86/0.55 so it reads golden, not
  like the pink Shrimp food). Sticker `design/ui/fish/stickers/Icon_FrenchFish_Normal.png`: front three-quarter view
  (yaw 60°), so the scarf reads as a scarf (in pure profile it is a red tube at mouth level, see CLAUDE.md §7).
- `Workspace.StreamingEnabled = true`. All tanks are within ~130 studs of each other, so streaming does not cull them.

---

## 3. Data & events flow

### 3.1 Player state

- **Saving (ProfileStore).** `DataService` opens one profile per player (store `PlayerData_v1`, key
  `Player_<UserId>`), holding a `SaveData` (`server/saveData.ts`): `player` (the PlayerData below, synced to the
  client), `tank` (the fish: type, adult scale, age, hunger, variant — undefined = Normal in older saves) and `stats`
  (V0.47: the play statistics, `server/playerStats.ts`, never synced; read offline by `npm run stats`). On load: `Reconcile()` (fields added to
  `DEFAULT_PLAYER_DATA` since), then `sanitizeSave` (drops ids removed from the config, restarts the story where it
  was). A failed load kicks the player (never play on unsaved default data). `getData` is undefined until loaded:
  actions sent before are ignored.
- **When it saves.** Auto-save every 60 s (`AUTO_SAVE_PERIOD`, the most a server crash can lose), on leave
  (`EndSession`) and on shutdown (ProfileStore's BindToClose). The session lock prevents two servers from using the
  same profile (the older one ends its session and kicks the player). Right before each save, `onSave` hooks write
  runtime state into the profile: FishService writes the tank (also in its own PlayerRemoving, before cleaning up).
- **Restoring.** `onLoaded` hooks: FishService waits for the aquarium, then respawns `PlayerData.fish` (the count
  is the authority) using the saved fish for age / size / hunger (extra ones are newborn). Companions come back
  through CompanionService's refresh loop, the onboarding resumes at its saved step (its timers restart), eggs keep
  their absolute hatch time. Not saved: coins and food in the water, the frozen onboarding coin (dropped again).
- **Offline rules.** Eggs keep incubating offline (absolute hatch time), at the speed they had at the disconnection
  (a Water Hen left equipped keeps working). A like boost is lost when its owner leaves.
  Nothing else moves: no offline income or
  coins, and hunger and growth are frozen (saved as time left / age, like the AFK freeze). Events live on
  each server (ReplicatedStorage attributes) and are never saved: a player who rejoins gets whatever event that server
  is running (an admin event runs on every server).
- **Adding a PlayerData field**: add it to `PlayerData` and `DEFAULT_PLAYER_DATA` (Reconcile fills it in old saves);
  validate it in `sanitizeSave` if it holds ids. Never make an existing field `undefined` on purpose: Reconcile
  would put the default back (that's why the last story quest stays, claimed). State that lives in a service
  (like the tank) goes in `SaveData` through `onSave` / `onLoaded`.
- Every mutation goes through a service and ends with `DataService.sync(player)`. That fires **`SyncPlayerData`**
  with the full snapshot, and `UiController` re-renders `<App/>` from it.
- `PlayerData` fields:

  | Field | Content |
  |---|---|
  | `money` | Current money, never above `MAX_MONEY` (1e15: DataService.addMoney clamps, sanitizeSave too) |
  | `fish` | Count of living fish per type |
  | `fishVariants` | Of those, per type, the living rare variants (normal = fish − these; `getLivingVariant`). DataService keeps it (hatch / removal), RebirthService clears it, `sanitizeSave` rebuilds it from the tank the way restoreTank picks saved fish |
  | `hatched` | Count ever hatched, per type (Fish Index) |
  | `hatchedVariants` | Of those, per type, the rare variants (no `Normal` key: normal = hatched − these; `getHatchedVariant`) |
  | `incubating` | Per egg type, the hatch times of its eggs (soonest first, at most `incubators`). Saves with one number per type are migrated by `sanitizeSave` (sanitizeIncubating) |
  | `incubators` | Eggs of the same type that can incubate at once (1; Ocean milestone kind `Incubator`), kept through rebirths |
  | `incubationMultiplier` | Hatch speed the `incubating` timers run at (1, or the Water Hen's 0.85 / perk's): `syncIncubationSpeed` rescales them when `getHatchMultiplier` changes, the progress made is kept |
  | `eggsBought` | Eggs bought per type (unlocks the next egg) |
  | `onboarding` | Current onboarding step |
  | `capacity` | Max living fish in the tank |
  | `quests` | `{lines, daily, weekly}`: `lines` = current quest per open story line (a finished line keeps its last quest, claimed). Saves with the old single `story` are migrated once in `sanitizeSave` (migrateStory; runs even though Reconcile already filled `lines` from the template) |
  | `companions`, `equippedCompanions`, `companionSlots` | Owned companions, equipped ones, slots |
  | `oceanPoints` | Ocean score (only grows) |
  | `oceanRewardsClaimed` | Ocean milestones claimed (kept through rebirths) |
  | `features`, `tutorialsDone` | Unlocked features, and those whose tutorial was seen |
  | `likesReceived`, `lastLikeGivenAt` | Likes received, last like given (cooldown, server time). The boost itself is not saved |
  | `themeChoice`, `hiddenCosmetics`, `titleChoice` | The aquarium choices (V0.48, shared/types/customization): theme worn ("Auto" = the newest reached), earned decor / finishes hidden (everything earned shows by default), title shown ("Auto" = the best, "None") |
  | `coinBoostSeconds` | Quest coin boost left (daily / weekly rewards, V0.46): adds up, runs down only while the tank produces (FishService.runCoinBoost), kept through rebirths |
  | `rebirths` | Rebirths done: coin multiplier and aquarium theme |
  | `perks` | Permanent quest bonuses (shared/types/perks), kept through rebirths |
  | `cosmetics` | Titles, decor and finishes earned (shared/types/cosmetics), kept forever |
  | `passes` | Gamepasses owned: written only by GamePassService from Roblox (checked again at each join; "/pass" in Studio). Read by FishService (coins x1.5), OceanService / getRebirthOceanPoints (x2), EggService (luck x2), getCompanionSlots (+1) |

### 3.2 Client → server (intents only)

| Remote | Name / payload | Handled by |
|---|---|---|
| `RequestAction` | `BuyEgg` / `OpenEgg` (EggType) | EggService |
| | `SetFocus` (boolean) | AquariumService |
| | `RequestSync` | DataService |
| | `ClaimQuest` (quest id) | QuestService |
| | `ReportClientStats` ({platform, fps, memoryMb, swimBudget}, once a minute) | StatsService (statistics only) |
| | `SetAquariumTheme` (theme or "Auto"), `SetCosmeticShown` ({id, shown}), `SetTitle` (title, "Auto" or "None") | CustomizationService |
| | `EquipCompanion` / `UnequipCompanion` (CompanionType) | CompanionService |
| | `ReleaseFish` ({fishType, variant}), `FinishTutorial` (Feature), `ClaimOceanReward` (milestone id) | OceanService |
| | `StartTestEvent` (GameEventType, **Studio only**) | EventService |
| | `WatchAquariums` (PlotIndex[], ≤ 6, debounced 0.25 s): only changes what this client receives | FishService |
| | `GiveLike` (PlotIndex, from the board's prompt) | LikeService |
| | `Rebirth` (no payload) | RebirthService |
| | `BuyGamePass` (GamePass): shows Roblox's prompt; the pass itself comes from Roblox | GamePassService |
| `Interact` (rate-limited) | `DropFood` (Vector3) | FoodService |
| | `CollectCoin` (coin hitbox) | CoinService (must stand at own tank) |

New actions: `DataService.registerAction(name, tCheck, handler)` on the server, then a callback in `AppProps` →
`UiController` that fires `RequestAction`. Document them in `network.ts`.

### 3.3 Server → client

| Remote | Content | Consumer |
|---|---|---|
| `SyncPlayerData` | Full PlayerData | UiController (+ CapacityPlaque…) |
| `Notify` | `(message, "info"\|"warning")` | HudController toast |
| `EggHatched` | `{eggType, fishType, variant, firstTime}` (first of that type *and* variant) | UiController → EggReveal (the server drops the fish after `HATCH_REVEAL_TIME`) |
| `Reward` | `{title, subtitle, amount, item?: {icon, name, image?}}` | RewardPopup (after any reveal; shows `image` when given) |
| `MoneyPopup` | `{position, amount, special, ocean?, stolen?, ghost?}` | IncomePopupController |
| `PlaySfx` | `(SfxName, pitch)` | AudioController |
| `FishSync` | `FishMessage`: `Tank` (full state of a newly watched tank), `Spawn`, `Swim` (new segment), `State` (hunger, growth, paused), `Remove` (Eaten / Released / Gone) | FishRenderController |

**Replicated state outside remotes:**

- **Tag / attribute replication:** `Coin` hitboxes carry `Special`, `Frozen`, `Bubble` and `Ghost`. `Companion` models carry `Owner` and `CompanionType`.
  `EventFish` models carry `EventType` (the lantern fish also `Lurking`: true while hidden in the dark). Tanks carry `OwnerUserId`, plus `Likes` and `LikeBoostEndsAt` once their
  owner's data is loaded, and `Theme` (the AquariumTheme they wear). `LikeBoard` models carry `PlotIndex`.
- **Events:** ReplicatedStorage attributes `EventType`, `EventStartsAt`, `EventEndsAt` and `EventSource`
  ("Recurring" / "Admin") (`EVENT_ATTRIBUTES`), with beats computed from `Workspace.GetServerTimeNow()`. Players carry
  `EventImmune` (true until loaded and while in the tutorial; absent = immune).
- **Fish movement:** nothing is replicated per frame. Each SwimSegment (start pose, target, start time, turn / move
  durations) is sent once to the watchers of the tank, and both sides evaluate
  `getSwimPose(segment, Workspace.GetServerTimeNow())`. `Fish` models are client-local (attributes `FishId`,
  `FishType`, `Variant`, `Hunger`, `GrowthStage`, `Paused`, `Dead`). `FishView` carries the `variant`. Companions, event guests, coins and food are still server
  parts moved by server tweens.

### 3.4 Key flows

- **Egg.** The player buys an egg: `BuyEgg` → the server checks that an incubator of that type is free
  (`hasFreeIncubator`), the price and the gate, debits the money and starts the incubation (pushed into the type's
  sorted list). Once the timer ends, the player opens it: `OpenEgg` → the server takes the soonest egg of the type,
  checks it is ready and the capacity, draws the fish and bumps `fish` and `hatched`. It then fires `EggHatched` and, after the reveal,
  `FishService.spawnFish`, which runs the `onFishSpawned` callbacks (onboarding, quest gauges).
- **Variants.** At `OpenEgg`, after the species, `rollVariant` draws Shiny 1 % → Ghost 5 % → Anomaly 10 % → Normal
  (the onboarding egg is always Normal). `hatchEgg` counts it in `hatchedVariants`, `EggHatched` carries it (reveal:
  "You hatched a Shiny Clownfish!", a "SHINY • 1%" line, rays in the variant's colour) and `spawnFish` keeps it
  on the entity (saved with the tank). Effects, server-side: Anomaly drops coins 1.2× as often; Ghost's sparkling
  coins become ghost coins (translucent, wisps, worth `GHOST_COIN_MULTIPLIER` = 3 sparkling ones, pale popup);
  Shiny has the anomaly pace and one sparkling coin out of 5 instead of 15. Income vs a normal fish: +20 % / +25 %
  / +35 % (+3.6 % on average: rebirth 28.9 → 27.7 min, six species 61.5 → 58.2 min; prices untouched, see
  variants.ts). Looks, client-side: Anomaly / Shiny wear their FishVariantAppearance, a ghost turns 50 % translucent
  and pale, a shiny twinkles like a sparkling coin. The Ocean releases the variant the player picks; a rebirth still
  sends every fish, variants included, to the ocean (rare ones worth more Ocean Points). A variant fish whose owner
  leaves during its hatch reveal comes back as a newborn normal one (the tank is saved before it spawns).
  New species: run tools/fish-variant-recolor.js, upload, add the two FishVariantAppearance and the icons in theme.ts.
- **Easter eggs (the French Fish).** `OpenEgg` draws with `getDrawOdds`: every egg hides each easter egg fish at
  its `hatchChance` (0.1 %), taken from the egg's most common fish; the shop, the index and the reveal only ever show
  `EGG_TYPES` odds (the reveal shows just "SECRET"). It hatches Normal (no variant roll), counts as a fish of the tank
  (capacity, saves, releases, rebirth points). Its coin, every 60 s, is a croissant worth `incomeShare` (0.5) of
  `FishService.getTankIncomePerMinute` (the other fish: income/s × growth × variant income, sparkling coins on average,
  × 60), then the usual rebirth / like / event multipliers; it sparkles 1/15 (x2). Its stay is its age (`bornAt`,
  pushed back while frozen and saved as age, so offline and paused time don't count): at `lifetime` (1 h) `tick`
  removes it ("Released" exit) and `onFishLeft` lets OceanService credit its Ocean Points (100) with the popup and a
  notice ("went off to join a protest"). Released by hand or at a rebirth like any fish.
- **Coins.** `FishService.tick` (every 0.25 s) calls `dropCoin`, which uses `CoinService.spawnCoin`; the coin sinks
  and expires 5 s after reaching the sand. A coin is collected by a click (`CollectCoin`) or by the Snail / the Swordfish, and
  `credit()` then adds the money, fires `MoneyPopup` and runs the `onCollected` callbacks (quests, onboarding).
- **Hunger.** A fish goes Satiated (30 s) → Hungry (15 s) → Weak (until fed; it never dies). A weak fish swims at
  35 % speed, is tinted dull on the client and, at its coin interval, farts a bubble instead of a coin
  (`CoinService.spawnBubble`: 1 $, rises and pops; "WeakBubble" SFX (an underwater blub, the fart sound until V0.42) at most every 2.5 s per player, "FishWeak" SFX and a
  notice at most every 30 s). The player clicks the water (`DropFood`) to drop a pellet that costs money; a fish
  chases it and eats it, which resets it to Satiated. Species flagged `cannibal` eat smaller fish when weak (none yet). Hunger, growth and coins all stop while
  the owner is AFK (not tending) or still in the onboarding.
- **Quests.** `QuestService.addProgress(stat, amount, subject)` handles counters (`CoinMoney`, excluding the onboarding
  coin; `CoinsCollected` (every coin, by hand or by a companion); `FishFed` (FishService.onFishFed without a companion);
  `LikesGiven` (LikeService.onLikeGiven); `OceanPoints`; `EggsOpened` and `VariantHatched` from EggService.openEgg;
  `FishReleased` from OceanService's releases; `CompanionStat` with the companion): a quest with a `fishType` / `variant` / `companion` only counts its own.
  `reportGauges` reads every gauge from PlayerData (`FishInTank`, `MoneyHeld`, `SpeciesHatched`, `Rebirths`,
  `IndexCells`, `SpeciesFound`, `VariantFound`, `TotalHatched`) on each coin, spawn, claim, rebirth and every 5 s: a gauge quest already met completes as it opens.
  A line with `requiresPass` opens like the others, but its quests count nothing and can't be claimed without the
  pass (`isQuestLocked`; PlayerData.passes). A completed quest gets a notification and a badge;
  the player then sends `ClaimQuest`, which grants the reward (money, companion via CompanionService, or feature
  via `DataService.unlockFeature`, or perk). **Story lines run in parallel** (STORY_LINES): each open line has one current
  quest, all shown in the Story tab with a line tag; claiming one starts its line's next quest (the last one stays,
  claimed, and a quest added later to the line starts on the next join) and opens the lines that `requires` it
  (`refreshStoryLines`, also run on load). Lines: Start (Story1 "Coin Collector", 300 $ → the Snail), then, all
  opened by Story1, Ocean (Story2 "Full House", 10 fish → the Ocean), Rebirth (Story9 "Saving Up": gauge `MoneyHeld`,
  the most money held at once while active, reported on every coin and every 5 s; 5,000 $ = REBIRTHS[0].price,
  written out because rebirths.ts can't be imported by quests.ts → the "Rebirth" feature; saves that already had the
  feature get Saving Up done on load, and only it), then the Voyage quests (gauges: a goal already met completes as the
  quest opens): Freshwater Finds (a Flame Gourami → 5 min of income), Deeper Waters (rebirth 2 → 500 Ocean Points),
  Crown of the Reef (Imperial Discus → 5 min), Sunken Secrets (rebirth 3 → 1,500), Treasure of the Wreck (Catfish → 5
  min), The Lost City (rebirth 4 → 4,000), Atlantean Sun (Baby Sunfish → 5 min), Into the Deep (rebirth 5 → 10,000),
  Light of the Deep (Lanternfish → 5 min), Heat Below (rebirth 6 → 25,000), Temple Guardian (Dragonfish → 5 min),
  Crystal Path (rebirth 7 → 60,000), Puppy in the Caves (Husky Dogfish → 5 min), To the Stars (rebirth 8 → 150,000),
  Leviathan (Mini Leviathan → 5 min), Master Aquarist (gauge SpeciesFound 18 → title, golden trophy, 300,000 points)
  and the Snail's line (stat `CompanionStat` Snail: coins its Snail
  picks up, `CoinService.onCollected`'s `companion`): Story3 "Little Helper" (20) → perk CoinLinger1 (coins stay 1 s
  longer on the sand), Story4 "Busy Snail" (100) → CoinLinger2 (+2 s more), Story5 "Snail Champion" (200) → CoinBounce
  (a coin reaching the sand hops 2.2 studs and lands in 1.5 s, then its ground timer starts: 5 s + the linger bonuses).
  The Pelican's line opens once the player owns the Pelican (`requiresCompanion`; QuestService's 5 s board loop
  runs `refreshStoryLines`, so it shows up within 5 s of the Ocean reward); stat `CompanionStat` Pelican: fish that ate a pellet
  the Pelican threw (`FishService.onFishFed`'s `byCompanion`): Story6 "Lunch Time" (50) → FishSatiety (a fed fish
  stays full 15 s longer, FishService.feed), Story7 "Double Serving" (150) → PelicanDouble, Story8 "Pelican Chef" (500)
  → PelicanCharges (see CompanionService). Rough pace: ~8 min, ~13 min, ~40 min of tending (~17 with the 500-point
  Ocean upgrade).
  The paid companion lines (V0.40) open once the companion is owned and stay locked without their pass
  (`requiresPass`, the quest book shows a Buy button): Water Hen (`CompanionStat` WaterHen: eggs opened while it is
  equipped, EggService) WaterHen1–3 "Nest Keeper" 50 / "Mother Hen" 150 / "Hatchery Queen" 400 → perks WaterHen1–3
  (hatch x0.78 / 0.72 / 0.65 instead of 0.85); Swordfish (`CompanionStat` Swordfish: coins it grabs) Swordfish1–3
  "Quick Catch" 300 / "Coin Hunter" 1,000 / "Swordfish Ace" 3,000 → perks Swordfish1–3 (speed x1.4 / 1.8 / 2.2, reach
  2.5 / 3 / 3.2); Jellyfish (V0.42, `CompanionStat` Jellyfish: fish that ate one of its pellets) Jellyfish1–3 "Snack
  Time" 300 / "Tentacle Chef" 1,000 / "Grand Feast" 3,000 → perks Jellyfish1–3 (3 charges every 6 s, every 5 s, 3
  pellets).
  The free side lines (V0.46, ROADMAP M7, gauges): Hatchery (opened by Story1; `TotalHatched` 100 / 300 / 600 / 900 /
  1,200 → 2 min of income each, the last one also the Golden Incubator decor), Collector (opened by Story2 "Full House";
  first Anomaly, 10 Fish Index cells, first Ghost, 25 cells, first Shiny, 50 cells → the Collector title; the other
  rewards in BALANCE.md §5.9), and the Ocean line goes on after Full House: Ocean1 "Back to the Sea" (release 50 fish →
  3 min of income), Ocean2 "Ocean Friend" (release a Shiny → the Ocean Friend title).
  Daily / weekly boards (V0.46): 3 quests drawn per period from DAILY_QUEST_POOL (collect 150 / 400 coins, open 10 / 20
  eggs, feed 30 times, hatch an Anomaly → coins x2 for 5 min each) and WEEKLY_QUEST_POOL (collect 3,000 coins, open
  100 eggs, feed 300 times, hatch a Ghost, release 25 fish, like 3 aquariums → x2 for 15 min each), the same draw for
  every player. Reward kind `CoinBoost {minutes}`: PlayerData.coinBoostSeconds (adds up, multiplied with the like / pass /
  event bonuses, runs down only while the tank produces, shown by QuestBoostPill).
  Perk rewards go to `PlayerData.perks`; CoinService / FishService / CompanionService read them when needed.
- **Ocean.** `ReleaseFish {fishType, variant}`: the server checks the feature, that one of that kind *and* variant
  is alive and that `MIN_FISH_KEPT` fish remain. It releases the one of them that earns the least: lowest growth
  stage, then smallest, then youngest (`FishService.releaseFish`, rise animation; the panel says so under its
  subtitle), credits `getOceanPoints(fishType, variant)` (species' points × 1 / 2 / 3 / 5 for Normal / Anomaly /
  Ghost / Shiny) and fires `MoneyPopup{ocean}`. A rebirth counts the same way (`getRebirthOceanPoints(data)`). The tutorial is the coach bubble, then
  the PanelCoach; "Got it!" or a first release sends `FinishTutorial`.
- **Ocean milestones.** `ClaimOceanReward`: the server checks the feature, `oceanPoints >= points` and that it
  wasn't claimed, pushes the id to `oceanRewardsClaimed` and grants: a companion (`CompanionService.grant`, equipped if
  a slot is free), a companion slot (`companionSlots + 1`), a companion upgrade (nothing stored beyond the claimed
  id: CompanionService reads `getCompanionMultiplier` live) or a bigger tank (`capacity = max(capacity, 15)`, kept
  through rebirths), more incubators (`incubators = max(incubators, count)`), a variant luck (nothing stored beyond the
  claimed id: EggService reads `getVariantLuck`, which multiplies the rare variants' chances in `rollVariant`) or
  cosmetics (`DataService.addCosmetic`), then a Reward popup. Points are never spent. The Ocean
  side button gets a badge while one is claimable.
- **Event sources.** *Recurring*: each server's clock starts with the server and again when any event ends. From
  minute 5 each new minute draws once, chance (m − 4) / 11 (minute 5: 9 %, 10: 55 %, 15: 100 %), only while at least
  one player isn't immune (otherwise that minute waits for one); it then picks a random event with `recurring: true`
  (the Abyss). Only that server has it. *Admin*: "/event <name>" (`isAdmin`, checked on the server) starts any event
  (recurring ones too) with admin behaviour: locally, then MessagingService to every server, and a MemoryStore entry
  (expiring with the event) that servers started later join (if > 5 s left). An admin event replaces whatever runs; a
  recurring event never starts over one (the clock doesn't run during any event). "/event stop" ends the running event
  (everywhere if it is an admin one). In Studio the command and the test buttons only touch the playtest server.
  *Immunity*: EventService sets `EventImmune` every second (not loaded or onboarding not Done); immune owners get no guest,
  no lantern raid and no coin bonus (`getEventCoinMultiplier(owner)`), and MusicEventController hides the event from an
  immune client (music, banner, darkness); when the tutorial ends mid-event, the event joins them.
- **Music event.** `EventService.startEvent` sets the attributes. The server beat loop calls
  `FishService.dropBeatCoins(chance)`. The client side is MusicEventController (music, beats, `onBeat` →
  FishAnimationController puffs, banner).
- **Abyssal raid.** `EventService.startEvent("Abyss")` sets the same attributes and runs `AbyssService.run` until the
  end. In each owned tank, a raid loop waits for a coin (`findCoinToSteal`: most valuable, not frozen / bubble, ≥ 2.5 s
  left on the sand), then makes a pass, again and again until the event ends (no cap, 0.8–2.2 s of rest between two;
  ~13 passes a minute with a few fish, more with more coins): the server clones
  `LanternFish` at the back of the tank (local Z +7), off to one side, `Lurking` = true then false. It glides 1.2 s at
  3 studs/s (its lure and red eyes fade in first on the clients), then darts at up to 9 studs/s, following the coin. While still
  emerging it switches to another coin if its target vanishes; later, a coin collected first (player or Snail) or
  expired is a miss. Within reach it calls `stealCoin` (no credit, "-X$" popup, CoinStolen SFX) and carries the coin
  welded to its mouth. Then `Lurking` = true: it swims back into the dark and is destroyed with its loot. Moved by the
  server (Heartbeat, replicated CFrame). Client: AbyssEventController darkens the world and dresses the tanks for the
  event's length (2.5 s fades); the banner glows slowly (cyan ↔ red). Its track (`musicId`) crossfades over the
  background music. While it runs, every coin is worth x1.5 (`coinMultiplier`, read by `FishService.dropCoin`
  through the shared `getEventCoinMultiplier`; the income line shows it).
- **Rebirth.** The story quest "Saving Up" (Rebirth line, open after Story1) tracks the money held toward the price
  (5,000 $); claiming it unlocks the "Rebirth" feature: a notice, a side button with a "NEW" coach bubble (its tutorial ends when the menu opens) and a "!" badge
  whenever a rebirth is affordable. The menu explains the trade (fish → Ocean Points, run restart, multiplier, new
  theme); "Rebirth" needs a second click. Server: refused during a hatch reveal; Ocean Points from `PlayerData.fish`
  (`getRebirthOceanPoints`, variants included), `FishService.releaseAll` (release exits), `CoinService.clearOwner`, then money =
  start money (300), fish / incubating / eggsBought reset (free starter egg again), `rebirths + 1`, reward popup.
  Kept: Fish Index, quests, companions, Ocean Points, features, likes. `FishService.dropCoin` multiplies every coin
  by `getRebirthMultiplier` (x2.5 after rebirth 1, x8 after rebirth 2, times the like boost). AquariumService dresses
  each tank in its owner's `getAquariumTheme` (polled every second; free tanks Basic): Lagoon, Neon Coral Lagoon, Sunken
  Pirate Wreck, Atlantis Ruins.
  4 rebirth levels for now (x2.5, x8, x25, x80): after the fourth, the menu says more are coming. While the next rebirth is affordable the
  side button pulses in a gold halo, and App shows a "REBIRTH READY!" bubble on it (multiplier and theme of the next
  rebirth) when it becomes affordable, then every 4 min while it stays so (8 s; opening the menu pushes it back; not
  while the Rebirth's own "NEW" bubble or a panel is up).
- **Likes.** Another player's board shows a local ProximityPrompt (E, 10 studs; its text shows the cooldown). It
  sends `GiveLike`; the server checks the giver is within `LIKE_RANGE` of the board, that the tank has an owner
  who isn't the giver, and the giver's cooldown (`lastLikeGivenAt` + 1 h, any tank). Then `likesReceived += 1` and
  the owner's boost restarts at 5 min (`now + LIKE_BOOST_DURATION`, it never adds up), both players are notified.
  The boost is session-only (LikeService memory, dropped when the owner leaves) and reaches the clients through the
  aquarium's `LikeBoostEndsAt` attribute (board + owner's pill). `FishService.dropCoin` multiplies coin values by
  `LikeService.getCoinMultiplier` (x2; fart bubbles stay 1 $).
- **Onboarding.** EnterView → BuyEgg (free) → Hatching → OpenEgg → CollectCoin (frozen coin) → CoinCollected →
  Feed (free food) → Done (+300 $). Menus (side buttons) appear only once the onboarding is Done.
  `STORY_QUEST_HINT_DELAY` (5 s) later, a coach bubble on the Quests button asks the player to look at the Snail
  quest and wishes them good luck. It is client-only (App state, not in `tutorialsDone`): it shows only if the
  onboarding was played in this session and Story1 (line Start) is still to claim, and ends when the book is opened.
- **Gamepasses.** Shop card → `BuyGamePass` → GamePassService checks the pass has an id and isn't owned, then
  `MarketplaceService.PromptGamePassPurchase`; Roblox fires `PromptGamePassPurchaseFinished` on the server, which adds
  the pass to `PlayerData.passes`, syncs and sends a thank-you Reward. At each join the passes are asked again from
  Roblox (a refund takes it away; an outage keeps the save). Effects are read live where they act, so they apply at
  once: coin value x1.5 (FishService.dropCoin, every coin incl. the croissant; not the 1 $ bubbles nor IncomeMinutes
  rewards), Ocean Points x2 on fish going to the ocean (OceanService.credit, getRebirthOceanPoints; fixed quest
  rewards are not doubled), variant luck x2 (stacks with Lucky ocean: Shiny 3 %, Ghost 15 %, Anomaly 30 %), +1
  companion slot (getCompanionSlots). The client shows the same numbers (income line, Ocean rows, Rebirth preview).

---

## 4. Known limits / next steps

- **Saves in Studio** need *Game Settings → Security → Enable Studio Access to API Services*; without it ProfileStore
  runs on a mock store (warning in the output) and nothing persists between playtests. Studio and live servers
  share the same store. Reset everyone by bumping `STORE_NAME`; reset your own save in a Studio playtest with
  `/datareset` then `/datareset confirm` (DevCommandService). `DataService.resetSave` skips the onSave hooks and
  `getSave` for that player, so nothing of the old run is written back into the fresh profile.
- **Crash**: a hard server crash (no BindToClose) loses up to `AUTO_SAVE_PERIOD` (60 s) of progress; the profile
  stays locked until ProfileStore considers the dead session expired.
- **Fish swimming traffic**: one message per wander step (~every 2–5 s per fish) and per chase step (every 0.25 s,
  only while food is in the water), sent only to the clients watching that tank. A chase segment covers 1 s of
  swimming (`CHASE_LOOKAHEAD`) at constant speed and is replaced after 0.25 s, so its end is never reached while the
  next one travels; the client blends a late segment from the pose the old one gives *now* (FishRenderController.getPose). Coins, food, companions and event
  guests are still server-tweened (candidates for the same treatment if they become numerous).
- **Load test (2026-10-29, Studio solo, 6 tanks × 30 fish, uncollected coins; harness removed afterwards).** Server:
  heartbeat 0.6–0.9 ms (K-pop beats included), never the bottleneck. Client (60 fps cap): 2.5D view of a full tank
  ≈ 4.7 ms scripts + 9.3 ms render CPU; lobby view of the 6 full tanks (180 fish, 120 animated, 1.07M triangles)
  ≈ 7.1 + 11.9 ms, still 60 fps; lobby + K-pop 56 fps (beat puffs on every fish). Hotspots: (1) the EditableMesh
  swim animation costs per *species* on screen, not per fish (2 → 6 species in a tank: +3 ms scripts, +3 ms
  render; one SetPosition pass over all species' variants ≈ 15 ms of Luau); (2) server-tweened coins: ≈ 0.4 KB/s
  each while they sink, ~90 KB/s per client with ~200 coins in view (fish replication is only ~37 msg/s). Weak
  devices will feel (1) first. Studio caps at 15 fps when its window loses focus: steady 66.7 ms frames are that
  cap, not load.
- **Load test with 18 species (2026-11-01, V0.46, ROADMAP M7; Studio solo, 6 tanks x 25 fish of all 18 species and
  their variants, test store; harness removed afterwards).** All views at 60 fps. Aisle view (3 tanks, 75 fish
  rendered): scripts 6.9 ms, render CPU 11.0 ms, GPU 2.5 ms; 32 fish animated (6 species), 68 swaying, the far tanks
  static. Overview of the 6 tanks: 3.9 / 8.9 / 2.9 ms (most tanks beyond LOD_DISTANCE: static). 2.5D view of a tank
  holding all 18 species: 4.2 / 7.8 / 2.1 ms, 6 species animated, the other 13 fish swaying. Simulated phone (~30k
  triangles of EditableMesh budget, aisle view): budget settled at ~29.9k, 15 animated, 85 swaying, none static,
  3.7 ms scripts. Server: negligible. Total client memory can't be read apart from Studio's in a solo playtest:
  the real mobile check stays for the first players (ROADMAP M7 calibration). Seen once while 18 species replicated
  for the first time: "Asset content representation is being generated" for ids that aren't in the place (Roblox
  preparing recent assets), gone on the next playtest, every mesh loads.
- **Studio captures** don't show BillboardGuis parented to PlayerGui (hunger badges, popups): check them by script.
- **EditableMesh budget**: handled by the animation LOD. Keep new fish meshes ≤ ~4k triangles.
  **Measured 2026-11-01**: the client budget counts **triangles**, ~81,000 on the owner's PC (Studio Edit, plugins and
  the server have none; a phone has its own, likely smaller); when it is full `CreateEditableMeshAsync` returns
  **nil** (no error), and `Destroy()` frees it at once. Triangles per mesh: 2.5k (Golden Guppy) to 8.4k (Husky Dogfish,
  Bunny Shark); the 6 heaviest species x 2 copies need ~83k. **V1 stopgap (V0.45)**: FishAnimationController plans the
  rigs in triangles (`INITIAL_TRIANGLE_BUDGET` 72k, `MAX_ANIMATED_SPECIES` 6 kept as a CPU cap), builds them one at a
  time (room check included, so a refusal means the device is really full), lowers its budget to what is built the
  first time the device refuses (one mesh lower on a refusal within the budget; local attribute
  `SwimTriangleBudget` on the LocalPlayer), frees idle rigs at once when another species needs the room, and the
  visible fish left without a rig **sway** (yaw around a point near the head + a little roll, on a local Weld that
  replaces the template's WeldConstraint; client-built fish only). Tested with a simulated phone (~30k free): one
  refusal, budget 29k, 3 species animated, 6 swaying, none frozen. The real fix is `ROADMAP_V1.1.md` (bones).
- **Scaling to many species (goal: dozens, maybe 100+). Decided 2026-10-29; item 1 built in V0.37.** Server, network and saves
  don't care about the species count (per-fish costs only), and the swim animation is already capped
  (triangle budget + `MAX_ANIMATED_SPECIES` = 6 at once; extra species sway). The real risk is **asset loading**: every
  template sits in `ReplicatedStorage.Assets.Fish`, so every client downloads (and the loading screen preloads) every
  species → long loads and mobile memory crashes at ~100. To do, **before ~15–20 species**:
  1. **On-demand templates** (done, V0.37: server/fishAssets): templates in `ServerStorage`, a species is copied into
     ReplicatedStorage while one is present on the server (any tank), removed 60 s after the last one left; the
     loading screen preloads only those. Same for `Assets.FishVariants`, per variant present. The client waits for a
     missing template (FishRenderController `pending`). Load test with 18 species done in V0.46 (above).
  2. **Per-species budget** from the next species on: mesh ≤ ~3k vertices, texture 512×512.
  3. Later, for looks (the whole-body sway is done, V0.45): cheaper rigs (deform only the
     rear half, lower rate for small / far fish).
  4. Production is the real limit (mesh + icon + config + balance per species): tool it (colour variants of a
     mesh cost almost nothing).
- **Roblox moderation**: a "Firefighter" fish was dropped, its icon got the account a moderation warning (a nozzle in its
  mouth, read as a cigarette). Rules in CLAUDE.md §7.
- **Not built yet**: the V1 content is complete since V0.44 (ROADMAP M6) and its side lines and daily / weekly quests
  since V0.46 (M7); left for M7: the calibration with real players. The shelf arrows show since V0.38 (8 eggs). The Pelican's and the Snail's Ocean upgrades have their V1 values since V0.36 (x1.33 /
  x1.15, ROADMAP M1). Kpop is the only admin event and Abyss the only recurring one (`recurring` in GAME_EVENTS).
- **Admin events across servers** rely on MessagingService (best effort, a few seconds of delay; a server that misses
  the message still joins through the MemoryStore only when it starts). A server started during an admin event joins
  it for the time left. Add admins by UserId in `server/admins.ts` (the game's owner always is one).
- **Playtesting**: see `docs/agent-notes/studio-mcp-ui-testing.md` and `fish-asset-pipeline.md`. In short: stand at
  the tank CFrame × (0, 5, −14) to be in the focus zone, drive flows through remotes, feed fish in long tests, and
  mark temporary test values with `// TEMP TEST`, then restore them.
