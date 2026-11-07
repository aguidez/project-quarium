# BALANCE — Project: Quarium

> The game's balance: what an average player reaches after how long, and why. **Update it in the same task whenever a
> number of the economy changes** (fish income, eggs, odds, rebirths, Ocean milestones, variants, food, capacity,
> companions…): run the simulators, copy their results here, add a line to the history (§6).
> Last updated: 2026-11-07 (V1.2 plan tuned, not in the game: tools/balance-v1.2-plan.js, ROADMAP_V1.2.md; §6).


**Where the numbers live**: `src/shared/types/fish.ts` (species), `eggs.ts` (eggs), `rebirths.ts` (rebirths),
`variants.ts` (variants), `oceanRewards.ts` (Ocean milestones), `companions.ts` / `perks.ts` / `quests.ts`
(companions, quest bonuses). **How they are checked**:

| Tool | What it plays |
|---|---|
| `node tools/economy-sim.js` | The live economy (mirrors the config: keep it in sync), 2,000 average players second by second |
| `node tools/companion-sim.js` | AFK farming: how many fish the Pelican keeps fed, the share of the coins the Snail and the Swordfish pick up, the Jellyfish |
| `node tools/starfall-sim.js` | The starfall's star gauge (mirrors `stars.ts`): bars filled per share of stars caught, the next egg's variant, what a 12 h run gets; `--fourthBar 0.9` plays the V1.2 plan's 4th bar (Galaxy) |
| `node tools/economy-sim.js --plan tools/balance-v1.2-plan.js` | The V1.2 plan (ROADMAP_V1.2.md): rebirths 9–12, eggs 13–16, species 19–24, tank 33, the Size score (`P.sizeMax`), Galaxy; not in the game |

How to add content (species, theme, companion, egg): `docs/agent-notes/content-recipes.md`.

Options: `--players 300` (faster, noisier), a JSON of overrides (`'{"P":{"coinBoost":2}}'`, see the file headers),
`--plan <file.js>` to preview a planned economy (how the V1 plan was tuned before it was built).

---

## 1. The average player (the simulator's model)

- Collects **50 %** of the value of the coins its fish drop (clicks plus companions). Calibrated on the first
  playtests ("6 fish at ~1 h").
- Feeds its fish (one meal every ~35 s per fish). Food is free since V0.60.6 (the food reserve, §4): feeding costs
  clicks, not money. Hunger never kills.
- Saves for the **best unlocked egg**. It buys a cheaper egg only to fill an empty slot, to find a missing species,
  or when that egg clearly beats its weakest fish.
- Once the tank is full and the Ocean is open (story quest "Full House": 10 fish), it **releases its weakest fish**
  to make room. That earns Ocean Points.
