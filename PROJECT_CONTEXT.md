# PROJECT_CONTEXT — Project: Quarium

> Living map of the project. **Read it before exploring the code, and update it in the same change
> whenever you add / rename / remove a file, a service, a remote, a PlayerData field, a tag or a game system.**
> It describes the game **as it is now**: the history of each change goes in `RELEASE_NOTES.md`, the numbers in
> `BALANCE.md`; don't copy them here.
> Last updated: 2026-11-02 (V0.57: Aquarium panel content centred; V0.56: Atlantis corals grounded on the sand).

**The game.** An incremental aquarium game on Roblox. Each player owns one of 6 aquariums placed around a
beach lobby. They walk up to the glass to enter a 2.5D "focus" view. In that view they buy eggs, which hatch
into fish of various rarities. Fish drop coins the player clicks to collect, and must be fed (food costs
money). An unfed fish never dies: it turns weak (very slow) and only lets out 1 $ fart bubbles instead of its
coins. Around that core loop:

- a quest book: story lines (the "Voyage" main line to the end of the content, companion lines, free side lines)
  and daily / weekly boards rewarded by a coin boost;
- companions (the Snail picks up coins on the sand, the Swordfish in the water, the Pelican and the Jellyfish feed, the
  Water Hen speeds up hatching);
- fish variants: every hatch can be an Anomaly (10 %), a Ghost (5 %) or a Shiny (1 %), rarer and richer;
- a Fish Index (collection): one row per species, one column per variant, plus the easter eggs;
- the Ocean: release fish (the player picks the kind and the variant) for Ocean Points, a progression score that
  unlocks milestones (companions, upgrades, tank size 10 → 25, a second incubator, variant luck, cosmetics);
- events: recurring ones drawn by each server every 5–15 min (Island Breeze: a sunny music event, coins fall on the
  beat; the abyssal raid: the world goes dark, a lantern fish steals coins; the UFO night: a UFO beams the fish up one
  by one and drops them back mutated; the starfall: stars fall into the tanks, clicked they fill a star gauge that
  guarantees the next egg a rarer variant) and admin ones started on every server (the K-pop music event, too generous to
  recur); never during the tutorial;
