# Release Notes — Project: Quarium

Every change to the game, patch by patch. The newest version is at the top.

**Rules**
- Each patch is a sub-patch: +0.01 (V0.01 → V0.02 → V0.03…), unless a bigger version step is asked for.
- Every task that changes the game opens a new patch, and all its changes go into it.
- Old versions are never deleted or rewritten: they are the history of the game.
- Each patch lists its changes under **New**, **Changes**, **Balance** and **Fixes**. Leave out the sections that are empty.

---

## V0.55 — 2026-11-02

**Changes**
- **New loading screen**: the beach picture and its fish-shaped bar are replaced by a new picture, a sunny aquarium
  with its fish, a snail and two eggs on the sand. The name **Project: Quarium** is the loading bar: its letters start
  empty, dark as glass, and fill with water from the bottom as the game loads, a small wave rolling on the surface.
  Once the name is full, the screen fades into the game.

---

## V0.54 — 2026-11-02

**New**
- **Leaderboard titles**: every day at midnight UTC, the top 10 of each leaderboard win its title until the next
  day's ranking: **Ocean Legend** (Ocean Points), **Tank Tycoon** (coins per second) and **Devoted Keeper** (time
  played). The title floats above the head on a nameplate that shows your rank: **gold** for #1, **silver** for #2,
  **bronze** for #3 and **blue** from #4 to #10, with the board's icon. Drop out of the top 10 and the title is gone
  at the next ranking; a notice tells you when you win or lose one.
- The Customize menu lists the leaderboard titles you hold with their rank ("OCEAN LEGEND #2"); "Automatic" wears
  your best rank first.

**Changes**
- The bronze medals of the leaderboards are now copper, easier to tell from the gold.

---

## V0.53 — 2026-11-02

**New**
- **Leaderboards** in the lobby: three driftwood signs set as an alcove in the north-west corner of the beach, turned
  toward the middle of the lobby so they read from both sides. In the middle, **Ocean Legends** (the most Ocean Points); on its left,
  **Richest Tanks** (coins per second of the aquarium, with the rebirth multiplier and the +50% Coins pass, without the boosts that only last a
  while); on its right, **Devoted Keepers** (time spent in the game). They are shared by every server: each sign shows
  the top 10 with their avatar (gold, silver and bronze medals for the podium) and scrolls down to the 100th. Your own
  row shows in green, and the bottom of each sign always gives your rank ("100+" beyond the top) and your score.
  The players of your server move on the boards live; the others every few minutes.
- Moderation: a player can be kept off the leaderboards (a flag in their save).

**Changes**
- The coral, surfboards and rocks of the north-west corner moved a little to make room for the leaderboards.

**Fixes**
- The south boardwalk overlapped the east promenade where they meet: the two wood textures flickered on top of each
  other there.

---

## V0.52 — 2026-11-02

**New**
- **Starfall**, a new event that comes back regularly (one minute), with its own music: a clear blue night falls, shooting stars streak
  across the sky and across a starry backdrop in every aquarium, and golden stars of four sizes fall into your tank.
  Click them like coins (they sink slowly, then wait a few seconds on the sand): each one fills your **star gauge**
  on the right of the screen (shown only during the event), the bigger the star the more, with a part of luck. The gauge has three bars:
  - one bar: your next egg hatches at least an **Anomaly**, with better chances of a Ghost or a Shiny;
  - two bars: at least a **Ghost**, with a better chance of a Shiny;
  - three bars: a **Shiny** for sure.
  Catching every star always fills at least one bar and a half. When the event ends the gauge becomes your star
  power, and a pill under the egg shop tells what your next egg will be at least ("NEXT EGG: AT LEAST A GHOST")
  until you open one (any egg, even after leaving the game or a rebirth); a new starfall only replaces it if it
  fills more. The hatch reveal shows "STAR POWER" instead of the variant's chance.

**Changes**
- With four events in the draw instead of three, Island Breeze, the abyssal raid and the UFO night come a little less
  often.
- The admin panel lists the starfall.

**Balance**
- Starfall: about 18 stars per aquarium. Catching three stars out of four gives 1.8 bars at the median; catching
  them all, 2.5 bars, and three bars one time in five. Over a 12-hour run that is about 6 extra Anomalies, 7 Ghosts
  and 2 Shinies for a player who catches most stars: rare fish, not more money.

---

## V0.51 — 2026-11-02

**New**
- **Island Breeze**, a new music event that comes back regularly (one minute): a sunny island track, a turquoise and
  yellow banner, and your fish dance to the beat. On the accented beats coins fall from your fish, more and more as
  the song goes on, and for the finale every fish drops a coin at once. On average every fish earns twice its coins
  during the minute, early in the game as late. Its guest star, a coral crab playing a golden saxophone, comes
  into every aquarium: it walks sideways on the sand near the glass, always facing you, and dances on the beat,
  passing its saxophone from one side of its body to the other.

**Changes**
- Behind the scenes, an **admin panel** replaces the four event test buttons (Studio playtests only for now): a
  purple ADMIN button opens it, with one tab per kind of tool. Its first tab, Events, shows the event running (time
  left, STOP) and starts any event. It is ready to be opened to the game's admins for the release.