- **Rebirths as soon as it can afford the next rebirth**, and claims each Ocean milestone as soon as it reaches it.
- **Plays 1 h a day** (since V0.46, the owner's reference) and does its daily quests every day once they are open
  (rebirth 2: coins x2 for 15 min in all, claimed mid-session) and its weekly quests every week (rebirth 3: x2 for
  45 min, mid-week). The boost runs only while
  it plays. `P.hoursPerDay` (0 = one long session, no daily quest).
- **The owner's test speed** ("/speed" in Studio, never for players): coins, hatching and Ocean Points x the speed;
  simulated with `{"P":{"coinBoost":6,"oceanBoost":6,"hatchScale":0.1667,"hoursPerDay":0}}`: at x6 all eighteen
  species in **~2h29** (2h13–2h43), x5 ~3h00. Coins x6 alone are not enough (~3h50): hatching and the Ocean milestones
  then hold the game back.
- **Not modelled**: AFK time (coins and hunger stop while away), companions' extra pick-ups, the like boost (x2),
  events (Island Breeze x2 coins, Abyss x1.5, K-pop beat coins, the UFO night's mutations and Alien Fish, the starfall's
  star power: §3 Easter eggs, §3 Starfall). The story quests' money and points are modelled (Voyage, Hatchery, Collector, Ocean lines). They all make real
  players a bit faster than the simulator; the spread between players (p10–p90 below) is wider than these effects.
- **Gamepasses are never part of the model** (§5.10).

All times below are **minutes / hours of play in front of the tank** (medians, with p10–p90 when useful).

---

## 2. Live game: expected progression (V0.60.6)

**The reference player plays 1 h a day** (§1) and does its daily and weekly quests: their coin boosts (x2 for 15 min a
day, 45 min a week) are part of this timeline, and the prices from rebirth 3 on are tuned for it (1.45x the plan's:
§3). Since V0.48 the daily quests open at rebirth 2 and the weekly ones at rebirth 3 (the first hours stay on the
story quests: +~18 min at the end, not re-tuned, decided by the owner). Times are hours of play; "day n" is that
player's calendar. A player who never stops (no daily quest) needs longer, one who plays 3 h a day a bit longer too
(fewer boosts per hour played): see §5.9.

| Time | What the average player reaches | Why it happens then |
|---|---|---|
| 0–2 min | Tutorial: free egg, first Golden Guppy, first coin, first meal, +300 $ | Onboarding, scripted |
| ~3 min | Blue Neon (Common Egg, 20 %) | Common Egg 100 $, guppies earn 1 $/s each |
| ~5–10 min | Snail (story quest "Coin Collector", 300 $ of coins) | First companion: collects coins for the player (its pickups are not in the simulator) |
| ~6 min (5–18) | Collector "Strange Glow": first Anomaly, 2 min of income | Opens with "Full House" (10 fish); Anomaly 10 % |
| ~9 min | Red Tetra (Improved Egg, 500 $) | Improved Egg unlocked by buying a Common Egg |
| **~19 min** (15–23) | **Rebirth 1** (5,000 $, quest "Saving Up"): coins x2.5, Lagoon Aquarium | The Freshwater Egg (25k) is out of reach before it; the rebirth gets past it |
| ~21 min | 50 Ocean Points: **Pelican** | The fish released at rebirth 1 give ~50 points |
| ~29 min | Clownfish (Superior Egg, 2,500 $, 15 %) |  |
| ~37 min | 100 Ocean Points: Faster Snail; Zebra Danio (Freshwater Egg, 25k, ~39 min); Collector: 10 Fish Index cells and the first Ghost (2 + 3 min of income) |  |
| **~46 min** (37–60) | **The first six species** (Flame Gourami, 15 % of the Freshwater Egg, or 55 % of the Amazon Egg) | Voyage quest "Freshwater Finds": 5 min of income. End of day 1 |
| ~55 min | Ocean "Back to the Sea": 50 fish released, 3 min of income |  |
| ~60 min | **Silver Angelfish** (Amazon Egg, 150k, 45 %); 200 Ocean Points: second companion slot | Amazon Egg unlocked by the Freshwater Egg |
| ~1h18 | 500 Ocean Points: Hungry Pelican (x1.33: every 7.5 s) | With all its quests it keeps 15 fish fed (§5.8) |
| **~1h24** (1h12–1h37) | **Rebirth 2** (1.3M): coins x8, **Neon Coral Lagoon**; 1,500 Ocean Points: **15 fish**; Hatchery: 100 fish hatched; **the daily quests open** | Day 2. The rebirth releases a whole tank (~2,000 points) + Voyage "Deeper Waters" (500 points) |
| ~1h50 | Pirate Fish (Neon Coral Egg, 2.5M, 55 %) | The Neon Coral Egg costs more than rebirth 2: it is reached after it |
| **~2h04** (1h43–2h29) | **All nine first species** (Imperial Discus, 20 % of the Neon Coral Egg) | Voyage "Crown of the Reef": 5 min of income |
| ~2h38 | 5,000 Ocean Points: **second incubator** | Two eggs of a kind at once: the late hatches (2–2.5 min) stop being a bottleneck |
| **~2h40** (2h31–2h58) | **Rebirth 3** (65M): coins x25, **Sunken Pirate Wreck**; 8,000 Ocean Points: **17 fish**; **the weekly quests open** | Day 3. Voyage "Sunken Secrets" (1,500 points) |
| ~3h12 (2h38–4h08) | Collector: 25 Fish Index cells and the first Shiny (2,500 + 2,500 Ocean Points) | Shiny 1 % (1.5 % with Lucky ocean) |
| ~3h34 (3h10–3h53) | **Catfish** (Wreck Egg, 78M, 45 %) | The Wreck Egg costs 1.2x rebirth 3: reached after it. Voyage "Treasure of the Wreck" |
| ~4h13 | Hatchery: 300 fish hatched |  |
| **~4h19** (4h01–4h38) | **Rebirth 4** (175M): coins x80, **Atlantis Ruins**; 25,000 Ocean Points: **19 fish** | Day 5. Voyage "The Lost City" (4,000 points) |
| ~4h25 | 40,000 Ocean Points: Lucky ocean (rare variants x1.5) | Side goal: +1.8 % income, not modelled |
| ~5h07 | Blue Tang (Atlantis Egg, 210M, 55 %) |  |
| **~5h16** (4h42–5h42) | **All twelve species** (Baby Sunfish, 20 % of the Atlantis Egg) | Voyage "Atlantean Sun" |
| **~5h44** (5h23–6h21) | **Rebirth 5** (7.4B): coins x250, **Mariana Trench**; 70,000 Ocean Points: **21 fish**; 85,000: **Water Hen** | Day 6. The rebirth's release and Voyage "Into the Deep" (10,000 points) cross both milestones at once |
| ~6h34 | 120,000 Ocean Points: **Swordfish** |  |
| **~6h44** (6h16–7h26) | Species 13, **Lanternfish** (45 % of the Trench Egg, 8.9B) | Voyage "Light of the Deep" |
| ~7h19 | Hatchery: 600 fish hatched |  |
| **~7h57** (7h26–8h37) | **Rebirth 6** (19B): coins x800, **Volcanic Temple**; 180,000 Ocean Points: **23 fish**; 200,000: **Jellyfish** | Day 9. The rebirth's release and Voyage "Heat Below" (25,000 points) |
| ~8h48 (8h27–9h36) | **Lionfish** (Volcano Egg, 23B, 55 %) | The Volcano Egg costs 1.2x rebirth 6: reached after it |
| ~9h05 | 300,000 Ocean Points: **Pearl rims** (cosmetic) |  |
| **~9h04** (8h34–9h44) | **All fifteen species** (Dragonfish, 20 % of the Volcano Egg) | Voyage "Temple Guardian" |
| **~9h50** (9h26–10h36) | **Rebirth 7** (1T): coins x2,500, **Crystal Caverns**; 450,000 Ocean Points: **25 fish** (the maximum) | Day 11. Voyage "Crystal Path" (60,000 points) |
| ~9h59 | Hatchery: 900 fish hatched |  |
| **~10h56** (10h34–11h31) | **Rebirth 8** (2.2T): coins x8,000, **Cosmic Sanctuary**, the last aquarium | Day 12. Voyage "To the Stars" (150,000 points). The Crystal Egg (1.2T) costs more than rebirth 7: most players rebirth again first |
| ~10h59 (9h48–11h51) | Collector: 50 Fish Index cells, the **Collector** title |  |
| ~11h15 (10h33–12h02) | Species 16, **Husky Dogfish** (Crystal Egg 45 %, Cosmic Egg 25 %) | Voyage "Puppy in the Caves" |
| ~11h29 | 1,000,000 Ocean Points: **Ocean Guardian** title + whale statue in the tank | The last goal of the Ocean |
| ~12h02 (11h22–12h44) | **Bunny Shark** (Cosmic Egg, 2.6T, 55 %) |  |
| **~12h18** (11h35–13h01) | **All eighteen species** (Mini Leviathan, 20 % of the Cosmic Egg): the end of V1 | Day 13. Voyages "Leviathan" and "Master Aquarist" (title + golden trophy + 300,000 points); the Rebirth menu says more aquariums are coming |
| after | Hatchery: 1,200 fish hatched, the **Golden Incubator** (1 player in 3 before the end, median ~11h35 for them) | A goal past the end, with the variants |
| any time | The French Fish (secret, 0.1 % of any egg): ~2 players in 3 hatch one in the run (median first one ~5h40) | See §3 Easter eggs |
| after | Variants (Anomaly 10 %, Ghost 5 %, Shiny 1 %; x1.5 with Lucky ocean) to complete the Fish Index, Ocean Points | Nothing new to buy: the end of V1 |

**Money collected per minute** (median, boosts included): 15 min 1.1k $, 30 min 4.9k, 60 min 51k, 90 min 82k, 2 h 854k,
2h30 1.6M, 3 h 3.6M, 4 h 14M, 5 h 70M, 6 h 209M. The Water Hen is assumed equipped from 85,000 points (eggs hatch in 0.85x their
time; hatch speed matters little, §5.8).

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
| Lanternfish | Legendary | Nautilus shell | 156,000 $ / 12 s | 13,000 | 19,500 | 3,200 |
| Lionfish | Legendary | Coral fan | 208,000 $ / 8 s | 26,000 | 39,000 | 5,000 |
| Dragonfish | Legendary | Dragon scale | 1,300,000 $ / 25 s | 52,000 | 78,000 | 8,000 |
| Husky Dogfish | Mythic | Silver moon | 1,575,000 $ / 15 s | 105,000 | 157,500 | 13,000 |
| Bunny Shark | Mythic | Golden star | 4,200,000 $ / 20 s | 210,000 | 315,000 | 20,000 |
| Mini Leviathan | Mythic | Ringed planet | 12,600,000 $ / 30 s | 420,000 | 630,000 | 32,000 |

Growth (default): x1 at birth, x1.2 after 5 min, x1.5 after 10 min in the water. One coin out of 15 sparkles (x2).
Rarity is only a label (Fish Index order, colours).

### Easter eggs (`fish.ts` FishConfig.easterEgg)

| Fish | Chance | Coin | Value | Ocean Points | Stays |
|---|---|---|---|---|---|
| French Fish (Secret) | 0.1 % of any egg, taken from its most common fish, shown nowhere | Croissant, every 60 s | 0.5 x the tank's theoretical income per minute (other fish, growth and variants, sparkling coins on average), then x rebirth, like, event; sparkles 1/15 (x2) | 100 | 1 h of tended time (age), then leaves for the ocean with its points |

| Alien Fish (Secret) | Never from an egg: 0.5 % of the fish a UFO kidnaps (UFO night) | None | Its scream, every 30 s of play: every other awake fish of the tank drops one plain coin (no sparkle, no ghost coin), on top of its own | 500 | Until released |
| Sugar (Secret) | Never from an egg: 1 % of the likes a player gives, into the giver's own tank (past the onboarding), even a full one; one per tank | Sugar cube, as often as the tank's best fish (highest income per second, variant pace included) | 1.1 x that fish's coin at its growth stage, then its own sparkle roll (1/15, x2) and x rebirth, like, pass, event | 500 | Until released |

No variant. The French Fish earns +50 % of the tank for an hour: a nice bonus that never breaks the curve (the
simulator's medians move by less than the noise). None of them is one of the 18 species of the V1 count.

**Sugar** (V0.60.14; likes are not in the simulator): a copy of the best fish at 110 %, so **+1.1 / N** of the income
of a tank of N similar fish (+4 % for a full 25-fish late tank, +11 % for 10), more while one fish dominates the tank
(+50 % to +100 % early, when the best fish earns half of it or more). A player gives one like an hour at most (1 % each): ~1 player in 10 who likes every hour of a 12 h run
meets her, fewer for the others. One per tank, so her bonus never stacks. Released, she gives 500
Ocean Points, like the Alien Fish. A lucky bonus a player keeps, not part of the reference curve.

**The UFO night** (V0.49, recurring with the Abyss, one minute; not in the simulator): 4–5 kidnappings per tank, each
fish once. Per kidnapping the expected effect is tiny: green (55 %) +1 fish-minute of coins, red (20 %) −0.5, asleep
(20 %) −1, so **+0.25 fish-minute** on average, ~+1 fish-minute per night: noise. A recurring event every ~12 min
(~11 min of clock + the minute itself) picks one of the four recurring events, so a UFO night every ~48 min of a
server's life, ~1.25 an hour: over a 12 h run ~15 nights, ~70 kidnappings, **~3 better variants** (mostly Normal →
Anomaly on fish soon replaced) and **~0.35 Alien Fish** (about one player in three meets one). The Alien Fish takes one slot (−1/25 of a full tank) but its
scream adds one coin of every fish every 30 s: + interval / 30 of the tank's income, **+17 % to +100 %** (4–5 s fish to
30 s ones), more for a late-game tank (Mythics drop every 15–30 s). A lucky bonus, like the French Fish, that a player
keeps; it is rare enough not to be part of the reference curve.

