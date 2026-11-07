# ROADMAP — Project: Quarium V1.2 "Beyond the Stars"

> The first content update after V1: **4 more rebirths and their aquariums, 4 eggs, 6 species**, a bigger tank, a
> **size score on every fish**, a **fifth variant** rarer than the Shiny, new quests and Ocean milestones, upgrades for
> the food reserve and a sixth companion (the Hermit Crab). Everything here is a **plan**: the economy's numbers
> are tuned with the simulator (M1, `tools/balance-v1.2-plan.js`), nothing is built yet. Tick the boxes as tasks ship, and move what a
> step ships into `PROJECT_CONTEXT.md` / `RELEASE_NOTES.md` / `BALANCE.md` as usual.
> Last updated: 2026-11-07 (M2b done: the Size score live in V1.1.16; M1 done: prices tuned, end of V1.2 at ~25h15, the 4th bar at 0.9; owner's decisions: themes, 4 species per rarity, tank 33 (50 later), Size and its table,
> Galaxy at 0.2 % with the Lucky pass x3 on it, the 4th bar at 2.5 %, the Hermit Crab's live luck, boosts unchanged;
> nothing built yet. Groundwork done: money up to 1e300, V1.1.15).

**V1.2 in one line**: the Voyage goes on past the Cosmic Sanctuary for **~13 more hours of play** (the end of the content
~12h20 → **~25h30** for the reference player of 1 h a day, day 13 → ~day 26), with runs that get **longer each time**
(~2h15 → ~3h45), so that the content lasts while the next update is made.

---

## 1. Principles

- **Slower and slower, never frustrating.** Each new run is longer than the last (the owner's brief: no update every
  day), but every run brings something new: one egg, one or two species, an aquarium, a bigger tank, a milestone.
- **The V1 rules stay** (BALANCE.md §4–§5): one egg per run (1, 2, 1, 2 new species), the egg a rebirth opens costs
  1.2x that rebirth, multiplier ~x3.2 per rebirth, the rarest species of an egg at 20 % (45 % in the 1-species eggs),
  hatch capped at 3 min, the free timeline is the only target (gamepasses outside the balance).
- **The V1 timeline does not move.** Rebirths 1–8 and their eggs keep their prices: the new content only comes after.
  The only change for V1 players: the Rebirth menu offers rebirth 9 instead of "more aquariums soon".
- **Simulator first** (CLAUDE.md §0c): a `--plan` file for V1.2 in `tools/`, tuned until the medians hit §2, before
  any config is written. Then the live config, `tools/economy-sim.js` and BALANCE.md together.
- **Moderation first** (CLAUDE.md §7): every theme, species and coin below was picked away from the risky themes (no
  fire, no horn or thin spike sticking out, no leaves, no weapons). Each design is shown to the owner as a local
  preview before any upload; one species goes through the whole pipeline (mesh, bones, sticker) before the others.
- **Big numbers are ready**: money goes to 1e300, units up to Vg then scientific (V1.1.15), so prices can climb freely.

---

## 2. Timeline (reference player: 1 h a day, dailies and weeklies)

**Measured** (M1, 2026-11-07: `node tools/economy-sim.js --plan tools/balance-v1.2-plan.js`, 2,000 players, Size
score included; medians, p10–p90):

| Time (median) | p10–p90 | Step | Run length |
|---|---|---|---|
| ~10h45 | 9h58–11h12 | Rebirth 8 (V1 numbers; 10h55 today, the Size score brings it ~10 min earlier) | — |
| ~11h55 | 11h10–12h41 | All eighteen species (12h19 today) | — |
| **~13h37** | 12h38–14h24 | **Rebirth 9**: Aurora Glacier; tank 27 | run 8: 2h52 |
| ~16h27 | 14h42–17h52 | Species 19, Penguin Puffer | |
| **~16h28** | 15h24–17h08 | **Rebirth 10**: Sky Archipelago; tank 29 | run 9: 2h51 |
| ~17h45 / ~18h41 | 16h37–19h49 | Species 20–21, Cloud Whale and Pegasus Seahorse | |
| **~19h53** | 18h47–20h45 | **Rebirth 11**: Rainbow Dreamland; tank 31 | run 10: 3h25 |
| **~23h14** | 22h05–24h10 | **Rebirth 12**: Heart of the Ocean, the last aquarium of V1.2; tank 33 | run 11: 3h21 |
| ~23h42 | 21h41–25h26 | Species 22, Kitty Koi | |
| ~24h45 | 23h40–25h31 | Species 23, Panda Manta | |
| **~25h15** | **24h18–26h34** | **All twenty-four species** (Baby Kraken): the end of V1.2 | 2h01 after rebirth 12 |