- Each music event now has its own stage colours (banner, the guest's lights, sparkles and music notes).
- With three events in the draw instead of two, the abyssal raid and the UFO night come a little less often.

**Balance**
- Island Breeze is worth about one minute of income per event at every stage of the game (coins x2 for its minute),
  unlike the K-pop event (admin only), whose beat coins grow with the slow late-game fish.

**Fixes**
- During a music event, the Alien Fish could grow bigger than its aquarium: its scream and the dance on the beat added
  up their swelling instead of taking turns. A fish growing up during a music event had the same, smaller, problem.

---

## V0.50 — 2026-11-02

**Changes**
- Behind the scenes, a cleanup before V1 (nothing changes in the game): unused colours and icon ids of the first UI
  removed from the code; the first flat fish icons, their build scripts, the old shop bar picture, the old variant
  icons and textures (all already uploaded or replaced by the sticker icons) the V1 balance plan and the V1 roadmap (both done)
  removed from the project; the variant recolouring tool now works on textures only.
- The project's working documents (project map, balance, roadmap) were trimmed of their history and of the numbers
  that had gone out of date, so they describe the game as it is now.

---

## V0.49 — 2026-11-02

**New**
- **UFO Night**, a new event that comes back regularly (one minute): night falls, the back of every tank turns into
  deep space (stars, nebulas, planets) and green searchlights sweep over the aquariums. A flying saucer comes over your
  tank and beams your fish up, one at a time, 4 to 5 in the minute (never the same one twice). A few seconds later it
  drops each one back into the water, changed:
  - **Asleep** (20 %): it dozes for a minute ("z Z z"): it doesn't swim, eat or drop coins, and doesn't get hungry
    (no hunger or pause icon over it meanwhile);
  - **Green aura** (55 %): its coins are worth **x2** for a minute;
  - **Red aura** (20 %): its coins are worth **x0.5** for a minute;
  - **Better variant** (4.5 %): it comes back one variant higher, for good (Normal → Anomaly → Ghost → Shiny; a Shiny
    gets the green aura instead);
  - **Alien Fish** (0.5 %): it comes back as a brand new secret fish. The Alien Fish drops no coin, but every 30
    seconds it lets out a scream that makes every other fish of the tank drop a coin on the spot (on top of their own).
    It stays until you release it, and it has its own place among the secret fish of the Fish Index.
  A message tells you what happened to each fish. The minute of an aura or of sleep only runs while your tank produces.
  The night has its own music.

**Changes**
- **Every aquarium shows what it earns** on a brass plaque at the front of its base ("+5,353,600$/s x250", or
  "paused" while its owner is away): you can now see what the other players' tanks give. It counts everything that
  boosts the coins right now (rebirths, Coins pass, like boost, quest boost, event). The coins line at the top of the
  screen is gone, and with it the "Walk up to the glass..." reminder: the tank view gets a little more room.
- The tank view leaves room above the aquarium while a UFO flies over it.
- The **Abyssal Raid** and the UFO Night now take turns: a random event still starts every 5 to 15 minutes, and it is
  one or the other, so each comes about half as often as the raid did alone.

**Fixes**
- The Fish Index describes each secret fish on its own: where it comes from and what it does (the Alien Fish no
  longer claims to hide in eggs and drop coins).
- The tank view now makes room above the aquarium when a companion perches on it (or a UFO arrives) during the camera's
  fly-in, instead of keeping the tank cut at the top.

## V0.48 — 2026-11-02

**New**
- **Customize your aquarium**: a **Customize** button next to "My aquarium" / "Back to lobby" (once you've done your
  first rebirth or earned a first cosmetic) opens a menu where you choose:
  - the **theme** of your tank among every aquarium you've reached (keep the Atlantis Ruins after reaching the
    Mariana Trench...). "Automatic", the default, always wears your newest one;
  - which **decor** (whale statue, golden trophy, golden incubator) and **finishes** (Pearl Rims) show in your tank;
  - the **title** above your head: your best one, any title you've earned, or none.

**Changes**
- The **daily quests** now open with your second aquarium (rebirth 2) and the **weekly quests** with the third
  (rebirth 3): your first hours are for the story quests. The quest book tells when they open.
- The "My aquarium" / "Back to lobby" button grows a little under the mouse, like the other buttons.

**Balance**
- Without the early quest boosts, the average player of 1 h a day sees all eighteen species at ~12h30 of play instead
  of ~12h15 (still about 13 days). Details in BALANCE.md.

---

## V0.47 — 2026-11-01

**New**
- Behind the scenes, the game now keeps play statistics with each save (time played, days, when each rebirth and
  species is reached, coins picked up, daily quests done, kind of device and frame rate), and sends a summary to the
  Creator Dashboard. They help tune the game to how players really play. Nothing changes in the game itself.
- Studio test tool for the owner: "/speed 6" makes coins, hatching and Ocean Points 6 times faster (V1 in ~2h30), with
  a red "TEST SPEED" chip on screen; "/speed 1" stops it. "/passes off" plays without the owner's gamepasses
  ("/passes on" gives them back). Players never get them.

**Fixes**
- The quest boost pill no longer hides the eggs' odds when hovering an egg.
- The quest book scrolls when it holds many quests, instead of going past the bottom of the screen.

---

## V0.46 — 2026-11-01

**New**
- **Daily and weekly quests**: every day, 3 quests drawn for everyone (collect coins, open eggs, feed your fish,
  hatch an Anomaly); every week, 3 bigger ones (3,000 coins, 100 eggs, a Ghost, release fish, like 3 other players'
  aquariums...).
- **Quest boost**: each daily quest gives **coins x2 for 5 minutes**, each weekly one **x2 for 15 minutes**. Boosts add
  up, and the time only runs while your aquarium is producing: in the lobby, or when you leave the game, it waits
  for you. A gold pill under the shop shows the time left. It stacks with the like boost and the other bonuses.
- **Hatchery line**: hatch 100, 300, 600, 900 and 1,200 fish (all time) for minutes of income, and at the end a
  **Golden Incubator** for your aquarium: a golden nest with its spotted egg, next to the trophy.
- **Collector line**: find an Anomaly, a Ghost and a Shiny, and fill 10, 25 and 50 entries of the Fish Index; the last
  one makes you a **Collector** (your title above your head).
- **Ocean line**, after "Full House": release 50 fish into the ocean, then a Shiny, to become an **Ocean Friend**.

**Balance**
- The game is now tuned for a player of about 1 hour a day who does their daily quests: all eighteen species at
  ~12h of play (about 13 days).
- To make room for the quest boosts, rebirths 3 to 8 and the eggs they open cost 1.45x more: rebirth 3 65M (was 45M),
  4 175M (120M), 5 7.4B (5.1B), 6 19B (13B), 7 1T (690B), 8 2.2T (1.5T); Wreck Egg 78M (55M), Atlantis 210M (144M),
  Trench 8.9B (6.1B), Volcano 23B (15.6B), Crystal 1.2T (830B), Cosmic 2.6T (1.8T).
- The side lines pay minutes of income early in the game (Ocean Points only from the 25th Fish Index entry), so the
  first hours go a little faster. Details in BALANCE.md.

**Fixes**
- Today's daily and weekly boards were empty: they are drawn again as soon as you join.

---

## V0.45 — 2026-11-01