**Music events: K-pop vs Island Breeze** (`events.ts` `beatCoins`; not in the simulator). The K-pop (admin only) gives
every fish the same 20 % chance on each of its 130 beats a minute, ~26 extra coins per fish per minute whatever its pace:
coins x(1 + 26 x interval / 60) for its minute, **+1.7 min of income** for a 4 s Guppy, +4.3 for a 10 s fish, +8.7 for
20 s, **+13 min for a 30 s Mythic**. The later the game, the bigger the gift: recurring, it would add ~+40 % to a
late-game hour, which is why it stays an admin event. **Island Breeze** (recurring, 124 BPM, 60 s) paces the coins on
each fish's own interval: on every other beat (the track's accented backbeat, every 0.97 s) each fish drops its coin
with chance boost x 0.97 s / its payout interval (variant included), the boost growing 0.5 → 1.5 over the minute
(average 1), so **coins x2 on average (x1.5 at the start, x2.5 at the end) for every fish at every stage: +1 min of
income**. The finale (~57 s) drops every fish's coin at once: + one interval of income, +4 s (Guppy) to +30 s (Mythic).
Total **+1.1 to +1.5 min of income per event**; at ~1.25 an hour (four recurring events), +1.4 to +1.9 min an hour
(**+2.5 to +3 %** while playing), less than the p10–p90 spread of the reference run. Studio check (V0.51, an 11-fish rebirth-5 tank): ~37 coins
per 20 s before, 62 / 68 / 91 in the event's three 20 s thirds (x2.0 on the minute), finale 10 coins on one beat.

### Starfall (`stars.ts`, `node tools/starfall-sim.js`)

A recurring event (V0.52, one minute, ~1.25 an hour with the four recurring events; not in the economy simulator). 16–20
stars fall into each owned tank (one per slot of equal length, from 2 s after the start to 8 s before the end); the
owner clicks them. Each one fills the star gauge by a random amount; at the end the gauge is at least **1.5 bars x the
share of the stars caught** (catching them all never gives less than 1.5 bars, whatever the sizes). The gauge becomes
the star power if it beats the one kept; the next egg opened spends it.

| Star | Share | Bars filled | Size |
|---|---|---|---|
| Small | 56 % | 0.05–0.09 | 1.3 studs |
| Medium | 30 % | 0.11–0.18 | 1.8 |
| Big | 11 % | 0.25–0.40 | 2.5 |
| Huge | 3 % | 0.60–0.90 | 3.4 |

| Star power | Next egg's variant (the player's luck multiplies the chances of the better ones) |
|---|---|
| Under 1 bar (p filled) | The usual chances x (1 + 2p): up to x3 just under one bar |
| 1 bar + p | **Anomaly** at least; Ghost 10 → 40 %, Shiny 2 → 6 % as the second bar fills |
| 2 bars + p | **Ghost** at least; Shiny 5 → 40 % |
| 3 bars | **Shiny** |

| Stars caught | Bars (p10 / median / p90) | 1 / 2 / 3 bars reached | Next egg: Anomaly / Ghost / Shiny | A 12 h run (15 starfalls) |
|---|---|---|---|---|
| 40 % | 0.49 / 0.94 / 1.66 | 45 / 4 / 0 % | 44 / 18 / 3.5 % (Normal 34 %) | 6.6 Anomaly, 2.7 Ghost, 0.5 Shiny |
| 60 % | 0.90 / 1.44 / 2.27 | 84 / 18 / 1 % | 52 / 32 / 7 % | 7.7, 4.7, 1.1 |
| 75 % | 1.23 / 1.83 / 2.70 | 98 / 38 / 5 % | 42 / 44 / 13 % | 6.2, 6.6, 2.0 |
| 100 % | 1.82 / 2.46 / 3.00 | 100 / 81 / 21 % | 12 / 53 / 35 % | 1.8, 8.0, 5.3 |

**Why it doesn't break the curve**: a 12 h run opens ~900 eggs, which already give ~90 Anomalies, ~45 Ghosts and ~9
Shinies; a player catching three stars out of four adds ~6, ~7 and ~2. A variant earns +20 to +35 % on one fish out of
up to 25 (+1 % of the tank), so the coins don't move; what moves is collection: the first Shiny (Collector line,
2,500 Ocean Points, median 3h27 in the simulator) comes earlier for a lucky or skilled player, and Shiny Fish Index
cells fill faster. The power waits for an egg (no hurry), the best of two starfalls is kept (no stacking past 3 bars).

### Eggs (`eggs.ts`)

| Egg | Price | Hatch | Odds | Unlocked by |
|---|---|---|---|---|
| Common | 100 $ (free while the player has no fish) | 3 s | Guppy 80, Neon 20 | — |
| Improved | 500 $ | 8 s | Guppy 30, Neon 52, Tetra 18 | a Common Egg |
| Superior | 2,500 $ | 20 s | Neon 35, Tetra 50, Clownfish 15 | an Improved Egg |
| Freshwater | 25,000 $ | 45 s | Tetra 45, Danio 40, Gourami 15 | a Superior Egg |
| Amazon | 150,000 $ | 75 s | Gourami 55, Angelfish 45 | a Freshwater Egg |
| Neon Coral | 2,500,000 $ | 120 s | Angelfish 25, Pirate 55, Discus 20 | an Amazon Egg |
| Wreck | 78M (55M before V0.46) | 135 s | Discus 55, Catfish 45 | a Neon Coral Egg |
| Atlantis | 210M (144M) | 150 s | Catfish 25, Blue Tang 55, Baby Sunfish 20 | a Wreck Egg |
| Trench | 8.9B (6.1B) | 165 s | Baby Sunfish 55, Lanternfish 45 | an Atlantis Egg |
| Volcano | 23B (15.6B) | 180 s | Lanternfish 25, Lionfish 55, Dragonfish 20 | a Trench Egg |
| Crystal | 1.2T (830B) | 180 s | Dragonfish 55, Husky Dogfish 45 | a Volcano Egg |
| Cosmic | 2.6T (1.8T) | 180 s | Husky Dogfish 25, Bunny Shark 55, Mini Leviathan 20 | a Crystal Egg |

