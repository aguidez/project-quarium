# BALANCE — Projet Quarium

> The game's balance: what an average player reaches after how long, and why, today (V0.38) and in the **V1 plan**
> (18 species, 8 aquariums, a tank of 25 fish). **Update it in the same task whenever a number of the economy changes**
> (fish income, eggs, odds, rebirths, Ocean milestones, variants, food, capacity, companions…): run the simulators,
> copy their results here, add a line to the history (§7).
> Last updated: 2026-10-30 (V0.38, ROADMAP M2: rebirths 3–4, Catfish / Blue Tang / Baby Sunfish, Wreck and Atlantis eggs,
> Ocean milestones 5,000–40,000 and the Voyage quests are live; V0.36, ROADMAP M1: the Snail and Pelican nerfs are live; before: V1 plan with the owner's species, aquariums and companions: Water Hen, Swordfish,
> Jellyfish, paid companion quests, Snail and Pelican nerfs).

**Where the numbers live**: `src/shared/types/fish.ts` (species), `eggs.ts` (eggs), `rebirths.ts` (rebirths),
`variants.ts` (variants), `oceanRewards.ts` (Ocean milestones), `companions.ts` / `perks.ts` / `quests.ts`
(companions, quest bonuses). **How they are checked**:

| Tool | What it plays |
|---|---|
| `node tools/economy-sim.js` | The live economy (mirrors the config: keep it in sync), 2,000 average players second by second |
| `node tools/economy-sim.js --plan tools/balance-v1-plan.js` | The V1 plan (§5): same player, planned species / eggs / rebirths / milestones / quest bonuses |
| `node tools/companion-sim.js` | AFK farming: how many fish the Pelican keeps fed, the share of the coins the Snail picks up; with `--plan`, the V1 companions (Jellyfish, Swordfish) |

The development plan of V1 (what to build, in which order) is `ROADMAP.md`.

Options: `--players 300` (faster, noisier), a JSON of overrides (`'{"P":{"coinBoost":2}}'`, see the file headers).

---

## 1. The average player (the simulator's model)

- Collects **50 %** of the value of the coins its fish drop (clicks plus companions). Calibrated on the first
  playtests ("6 fish at ~1 h").
- Feeds its fish (10 $ a pellet, one meal every ~35 s per fish). Hunger never kills, so this is just a cost.
- Saves for the **best unlocked egg**. It buys a cheaper egg only to fill an empty slot, to find a missing species,
  or when that egg clearly beats its weakest fish.
- Once the tank is full and the Ocean is open (story quest "Full House": 10 fish), it **releases its weakest fish**
  to make room. That earns Ocean Points.
