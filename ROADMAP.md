# ROADMAP — Projet Quarium V1

> The development plan from the live game (V0.35) to V1: what to build, in which order, and how. The **numbers** live
> in `BALANCE.md` §5 and `tools/balance-v1-plan.js`; this file is the **work**. Tick the boxes as tasks ship, and move
> what a milestone ships into `PROJECT_CONTEXT.md` / `RELEASE_NOTES.md` as usual.
> Last updated: 2026-11-01 (M7: side lines, daily / weekly quests and the 18-species load test in V0.46; animation stopgap shipped in V0.45, the load test as the "before" of ROADMAP_V1.1.md; M6 done in V0.44: V1 content complete; M5 done in V0.42, M4 done in V0.40, M3 done in V0.39, M2 done in V0.38, M0 in V0.37, M1 in V0.36; first version: 7 milestones, from the rebalance to rebirth 8).

**After V1**: `ROADMAP_V1.1.md`, the animation revamp (Blender skeletons instead of EditableMesh), starts once M7 is done.

**V1 in one line**: 8 rebirths / aquariums, 18 species, 12 eggs, a tank of 25 fish, 5 companions (3 slots, the third one
a gamepass), a "Voyage" main quest line to the end, ~12h15 for a free player to see everything (BALANCE.md §5.3).

---

## 1. Principles

- **Ship in slices.** Players stall at ~2h30 today (nothing after the Imperial Discus): each milestone adds the next
  aquarium(s) and is playable on its own. The end of the current content is always announced in the Rebirth menu
  ("more aquariums with the next update"), as after rebirth 2 today.
- **Numbers come from the plan.** Copy them from `tools/balance-v1-plan.js` into the config, run
  `node tools/economy-sim.js` (live) after each milestone: its first lines must match the plan's for the shipped part.
  Changing a number = re-run `--plan`, update BALANCE.md (CLAUDE.md §0c).
- **Moderation first** (CLAUDE.md §7): every new model / icon is described to the owner before it is generated when
  its theme is in the risk list of §4, previewed locally, uploaded once.
- **Performance gate**: the on-demand fish templates (M0) ship before species 13, the asset budget of each species
  (mesh ≤ ~3k vertices, 512² texture) is a rule, not a goal.

---

## 2. Milestones

Times are the median play time at which a free player reaches the content (BALANCE.md §5.3).

### M0 — Foundations (code only, no new content; shipped in V0.37)

- [x] `formatShort` / `formatNumber`: T (1e12) and Qa (1e15); money clamped at 1e15 (DataService / CoinService credit).
- [x] Shop shelf for 12 eggs: the 6 eggs around the best unlocked one, or a scrolling shelf (FigCraft first, V2 kit).
      Done as a 6-slot window with arrows (FigCraft redesign-v2 "ShopBar_V1"): they appear by themselves with egg 7.
- [x] **Several incubators per egg type**: `PlayerData.incubating` becomes a list per egg type (`sanitizeSave`
      migration), EggService / ShopBar / EggSlot show the second egg; driven by a `PlayerData` count
      (`PlayerData.incubators`; Studio test command `/incubators <n>`).
- [x] **On-demand fish templates** (PROJECT_CONTEXT §4): templates in ServerStorage, the server replicates a species
      while one swims on the server, the loading screen preloads only those; same for FishVariants.
- [x] Ocean milestone kinds: `Incubator {count}`, `HatchSpeed`… (see M4), `VariantLuck {multiplier}`, `Cosmetic`;
      the Ocean panel lists ~17 milestones (scrolling). No `HatchSpeed` kind: in plan rev. 2 the hatch speed is the
      Water Hen's (a companion milestone, M4). Cosmetics are stored (`PlayerData.cosmetics`), not displayed yet: their
      looks (title display, decor in the tank, Pearl rims) come with M5 / M6, before anything grants them.
- [x] Quest system: stats `SpeciesHatched {fishType}` (gauge from `hatched`), `Rebirths` (gauge), `EggsOpened`,
      `VariantHatched {variant}`, `IndexCells` (gauge), `FishReleased`, `CompanionStat {companion}`; rewards
      `IncomeMinutes`, `OceanPoints`, `Title`, `Decor`; a story line can require a **gamepass** (`requiresPass`).
      `SnailCoins` / `PelicanFeeds` became `CompanionStat`. Locked lines read `PlayerData.passes`, empty until M3.

### M1 — Rebalance of the live game (shipped in V0.36)

- [x] Pelican's Ocean upgrade x2.5 → **x1.33** (every 7.5 s): keeps 15 fish fed, not 25.
- [x] Snail's Ocean upgrade x1.5 → **x1.15**: ~60 % of the coins at the end of its quests.
- [x] Update the two milestone descriptions, run the simulators, BALANCE.md history, release note (Balance).

