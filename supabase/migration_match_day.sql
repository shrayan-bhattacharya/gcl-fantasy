-- ============================================================
-- Migration: per-day fantasy teams (match_day replaces match_id)
-- Run this in Supabase SQL Editor before deploying updated code.
-- ============================================================

-- 1. Add match_day DATE column to fantasy_teams
ALTER TABLE public.fantasy_teams
  ADD COLUMN IF NOT EXISTS match_day DATE;

-- 2. Backfill match_day from existing match_id references
UPDATE public.fantasy_teams ft
SET match_day = (
  SELECT (match_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
  FROM public.matches m
  WHERE m.id = ft.match_id
)
WHERE ft.match_id IS NOT NULL
  AND ft.match_day IS NULL;

-- 3. Make match_day NOT NULL now that it is backfilled
ALTER TABLE public.fantasy_teams
  ALTER COLUMN match_day SET NOT NULL;

-- 4. Drop the old per-match unique constraint
ALTER TABLE public.fantasy_teams
  DROP CONSTRAINT IF EXISTS fantasy_teams_user_id_match_id_key;

-- 5. Add new per-day unique constraint
ALTER TABLE public.fantasy_teams
  ADD CONSTRAINT fantasy_teams_user_id_match_day_key
  UNIQUE (user_id, match_day);

-- 6. Make match_id nullable (kept for historical reference only)
ALTER TABLE public.fantasy_teams
  ALTER COLUMN match_id DROP NOT NULL;

ALTER TABLE public.fantasy_teams
  DROP CONSTRAINT IF EXISTS fantasy_teams_match_id_fkey;

-- 7. Update fantasy_scores unique constraint to allow per-player per-match rows
--    (required for double-header days where a player earns points in both matches)
ALTER TABLE public.fantasy_scores
  DROP CONSTRAINT IF EXISTS fantasy_scores_fantasy_team_id_player_id_key;

ALTER TABLE public.fantasy_scores
  ADD CONSTRAINT fantasy_scores_fantasy_team_id_player_id_match_id_key
  UNIQUE (fantasy_team_id, player_id, match_id);