- **Rebirths as soon as it can afford the next rebirth**, and claims each Ocean milestone as soon as it reaches it.
- **Not modelled**: AFK time (coins and hunger stop while away), companions' extra pick-ups, the like boost (x2),
  events (Abyss x1.5, K-pop beat coins), quest money (except the V1 plan's quest bonuses, §5.9). They all make real
  players a bit faster than the simulator; the spread between players (p10–p90 below) is wider than these effects.
- **Gamepasses are never part of the model** (§5.10).

All times below are **minutes / hours of play in front of the tank** (medians, with p10–p90 when useful).

---

## 2. Live game: expected progression (V0.38)

| Time | What the average player reaches | Why it happens then |
|---|---|---|
| 0–2 min | Tutorial: free egg, first Golden Guppy, first coin, first meal, +300 $ | Onboarding, scripted |
| ~5 min | Blue Neon (Common Egg, 20 %) | Common Egg 100 $, guppies earn 1 $/s each |
| ~5–10 min | Snail (story quest "Coin Collector", 300 $ of coins) | First companion: collects coins for the player (quests are not in the simulator) |
| ~16 min | Red Tetra (Improved Egg, 500 $) | Improved Egg unlocked by buying a Common Egg |
| **~28 min** (21–35) | **Rebirth 1** (5,000 $, quest "Saving Up"): coins x2.5, Lagoon Aquarium | The Freshwater Egg (25k) is out of reach before it; the rebirth gets past it |
| ~30 min | 50 Ocean Points: **Pelican** | The fish released at rebirth 1 give ~50 points |
| ~39 min | Clownfish (Superior Egg, 2,500 $, 15 %) | |
| ~48 min | 100 Ocean Points: Faster Snail (x1.15 speed) | Releases of weak fish to make room |
| ~51 min | Zebra Danio (Freshwater Egg, 25k) | |
| **~60 min** (47–75) | **The first six species** (Flame Gourami, 15 % of the Freshwater Egg, or 55 % of the Amazon Egg) | Voyage quest "Freshwater Finds": 5 min of income |
| ~75 min | 200 Ocean Points: second companion slot; **Silver Angelfish** (Amazon Egg, 150k, 45 %) | Amazon Egg unlocked by the Freshwater Egg |
| ~1h34 | 500 Ocean Points: Hungry Pelican (x1.33: every 7.5 s) | With all its quests it keeps 15 fish fed (§5.8) |
| **~1h40** (1h27–1h55) | **Rebirth 2** (1.3M): coins x8, **Neon Coral Lagoon**; 1,500 Ocean Points: **15 fish** | The wall of the Amazon era; the rebirth releases a whole tank (~2,000 points) + Voyage "Deeper Waters" (500 points) |
| ~2h16 | Pirate Fish (Neon Coral Egg, 2.5M, 55 %) | The Neon Coral Egg costs more than rebirth 2: it is reached after it |
| **~2h27** (2h07–2h49) | **All nine first species** (Imperial Discus, 20 % of the Neon Coral Egg) | Voyage "Crown of the Reef": 5 min of income |
| ~2h59 | 5,000 Ocean Points: **second incubator** | Two eggs of a kind at once: the late hatches (2–2.5 min) stop being a bottleneck |
| **~3h01** (2h44–3h19) | **Rebirth 3** (45M): coins x25, **Sunken Pirate Wreck**; 8,000 Ocean Points: **17 fish** | Voyage "Sunken Secrets" (1,500 points) |
| ~3h51 (3h27–4h19) | **Catfish** (Wreck Egg, 55M, 45 %) | The Wreck Egg costs 1.2x rebirth 3: reached after it. Voyage "Treasure of the Wreck" |
| **~4h47** (4h21–5h11) | **Rebirth 4** (120M): coins x80, **Atlantis Ruins**; 25,000 Ocean Points: **19 fish** | Voyage "The Lost City" (4,000 points) |
| ~5h21 | 40,000 Ocean Points: Lucky ocean (rare variants x1.5) | Side goal: +1.8 % income, not modelled |
| ~5h35 | Blue Tang (Atlantis Egg, 144M, 55 %) | |
| **~5h42** (5h13–6h10) | **All twelve species** (Baby Sunfish, 20 % of the Atlantis Egg): the end of the live content | Voyage "Atlantean Sun"; the Rebirth menu says more aquariums are coming |
| any time | The French Fish (secret, 0.1 % of any egg): ~1 player in 3 hatches one by ~6 h (median first one ~3h) | See §3 Easter eggs |
| after | Variants (Anomaly 10 %, Ghost 5 %, Shiny 1 %; x1.5 with Lucky ocean) to complete the Fish Index, Ocean Points | Nothing new to buy: the V1 plan (§5) continues from here (M4: rebirth 5) |

**Money collected per minute** (median): 15 min 610 $, 30 min 1.4k, 60 min 19k, 90 min 88k, 2 h 211k, 2h30 1.0M,
3 h 1.5M, 4 h 9.3M, 5 h 19M, 6 h 237M.

---

## 3. Live numbers

### Species (`fish.ts`)

| Species | Rarity | Coin | Coin value / interval | Income/s (baby) | Adult (x1.5) | Ocean Points |
|---|---|---|---|---|---|---|
| Golden Guppy | Common | Bronze | 4 $ / 4 s | 1 | 1 (never grows) | 1 |
| Blue Neon | Common | Silver | 25 $ / 10 s | 2.5 | 3 (x1.2) | 2 |
| Red Tetra | Common | Gold | 48 $ / 8 s | 6 | 9 | 4 |
| Clownfish | Uncommon | Platinum | 180 $ / 12 s | 15 | 22.5 | 15 |
| Zebra Danio | Uncommon | Amethyst | 150 $ / 5 s | 30 | 45 | 25 |
| Flame Gourami | Uncommon | Orichalcum | 1,400 $ / 20 s | 70 | 105 | 80 |
| Silver Angelfish | Rare | Pearl | 2,400 $ / 15 s | 160 | 240 | 150 |
| Pirate Fish | Rare | Ruby | 1,500 $ / 5 s | 300 | 450 | 250 |
| Imperial Discus | Rare | Crown | 17,500 $ / 25 s | 700 | 1,050 | 500 |
| Catfish | Epic | Chest | 16,000 $ / 10 s | 1,600 | 2,400 | 800 |
| Blue Tang | Epic | Sapphire | 19,200 $ / 6 s | 3,200 | 4,800 | 1,300 |
| Baby Sunfish | Epic | Sun Medallion | 130,000 $ / 20 s | 6,500 | 9,750 | 2,000 |

Growth (default): x1 at birth, x1.2 after 5 min, x1.5 after 10 min in the water. One coin out of 15 sparkles (x2).
Rarity is only a label (Fish Index order, colours).

### Easter eggs (`fish.ts` FishConfig.easterEgg)

| Fish | Chance | Coin | Value | Ocean Points | Stays |
|---|---|---|---|---|---|
| French Fish (Secret) | 0.1 % of any egg, taken from its most common fish, shown nowhere | Croissant, every 60 s | 0.5 x the tank's theoretical income per minute (other fish, growth and variants, sparkling coins on average), then x rebirth, like, event; sparkles 1/15 (x2) | 100 | 1 h of tended time (age), then leaves for the ocean with its points |

No variant. It earns +50 % of the tank for an hour: a nice bonus that never breaks the curve (the simulator's
medians move by less than the noise). It is not one of the 18 species of the V1 count.

### Eggs (`eggs.ts`)

| Egg | Price | Hatch | Odds | Unlocked by |
|---|---|---|---|---|
| Common | 100 $ (free while the player has no fish) | 3 s | Guppy 80, Neon 20 | — |
| Improved | 500 $ | 8 s | Guppy 30, Neon 52, Tetra 18 | a Common Egg |
| Superior | 2,500 $ | 20 s | Neon 35, Tetra 50, Clownfish 15 | an Improved Egg |
| Freshwater | 25,000 $ | 45 s | Tetra 45, Danio 40, Gourami 15 | a Superior Egg |
| Amazon | 150,000 $ | 75 s | Gourami 55, Angelfish 45 | a Freshwater Egg |
| Neon Coral | 2,500,000 $ | 120 s | Angelfish 25, Pirate 55, Discus 20 | an Amazon Egg |
| Wreck | 55M | 135 s | Discus 55, Catfish 45 | a Neon Coral Egg |
| Atlantis | 144M | 150 s | Catfish 25, Blue Tang 55, Baby Sunfish 20 | a Wreck Egg |

One egg of each type incubates at a time, two from the 5,000-point Ocean milestone (~2h59): the hatch time paces the
farming of the best egg.

### Rebirths (`rebirths.ts`)

| Rebirth | Price | Coins (total, not stacked) | Start money | Aquarium |
|---|---|---|---|---|
| 1 | 5,000 $ | x2.5 | 300 $ | Lagoon Aquarium |
| 2 | 1,300,000 $ | x8 | 300 $ | Neon Coral Lagoon |
| 3 | 45M | x25 | 300 $ | Sunken Pirate Wreck |
| 4 | 120M | x80 | 300 $ | Atlantis Ruins |

A rebirth resets money, fish, eggs and egg unlocks; it keeps the Fish Index, quests, companions, Ocean Points,
Ocean milestones (and so the tank size), perks and likes. The fish go to the ocean for their Ocean Points.

### Ocean milestones (`oceanRewards.ts`)

| Points | Reward | Reached (median) |
|---|---|---|
| 50 | Pelican | ~30 min |
| 100 | Faster Snail: speed x1.15 | ~48 min |
| 200 | Second companion slot | ~75 min |
| 500 | Hungry Pelican: feeds x1.33 as often (every 7.5 s) | ~1h34 |
| 1,500 | Aquarium holds 15 fish instead of 10 | ~1h40 (with rebirth 2) |
| 5,000 | Second incubator: 2 eggs of the same kind at once | ~2h59 (just before rebirth 3) |
| 8,000 | Aquarium holds 17 fish | ~3h01 (with rebirth 3) |
| 25,000 | Aquarium holds 19 fish | ~4h47 (with rebirth 4) |
| 40,000 | Lucky ocean: rare variants x1.5 (Anomaly 15 %, Ghost 7.5 %, Shiny 1.5 %) | ~5h21 |

A release earns the species' points x 1 / 2 / 3 / 5 (Normal / Anomaly / Ghost / Shiny).

### Variants (`variants.ts`)

Shiny 1 % (coins 1.2x as often, 3x more sparkling coins: +35 %), Ghost 5 % (ghost coins worth 3 sparkling ones:
+25 %), Anomaly 10 % (coins 1.2x as often: +20 %). On average +3.6 % income, all included in the simulator.

---

## 4. Design rules (why the numbers are what they are)

- **Each species earns ~2–2.5x the previous one, each egg costs ~5–15x the previous one.** Every tier takes longer
  than the last: the game is fast at first and slows down after the first hours.
- **One wall per rebirth.** An egg is placed so that it is (almost) out of reach before a rebirth and quick after
  it: the Freshwater Egg (25k) before rebirth 1, the Amazon Egg's farming before rebirth 2, and from then on **the
  egg a rebirth opens costs 1.2x that rebirth** (Neon Coral Egg 2.5M after rebirth 2 at 1.3M was the first one): the
  average player rebirths first, then buys it.
- **A rebirth's multiplier must make the climb back short.** Each rebirth multiplies the coins by ~3.2 (x2.5, x8, x25,
  x80…): the run restarts from the Common Egg and gets back to its previous income in ~15–20 min. A smaller step (x2.5
  per rebirth) made the climb back ~45 min and the run after it ~2h40.