### M2 — Rebirths 3–4: Pirate Wreck and Atlantis (~3h00 → ~6h15; shipped in V0.38)

Themes already built (`PirateWreck`, `Atlantis` in ServerStorage.Assets.AquariumThemes).

- [x] Models: **Catfish**, **Blue Tang**, **Baby Sunfish** (species recipe, §3.1); their coins; Wreck and Atlantis
      egg sprites. Coins: treasure chest, sapphire, sun medallion. Catfish: a corydoras-like fish with 4 short whiskers
      hanging under the chin (a first try with a thin barbel pointing forward was dropped, §4).
- [x] Config: species 10–12, eggs Wreck (55M) and Atlantis (144M), REBIRTHS 3–4 (45M x25, 120M x80), themes wired,
      Ocean milestones 5,000 (second incubator), 8,000 (tank 17), 25,000 (tank 19), 40,000 (Lucky ocean).
- [x] Quests: Voyage line chapters Lagoon → Atlantis (BALANCE.md §5.9), with their rewards.
- [x] Check: playtest a rebirth 3 → 4 with temporary money (`// TEMP TEST`), sim, docs. Played on a separate test
      store (`PlayerData_M2Test`), so the owner's save never moved.

### M3 — Gamepasses (the shop; shipped in V0.39)

- [x] `GamePassService` (server): `UserOwnsGamePassAsync` checked per player at join, `PromptGamePassPurchaseFinished`
      to grant at once, a `passes` list synced to the client (never trusted from it); `shared/types/gamepasses.ts` (ids,
      names, effects). Passes created on the Creator Dashboard by the owner (ids in GAME_PASSES); Studio test command
      `/pass <GamePass>`. Prices are set on the Dashboard only (read by the Shop with GetProductInfo).