- **+~13 h of play** after V1's end (12h19 → 25h15), **~13 more days** at 1 h a day (day 13 → ~day 26). The runs grow
  from ~1h05–2h15 (V1's last ones) to **2h50–3h25**; the last one is shorter (2 h) because it ends on a species, not
  on a rebirth.
- **The model's average player rebirths as soon as it can**: like V1's Husky Dogfish (10h55, after rebirth 8), the
  Penguin Puffer and the Kitty Koi mostly hatch right around the next rebirth (in the next run, from the next egg,
  which still holds them at 25 %). Real players who wait for the species before rebirthing get them in their own run.
- **What shaped the prices** (the cliffs of BALANCE.md §4, measured here): an even rebirth (10, 12) must stay at
  ≤ ~1.6x the egg its run farms, or the average player keeps buying that egg to swap its baby fish and never saves up
  (rebirth 10: 400T → 15h43, 500T → never by 20 h). So a run is lengthened by its 1-species egg (Aurora 2x rebirth 9,
  Dreamland ~17x rebirth 11) more than by its rebirth, and rebirth 10's multiplier is **x4.8** instead of ~x3.2: at
  x80,000 the Sky Egg (2 species) costs ~4 min of the tank's income and run 10 lasted 5 h (rebirth 11 at ~21h30).
- **The Size score** makes V1 ~2–3 % faster (rebirth 1 18.5 → 16.6 min, rebirth 8 10h51 → 10h45, all eighteen
  species 12h11 → 11h55: inside the p10–p90 spread) and the whole game ~16 min shorter (25h31 → 25h15): the income
  is +15–30 % higher with it (a player keeps its biggest fish), but the waits are for eggs and cliffs as much as for
  money. V1's prices are left as they are (the owner: a faster start is fine).
- The daily boosts stay as they are (owner): their weight shrinks in 3 h runs, included in the run above.

---

## 3. Content

### 3.1 Aquariums (rebirths 9–12)

**Decided by the owner (2026-11-07)**: these four themes.

The Voyage left the ocean for the stars in the Cosmic Sanctuary; V1.2 brings it back down, through the sky, to the
heart of the ocean.

| Rebirth | Aquarium | Look | Mood |
|---|---|---|---|
| 9 | **Aurora Glacier** | Ice shelves, blue-white snow, frozen arches, the northern lights waving above the water | Calm, cold, glowing |
| 10 | **Sky Archipelago** | Small floating islands in the clouds, thin waterfalls falling off them, a soft sunset sky | Airy, light |
| 11 | **Rainbow Dreamland** | Pastel clouds, rainbow arches, soft bubbles, glossy round pebbles in candy colours | Dreamy, playful |
| 12 | **Heart of the Ocean** | A pearl palace at the bottom of the sea: mother-of-pearl walls, golden domes, a huge glowing pearl at the centre | The finale, royal |

- Moderation: no fire, no smoke; Rainbow Dreamland stays on clouds and rainbows (no lollipops, bottles or pill-like
  candies); Heart of the Ocean has no trident or crown of spikes (a dome and a pearl).
- Spare ideas if the owner wants others: Sunken Garden (giant shells and sea anemones), Clockwork Reef (brass gears,
  a slow ticking mood), Moonlit Lagoon (night, silver light), Sakura Pond (pink blossoms, a wooden bridge; petals only,
  no leaves).

### 3.2 Species (19–24)

The owner keeps these six ideas and decides on each one when the models are shown (2026-11-07). Income x2 per species
and Ocean Points x1.6, like V1 (§5.4 of BALANCE.md); intervals alternate quick and slow. Hybrid animals, in the line
of the Husky Dogfish and the Bunny Shark.

**Rarities: 4 species per label instead of 3** (owner, 2026-11-07). 24 species fill the six current labels exactly;
Celestial and Eternal (decided as names) open with the next updates, for species 25–28 and 29–32. Rarity is only a
label (Fish Index order, colours), so V1 species changing label moves no number:

| Label | V1 (3 a label) | V1.2 (4 a label) |
|---|---|---|
| Common | Guppy, Blue Neon, Red Tetra | Guppy, Blue Neon, Red Tetra, **Clownfish** |
| Uncommon | Clownfish, Zebra Danio, Flame Gourami | Zebra Danio, Flame Gourami, **Silver Angelfish, Pirate Fish** |
| Rare | Silver Angelfish, Pirate Fish, Imperial Discus | Imperial Discus, **Catfish, Blue Tang, Baby Sunfish** |
| Epic | Catfish, Blue Tang, Baby Sunfish | **Lanternfish, Lionfish, Dragonfish, Husky Dogfish** |
| Legendary | Lanternfish, Lionfish, Dragonfish | **Bunny Shark, Mini Leviathan**, Penguin Puffer, Cloud Whale |
| Mythic | Husky Dogfish, Bunny Shark, Mini Leviathan | Pegasus Seahorse, Kitty Koi, Panda Manta, Baby Kraken |
| Celestial, Eternal | — | none yet (species 25–32, next updates) |

A player sees a few V1 species move down one label (the Clownfish becomes Common, the Husky Dogfish Epic): the release
notes say so. The quests that name a rarity (§7) use the new labels.

| # | Species | Rarity | Look | Coin | Coin value / interval | Income/s (baby) | Ocean Points |
|---|---|---|---|---|---|---|---|
| 19 | **Penguin Puffer** | Legendary | A round pufferfish in a penguin's black and white, tiny flippers, soft rounded spikes | Snowflake | 10.1M / 12 s | 840,000 | 51,000 |
| 20 | **Cloud Whale** | Legendary | A small fluffy white whale, a cloud on its back | Cloud | 33.6M / 20 s | 1,680,000 | 82,000 |
| 21 | **Pegasus Seahorse** | Mythic | A white seahorse with small feathered wings, golden mane | Wing feather | 101M / 30 s | 3,360,000 | 131,000 |
| 22 | **Kitty Koi** | Mythic | A koi with cat ears and whiskers, calico orange-white-black | Paw print | 53.8M / 8 s | 6,720,000 | 210,000 |
| 23 | **Panda Manta** | Mythic | A manta ray in panda colours, round black eye patches | Bubble heart | 269M / 20 s | 13,440,000 | 336,000 |
| 24 | **Baby Kraken** | Mythic | A cute round octopus, big eyes, short curled tentacles, a tiny pearl on its head | Ocean heart gem | 806M / 30 s | 26,880,000 | 537,000 |

- Moderation checks for the meshes: the Penguin Puffer's spikes stay short round bumps; the Pegasus has no horn; no
  species holds anything in its mouth; the Baby Kraken's tentacles stay short and curled (nothing that reads as a
  weapon or as suggestive).