- **The rebirth price sits on the savings curve, away from cliffs**: a few % more can cost many minutes when it
  crosses a plateau (5,250 $ instead of 5,000 $ moved rebirth 1 from 29 to 42 min; in the V1 plan, rebirth 4 at 108M
  comes at ~4h00, at 116M at ~4h53). Pick the side of the cliff on purpose (V1: after it, so that the player enjoys a
  tank of the new species before rebirthing), and always re-run the simulator after touching a price.
- **Rarer species are rarer in their egg, and the last one of an egg is the rarest** (Gourami 15 %, Discus 20 %).
  An egg holds 2–3 species: the previous egg's rarest (so it is never a downgrade) and 1–2 new ones.
- **Ocean milestones follow the releases**: the big ones are reached through the rebirths (a full tank released at
  once). Each capacity step comes with a rebirth, so the next run starts with a bigger tank.
- **Companions are the AFK engine.** Free companions make AFK about as good as the average player (~50–60 % of the
  coins, 15 fish fed); the paid companion quests bring AFK close to active play (~95 % of the coins, 25 fish fed):
  that is what those passes sell (§5.8, §5.10).
- **Gamepasses are not a lever of the balance**: prices and milestones are tuned for a free player (§5.10).

---

## 5. V1 plan (preview: not in the game yet)

Species 1–12, eggs 1–8, rebirths 1–4, the Ocean milestones up to 40,000 and the Voyage quests up to Atlantis are
live since V0.38 (ROADMAP M2, §3) with the plan's numbers. The **Pelican's** and the **Snail's** Ocean
upgrades already have their V1 values in the game since V0.36 (§5.8, ROADMAP M1). Everything else is new. Source of truth: `tools/balance-v1-plan.js` (it becomes the
config when V1 is built); the development plan is `ROADMAP.md`. Every new design goes through the moderation check of
CLAUDE.md §7 (watch list in ROADMAP.md §4) before any asset is generated.

### 5.1 Goals and verdict

Owner's brief: 8 rebirths, each with its aquarium (8 themes after the Basic one), 18 species, a tank that ends at 25
fish through the Ocean Points, a fast first 2 hours then a progressive slowdown that never gets frustrating, **12–14 h to
own every species (normal) and every aquarium**; variants are a side goal outside that count; gamepasses help but never
set the pace.

**Verdict: 12–14 h is a good length for this content.** The plan gives **~12h16** median (11h37–12h53 p10–p90) for the
simulator's average player.
- 18 species and 8 aquariums in ~12 h is a new species every ~45 min and a new aquarium every ~1h30 on average:
  nobody runs out of goals.
- Real sessions last 20–45 min: 12 h is ~3–5 weeks for a regular player, enough time to ship V1.1 before the first
  players finish.
- Shorter (≤ 10 h) would empty the game in 2 weeks; longer (≥ 16 h) would stretch the last runs to 2h30+ with a single
  new species each.
- Real players get things the simulator doesn't count (likes, events, clicking above 50 %): if V1 ends under ~12 h in
  practice, the levers are the run 5–7 prices (+10 % ≈ +20 min each) or rebirth 8 past its cliff (§5.3: end ~14 h),
  never longer hatches.

### 5.2 How many eggs? (the calculation)

Three constraints fix the number of eggs; they all give **12** (6 live + 6 new, one per new aquarium).

1. **One new egg per run.** A rebirth that opens nothing new is only a multiplier: every run must bring at least one
   egg. The live game already uses: run 0 → eggs 1–3 (egg 4 is its wall), run 1 → eggs 4–5, run 2 → egg 6. Runs 3 to 8
   need one each: **6 + 6 = 12 eggs**.
2. **2–3 species per egg, 1–2 of them new.** An egg keeps the rarest species of the previous egg and adds 1 or 2 new
   ones. With 4 species in an egg the rarest falls to ≤ 10 %: at 3 min a hatch that is a median ~30 min and a p90
   ~70 min for a single species. 9 new species over 6 eggs = 1.5 per egg: **1, 2, 1, 2, 1, 2**.
3. **A goal every ~1h–1h40.** (12h15 − 2h30) / 6 new eggs ≈ 1h40 per egg, a new species every ~65 min.
   - **9 eggs** (3 new): 3 species each, the rare ones at ~10 %, and half of the runs would open nothing.
   - **15 eggs** (9 new): 1.5 eggs per run, the climb back after each rebirth crosses 3 more eggs (one more buy and
     hatch each), and each egg becomes a 40-min stop rather than a goal.

### 5.3 Expected progression (V1 plan)

`node tools/economy-sim.js --plan tools/balance-v1-plan.js` (300 players, Voyage quest bonuses and the free Water Hen
included). The first 2h30 are the live game (§2), unchanged.

