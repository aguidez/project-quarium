---
name: player-stats
description: "Play statistics (V0.47): what the saves record, reading profiles from Studio or Open Cloud, the DataStore's hourly version history"
metadata:
  type: reference
---

- **What is recorded**: `SaveData.stats` (server/playerStats.ts), written only by StatsService; summary in the Creator
  Dashboard (AnalyticsService: onboarding funnel, "Progression" funnel, custom events). PROJECT_CONTEXT has the list.
  `tending` seconds = the simulator's play time (tank producing); the tutorial runs before it starts counting, so
  look at `play` for it. A save older than V0.47 is `legacy`: its earlier milestones have tending -1.
- **Read a profile from Studio** (Edit datamodel, no playtest needed): `DataStoreService:GetDataStore("PlayerData_v1")
  :GetAsync("Player_" .. StudioService:GetUserId())` returns `{Data = {player, tank, stats}, MetaData = {...}}`
  (ProfileStore). `HttpService:JSONEncode` it to get a dump for `npm run stats -- --file`.
- **Keep a player off the leaderboards** (`SaveData.leaderboardBanned`, V0.53): only while they are **offline**
  (ProfileStore would write its in-memory copy back over it), in Studio's Edit datamodel, with the owner's OK:
  `local key = "Player_" .. userId; DataStoreService:GetDataStore("PlayerData_v1"):UpdateAsync(key, function(p, info)
  if p.MetaData.ActiveSession then return nil end; p.Data.leaderboardBanned = true; return p, info:GetUserIds(),
  info:GetMetadata() end)` (returning nil cancels if they are online), then `RemoveAsync(tostring(userId))` on the
  three OrderedDataStores `Leaderboard_OceanPoints_v1`, `Leaderboard_Income_v1`, `Leaderboard_PlayTime_v1` so they
  leave the boards at once (LeaderboardService also removes them at their next join). `false` lifts it.
- **DataStore version history keeps one version per UTC hour** (the last write of that hour): `ListVersionsAsync` +
  `GetVersionAsync` show what a save looked like hour by hour, and `MetaData.SessionLoadCount` tells sessions apart.
  On 2026-11-01 it showed the owner's save turned into a fresh one: the owner had reset it on purpose,
  not a bug. Ask before suspecting a wipe, and never write a player's key without the owner's OK.
- **Open Cloud** (tools/player-stats.js): v2 endpoints `https://apis.roblox.com/cloud/v2/universes/10773319506/
  data-stores/PlayerData_v1/entries` (list: `dataStoreEntries[].id`, `nextPageToken`) and `.../entries/<id>` (`value`),
  header `x-api-key`; the key is the owner's, read-only, in workspace.local.json only. Not tested against the live API
  yet (no key on 2026-11-01): check the field names on the first real run.
- **Creator Dashboard facts** (2026-11-02): events are only recorded from **published** servers (a Studio playtest
  prints "AnalyticsService: ... event fired." but sends nothing); charts fill up to ~24 h later (the Funnel / Custom
  pages' **View Events** button lists the latest events almost live); an event can't be deleted, it rolls off 90 days
  after the last data. To start a chart afresh, log under a new name (e.g. "Progression2"; max 10 funnels, 100 custom
  event names). The owner's test profiles send nothing (StatsService.safely).
- **Node 24 quirk**: `node - <<'EOF'` runs stdin as TypeScript and a `"\n"` in a search string no longer matches the
  file's `\n`: use the Edit tool for strings with escapes.