- Spare ideas: Bear Grouper, Fox Betta, Hamster Blowfish, Owl Ray, Sheep Jellyfish (a fluffy bell), Teddy Turtle.
- **The tank's coin rate** grows with the tank (33 fish: ~2 coins/s): the free collectors pick up less (a maxed
  Swordfish ~87 % at 2/s, BALANCE.md §5.8). Check in M1 whether the slow intervals (20–30 s) are enough to keep the
  rate near 1.5/s, or lengthen them.

### 3.3 Eggs (13–16)

Prices tuned in M1 (§2 explains the rules that shaped them):

| Egg | Price | vs its rebirth | Hatch | Odds | Unlocked by |
|---|---|---|---|---|---|
| Aurora | **400T** | 2x rebirth 9 | 180 s | Mini Leviathan 55, Penguin Puffer 45 | a Cosmic Egg |
| Sky | **770T** | 1.2x rebirth 10 | 180 s | Penguin Puffer 25, Cloud Whale 55, Pegasus Seahorse 20 | an Aurora Egg |
| Dreamland | **50Qa** | ~17x rebirth 11 | 180 s | Pegasus Seahorse 55, Kitty Koi 45 | a Sky Egg |
| Heart | **96Qa** | 1.2x rebirth 12 | 180 s | Kitty Koi 25, Panda Manta 55, Baby Kraken 20 | a Dreamland Egg |

- The Heart Egg sits on a cliff: 86Qa → the end at ~25h06, 95Qa (with rebirth 12 at 72Qa) → ~26h43. Never move it,
  rebirth 12 or the Dreamland Egg by more than ~5 % without re-running the simulator.
- The egg shop shows 6 slots today: check how the shelf pages / scrolls with 16 eggs (it already handles 12).

### 3.4 Rebirths (9–12)

| Rebirth | Price | Coins | Step | Aquarium | Tank (Ocean milestone it comes with) |
|---|---|---|---|---|---|
| 9 | **200T** | x25,000 | x3.1 | Aurora Glacier | 27 |
| 10 | **640T** | **x120,000** | x4.8 | Sky Archipelago | 29 |
| 11 | **3Qa** | x375,000 | x3.1 | Rainbow Dreamland | 31 |
| 12 | **80Qa** | x1,200,000 | x3.2 | Heart of the Ocean | 33 |

After rebirth 12 the Rebirth menu says the next aquariums come with the next update (the message moves from rebirth 8).

### 3.5 Size score (new, every fish)

Owner's brief: each fish hatches with a size score that makes it bigger or smaller **and** raises or lowers the value of
its coins. The number is **shown to the player**, never hidden: it is a reason to farm better fish.

- **Score**: a whole number from **-15 to +15**, drawn by the server when the egg is opened, kept for the fish's whole
  life (saved with it). The fish is x(1 + score / 100) bigger and its coins are worth x(1 + score / 100), on top of its
  growth stage (baby x1 → adult x1.5) and its variant. A +12 adult Shiny: size 1.5 x 1.12, coins x1.12 on top of the
  Shiny's pace.