| Time (median, p10–p90) | What the average player reaches | Run length |
|---|---|---|
| ~28 min (21–36) | Rebirth 1: x2.5, Lagoon | run 0: 28 min |
| ~1h00 | The first six species | |
| ~1h39 (1h26–1h55) | Rebirth 2: x8, Neon Coral Lagoon; tank 15 | run 1: 1h11 |
| ~2h28 (2h05–2h52) | Species 9, Imperial Discus | |
| **~3h01** (2h43–3h20) | **Rebirth 3** (45M): x25, **Sunken Pirate Wreck**; second incubator; tank 17 | run 2: 1h22 |
| ~3h53 (3h27–4h18) | Species 10, Catfish (Wreck Egg, 55M) | |
| **~4h47** (4h24–5h10) | **Rebirth 4** (120M): x80, **Atlantis Ruins**; tank 19 | run 3: 1h46 |
| ~5h36 / ~5h43 | Species 11–12, Blue Tang / Baby Sunfish (Atlantis Egg, 144M) | |
| **~6h14** (5h45–6h37) | **Rebirth 5** (5.1B): x250, **Mariana Trench**; tank 21; **Water Hen** | run 4: 1h27 |
| ~7h06 (6h35–7h37) | Species 13, Lanternfish (Trench Egg, 6.1B) | |
| ~7h16 | **Swordfish** (Ocean 120,000) | |
| **~8h07** (7h35–8h36) | **Rebirth 6** (13B): x800, **Underwater Volcanic Temple**; tank 23; **Jellyfish** | run 5: 1h53 |
| ~8h59 / ~9h06 | Species 14–15, Lionfish / Dragonfish (Volcano Egg, 15.6B) | |
| **~9h49** (9h16–10h21) | **Rebirth 7** (690B): x2,500, **Crystal Caverns**; **tank 25** | run 6: 1h42 |
| ~10h54 (10h20–11h28) | **Rebirth 8** (1.5T): x8,000, **Cosmic Alien Sanctuary** (last aquarium) | run 7: 1h05 |
| ~11h12 | Species 16, Wolf-head Dogfish (Crystal Egg, 830B: often found right after rebirth 8) | |
| ~12h02 | Species 17, Hammerhead Shark (Cosmic Egg, 1.8T) | |
| **~12h16** (11h37–12h53) | **Species 18, Mini Leviathan: all 18 species and all 8 aquariums = end of V1** | run 8: 1h22 |
| after | Variants, Fish Index, Ocean 1,000,000 (~11h30), "Master Aquarist", daily / weekly | |

**Shape of the curve**: runs of 28 min, 1h11, 1h22, then **1h05–1h53 from run 3 on** (mean 1h33). The game is fast
for 3 hours (9 species, 3 aquariums), then gives a new aquarium every ~1h30 and a new species every ~50 min. Runs with
2 new species (4, 6, 8) are shorter than the runs with 1 (3, 5, 7) because their income jumps more.

**Cliffs to know** (§4): rebirth 4 between 108M (~4h00) and 116M (~4h53): the plan stays after it (the player enjoys a
Catfish tank before rebirthing); rebirth 8 between 1.64T (~11h28) and 1.72T (~13h15): the plan stays before it,
otherwise the end moves to ~14h30. Rebirth 6 sits just above one (4B → ~7h00, 13B → ~8h25). Never move these three
prices by more than ~5 % without re-running the simulator.

**Money collected per minute** (median): 3h 1.5M, 4h 9.3M, 6h 174M, 8h 1.7B, 10h 19B, 12h 606B, 14h 3.4T.
**Ocean Points** (median): 3h 6.4k, 4h 13.8k, 6h 55k, 8h 139k, 10h 521k, 12h 1.1M.
**Eggs opened** (median): 1h 64, 2h 145, 4h 286, 6h 448, 8h 625, 10h 910, 12h 1,174.

### 5.4 Species (18)

The owner's species, placed by aquarium theme (the slot's numbers stay, the species can swap slots freely).

| # | Species | Rarity | Egg | Coin value / interval | Income/s (baby) | Adult (x1.5) | Ocean Points |
|---|---|---|---|---|---|---|---|
| 1–9 | (live, §3) | Common → Rare | 1–6 | | 1 → 700 | | 1 → 500 |
| 10 | Catfish | Epic | Wreck, Atlantis | 16,000 / 10 s | 1,600 | 2,400 | 800 |
| 11 | Blue Tang | Epic | Atlantis | 19,200 / 6 s | 3,200 | 4,800 | 1,300 |
| 12 | Baby Sunfish | Epic | Atlantis, Trench | 130,000 / 20 s | 6,500 | 9,750 | 2,000 |
| 13 | Lanternfish | Legendary | Trench, Volcano | 156,000 / 12 s | 13,000 | 19,500 | 3,200 |
| 14 | Lionfish | Legendary | Volcano | 208,000 / 8 s | 26,000 | 39,000 | 5,000 |
| 15 | Dragonfish | Legendary | Volcano, Crystal | 1.3M / 25 s | 52,000 | 78,000 | 8,000 |
| 16 | Wolf-head Dogfish | Mythic | Crystal, Cosmic | 1.575M / 15 s | 105,000 | 157,500 | 13,000 |
| 17 | Hammerhead Shark | Mythic | Cosmic | 4.2M / 20 s | 210,000 | 315,000 | 20,000 |
| 18 | Mini Leviathan | Mythic | Cosmic | 12.6M / 30 s | 420,000 | 630,000 | 32,000 |

- Income x2 per species (the live ones go x2–2.5), Ocean Points x1.6 (the milestones follow the rebirths).
- Rarities: 3 per label (Common 1–3, Uncommon 4–6, Rare 7–9, Epic 10–12, Legendary 13–15, Mythic 16–18).
- Intervals alternate quick / slow so that each species feels different and the coin count stays around 1–1.5 coins/s
  for a full tank, the range the collectors are tuned for (§5.8).
- The Lanternfish species is not the Abyss event's villain: a different look and a different code id (ROADMAP §4).

### 5.5 Eggs (12)

| # | Egg | Price | Hatch | Odds | Opened by (run) |
|---|---|---|---|---|---|
| 1–6 | Common → Neon Coral (live, §3) | 100 $ → 2.5M | 3 → 120 s | | runs 0–2 |
| 7 | **Wreck** | 55M | 135 s | Discus 55, **Catfish 45** | rebirth 3 (45M) |
| 8 | **Atlantis** | 144M | 150 s | Catfish 25, **Blue Tang 55**, **Baby Sunfish 20** | rebirth 4 (120M) |
| 9 | **Trench** | 6.1B | 165 s | Baby Sunfish 55, **Lanternfish 45** | rebirth 5 (5.1B) |
| 10 | **Volcano** | 15.6B | 180 s | Lanternfish 25, **Lionfish 55**, **Dragonfish 20** | rebirth 6 (13B) |
| 11 | **Crystal** | 830B | 180 s | Dragonfish 55, **Wolf-head Dogfish 45** | rebirth 7 (690B) |
| 12 | **Cosmic** | 1.8T | 180 s | Dogfish 25, **Hammerhead 55**, **Mini Leviathan 20** | rebirth 8 (1.5T) |