- [x] UI: a Shop panel (V2 kit, built without a FigCraft mock-up at the owner's request) and a Shop side button;
      "locked" quest lines show their pass with a Buy button.
- [x] Passes of this milestone: **Third companion slot**, **x2 Ocean Points**, **Lucky** (variants x2), **+50 %
      Coins** (x1.5 on every coin, sold as "+50 %"; decided, BALANCE.md §5.10).
- [x] Icons: `tools/pass-icons.js` → design/ui/passes, approved by the owner, uploaded once (ids in
      GAME_PASSES.image and V2_IMAGES.iconShop). The same 512 px PNGs can be the passes' icons on the Dashboard.
- [ ] Owner: put the 4 passes on sale (price) on the Creator Dashboard: until then the Shop cards say "Soon".

### M4 — Rebirth 5: Mariana Trench, the Water Hen and the Swordfish (~6h15 → ~8h05; shipped in V0.40)

- [x] Models: theme **Mariana Trench** (basalt spires, glass sponges, glowing anemones, a painted deep backdrop and a
      darker `Water` style part: every theme now carries one), **Lanternfish** (photophores, no lure) and its
      **Nautilus shell** coin, Trench egg (eggs.build.js, rendered with resvg), **Water Hen** and **Swordfish**; their
      stickers and the Lanternfish variant textures, approved by the owner and uploaded once.
- [x] Config: species 13, egg Trench (6.1B), REBIRTH 5 (5.1B x250), milestones 70,000 (tank 21), 85,000 (Water Hen),
      120,000 (Swordfish); Voyage 8–9.
- [x] **Water Hen**: while equipped, eggs hatch 15 % faster (EggService reads the equipped companions at purchase).
      Paid line ("Water Hen pass", id 2057906427): 3 quests → -22 %, -28 %, -35 %. It floats and paddles on the surface.
- [x] **Swordfish**: swims through the water and grabs coins while they sink (CompanionService: a swimming fetch
      loop next to the Snail's crawl); free = a maxed Snail (~60 %). Paid line ("Swordfish pass"): 3 quests → speed
      x1.4 / x1.8 / x2.2 and a wider reach: ~77 %, ~90 %, ~96 % of the coins.
- [x] Check: playtest on a test store (`PlayerData_M4Test`): rebirth 5, theme, milestones, hatch -15 %, Swordfish
      pickups, a Lanternfish hatched; sims match the plan.
- [ ] Owner: put the Water Hen Pass (2057906427) and the Swordfish Pass (2058734507) on sale on the Creator Dashboard.

### M5 — Rebirth 6: Volcanic Temple and the Jellyfish (~8h05 → ~9h50; shipped in V0.42)

- [x] Models: theme **Volcanic Temple** (generated stone arch with glowing carvings, darkened basalt, Neon magma veins
      on the sand, a painted red backdrop, a warm `Water`), **Lionfish** (soft frilly fins, no spines) and its coral fan
      coin, **Dragonfish** (horizontal, gold-tinted, red crest: "dragon" prompts give upright creatures) and its dragon
      scale coin, Volcano egg (eggs.build.js, resvg), **Jellyfish**; stickers and variant textures approved and
      uploaded once.
- [x] Config: species 14–15, egg Volcano (15.6B), REBIRTH 6 (13B x800), milestones 180,000 (tank 23), 200,000
      (Jellyfish), 300,000 (Pearl rims, shown on the rims of every theme: AquariumService); Voyage 10–11.
- [x] **Jellyfish**: feeds like an on-demand Pelican (charges, pellets), free = a maxed Pelican (15 fish): it drifts
      in the top of the water, swoops over the hungry fish and releases its pellets (FoodService.releaseFood). Paid
      line ("Jellyfish pass", id 2061499264): 3 quests → 3 charges every 6 s (19 fish), every 5 s (23), 3 pellets (25).
- [x] Check: playtest on the test store (rebirth 6, milestones, Lionfish and Dragonfish hatched, Jellyfish feeding with
      its gauge); sims match the plan.
- [ ] Owner: put the Jellyfish Pass on sale on the Creator Dashboard.

### M6 — Rebirths 7–8: Crystal Caverns and Cosmic Sanctuary, end of V1 (~9h50 → ~12h15; shipped in V0.44)

- [x] Models: themes **Crystal Caverns** (lavender sand, glowing crystal clusters, painted cave backdrop) and
      **Cosmic Sanctuary** (abstract: floating stones with Neon geometric runes, gold / violet crystals, nebula and
      ringed planets; no faces), **Husky Dogfish** (a round blue fish with a husky face; the "wolf-head" versions read
      as sharks), **Bunny Shark** (a pink shark with bunny ears: replaces the Hammerhead, every hammerhead prompt put
      the hammer on top of the head), **Mini Leviathan** (pitched 30° in its template: the mesh came out upright),
      their moon / star / planet coins, Crystal and Cosmic eggs; stickers and variant textures approved and uploaded once.
- [x] Config: species 16–18, eggs Crystal (830B) and Cosmic (1.8T), REBIRTHS 7–8 (690B x2500, 1.5T x8000),
      milestones 450,000 (tank 25), 1,000,000 (Ocean Guardian title + whale statue).
- [x] Cosmetics: **titles** above the head (TitleService: the best one earned), **decor** in the tank (whale statue,
      golden trophy: DECOR_SLOTS, placed by AquariumService with the theme).
- [x] Quests: Voyage 12–16 to "Master Aquarist" (18 species: title + golden trophy); Rebirth menu: "Voyage complete!
      ... More aquariums arrive with the next update!".
- [x] Check: playtest on the test store (rebirths 7–8 and their themes, Crystal / Cosmic eggs, the three species and a
      variant texture, milestones, title and whale statue); sims match the plan.

### M7 — Side lines, polish, launch calibration

- [x] Side lines: Hatchery, Collector, Ocean (BALANCE.md §5.9), shipped in V0.46. The Collector waits for "Full House"
      (4 story quests at once for a new player); no sticker frames (decided by the owner): its 50-cell goal gives the
      Collector title. The Golden Incubator decor: a generated nest, chosen by the owner among 3 candidates.
- [x] Daily / weekly quest pools (retention), shipped in V0.46: 6 + 6 quests, one social weekly quest (like 3
      aquariums); new stats CoinsCollected, FishFed, LikesGiven, gauges VariantFound, TotalHatched. Rewards: a **coin
      boost** (x2 for 5 min a daily, 15 min a weekly; adds up, runs only while the tank produces, saved), decided by the
      owner instead of a lump of income. The balance's reference player becomes **1 h a day with the dailies**
      (simulator `P.hoursPerDay` 1): rebirths 3–8 and their eggs x1.45 to keep the end at ~12h (BALANCE.md §2).
- [x] Load test with 18 species (PROJECT_CONTEXT §4), done in V0.46: 60 fps in every view, a simulated phone keeps
      every visible fish moving (animated or swaying). The "before" numbers of `ROADMAP_V1.1.md`. The real mobile memory
      check needs a phone: with the first players (calibration below).
- [x] Swim animation stopgap (`ROADMAP_V1.1.md` A0; the EditableMesh budget is ~81k triangles on the owner's PC, the
      6 heaviest species alone need ~83k): rigs planned in triangles, budget adapted to the device, the other visible
      fish sway. Decided by the owner and shipped in V0.45.
- [ ] Calibration with real players: compare the playtime of the first players to the plan (rebirth 3 at ~3h00,
      end at ~12h15), adjust with the simulator (BALANCE.md §5.1 levers).

---

## 3. Recipes

### 3.1 A new species

0. Prompts that work with generate_mesh: "fish swimming horizontally, side view, <shape> body longer than tall, ...,
   stylized game art"; never "cute cartoon" (front-facing chibi creatures) nor an animal word alone ("catfish" gave a
   cat). Generate 2 candidates when a feature is risky (barbels), keep the safe one.
1. **Design brief** to the owner (silhouette, colours, coin), checked against §4 and CLAUDE.md §7.
2. `generate_mesh` (≤ 3 at a time, `maxTriangles` ~4000, "fish swimming horizontally, side view, oval body…", real
   bbox), screen_capture check; template in `Assets.Fish` (tag `FishTemplate`, attr `FishType`, root `Body` + welded
   `Mesh`, head −Z, SurfaceAppearance 512²).
3. Variants: `tools/fish-variant-recolor.js` → upload the Anomaly / Shiny textures → `Assets.FishVariants`.
4. Sticker icons (`tools/fish-sticker-icons.js`, 4 variants), checked at 256×160 as a moderator, uploaded once → ids
   in `theme.ts` FISH_ICONS.
5. Coin model in `ServerStorage.Assets.Coins` (+ `CoinType`), front facing the glass.
6. Config: `FishType`, `FISH_TYPES` (from the plan), Fish Index order; remind the owner to **save the place**.
7. Playtest: hatch it (`forceNextHatch`), swim animation, growth, variants, icon in the reveal / index.

### 3.2 A new aquarium theme

1. Brief + mood board to the owner (palette, 3–5 key props, backdrop), checked against §4.
2. Build in Studio under `ServerStorage.Assets.AquariumThemes.<Theme>` (tag `AquariumThemeTemplate`, attr `Theme`,
   PrimaryPart `Origin`, `Style/` parts named like the tank's, `Decor/` low along the back and sides, CanQuery off),
   backdrop as a SurfaceGui of Frames (no uploaded image), props by `generate_mesh` tinted by SurfaceAppearance Color.
3. `AQUARIUM_THEMES` entry, rebirth wired in `REBIRTHS`; screen_capture through the focus camera: fish and coins
   stay readable, nothing hides the front.

### 3.3 A new companion

1. Brief + mesh (`ServerStorage.Assets.Companions`, tag `CompanionTemplate`, attr `CompanionType`), sticker icon.
2. `CompanionType`, `COMPANION_TYPES` (ability text), its loop in CompanionService, its perks in `perks.ts`.
3. Ocean milestone (free unlock) + its story line; for the paid companions the line has `requiresPass` and shows
   the pass in the quest book.
4. `tools/companion-sim.js` stage in the plan, BALANCE.md §5.8.

### 3.4 A new egg

Sprite (design/ui/eggs.build.js → FigCraft → PNG ×2 → upload), `EggType`, `EGG_TYPES` (price, hatch, odds,
`requires` = previous egg), shop order.

---

## 4. Moderation watch list (CLAUDE.md §7)

Every item below is **described to the owner and approved before anything is generated**.

| Item | Risk | Design rule |
|---|---|---|
| Swordfish | Its bill is a "sword": a thin pointed cylinder = weapon | Short, thick, rounded bill (a soft cone, not a blade); never in a "thrust" pose; name stays "Swordfish" |
| Catfish | Barbels (whiskers) near the mouth can read as a cigarette / pipe | Short, soft, curled barbels, several of them, clearly whiskers; nothing straight out of the mouth |
| Lanternfish | A lure on a stick in front of the mouth; same name as the Abyss event's villain | Glowing dots on the body (photophores), no lure; cute, not the dark anglerfish; code id distinct from the event template |
| Dragonfish | Dragon → fire breath | No fire, no smoke: glowing scales / fins instead |
| Lionfish | Long thin spines | Wide soft fan fins, rounded tips |
| Bunny Shark (was Hammerhead Shark) | Teeth | Closed wavy smile, no teeth, soft bunny ears |
| Husky Dogfish (was Wolf-head Dogfish) | Teeth, aggressive canine head | Friendly cartoon husky face, mouth closed |
| Mini Leviathan | Monster, teeth, horns | Baby sea-serpent, round eyes, soft frills, no horns or fangs |
| Volcanic Temple | Fire, lava next to round objects, torches | Glowing magma cracks in rock, warm light; no flames, no torches, no round object near the glow |
| Cosmic Sanctuary | Alien faces, "creepy" creatures | Abstract: crystals, planets, glowing runes, star backdrop; no faces |
| Water Hen | — (a bird) | Cartoon moorhen; nothing in its beak |
| Jellyfish | — | Round bell, soft tentacles |
