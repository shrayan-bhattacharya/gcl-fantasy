-- Deduplicate ipl_players safely.
-- Run this in Supabase SQL Editor.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- For each player that has both a duplicate (no cricapi_player_id) and a keeper (has cricapi_player_id):
  -- remap all FK references from the duplicate ID to the keeper ID, then delete the duplicate.
  FOR r IN
    SELECT d.id AS old_id, k.id AS keeper_id
    FROM public.ipl_players d
    JOIN public.ipl_players k
      ON k.name = d.name
     AND k.cricapi_player_id IS NOT NULL
    WHERE d.cricapi_player_id IS NULL
  LOOP
    UPDATE public.fantasy_teams SET batsman_1_id   = r.keeper_id WHERE batsman_1_id   = r.old_id;
    UPDATE public.fantasy_teams SET batsman_2_id   = r.keeper_id WHERE batsman_2_id   = r.old_id;
    UPDATE public.fantasy_teams SET bowler_1_id    = r.keeper_id WHERE bowler_1_id    = r.old_id;
    UPDATE public.fantasy_teams SET bowler_2_id    = r.keeper_id WHERE bowler_2_id    = r.old_id;
    UPDATE public.fantasy_teams SET flex_player_id = r.keeper_id WHERE flex_player_id = r.old_id;
    UPDATE public.player_match_stats SET player_id = r.keeper_id WHERE player_id = r.old_id;
    DELETE FROM public.ipl_players WHERE id = r.old_id;
  END LOOP;

  -- Purge ESPN-era orphans (no cricapi_player_id, no CricAPI name-match) that are NOT referenced anywhere.
  -- Orphans still picked in fantasy_teams are left in place — they're harmless and can be re-synced later.
  DELETE FROM public.player_match_stats
    WHERE player_id IN (
      SELECT id FROM public.ipl_players WHERE cricapi_player_id IS NULL
    );

  DELETE FROM public.ipl_players
    WHERE cricapi_player_id IS NULL
      AND id NOT IN (
        SELECT batsman_1_id  FROM public.fantasy_teams UNION ALL
        SELECT batsman_2_id  FROM public.fantasy_teams UNION ALL
        SELECT bowler_1_id   FROM public.fantasy_teams UNION ALL
        SELECT bowler_2_id   FROM public.fantasy_teams UNION ALL
        SELECT flex_player_id FROM public.fantasy_teams
      );
END $$;