- Each egg costs **1.2x the rebirth that opens it** (§4) and is unlocked by buying the previous one, as today.
- Hatch times grow by 15 s per egg and **stop at 3 min**: beyond that, waiting for an egg feels like a punishment.
  The late game is paced by the prices; the Water Hen and the second incubator shorten the waits (§5.7, §5.8).
- Rarest of each egg: 45 % in the 1-species eggs, 20 % in the 2-species eggs. With 2 incubators at 3 min, a 20 %
  species takes a median ~3 hatches (~5 min) and a p90 ~10 hatches (~15 min) once the player can buy the egg in a row;
  the real wait is the money for those eggs, which the timeline includes.
- The shop shelf shows 6 slots today: with 12 eggs it shows the 6 around the best unlocked one, or scrolls (ROADMAP M0).

### 5.6 Rebirths and aquariums (8)

| Rebirth | Price | Coins (total) | Aquarium | Status | Reached (median) |
|---|---|---|---|---|---|
| 1 | 5,000 $ | x2.5 | Lagoon Aquarium | live | ~28 min |
| 2 | 1.3M | x8 | Neon Coral Lagoon | live | ~1h39 |
| 3 | 45M | x25 | Sunken Pirate Wreck | live (V0.38) | ~3h01 |
| 4 | 120M | x80 | Atlantis Ruins | live (V0.38) | ~4h47 |
| 5 | 5.1B | x250 | Mariana Trench | to build | ~6h14 |
| 6 | 13B | x800 | Underwater Volcanic Temple | to build | ~8h07 |
| 7 | 690B | x2,500 | Crystal Caverns (proposed name: the owner can replace it) | to build | ~9h49 |
| 8 | 1.5T | x8,000 | Cosmic Alien Sanctuary | to build | ~10h54 |

- Crystal Caverns links the Volcanic Temple (glowing rock) to the Cosmic Sanctuary (crystals, light): a cave of big
  soft crystals in pastel colours, glowing from inside.
- Start money stays 300 $. Multipliers ~x3.2 per rebirth (§4): after each rebirth the income is back to its previous
  level in ~15–20 min.
- The prices are not a regular ladder (45M → 120M → 5.1B → 13B → 690B → 1.5T): each one sits on the savings curve of
  its run, and the runs bringing 2 new species earn much more. The simulator tuned them on target times.
- After rebirth 8 the Rebirth menu says the next aquariums come with the next update. Money keeps growing after the end
  (~3T/min at 14 h): clamp it at 1e15 so a player farming for days never gets near 2^53 (exact integers of a Luau
  number). Both done in V0.37 (ROADMAP M0: MAX_MONEY, T / Qa).

### 5.7 Ocean Points and milestones (tank 10 → 25)

Ocean Points come from releases, and above all from the whole tank released at each rebirth (median after rebirths
1–8: 51, 2.4k, 10k, 35k, 95k, 229k, 527k, 925k, Voyage quest points included). Species points grow x1.6 per species,
so every rebirth roughly triples the total: the milestones are spaced x2–3.

| Points | Reward | Reached (median) | Moment |
|---|---|---|---|
| 50 | Pelican | ~30 min | rebirth 1 (live) |
| 100 | Faster Snail: **x1.15** (live since V0.36, was x1.5) | ~48 min | §5.8 |
| 200 | Second companion slot | ~1h15 | (live) |
| 500 | Hungry Pelican: **x1.33, every 7.5 s** (live since V0.36, was x2.5) | ~1h34 | §5.8 |
| 1,500 | **Tank 15** | ~1h39 | rebirth 2 (live) |
| 5,000 | **Second incubator**: 2 eggs of the same type at once | ~2h58 | just before rebirth 3 (live since V0.38) |
| 8,000 | **Tank 17** | ~3h01 | rebirth 3 (live since V0.38) |
| 25,000 | **Tank 19** | ~4h47 | rebirth 4 (live since V0.38) |
| 40,000 | Lucky ocean: variant chances x1.5 (Anomaly 15 %, Ghost 7.5 %, Shiny 1.5 %) | ~5h23 | side goal (+1.8 % income: not modelled; live since V0.38) |
| 70,000 | **Tank 21** | ~6h13 | rebirth 5 |
| 85,000 | **Water Hen** (companion: eggs hatch 15 % faster) | ~6h15 | rebirth 5 |
| 120,000 | **Swordfish** (companion: coin collector) | ~7h16 | run 5 |
| 180,000 | **Tank 23** | ~8h06 | rebirth 6 |
| 200,000 | **Jellyfish** (companion: feeder) | ~8h07 | rebirth 6 |
| 300,000 | Pearl rims: a pearly finish on the tank's rims (cosmetic, every theme) | ~9h15 | |
| 450,000 | **Tank 25** (the V1 maximum) | ~9h49 | rebirth 7 |
| 1,000,000 | "Ocean Guardian" title + a whale statue decor | ~11h29 | the last goal of the Ocean |

- **Capacity 15 → 25 by steps of 2** (after the live 10 → 15), each on a rebirth: the new run starts with a bigger tank,
  +10–13 % income each. 25 comes at rebirth 7 (~9h50): the last two runs are played with the full tank.
- What changes the pace (capacity, incubator, Water Hen) is in the simulation; Lucky ocean, Pearl rims and the title
  don't change it.

### 5.8 Companions and AFK farming

**AFK** = the player stays in front of their tank (focus view) without doing anything. Outside the focus view the tank is
frozen (no coins, no hunger) and there is no offline income. A fish left without food is weak 45 s after its last meal
and only farts 1 $ bubbles, so **AFK income = coins collected x fish not weak**. Both come from
`node tools/companion-sim.js --plan tools/balance-v1-plan.js` (the Pelican's perch animation, intervals, pellets and
charges, a fish eating a pellet in 1–3 s; the collectors' speed, reach, coins sinking at 4 studs/s and lying 5 s + perks
on the sand). Reference coin rate: **1 coin/s ≈ a full V1 tank of 15 fish**, 1.5/s for 25 fish.