**Changes**
- Fish that can't get the full swim animation (too many species on screen, or a device with little memory, like
  some phones) now sway gently as they swim instead of gliding frozen.
- The swim animation adapts to the device: it animates as many species as the device's memory allows, the most
  common ones of the tank first, and stops asking for more once the device says it is full.

**Fixes**
- On a crowded tank, some species stopped animating for a while (most often the Flame Gourami when arriving at your
  aquarium from the lobby).

---

## V0.44 — 2026-11-01

**New**
- **Two new aquariums, the end of the voyage**:
  - rebirth 7 (690B, coins x2,500) takes you to the **Crystal Caverns**: lavender sand, glowing crystal clusters and a
    cave of stalactites and shining crystals;
  - rebirth 8 (1.5T, coins x8,000) to the **Cosmic Sanctuary**: floating stones with glowing runes, golden and violet
    crystals, a starry nebula and ringed planets. The Rebirth menu then says the voyage is complete, with more
    aquariums in the next update.
- **Three new Mythic fish**, each with its Anomaly, Ghost and Shiny looks in the Fish Index:
  - **Husky Dogfish**: a round blue fish with a husky's face, dropping silver moon coins;
  - **Bunny Shark**: a pink shark with long bunny ears, dropping golden star coins;
  - **Mini Leviathan**: a little sea serpent with a frilly crest, dropping heavy ringed planet coins.
- **Two new eggs**: the **Crystal Egg** (830B: Dragonfish or Husky Dogfish), after the Volcano Egg, and the
  **Cosmic Egg** (1.8T: Husky Dogfish, Bunny Shark or Mini Leviathan).
- **Titles**: your best title now floats above your head for everyone to see ("Master Aquarist", "Ocean Guardian").
- **Decor in your aquarium**: trophies earned show up in your tank, whatever its theme.
- **Ocean milestones**: at 450,000 points your aquarium holds **25 fish**, the maximum; at 1,000,000 you become an
  **Ocean Guardian**: the title, and a whale statue in your tank.
- **Voyage quests**: "Crystal Path" (rebirth 7: 60,000 Ocean Points), "Puppy in the Caves" (hatch a Husky Dogfish),
  "To the Stars" (rebirth 8: 150,000 Ocean Points), "Leviathan" (hatch a Mini Leviathan) and "Master Aquarist"
  (discover all 18 species: the Master Aquarist title, a golden trophy in your tank and 300,000 Ocean Points).

**Balance**
- New numbers from the V1 plan, unchanged: the average player reaches rebirth 7 at ~9h49, rebirth 8 at ~10h54 and all
  eighteen species at ~12h16 (BALANCE.md).

---

## V0.43 — 2026-10-31

**New**
- **Coin sounds**: every coin you collect rings a soft little chime, climbing higher as you chain coins quickly;
  sparkling and ghost coins ring higher still. Coins picked up by your companions chime very softly.

**Changes**
- A weak fish's bubble now sounds like a bubble, not a fart.
- The Fish Index and the hatch reveal show the variant chances you really hatch with, Lucky ocean and the Lucky pass
  included (e.g. Anomaly 15% with Lucky ocean).
- Each companion card shows what the companion does right now with its own bonuses: speed, feeding interval,
  pellets, charges, reach, hatch speed...
- The Snail's and the Pelican's quest bonuses (lasting and bouncy coins, Hearty meals) now say they are permanent,
  even without the companion: they always were.

**Fixes**
- The Claim buttons of the Ocean rewards no longer stick out of their cards.
- The Swordfish (and the Snail) froze in front of a coin lying too close to the glass, unable to reach it: they now
  grab it from as close as they can get.

---

## V0.42 — 2026-10-31

**New**
- **A new aquarium**: rebirth 6 (13B, coins x800) takes you to the **Volcanic Temple**: dark basalt, an ancient stone
  arch with glowing carvings and magma veins shining in the sand, under a deep red sky. The Rebirth menu then says
  more aquariums are coming.
- **Two new Legendary fish**, each with its Anomaly, Ghost and Shiny looks in the Fish Index:
  - **Lionfish**: a red and white striped fish with a frilly fin, dropping red coral fan coins often;
  - **Dragonfish**: a long golden fish with a flowing red crest, dropping heavy golden dragon scales now and then.
- **A new egg**: the **Volcano Egg** (15.6B: Lanternfish, Lionfish or Dragonfish), after the Trench Egg.
- **A new companion, the Jellyfish** (200,000 Ocean Points): it drifts in the top of the water and, as soon as one
  of your fish is hungry, swoops over it and drops food. Its food charges show above it, like the Smart Pelican's.
  Its quest line comes with the **Jellyfish Pass**: let it feed 300 / 1,000 / 3,000 fish for more charges, faster
  charges and 3 pellets at a time.
- **Ocean milestones**: 180,000 points, your aquarium holds **23 fish**; then the Jellyfish; and at 300,000 the
  **Pearl rims**, a pearly finish on the rims of your aquarium, whatever its theme.
- **Voyage quests**: "Heat Below" (rebirth 6: 25,000 Ocean Points) and "Temple Guardian" (hatch a Dragonfish:
  5 minutes of income).

**Balance**
- New numbers from the V1 plan, unchanged: the average player reaches rebirth 6 at ~8h06 and all fifteen species at
  ~9h05 (BALANCE.md).

---

## V0.41 — 2026-10-31

**New**
- **The fisherman's huts**: the Shop moves onto the beach, into two fishing huts at both ends of the central aisle
  (look for the pink SHOP signs), one right behind the spawn. Walk up to the old fisherman's counter and his shop
  opens; walk away and it closes. He turns to greet you as you come close.

**Changes**
- The Shop button is gone from the left menu: one button less on the screen.
- The spawn moved a few steps toward the aquariums, and the Welcome sign to the north end of the boardwalk.
- The like boards beside the aquariums are almost twice as big, so they are easier to spot.

**Fixes**
- An invisible wall cut the lobby in two in front of the middle aquariums (a map boundary turned the wrong way).

---

## V0.40 — 2026-10-31

**New**
- **A new aquarium**: rebirth 5 (5.1B, coins x250) takes you down to the **Mariana Trench**: dark basalt spires, glass
  sponges and glowing anemones in deep blue water. The Rebirth menu then says more aquariums are coming.