- **Decided by the owner (2026-11-07)**: the name "Size", the -15…+15 scale and the table below.
- **Name in the game**: "Size", to keep it apart from the growth stages the game already calls growth (baby, adult).
  Internal name `size` (SavedFish, FishView); the fish of older saves get 0.
- **Draw**: the sum of two dice (triangular), so that 0 is the most common and the ends are rare. Shown as a
  percentage with a label and a colour:

| Score | Label | Chance | About one egg in |
|---|---|---|---|
| -15 … -10 | Tiny | 6.7 % | 15 |
| -9 … -4 | Small | 22.7 % | 4 |
| -3 … +3 | Normal | 41.2 % | 2.4 |
| +4 … +9 | Big | 22.7 % | 4 |
| +10 … +12 | Huge | 5.3 % | 19 |
| +13 … +14 | Giant | 1.3 % | 75 |
| **+15** | **Titan** (the perfect fish) | 0.056 % | **1,800** |

  (score = round((u1 + u2 - 1) x 15) with u1, u2 uniform: a 12 h run opens ~900 eggs, so a Titan is a ~40 % chance per
  run, a real hunt.)
- **Why -15…+15 and not 0…30**: the same draw, but "+12 %" says what it does, and 0 reads as "an ordinary fish". On a
  0–30 scale most fish would read as "below 30", which feels like losing. The minus values are shown in a soft grey,
  never in red.
- **Where the player sees it**: the hatch reveal (the score counts up after the variant, with its label and colour:
  Titan gets its own fanfare); the fish's info card (click on a fish) and the release panel ("+12 % Huge"), which
  sorts by real income, size included; the fish itself in the tank (a Titan is visibly bigger); the Fish Index keeps
  the **best size ever hatched per species** ("Best: +14"), with a mark on the Titan cells.
- **A release lets the smallest fish go** (owner, 2026-11-07). The Ocean panel picks a species and a variant; among
  those fish, FishService.releaseFish takes the **lowest Size score first**, then (today's order) the lowest growth
  stage, the smallest body, the youngest. The Size goes first because it is permanent: a Titan baby just hatched is
  never released before a Tiny adult. The Ocean panel says so ("the smallest one goes back to the ocean").
- **Balance (measured, M1)**: the average at hatch is 0, but the player keeps its biggest fish and releases the
  others, so the tank's income is **+15–30 % higher** with the Size score (money per minute at 1 h 51k → 59k, at
  12 h 755B → 993B). The times move much less (**-2 to -3 %**: the end 25h31 → 25h15), because the waits are for eggs
  and price cliffs as much as for money; §2 has the details. The Big Catch line (§7.2): a Huge at ~6 min, 5 Huge at
  once and a Giant at ~5h45, a **Titan for 72 % of the players** before the end (median ~10h05 for them).
- **The Size only changes the income, never the Ocean Points** (owner, 2026-11-07): a release stays worth its species
  and variant.
- Applies to every egg fish of every species, V1 included (the feature reaches every player at once). The special fish
  (French Fish, Alien Fish, Sugar) have no score; Sugar copies the best fish's coin, so its size counts through it.
- No upload: the size is a scale of the model (bones scale with it) and a number in the UI.

### 3.6 Fifth variant: Galaxy (new, rarer than the Shiny)

**Decided by the owner (2026-11-07)**: the **Galaxy** variant, at **0.2 %**. The proposals compared are kept below.

The Shiny (1 %, x1.5 with Lucky ocean, guaranteed by a 3-bar starfall) is easy to collect: the Shiny column fills up fast.
The new variant sits above it: **rarer, and clearly richer**. Common numbers for the three proposals:

- **Chance 0.2 %** (one egg in 500, 5x rarer than the Shiny); the variant luck multiplies it like the others, except
  the **Lucky pass, a bit stronger on Galaxy (owner): x3 on Galaxy**, x2 on the other variants as today (the pass's
  text says it: "x2 rare variants, x3 Galaxy").

| Galaxy chance | Free | Lucky pass |
|---|---|---|
| Base | 0.2 % (1 in 500) | 0.6 % (1 in 167) |
| + Lucky ocean (x1.5) | 0.3 % (1 in 333) | 0.9 % (1 in 111) |
| + Hermit Crab, free (x1.25) | 0.375 % | 1.125 % |
| + Hermit Crab, maxed (x1.6) | 0.48 % (1 in 208) | **1.44 % (1 in 69)**, the most anyone can reach |

  The pass's own gain on Galaxy (x3) stays well below the Shiny's 1 % base: Galaxy is never common, even with
  everything. A free player with the ocean and a maxed crab opens ~900 eggs a 12 h run: ~4 Galaxies; with the pass
  ~13.
