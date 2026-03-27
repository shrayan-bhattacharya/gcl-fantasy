-- ============================================================
-- IPL Fantasy League 2026 — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────
CREATE TYPE match_status  AS ENUM ('upcoming', 'live', 'completed');
CREATE TYPE player_role   AS ENUM ('batsman', 'bowler', 'allrounder', 'wicketkeeper');
CREATE TYPE ipl_team      AS ENUM ('CSK','MI','RCB','KKR','DC','SRH','PBKS','RR','LSG','GT');

-- ────────────────────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT UNIQUE NOT NULL,
  display_name     TEXT,
  avatar_url       TEXT,
  role             TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  invite_accepted  BOOLEAN NOT NULL DEFAULT TRUE,
  total_score      INTEGER NOT NULL DEFAULT 0,
  prediction_score INTEGER NOT NULL DEFAULT 0,
  fantasy_score    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.invites (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token          UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  invited_email  TEXT NOT NULL,
  invited_by     UUID REFERENCES public.users(id),
  used_at        TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.matches (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_a               ipl_team NOT NULL,
  team_b               ipl_team NOT NULL,
  venue                TEXT,
  match_date           TIMESTAMPTZ NOT NULL,
  status               match_status NOT NULL DEFAULT 'upcoming',
  prediction_deadline  TIMESTAMPTZ NOT NULL,
  fantasy_deadline     TIMESTAMPTZ NOT NULL,
  toss_winner          ipl_team,
  toss_decision        TEXT CHECK (toss_decision IN ('bat', 'bowl')),
  match_winner         ipl_team,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ipl_players (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  team       ipl_team NOT NULL,
  role       player_role NOT NULL,
  image_url  TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.predictions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id                 UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_toss_winner    ipl_team NOT NULL,
  predicted_match_winner   ipl_team NOT NULL,
  points_earned            INTEGER NOT NULL DEFAULT 0,
  is_scored                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

CREATE TABLE public.fantasy_teams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id        UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  batsman_1_id    UUID NOT NULL REFERENCES public.ipl_players(id),
  batsman_2_id    UUID NOT NULL REFERENCES public.ipl_players(id),
  bowler_1_id     UUID NOT NULL REFERENCES public.ipl_players(id),
  bowler_2_id     UUID NOT NULL REFERENCES public.ipl_players(id),
  flex_player_id  UUID NOT NULL REFERENCES public.ipl_players(id),
  total_points    INTEGER NOT NULL DEFAULT 0,
  is_scored       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

CREATE TABLE public.player_match_stats (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id    UUID NOT NULL REFERENCES public.ipl_players(id),
  match_id     UUID NOT NULL REFERENCES public.matches(id),
  runs_scored  INTEGER NOT NULL DEFAULT 0,
  balls_faced  INTEGER NOT NULL DEFAULT 0,
  fours        INTEGER NOT NULL DEFAULT 0,
  sixes        INTEGER NOT NULL DEFAULT 0,
  wickets      INTEGER NOT NULL DEFAULT 0,
  economy_rate NUMERIC(5,2),
  catches      INTEGER NOT NULL DEFAULT 0,
  stumpings    INTEGER NOT NULL DEFAULT 0,
  run_outs     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

CREATE TABLE public.fantasy_scores (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fantasy_team_id  UUID NOT NULL REFERENCES public.fantasy_teams(id) ON DELETE CASCADE,
  player_id        UUID NOT NULL REFERENCES public.ipl_players(id),
  match_id         UUID NOT NULL REFERENCES public.matches(id),
  points_breakdown JSONB NOT NULL DEFAULT '{}',
  total_points     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fantasy_team_id, player_id)
);

-- ────────────────────────────────────────────────────────────
-- AUTO-CREATE USER PROFILE ON SIGN UP
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- ACCEPT INVITE RPC
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invite(invite_token UUID, user_email TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  inv public.invites%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.invites
  WHERE token = invite_token
    AND invited_email = user_email
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE public.invites SET used_at = NOW() WHERE id = inv.id;
  UPDATE public.users SET invite_accepted = TRUE WHERE email = user_email;
  RETURN TRUE;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_teams      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_scores     ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "users_read_all"    ON public.users FOR SELECT USING (TRUE);
CREATE POLICY "users_update_own"  ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own"  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- INVITES
CREATE POLICY "invites_read_all"    ON public.invites FOR SELECT USING (TRUE);
CREATE POLICY "invites_admin_insert" ON public.invites FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "invites_admin_update" ON public.invites FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "invites_admin_delete" ON public.invites FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- MATCHES
CREATE POLICY "matches_read"         ON public.matches FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "matches_admin_insert" ON public.matches FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "matches_admin_update" ON public.matches FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "matches_admin_delete" ON public.matches FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- IPL_PLAYERS
CREATE POLICY "players_read"         ON public.ipl_players FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "players_admin_insert" ON public.ipl_players FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "players_admin_update" ON public.ipl_players FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "players_admin_delete" ON public.ipl_players FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- PREDICTIONS
CREATE POLICY "predictions_read_own"    ON public.predictions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "predictions_admin_read"  ON public.predictions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "predictions_insert_own"  ON public.predictions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "predictions_update_own"  ON public.predictions FOR UPDATE USING (user_id = auth.uid());

-- FANTASY_TEAMS
CREATE POLICY "fantasy_read_own"    ON public.fantasy_teams FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "fantasy_admin_read"  ON public.fantasy_teams FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "fantasy_insert_own"  ON public.fantasy_teams FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "fantasy_update_own"  ON public.fantasy_teams FOR UPDATE USING (user_id = auth.uid());

-- PLAYER_MATCH_STATS
CREATE POLICY "stats_read"         ON public.player_match_stats FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "stats_admin_insert" ON public.player_match_stats FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "stats_admin_update" ON public.player_match_stats FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "stats_admin_delete" ON public.player_match_stats FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- FANTASY_SCORES (written by service role key — bypass RLS via service client)
CREATE POLICY "fscores_read"          ON public.fantasy_scores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fscores_insert"        ON public.fantasy_scores FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "fscores_update"        ON public.fantasy_scores FOR UPDATE USING (TRUE);
CREATE POLICY "fscores_delete"        ON public.fantasy_scores FOR DELETE USING (TRUE);

-- ────────────────────────────────────────────────────────────
-- SAMPLE DATA — IPL 2026 schedule (first 5 matches)
-- Remove or replace with real schedule
-- ────────────────────────────────────────────────────────────
INSERT INTO public.matches (team_a, team_b, venue, match_date, prediction_deadline, fantasy_deadline, status) VALUES
('CSK', 'MI',  'Wankhede Stadium, Mumbai',   '2026-03-29 19:30:00+05:30', '2026-03-29 19:00:00+05:30', '2026-03-29 18:30:00+05:30', 'upcoming'),
('RCB', 'KKR', 'M. Chinnaswamy Stadium, Bengaluru', '2026-03-30 19:30:00+05:30', '2026-03-30 19:00:00+05:30', '2026-03-30 18:30:00+05:30', 'upcoming'),
('DC',  'SRH', 'Arun Jaitley Stadium, Delhi', '2026-03-31 19:30:00+05:30', '2026-03-31 19:00:00+05:30', '2026-03-31 18:30:00+05:30', 'upcoming'),
('PBKS','RR',  'IS Bindra Stadium, Mohali',  '2026-04-01 19:30:00+05:30', '2026-04-01 19:00:00+05:30', '2026-04-01 18:30:00+05:30', 'upcoming'),
('LSG', 'GT',  'BRSABV Ekana Cricket Stadium, Lucknow', '2026-04-02 19:30:00+05:30', '2026-04-02 19:00:00+05:30', '2026-04-02 18:30:00+05:30', 'upcoming');