- **A new Legendary fish, the Lanternfish**: a little midnight-blue fish lit by rows of glowing dots, dropping shining
  nautilus shells. With its Anomaly (crimson), Ghost and Shiny (golden) looks in the Fish Index.
- **A new egg**: the **Trench Egg** (6.1B: Baby Sunfish or Lanternfish), after the Atlantis Egg.
- **Two new companions**, from the Ocean:
  - **Water Hen** (85,000 Ocean Points): paddles on the surface of your aquarium; while it is equipped, your eggs
    hatch 15% faster, live: equip it on eggs already incubating and they speed up, unequip it and they slow back down
    without losing the time gained. Left equipped when you leave, it keeps working while you are offline;
  - **Swordfish** (120,000 Ocean Points): swims through the water and grabs your coins while they sink, without
    waiting for them to reach the sand.
- **Their quest lines**, shown as soon as you own the companion and unlocked by their pass:
  - **Water Hen Pass**: open 50 / 150 / 400 eggs with it equipped, for eggs hatching 22% / 28% / 35% faster;
  - **Swordfish Pass**: let it grab 300 / 1,000 / 3,000 coins, for a Swordfish up to 2.2x as fast with a wider reach.
- **Ocean milestones**: 70,000 points, your aquarium holds **21 fish**; then the Water Hen and the Swordfish.
- **Voyage quests**: "Into the Deep" (rebirth 5: 10,000 Ocean Points) and "Light of the Deep" (hatch a Lanternfish:
  5 minutes of income).

**Changes**
- The progress bar of an egg in the shop follows the Water Hen's hatch speed.
- The aquarium view leaves room above the tank for the Water Hen, like for the Pelican.
- The Swordfish swims with a moving tail and fins like the fish; the Water Hen rocks and nods as it paddles.
- Each aquarium theme now also sets the colour of its water (deeper blue in the Mariana Trench).

**Balance**
- New numbers from the V1 plan, unchanged: the average player reaches rebirth 5 at ~6h12, the Swordfish at ~6h51 and
  all thirteen species at ~7h01 (BALANCE.md).

---

## V0.39 — 2026-10-30

**New**
- **Shop**: a new Shop button on the left opens the gamepass shop, with four permanent boosts:
  - **Third Companion Slot**: one more companion in your aquarium at once;
  - **x2 Ocean Points**: fish you release to the ocean, and your whole tank at a rebirth, give twice the points;
  - **Lucky**: Anomaly, Ghost and Shiny fish hatch twice as often (on top of Lucky ocean);
  - **+50% Coins**: every coin your fish drop is worth 50% more.
  Each card shows its price; a pass not on sale yet shows "Soon". A pass bought is active at once, and your passes are
  checked again each time you join.
- Quests of a paid line now have a **Buy** button for their pass (the first paid lines come with the next companions).

**Changes**
- The coin line under the egg shop, the companion slot counter and the Ocean Points shown in the Ocean and Rebirth
  menus include your passes.

---

## V0.38 — 2026-10-30

**New**
- **Two new aquariums**: rebirth 3 (45M, coins x25) takes you to the **Sunken Pirate Wreck**, rebirth 4 (120M, coins
  x80) to the **Atlantis Ruins**. The Rebirth menu then says more aquariums are coming.
- **Three new Epic fish**, each with its Anomaly, Ghost and Shiny looks in the Fish Index:
  - **Catfish**: a spotted bottom dweller with little whiskers, digging up tiny treasure chests;
  - **Blue Tang**: a lively royal blue fish with a yellow tail, dropping sapphires often;
  - **Baby Sunfish**: a round pale drifter, dropping big golden sun medallions now and then.
- **Two new eggs**: the **Wreck Egg** (55M: Imperial Discus or Catfish) after the Neon Coral Egg, and the **Atlantis
  Egg** (144M: Catfish, Blue Tang or Baby Sunfish) after it.
- **New Ocean rewards**: a second incubator at 5,000 points (two eggs of the same kind at once), a bigger aquarium at
  8,000 (17 fish) and 25,000 (19 fish), and **Lucky ocean** at 40,000 (Anomaly, Ghost and Shiny fish hatch 1.5x as
  often).
- **The Voyage**: the Rebirth story line continues after "Saving Up" and follows you from aquarium to aquarium: find
  each aquarium's signature fish (5 minutes of your tank's income), then reach the next aquarium (Ocean Points). Goals
  you have already reached complete as soon as their quest opens.

**Changes**
- The egg shop now has 8 eggs: arrows on the sides of the shelf move it along (it shows your best eggs by itself).

**Balance**
- The new content follows the V1 plan: rebirth 3 at about 3 hours of play, rebirth 4 at about 4h45, all twelve
  species at about 5h45. The Voyage rewards bring rebirth 2 a few minutes earlier (about 1h40).

---

## V0.37 — 2026-10-30

Foundations for the next updates (ROADMAP M0). Nothing new to play yet: most of these show up with the next eggs and
Ocean rewards.

**New**
- **Several eggs of the same kind at once**: the game can now give extra incubators (a future Ocean reward). A shop
  slot then shows how many of its eggs are incubating ("1/2") and a small gold "+" to buy one more; the slot opens
  the egg that is ready first.
- **A shop for more eggs**: once there are more than six eggs, arrows on the sides of the egg shelf move it along. It
  shows your best eggs by itself, and an arrow gets a red "!" when an egg out of view is ready to open.
- **New kinds of Ocean rewards**, ready for the next milestones: more incubators, better luck for rare fish
  (Anomaly, Ghost, Shiny), and cosmetics (titles, decorations).
- **New kinds of quests and rewards**, ready for the next story quests: hatch a given species, rebirth, open eggs,
  hatch a rare variant, fill the Fish Index, release fish; rewards worth a few minutes of your tank's income, Ocean
  Points, titles and decorations. Some quest lines will need a gamepass: they show what they give, locked.

**Changes**
- The Ocean rewards list scrolls, and opens on the first reward you haven't claimed yet.
- Big numbers read better everywhere: trillions show as "T" and above as "Qa" (prices, money, coin popups, rewards,
  messages).
- Fish models now load only for the species swimming on your server: faster loading, less memory, ready for many
  more species.