- **Income ~x2** (the Shiny is x1.35), **Ocean Points x10** (the Shiny x5), the top rank of the release order.
- A new Fish Index column: 24 species x 5 variants = **120 cells** (§7.2's Collector line counts them).
- Balance: 0.2 % of the fish at x2 is +0.2 % of the income on average: nothing on the curve. The lucky player who keeps
  one gains ~+4 % on a 25-fish tank: a nice bonus, never a jump.

| Proposal | Look | What it does | Upload cost |
|---|---|---|---|
| **Galaxy** (chosen) | The fish turns night blue, full of tiny moving stars, a soft glow | Coins 1.5x as often; one coin out of 5 is a **star coin** (the starfall's star, small) worth 3 coins: x1.97 | **One** tiling star texture for every species (it doesn't follow each species' UVs), plus the star coin |
| Prismatic | Its colours slowly cycle through the rainbow, a pearly shine | Coins 1.5x as often, one out of 5 is a rainbow coin worth 3: x1.97 | **None**: a colour cycle done in the client |
| Golden | Solid shiny gold, sparkles | Every coin is a gold coin worth 2x: x2 | **None**: a metal material and a gold tint. But "Golden" clashes with the Golden Guppy and the Golden Incubator |

- **Galaxy** was chosen: it ties straight into the starfall (the event that guarantees it), its star coin is a
  new thing to click, and one texture covers all 24 species. Prismatic is the cheapest; it could also clash with the
  Rainbow Dreamland's look (§3.1).
- Moderation: stars, colours and gold only, no shape added to the fish.

### 3.7 Starfall: a 4th bar

Same event, same stars, same gauge, **the same chance of a guaranteed Shiny**; one more bar, very hard to fill.

- The gauge goes from 3 to **4 bars**. Bars 1–3 don't change (Anomaly, Ghost, Shiny guaranteed, same chances while
  they fill: BALANCE.md §3 Starfall). What the stars bring past 3 bars, lost today, now fills the 4th bar, which
  costs **0.9 bar of stars** (measured, M1): the stars of a whole event rarely go that far.
- Galaxy in the bars: bars 1 and 2 keep its base chance (0.2 %, 0.2 → 0.3 % as the 2nd bar fills); 3 bars + p of
  the 4th: Shiny guaranteed, Galaxy 0.5 % → 5 % as the 4th fills; **4 bars: Galaxy guaranteed.**
- **Measured** (`node tools/starfall-sim.js --fourthBar 0.9`, 400,000 events per catch rate; owner's target 2.5 %):

| Stars caught | ≥ 3 bars (Shiny guaranteed) | 4 bars (Galaxy guaranteed) | Next egg is a Galaxy | Galaxies from a 12 h run's 15 starfalls |
|---|---|---|---|---|
| 60 % | 1.3 % | 0.1 % | 0.4 % | 0.05 |
| 75 % | 4.6 % | 0.3 % | 0.6 % | 0.09 |
| 90 % | 12.3 % | 1.2 % | 1.6 % | 0.24 |
| 100 % | 21.0 % (unchanged) | **2.6 %** | 3.2 % | 0.48 |

  A perfect player fills the 4th bar once in ~38 starfalls (~30 h of play), most players almost never: the starfall
  stays the Shiny event, Galaxy its rare jackpot. Next eggs that hatch a Shiny at 100 %: 34.6 % → 31.7 % (the 3.2 %
  that turn Galaxy instead). With the Lucky pass (luck x3 on Galaxy) a perfect starfall's next egg is a Galaxy 4.4 %
  of the time.
- The floor (1.5 bars x the share caught) stays as it is.
- The 4th bar gets its own colour and a short sparkle in the gauge (FigCraft mockup first), so that a near miss is
  visible and exciting.
- The best of two starfalls is still the one kept; the power is still spent on the next egg.

---

## 4. Bigger tank (25 → 33, room for 50)

Like V1 (tank 15 → 25 by steps of 2), each step is an Ocean milestone reached with a rebirth's release, so the next
run starts with 2 more fish (+8–10 % income each). **V1.2 stops at 33; the later updates go up to 50** (owner,
2026-11-07): the groundwork is built and tested for 50 so that no later step has to rework it.

To check before building (M2):
- **Room in the tank**: 50 fish (V1.2's 33 plus the later steps) must swim without looking crowded in the basic tank
  and in the 12 themes (swim segments, plots, decor slots); the Studio test of a full 33-fish tank and of a 50-fish
  one, in the focus view and in the lobby. If 50 looks crowded, the fish of a full tank can shrink a little (a scale
  per capacity), never the Size score's effect.
- **Performance**: 6 tanks x 33 bone fish (198 rigs) on a phone, then 6 x 50 (300) to know what the later steps
  need (a far tank's fish swimming at a lower rate, or hidden); V1.1 measured 6 x 25 fine on PC.
- **Feeding**: 33 fish need ~45 meals a minute; the food reserve gives 30 today (§5).
- **AFK**: no free feeder keeps more than 15 fish fed, the Jellyfish pass 25: from tank 27 even the paid kit lets fish
  go weak. **Accepted for V1.2** (owner, 2026-11-07): the next update sells a new feeder pet for the big tanks. The
  Jellyfish pass doesn't change.

---

## 5. Food reserve upgrades

Today (BALANCE.md §4): 5 portions, each back 10 s after use, up to **30 meals a minute** by hand, enough for ~22 fish;
a 25-fish tank already needs the feeders and Hearty meals. With 33 fish the hand reserve must reach **~45 meals a
minute**. Meals a minute = portions x 60 / refill time.

New side line **"Fish Keeper"** (decided by the owner, 2026-11-07, with the Quick pantry milestone below; opens with rebirth 2, when the dailies open; counts the meals given by hand, gauge
over all time, so a veteran can complete the first ones at once):

| Quest | Goal | Reward | Meals / min | Fish fed by hand |
|---|---|---|---|---|
| Fish Keeper I | 500 meals by hand | Refill 10 s → **9 s** | 33 | ~24 |
| Fish Keeper II | 2,000 meals | Refill **8 s** | 37 | ~27 |
| Fish Keeper III | 6,000 meals | **+1 portion** (6) | 45 | ~33 |

Plus one Ocean milestone (§6, 6M points): **refill 7 s** (51 meals a minute, room for Hearty meals to make a difference).
- New perks `FoodRefill1/2/3` (refill time) and `FoodSlot1` (portions), applied by FoodService (the reserve already
  publishes its size on the `FoodSlots` attribute; the refill time joins it). The HUD's reserve (FoodReserve.tsx) shows
  the 6th portion.
- Pace check: at ~20 meals a minute while playing, 500 meals ≈ 25 min, 2,000 ≈ 1h40, 6,000 ≈ 5 h: the line ends around
  the time the tank needs it (rebirth 9–10). Simulate the pace from StatsService's FishFed if the first numbers look off.
- Not in the economy simulator (it doesn't model hunger); the reserve never limits a normal tank, it only stops spam.

---

## 6. Ocean milestones (after 1,000,000)

A rebirth releases a whole tank; with the new species' points (51,000–537,000 a fish, x2–10 for variants) the
releases reach millions. Times measured in M1 (medians):

| Points | Reward | Reached |
|---|---|---|
| 1,500,000 | Aquarium holds **27 fish** | ~13h29, with rebirth 9 |
| 2,500,000 | **Hermit Crab** (the new companion, §8) | ~13h57 |
| 4,000,000 | Aquarium holds **29 fish** | ~16h27, with rebirth 10 |
| 6,000,000 | **Quick pantry**: food refill 7 s | ~19h08 |
| 9,000,000 | Aquarium holds **31 fish** | ~19h53, with rebirth 11 |
| 14,000,000 | **Aurora rims** (cosmetic: the tank's rims glow with northern lights, every theme) | ~22h20 |
| 20,000,000 | Aquarium holds **33 fish** (the new maximum) | ~23h11, with rebirth 12 |
| 40,000,000 | **"Ocean Sovereign"** title + a giant pearl decor in the tank ("Ocean Legend" is already the Ocean Points leaderboard's title) | ~26h39, after the end |

---

## 7. Quests

### 7.1 Voyage (main line, continued)

The line goes on after "Master Aquarist" (18 species, unchanged). Two quests per aquarium, as in V1: hatch its
signature species, then reach the next aquarium. Ocean Points rewards x2.5 per rebirth, like V1's.

| Aquarium | Quest | Goal | Reward |
|---|---|---|---|
| Cosmic Sanctuary | Beyond the Stars | Rebirth 9 | 375,000 Ocean Points |
| Aurora Glacier | Snowball | Hatch a Penguin Puffer | 5 min of income |
| | Above the Clouds | Rebirth 10 | 900,000 Ocean Points |
| Sky Archipelago | Winged Wonder | Hatch a Pegasus Seahorse | 5 min of income |
| | Over the Rainbow | Rebirth 11 | 2,200,000 Ocean Points |
| Rainbow Dreamland | Lucky Cat | Hatch a Kitty Koi | 5 min of income |
| | Back to the Heart | Rebirth 12 | 5,000,000 Ocean Points |
| Heart of the Ocean | The Little Kraken | Hatch a Baby Kraken | 5 min of income |
| | Grand Aquarist | All 24 species in the Fish Index | Title "Grand Aquarist", a pearl throne decor, 8,000,000 Ocean Points |

### 7.2 Side lines

| Line | New quests (goal → reward) |
|---|---|
| **Fish Keeper** (new) | 500 / 2,000 / 6,000 meals by hand → food refill 9 s, 8 s, +1 portion (§5) |
| **Hatchery** (continued) | 1,800 / 2,500 / 3,500 fish hatched → 2 min of income each, the last one a **Diamond Incubator** decor |
| **Collector** (continued) | in order: 75 Fish Index cells → 3 min of income (~20h53); first Shiny Mythic of V1.2 (species 21–24) → 5,000,000 Ocean Points; first **Galaxy** → 3 min of income; 100 cells → **Galaxy rims** (cosmetic); 120 cells (every species in every variant) → title **"Variant Master"**. Measured: only ~38 % of the players get the Shiny Mythic and the first Galaxy before the end (~24h51 for them): from there the line is a goal past the end, like the Golden Incubator |
| **Big Catch** (new, size §3.5; opens with "Full House", so early: its rewards are minutes of income, BALANCE.md §4) | in order: hatch a Huge fish (+10) → 3 min of income; have 5 Huge fish (or better) in the tank at once → 5 min; hatch a Giant (+13) → 5 min; hatch a **Titan** (+15) → title **"Titan Tamer"** + the **Titan Trophy** decor (rose gold, V1.1.17; in the golden trophy's spot, one or the other shows, V1.1.18); a best size of +10 or more for 18 species in the Fish Index → title **"Size Collector"** |
| **Ocean** (continued) | release 500 fish → 5 min of income; release a Shiny Baby Kraken → title **"Pearl Diver"** |
| **Hermit Crab** (new, free) | its 3 upgrade quests (§8) |

Rule kept: no quest reward multiplies the income or the Ocean Points permanently (BALANCE.md §5.9). Before ~3 h quests
pay income, later Ocean Points: everything here is late, so Ocean Points are fine.

### 7.3 Daily and weekly pools

New entries so the late game sees variety (the pools draw 3 out of 6 today):
- Daily: "Feed 60 times by hand", "Release 5 fish", "Hatch a Big fish or bigger" (+4: ~29 % of the eggs).
- Weekly: "Hatch a fish of V1.2" (species 19–24, from rebirth 9), "Feed 500 times by hand", "Hatch a Huge fish or
  bigger" (+10: ~6.7 %, ~15 eggs).
- With these the pools grow to 9 dailies and 9 weeklies (3 drawn): raise the draw from 6 to 9 in the pools' code.
- Their reward stays the coin boost, **unchanged** (5 min a daily, 15 min a weekly; owner, 2026-11-07: players like to
  stack it with the likes and the events).

---

## 8. The new companion: the Hermit Crab

The current roles: **collect** (Snail → Swordfish), **feed** (Pelican → Jellyfish), **hatch faster** (Water Hen).
The Hermit Crab (the owner's choice, 2026-11-07) is the **variant luck** companion: the tool of the late game's variant
hunt (the new variant §3.6, 120 Fish Index cells, the Collector line). Active play, like the Water Hen: the player
picks it over the Water Hen or a feeder.

**What it does**: the eggs that incubate with it equipped hatch rare variants more often: x1.25 free (Anomaly 12.5 %,
Ghost 6.25 %, Shiny 1.25 %, new variant 0.25 %), its 3 free quests (eggs opened with its full bonus: 100 / 300 / 800)
→ x1.35, x1.45, x1.6. It multiplies like the other variant luck (Lucky ocean, Lucky pass), including the starfall's
"better" chances, never its guaranteed variants.

**It works in real time, like the Water Hen, so it can't be abused.** Today the variant is drawn when the egg is
opened, and a ready egg waits as long as the player likes: a luck applied at opening would let a player equip the
crab only to open ten ready eggs, then swap it out. So:
- Each egg **counts the seconds of its incubation spent with the crab equipped** (from the purchase to its hatch time;
  the waiting once ready doesn't count). It is kept next to the egg's hatch time and updated live when the companions
  change, like the Water Hen's speed (`syncIncubationSpeed`), offline too if the crab was equipped when the player
  left.
- At opening, the crab's luck is **1 + bonus x the share of the incubation with it**: an egg incubated with it all the
  way gets the full x1.25 (x1.6 maxed); equipping it for the last 10 s of a 3 min egg gives ~x1.01. Unequipping it
  halfway gives half.
- Its quests count only the eggs that got its full bonus, so swapping can't farm them either.
- The egg shop's slot shows the crab's mark on the eggs incubating with it (and how much of their time).

**Balance**: outside the timeline (variants: +3.6 % income on average, a little more with it). It competes for a slot
with the Water Hen (speed or luck), which keeps both useful. No pass needed; one stays possible later (comfort only).

- Unlock: the 2,500,000-point Ocean milestone (§6, run 9), free like the Water Hen / Swordfish / Jellyfish.
- Moderation: a cute crab with a round pastel shell, claws small and down (never raised like weapons).
- With 2 free slots (3 with the pass) the choice gets richer: AFK (collector + feeder), or active play (Water Hen,
  Hermit Crab). A third free slot as a late Ocean milestone is an option if the choice feels too tight.
- Set aside (not chosen): a Sea Turtle (fish grow up twice as fast), an Otter (brings up a small chest every 10 min).

---

## 9. Steps

Each step ships as its own patch (or a few), playable on its own; the end-of-content message always sits after the
last live rebirth.

- [x] **M0 Owner decisions** (2026-11-07): the four themes (§3.1); the six species kept as ideas, each one decided on
      its model (§3.2); 4 species per rarity (§3.2); tank 33, 50 later (§4); the AFK gap accepted, a feeder pet next
      update (§4); the Fish Keeper rewards (§5); boosts unchanged (§7.3); Size and its table, no Ocean Points, the
      smallest released first (§3.5); Galaxy at 0.2 %, Lucky pass x3 on it (§3.6); the 4th bar at 2.5 % (§3.7); the
      Hermit Crab with a live luck (§8).
- [x] **M1 Balance plan** (2026-11-07): `tools/balance-v1.2-plan.js` (`node tools/economy-sim.js --plan`), the 4 rebirths, 4 eggs,
      6 species, milestones, quests and food changes, the size score (a player who keeps its best fish) and the new
      variant; tune the prices until the medians hit §2, write the p10–p90 and the coin rate per tank; the starfall's
      4th bar in `tools/starfall-sim.js` (§3.7); update this roadmap's numbers. Simulator horizon 30 h.
- [ ] **M2 Groundwork**: tank 33 built for 50 (room, swim, decor, performance tests with 6 full tanks of 33 and of 50),
      the rarities at 4 a label, egg shop with 16 eggs,
      Fish Keeper line + food perks + Quick pantry, the HUD's 6th portion. Can ship before any new species.
- [x] **M2b Size score** (§3.5; V1.1.16, 2026-11-07; the Titan Trophy decor, the golden one tinted rose gold, V1.1.17): the draw, the save field, the model's scale, the coin value, the hatch reveal, the
      fish card, the release panel's sort, the Fish Index's best size, the Big Catch line and the size dailies /
      weeklies (FigCraft mockups of the reveal and the card first). For every player, V1 content included.
- [ ] **M2c New variant + starfall** (§3.6, §3.7): the variant (look, coin, Fish Index column, release order), the
      4th bar of the gauge (mockup first), the Collector's new quests. Its uploads (one texture, one coin) previewed
      first.
- [ ] **M3 Aurora Glacier**: theme, Aurora Egg, Penguin Puffer (mesh, bones, sticker, Fish Index), rebirth 9, tank 27,
      Voyage "Beyond the Stars" / "Snowball", milestones 1.5M.
- [ ] **M4 Sky Archipelago**: theme, Sky Egg, Cloud Whale, Pegasus Seahorse, rebirth 10, tank 29, Voyage, milestones
      4M / 6M, the Hermit Crab with its live luck (§8) and its quests.
- [ ] **M5 Rainbow Dreamland**: theme, Dreamland Egg, Kitty Koi, rebirth 11, tank 31, Voyage, milestones 9M / 14M.
- [ ] **M6 Heart of the Ocean**: theme, Heart Egg, Panda Manta, Baby Kraken, rebirth 12, tank 33, Voyage up to "Grand
      Aquarist", milestones 20M / 40M, the side lines' new quests, the new daily / weekly entries, the end message.
- [ ] **M7 Check**: full simulator run, BALANCE.md §2 rewritten up to ~25h30, a playtest of a late profile (admin
      tools: a rebirth 8 save in a test store) through rebirth 12.

How to add each piece: `docs/agent-notes/content-recipes.md` (species, theme, companion, egg).

---

## 10. Risks to watch

- **Runs too long feel like a wall**: keep a goal under ~1 h at all times (a species, a milestone, a quest). If a
  run has a gap of 1h30+ with nothing, add a milestone or a side quest there rather than shortening the run.
- **Real players are faster than the model** (likes, events, the K-pop beat coins worth ~13 min of income a minute for
  30 s fish): the late game's slow fish make the events stronger. Watch the funnels (StatsService) after release.
- **Collectors and feeders** fall behind with 33 fish (§3.2, §4).
- **UI widths**: "1.23Qad" is longer than "1.23T": check the money counter, the egg tags and the leaderboard signs.
- **Size and selection**: farming for Titans could make players buy cheap eggs again and again for the size of an old
  species. That is fine (it costs money and time), but the simulator must check that keeping the best fish doesn't
  move the curve by more than ~5 %.
- **Fish Index width**: 5 variant columns plus a best-size column must still fit on a phone (844 x 390).
- **Uploads**: 4 themes, 6 meshes + stickers, 6 coins, 1 companion, decor: all reviewed under the owner's account.
  Previews first, one upload per final asset, never batches of candidates.
