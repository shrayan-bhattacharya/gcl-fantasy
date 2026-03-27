-- Run this in Supabase SQL Editor after migration_espn_ids.sql
-- Adds CricAPI UUID identifiers for upsert-by-external-id support

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS cricapi_match_id TEXT UNIQUE;

ALTER TABLE public.ipl_players
  ADD COLUMN IF NOT EXISTS cricapi_player_id TEXT UNIQUE;