**Fixes**
- Very large amounts of money (from about 100 trillion) no longer show as scientific notation ("1e+15"). Money is
  capped at 1 quadrillion, far above anything the game gives.

---

## V0.36 — 2026-10-30

**Balance**
- **Faster Snail** (Ocean milestone, 100 points): the Snail now crawls at 115 % speed instead of 150 %. With all its
  quests it picks up about 60 % of the coins of a full tank on its own (it was about 72 %).
- **Hungry Pelican** (Ocean milestone, 500 points): the Pelican now throws food every 7.5 s instead of every 4 s
  (x1.33 instead of x2.5). With all its quests it keeps 15 fish fed on its own, no longer 25.
- The two milestones' descriptions in the Ocean menu say so. Players who already claimed them get the new values.
  Playing actively doesn't change: feeding and collecting by hand still work as before.

---

## V0.35 — 2026-10-30

**New**
- **Two new aquarium looks, ready for the next rebirths** (they will be given by rebirths 3 and 4, which come with the
  next eggs; nobody wears them yet):
  - **Sunken Pirate Wreck**: dark wet sand, dark wood base, rusty brass rims; a sunken rowboat, a fallen mast with its
    torn sail, an anchor, a ship wheel, crates and a glowing treasure chest with gold coins and pearls spilled around
    it; a painted backdrop with a shipwreck lying on the seabed in the light rays.
  - **Atlantis Ruins**: pale sand, marble base, glowing turquoise plinth, gold rims; a marble arch on steps, standing
    and fallen columns, a glowing crystal in a ring of light tiles, coral growing on the ruins, gold pebbles; a painted
    backdrop of the sunken city with its domes, towers and a great golden dome.

---

## V0.34 — 2026-10-30

**Changes**
- Side menu: each button's name now sits inside the button, under its icon (it used to straddle the bottom edge,
  where the outline cut through the letters). The buttons are a little bigger and the icons a little smaller to
  make room.

---

## V0.33 — 2026-10-30

**New**
- **New look for the whole interface ("arcade aquatic")**, built from the design in `design/ui/redesign-v2.figcraft`:
  - cartoon fonts everywhere: Luckiest Guy for titles, buttons and big numbers, Fredoka One for the rest, always
    with a dark outline so they read over any aquarium;
  - every button is in relief (a darker edge under it) and sinks when pressed; colours by role: green for the main
    action, gold to buy, red to confirm or close, blue / lagoon for the rest;
  - menus open in a navy window with a coloured ribbon title over its top edge, a round red close button on its
    corner and a few bubbles: gold for Quests, lagoon for the Fish Index, blue for the Ocean, green for Companions,
    purple for Rebirth;
  - the egg shop becomes a navy shelf of square egg slots coloured by state (green to buy, grey too expensive, amber
    hatching, gold ready), with the price on a tag hanging below (2,500 / 25K / 150K…); cracks spread over an
    incubating egg and its tag fills up;
  - money shows in a pill with a big gold coin; the "Liked! Coins x2" pill is pink with a heart;
  - the side menu gets drawn icons (a scroll, the Snail, a book, a wave, a rebirth arrow) instead of emoji;
  - quests show as cards with a picture of what they count, their story line on a tag, a progress bar, a square
    reward slot and a big CLAIM! button;
  - the Fish Index shows every variant as a square slot (blue Normal, purple Anomaly, pale Ghost, gold Shiny with
    sparkles), the dark silhouette with a "?" until found;
  - Ocean, Companions, Rebirth, the reward popup, the hatch reveal, the tutorial card, the event banner, the
    notifications and the "My aquarium" / "Back to lobby" button follow the same style.

**Changes**
- The rewards "The Ocean" and "Rebirth" show a drawn icon (quest book, reward popup) instead of an emoji.

---

## V0.32 — 2026-10-30

**New**
- Studio: the place's owner can type `/nextfrench` during a playtest so the next egg they open hatches a French Fish
  (to test the easter egg). The command doesn't exist on live servers.

---

## V0.31 — 2026-10-30

**New**
- **Rebirth reminder**: while a rebirth is affordable, the Rebirth button pulses in a gold halo. A "REBIRTH READY!"
  bubble says what it brings (the coin multiplier and the new aquarium) when it becomes affordable, then again every
  4 minutes while it stays affordable. Opening the Rebirth menu pushes the next one back.