- likes between players: a board beside each tank, a like doubles the owner's coins for 5 min;
- leaderboards: three signs in the lobby (Ocean Points in the middle, the tank's income per second, the time played),
  global tops of 100 kept in OrderedDataStores;
- gamepasses, sold by the fisherman's shop in the lobby (never part of the balance): Third Companion Slot, x2 Ocean
  Points, Lucky, +50% Coins, and the Water Hen / Swordfish / Jellyfish passes sold from their quest lines;
- rebirths: restart the run for a permanent coin multiplier and a new aquarium theme (8 levels: Lagoon, Neon Coral,
  Pirate Wreck, Atlantis, Mariana Trench, Volcanic Temple, Crystal Caverns, Cosmic Sanctuary);
- cosmetics: titles above the head, decor in the tank, Pearl rims; the player can pick the theme, title and shown
  decor (Customize button); the leaderboard titles are held, not earned: the day's top 10 of each board wears its
  title on a nameplate (gold #1, silver #2, bronze #3, navy #4–#10) until the next day's ranking;
- easter eggs: secret fish hidden in every egg (the French Fish) or made by an event (the Alien Fish of the UFO
  night), their own Fish Index category.

18 species (+ 2 secret), 12 eggs, 8 rebirths: the whole V1 content. **`BALANCE.md`** holds the expected progression
(rebirth 1 ~25 min … all eighteen species ~12h30 for a player of 1 h a day), every number and the design rules.
How to add content: `docs/agent-notes/content-recipes.md`. **`ROADMAP_V1.1.md`**: the plan after V1 (animation revamp with Blender skeletons, steps A0–A8).

---

## 1. Tech stack & conventions

| Topic | Choice |
|---|---|
| Language | TypeScript compiled to Luau by **roblox-ts 3** (`noLib`: no Node/browser globals; use `task.*`, `math.random`, `os.clock`, `print/warn`, `.size()`) |
| Sync | **Rojo 7.7.1** (aftman). `default.project.json` maps `out/server` → ServerScriptService.TS, `out/shared` → ReplicatedStorage.TS, `out/client` → StarterPlayerScripts.TS, `out/first` → ReplicatedFirst.TS (loading screen). Never edit those scripts in Studio. A change to `default.project.json` needs `rojo serve` restarted (and the plugin reconnected) |
| Packages | `@rbxts/react` + `react-roblox` (UI), `@rbxts/t` (runtime validation), `@rbxts/janitor` (cleanup), `@rbxts/services`, `@rbxts/profile-store` (player saves, see §3.1) |
| Build / check | `npx rbxtsc` after every change; it must report zero errors |
| Workspace | Windows or macOS, set up from `SETUP.md`; `npm run doctor` checks a machine. Machine-specific values (install paths, GPU flags, API keys) only in the git-ignored `workspace.local.json` (via `tools/local-config.js`), never in committed files; scripts are cross-platform Node. npm scripts: `build`, `watch`, `serve` (rojo serve), `sim` (economy simulator), `stats` (real players), `doctor`. `jimp` 0.22 and `@resvg/resvg-js` 2.6 (SVG → PNG without FigCraft) are devDependencies for the image tools |
| Framework | `shared/framework.ts`: singletons implementing `Lifecycle { onInit (sync), onStart (task.spawn) }`, registered in order in `server/main.server.ts` / `client/main.client.ts` |
| Server authority | The client only sends **intents**. The server validates each one with `t`, reads prices and odds from shared config, and owns money, inventory, timers and every gameplay state. Even fish positions are server-computed (swim segments): clients only render them, never report them |
| World ↔ code | Studio models are found by **CollectionService tags** (`shared/tags.ts`) and attributes, never by deep paths. Templates live in `ServerStorage.Assets` in the place file, which Rojo does not manage: **remind the user to save the place** after MCP edits |
| UI | Designed first in **FigCraft** (`design/ui/redesign-v2.figcraft` for the V2 style, `design/ui/shopbar.figcraft` for the older panels and pieces), then translated to `@rbxts/react` in `src/client/ui/*.tsx`. Colours, fonts and asset ids live in `client/ui/theme.ts`. **V2 style ("arcade aquatic")**: build screens from `client/ui/kit.tsx` (Button3D, Plate, Card, HeaderBanner, CloseButton, ItemSlot, ProgressBar, Chip, CoinIcon, NotifBadge, Sparkle, SoftGlow, TextStroke, Outline); fonts `FONT_TITLE` (Luckiest Guy: titles, buttons, big numbers) and `FONT_BOLD` (Fredoka One: the rest), every text with a `TextStroke`, every surface outlined in `OUTLINE` (3 px); colours from `PALETTES` (light / base / dark / shadow per role: green action, gold buy, red confirm / close, blue / lagoon secondary, navy inactive) and `NAVY`. Relief = a container of face height + depth holding a Shadow (darker, `depth` px lower) and the Face (gradient light → base, gloss); a frame's AutomaticSize ignores scale-sized children, which is how `Plate` / `Card` / `Panel` keep their bevel under content-sized faces. Luckiest Guy's lowercase "s" reads like a 5: short labels mixing digits and letters ("+1s") use Fredoka. Text drawn over a `UIGradient` goes in a child TextLabel, otherwise the gradient tints it. Wrapped text inside a `Panel` gets a fixed height from `getWrappedHeight` (Panel.tsx), never AutomaticSize. **Popups never animate the scale of text**: re-rendered at every size, it wobbles. Panels, the onboarding card, the event banner and the reward window fade in at their final size (CanvasGroup `GroupTransparency`, with padding for their border stroke); only images (rays, eggs, fish, icons) pop with a UIScale |
| Style | English identifiers and comments; comments explain the *why*. UI text is in English, with **no emoji** (the owner finds them too "AI"): icons are drawn. Tabs, Prettier, eslint-plugin-roblox-ts |
| Gotchas | Luau reserved words can't be identifiers (`next`, `end`…). Don't use the `in` operator or `??` on a macro union (`map.get(x) ?? []` in a `for…of` fails). In Node edit scripts, `String.replace` treats `$$`, `` $` `` and `$&` specially: prefer `split().join()` or the Edit tool. **A function declaration is not hoisted with its value**: a module-level `const X = f()` above `function f` compiles to a call of nil (declare the function first) |

---

## 2. Annotated tree

```
ProjectQuarium/
├─ CLAUDE.md                 Project rules (read first)
├─ SETUP.md                  New machine / OS: prerequisites, install steps, machine config, shared vs local
├─ PROJECT_CONTEXT.md        This file
├─ RELEASE_NOTES.md          Every change of the game, patch by patch, newest on top, never deleted
├─ BALANCE.md                The balance: expected progression, live numbers, design rules, V1 design, history
├─ ROADMAP_V1.1.md           After V1: the animation revamp (Blender skeletons instead of EditableMesh), steps A0–A8
├─ default.project.json      Rojo mapping (see §1)
├─ .mcp.json                 Project MCP servers (Roblox_Studio, FigCraft), started by `node tools/mcp/*.js` on any OS
├─ workspace.local.example.json  Template of workspace.local.json (git-ignored): FigCraft folder / port, wgpu backend,
│                            Studio MCP and Roblox fonts overrides, Open Cloud key; read by tools/local-config.js
├─ .gitattributes            LF everywhere (CRLF for .bat/.cmd), binaries marked; .gitignore keeps local config out
├─ docs/agent-notes/         The agent's shared working knowledge (owner preferences, asset pipeline, Studio MCP
│                            testing, lobby decor, moderation, player stats), index in its README
├─ design/previews/          Images shown to the owner (Studio captures, mock-ups): crab-sax-preview.jpg (mock-
│                            up), crab-sax-carry-1-right / -2-middle / -3-left.jpg (Island Breeze's guest dancing),
│                            admin-panel-mockup.png / admin-panel-ingame.jpg (the admin panel), star-gauge-mockup.png
│                            (the starfall's gauge and the star power pill), star-power-pill-ingame.jpg,
│                            leaderboards-mockup.png / leaderboards-ingame.jpg, leaderboard-titles-mockup.png /
│                            leaderboard-titles-ingame.jpg (the nameplates' four tiers)
├─ design/ui/
│  ├─ leaderboards.figcraft  The lobby leaderboards (Leaderboards_Mockup: the three signs on the beach, Board_ocean /
│  │                         _income / _time faces; LeaderboardTitles_Mockup: the nameplates, Plate_<board>_<tier>),
│  │                         built by leaderboards.build.js (figcraft-cli; exports both previews)
│  ├─ starfall.figcraft      The starfall's star gauge (StarGauge_Mockup: in the tank view, its states, the star power
│  │                         pills), built by
│  │                         starfall.build.js (figcraft-cli; exports design/previews/star-gauge-mockup.png)
│  ├─ admin-panel.figcraft   The admin panel (AdminPanel_Mockup), built by admin-panel.build.js (run through
│  │                         figcraft-cli; it also exports design/previews/admin-panel-mockup.png)
│  ├─ shopbar.figcraft       FigCraft source of the older UI frames: OnboardingCard, RewardPopup, CapacityPlaque,
│  │                         EventBanner(Abyss), QuestPanel, CompanionPanel, OceanPanel / OceanCoach / PanelCoach,
│  │                         LikeBoard / LikeBoostPill, LoadingScreen / TailSprite, RebirthPanel, OwnerPlate,
│  │                         FishIndexPanel_Variants / VariantTooltip, PelicanCharges, FocusButtons, OceanFullReminder,
│  │                         egg frames
│  ├─ redesign-v2.figcraft   UI V2 "arcade aquatic": UIKit_V2 (palette, 3D buttons, ribbon banners, item slots, side
│  │                         icons, Roblox mapping), HUD_V2, QuestPanel_V2, FishIndex_V2, Assets_V2 (the V2 sprites),
│  │                         ShopBar_V1 (hand-made: shelf arrows, incubator chip "1/2", gold "+"). Built by
│  │                         redesign-v2.build.js (node → JSON → `figcraft-cli run`; with a preview folder it exports
│  │                         the boards and sprites in the same session, where the Roblox fonts are loaded)
│  ├─ v2/                    V2 sprites (2x PNG, ids in theme.ts V2_IMAGES): side icons, ribbon tails, Sparkle, SoftGlow
│  ├─ passes/                Pass_<GamePass>.png, Pass_Shop.png, Pass_Aquarium.png (512 px, no text), rendered by
│  │                         tools/pass-icons.js (its review _sheet.png is git-ignored); ids in GAME_PASSES.image / V2_IMAGES
│  ├─ companions/            Companion_<Type>.png stickers (ids in COMPANION_TYPES.image)
│  ├─ fish/stickers/         Icon_<Type>_<Variant>.png: the UI's fish icons, made by tools/fish-sticker-icons.js,
│  │                         ids in theme.ts FISH_ICONS
│  ├─ fish/variants/variant-spec.json  Hue / saturation / tint per species and variant for fish-variant-recolor.js,
│  │                         plus the uploaded Anomaly / Shiny texture ids (`_colorMaps`)
│  ├─ eggs.build.js          → design/ui/eggs/*.svg + .png: egg sprites (whole, top / bottom halves, 3 cracks); PNG ×2
│  │                         through FigCraft (file.import / export) or @resvg/resvg-js (200×240); ids in theme.ts EGG_SPRITES
│  ├─ gate.build.js          Locked-gate icon of gated eggs (design/ui/eggs/LockedGate)
│  └─ loading/               LoadingArt.png (the owner's aquarium picture, 1672 × 941, source) → LoadingBackground.png
│                            (1024 px) + LoadingLogo.png (logo sheet: full on top, empty letters below), made by
│                            tools/loading-art.js; ids in src/first/LoadingScreen.client.ts
├─ tools/mcp/                MCP launchers (Node, any OS; nothing on stdout): figcraft.js starts the FigCraft app with
│                            its control port if needed then `figcraft-cli mcp --attach`; roblox-studio.js finds Studio's
│                            MCP server (Windows mcp.bat / macOS StudioMCP / override); run-stdio.js shared stdio pass-through
├─ tools/local-config.js     Reads workspace.local.json (+ UPPER_SNAKE env overrides), finds the Roblox fonts folder
├─ tools/check-setup.js      `npm run doctor`: checks Node, packages, Rojo version, Studio MCP, fonts, FigCraft
├─ tools/economy-sim.js      Monte Carlo balance simulator (`npm run sim`): mirrors the economy config (keep it in sync);
│                            reports each step's median / p10 / p90, species discovery, Ocean milestones, income and Ocean
│                            Points per checkpoint. Options: `--players n`, JSON overrides (coinBoost / oceanBoost /
│                            hatchScale: gamepass or "/speed" estimates; P.hoursPerDay: 1 = the reference player, 0 = one
│                            long session), `--plan <file>` to preview a planned economy. Copy its results into BALANCE.md
├─ tools/companion-sim.js    AFK simulator: share of fish-time weak with a feeder (Pelican, Jellyfish) per tank size,
│                            share of coins a collector (Snail, Swordfish) picks up per coin rate; mirrors CompanionService,
│                            FishService hunger, FoodService, CoinService
├─ tools/starfall-sim.js     The starfall's star gauge (mirrors shared/types/stars): bars per share of stars caught, the
│                            next egg's variant, what a 12 h run gets (`--luck`, `--perHour`); results in BALANCE.md §3
├─ tools/player-stats.js     Real players vs the simulator (`npm run stats`): reads every profile of PlayerData_v1 through
│                            Open Cloud (read-only key in workspace.local.json; universe 10773319506), prints attendance,
│                            play time at each milestone (vs BALANCE.md §2), coin pickup share, dailies, devices;
│                            `--file dump.json` to test without the API, `--out` to keep a snapshot
├─ tools/fish-variant-recolor.js  Hue rotation of a species' texture into its Anomaly / Shiny looks (`sheet <Type>` to
│                            pick the angles, `build variant-spec.json`; optional tint for grey fish); pipeline in its header
├─ tools/pass-icons.js       Gamepass, Shop and Aquarium icons drawn as SVG in the V2 style, rendered with @resvg/resvg-js
├─ tools/loading-art.js     Loading screen art from design/ui/loading/LoadingArt.png: logo cut out along its navy outline,
│                            its empty version, a preview; prints LOGO_RECT / ART_SIZE to copy into LoadingScreen.client.ts
├─ tools/fish-sticker-icons.js  Sticker icons from black / white Studio captures of a fish sheet (difference matting,
│                            outline, rim, shadow, shiny sparkles; pipeline in its header)
└─ src/
   ├─ first/
   │  └─ LoadingScreen.client.ts  ReplicatedFirst loading screen: the owner's picture (ScaleType Crop) and,
   │                         laid exactly over its painted logo (LOGO_RECT scaled like the crop), the logo sheet: empty letters,
   │                         then the full logo revealed from the bottom by 40 ImageRectOffset slices (a moving wave; one full
   │                         image once filled); imports NOTHING (no ReplicatedStorage yet). Waits for its artwork (≤ 8 s) and
   │                         shows it ≥ 1.5 s. Steps: game.IsLoaded → preload
   │                         ReplicatedStorage.Assets models → wait for the local "DataLoaded" attribute (UiController, first
   │                         sync). 2.5 s min, 45 s max, then fades
   ├─ shared/                Code + config used by both sides (ReplicatedStorage)
   │  ├─ framework.ts        Lifecycle + bootstrap
   │  ├─ format.ts           formatNumber ("1,234,567", from 1e12 "1.23T") / formatShort ("25K", "1.5M", "1.8T", "1Qa"):
   │  │                      UI and server messages (Luau's tostring breaks from 1e14); Panel.tsx re-exports them
   │  ├─ network.ts          Remote contracts + getRemoteEvent(name) (Remotes folder in ReplicatedStorage), FishView / FishMessage
   │  ├─ swim.ts             SwimSegment + getSwimPose: fish movement computed identically by server and clients
   │  ├─ tags.ts             CollectionService tags and the attributes they carry
   │  ├─ sounds.ts           Music id + SFX ids, played in 2D by AudioController (CoinStolen = the lantern's gulp, StarCatch, UfoBeam,
   │  │                      AlienScream, WeakBubble = a weak fish's bubble, CoinCollect / CompanionCoin = the coin chime)
   │  └─ types/
   │     ├─ fish.ts          FishType, FishRarity (Common … Mythic, Secret = easter eggs), CoinType, HungerState
   │     │                   (Satiated/Hungry/Weak, no death), FISH_TYPES (income, interval, coin, rarity, oceanPoints,
   │     │                   cannibal?, growth, hunger, easterEgg?: EasterEggConfig {hatchChance, incomeShare, lifetime,
   │     │                   leaveMessage, source, perk, screamInterval}), FART_BUBBLE_VALUE, growth helpers, FOOD_PRICE,
   │     │                   DEFAULT_FISH_CAPACITY, isEasterEgg, getFishIndexOrder
   │     ├─ eggs.ts          EggType, EGG_TYPES (price, hatchTime, odds, order, requires: the odds the UI shows),
   │     │                   getDrawOdds (+ easter eggs, taken from the most common fish), rollEgg, starter egg
   │     ├─ variants.ts      FishVariant (Normal / Anomaly / Ghost / Shiny), FISH_VARIANTS (chance, coinRate,
   │     │                   specialOddsMultiplier, ghostCoins, sparkles, rank, oceanPointsMultiplier, description),
   │     │                   VARIANT_ORDER, GHOST_COIN_MULTIPLIER, RECOLOURED_VARIANTS, rollVariant,
   │     │                   formatVariantChance(variant, luck), getOceanPoints, getSpecialCoinOdds, getVariantIncomeMultiplier
   │     ├─ playerData.ts    PlayerData shape + defaults + helpers (getTotalFish, getFishAndEggs, isEggUnlocked,
   │     │                   getHatchedVariant, getLivingVariant, getIncubating, hasFreeIncubator…), MAX_MONEY (1e15),
   │     │                   DEFAULT_INCUBATORS (1), getCompanionSlots (Ocean slots + the slot pass: use it, never
   │     │                   companionSlots alone), getHatchMultiplier (Water Hen equipped: 0.85, or its perk's),
   │     │                   starPower / starCharge (the starfall), getPlayerVariantLuck (Lucky ocean x the Lucky pass: EggService's draw and the chances the UI
   │     │                   shows), syncIncubationSpeed (rescales the incubating timers to a new hatch speed, progress
   │     │                   kept; run by DataService.sync, buyEgg and sanitizeSave)
   │     ├─ companionStats.ts getCompanionStats(companion, data): what a companion does now with its bonuses (Ocean
   │     │                   upgrades, its perks): the line under its ability on the companion card
   │     ├─ customization.ts ThemeChoice (a reached theme or "Auto"), TitleChoice (a title held, "Auto" = the best,
   │     │                   "None"); getUnlockedThemes / getThemeOrder, getDisplayedTheme, isHideable (Decor / Finish),
   │     │                   isCosmeticShown; titles: TitleData, getOwnedTitles (leaderboard titles held, best rank first,
   │     │                   then the earned ones in TITLE_ORDER), getBestTitle, getTitleRank, getDisplayedTitle
   │     ├─ cosmetics.ts     CosmeticId / COSMETICS (kind Title / Decor / Finish; `leaderboard` on the three leaderboard
   │     │                   titles TitleOceanLegend / TitleTankTycoon / TitleDevotedKeeper, never in PlayerData.cosmetics),
   │     │                   TITLE_ORDER (earned titles), LEADERBOARD_TITLES, isLeaderboardTitle, DECOR_SLOTS (tank-local
   │     │                   position per decor id), isDecor
   │     ├─ gamepasses.ts    GamePass / GAME_PASSES (name, shop text, Roblox id, icon, badge, shopOrder), getShopPasses,
   │     │                   getPassById, getPassCoinMultiplier (x1.5) / getPassOceanMultiplier (x2) /
   │     │                   getPassVariantLuck (x2) / getPassCompanionSlots (+1). The companion passes (WaterHenPass,
   │     │                   SwordfishPass, JellyfishPass) are sold from their quest line, picture = the companion's sticker
   │     ├─ quests.ts        QUESTS (Story1–9, Voyage1–16 the main line, WaterHen1–3 / Swordfish1–3 / Jellyfish1–3 the paid
   │     │                   companion lines, Hatchery1–5 / Collector1–6 / Ocean1–2 the free side lines, Daily* / Weekly*),
   │     │                   DAILY_QUEST_POOL / WEEKLY_QUEST_POOL (6 each, 3 drawn per period), STORY_LINES (Start / Ocean /
   │     │                   Rebirth (shown "Voyage") / Snail / Pelican / Hatchery / Collector / WaterHen / Swordfish /
   │     │                   Jellyfish: quests in order, requires (a quest), requiresCompanion, requiresPass, order),
   │     │                   refreshStoryLines, getActiveStoryQuests, getStoryLine, isQuestLocked,
   │     │                   BOARD_UNLOCK_REBIRTHS / isBoardUnlocked (dailies from rebirth 2, weeklies from 3);
   │     │                   counter stats CoinMoney, CoinsCollected, FishFed, LikesGiven, OceanPoints, EggsOpened,
   │     │                   VariantHatched {variant}, FishReleased, CompanionStat {companion}; gauges (GAUGE_STATS)
   │     │                   FishInTank, MoneyHeld, SpeciesHatched {fishType}, Rebirths, IndexCells, SpeciesFound (easter
   │     │                   eggs excluded), VariantFound {variant}, TotalHatched; rewards Money / Companion / Feature /
   │     │                   Perk / IncomeMinutes / OceanPoints / Title / Decor / CoinBoost; daily/weekly periods (UTC)
   │     ├─ perks.ts         Perk (CoinLinger1–2, CoinBounce, FishSatiety, PelicanDouble, PelicanCharges, WaterHen1–3,
   │     │                   Swordfish1–3, Jellyfish1–3), PERKS, COIN_BOUNCE_TIME, getGroundTimeBonus, hasCoinBounce,
   │     │                   getSatietyBonus, getPelicanPellets, getPelicanCharges, getPerkHatchMultiplier,
   │     │                   getSwordfishStats, getJellyfishStats
   │     ├─ companions.ts    CompanionType (Snail, Pelican, WaterHen, Swordfish, Jellyfish), COMPANION_TYPES (+ sticker
   │     │                   `image`), DEFAULT_COMPANION_SLOTS, PELICAN_FEED_INTERVAL, WATER_HEN_HATCH_MULTIPLIER,
   │     │                   JELLYFISH_FEED_INTERVAL / JELLYFISH_CHARGES / JELLYFISH_PELLETS
   │     ├─ foodLooks.ts     FoodLook (Pellet, Shrimp), FOOD_LOOKS (min satiety bonus per look), getFoodLook: the more a
   │     │                   meal feeds (perks' satiety bonus), the more filling the food looks
   │     ├─ oceanRewards.ts  OCEAN_MILESTONES (id, points, title, description, reward: Companion / CompanionSlot /
   │     │                   CompanionUpgrade {companion, multiplier} / Capacity {capacity} / Incubator {count} /
   │     │                   VariantLuck {multiplier} / Cosmetic {cosmetics}), getOceanMilestone, hasClaimableOceanReward,
   │     │                   getCompanionMultiplier (Snail: speed, Pelican: feeding rate), getVariantLuck (from the claimed list)
   │     ├─ features.ts      Feature ("Ocean" and "Rebirth", unlocked by quests), FEATURES (drawn `image` per feature),
   │     │                   MIN_FISH_KEPT
   │     ├─ admin.ts         ADMIN_PANEL_ATTRIBUTE (player: may open the admin panel), AdminTab / ADMIN_TABS (one
   │     │                   tab per admin tool: Events for now)
   │     ├─ ufo.ts           UfoOutcome (Sleep / Green / Red / Variant / Alien), UFO_OUTCOME_ODDS, drawUfoOutcome, FishEffect
   │     │                   (Sleep / Green / Red) + FISH_EFFECT_DURATION + FISH_EFFECT_COIN_MULTIPLIER, getNextVariant,
   │     │                   UFO_TIMING / UFO_KIDNAP_TIME, UFO_BEAM_ATTRIBUTE
   │     ├─ stars.ts         The starfall: StarSize / STAR_SIZES (weight, power range, studs), STARFALL (stars per tank,
   │     │                   timing, floor), STAR_BARS (variant guaranteed per bar, better chances), STAR_MAX_BARS,
   │     │                   drawStarSize, getFinalStarCharge, getStarVariantOdds / rollStarVariant, getGuaranteedVariant,
   │     │                   the StarSize / Caught / Fading attributes of a star hitbox
   │     ├─ leaderboards.ts  LeaderboardId (OceanPoints / Income / PlayTime), LEADERBOARD_IDS, LEADERBOARD_SIZE (100),
   │     │                   LEADERBOARD_ATTRIBUTE ("Board" on a sign), LeaderboardEntry {userId, name, value},
   │     │                   LeaderboardSync {boards, own?}, formatPlayTime ("212h 05m"), formatLeaderboardValue;
   │     │                   titles: LEADERBOARD_TITLE_RANKS (10), getLeaderboardDay (UTC day), TitleTier (Gold / Silver /
   │     │                   Bronze / Common) + getTitleTier(rank), TITLE_TIER_STYLES (nameplate colours), TITLE_PLATE_IMAGES
   │     ├─ events.ts        GameEventType (Kpop, Island, Abyss, Ufo, Starfall), GAME_EVENTS: kind "Music" (bpm,
   │     │                   beatOffset, beatCoins Flat (K-pop) or Paced (Island: income-paced, growing boost, finale)),
   │     │                   "Abyss", "Ufo" or "Starfall", subtitle, optional musicId and coinMultiplier, duration, recurring flag;
   │     │                   guestMove (Swim / Walk), GUEST_DANCE_JOINTS (Dance / Sway Motor6Ds);
   │     │                   EVENT_ATTRIBUTES, LURKING_ATTRIBUTE, ADMIN_EVENT_ORDER, getActiveEvent,
   │     │                   getEventCoinMultiplier(owner), EventSource, getRecurringEvents, getRecurringChance,
   │     │                   EVENT_IMMUNE_ATTRIBUTE + isEventImmune (tutorial)
   │     ├─ rebirths.ts      REBIRTHS (price, multiplier, start money, theme), AQUARIUM_THEMES (Basic + the 8 themes),
   │     │                   getNextRebirth, getRebirthMultiplier, getAquariumTheme, getRebirthOceanPoints
   │     ├─ likes.ts         Like rules (1 per hour given, x2 coins for 5 min, restarted by each like), board offset, helpers
   │     ├─ onboarding.ts    Onboarding steps + rules (what is allowed / free at each step), ONBOARDING_REWARD,
   │     │                   STORY_QUEST_HINT_DELAY
   │     └─ aquarium.ts      Tank dimensions, getAquariumFrame, isInFocusZone (front-of-glass zone), INCOME_ATTRIBUTES
   │                         (IncomePerSecond / IncomeMultiplier / IncomePaused on an owned aquarium model)
   ├─ server/
   │  ├─ main.server.ts      Registers services (order matters for onInit)
   │  ├─ templates.ts        loadTemplates(tag, attribute, keys) (Studio templates found by tag), scaleModel
   │  ├─ fishAssets.ts       FishAssets: on-demand fish templates. Species models and variant textures live in
   │  │                      ServerStorage.Assets.Fish / FishVariants; require(fishType, variant) copies them into
   │  │                      ReplicatedStorage.Assets.Fish / FishVariants before a fish's Spawn message, sweep(inUse)
   │  │                      (FishService, every 10 s) removes copies no tank used for 60 s
   │  ├─ admins.ts           isGameOwner / isAdmin (owner of the place or its group + ADMIN_USER_IDS), checked server-side;
   │  │                      canUseAdminPanel (Studio playtests only for now; isAdmin at the release)
   │  ├─ saveData.ts         SaveData (profile: PlayerData + saved tank + stats + leaderboardBanned), SavedFish,
   │  │                      SAVE_TEMPLATE, sanitizeSave
   │  ├─ playerStats.ts      PlayerStats (server only, never synced): sessions, days, play / tending seconds, milestones
   │  │                      {tending, play, days, at} ("Onboarding:<step>", "Rebirth<n>", "Species:<type>", "AllSpecies",
   │  │                      "Ocean:<id>", "Quest:<id>"; tending -1 = reached before the stats existed: `legacy`), coins
   │  │                      dropped / clicked / by a companion, meals by hand, quests claimed, boost minutes, likes given,
   │  │                      platforms, per-device fps / memory / swim budget, testSpeed / testSpeedUsed, testNoPasses;
   │  │                      createPlayerStats, sanitizePlayerStats, getTestSpeed
   │  └─ services/
   │     ├─ DataService      ProfileStore sessions (load, auto-save, final save, onLoaded / onSave hooks), sync() (also runs
   │     │                   syncIncubationSpeed), notify(), registerAction(), money / fish helpers, changeFish (UFO
   │     │                   mutations), resetSave (wipe + kick, see DevCommandService)
   │     ├─ InteractionService  "Interact" remote: token bucket (10/s) shared by DropFood / CollectCoin / CatchStar
   │     ├─ AquariumService  Registers Studio tanks, assigns one per player, owner nameplate (OwnerPlate SurfaceGui on the
   │     │                   Base), runtime folders (Fish/Food/Coins/Companions), focus reports ("SetFocus") + isTending /
   │     │                   isAtOwnAquarium; dresses each tank in its owner's displayed theme (polled every second; free
   │     │                   tanks Basic), the Pearl rims finish (pearly F3ECF7 rims, Reflectance 0.3, any theme) and the
   │     │                   decor cosmetics (DecorTemplate clones at DECOR_SLOTS), rebuilt when any of them changes;
   │     │                   clears the INCOME_ATTRIBUTES of a freed tank
   │     ├─ FoodService      Drops / sinks food pellets (DropFood), price per pellet, max 10 per player; throwFood (the
   │     │                   Pelican's pellet: falls through the air onto the surface, then sinks) and releaseFood (the
   │     │                   Jellyfish's: sinks straight down); Food.byCompanion names the companion, so FishService's fed
   │     │                   callbacks know who fed; look from getFoodLook (Pellet = brown ball, others = a FoodTemplate
   │     │                   MeshPart clone); random turn, then a slow 120° spin while sinking (CFrame tweens)
   │     ├─ CoinService      Spawns coin models (sinking, ground lifetime) and fart bubbles (spawnBubble: rise, pop, 1 $),
   │     │                   collection + credit, onSpawned / onCollected callbacks (with the companion that collected, if
   │     │                   any), the coin chime (playCoinSfx: +6 % pitch per click chained within 1.2 s, up to 8 steps,
   │     │                   x1.2 for sparkling / ghost coins; companion pickups play CompanionCoin, every 0.35 s at most),
   │     │                   findCoinToFetch / collectForOwner(owner, coin, companion) (Snail, Swordfish), clearOwner,
   │     │                   findCoinToSteal / isCoinAlive / stealCoin (lantern fish: no credit, red "-X$" popup)
   │     ├─ FishService      Fish as data only (no server model): swim AI as SwimSegments, hunger (weak, never dies),
   │     │                   growth, coins / farts, cannibal eating, releases, beat coins, AFK freeze; publishIncome (every
   │     │                   second: tank income/s x rebirth / pass / like / quest boost / event on the aquarium's
   │     │                   INCOME_ATTRIBUTES); UFO night: held / away fish (frozen while away: no hunger, coins, eating
   │     │                   nor release), mutations (effect / effectLeft: Sleep freezes the fish, Green / Red x2 / x0.5 its
   │     │                   coins), pickKidnapTarget / beamUp / beamDown, the alien fish's scream (Scream message,
   │     │                   AlienScream SFX, one plain coin from every other awake fish); easter egg fish: coin from
   │     │                   getTankIncomePerMinute, leave after their lifetime (onFishLeft); getSteadyIncomePerSecond (the income
   │     │                   leaderboard: theoretical income x rebirth x Coins pass, no temporary boost); onFishSpawned / onFishFed
   │     │                   callbacks, findHungryFishPosition / hasHungryFish (feeders); replication to the clients that
   │     │                   watch each tank ("WatchAquariums" → FishSync messages); the quest coin boost (runCoinBoost:
   │     │                   PlayerData.coinBoostSeconds runs down only while the tank produces, coins x
   │     │                   QUEST_COIN_BOOST_MULTIPLIER in dropCoin; Player attributes CoinBoostSeconds / CoinBoostRunning)
   │     ├─ EggService       BuyEgg / OpenEgg: price, gating, incubation (up to PlayerData.incubators eggs per type, the
   │     │                   soonest opens first), draw (or forceNextHatch, Studio tests), variant with the player's luck
   │     │                   (or the star power, then spent: EggHatch.starPowered),
   │     │                   quest stats EggsOpened / VariantHatched (+ CompanionStat WaterHen when it is equipped), hatch
   │     │                   time x PlayerData.incubationMultiplier, reveal timing, then FishService.spawnFish; isRevealing
   │     ├─ OnboardingService  Drives onboarding steps from server facts; scripted first coin / first hunger; reward
   │     ├─ EventService     Events: recurring clock (per server), admin events ("/event <name>" / "/event stop", admins
   │     │                   only; MessagingService topic QuariumAdminEvent + MemoryStore hash QuariumEvents so new servers
   │     │                   join; never from Studio), keeps the players' EventImmune attribute. Music: beats on server
   │     │                   clock, guest fish per tank. Abyss / Ufo: runRaid hands the LanternFish / Ufo template to
   │     │                   AbyssService / UfoService; Starfall: runUntilEnd runs StarfallService (no template). startAdminEvent / stopRunningEvent (the "/event" command and the admin
   │     │                   panel; in Studio: the playtest server only)
   │     ├─ AdminService     Admin panel's server side: sets each player's AdminPanel attribute (canUseAdminPanel) and
   │     │                   runs its actions, checking the right again: "AdminStartEvent", "AdminStopEvent"
   │     ├─ AbyssService     Abyssal raid: one lantern fish raid loop per owned tank until the event ends (§3.4)
   │     ├─ UfoService       UFO night: one UFO per owned tank (clone of the Ufo template, tag Ufo, anchored, moved by
   │     │                   PivotTo), kidnaps one fish at a time (each once per event), notifies the owner of the outcome;
   │     │                   stop() drops a fish still away at once; forceOutcome (Studio "/ufo")
   │     ├─ StarfallService  The starfall (§3.4): per owned tank a steady rain of invisible star balls (tag Star), caught
   │     │                   through the "CatchStar" interaction → PlayerData.starCharge; stop() turns each gauge into the
   │     │                   star power (best of the two) with a notice
   │     ├─ CompanionService Equip / unequip, spawns equipped companions and runs their AI (§3.4 Companions); grant (quest /
   │     │                   Ocean rewards); publishes the feeders' charges on their model (attributes Charges,
   │     │                   MaxCharges, NextChargeAt (server time, absent when full), ChargeInterval)
   │     ├─ QuestService     Progress from server stats (addProgress(stat, amount, subject {fishType, variant, companion});
   │     │                   reportGauges reads every gauge from PlayerData), claims, rewards, daily / weekly boards;
   │     │                   onQuestClaimed; quests of a line whose pass isn't owned are skipped; a board not unlocked yet
   │     │                   stays empty (the tab says at which rebirth it opens); an empty board of the current period
   │     │                   is drawn again
   │     ├─ OceanService     ReleaseFish (+ Ocean Points), ClaimOceanReward, FinishTutorial (any feature's tutorial),
   │     │                   credits an easter egg fish that leaves on its own (points, popup, its leaveMessage)
   │     ├─ RebirthService   "Rebirth" intent (needs the "Rebirth" feature): fish to the ocean, run reset, rebirths + 1, popup
   │     ├─ StatsService     Play statistics (calibration, ROADMAP M7): every 1 s counts play / tending time (tending =
   │     │                   AquariumService.isTending + onboarding done: the simulator's play time) and stamps the
   │     │                   milestones; counts coins (CoinService callbacks), meals (onFishFed), quests (onQuestClaimed),
   │     │                   likes (onLikeGiven); "ReportClientStats" action (once a minute: platform, fps, memory, swim
   │     │                   budget; validated, ≥ 45 s apart). Creator Dashboard (AnalyticsService, all in pcall):
   │     │                   onboarding funnel, one-time "Progression" funnel (Onboarding:Done, Rebirth1–8, AllSpecies),
   │     │                   custom events MilestoneMinutes, SessionMinutes / SessionMinutesInGame, CoinPickupPercent,
   │     │                   DailyQuestClaimed / WeeklyQuestClaimed; legacy saves stay out of the funnels, the owner's test
   │     │                   profiles (testSpeedUsed / testNoPasses) send nothing (the dashboard can't delete an event)
   │     ├─ CustomizationService  "SetAquariumTheme", "SetCosmeticShown" ({id, shown}), "SetTitle": checks, then PlayerData's
   │     │                   choices; AquariumService and TitleService apply them
   │     ├─ LeaderboardService  The lobby leaderboards (§3.4): one OrderedDataStore per board
   │     │                   (Leaderboard_<Id>_v1, key = UserId), writes its players' scores every 2 min (changed ones only)
   │     │                   and when they leave (sampled in onSave), reads the top 100 every 2 min, names from UserService,
   │     │                   merges its players' live scores and sends LeaderboardSync every 30 s and at join; the titles'
   │     │                   daily snapshot (DataStore LeaderboardTitles_v1, key Daily) → PlayerData.leaderboardRanks (§3.4)
   │     ├─ TitleService     Polls every 1 s: a BillboardGui "PlayerTitle" on each character's Head with getDisplayedTitle:
   │     │                   an earned title is gold LuckiestGuy text (4.2 × 0.65 studs); a leaderboard title a nameplate in
   │     │                   its rank's tier (pill + rank badge + board icon, laid out in design px and drawn in scale, 0.65
   │     │                   stud tall); MaxDistance 120, rebuilt when the title or its rank changes, removed without one
   │     ├─ GamePassService  The only writer of PlayerData.passes: at join asks Roblox for each pass on sale
   │     │                   (UserOwnsGamePassAsync, 3 tries; no answer keeps the saved state; passes without an id are
   │     │                   dropped), grants a purchase from PromptGamePassPurchaseFinished (thank-you Reward),
   │     │                   "BuyGamePass" intent → PromptGamePassPurchase; a lost slot pass unequips the extra companion;
   │     │                   setTestPass ("/pass"), setTestNoPasses ("/passes"). The game's creator owns every pass (Studio
   │     │                   shows OWNED)
   │     ├─ LikeService      Places a like board beside each tank, GiveLike (range / own tank / cooldown), onLikeGiven,
   │     │                   keeps each owner's boost in memory (getCoinMultiplier), publishes likes + boost as attributes
   │     └─ DevCommandService  Studio-only chat commands (TextChatCommands created only when RunService.IsStudio(), only
   │                         for the place's owner): "/datareset" then "/datareset confirm" within 15 s (wipes the save,
   │                         kicks); "/nextfrench" (next egg hatches a French Fish); "/incubators <n>" (1–4, saved);
   │                         "/pass <GamePass>" (session only); "/boost <minutes>" (quest coin boost, saved); "/speed <x>"
   │                         (1–10, PlayerStats.testSpeed, saved so it also applies on the published game: coins, hatch
   │                         time, Ocean Points x it via getTestSpeed; red "TEST SPEED x6" chip; the profile is left out
   │                         of npm run stats); "/passes off|on" (plays without the passes, saved; "NO PASSES" chip);
   │                         "/ufo <Outcome>|off" (forces the UFO outcome, session only); "/lbtitle <Board> <1-10>|off"
   │                         (holds a leaderboard title at that rank to see its nameplate; the next join or day puts the real
   │                         ranks back)
   └─ client/
      ├─ main.client.ts      Registers controllers
      ├─ fishLook.ts         getFishTemplate / cloneFishTemplate (undefined until the server replicated the species),
      │                      hasVariantLook, onFishAssetAdded, applyVariantLook (recoloured appearance, ghost
      │                      translucency, shiny particles), used by FishRenderController
      ├─ controllers/
      │  ├─ UiController     Mounts React <App/> in PlayerGui.ReactUi; feeds it PlayerData; queues hatch reveals / rewards;
      │  │                   turns UI callbacks into RequestAction intents; sets the local "DataLoaded" player attribute;
      │  │                   preloads every fish and companion icon at start
      │  ├─ HudController    Toast notifications (Notify remote; V2 navy toast, gold / red border)
      │  ├─ FocusController  Lobby ↔ 2.5D focus camera, back button (FocusUi: blue V2 3D button in plain instances), reports
      │  │                   SetFocus; isFocused(), getOwnAquarium(); in the lobby a "My aquarium" button (FocusUi.GoToAquarium)
      │  │                   puts the character in its tank's focus zone and enters the view; "clarity" tween in the view
      │  │                   (less haze, clearer own GlassFront / Water, local); headroom above the tank: 6 studs while a
      │  │                   companion is perched / floating (Pelican, Water Hen), 9 while a UFO flies over it (re-framed
      │  │                   once the fly-in lands)
      │  ├─ AquariumInteractionController  Clicks in focus view → CatchStar (a star under the cursor), CollectCoin (a
      │  │                   coin) or DropFood
      │  ├─ FishRenderController  Builds / moves the local fish models of the watched tanks (own tank in 2.5D, else tanks
      │  │                   within 160 studs of the camera) from FishSync segments; growth, weak tint, exits (Abducted:
      │  │                   sucked into the UFO); UFO mutations (green / red tint + sparkles + glow, a "z Z z" bubble and
      │  │                   the "Asleep" attribute); the alien's scream (green ForceField wave + puff); a fish whose model
      │  │                   (or rare variant texture) hasn't arrived waits in `pending`, built when the asset arrives, in
      │  │                   its normal look after 5 s; getPose blends a late segment from the old one's current pose
      │  ├─ FishIndicatorController  Hunger / AFK badges above fish (from attributes), none over a sleeping fish
      │  ├─ FishAnimationController  EditableMesh swim deformation shared per species (also the Swordfish companion), camera
      │  │                   LOD (own tank in 2.5D; else tanks on screen within 110 studs), rigs planned in triangles
      │  │                   (§4 EditableMesh budget), visible fish without a rig sway on a local Weld; beat puffs
      │  ├─ CompanionAnimationController  Local wobble of the Water Hen (its own copy of the Mesh placed on the server-moved
      │  │                   Body every frame) and the Jellyfish's bell pulse
      │  ├─ PelicanChargesController  Charge gauge above the local player's on-demand Pelican / Jellyfish (BillboardGui): one
      │  │                   slot per charge, a pellet growing while it refills; hidden while MaxCharges is 0
      │  ├─ StatsReportController  Once a minute sends "ReportClientStats" (platform, average fps, memory, SwimTriangleBudget)
      │  ├─ ShopKeeperController  The fisherman's shop (tag ShopKeeper): isNearby / onNearbyChanged (opens within 9 studs,
      │  │                   closes beyond 12; nearest hut) → App `shopNearby` opens / closes the Shop panel (closed by hand
      │  │                   it stays closed until the player comes back); turns him toward a player nearby and makes him
      │  │                   breathe (local PivotTo)
      │  ├─ IncomePopupController  Floating "+X$" / "-X$" / "+X Ocean" billboards (MoneyPopup remote)
      │  ├─ AudioController  Background music, event music crossfade, SFX (PlaySfx remote or UI)
      │  ├─ OnboardingController  3D onboarding hints (floor marker, pointer over the frozen coin)
      │  ├─ CapacityPlaqueController  "n / capacity" plaque on the own tank
      │  ├─ IncomePlaqueController  Brass plaque on the left of every owned tank's base: "+X$/s  x250" (or "paused"), from
      │  │                   the aquarium's INCOME_ATTRIBUTES
      │  ├─ MusicEventController  Follows the replicated event (any kind): its track if any; for music events, beat detection,
      │  │                   guest effects in its event's stage colours, onBeat listeners; getEvent / onEventChanged; hides events from immune clients
      │  ├─ AbyssEventController  Abyssal raid visuals (local): world darkness (Lighting + AbyssGrade, put back after), abyss
      │  │                   backdrop SurfaceGui on every tank, navy water, marine snow, lantern lure light and red eye glows
      │  ├─ UfoEventController  UFO night visuals (local): violet night (Lighting + UfoGrade), space backdrop on every tank,
      │  │                   night-blue water, two green searchlights sweeping each tank; per UFO (tag Ufo) a pink glow and,
      │  │                   while "Beaming", a green tractor beam, sparkles and light
      │  ├─ StarfallEventController  Starfall visuals (local): blue night (Lighting + StarfallGrade), starry backdrop with
      │  │                   shooting streaks on every tank, night-blue water, golden tank light, shooting stars in the sky
      │  │                   around the camera; draws each Star hitbox (★ glyph billboard with halo, light, trail,
      │  │                   sparkles), bursts it when "Caught", blinks it while "Fading"
      │  ├─ LeaderboardController  Local SurfaceGui (React LeaderboardBoard) in PlayerGui, adorned to the "Screen" part of
      │  │                   each sign (tag Leaderboard; in PlayerGui so the list takes the wheel / drag), from LeaderboardSync
      │  └─ LikeBoardController  Local SurfaceGui (React LikeBoard) on every like board + local "Like" ProximityPrompt;
      │                      getOwnBoostEndsAt / onOwnBoostChanged (own tank's boost, for the pill)
      └─ ui/                 React components
         ├─ App.tsx          Root: top bar, side menus, panels, reveal / reward overlays, the Customize button (pink
         │                   Button3D right of "Back to lobby" / "My aquarium" once a rebirth or cosmetic is earned →
         │                   AquariumPanel), the "TEST SPEED" / "NO PASSES" chip, the rebirth-ready and aquarium-full bubbles
         ├─ theme.ts         Fonts (FONT_TITLE, FONT_BOLD), V2 tokens (OUTLINE, PALETTES, NAVY, VARIANT_PALETTES,
         │                   THEME_PALETTES, V2_IMAGES), asset ids (FISH_ICONS per type and variant, EGG_SPRITES), rarity /
         │                   variant styles, ocean / rebirth / event colours
         ├─ kit.tsx          UI kit V2 (FigCraft UIKit_V2), see §1 UI
         ├─ ShopBar / EggSlot / MoneyCounter  Egg shop: navy shelf of 6 square 3D slots coloured by state (buy, timer +
         │                   cracks + filling tag, OPEN!, FULL, gated, "Soon"), prices shortened (formatShort), then the
         │                   money pill. Arrows on the shelf's sides move the window one egg at a time (navy at the ends,
         │                   red "!" when a ready egg is out of view); it follows the best unlocked egg + the next gated
         │                   one until moved. Several incubators: a slot shows its soonest egg, a "n/N" chip and a gold
         │                   "+" that buys one more
         ├─ EggReveal        Hatch animation (rarity, odds (never an easter egg's: "SECRET"; "STAR POWER" for a variant
         │                   drawn with star power), "NEW!" first discovery)
         ├─ StarGauge        The starfall's star gauge (FigCraft starfall.figcraft), right edge: navy plate, ★ badge, tube
         │                   of 3 bars filling with gold, a chip per bar (ANOMALY / GHOST / SHINY: SURE!, dimmed, or its
         │                   chance with the player's luck), the kept power marked, "CATCH THE STARS!" / "SHINY SURE!";
         │                   only while the starfall runs
         ├─ StarPowerPill    The star power kept (starPower > 0, no starfall running): a pill under the egg shop, stacked
         │                   under the boost pills, in the guaranteed variant's colour ("NEXT EGG: AT LEAST A GHOST")
         ├─ OnboardingPanel  Onboarding instruction card
         ├─ RewardPopup      Reward celebration (money / companion / feature, optional image)
         ├─ EventBanner      Running event banner (style per event, EVENT_BANNER_STYLES: beat flashes / slow glow), formatTime
         ├─ AdminPanel       Admin panel (FigCraft admin-panel.figcraft), opened by the purple ADMIN button (bottom-left,
         │                   only with the AdminPanel attribute): scope chip, tabs (ADMIN_TABS); Events tab: NOW PLAYING
         │                   (name, time left, STOP) and one row per event (ADMIN_EVENT_ORDER: badge, RECURRING / ADMIN
         │                   ONLY, length, START)
         ├─ SideButtons      Left menu (3D squares, icon + label): Quests, Companions (once one is owned), Fish Index, Ocean
         │                   (once unlocked), Rebirth (gold halo pulsing + "!" while affordable, "REBIRTH READY!" bubble
         │                   driven by App: when it becomes affordable, then every 4 min, 8 s each) + coach bubbles (Quests:
         │                   story quest hint after the onboarding; Ocean: just unlocked) and the "AQUARIUM FULL" reminder
         │                   (App: a ready egg tapped with a full tank, 8 s, at most once every 3 min, never again once a
         │                   fish was released; on Ocean, or on Quests while the Ocean is locked; skipped while another
         │                   bubble or a panel is up)
         ├─ Panel            Shared modal (backdrop closes): navy window with a bevel, ribbon title (`banner` palette),
         │                   round close button on its corner, `headerExtra` under the ribbon, `width`; getWrappedHeight
         ├─ QuestPanel       Story / Daily / Weekly tabs; the card list grows up to 470 px then scrolls; a quest of a paid
         │                   line without its pass shows "LOCKED: NEEDS THE <PASS>" and a purple BUY button (BuyGamePass)
         ├─ CompanionPanel   Owned companions, equip / unequip, ability + getCompanionStats line
         ├─ FishIndexPanel   Scrolling table, one row per species, one cell per variant (its sticker once found, else the
         │                   species' dark silhouette + "?"); then the "EASTER EGGS" category (only those already hatched,
         │                   Normal cell, out of the "Discovered" count, their source / perk texts); hovering a column
         │                   header or a cell shows the variant's description (VariantTooltip)
         ├─ OceanPanel       Two columns: left, one row per kind *and* variant in the tank (a rare variant's Release asks
         │                   "Sure?" for 3 s); right, the Ocean milestones (progress bar / CLAIM! / Claimed) in a 470 px
         │                   scrolling list that opens on the first one not claimed
         ├─ ShopPanel        Gamepass shop (opened at the fisherman's hut): 2x2 grid of cards (icon slot in the pass's
         │                   colour + badge drawn in game, name, text, button); prices from GetProductInfo (cached):
         │                   "R$ <price>", "SOON" when off sale (or no id), "OWNED"
         ├─ RebirthPanel     Multiplier hero, what is lost / earned (Ocean Points preview), progress, 2-click confirm;
         │                   after rebirth 8: "Voyage complete! More aquariums arrive with the next update!"
         ├─ AquariumPanel    Customization: THEME cards (Automatic, then every theme in rebirth order, the ones not reached
         │                   locked), DECOR & FINISHES cards with a SHOWN / HIDDEN switch, TITLE buttons (getOwnedTitles; a
         │                   leaderboard title with its rank: "OCEAN LEGEND #2"); scrolls past 470 px. The Customize button
         │                   shows once a rebirth, a cosmetic or a leaderboard title is held
         ├─ LeaderboardBoard Face of a leaderboard sign (FigCraft leaderboards.figcraft), 440 x 540 px: ribbon title and
         │                   medallion (Ocean icon / coin / drawn clock), 10 rows of a ScrollingFrame holding up to 100
         │                   (medals 1-3, avatar headshot, display name, score; own row green), the player's rank ("100+")
         │                   and score at the bottom. Scores with letters ("$7.2M/s", "212h 05m") in Fredoka
         ├─ LikeBoard        Face of a like board (likes, "a like = x2" hint or boost countdown), mounted by LikeBoardController
         ├─ LikeBoostPill    The owner's own like boost ("Liked! Coins x2 4:32"), under the top HUD
         └─ QuestBoostPill   The quest coin boost left ("QUEST BOOST x2 4:32", "PAUSED" when the tank doesn't produce)
```

**Studio-side (place file, not in Rojo):**

- **`Workspace.Lobby`**: 6 `Aquarium` models (Aquarium1–6 at x = −64 / 0 / 64, z = ±16). Each has a PrimaryPart
  `Base`, an `AquariumWater` part and the Studio `Decorations` (basic theme, removed at runtime). Beach decor, the
  `LobbySpawn` (x 100), the `WelcomeSign` at the north end (108, 0, 64), and two identical fishing huts, the shop, at
  both ends of the central aisle: `FishingHutEast` (113, 0, 0, facing −X) and `FishingHutWest` (−113, 0, 0, facing +X).
  Each: `Hut` (driftwood shack, counter window), `Fisherman` (tag `ShopKeeper`, PrimaryPart its MeshPart, no
  collision), `SignAnchor` (a BillboardGui "SHOP" plate). Layout constraints: `docs/agent-notes/lobby-decor-constraints.md`.
  `Leaderboards` (folder): an alcove of three signs in the north-west corner, turned 30° from the north fence toward
  the middle of the lobby (along the corner's diagonal, open to players coming from either side): `OceanPointsBoard`
  (centre, ground (−103, 0, 67), screen 11 studs wide), `IncomeBoard` (north-east, the viewers' left) and
  `PlayTimeBoard` (south-west), 8 wide, turned 35° toward the viewers. 4.8 studs from the west fence, 2.5 from the
  north one, 3.5 west of the line where they would start to cover Aquarium4 in its 2.5D view. Each: tag `Leaderboard`, attribute `Board`, PrimaryPart `Screen` (its Front face carries the board; keep
  the 440 : 540 aspect), whitewashed planks, driftwood trims, posts with rope and white caps, a lobby Starfish /
  Seashell clone on top (`Topper`). Parts only, nothing uploaded.
- **Template layout** (every model below): invisible root (`Body`; `Hitbox` x1.25 for coins) + welded `Mesh`
  MeshPart, head / front toward −Z, texture in a **SurfaceAppearance** (tinted by its `Color` when needed), built at
  the right size (never `ScaleTo`: CompanionService tweens back to scale 1). Generated meshes, ≤ ~4k triangles.
- **`ServerStorage.Assets`**:
  - `Fish/` (tag `FishTemplate`, attr `FishType`): the 18 species + `FrenchFish` and `AlienFish` (no FishVariants).
    Copied on demand into `ReplicatedStorage.Assets.Fish` (server/fishAssets); `ReplicatedStorage.Assets` is an empty
    folder in the place, filled at runtime. Oddities: the Golden Guppy's ColorMap is a 1024² copy (the generated one
    was 4096²); `MiniLeviathan` is pitched −30° about X inside its template (the mesh came out upright; never yaw a
    mesh in its template: FishAnimationController deforms in mesh-local Z); `Dragonfish` is tinted gold
    (SurfaceAppearance Color 1/0.85/0.45); the `Lanternfish` species (photophores, no lure) is not the Abyss event's
    `LanternFish`.
  - `FishVariants/` (tag `FishVariantAppearance`, attrs `FishType` + `Variant`): one SurfaceAppearance per species for
    Anomaly and Shiny (recoloured ColorMap, ids in variant-spec.json), copied on demand like the models. A game
    script can't set a texture, so FishRenderController swaps a clone in place of the template's.
  - `Coins/` (tag `CoinTemplate`, attr `CoinType`): one per species' coin + `CroissantCoin` (French Fish); object
    meshes come with their front on local −X: rotated so they face the glass.
  - `EventFish/` (tag `EventFishTemplate`, attr `EventType`): `KpopIdol` (Kpop), `LanternFish` (Abyss: near-black
    anglerfish, welded parts lit / faded by the client: `Lure` and per eye an `EyeShell`, a red Neon `Eye` and a
    `Pupil`), `Ufo` (Ufo: silver saucer, root `Body` 8 × 4 × 8), `SaxCrab` (Island: a coral crab holding a golden
    saxophone at its side, 54 Parts, no mesh, nothing uploaded; invisible anchored `Body` 6.3 × 3.5 × 3.7, face toward
    −Z; Motor6D `Dance` Body → `Hips` (the crab's 27 parts welded to it, pivot at the bottom of the shell), Motor6D
    `Sway` Hips → `SaxRoot` (saxophone and claws, pivot at their centre; Attachments `Grip1` / `Grip2` at
    the claws' centres) and two Motor6D `Arm` Hips → each arm (pivot at the shoulder, ObjectValue `Grip` → its
    Attachment); no `Mesh` MeshPart, so no swim deformation or beat puff). The saxophone has no mouthpiece and stays away from the face (moderation,
    CLAUDE.md §7).
  - `Companions/` (tag `CompanionTemplate`, attr `CompanionType`): `Snail`, `Pelican`, `WaterHen`, `Swordfish`,
    `Jellyfish`; `Lobby/` (decor).
  - `Food/` (tag `FoodTemplate`, attr `FoodLook`; a single anchored MeshPart, its size is the food's): `Shrimp`.
  - `LikeBoards/LikeBoard` (tag `LikeBoardTemplate`): driftwood lectern, PrimaryPart `Root` at ground level, front
    −Z, invisible `Board` part whose Front face carries the counter (SurfaceGui density = BOARD_CANVAS_WIDTH / the
    Board's width, so it can be rescaled). LikeService clones it at `aquarium frame × LIKE_BOARD_OFFSET`.
  - `Decor/` (tag `DecorTemplate`, attr `Cosmetic`, PrimaryPart Mesh): `WhaleStatue`, `GoldenTrophy`, `Incubator`
    (the Golden Incubator).
  - `AquariumThemes/<Theme>` (tag `AquariumThemeTemplate`, attr `Theme`): PrimaryPart `Origin` = the tank frame,
    `Style/` parts named like the tank's (Sand, Backdrop, Base, Plinth, Rim*, `Water`: every theme has one, so a tank
    changing owner gets its water back; look + children such as a painted backdrop SurfaceGui copied onto the tank),
    `Decor/` cloned into the tank (CanQuery off, low along the back and sides: fish and coins stay visible; props rest
    on the sand, whose top is at y = 3.5 above `Origin`, or sink ~0.1 into it).
    Backdrops are SurfaceGuis drawn with Frames only (no uploaded image); props are generated meshes. Each theme left
    out the props at risk of moderation (CLAUDE.md §7): no cannons, skulls, swords, bottles, trident,
    torches, flames, smoke, faces; magma is flat Neon veins (a rock ring around a glow read as a campfire).
- `Workspace.StreamingEnabled = true`. All tanks are within ~130 studs of each other, so streaming does not cull them.

---

## 3. Data & events flow

### 3.1 Player state

- **Saving (ProfileStore).** `DataService` opens one profile per player (store `PlayerData_v1`, key
  `Player_<UserId>`), holding a `SaveData` (`server/saveData.ts`): `player` (the PlayerData below, synced to the
  client), `tank` (the fish: type, adult scale, age, hunger and time left, variant; not a UFO effect), `stats` (`server/playerStats.ts`,
  never synced; read offline by `npm run stats`) and `leaderboardBanned` (moderation, server only: kept off the
  leaderboards; set by hand while the player is offline, docs/agent-notes/player-stats.md). On load: `Reconcile()` (fields added to `DEFAULT_PLAYER_DATA`
  since), then `sanitizeSave` (drops ids removed from the config, migrates old shapes, restarts the story where it
  was). A failed load kicks the player (never play on unsaved default data). `getData` is undefined until loaded:
  actions sent before are ignored.
- **When it saves.** Auto-save every 60 s (`AUTO_SAVE_PERIOD`, the most a server crash can lose), on leave
  (`EndSession`) and on shutdown (ProfileStore's BindToClose). The session lock prevents two servers from using the
  same profile (the older one ends its session and kicks the player). Right before each save, `onSave` hooks write
  runtime state into the profile: FishService writes the tank (also in its own PlayerRemoving, before cleaning up).
- **Restoring.** `onLoaded` hooks: FishService waits for the aquarium, then respawns `PlayerData.fish` (the count
  is the authority) using the saved fish for age / size / hunger (extra ones are newborn). Companions come back
  through CompanionService's refresh loop, the onboarding resumes at its saved step, eggs keep their absolute hatch
  time. Not saved: coins and food in the water, the frozen onboarding coin (dropped again).
- **Offline rules.** Eggs keep incubating offline (absolute hatch time), at the speed they had at the disconnection.
  A like boost is lost when its owner leaves. Nothing else moves: no offline income or coins, and hunger and growth
  are frozen (saved as time left / age, like the AFK freeze). Events live on each server and are never saved.
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
  | `fishVariants` | Of those, per type, the living rare variants (normal = fish − these; `getLivingVariant`). DataService keeps it (hatch / removal / changeFish), RebirthService clears it, `sanitizeSave` rebuilds it from the tank |
  | `hatched` | Count ever hatched, per type (Fish Index) |
  | `hatchedVariants` | Of those, per type, the rare variants (no `Normal` key: normal = hatched − these; `getHatchedVariant`) |
  | `incubating` | Per egg type, the hatch times of its eggs (soonest first, at most `incubators`) |
  | `incubators` | Eggs of the same type that can incubate at once (1; Ocean milestone kind `Incubator`), kept through rebirths |
  | `incubationMultiplier` | Hatch speed the `incubating` timers run at (1, or the Water Hen's): `syncIncubationSpeed` rescales them when `getHatchMultiplier` changes, the progress made is kept |
  | `eggsBought` | Eggs bought per type (unlocks the next egg) |
  | `onboarding` | Current onboarding step |
  | `capacity` | Max living fish in the tank |
  | `quests` | `{lines, daily, weekly}`: `lines` = current quest per open story line (a finished line keeps its last quest, claimed) |
  | `companions`, `equippedCompanions`, `companionSlots` | Owned companions, equipped ones, slots (read through getCompanionSlots) |
  | `oceanPoints` | Ocean score (only grows) |
  | `oceanRewardsClaimed` | Ocean milestones claimed (kept through rebirths) |
  | `features`, `tutorialsDone` | Unlocked features, and those whose tutorial was seen |
  | `likesReceived`, `lastLikeGivenAt` | Likes received, last like given (cooldown, server time). The boost itself is not saved |
  | `themeChoice`, `hiddenCosmetics`, `titleChoice` | The aquarium choices (customization.ts): theme worn ("Auto" = the newest reached), earned decor / finishes hidden (everything earned shows by default), title shown ("Auto" = the best, "None") |
  | `leaderboardRanks`, `leaderboardRanksDay` | The player's rank (1–10) in the day's top 10 of each board, and that UTC day: the leaderboard titles held. Written only by LeaderboardService from the daily snapshot (at join and when a new day's comes); ranks of an older day are cleared at join |
  | `coinBoostSeconds` | Quest coin boost left (daily / weekly rewards): adds up, runs down only while the tank produces, kept through rebirths |
  | `starPower` | Star power kept from a starfall (0–3 bars): the next opened egg draws its variant from getStarVariantOdds and spends it; kept through rebirths |
  | `starCharge` | The star gauge of the starfall running now (0 otherwise): banked into starPower at the event's end, or by sanitizeSave if the player left mid-event (without the floor) |
  | `rebirths` | Rebirths done: coin multiplier and aquarium theme |
  | `perks` | Permanent quest bonuses (shared/types/perks), kept through rebirths |
  | `cosmetics` | Titles, decor and finishes earned (shared/types/cosmetics), kept forever |
  | `passes` | Gamepasses owned: written only by GamePassService from Roblox (checked again at each join). Read by FishService (coins x1.5), OceanService / getRebirthOceanPoints (x2), EggService (luck x2), getCompanionSlots (+1), the paid quest lines |

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
| | `AdminStartEvent` (GameEventType), `AdminStopEvent` (no payload): admin panel, refused without `canUseAdminPanel` | AdminService |
| | `WatchAquariums` (PlotIndex[], ≤ 6, debounced 0.25 s): only changes what this client receives | FishService |
| | `GiveLike` (PlotIndex, from the board's prompt) | LikeService |
| | `Rebirth` (no payload) | RebirthService |
| | `BuyGamePass` (GamePass): shows Roblox's prompt; the pass itself comes from Roblox | GamePassService |
| `Interact` (rate-limited) | `DropFood` (Vector3) | FoodService |
| | `CollectCoin` (coin hitbox) | CoinService (must stand at own tank) |
| | `CatchStar` (star hitbox) | StarfallService (own star, must stand at own tank) |

New actions: `DataService.registerAction(name, tCheck, handler)` on the server, then a callback in `AppProps` →
`UiController` that fires `RequestAction`. Document them in `network.ts`.

### 3.3 Server → client

| Remote | Content | Consumer |
|---|---|---|
| `SyncPlayerData` | Full PlayerData | UiController (+ CapacityPlaque…) |
| `Notify` | `(message, "info"\|"warning")` | HudController toast |
| `EggHatched` | `{eggType, fishType, variant, firstTime, starPowered}` (first of that type *and* variant) | UiController → EggReveal (the server drops the fish after `HATCH_REVEAL_TIME`) |
| `Reward` | `{title, subtitle, amount, item?: {icon, name, image?}}` | RewardPopup (after any reveal) |
| `MoneyPopup` | `{position, amount, special, ocean?, stolen?, ghost?}` | IncomePopupController |
| `PlaySfx` | `(SfxName, pitch)` | AudioController |
| `LeaderboardSync` | `{boards: Record<LeaderboardId, LeaderboardEntry[]>, own?}` (every 30 s, at join) | LeaderboardController |
| `FishSync` | `FishMessage`: `Tank` (full state of a newly watched tank), `Spawn`, `Swim` (new segment), `State` (hunger, growth, paused, UFO effect), `Remove` (Eaten / Released / Gone / Abducted), `Scream` (an alien fish) | FishRenderController |

**Replicated state outside remotes:**

- **Tag / attribute replication:** `Coin` hitboxes carry `Special`, `Frozen`, `Bubble` and `Ghost`. `Companion` models
  carry `Owner` and `CompanionType` (feeders also their charge attributes). `EventFish` models carry `EventType` (the
  lantern fish also `Lurking`; a UFO `Beaming`). `Star` hitboxes (starfall) carry `StarSize`, then `Fading` or
  `Caught`. Tanks carry `OwnerUserId`, `Likes`, `LikeBoostEndsAt`, `Theme` and the
  `INCOME_ATTRIBUTES`. `LikeBoard` models carry `PlotIndex`; `Leaderboard` signs carry `Board`. Players carry `EventImmune`,
  `CoinBoostSeconds` /
  `CoinBoostRunning`, `TestSpeed` (the owner's test chip) and `AdminPanel` (may open the admin panel).
- **Events:** ReplicatedStorage attributes `EventType`, `EventStartsAt`, `EventEndsAt` and `EventSource`
  ("Recurring" / "Admin") (`EVENT_ATTRIBUTES`), with beats computed from `Workspace.GetServerTimeNow()`. Players carry
  `EventImmune` (true until loaded and while in the tutorial; absent = immune).
- **Fish movement:** nothing is replicated per frame. Each SwimSegment (start pose, target, start time, turn / move
  durations) is sent once to the watchers of the tank, and both sides evaluate
  `getSwimPose(segment, Workspace.GetServerTimeNow())`. `Fish` models are client-local (attributes `FishId`,
  `FishType`, `Variant`, `Hunger`, `GrowthStage`, `Paused`, `Dead`, `Asleep`). Companions, event guests, coins and food
  are server parts moved by server tweens.

### 3.4 Key flows

- **Egg.** `BuyEgg` → the server checks that an incubator of that type is free (`hasFreeIncubator`), the price and
  the gate, debits the money and pushes the hatch time into the type's sorted list. Once ready, `OpenEgg` → the server
  takes the soonest egg of the type, checks it is ready and the capacity, draws the fish (`getDrawOdds`) and the
  variant, bumps `fish` and `hatched`, fires `EggHatched` and, after the reveal, `FishService.spawnFish`, which runs
  the `onFishSpawned` callbacks (onboarding, quest gauges).
- **Variants.** `rollVariant` draws Shiny → Ghost → Anomaly → Normal with the player's luck (the onboarding egg is
  always Normal). Effects, server-side: Anomaly drops coins 1.2x as often; Ghost's sparkling coins become ghost coins
  (translucent, worth `GHOST_COIN_MULTIPLIER` = 3 sparkling ones); Shiny has the anomaly pace and one sparkling coin out
  of 5 instead of 15. Looks, client-side: Anomaly / Shiny wear their FishVariantAppearance, a ghost turns 50 %
  translucent and pale, a shiny twinkles. A variant fish whose owner leaves during its hatch reveal comes back as a
  newborn normal one (the tank is saved before it spawns).
- **Easter eggs.** `getDrawOdds` hides each easter egg fish with a `hatchChance` > 0 in every egg (taken from the egg's
  most common fish); the UI only ever shows `EGG_TYPES` odds (the reveal shows "SECRET"). An easter egg hatches Normal
  and counts as a fish of the tank (capacity, saves, releases, rebirth points). Each carries its Fish Index texts
  (`source`, `perk`). **French Fish** (0.1 % of any egg): a croissant every 60 s worth `incomeShare` (0.5) of
  `FishService.getTankIncomePerMinute`, then the usual multipliers; it leaves after `lifetime` (1 h of age, pushed back
  while frozen: offline and paused time don't count) and `onFishLeft` lets OceanService credit its points with a
  notice. **Alien Fish**: `hatchChance` 0 (only from the UFO night), no coin, no lifetime; every `screamInterval` (30 s
  of play) it screams: every other awake, present fish drops one plain coin (a weak one farts) on top of its own.
- **Coins.** `FishService.tick` (every 0.25 s) calls `dropCoin` (value x rebirth, like, pass, quest boost, event, UFO
  effect, test speed), which uses `CoinService.spawnCoin`; the coin sinks and expires 5 s (+ perks) after reaching the
  sand. Collected by a click (`CollectCoin`) or by the Snail / the Swordfish; `credit()` adds the money, fires
  `MoneyPopup` and runs the `onCollected` callbacks (quests, onboarding, stats).
- **Hunger.** Satiated (30 s) → Hungry (15 s) → Weak (until fed; it never dies). A weak fish swims at 35 % speed, is
  tinted dull and farts a 1 $ bubble instead of its coin ("WeakBubble" SFX at most every 2.5 s per player, "FishWeak"
  SFX and a notice at most every 30 s). `DropFood` drops a paid pellet; a fish chases it and eats it, back to Satiated.
  Species flagged `cannibal` eat smaller fish when weak (none yet). Hunger, growth and coins all stop while the owner
  is AFK (not tending) or still in the onboarding.
- **Companions** (CompanionService). **Snail** (3.6 studs/s x its Ocean upgrade): goes for the coin it can pick up
  soonest (crawl time vs sinking time), picks coins up on the way. **Pelican**: perched on the back rim near the left
  corner; every `PELICAN_FEED_INTERVAL` (÷ its Ocean upgrade), while its owner tends the tank after the tutorial, turns
  to a hungry fish or a random spot and throws a pellet from its beak (PelicanDouble: 2 pellets; PelicanCharges: on
  demand instead, up to 2 charges refilled one per interval, spent at once when a fish is hungry and no food is in the
  water). **Water Hen**: floats on the surface, bobs and paddles to spots in the front 45 % of the tank; its ability is
  EggService's hatch multiplier. **Swordfish**: swims anywhere in the water toward the coin findCoinToFetch picks
  (surface as pickup height), 0.95x the Snail's speed across the tank, dives / climbs at 6 studs/s, grabs within its
  reach (perks: getSwordfishStats; the reach also covers the gap to the closest point its body may go), cruises at
  2 studs/s otherwise. **Jellyfish**: drifts in the top 35 % of the water; on demand like the Smart Pelican, swoops over
  the hungriest fish and releases its pellets 1.4 studs apart (getJellyfishStats).
- **Quests.** `QuestService.addProgress(stat, amount, subject)` handles the counters (CoinMoney excludes the
  onboarding coin; CoinsCollected counts every coin; FishFed only food the player dropped; CompanionStat per
  companion: Snail / Swordfish coins, Pelican / Jellyfish feeds, eggs opened with the Water Hen equipped): a quest
  with a `fishType` / `variant` / `companion` only counts its own. `reportGauges` reads every gauge from PlayerData on
  each coin, spawn, claim, rebirth and every 5 s: a gauge quest already met completes as it opens (the Voyage line
  never blocks). A completed quest gets a notification and a badge; `ClaimQuest` grants the reward. **Story lines run
  in parallel** (STORY_LINES): each open line has one current quest; claiming one starts its line's next quest (the
  last one stays, claimed; a quest added later to the line starts on the next join) and opens the lines that
  `requires` it (`refreshStoryLines`, also run on load and every 5 s, so a `requiresCompanion` line shows up within
  5 s). Start (Story1 "Coin Collector" → the Snail) opens Ocean (Story2 "Full House" → the Ocean feature), Rebirth
  (Story9 "Saving Up": gauge MoneyHeld = REBIRTHS[0].price, written out because rebirths.ts can't be imported by
  quests.ts → the "Rebirth" feature, then the 16 Voyage quests: a signature species or a rebirth per aquarium, to
  "Master Aquarist") and Hatchery; the Snail / Pelican lines give perks; the paid lines (`requiresPass`) count nothing
  and can't be claimed without the pass (`isQuestLocked`). Goals and rewards of every line: `quests.ts` and BALANCE.md
  §5.9. Daily / weekly boards: 3 quests per period drawn from the pools, the same draw for every player, reward
  `CoinBoost {minutes}` → PlayerData.coinBoostSeconds.
- **Ocean.** `ReleaseFish {fishType, variant}`: the server checks the feature, that one of that kind *and* variant is
  alive and that `MIN_FISH_KEPT` fish remain. It releases the one of them that earns the least (lowest growth stage,
  then smallest, then youngest), credits `getOceanPoints(fishType, variant)` (x pass, test speed) and fires
  `MoneyPopup{ocean}`. A rebirth counts the same way (`getRebirthOceanPoints`). The tutorial is the coach bubble, then
  the PanelCoach; "Got it!" or a first release sends `FinishTutorial`.
- **Ocean milestones.** `ClaimOceanReward`: the server checks the feature, `oceanPoints >= points` and that it wasn't
  claimed, pushes the id to `oceanRewardsClaimed` and grants: a companion (`CompanionService.grant`, equipped if a slot
  is free), a companion slot, a companion upgrade (read live through `getCompanionMultiplier`), a bigger tank
  (`capacity = max(capacity, n)`), more incubators, a variant luck (read live through `getVariantLuck`) or cosmetics
  (`DataService.addCosmetic`), then a Reward popup. Points are never spent. The Ocean button gets a badge while one is
  claimable.
- **Event sources.** *Recurring*: each server's clock starts with the server and again when any event ends. From
  minute 5 each new minute draws once, chance (m − 4) / 11 (minute 15: 100 %), only while at least one player isn't
  immune; it then picks a random event with `recurring: true` (Island, Abyss, Ufo or Starfall). *Admin*: "/event <name>" (`isAdmin`)
  starts any event with admin behaviour: locally, then MessagingService to every server, and a MemoryStore entry
  (expiring with the event) that servers started later join (if > 5 s left). An admin event replaces whatever runs; a
  recurring event never starts over one. "/event stop" ends the running event (everywhere if admin). In Studio the
  command and the admin panel only touch the playtest server. *Immunity*: EventService sets `EventImmune` every
  second (not loaded or onboarding not Done); immune owners get no guest, no raid, no UFO, no star and no coin bonus, and
  MusicEventController hides the event from them; when the tutorial ends mid-event, the event joins them.
- **Music event.** `EventService.startEvent` sets the attributes; the server beat loop drops the beat coins. *Flat*
  (K-pop, admin): `FishService.dropBeatCoins(chance)` on every beat, the same chance for every fish. *Paced* (Island
  Breeze, recurring): on one beat out of `every` (2: the track's accented backbeat), `dropPacedBeatCoins(seconds)`, each
  fish dropping with chance seconds / its own payout interval (variant included), seconds = boost x 2 beats, the boost
  growing 0.5 → 1.5 over the event: every fish earns x2 of its own income on average. The finale (last drop beat
  ≥ 2.5 s before the end) drops every fish's coin at once (`dropBeatCoins(1)`), then the beat drops nothing more.
  Client: MusicEventController (music, beats, `onBeat` → FishAnimationController puffs, banner, the guest's effects in
  the event's `EVENT_BANNER_STYLES` accents). *Guest move* (`guestMove`): "Swim" (K-pop idol) wanders through the
  water like a fish with pauses facing the glass; "Walk" (the saxophone crab) stays on the sand on a lane 35 % of the
  half depth toward the glass, always facing it, and steps sideways (2.2 studs/s, steps ≥ 3 studs, 0.8–3 s dancing on
  each spot). *Dance* (guests with the `GUEST_DANCE_JOINTS` Motor6Ds, client-only `Transform` every frame on the
  track's position, `getCarryPose`): the instrument goes from one side of the body to the other and back on an 8-beat
  cycle: 2 beats on its side (one 12° lean outward), 2 beats across (low in front of the belly, 0.85 stud down halfway,
  tipped flat with its top leading, so its neck never passes the face), 2 beats on the other side (tilt mirrored), 2
  beats back; the body rocks ±6° and dips 0.3 stud on every beat, with little hops while it walks; each arm is turned and stretched from its shoulder to its grip every frame (worked out from the
  joints in the hips' space, no frame of lag).
- **Abyssal raid.** `AbyssService.run` until the end: in each owned tank, a loop waits for a coin (`findCoinToSteal`:
  most valuable, not frozen / bubble, ≥ 2.5 s left on the sand), then makes a pass, again and again (0.8–2.2 s of rest):
  the server clones `LanternFish` at the back of the tank, `Lurking` = true then false; it glides 1.2 s at 3 studs/s
  (lure and eyes fade in on the clients), then darts at up to 9 studs/s following the coin (while still emerging it
  may switch target; later a coin collected first or expired is a miss). Within reach it calls `stealCoin` (no credit,
  "-X$" popup, CoinStolen SFX) and carries the coin welded to its mouth, then `Lurking` = true: it swims back into the
  dark and is destroyed. Moved by the server (Heartbeat). While it runs every coin is worth x1.5 (`coinMultiplier`).
  Client: AbyssEventController (2.5 s fades), banner glowing cyan ↔ red, the event's track crossfades over the music.
- **UFO night.** `UfoService.run` (recurring, 60 s). Per owned tank a UFO flies in from high up, hovers 5 studs above
  the water over a random fish (not an easter egg, not already taken), beams it up (`Beaming`, UfoBeam SFX;
  `FishService.beamUp`: the fish is `held` on a segment up to the UFO, then `away`: Remove "Abducted", frozen), flies
  off (2.2 s), comes back over another spot and beams it down (`beamDown` → Spawn with a falling segment). ~12.2 s a
  kidnapping, none starts that couldn't end in time. Outcome drawn when it is taken (`drawUfoOutcome`, or the owner's
  forced one in Studio): **Sleep** (1 min frozen), **Green** / **Red** (1 min of coins x2 / x0.5), **Variant** (the next
  variant for good: `DataService.changeFish`; a Shiny gets Green), **Alien** (replaced by an AlienFish; hatched counts
  it). The minute counts only while the tank produces. The owner gets a notice (warning for Sleep / Red).
- **Starfall.** `StarfallService.run` (recurring, 60 s, no template). Per owned tank (not immune; a tank joining late
  gets its share for the time left) 16–20 stars, one per slot of equal length from 2 s after the start to 8 s before
  the end, size drawn by weight. A star is an invisible anchored ball (tag `Star`, attribute `StarSize`) in the tank's
  Coins folder: it streaks in on a slant from 38 studs above and 20 to a side (30 studs/s), sinks slowly (2.4 studs/s),
  lies 6 s on the sand (`Fading` for the last 1.5 s), then vanishes. `CatchStar` (the owner, at the tank) adds its
  power (random in its size's range) to `starCharge`, sets `Caught` (the clients burst it) and plays StarCatch higher
  as the gauge fills. `stop()` (the end, an admin stop or replacement) turns each gauge into
  `getFinalStarCharge` (at least 1.5 x the share caught) and keeps the better of it and `starPower`, with a notice.
  `EggService.openEgg`: with `starPower` > 0 (not the onboarding egg, not an easter egg), the variant comes from
  `rollStarVariant(power, luck)` and the power is spent. Client: StarfallEventController, StarGauge (during the
  event), StarPowerPill (after it), banner.
- **Leaderboards.** LeaderboardService samples each player's scores (Ocean Points, `getSteadyIncomePerSecond`,
  `PlayerStats.playSeconds`) on every push, write and save. Every 2 min it `SetAsync`s the changed ones into the
  board's OrderedDataStore and reads the top 100 (`GetSortedAsync`), and it writes the last sample when the player
  leaves (sampled by the final save's onSave, before FishService empties the tank). A player counts only 30 s after
  loading (the tank respawns its fish first). Every 30 s the server's live players replace their stored entry, the
  lists are re-sorted and cut to 100, and each client gets `LeaderboardSync` with its own scores. A profile with
  `SaveData.leaderboardBanned` (moderation) or `testSpeedUsed` (the owner's `/speed`) is left out and its entries
  removed from the stores.
- **Leaderboard titles.** Every minute each server checks the UTC day. Without today's snapshot in memory it reads the
  DataStore key (`LeaderboardTitles_v1` / `Daily`: `{day, ranks: {board: UserIds best first}}`); if that one is
  older, the server takes a new one from the stores' top 10 (`GetSortedAsync(false, 10)`, all three boards or nothing)
  and writes it with `UpdateAsync`, keeping an already newer value (the first server to see the day wins). Each
  loaded player then gets `leaderboardRanks` from it (none for an excluded profile), with a notice per title gained
  or lost. Offline players need nothing: their ranks are recomputed when they join. Titles: Ocean Legend (Ocean
  Points), Tank Tycoon (income), Devoted Keeper (time); "Auto" wears the best rank first, then the earned titles.
- **Rebirth.** Claiming "Saving Up" unlocks the "Rebirth" feature: a notice, the side button with a "NEW" coach
  bubble (its tutorial ends when the menu opens) and a "!" badge whenever a rebirth is affordable. "Rebirth" needs a
  second click. Server: refused during a hatch reveal; Ocean Points from `getRebirthOceanPoints` (variants included),
  `FishService.releaseAll`, `CoinService.clearOwner`, then money = start money, fish / incubating / eggsBought reset
  (free starter egg again), `rebirths + 1`, reward popup. Kept: Fish Index, quests, companions, Ocean Points and
  milestones, features, perks, cosmetics, likes, coin boost. After rebirth 8 the menu says more aquariums are coming.
- **Likes.** Another player's board shows a local ProximityPrompt (E, 10 studs; its text shows the cooldown). It
  sends `GiveLike`; the server checks the giver is within `LIKE_RANGE` of the board, that the tank has an owner who
  isn't the giver, and the giver's cooldown (`lastLikeGivenAt` + 1 h, any tank). Then `likesReceived += 1` and the
  owner's boost restarts at 5 min (it never adds up), both players are notified. The boost is session-only
  (LikeService memory) and reaches the clients through the aquarium's `LikeBoostEndsAt` attribute (board + pill).
- **Onboarding.** EnterView → BuyEgg (free) → Hatching → OpenEgg → CollectCoin (frozen coin) → CoinCollected →
  Feed (free food) → Done (+300 $). Menus (side buttons) appear only once the onboarding is Done.
  `STORY_QUEST_HINT_DELAY` later, a coach bubble on the Quests button points at the Snail quest (client-only: shows only
  if the onboarding was played in this session and Story1 is still to claim; ends when the book is opened).
- **Gamepasses.** Shop card → `BuyGamePass` → GamePassService checks the pass has an id and isn't owned, then
  `MarketplaceService.PromptGamePassPurchase`; Roblox fires `PromptGamePassPurchaseFinished` on the server, which adds
  the pass to `PlayerData.passes`, syncs and sends a thank-you Reward. Passes are asked again from Roblox at each join
  (a refund takes it away; an outage keeps the save). Effects are read live where they act: coin value x1.5 (every
  coin incl. the croissant; not the 1 $ bubbles nor IncomeMinutes rewards), Ocean Points x2 on fish going to the ocean
  (fixed quest rewards are not doubled), variant luck x2 (stacks with Lucky ocean), +1 companion slot. The client shows
  the same numbers (income plaque, Ocean rows, Rebirth preview).

---

## 4. Known limits / next steps

- **Saves in Studio** need *Game Settings → Security → Enable Studio Access to API Services*; without it ProfileStore
  runs on a mock store (warning in the output) and nothing persists between playtests. Studio and live servers
  share the same store. Reset everyone by bumping `STORE_NAME`; reset your own save in a Studio playtest with
  `/datareset` then `/datareset confirm`. `DataService.resetSave` skips the onSave hooks and `getSave` for that
  player, so nothing of the old run is written back into the fresh profile. Progression playtests run on a test store
  (`// TEMP TEST`, see docs/agent-notes/fish-asset-pipeline.md).
- **Crash**: a hard server crash (no BindToClose) loses up to `AUTO_SAVE_PERIOD` (60 s) of progress; the profile
  stays locked until ProfileStore considers the dead session expired.
- **Network**: one fish message per wander step (~every 2–5 s per fish) and per chase step (every 0.25 s, only while
  food is in the water), sent only to the clients watching that tank. A chase segment covers 1 s of swimming
  (`CHASE_LOOKAHEAD`) and is replaced after 0.25 s, so its end is never reached. Coins, food, companions and event
  guests are still server-tweened (≈ 0.4 KB/s per sinking coin: the candidates if they become numerous).
- **Performance** (load test with 18 species, 2026-11-01, Studio solo, 6 tanks x 25 fish): every view at 60 fps
  (aisle view: scripts 6.9 ms, render CPU 11.0 ms, GPU 2.5 ms; 2.5D view of an 18-species tank: 4.2 / 7.8 / 2.1 ms);
  server negligible. The swim animation costs per *species* on screen, not per fish; weak devices feel it first. Real
  mobile memory: to check with the first players (ROADMAP M7). Studio caps at 15 fps when its window loses focus:
  steady 66.7 ms frames are that cap, not load.
- **EditableMesh budget**: the client budget counts **triangles** (~81,000 on the owner's PC; a phone likely less);
  when full, `CreateEditableMeshAsync` returns **nil** (no error) and `Destroy()` frees it at once. Meshes range 2.5k
  (Golden Guppy) to 8.4k triangles (Husky Dogfish, Bunny Shark). FishAnimationController plans the rigs in triangles
  (`INITIAL_TRIANGLE_BUDGET` 72k, `MAX_ANIMATED_SPECIES` 6 as a CPU cap), builds them one at a time under one lock,
  lowers its budget to what is built the first time the device refuses (local attribute `SwimTriangleBudget`), frees
  idle rigs when another species needs the room, and visible fish left without a rig **sway** (yaw + a little roll on
  a local Weld). Simulated phone (~30k free): every visible fish animated or swaying. The real fix is
  `ROADMAP_V1.1.md` (bones). Keep new fish meshes ≤ ~4k triangles, textures 512².
- **Many species** (goal: dozens): server, network and saves only pay per fish; templates load on demand
  (server/fishAssets), so clients only download the species present. Production (mesh + icon + config + balance per
  species) is the real limit: colour variants of a mesh cost almost nothing.
- **Studio captures** don't show BillboardGuis parented to PlayerGui (hunger badges, popups): check them by script.
- **Roblox moderation**: a "Firefighter" fish was dropped, its icon got the account a warning (a nozzle in its mouth,
  read as a cigarette). Rules in CLAUDE.md §7.
- **Left before V1** (the owner's): gamepass prices at the alpha release, then the calibration with real players
  (`npm run stats` vs BALANCE.md §2). Kpop is the only admin-only
  event (its flat beat coins give a 30 s fish x14 for a minute); the UFO night's track is `musicId` 87373069356270.
- **Starfall**: its track is `musicId` 88076339607645 (the owner's choice). The stars are a ★ text glyph on a billboard
  (no uploaded image). The sky shooting stars over the lobby were only seen in the 2.5D view in Studio (the playtest
  camera stays on the tank).
- **Leaderboards**: DataStore budget per server ≈ 3 reads / 2 min plus ≤ 3 writes per player / 2 min (only changed
  scores). Studio playtests write to the same stores as live servers: the owner's profile stays off them only
  because it used `/speed`; test other accounts knowingly. A store failure (no API access) leaves the boards with
  this server's players only (one warning). Names come from UserService, cached per server ("..." until known).
  A SurfaceGui only takes input from PlayerGui with an Adornee, which the scrolling list needs. The wheel scrolls
  the list; whether it also zooms the camera over a sign was not checked. The titles' snapshot ranks the stored
  scores at midnight UTC (a live player's last 2 min may be missing) and Studio playtests write the real snapshot too.
- **Admin events across servers** rely on MessagingService (best effort, a few seconds of delay; a server that misses
  the message joins through the MemoryStore only when it starts). Add admins by UserId in `server/admins.ts` (the
  game's owner always is one).
- **Admin panel**: Studio playtests only for now (`canUseAdminPanel`). For the release, make it return
  `isAdmin(player)`: the button then shows for admins on live servers and its events reach every server (the scope chip
  says so). New admin tools go in their own tab (`ADMIN_TABS` + a tab component in AdminPanel.tsx + AdminService actions).
- **Playtesting**: see `docs/agent-notes/studio-mcp-ui-testing.md` and `fish-asset-pipeline.md`. In short: stand at
  the tank CFrame × (0, 5, −14) to be in the focus zone, drive flows through remotes, feed fish in long tests, and
  mark temporary test values with `// TEMP TEST`, then restore them.
