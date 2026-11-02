---
name: content-recipes
description: "Step-by-step recipes to add a fish species, an aquarium theme, a companion, an egg or a music event (assets, config, balance, checks)"
metadata:
  type: project
---

How to add content to the game (moved from ROADMAP.md when V1 was complete, V0.50). Every new design follows
CLAUDE.md §7 (moderation): describe it to the owner first when its theme is risky, preview locally, upload once.
Numbers are tuned with `tools/economy-sim.js` (a `--plan <file>` previews them before they go in the config), then
BALANCE.md is updated (CLAUDE.md §0c). Asset quirks: [[fish-asset-pipeline]].

## A new species

0. Prompts that work with generate_mesh: "fish swimming horizontally, side view, <shape> body longer than tall, ...,
   stylized game art"; never "cute cartoon" (front-facing chibi creatures) nor an animal word alone ("catfish" gave a
   cat). Generate 2 candidates when a feature is risky (barbels), keep the safe one; show the owner 3–5 candidates
   side by side (name ↔ look consistency matters to them).
1. **Design brief** to the owner (silhouette, colours, coin).
2. `generate_mesh` (≤ 3 at a time, `maxTriangles` ~4000, real bbox), screen_capture check (both sides); template in
   `ServerStorage.Assets.Fish` (tag `FishTemplate`, attr `FishType`, root `Body` + welded `Mesh`, head −Z,
   SurfaceAppearance 512²).
3. Variants: `tools/fish-variant-recolor.js` (`sheet <Type>` to pick the hues, then `build`) → upload the Anomaly /
   Shiny textures → `ServerStorage.Assets.FishVariants`, ids in design/ui/fish/variants/variant-spec.json.
4. Sticker icons (`tools/fish-sticker-icons.js`, 4 variants), checked at 256×160 as a moderator, uploaded once → ids
   in `theme.ts` FISH_ICONS.
5. Coin model in `ServerStorage.Assets.Coins` (+ `CoinType`), front facing the glass.
6. Config: `FishType`, `FISH_TYPES`, its egg's odds, Fish Index order; remind the owner to **save the place**.
7. Playtest: hatch it (`forceNextHatch`), swim animation, growth, variants, icon in the reveal / index.

## A new aquarium theme

1. Brief + mood board to the owner (palette, 3–5 key props, backdrop).
2. Build in Studio under `ServerStorage.Assets.AquariumThemes.<Theme>` (tag `AquariumThemeTemplate`, attr `Theme`,
   PrimaryPart `Origin`, `Style/` parts named like the tank's including `Water`, `Decor/` low along the back and sides,
   CanQuery off), backdrop as a SurfaceGui of Frames (no uploaded image), props by `generate_mesh` tinted by
   SurfaceAppearance Color.
3. `AQUARIUM_THEMES` entry, rebirth wired in `REBIRTHS`, `THEME_PALETTES` colour; screen_capture through the focus
   camera: fish and coins stay readable, nothing hides the front.

## A new companion

1. Brief + mesh (`ServerStorage.Assets.Companions`, tag `CompanionTemplate`, attr `CompanionType`), sticker icon.
2. `CompanionType`, `COMPANION_TYPES` (ability text), its loop in CompanionService, its perks in `perks.ts`,
   its line in `companionStats.ts`.
3. Ocean milestone (free unlock) + its story line; for the paid companions the line has `requiresPass` and shows
   the pass in the quest book.
4. Its stages in `tools/companion-sim.js`, BALANCE.md §5.8.

## A new egg

Sprite (design/ui/eggs.build.js → PNG ×2 through FigCraft or resvg → upload), `EggType`, `EGG_TYPES` (price, hatch,
odds, `requires` = previous egg), shop order, `EGG_SPRITES` in theme.ts.

## A new music event (with a guest star)

1. `shared/types/events.ts`: a `GameEventType`, a `GAME_EVENTS` entry (kind "Music", `musicId`, `bpm`, `beatOffset`,
   `beatCoins`, `guestMove`), its place in `ADMIN_EVENT_ORDER` (the admin panel); banner and stage colours in `client/ui/theme.ts`
   (`EVENT_BANNER_STYLES`, keyed by event).
2. Recurring events use **Paced** beat coins (worth the same minutes of income at every stage); Flat beat coins (K-pop)
   grow with the slow late-game fish and stay admin-only. Write the value in BALANCE.md (§3 Music events).
3. Measure the track's BPM and first beat with AudioAnalyzer ([[studio-mcp-ui-testing]]); put beat 0 on an accented
   beat when the coins fall on one beat out of two.
4. Guest: a Model in `ServerStorage.Assets.EventFish` (tag `EventFishTemplate`, attr `EventType`), invisible anchored
   `Body` (PrimaryPart, bounding box, face toward −Z), everything else welded. A guest built from Parts (the saxophone
   crab, nothing uploaded) dances through two Motor6Ds (`GUEST_DANCE_JOINTS`: `Dance` Body → Hips, `Sway` Hips → what
   it holds); MusicEventController sets their `Transform` on the client every frame. Arms that hold the swinging thing
   get their own `Arm` Motor6D from the hips (pivot at the shoulder, ObjectValue `Grip` → an Attachment of the sway
   root): the client turns and stretches them to the grip, otherwise they slide off the shoulder (owner's feedback).
   A swing must be wide to read in the 2.5D view (±14° looked like a twitch). The owner wanted the crab to pass its
   saxophone from one side of its body to the other: in a front view anything crossing the body passes the face, so
   the trip goes low across the belly with the instrument tipped flat (CLAUDE.md §7). Weld the parts (WeldConstraint)
   to Hips / the sway root only once everything is in place. The place must then be saved in Studio: ServerStorage
   is not synced by Rojo.

## A new event run by its own service (raid, UFO night, starfall)

1. `events.ts`: a `GameEventType`, a config interface with its own `kind`, the `GAME_EVENTS` entry, `ADMIN_EVENT_ORDER`;
   `EVENT_BANNER_STYLES` + its colours in `theme.ts`, its badge text in AdminPanel `BADGE_TEXT` (no emoji).
2. A server service with `run(config, startsAt, endsAt)` (yields until the end, one loop per owned tank, players
   joining late included, `isEventImmune` skipped) and `stop()` (called by `EventService.clearEvent`); branch it in
   `EventService.startEvent` (`runRaid` with a Studio template, `runUntilEnd` without one, and leave a model-less
   kind out of `loadTemplates` or it warns at start).
3. A client controller following `MusicEventController.onEventChanged` for the world look (save / restore Lighting,
   dress the tanks' backdrops). Clickable things in a tank: an invisible tagged ball in the tank's Coins folder, drawn
   by the clients (the starfall's stars are a ★ glyph on a BillboardGui: nothing uploaded), a new `InteractionKind`
   checked before coins in AquariumInteractionController.
4. Its value in BALANCE.md §3 (with a small simulator in `tools/` when it has its own numbers, like
   `starfall-sim.js`), and the other recurring events' frequency (one event every ~12 min is shared among them).
