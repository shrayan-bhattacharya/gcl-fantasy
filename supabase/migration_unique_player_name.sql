-- Run this in Supabase SQL Editor (after dedup_players.sql, while ipl_players has no duplicates).

-- 1. Add UNIQUE constraint on name so ON CONFLICT (name) upserts work.
ALTER TABLE public.ipl_players
  ADD CONSTRAINT ipl_players_name_unique UNIQUE (name);

-- 2. Create an RPC function that truncates ipl_players + dependent tables.
--    Called by /api/sync/squads?reset=true for the Full Reset + Resync button.
CREATE OR REPLACE FUNCTION public.truncate_players_cascade()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE TABLE public.fantasy_scores  CASCADE;
  TRUNCATE TABLE public.fantasy_teams   CASCADE;
  TRUNCATE TABLE public.player_match_stats CASCADE;
  TRUNCATE TABLE public.ipl_players     CASCADE;
END;
$$;

-- Allow the service role to call it (already granted implicitly via SECURITY DEFINER,
-- but be explicit so anon/authenticated can't call it directly).
REVOKE ALL ON FUNCTION public.truncate_players_cascade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.truncate_players_cascade() TO service_role;
