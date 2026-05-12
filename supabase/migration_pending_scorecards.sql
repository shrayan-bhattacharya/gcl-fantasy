-- Staging table for AI-extracted scorecards
-- Admin reviews + approves before scores hit production
CREATE TABLE IF NOT EXISTS public.pending_scorecards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  proposed_winner TEXT,
  confidence TEXT,
  players JSONB NOT NULL DEFAULT '[]',  -- [{name, team, runs, wickets}]
  missing JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
);

ALTER TABLE public.pending_scorecards ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so this only applies to API client calls
CREATE POLICY "Admin read pending"
ON public.pending_scorecards
FOR SELECT
TO authenticated
USING (true);