One egg of each type incubates at a time, two from the 5,000-point Ocean milestone (~2h44): the hatch time paces the
farming of the best egg. Eggs bought while the **Water Hen** is equipped hatch 15 % faster (up to 35 % with its pass
quests).

### Rebirths (`rebirths.ts`)

| Rebirth | Price | Coins (total, not stacked) | Start money | Aquarium |
|---|---|---|---|---|
| 1 | 5,000 $ | x2.5 | 300 $ | Lagoon Aquarium |
| 2 | 1,300,000 $ | x8 | 300 $ | Neon Coral Lagoon |
| 3 | 65M (45M before V0.46) | x25 | 300 $ | Sunken Pirate Wreck |
| 4 | 175M (120M) | x80 | 300 $ | Atlantis Ruins |
| 5 | 7.4B (5.1B) | x250 | 300 $ | Mariana Trench |
| 6 | 19B (13B) | x800 | 300 $ | Volcanic Temple |
| 7 | 1T (690B) | x2,500 | 300 $ | Crystal Caverns |
| 8 | 2.2T (1.5T) | x8,000 | 300 $ | Cosmic Sanctuary |

Rebirths 3–8 and their eggs cost 1.45x the V1 plan's since V0.46: the daily / weekly coin boosts are part of the
reference player's game, and without it V1 ended at ~9h45 for 1 h a day (§2). A rebirth resets money, fish, eggs and egg unlocks; it keeps the Fish Index, quests, companions, Ocean Points,
Ocean milestones (and so the tank size), perks and likes. The fish go to the ocean for their Ocean Points.

### Ocean milestones (`oceanRewards.ts`)

When each one is reached: §2.