**Who is free, who is paid** (owner's model)

| Companion | Role | Unlock | Upgrades | From (median) |
|---|---|---|---|---|
| Snail | Collects coins on the sand | free (quest "Coin Collector") | free quests + Ocean | ~5–10 min |
| Pelican | Feeds the fish | free (Ocean 50) | free quests + Ocean | ~30 min |
| Water Hen | Eggs hatch faster | free (Ocean 85,000) | **Water Hen pass**: 3 quests | ~6h15 |
| Swordfish | Collects coins in the water (replaces the Snail) | free (Ocean 120,000) | **Swordfish pass**: 3 quests | ~7h15 |
| Jellyfish | Feeds the fish (replaces the Pelican) | free (Ocean 200,000) | **Jellyfish pass**: 3 quests | ~8h05 |

Slots: 1 at the start, a second one at Ocean 200 (free), **a third one with a gamepass** (3 max). A free player with 2
slots chooses between AFK (collector + feeder) and hatch speed (the Water Hen replaces one of them while playing
actively). The free Swordfish and Jellyfish start **exactly as strong as a maxed Snail / Pelican**: free players get the
new looks, the upgrades are what their passes sell.

**Feeders: share of fish-time weak (= AFK income lost), feeder alone, by tank size**

| Stage | 5 | 8 | 10 | 12 | 15 | 17 | 19 | 21 | 23 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|
| Pelican (Ocean 50: 1 pellet / 10 s) | 10 % | 43 % | 54 % | 62 % | 69 % | 72 % | 75 % | 77 % | 79 % | 81 % |
| + Hearty meals (quest: 50 feeds, fish full 15 s longer) | 0 | 25 % | 39 % | 49 % | 59 % | 63 % | 67 % | 70 % | 72 % | 75 % |
| + Double serving (quest: 150 feeds, 2 pellets) | 0 | 0 | 0 | 1 % | 20 % | 29 % | 36 % | 42 % | 47 % | 51 % |
| + Smart Pelican (quest: 500 feeds, on demand, 2 charges) | 0 | 0 | 0 | 1 % | 20 % | 29 % | 36 % | 42 % | 47 % | 51 % |
| **+ Hungry Pelican x1.33 = every 7.5 s** (Ocean 500) | 0 | 0 | 0 | 0 | **0** | 6 % | 16 % | 24 % | 30 % | 35 % |
| **Jellyfish** (free: = a maxed Pelican) | 0 | 0 | 0 | 0 | **0** | 6 % | 16 % | 23 % | 30 % | 35 % |
| + pass quest 1: 3 charges, every 6 s | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 5 % | 13 % | 20 % |
| + pass quest 2: every 5 s | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 5 % |
| + pass quest 3: 3 pellets | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |

- **The Pelican was far too strong**: with the old x2.5 upgrade (≤ V0.35, every 4 s) it keeps 25 fish fed. With **x1.33** it
  keeps **15 fish** fed after all its quests, then struggles: 6 % weak at 17, a third of a 25-fish tank's income lost.
- Smart Pelican doesn't feed more fish (the timer Pelican's pellets wait in the water anyway): its value is no food
  clutter and the charge gauge.
- **For free players, no feeder goes past 15 fish**: from rebirth 3 (tank 17) an AFK free tank loses 6 % of its income,
  35 % at 25 fish. Active players feed by hand, and the simulator's timeline (an active player) does not move. That
  gap is the Jellyfish pass's selling point; it must stay a comfort, never a wall.

**Collectors: share of the coins picked up, collector alone, by coins dropped per second**

| Stage | 0.25/s | 0.5/s | 1/s | 1.5/s | 2/s | 3/s | 4/s |
|---|---|---|---|---|---|---|---|
| Snail | 71 % | 60 % | 46 % | 39 % | 34 % | 29 % | 25 % |
| + Lasting coins +1 s (quest 20) | 75 % | 63 % | 49 % | 41 % | 36 % | 30 % | 26 % |
| + Lasting coins II +2 s (quest 100) | 81 % | 68 % | 53 % | 45 % | 40 % | 33 % | 29 % |
| + Bouncy coins (quest 200) | 84 % | 71 % | 55 % | 47 % | 42 % | 36 % | 31 % |
| **+ Faster Snail x1.15** (Ocean 100; x1.5 until V0.35: 72 % at 1/s) | 89 % | 77 % | **61 %** | 52 % | 47 % | 39 % | 35 % |
| **Swordfish** (free: swims, grabs sinking coins; speed x0.95, reach 2) | 85 % | 73 % | **59 %** | 51 % | 46 % | 40 % | 36 % |
| + pass quest 1: speed x1.4, reach 2.5 | 97 % | 91 % | 78 % | 70 % | 64 % | 56 % | 51 % |
| + pass quest 2: speed x1.8, reach 3 | 99 % | 97 % | 91 % | 83 % | 77 % | 69 % | 64 % |
| + pass quest 3: speed x2.2, reach 3.2 | 100 % | 99 % | **96 %** | 91 % | 87 % | 79 % | 73 % |

- **Snail nerf**: its Ocean upgrade x1.5 → **x1.15** brings it to ~60 % at 1 coin/s after all its quests (72 % until V0.35).
  Its quest perks (lasting / bouncy coins) also help the player's own clicks and are unchanged.
- **Swordfish**: speeds are x the Snail's 3.6 studs/s; it swims through the water, so it doesn't wait for coins to
  sink. Free = a maxed Snail; its pass takes it to **~96 % at 1 coin/s** (~91 % with 25 fish).

**Water Hen: hatch time while equipped**

| Stage | Hatch time | Effect on the free timeline |
|---|---|---|
| Water Hen (free, Ocean 85,000) | -15 % | Included: end ~12h27 → ~12h16 |
| + pass quests 1 / 2 / 3 | -22 % / -28 % / **-35 %** | -35 %: end → ~11h54 (-22 min) |

Hatch speed matters little in this economy (the waits are for money, not for eggs): the Water Hen is a comfort, which
makes its pass a safe one.

**What AFK is worth**: free kit (maxed Snail + Pelican, or the free Swordfish + Jellyfish) ≈ 60 % of the coins on a
15-fish tank, i.e. about the model's average player (50 %); an active player earns ~1.5x more. Paid kit (Swordfish +
Jellyfish passes) ≈ 95 % of the coins on 25 fish: AFK almost as good as playing. Roblox disconnects a player after
20 min without input, so an AFK session lasts ≤ 20 min unless the player moves. AFK never buys or opens eggs: it farms
coins toward the next egg or rebirth.

### 5.9 Story quests V1

Today the story is 9 quests, all done in ~1h30 (companions, Ocean, Rebirth). V1 adds a **main line that runs to the end
of the content** and side lines that always leave something to do.

