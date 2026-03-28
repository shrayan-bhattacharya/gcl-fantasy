-- Run this in Supabase SQL Editor.

-- 1. Create prediction_window table (single-row, admin-controlled).
CREATE TABLE IF NOT EXISTS public.prediction_window (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  is_open    boolean     NOT NULL DEFAULT false,
  opened_at  timestamptz,
  opened_by  text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert the initial row (only if empty).
INSERT INTO public.prediction_window (is_open)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.prediction_window);

-- 2. RLS: authenticated users can read; writes go through service-role API.
ALTER TABLE public.prediction_window ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_prediction_window"
  ON public.prediction_window FOR SELECT
  TO authenticated
  USING (true);