| Points | Reward |
|---|---|
| 50 | Pelican |
| 100 | Faster Snail: speed x1.15 |
| 200 | Second companion slot |
| 500 | Hungry Pelican: feeds x1.33 as often (every 7.5 s) |
| 1,500 | Aquarium holds 15 fish instead of 10 |
| 5,000 | Second incubator: 2 eggs of the same kind at once |
| 8,000 | Aquarium holds 17 fish |
| 25,000 | Aquarium holds 19 fish |
| 40,000 | Lucky ocean: rare variants x1.5 (Anomaly 15 %, Ghost 7.5 %, Shiny 1.5 %) |
| 70,000 | Aquarium holds 21 fish |
| 85,000 | Water Hen (companion: eggs hatch 15 % faster while equipped) |
| 120,000 | Swordfish (companion: grabs the coins in the water, as a maxed Snail) |
| 180,000 | Aquarium holds 23 fish |
| 200,000 | Jellyfish (companion: feeds on demand, as a maxed Pelican) |
| 300,000 | Pearl rims (cosmetic: a pearly finish on the rims, every theme) |
| 450,000 | Aquarium holds 25 fish (the maximum) |
| 1,000,000 | "Ocean Guardian" title above the head + a whale statue in the tank (cosmetics) |

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
- **Food is free, its pace is limited** (V0.60.6): the beta's players spent all their money on food. The food reserve
  holds 5 portions, each one back 10 s after use (each slot on its own timer): up to 30 meals a minute by hand, enough
  for ~22 fish that eat every 45 s (a fish only eats once hungry, 30 s after its meal, weak at 45 s). A 25-fish tank
  (rebirth 7) needs ~33: the feeders (§5.8) and Hearty meals (+15 s, ~25–33 fish) make up the rest. The reserve stops
  the spam-clicking, never a normal tank. Not in the simulator (it doesn't model hunger).
- **Gamepasses are not a lever of the balance**: prices and milestones are tuned for a free player (§5.10).
- **Early quests pay income, not Ocean Points.** The first Ocean milestones are small (50 / 100 / 200 / 500 / 1,500
  points): a few hundred points from a quest in the first hour bring the Pelican, the second companion slot and the
  15-fish tank forward all at once (the Collector's first plan, 250 / 1,000 / 750 points, put them all at ~10–50 min).
  Before ~3 h a quest pays minutes of income (they speed every step up evenly); Ocean Points only once the player
  holds thousands of them. Always simulate a quest reward before shipping it.

---

## 5. V1 design (fully live since V0.44)

Why the V1 content (18 species, 12 eggs, 8 rebirths, a tank of 25 fish, 5 companions, the Voyage line) is shaped the way
it is. It was tuned as a plan first (`tools/balance-v1-plan.js`, removed in V0.50 once fully in the game: see git
history); its live numbers are §2–§3. Every new design goes through the moderation check of CLAUDE.md §7 before any asset is
generated.

### 5.1 Goals and verdict

Owner's brief: 8 rebirths, each with its aquarium (8 themes after the Basic one), 18 species, a tank that ends at 25
fish through the Ocean Points, a fast first 2 hours then a progressive slowdown that never gets frustrating, **12–14 h to
own every species (normal) and every aquarium**; variants are a side goal outside that count; gamepasses help but never
set the pace.

**Verdict: 12–14 h is a good length for this content.** The plan gave **~12h16** for one long session; the live game
gives **~12h31** (11h39–13h12) for the reference player of 1 h a day (§2).
- 18 species and 8 aquariums in ~12 h is a new species every ~45 min and a new aquarium every ~1h30 on average:
  nobody runs out of goals.
- Real sessions last 20–45 min: 12 h is ~3–5 weeks for a regular player, enough time to ship V1.1 before the first
  players finish.
- Shorter (≤ 10 h) would empty the game in 2 weeks; longer (≥ 16 h) would stretch the last runs to 2h30+ with a single
  new species each.
- Real players get things the simulator doesn't count (likes, events, clicking above 50 %): if V1 ends under ~12 h in
  practice, the levers are the run 5–7 prices (+10 % ≈ +20 min each) or rebirth 8 past its cliff (§5.3),
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

### 5.3 Shape of the curve

Runs of ~25 min, ~1h05, ~1h15, then **~1h05–1h55 from run 3 on**. The game is fast for 3 hours (9 species, 3
aquariums), then gives a new aquarium every ~1h30 and a new species every ~50 min. Runs with 2 new species (4, 6, 8)
are shorter than the runs with 1 (3, 5, 7) because their income jumps more. Live timeline: §2.

**Cliffs to know** (§4), measured on the plan's prices (before the x1.45 of V0.46): rebirth 4 sat just after one (the
player enjoys a Catfish tank before rebirthing), rebirth 8 just before one (past it the end moved ~2 h later), rebirth
6 just above one. Never move these three prices by more than ~5 % without re-running the simulator.

### 5.4 Species (18)

The owner's species, placed by aquarium theme (live numbers: §3). The plan's Hammerhead Shark became the **Bunny
Shark** and its Wolf-head Dogfish the **Husky Dogfish** (same numbers).

- Income x2 per species from species 10 (the first nine go x2–2.5), Ocean Points x1.6 (the milestones follow the rebirths).
- Rarities: 3 per label (Common 1–3, Uncommon 4–6, Rare 7–9, Epic 10–12, Legendary 13–15, Mythic 16–18).
- Intervals alternate quick / slow so that each species feels different and the coin count stays around 1–1.5 coins/s
  for a full tank, the range the collectors are tuned for (§5.8).
- The Lanternfish species is not the Abyss event's villain: a different look and a different code id.

### 5.5 Eggs (12)

- One egg per aquarium (§5.2); from egg 7 on each costs **1.2x the rebirth that opens it** (§4) and is unlocked by
  buying the previous one.
- Hatch times grow by 15 s per egg and **stop at 3 min**: beyond that, waiting for an egg feels like a punishment.
  The late game is paced by the prices; the Water Hen and the second incubator shorten the waits (§5.7, §5.8).
- Rarest of each egg: 45 % in the 1-species eggs, 20 % in the 2-species eggs. With 2 incubators at 3 min, a 20 %
  species takes a median ~3 hatches (~5 min) and a p90 ~10 hatches (~15 min) once the player can buy the egg in a row;
  the real wait is the money for those eggs, which the timeline includes.

### 5.6 Rebirths and aquariums (8)

- Start money stays 300 $. Multipliers ~x3.2 per rebirth (§4): after each rebirth the income is back to its previous
  level in ~15–20 min.
- The prices are not a regular ladder: each one sits on the savings curve of its run, and the runs bringing 2 new
  species earn much more. The simulator tuned them on target times.
- Crystal Caverns links the Volcanic Temple (glowing rock) to the Cosmic Sanctuary (crystals, light).
- After rebirth 8 the Rebirth menu says the next aquariums come with the next update. Money keeps growing after the end
  (~3T/min at 14 h). Since V1.1.15 it is clamped at 1e300 (MAX_MONEY, only a guard: a save can't hold an infinity):
  past 2^53 (~9e15) a Luau number rounds its last digits, as in every incremental game, and the UI shortens up to Vg
  (1e63), then writes 1.23e66. The economy can climb as far as new rebirths need.

### 5.7 Ocean Points and milestones (tank 10 → 25)

Ocean Points come from releases, and above all from the whole tank released at each rebirth. Species points grow x1.6
per species, so every rebirth roughly triples the total: the milestones are spaced x2–3 (live table: §3).

- **Capacity 15 → 25 by steps of 2** (after 10 → 15), each on a rebirth: the new run starts with a bigger tank,
  +10–13 % income each. 25 comes at rebirth 7: the last two runs are played with the full tank.
- What changes the pace (capacity, incubator, Water Hen) is in the simulation; Lucky ocean, Pearl rims and the titles
  don't change it.

### 5.8 Companions and AFK farming

**AFK** = the player stays in front of their tank (focus view) without doing anything. Outside the focus view the tank is
frozen (no coins, no hunger) and there is no offline income. A fish left without food is weak 45 s after its last meal
and only farts 1 $ bubbles, so **AFK income = coins collected x fish not weak**. Both come from
`node tools/companion-sim.js` (the Pelican's perch animation, intervals, pellets and
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
  35 % at 25 fish. Active players feed by hand (the food reserve keeps ~22 fish fed on its own, §4), and the simulator's timeline (an
  active player) does not move. That
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
| Water Hen (free, Ocean 85,000) | -15 % | Included: end ~12h27 → ~12h16 (V1 plan) |
| + pass quests 1 / 2 / 3 | -22 % / -28 % / **-35 %** | -35 %: end → ~11h54 (-22 min) |

Hatch speed matters little in this economy (the waits are for money, not for eggs): the Water Hen is a comfort, which
makes its pass a safe one.

**What AFK is worth**: free kit (maxed Snail + Pelican, or the free Swordfish + Jellyfish) ≈ 60 % of the coins on a
15-fish tank, i.e. about the model's average player (50 %); an active player earns ~1.5x more. Paid kit (Swordfish +
Jellyfish passes) ≈ 95 % of the coins on 25 fish: AFK almost as good as playing. Roblox disconnects a player after
20 min without input, so an AFK session lasts ≤ 20 min unless the player moves. AFK never buys or opens eggs: it farms
coins toward the next egg or rebirth.

### 5.9 Story quests V1

The story has a **main line that runs to the end of the content** and side lines that always leave something to do
(goals and rewards in `quests.ts`; when each is reached: §2).

**Rule: at any time the player has 2 to 4 open story quests, and one of them is the main line.**

**Main line "Voyage"** (the Rebirth line, renamed: it continues after "Saving Up"; two quests per aquarium: find its
signature species, then reach the next aquarium)

| Aquarium | Quest | Goal | Reward |
|---|---|---|---|
| Basic | Saving Up | Hold 5,000 $ | Rebirth feature |
| Lagoon | Freshwater Finds | Hatch a Flame Gourami | 5 min of income |
| | Deeper Waters | Rebirth 2 | 500 Ocean Points |
| Neon Coral | Crown of the Reef | Hatch an Imperial Discus | 5 min of income |
| | Sunken Secrets | Rebirth 3 | 1,500 Ocean Points |
| Pirate Wreck | Treasure of the Wreck | Hatch a Catfish | 5 min of income |
| | The Lost City | Rebirth 4 | 4,000 Ocean Points |
| Atlantis | Atlantean Sun | Hatch a Baby Sunfish | 5 min of income |
| | Into the Deep | Rebirth 5 | 10,000 Ocean Points |
| Mariana Trench | Light of the Deep | Hatch a Lanternfish | 5 min of income |
| | Heat Below | Rebirth 6 | 25,000 Ocean Points |
| Volcanic Temple | Temple Guardian | Hatch a Dragonfish | 5 min of income |
| | Crystal Path | Rebirth 7 | 60,000 Ocean Points |
| Crystal Caverns | Puppy in the Caves | Hatch a Husky Dogfish | 5 min of income |
| | To the Stars | Rebirth 8 | 150,000 Ocean Points (done at once if already there) |
| Cosmic Sanctuary | Leviathan | Hatch a Mini Leviathan | 5 min of income |
| | Master Aquarist | All 18 species in the Fish Index | Title "Master Aquarist", golden trophy decor, 300,000 Ocean Points |

The Voyage quests read **gauges** (the Fish Index, the rebirth count), not counters: a quest whose goal is already met
when it opens completes at once (e.g. a Dogfish hatched before rebirth 8), so the line never blocks.

**Side lines**

| Line (opens with) | Quests (goal → reward) | Price |
|---|---|---|
| Snail (Story1) | 20 / 100 / 200 coins picked up → Lasting coins, Lasting coins II, Bouncy coins | free |
| Pelican (owning it) | 50 / 150 / 500 feeds → Hearty meals, Double serving, Smart Pelican | free |
| **Water Hen** (owning it) | eggs opened with it equipped: 50 / 150 / 400 → hatch -22 / -28 / -35 % | Water Hen pass |
| **Swordfish** (owning it) | coins picked up: 300 / 1,000 / 3,000 → speed x1.4 reach 2.5, x1.8 reach 3, x2.2 reach 3.2 | Swordfish pass |
| **Jellyfish** (owning it) | feeds: 300 / 1,000 / 3,000 → 3 charges every 6 s, every 5 s, 3 pellets | Jellyfish pass |
| **Hatchery** (Story1) | hatch 100 / 300 / 600 / 900 / 1,200 fish, all time (gauge TotalHatched) → 2 min of income each, the last one also the Golden Incubator decor | free |
| **Collector** ("Full House") | in order: first Anomaly → 2 min of income, 10 Fish Index cells → 2 min, first Ghost → 3 min, 25 cells → 2,500 Ocean Points, first Shiny → 2,500 points, 50 cells → the "Collector" title (no sticker frames: decided by the owner; income before ~3 h: §4) | free |
| **Ocean** ("Full House") | release 50 fish → 3 min of income; release a Shiny → "Ocean Friend" title | free |

The paid lines are shown in the quest book from the moment the companion is owned, locked, with their pass: the player
sees what they would get. Pace of the paid lines: at 20 fish the Jellyfish feeds ~20 fish a minute (300 feeds ≈ 15 min
of play, 3,000 ≈ 2h30); the Swordfish picks up ~1 coin/s (300 ≈ 5 min, 3,000 ≈ 50 min); the Water Hen sees ~1–1.5
eggs a minute late in the game (400 ≈ 5 h): it is the slow one, on purpose (its effect is the smallest).

**Reward kinds** worth knowing: `IncomeMinutes` (minutes of the tank's current income x rebirth multiplier, so it is
worth something in every run), `OceanPoints`, `CoinBoost`, `Title`, `Decor`. A line can require a gamepass.

**Daily and weekly quests** (`DAILY_QUEST_POOL` / `WEEKLY_QUEST_POOL`; the dailies open at rebirth 2
and the weeklies at rebirth 3, `BOARD_UNLOCK_REBIRTHS`: the first hours stay on the story): 3 quests a day drawn among 6
(collect 150 / 400 coins, open 10 / 20 eggs, feed 30 times, hatch an Anomaly), 3 a week among 6 (collect 3,000 coins,
open 100 eggs, feed 300 times, hatch a Ghost, release 25 fish, like 3 aquariums). Doable alone in one session, except
the likes (one an hour, other players needed: weekly only). **Reward: a coin boost** (decided by the owner instead of
minutes of income paid at once): coins **x2 for 5 min** per daily, **15 min** per weekly. Boosts add up
(PlayerData.coinBoostSeconds), run down only while the tank produces (not in the lobby, not offline), and multiply
the other bonuses (like, pass, event). x2 for N minutes is worth about N minutes of income, spread over the play.

They are part of the reference timeline (§1, §2): without them, a player of 1 h a day would end V1 at ~9h45, so
rebirths 3–8 and their eggs cost 1.45x the plan's (tuned with the simulator: x1.4 → 11h48, x1.5 → 12h37). Other
players (simulator `P.hoursPerDay`):

| Player | End of V1 (all species, median, p10–p90) |
|---|---|
| **1 h a day, dailies and weeklies (reference)** | **~12h31** (11h39–13h12), day 13 (12h13 before the V0.48 unlocks) |
| 3 h a day, dailies and weeklies | ~13h55 (13h29–14h34), day 5 (measured before the V0.48 unlocks: a little longer now) |
| one long session, no daily quest | ~15h22 (14h25–16h09) |

A player who plays longer per day sees fewer boosts per hour, so the game lasts longer in play time (but fewer days).

**Weight of the rewards**: the Voyage line's "5 min of income" and Ocean Points and, since V0.46, the side lines
(`SIDE_QUESTS` of the simulator) are modelled. The side lines move the end by ~14 min (one long session, before the V0.46 prices: 12h14 → 12h00) and every step
by ~2–10 %, in the same order; with the Collector's first plan in Ocean Points (250 / 1,000 / 750 / 5,000) the first
hour's milestones came all at once (Pelican and second slot at ~10 min, 15 fish at ~50 min, second incubator at 1h35:
§4). Rule: **no quest reward multiplies the income or the Ocean Points
permanently**, so quests can be added or reworded without touching the pace.