**Rule: at any time the player has 2 to 4 open story quests, and one of them is the main line.**

**Main line "Voyage"** (the Rebirth line, renamed: it continues after "Saving Up"; two quests per aquarium: find its
signature species, then reach the next aquarium)

| Aquarium | Quest | Goal | Reward | Expected (median) |
|---|---|---|---|---|
| Basic | Saving Up (live) | Hold 5,000 $ | Rebirth feature | ~25 min |
| Lagoon | Freshwater Finds | Hatch a Flame Gourami | 5 min of income | ~1h00 |
| | Deeper Waters | Rebirth 2 | 500 Ocean Points | ~1h39 |
| Neon Coral | Crown of the Reef | Hatch an Imperial Discus | 5 min of income | ~2h28 |
| | Sunken Secrets | Rebirth 3 | 1,500 Ocean Points | ~3h01 |
| Pirate Wreck | Treasure of the Wreck | Hatch a Catfish | 5 min of income | ~3h53 |
| | The Lost City | Rebirth 4 | 4,000 Ocean Points | ~4h47 |
| Atlantis | Atlantean Sun | Hatch a Baby Sunfish | 5 min of income | ~5h43 |
| | Into the Deep | Rebirth 5 | 10,000 Ocean Points | ~6h14 |
| Mariana Trench | Light of the Deep | Hatch a Lanternfish | 5 min of income | ~7h06 |
| | Heat Below | Rebirth 6 | 25,000 Ocean Points | ~8h07 |
| Volcanic Temple | Temple Guardian | Hatch a Dragonfish | 5 min of income | ~9h06 |
| | Crystal Path | Rebirth 7 | 60,000 Ocean Points | ~9h49 |
| Crystal Caverns | Howl in the Caves | Hatch a Wolf-head Dogfish | 5 min of income | ~11h12 |
| | To the Stars | Rebirth 8 | 150,000 Ocean Points | ~10h54 (done at once if already there) |
| Cosmic Sanctuary | Leviathan | Hatch a Mini Leviathan | 5 min of income | ~12h14 |
| | Master Aquarist | All 18 species in the Fish Index | Title "Master Aquarist", golden trophy decor, 300,000 Ocean Points | ~12h16 |

The Voyage quests read **gauges** (the Fish Index, the rebirth count), not counters: a quest whose goal is already met
when it opens completes at once (e.g. a Dogfish hatched before rebirth 8), so the line never blocks.

**Side lines**

| Line (opens with) | Quests (goal → reward) | Price |
|---|---|---|
| Snail (Story1, live) | 20 / 100 / 200 coins picked up → Lasting coins, Lasting coins II, Bouncy coins | free |
| Pelican (owning it, live) | 50 / 150 / 500 feeds → Hearty meals, Double serving, Smart Pelican | free |
| **Water Hen** (owning it) | eggs opened with it equipped: 50 / 150 / 400 → hatch -22 / -28 / -35 % | Water Hen pass |
| **Swordfish** (owning it) | coins picked up: 300 / 1,000 / 3,000 → speed x1.4 reach 2.5, x1.8 reach 3, x2.2 reach 3.2 | Swordfish pass |
| **Jellyfish** (owning it) | feeds: 300 / 1,000 / 3,000 → 3 charges every 6 s, every 5 s, 3 pellets | Jellyfish pass |
| **Hatchery** (Story1) | open 100 / 300 / 600 / 900 / 1,200 eggs (~1h30, ~4h, ~8h, ~10h, ~12h) → 2 min of income each, the last one an incubator decor | free |
| **Collector** (Story1) | first Anomaly / Ghost / Shiny → 250 / 750 / 2,500 Ocean Points; 10 / 25 / 50 variant cells in the Fish Index → sticker frames, a "Collector" title | free |
| **Ocean** (Story1; "Full House" is live) | release 50 fish → 3 min of income; release a Shiny → "Ocean Friend" title | free |

The paid lines are shown in the quest book from the moment the companion is owned, locked, with their pass: the player
sees what they would get. Pace of the paid lines: at 20 fish the Jellyfish feeds ~20 fish a minute (300 feeds ≈ 15 min
of play, 3,000 ≈ 2h30); the Swordfish picks up ~1 coin/s (300 ≈ 5 min, 3,000 ≈ 50 min); the Water Hen sees ~1–1.5
eggs a minute late in the game (400 ≈ 5 h): it is the slow one, on purpose (its effect is the smallest).

**New quest stats**: `SpeciesHatched` (a given species, gauge from `hatched`), `Rebirths` (gauge), `EggsOpened`,
`VariantHatched`, `IndexCells` (gauge), `FishReleased`, and a stat per companion (coins picked up, feeds, eggs opened
while equipped). **New reward kinds**: `IncomeMinutes` (minutes of the tank's current income x rebirth multiplier, so it
is worth something in every run), `OceanPoints`, `Title`, `Decor`. A line can require a gamepass.

**Weight of the rewards** (`QUEST_REWARDS` of the plan): the Voyage line's "5 min of income" and Ocean Points are
modelled; together they move the end by ~30 min. The side lines' rewards are cosmetic, perks already counted, or a few
minutes of income (~1 % of the game): not modelled. Rule: **no quest reward multiplies the income or the Ocean Points
permanently**, so quests can be added or reworded without touching the pace.

### 5.10 Gamepasses (outside the balance)

Rule: **the free timeline (§5.3) is the only target.** Prices and milestones are tuned for a player with no pass and are
never raised because passes exist. A pass shortens the game or adds comfort for its owner; it never locks progression
content (species, eggs, aquariums, capacity, companions themselves) away from free players.

| Pass | What it does | Effect on the V1 end (median, simulator) |
|---|---|---|
| Water Hen pass | Its 3 upgrade quests (hatch up to -35 %) | 12h16 → ~11h54 |
| Swordfish pass | Its 3 upgrade quests (~96 % of the coins AFK) | none on the timeline (an active player); AFK income ~x1.6 |
| Jellyfish pass | Its 3 upgrade quests (25 fish fed AFK) | none on the timeline; AFK income +6–35 % on 17–25 fish |
| Third companion slot | Collector + feeder + Water Hen at once | none on the timeline; AFK and hatch speed together |
| x2 Ocean Points | Milestones earlier (tank 25 at ~8h00 instead of ~9h50) | 12h16 → ~12h06 |
| Lucky | Variant chances x2 | none (variants are outside the 12 h) |
| **+50 % Coins** (decided) | Coins x1.5, sold as "+50 % coins" | **12h16 → ~8h58 (-27 %)** |
| *x2 Coins (rejected)* | *Coins x2* | *12h16 → ~7h10 (-41 %)* |

