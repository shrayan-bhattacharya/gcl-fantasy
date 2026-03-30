-- Run in Supabase SQL Editor before deploying the cron scorecard sync.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS sync_status text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS sync_error  text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS synced_at   timestamptz;
