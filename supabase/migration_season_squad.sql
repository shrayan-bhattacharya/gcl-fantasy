-- ============================================================
-- Migration: Per-match-day fantasy → Season-long squad
-- Run this in Supabase SQL Editor AFTER migration_match_day.sql
-- ============================================================

-- 1. Add phase column to fantasy_teams
ALTER TABLE public.fantasy_teams ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'league';
ALTER TABLE public.fantasy_teams ADD CONSTRAINT fantasy_teams_phase_check CHECK (phase IN ('league', 'knockout'));

-- 2. Drop old match_day unique constraint and column
ALTER TABLE public.fantasy_teams DROP CONSTRAINT IF EXISTS fantasy_teams_user_id_match_day_key;
ALTER TABLE public.fantasy_teams DROP COLUMN IF EXISTS match_day;

-- 3. Drop match_id column (no longer needed)
ALTER TABLE public.fantasy_teams DROP COLUMN IF EXISTS match_id;

-- 4. Add new unique constraint (one team per user per phase)
-- If a user had multiple match_day rows, keep only the latest one per phase
-- First deduplicate: keep only the most recent row per user
DELETE FROM public.fantasy_teams a
  USING public.fantasy_teams b
  WHERE a.user_id = b.user_id
    AND a.phase = b.phase
    AND a.created_at < b.created_at;

ALTER TABLE public.fantasy_teams ADD CONSTRAINT fantasy_teams_user_id_phase_key UNIQUE (user_id, phase);

-- 5. Update fantasy_scores unique constraint to include match_id
ALTER TABLE public.fantasy_scores DROP CONSTRAINT IF EXISTS fantasy_scores_fantasy_team_id_player_id_key;
ALTER TABLE public.fantasy_scores ADD CONSTRAINT fantasy_scores_team_player_match_key UNIQUE (fantasy_team_id, player_id, match_id);

-- 6. Create fantasy_lock settings table
CREATE TABLE IF NOT EXISTS public.fantasy_lock (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_locked   BOOLEAN NOT NULL DEFAULT FALSE,
  phase       TEXT NOT NULL DEFAULT 'league' CHECK (phase IN ('league', 'knockout')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.users(id)
);

INSERT INTO public.fantasy_lock (is_locked, phase)
SELECT FALSE, 'league'
WHERE NOT EXISTS (SELECT 1 FROM public.fantasy_lock);

-- 7. RLS for fantasy_lock
ALTER TABLE public.fantasy_lock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fantasy_lock_read" ON public.fantasy_lock FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fantasy_lock_admin_update" ON public.fantasy_lock FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