- The companion passes and the slot pass sell **AFK comfort**: they barely move the active timeline, which is why they
  fit "not pay-to-progress". Their gap only shows when AFK; keep the free kit honest (≈ an average player).
- **The coins pass is +50 % (x1.5), decided 2026-10-30.** x2 would be worth ~5 hours in this economy (most of a run
  is saving: x2 halves it and crosses the price cliffs earlier), x1.5 ~3h15: a real gain that keeps payers and free
  players in the same game. Never compensate by raising prices.
- Not recommended: a faster-hatch pass on top of the Water Hen's, a second coins pass (passes never stack beyond the
  +50 % on coins and the x2 on Ocean Points). The like boost (x2, 5 min) and the events stack with the passes: fine, they are short.

---

## 6. Live → V1: changes to existing numbers

| What | Live (V0.35) | V1 | Why |
|---|---|---|---|
| Pelican's Ocean upgrade (500 points) | x2.5, every 4 s: keeps 25 fish fed | **x1.33, every 7.5 s**: 15 fish | Owner's brief; the Jellyfish takes over with its pass. **Shipped in V0.36** (M1) |
| Snail's Ocean upgrade (100 points) | x1.5: ~72 % of the coins at 1 coin/s | **x1.15**: ~61 % | Owner's brief; the Swordfish takes over with its pass. **Shipped in V0.36** (M1) |
| Ocean milestones above 1,500 | none | second incubator, tank 17 → 25 by 2s, Water Hen, Swordfish, Jellyfish, Lucky ocean, cosmetics | Ocean Points stay a progression all game long |
| Companion slots | 2 (Ocean 200) | 2 free + a third with a gamepass | Owner's model |
| Egg prices from egg 7 on | — | 1.2x the rebirth that opens them | Same rule as the Neon Coral Egg (§4) |
| Rebirth multipliers | x2.5, x8 | x2.5, x8, x25, x80, x250, x800, x2,500, x8,000 | ~x3.2 per rebirth (§4) |
| Rebirth line of the quest book | "Saving Up" only | the "Voyage" main line, 17 quests | Something to do until the end of V1 |

Rebirths 1–2, eggs 1–6 and species 1–9 do not move: the first 2h30 stay as tested. The two nerfs shipped first, in
V0.36 (ROADMAP M1).

---

## 7. History

| Version | Change | Effect (medians) |
|---|---|---|
| ≤ V0.29 | 6 species, 4 eggs, rebirth 1 (5k, x2.5), Ocean milestones 50–500, tank of 10 | Rebirth 1 ~28 min, first six species ~58 min; then the income levels off at ~80k $/min from ~90 min (nothing left to buy) |
| V0.30 | Amazon (150k) and Neon Coral (2.5M) eggs, Silver Angelfish / Pirate Fish / Imperial Discus, rebirth 2 (1.3M, x8, Neon Coral Lagoon), Ocean milestone 1,500 → 15 fish | Rebirth 1 ~28 min (unchanged), first six ~60 min (the Amazon Egg also hatches Gouramis), rebirth 2 ~1h44, all nine ~2h31 |
| V0.31 | French Fish easter egg (0.1 % of any egg, croissant = 0.5 x tank income per minute, 100 points, leaves after 1 h); Pirate Fish and Imperial Discus become Rare (label only) | Unchanged within the noise: rebirth 1 ~28 min, first six ~60 min, rebirth 2 ~1h43, all nine ~2h29; ~17 % of players meet a French Fish in their first ~3 h |
| V0.35 (plan) | V1 balance plan, not in the game: 18 species (x2 income, x1.6 points), 12 eggs (1.2x their rebirth, hatch ≤ 3 min), 8 rebirths (~x3.2 each, to x8,000), Ocean milestones to 1,000,000 (tank 15 → 25 by 2s, second incubator), Voyage main quest line | Rebirths 3–8 at ~3h01 / 4h48 / 6h12 / 8h10 / 9h56 / 11h04, all 18 species and 8 aquariums ~12h27 |
| V0.35 (plan, rev. 2) | The owner's species and aquariums (Mariana Trench, Volcanic Temple, Crystal Caverns, Cosmic Sanctuary); companions Water Hen (Ocean 85,000, hatch -15 %, pass to -35 %), Swordfish (120,000, a maxed Snail, pass to ~96 %), Jellyfish (200,000, a maxed Pelican, pass to 25 fish); a third slot by gamepass; Snail's Ocean upgrade x1.5 → x1.15 (~60 %), Pelican's x2.5 → x1.33 (15 fish) | All 18 species and 8 aquariums **~12h16** (11h37–12h53), -11 min from the free Water Hen; pass estimates: Water Hen -22 min, x2 Coins -41 %, x1.5 Coins -27 % (the coins pass is +50 %, decided) |
| V0.36 | ROADMAP M1, live: Snail's Ocean upgrade (100 points) x1.5 → x1.15, Pelican's (500 points) x2.5 → x1.33 (every 4 s → 7.5 s) | Active timeline unchanged (companions are not in the economy model): rebirth 1 ~28 min (22–36), rebirth 2 ~1h43, all nine ~2h28 (2h11–2h50). AFK: a maxed Snail picks up ~61 % of the coins at 1 coin/s (was ~72 %), a maxed Pelican keeps 15 fish fed (was 25), 6 % weak at 17 fish, 35 % at 25 |
| V0.38 | ROADMAP M2, live: Catfish (Epic, 16k / 10 s, 800 points), Blue Tang (19.2k / 6 s, 1,300), Baby Sunfish (130k / 20 s, 2,000); Wreck Egg (55M, 135 s) and Atlantis Egg (144M, 150 s); rebirths 3 (45M, x25, Pirate Wreck) and 4 (120M, x80, Atlantis); Ocean milestones 5,000 (second incubator), 8,000 (17 fish), 25,000 (19 fish), 40,000 (Lucky ocean); Voyage quests 1–7 (5 min of income per signature species, 500 / 1,500 / 4,000 Ocean Points per rebirth). Plan's numbers, unchanged | Matches the plan: rebirth 3 ~3h01 (2h44–3h19), rebirth 4 ~4h47 (4h21–5h11), all twelve species ~5h42 (5h13–6h10). Rebirth 2 ~1h43 → ~1h40 and the 15-fish milestone with it (Voyage quests: 5 min of income at the Flame Gourami, +500 points at rebirth 2) |
