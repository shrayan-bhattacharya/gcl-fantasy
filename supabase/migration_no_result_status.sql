-- Add 'no_result' to match_status enum (for rain-cancelled / abandoned matches)
-- Run this in Supabase SQL editor before deploying
ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'no_result';
