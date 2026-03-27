-- Run this in Supabase SQL Editor after schema.sql
-- Adds ESPN IDs for upsert-by-external-id support

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS espn_match_id BIGINT UNIQUE;

ALTER TABLE public.ipl_players
  ADD COLUMN IF NOT EXISTS espn_player_id BIGINT UNIQUE;