### 5.10 Gamepasses (outside the balance)

Rule: **the free timeline (§2) is the only target.** Prices and milestones are tuned for a player with no pass and are
never raised because passes exist. A pass shortens the game or adds comfort for its owner; it never locks progression
content (species, eggs, aquariums, capacity, companions themselves) away from free players.

| Pass | What it does | Effect on the V1 end (median, simulator, measured on the V1 plan: one long session) |
|---|---|---|
| Water Hen pass | Its 3 upgrade quests (hatch up to -35 %) | 12h16 → ~11h54 |
| Swordfish pass | Its 3 upgrade quests (~96 % of the coins AFK) | none on the timeline (an active player); AFK income ~x1.6 |
| Jellyfish pass | Its 3 upgrade quests (25 fish fed AFK) | none on the timeline; AFK income +6–35 % on 17–25 fish |
| Third companion slot | Collector + feeder + Water Hen at once | none on the timeline; AFK and hatch speed together |
| x2 Ocean Points | Fish released and rebirths give x2 (fixed quest points don't): milestones earlier (tank 25 at ~8h09 instead of ~9h48) | 12h15 → ~12h08 |
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

## 6. History

| Version | Change | Effect (medians) |
|---|---|---|
| ≤ V0.29 | 6 species, 4 eggs, rebirth 1 (5k, x2.5), Ocean milestones 50–500, tank of 10 | Rebirth 1 ~28 min, first six species ~58 min; then the income levels off at ~80k $/min from ~90 min (nothing left to buy) |
| V0.30 | Amazon (150k) and Neon Coral (2.5M) eggs, Silver Angelfish / Pirate Fish / Imperial Discus, rebirth 2 (1.3M, x8, Neon Coral Lagoon), Ocean milestone 1,500 → 15 fish | Rebirth 1 ~28 min (unchanged), first six ~60 min (the Amazon Egg also hatches Gouramis), rebirth 2 ~1h44, all nine ~2h31 |
| V0.31 | French Fish easter egg (0.1 % of any egg, croissant = 0.5 x tank income per minute, 100 points, leaves after 1 h); Pirate Fish and Imperial Discus become Rare (label only) | Unchanged within the noise: rebirth 1 ~28 min, first six ~60 min, rebirth 2 ~1h43, all nine ~2h29; ~17 % of players meet a French Fish in their first ~3 h |
| V0.35 (plan) | V1 balance plan, not in the game: 18 species (x2 income, x1.6 points), 12 eggs (1.2x their rebirth, hatch ≤ 3 min), 8 rebirths (~x3.2 each, to x8,000), Ocean milestones to 1,000,000 (tank 15 → 25 by 2s, second incubator), Voyage main quest line | Rebirths 3–8 at ~3h01 / 4h48 / 6h12 / 8h10 / 9h56 / 11h04, all 18 species and 8 aquariums ~12h27 |
| V0.35 (plan, rev. 2) | The owner's species and aquariums (Mariana Trench, Volcanic Temple, Crystal Caverns, Cosmic Sanctuary); companions Water Hen (Ocean 85,000, hatch -15 %, pass to -35 %), Swordfish (120,000, a maxed Snail, pass to ~96 %), Jellyfish (200,000, a maxed Pelican, pass to 25 fish); a third slot by gamepass; Snail's Ocean upgrade x1.5 → x1.15 (~60 %), Pelican's x2.5 → x1.33 (15 fish) | All 18 species and 8 aquariums **~12h16** (11h37–12h53), -11 min from the free Water Hen; pass estimates: Water Hen -22 min, x2 Coins -41 %, x1.5 Coins -27 % (the coins pass is +50 %, decided) |
| V0.36 | ROADMAP M1, live: Snail's Ocean upgrade (100 points) x1.5 → x1.15, Pelican's (500 points) x2.5 → x1.33 (every 4 s → 7.5 s) | Active timeline unchanged (companions are not in the economy model): rebirth 1 ~28 min (22–36), rebirth 2 ~1h43, all nine ~2h28 (2h11–2h50). AFK: a maxed Snail picks up ~61 % of the coins at 1 coin/s (was ~72 %), a maxed Pelican keeps 15 fish fed (was 25), 6 % weak at 17 fish, 35 % at 25 |
| V0.38 | ROADMAP M2, live: Catfish (Epic, 16k / 10 s, 800 points), Blue Tang (19.2k / 6 s, 1,300), Baby Sunfish (130k / 20 s, 2,000); Wreck Egg (55M, 135 s) and Atlantis Egg (144M, 150 s); rebirths 3 (45M, x25, Pirate Wreck) and 4 (120M, x80, Atlantis); Ocean milestones 5,000 (second incubator), 8,000 (17 fish), 25,000 (19 fish), 40,000 (Lucky ocean); Voyage quests 1–7 (5 min of income per signature species, 500 / 1,500 / 4,000 Ocean Points per rebirth). Plan's numbers, unchanged | Matches the plan: rebirth 3 ~3h01 (2h44–3h19), rebirth 4 ~4h47 (4h21–5h11), all twelve species ~5h42 (5h13–6h10). Rebirth 2 ~1h43 → ~1h40 and the 15-fish milestone with it (Voyage quests: 5 min of income at the Flame Gourami, +500 points at rebirth 2) |
| V0.39 | ROADMAP M3, live: gamepasses (outside the balance): +50 % Coins (x1.5 on every coin), x2 Ocean Points on fish going to the ocean only (the simulator's `oceanBoost` no longer doubles the rebirth quests' fixed points), Lucky (variant luck x2), Third companion slot | Free timeline unchanged (end of V1 ~12h15); with x2 Ocean Points: tank 25 at ~8h09, end ~12h08 |
| V0.40 | ROADMAP M4, live: Lanternfish (Legendary, 156k / 12 s, 3,200 points), Trench Egg (6.1B, 165 s, Baby Sunfish 55 / Lanternfish 45), rebirth 5 (5.1B, x250, Mariana Trench), Ocean milestones 70,000 (21 fish), 85,000 (Water Hen: hatch x0.85 while equipped, pass quests 50 / 150 / 400 eggs → x0.78 / 0.72 / 0.65), 120,000 (Swordfish: x0.95 the Snail's speed, reach 2, any height; pass quests 300 / 1,000 / 3,000 coins → x1.4 / 1.8 / 2.2, reach 2.5 / 3 / 3.2), Voyage 8 (rebirth 5: 10,000 points) and 9 (Lanternfish: 5 min of income). Plan's numbers, unchanged | Matches the plan: rebirth 5 ~6h12 (5h44–6h41), tank 21 and Water Hen with it, Swordfish ~6h51, all thirteen species ~7h01 (6h30–7h33). Earlier steps unchanged. AFK: free Swordfish 59 % of the coins at 1 coin/s, 96 % with its 3 pass quests |
| V0.42 | ROADMAP M5, live: Lionfish (Legendary, 208k / 8 s, 5,000 points), Dragonfish (Legendary, 1.3M / 25 s, 8,000), Volcano Egg (15.6B, 180 s, Lanternfish 25 / Lionfish 55 / Dragonfish 20), rebirth 6 (13B, x800, Volcanic Temple), Ocean milestones 180,000 (23 fish), 200,000 (Jellyfish: on demand, a charge every 7.5 s, 2 charges, 2 pellets; pass quests 300 / 1,000 / 3,000 feeds → 3 charges every 6 s, every 5 s, 3 pellets), 300,000 (Pearl rims), Voyage 10 (rebirth 6: 25,000 points) and 11 (Dragonfish: 5 min of income). Plan's numbers, unchanged; the live simulator's horizon goes 9 h → 11 h (it stopped before the last species) | Matches the plan: rebirth 6 ~8h06 (7h34–8h37), tank 23 and Jellyfish with it, all fifteen species ~9h05 (8h29–9h39), Pearl rims ~9h04. Earlier steps unchanged. AFK: the free Jellyfish keeps 15 fish fed, 25 with its 3 pass quests |
| V0.44 | ROADMAP M6, live: Husky Dogfish (Mythic, 1.575M / 15 s, 13,000 points), Bunny Shark (Mythic, 4.2M / 20 s, 20,000; the plan's Hammerhead), Mini Leviathan (Mythic, 12.6M / 30 s, 32,000), Crystal Egg (830B, 180 s, Dragonfish 55 / Dogfish 45), Cosmic Egg (1.8T, 180 s, Dogfish 25 / Bunny Shark 55 / Leviathan 20), rebirths 7 (690B, x2,500, Crystal Caverns) and 8 (1.5T, x8,000, Cosmic Sanctuary), Ocean milestones 450,000 (25 fish) and 1,000,000 (Ocean Guardian title + whale statue), Voyage 12 (rebirth 7: 60,000 points), 13 (Dogfish: 5 min), 14 (rebirth 8: 150,000), 15 (Leviathan: 5 min), 16 (18 species: Master Aquarist title + golden trophy + 300,000). Plan's numbers, unchanged; the live simulator's horizon goes 11 h → 15 h | Matches the plan: rebirth 7 ~9h49 (9h14–10h23) with tank 25, rebirth 8 ~10h54 (10h18–11h30), Dogfish ~11h09, 1,000,000 points ~11h28, Bunny Shark ~12h04, all eighteen species ~12h16 (11h35–12h55). Earlier steps unchanged |
| V0.46 | ROADMAP M7, live: side lines Hatchery (100 / 300 / 600 / 900 / 1,200 fish hatched → 2 min of income each, the last one the Golden Incubator), Collector (first Anomaly → 2 min, 10 cells → 2 min, first Ghost → 3 min, 25 cells → 2,500 points, first Shiny → 2,500 points, 50 cells → title; the plan's 250 / 750 / 2,500 points dropped after simulation), Ocean (50 fish released → 3 min); daily / weekly quests rewarded by a **coin boost** (x2 for 5 min a daily, 15 min a weekly, runs only while the tank produces). The reference player becomes **1 h a day with the dailies** (simulator `P.hoursPerDay` 1, the side lines in `SIDE_QUESTS`); rebirths 3–8 and their eggs x1.45 (65M / 175M / 7.4B / 19B / 1T / 2.2T, eggs 78M / 210M / 8.9B / 23B / 1.2T / 2.6T) | 1 h a day: rebirth 1 ~25 min, rebirth 2 ~1h21, rebirth 3 ~2h37, rebirth 8 ~10h53, all eighteen species **~12h13** (11h33–12h56), day 13; without the price change it was ~9h46. 3 h a day ~13h55, one long session ~15h22. Golden Incubator after the end for 2 players in 3 |
| V0.48 | Daily quests from rebirth 2, weekly ones from rebirth 3 (the owner's choice: the first hours on the story quests); not re-tuned. Simulator `P.dailyFromRebirth` / `weeklyFromRebirth` | 1 h a day: rebirth 2 ~1h21 → ~1h32, rebirth 3 ~2h37 → ~2h47, rebirth 8 ~10h53 → ~11h05, all eighteen species **~12h13 → ~12h31** (11h39–13h12), still day 13 |
| V0.49 | UFO night (recurring event, not modelled): mutations x2 / x0.5 / asleep for a minute (+0.25 fish-minute per kidnapping on average), 4.5 % a better variant, 0.5 % the Alien Fish (no coin, its scream: one coin from every other fish every 30 s, 500 points, stays) | Unchanged (events are not in the simulator); expected ~6.5 better variants and ~0.7 Alien Fish per 12 h run, the alien worth +17 % to +100 % of the tank's income while it stays |
| V0.51 | Island Breeze (recurring music event, not modelled): 124 BPM, coins on every other beat with chance boost x 0.97 s / the fish's payout interval, boost 0.5 → 1.5, finale (every fish's coin once, ~57 s) | Unchanged (events are not in the simulator): x2 coins for the minute at every stage, +1.1 to +1.5 min of income per event, +3 to +4 % while playing. Three recurring events instead of two: UFO nights ~2.7 → ~1.7 an hour (~4 better variants, ~0.45 Alien Fish per 12 h run) |
| V0.52 | Starfall (recurring event, not in the economy simulator; `tools/starfall-sim.js`): 16–20 stars per tank, 4 sizes (0.05–0.09 / 0.11–0.18 / 0.25–0.4 / 0.6–0.9 bars, 56 / 30 / 11 / 3 %), floor 1.5 bars x the share caught; star power for the next egg: 1 bar Anomaly+, 2 bars Ghost+, 3 bars Shiny | Coins unchanged. 75 % of the stars caught: 1.8 bars at the median, ~6 Anomalies, ~7 Ghosts, ~2 Shinies per 12 h run on top of ~90 / 45 / 9 from the eggs; all caught: 2.5 bars, 3 bars one time in five. Four recurring events: Island Breeze and UFO nights ~1.7 → ~1.25 an hour (Island +2.5 to +3 % while playing, ~3 better variants and ~0.35 Alien Fish per run from the UFO) |
| V0.60.0 | The alpha (§7): rebirths 1–2, eggs up to the Neon Coral Egg, Ocean milestones up to 5,000, the story quests of that part, dailies, no gamepass; no number changed | Unchanged: rebirth 2 ~1h33, the alpha's end (all nine species) **~2h16** (1h51–2h39); with the +50 % Coins pass it would be ~1h34 |
| V0.60.6 | Food is free (was 10 $ a pellet; the beta's players spent all their money on it); the food reserve (5 portions, each back 10 s after use) limits the pace instead, not simulated (§4). Simulator `P.food` 10 → 0; nothing re-tuned (the owner: a faster start is fine) | Faster early game, the same end: rebirth 1 ~25 → **~19 min** (15–23), first six species ~55 → ~46 min, rebirth 2 ~1h32 → ~1h24, the alpha's end (Imperial Discus) ~2h15 → **~2h04** (1h43–2h29), rebirth 3 ~2h46 → ~2h40, rebirth 8 ~11h03 → ~10h56, all eighteen species ~12h32 → **~12h18** (11h35–13h01). The cost was ~0.29 $/s per fish: it weighed on the first half-hour, nothing later |
| V0.60.9 | On joining, each fish's first coin falls at a random time between 1 and 2 of its intervals (was exactly 1), then the usual pace: the coins no longer drop in chorus. Not simulated (the simulator's income is continuous) | One coin per fish later on average, half an interval of its income per session: 2–15 s of a fish's income an hour (4–30 s intervals), under 0.5 % of a 1 h session. Timeline unchanged |
| V0.60.14 | Sugar, easter egg of the likes: 1 % of the likes a player gives, into the giver's tank (even a full one, one per tank), a sugar cube as often as the best fish's coin, worth 1.1 x it, 500 Ocean Points, stays. Not simulated (likes are not modelled) | Timeline unchanged; +1.1 / N of a tank of N similar fish while she stays (+4 % for 25 fish, +11 % for 10, more early) |
| V1.0.0 | The release: the alpha's limits removed (all 8 rebirths and 12 eggs, every Ocean milestone and story quest, the weekly quests from rebirth 3, the gamepasses on sale); no number changed | Unchanged: the timeline of §2 (rebirth 8 ~10h56, all eighteen species ~12h18) is now every player's; the gamepasses stay outside the balance (§5.10) |
| V1.1.15 | MAX_MONEY 1e15 → 1e300 (a guard, no longer a ceiling of the economy), money units up to Vg then scientific, income leaderboard scores encoded above 1e15; no price, income or reward changed, simulator not affected | Unchanged: the timeline of §2; the next rebirths can cost far more than 1e15 |
| V1.2 (plan) | ROADMAP_V1.2.md M1, not in the game: rebirths 9–12 (200T x25,000 / 640T x120,000 / 3Qa x375,000 / 80Qa x1.2M), eggs Aurora 400T, Sky 770T, Dreamland 50Qa, Heart 96Qa (180 s), 6 species (income x2, points x1.6), tank 27–33 at 1.5M / 4M / 9M / 20M Ocean Points, Voyage 375k / 900k / 2.2M / 5M points, side lines (Hatchery 1,800–3,500, Collector to 120 cells, Ocean 500 released, Big Catch); **Size score** (-15…+15, triangular, coins x(1 + size/100)); **Galaxy** (0.2 %, ~x2 income, x10 points); starfall 4th bar at 0.9 bar of stars. Simulator: `P.sizeMax`, plan `VARIANTS`, Ocean line as a list, Big Catch line; starfall `--fourthBar` | Rebirths 9–12 at ~13h37 / 16h28 / 19h53 / 23h14, **all 24 species ~25h15 (24h18–26h34)**, ~day 26; runs 2h50–3h25. Size: V1 ~2–3 % faster (all eighteen 12h11 → 11h55), income +15–30 %. 4th bar: 2.6 % of perfect starfalls (0.3 % at 75 % caught) |

---

## 7. The alpha (V0.60.0 – V0.60.20, ended with V1.0.0)

**Over since V1.0.0 (2026-11-05)**: the whole game is open and `shared/types/alpha.ts` is gone. Kept as the record of
what the testers played; its "Alpha Pioneer" title stays with those who earned it, nobody earns it any more.

A short version for the first testers, decided by the owner (2026-11-03): **~2 h of play**, the content the
reference player reaches in that time, then feedback for V1. Nothing in the economy changes: the alpha only stops the
progression (no price, odds or reward was touched, so the simulator's run of §2 is the alpha's too).

| Kept in the alpha | Why there |
|---|---|
| Rebirths 1–2 (Lagoon, Neon Coral Lagoon) | Rebirth 2 at ~1h24 (1h12–1h37); rebirth 3 (~2h40) is past the target |
| Eggs up to the Neon Coral Egg, the nine first species | The Imperial Discus, last of them, at ~2h04 (1h43–2h29): **the end of the alpha** |
| Ocean milestones up to 5,000 points (Pelican, Faster Snail, second slot, Hungry Pelican, 15 fish, second incubator) | 1,500 at rebirth 2; 5,000 at ~2h44 for a player who keeps releasing. 8,000 (17 fish) belongs to rebirth 3 |
| Story quests: Start, Ocean (Full House, Back to the Sea, Ocean Friend), Voyage to "Crown of the Reef", Snail, Pelican, Hatchery 1, Collector 1–3 | Reached in the first ~1h35; Hatchery 2 (~4h17) and Collector 4–6 (25 / 50 cells, Shiny: 2,500 Ocean Points each, tuned for after ~3 h) are left out |
| Daily quests (from rebirth 2) | ~40 min of them at the end; the weekly ones open at rebirth 3, so none |

Cut-off measured on the live simulator (V0.60.0 run, 1,000 players, 1 h a day): **all nine species at ~2h16 (1h51–2h39)**;
since the free food (V0.60.6, 2,000 players) the Imperial Discus comes at **~2h04 (1h43–2h29)**.
A player who stops at the cut-off can keep farming the Neon Coral Egg for the variants (36 Fish Index entries) and
Ocean Points; nothing else opens. Stopping at rebirth 1 would have given ~1h10, at rebirth 3 + the Catfish ~3h40.
Gamepasses are not sold: the +50 % Coins pass alone would bring the end to ~1h34 (1h22–1h49, simulator `{"P":{"coinBoost":1.5}}`) and skew the feedback.
The `AlphaComplete` stats milestone went with the alpha (V1.0.0).
