-- Deduplicate ipl_players safely, remapping FK references before deletion.
-- Run this in Supabase SQL Editor.

-- Step 1: Build a mapping of duplicate IDs → keeper IDs
-- (keeper = the row with cricapi_player_id; duplicate = same name, no cricapi_player_id)
WITH dupes AS (
  SELECT
    id,
    name,
    cricapi_player_id,
    ROW_NUMBER() OVER (
      PARTITION BY name
      ORDER BY (cricapi_player_id IS NOT NULL) DESC, id ASC
    ) AS rn
  FROM public.ipl_players
),
keepers AS (
  SELECT id AS keeper_id, name FROM dupes WHERE rn = 1
),
to_delete AS (
  SELECT dupes.id AS old_id, keepers.keeper_id
  FROM dupes
  JOIN keepers ON dupes.name = keepers.name
  WHERE dupes.rn > 1
)

-- Step 2: Remap fantasy_teams FK columns
, remap_batsman_1 AS (
  UPDATE public.fantasy_teams ft
  SET batsman_1_id = td.keeper_id
  FROM to_delete td
  WHERE ft.batsman_1_id = td.old_id
  RETURNING ft.id
)
, remap_batsman_2 AS (
  UPDATE public.fantasy_teams ft
  SET batsman_2_id = td.keeper_id
  FROM to_delete td
  WHERE ft.batsman_2_id = td.old_id
  RETURNING ft.id
)
, remap_bowler_1 AS (
  UPDATE public.fantasy_teams ft
  SET bowler_1_id = td.keeper_id
  FROM to_delete td
  WHERE ft.bowler_1_id = td.old_id
  RETURNING ft.id
)
, remap_bowler_2 AS (
  UPDATE public.fantasy_teams ft
  SET bowler_2_id = td.keeper_id
  FROM to_delete td
  WHERE ft.bowler_2_id = td.old_id
  RETURNING ft.id
)
, remap_flex AS (
  UPDATE public.fantasy_teams ft
  SET flex_player_id = td.keeper_id
  FROM to_delete td
  WHERE ft.flex_player_id = td.old_id
  RETURNING ft.id
)
-- Step 3: Remap player_match_stats
, remap_stats AS (
  UPDATE public.player_match_stats pms
  SET player_id = td.keeper_id
  FROM to_delete td
  WHERE pms.player_id = td.old_id
  RETURNING pms.id
)
-- Step 4: Delete the duplicates
DELETE FROM public.ipl_players
WHERE id IN (SELECT old_id FROM to_delete);

-- Step 5: Purge any remaining rows without cricapi_player_id
-- (old ESPN-era rows with no name-match duplicate)
-- First remap any references to these orphans (shouldn't exist but be safe)
UPDATE public.fantasy_teams ft
SET batsman_1_id = (SELECT id FROM public.ipl_players WHERE name = (SELECT name FROM public.ipl_players WHERE id = ft.batsman_1_id LIMIT 1) AND cricapi_player_id IS NOT NULL LIMIT 1)
WHERE ft.batsman_1_id IN (SELECT id FROM public.ipl_players WHERE cricapi_player_id IS NULL);

UPDATE public.fantasy_teams ft
SET batsman_2_id = (SELECT id FROM public.ipl_players WHERE name = (SELECT name FROM public.ipl_players WHERE id = ft.batsman_2_id LIMIT 1) AND cricapi_player_id IS NOT NULL LIMIT 1)
WHERE ft.batsman_2_id IN (SELECT id FROM public.ipl_players WHERE cricapi_player_id IS NULL);

UPDATE public.fantasy_teams ft
SET bowler_1_id = (SELECT id FROM public.ipl_players WHERE name = (SELECT name FROM public.ipl_players WHERE id = ft.bowler_1_id LIMIT 1) AND cricapi_player_id IS NOT NULL LIMIT 1)
WHERE ft.bowler_1_id IN (SELECT id FROM public.ipl_players WHERE cricapi_player_id IS NULL);

UPDATE public.fantasy_teams ft
SET bowler_2_id = (SELECT id FROM public.ipl_players WHERE name = (SELECT name FROM public.ipl_players WHERE id = ft.bowler_2_id LIMIT 1) AND cricapi_player_id IS NOT NULL LIMIT 1)
WHERE ft.bowler_2_id IN (SELECT id FROM public.ipl_players WHERE cricapi_player_id IS NULL);

UPDATE public.fantasy_teams ft
SET flex_player_id = (SELECT id FROM public.ipl_players WHERE name = (SELECT name FROM public.ipl_players WHERE id = ft.flex_player_id LIMIT 1) AND cricapi_player_id IS NOT NULL LIMIT 1)
WHERE ft.flex_player_id IN (SELECT id FROM public.ipl_players WHERE cricapi_player_id IS NULL);

DELETE FROM public.player_match_stats WHERE player_id IN (SELECT id FROM public.ipl_players WHERE cricapi_player_id IS NULL);
DELETE FROM public.ipl_players WHERE cricapi_player_id IS NULL;