- **Secret: the French Fish** (an easter egg, its odds are shown nowhere):
  - it wears a beret, a Breton striped shirt and a red scarf, with a baguette on its back;
  - any egg can hatch it, 0.1% of the time (taken from the egg's most common fish), never as an Anomaly, Ghost or
    Shiny;
  - every minute it drops a **croissant** worth half of what the rest of your tank earns in a minute (rebirth,
    like and event bonuses included); one croissant in 15 sparkles and is worth double;
  - release it in the Ocean for 100 Ocean Points (it also leaves at a rebirth);
  - after one hour in your tank it goes off to join a protest, still giving its Ocean Points. Its hour only runs
    while you tend your aquarium, never offline or while the tank is paused;
  - the Fish Index gets an **Easter eggs** category, invisible until you hatch one. Fish of that category stay out
    of the collection count.

**Changes**
- The Pirate Fish and the Imperial Discus are now **Rare**, like the Silver Angelfish. No fish is Epic or Legendary
  yet.

**Balance**
- The French Fish doesn't move the average progression: about 1 player in 6 meets one in their first 3 hours.

---

## V0.30 — 2026-10-29

**New**
- **Rebirth 2**: coins x8 forever, and your tank becomes the **Neon Coral Lagoon**.
- Two new eggs in the shop: the **Amazon Egg** (Flame Gourami or Silver Angelfish) and the **Neon Coral Egg**
  (Silver Angelfish, Pirate Fish or Imperial Discus). Buy an Amazon Egg to unlock the Neon Coral Egg.
- Three new fish, each with its Anomaly, Ghost and Shiny looks in the Fish Index:
  - the **Silver Angelfish** (Rare), which drops pearls;
  - the **Pirate Fish** (Epic), which drops rubies;
  - the **Imperial Discus** (Legendary), which drops crowns.
- A new Ocean milestone at 1,500 Ocean Points: **Bigger aquarium**, your tank holds 15 fish instead of 10. You keep
  it through rebirths.

**Balance**
- New progression target for an average player: rebirth 2 after about 1h45 of play, all nine fish after about 2h30.
  The start of the game doesn't change (rebirth 1 after about 30 minutes, the first six fish after about 1 hour).

---

## V0.29 — 2026-10-29

**New** (in preparation: the models are in the game files but nothing uses them yet)
- Two new fish, with their Anomaly, Ghost and Shiny looks and their collection icons: the **Silver Angelfish** (Anomaly: midnight blue, Shiny: gold) and the **Imperial Discus** (Anomaly: red, Shiny: golden).
- Three new kinds of coins: the **Pearl** (a pearl in its shell), the **Ruby** and the **Crown**.
- A new aquarium look, the **Neon Coral Lagoon**: glowing neon rims, indigo sand, a night reef painted on the back wall, pink, cyan and violet corals, an anemone, a giant clam and glowing pebbles.
- Two new eggs: the **Amazon Egg** (jungle leaves around a river) and the **Neon Coral Egg** (glowing corals on a night-blue shell).

---

## V0.28 — 2026-10-29

**New**
- Aquarium full: when you try to open an egg without room, a short reminder next to the Ocean button tells you that you can release a fish there. Before the Ocean is unlocked, it points to the "Full House" quest instead. It shows up at most once every 3 minutes, and not again once you have released a fish.

---

## V0.27 — 2026-10-29

**New**
- A new story line, Rebirth, opens after "Coin Collector". **Saving Up**: have 5,000$ at once. Its bar follows your savings, and claiming it unlocks the Rebirth.
- A "My aquarium" button in the lobby, where "Back to lobby" sits in the aquarium view. It takes you straight to your aquarium's view.

**Changes**
- The Rebirth menu now unlocks through the "Saving Up" quest instead of appearing out of nowhere. Players who already have it keep it.

**Fixes**
- Abyssal raid: the lantern fish stopped stealing after 10 tries, before the end of the event. It now keeps coming for your coins, at the same pace, for the whole minute.

---

## V0.26 — 2026-10-29

**New**
- Smart Pelican: a small gauge above your Pelican shows its food charges. A full slot holds a pellet, and the next charge grows in its slot while it refills.
- Food now looks as filling as it is. With the "Hearty meals" bonus, every meal (yours and the Pelican's) is a plump shrimp instead of a pellet. Food also turns slowly as it sinks.

---

## V0.25 — 2026-10-29

**New**
- A new story line, the Pelican's, opens as soon as you get the Pelican:
  - **Lunch Time**: let your Pelican feed 50 fish. Reward: your fish stay full 15 seconds longer after eating.
  - **Double Serving**: let your Pelican feed 150 fish. Reward: your Pelican throws 2 pellets instead of 1.
  - **Pelican Chef**: let your Pelican feed 500 fish. Reward: your Pelican becomes smart. It stores up to 2 food charges (one more every feeding interval) and, as soon as a fish is hungry, uses one to feed it right away. It no longer throws food when no fish needs it.

**Fixes**
- Quest book: the text of bonus rewards ("+1s", "Boing"...) was dark on the dark card and hard to read. It is now gold.

---

## V0.24 — 2026-10-29

**Changes**
- Story quests now come in lines that run at the same time. After "Coin Collector", the Ocean line ("Full House") and the Snail line ("Little Helper", "Busy Snail", "Snail Champion") both open: work on whichever you like. Each quest in the quest book shows its line.
- Your story progress is kept: each line picks up where you were.

---

## V0.23 — 2026-10-29

**New**
- Three new story quests, after "Full House", where your Snail does the work:
  - **Little Helper**: let your Snail pick up 20 coins. Reward: coins stay 1 second longer on the sand.
  - **Busy Snail**: let your Snail pick up 100 coins. Reward: coins stay 2 more seconds on the sand.
  - **Snail Champion**: let your Snail pick up 200 coins. Reward: coins bounce once when they reach the sand (the bounce lasts 1.5 seconds), then stay on the sand as long as usual, plus the 3 bonus seconds.
- These bonuses are permanent and are kept through rebirths.

---

## V0.22 — 2026-10-29

**New**
- Two new Ocean rewards:
  - 100 points: **Faster Snail**, your Snail crawls at 150% speed;
  - 500 points: **Hungry Pelican**, your Pelican throws food 2.5x as often (every 4 seconds).
- Fish Index: hover a variant's column (or one of its fish) to see what that variant brings: its colours, its coin bonus and its Ocean Points.

---

## V0.21 — 2026-10-29

**New**
- **Ocean rewards**: Ocean Points now unlock rewards at milestones, claimed from the Ocean menu (the points are never spent):
  - 50 points: the **Pelican**, a new companion;
  - 200 points: a **second companion slot**.
- **Pelican**: it stands on the back of your aquarium and watches your fish. Every 10 seconds it throws a free food pellet into the water, aimed at a hungry fish when there is one. It only feeds while you look after your aquarium.
- The Ocean menu is now in two parts: releasing fish on the left, the rewards on the right with your progress toward each one. The Ocean button shows a badge when a reward is ready.
- New sticker icons for the companions, in the companion menu, the quest rewards and the reward popups.

**Changes**
- The aquarium view leaves room above the tank while your Pelican is out, so you can see it.

**Fixes**
- The fish icon could take a moment to appear when an egg hatched (seen on an Anomaly Blue Neon): every fish icon is now loaded as soon as you join.

---

## V0.20 — 2026-10-29

**New**
- **Recurring events**: every server now starts events by itself. After 5 minutes without an event, each minute has a growing chance to start one, and by 15 minutes it always does. It is drawn among the recurring events (for now the Abyssal Raid) and only happens on that server. The clock starts again when the event ends.
- **Admin events**: an admin can start any event on every server at once with the chat command `/event <name>` (for example `/event kpop`), and stop it with `/event stop`. An admin event replaces the recurring event running, and no recurring event can start during it. Servers that start during an admin event join it. The K-pop event is an admin event.

**Changes**
- Events no longer disturb players during the tutorial: no event music, banner, darkness, guest, lantern fish or coin bonus for them. The event joins them as soon as they finish it.
- Each event now has its own duration (1 minute for both for now).

---

## V0.19 — 2026-10-29

**Changes**
- No more emoji in the game's texts: coin popups (a ghost coin now shows just its amount), menu titles, tabs, buttons, notifications, the aquarium nameplate and fish counter, the hatch reveal and the Ocean menu. Ocean Points now read "+3 Ocean" in the popup and "+3 pts" in the Ocean menu.

---

## V0.18 — 2026-10-29

**Changes**
- New fish icons in a sticker style: the real fish in their real colours, with a thick outline and a soft shadow. Ghosts get a pale blue outline and stay see-through, shinies a gold outline with sparkles. They replace the 3D portraits in the Fish Index, the Ocean menu and the hatch reveal.
- In the Fish Index, a variant you haven't found shows the fish's dark silhouette under a "?".

---

## V0.17 — 2026-10-29

**New**
- Studio: the place's owner can erase their own save during a playtest with `/datareset`, then `/datareset confirm` within 15 seconds. The command doesn't exist on live servers.

**Changes**
- The Fish Index no longer shows how many of each fish you hatched: a found variant shows its portrait, a missing one a "?".

---

## V0.16 — 2026-10-29

**New**
- **You choose which fish goes back to the ocean**: the Ocean menu now has one row per kind *and* variant in your tank (for example "Shiny Golden Guppy ×1"). Releasing a rare variant asks for a second click ("Sure?").
- Fish pictures are now **3D portraits of the real fish**, in their real colours: the Fish Index, the Ocean menu and the hatch reveal (where the fish turns gently). Ghosts are see-through and shinies twinkle there too.

**Balance**
- Rare variants give more Ocean Points when released, and at a rebirth: Anomaly ×2, Ghost ×3, Shiny ×5.

---

## V0.15 — 2026-10-29

**New**
- **Fish variants**: every fish you hatch can come out as a rare variant of its species:
  - **Anomaly** (10 %): alternate colours, drops its coins 1.2× as often;
  - **Ghost** (5 %): translucent, you can see through it. Instead of sparkling coins it drops **ghost coins** (translucent, trailing wisps), worth 3 sparkling coins;
  - **Shiny** (1 %): alternate colours and twinkles like a sparkling coin. Drops coins as often as an anomaly, and 3× more sparkling coins.
- The hatch reveal announces the variant ("You hatched a Shiny Clownfish!", with its chance) in the variant's colours.
- **New Fish Index**: one row per fish and one column per variant (Normal, Anomaly, Ghost, Shiny), with the chance of each variant, how many you hatched, and a scroll bar. Every variant is its own entry: 24 to collect.

**Changes**
- Releasing a fish to the ocean lets go of a normal one before any rare variant.
- The Golden Guppy's texture is lighter in memory (same look).

**Balance**
- Variants make the game about 4 % faster on average: first rebirth ≈ 28 min instead of 29, the six first fish ≈ 58 min instead of 61. Prices are unchanged.

---

## V0.14 — 2026-10-29

**Changes**
- New eyes for the lantern fish: glossy black eyeballs with a glowing red iris and a thin slit pupil, like a predator's, instead of red balls stuck on its eyes. A soft red glow lights its eye sockets from within, and the slit shows up with the glow when it comes out of the dark.

---

## V0.13 — 2026-10-29

**New**
- The Abyssal Raid now has its own music, which takes over from the beach music while it lasts.

**Changes**
- The lantern fish looks much more menacing: a near-black body, bared fangs, glowing red eyes and a cold, pale lure. In the dark, its eyes and its lure show up first, before its body comes out of the shadows. It is also a bit bigger.
- The Abyssal Raid banner now glows from the lure's cold cyan to the red of its eyes.

**Balance**
- During the Abyssal Raid, every coin is worth **x1.5** (on top of rebirths and likes). The income line shows the bonus.

---

## V0.12 — 2026-10-29

**New**
- **Abyssal Raid**, a new server-wide event:
  - the whole world goes dark: the day turns into a deep blue night;
  - every aquarium turns into the abyss: a dark backdrop with a ridge of rocks and glowing specks, deep navy water and marine snow drifting down;
  - a **lantern fish** sneaks out of the dark at the back of your aquarium, its glowing lure first. It darts at your most valuable coin to steal it: click the coin before it gets there! Whether it grabs the coin or not, it swims back into the dark and vanishes;
  - it can try to steal up to 10 coins per minute. A stolen coin shows a red "-X$" where it was taken;
  - the event banner glows lantern yellow and shows the time left.
- Studio: one test button per event (K-pop and Abyssal Raid).

**Changes**
- The event banner's subtitle and colours now depend on the event.

---

## V0.11 — 2026-10-29

**Changes**
- Clearer aquarium in the close-up view: the beach haze fades out and the front glass and water become more see-through while you look after your tank, so fish, coins and decor keep their real colours. The lobby keeps its sunny haze.

---

## V0.10 — 2026-10-29

**Balance**
- The Snail crawls 20 % faster when it fetches coins (3 → 3.6 studs/s) and reaches a bit farther to pick them up.

**Changes**
- The Snail no longer pauses after each coin: it picks coins up on its way and heads straight to the next one. It now goes for the coin it can grab the soonest (one already on the sand rather than one still falling).
- Releasing a fish to the ocean always lets go of your smallest fish of that kind, the one that earns the least (youngest growth stage, then the smallest). A short line in the Ocean menu now says so.

---

## V0.09 — 2026-10-29

**Changes**
- The owner's name is now on a brass nameplate at the front of the aquarium's base ("🐠 Name's Aquarium"), next to the fish counter, instead of floating above the tank.
- Free aquariums no longer show a "Free aquarium" sign.

**Fixes**
- The floating sign of the aquarium behind no longer shows through the glass in the aquarium view.

---

## V0.08 — 2026-10-29

**New**
- **Rebirth**: once you can afford 5,000 $, a new Rebirth menu appears, with a "NEW" bubble and a notification. A rebirth restarts your run in exchange for permanent rewards:
  - every fish in your tank goes back to the ocean and earns you its Ocean Points;
  - your money restarts at 300 $, and your eggs and egg unlocks are reset (the free starter egg is back);
  - your Fish Index, quests, companions, Ocean Points and likes are kept;
  - your coins are worth **x2.5 forever**;
  - your aquarium becomes the **Lagoon Aquarium**.
- The Rebirth menu shows exactly what you lose and what you get (including the Ocean Points your current fish will bring), your progress toward the price, and asks for a second click to confirm. A "!" badge shows when a rebirth is affordable.
- **Lagoon Aquarium** (rebirth 1): light sand, teal and gold frame, a painted lagoon backdrop with light rays, and decor kept low along the back and the sides so fish and coins stay in view: a sandcastle, corals, rocks, starfish, shells, sea grass, pebbles and a bubbler.
- The coin income line now shows your multiplier, for example "(x2.5)".

**Balance**
- Freshwater Egg: 10,000 $ → 25,000 $. It is now the wall that the first rebirth gets you past.
- Expected pace for an average player: first rebirth at about 30 min of play, all 6 first fish discovered at about 1 h (about 1h20 without rebirthing).

---

## V0.07 — 2026-10-29

**Fixes**
- Text no longer wobbles when a window opens. The menus (quests, companions, Fish Index, Ocean), the tutorial card, the event banner, the reward popup and the hatch caption now fade in at their final size instead of growing. The rays, the eggs and the fish keep their pop.

---

## V0.06 — 2026-10-29

**Fixes**
- Hungry fish now swim smoothly toward the food. They used to stop for a split second several times per second while chasing it.
- The Ocean menu no longer jumps between sizes while it opens. The same fix applies to the quest book, whose quest descriptions could do the same.

---

## V0.05 — 2026-10-29

**Changes**
- **Loading screen**: new artwork, a sunny beach with the aquarium bowl. The loading bar is now shaped like a fish, with a swishing tail, under a "LOADING... %" counter.
- **Loading screen**: it now waits for its artwork on a slow connection (8 seconds at most), so players see the illustration instead of a plain blue screen.

---

## V0.04 — 2026-10-29

**New**
- **Loading screen**: the game now opens on a "Project: Quarium" illustrated screen with a bubbly loading bar. The bar follows the real loading (the game, the fish, then your save) and the screen fades out once your aquarium is ready.

---

## V0.03 — 2026-10-29

**Changes**
- **Like boost**: a new like now restarts the x2 coins boost at 5 minutes instead of adding 5 more minutes. Likes still count up on the board, even when several come in at once.
- **Like boost**: the boost is no longer saved. It is lost when you leave the game.

---

## V0.02 — 2026-10-29

**New**
- **Aquarium likes**: a small driftwood board now stands beside each aquarium and shows how many likes its owner has received.
- **Giving a like**: walk up to another player's board and press E to give a 👍. Each player can give 1 like per hour, to any aquarium. Your own aquarium can't be liked by you. The prompt shows how long until your next like.
- **Like boost**: each like received doubles the coins of the owner's fish for 5 minutes. Several likes add up their time. The board shows the boost and its countdown, and the owner sees a "Liked! Coins x2" timer under the top bar. Both players get a notification.
- Likes received, the like cooldown and the boost are saved. The boost timer keeps running while you're offline.

---

## V0.01 — 2026-10-29

First version: the state of the game at the start of these release notes.

**New**
- **Aquariums**: up to 6 players per server. Each player owns one of the 6 aquariums placed around a beach lobby, with their name on its sign. Walking up to the glass switches to a 2.5D focus view of your own tank. A back button returns you to the lobby.
- **Eggs shop** (top bar, 6 slots): Common Egg (100 $), Improved Egg (500 $), Superior Egg (2,500 $) and Freshwater Egg (10,000 $). Each egg has its own hatch time and odds. Buying an egg of one rarity unlocks the next. Ready eggs show "OPEN!" and must be opened by clicking them. One egg of each type can incubate at a time. The last 2 slots are "Soon".
- **Hatching**: a reveal animation shows the fish, its rarity and its odds, with "NEW!" for a first discovery. A full tank (10 fish) can still buy eggs, but can't open them.
- **Fish**: Golden Guppy, Blue Neon and Red Tetra (Common); Clownfish, Zebra Danio and Flame Gourami (Uncommon). Each fish has a random adult size, starts as a baby and grows over time. Coin value grows with it.
- **Coins**: fish drop coins that sink to the sand and must be clicked to be collected, with a floating "+X $" popup. Some coins are special.
- **Hunger**: fish go from Satiated (30 s) to Hungry (15 s) to Weak. Clicking the water drops a food pellet (paid). Fish chase and eat it. Weak fish never die: they swim very slowly and only let out 1 $ fart bubbles instead of coins, until they are fed.
- **AFK freeze**: while you are away from your tank, your fish are frozen in time: no hunger, no growth, no coins. Eggs keep hatching.
- **Tutorial**: 5 steps. Walk up to the glass, buy the free egg, open it, collect your first coin, then feed your hungry fish. Completing it gives 300 $. The menus appear once it is done.
- **Quest book**: Story, Daily and Weekly tabs. Story quests: "Coin Collector" (collect 300 $ of coins), which gives the Snail, then "Full House" (10 fish in your tank), which unlocks the Ocean. A badge shows when a reward is ready to claim. The daily and weekly boards reset on schedule, but have no quests yet.
- **Story quest hint**: 5 s after the tutorial, a bubble on the Quests button invites you to look at the Snail quest and wishes you good luck.
- **Companions**: the Snail crawls along the bottom of your tank and picks up coins for you. It can be equipped or unequipped from the Companions menu (1 slot).
- **Fish Index**: a collection of every species, filled in as you hatch them.
- **The Ocean** (unlocked by "Full House"): release fish you don't need to free a spot in your tank and earn Ocean Points, a score that only grows. Rarer fish give more points. Your last fish can't be released. A short tutorial shows the first time you open it.
- **Music events**: server-wide "K-POP LIVE" event, with its own music and a banner. Fish react to the beat and drop extra coins, and a guest fish visits each tank.
- **Audio**: background music and sound effects (coins, hatching, feeding, releases, weak fish…).
- **Saving**: your progress is saved: money, fish (with their size, age and hunger), Fish Index, eggs (they keep hatching while you are offline), tutorial step, quests, companions, Ocean Points and unlocked features. Saves happen every 60 s, when you leave and when the server shuts down. Your data can only be open on one server at a time, so it can't be duplicated. A tutorial left halfway resumes where you stopped.
