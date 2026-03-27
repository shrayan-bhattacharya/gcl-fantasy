-- ============================================================
-- IPL 2026 — Real Schedule + Squads Seed Data
-- Run in Supabase SQL Editor
-- ============================================================

-- Clear existing sample data
DELETE FROM public.matches;

-- ────────────────────────────────────────────────────────────
-- MATCHES (70 league stage matches)
-- All times IST (+05:30)
-- prediction_deadline = match_date - 30 min
-- fantasy_deadline    = match_date - 60 min
-- ────────────────────────────────────────────────────────────
INSERT INTO public.matches (team_a, team_b, venue, match_date, prediction_deadline, fantasy_deadline, status) VALUES

-- PHASE 1 (Mar 28 – Apr 12)
('RCB',  'SRH',  'M. Chinnaswamy Stadium, Bengaluru',               '2026-03-28 19:30:00+05:30', '2026-03-28 19:00:00+05:30', '2026-03-28 18:30:00+05:30', 'upcoming'),
('MI',   'KKR',  'Wankhede Stadium, Mumbai',                        '2026-03-29 19:30:00+05:30', '2026-03-29 19:00:00+05:30', '2026-03-29 18:30:00+05:30', 'upcoming'),
('RR',   'CSK',  'Barsapara Cricket Stadium, Guwahati',             '2026-03-30 19:30:00+05:30', '2026-03-30 19:00:00+05:30', '2026-03-30 18:30:00+05:30', 'upcoming'),
('PBKS', 'GT',   'IS Bindra Stadium, New Chandigarh',               '2026-03-31 19:30:00+05:30', '2026-03-31 19:00:00+05:30', '2026-03-31 18:30:00+05:30', 'upcoming'),
('LSG',  'DC',   'BRSABV Ekana Cricket Stadium, Lucknow',           '2026-04-01 19:30:00+05:30', '2026-04-01 19:00:00+05:30', '2026-04-01 18:30:00+05:30', 'upcoming'),
('KKR',  'SRH',  'Eden Gardens, Kolkata',                           '2026-04-02 19:30:00+05:30', '2026-04-02 19:00:00+05:30', '2026-04-02 18:30:00+05:30', 'upcoming'),
('CSK',  'PBKS', 'MA Chidambaram Stadium, Chennai',                 '2026-04-03 19:30:00+05:30', '2026-04-03 19:00:00+05:30', '2026-04-03 18:30:00+05:30', 'upcoming'),
('DC',   'MI',   'Arun Jaitley Stadium, Delhi',                     '2026-04-04 15:30:00+05:30', '2026-04-04 15:00:00+05:30', '2026-04-04 14:30:00+05:30', 'upcoming'),
('GT',   'RR',   'Narendra Modi Stadium, Ahmedabad',                '2026-04-04 19:30:00+05:30', '2026-04-04 19:00:00+05:30', '2026-04-04 18:30:00+05:30', 'upcoming'),
('SRH',  'LSG',  'Rajiv Gandhi International Cricket Stadium, Hyderabad', '2026-04-05 15:30:00+05:30', '2026-04-05 15:00:00+05:30', '2026-04-05 14:30:00+05:30', 'upcoming'),
('RCB',  'CSK',  'M. Chinnaswamy Stadium, Bengaluru',               '2026-04-05 19:30:00+05:30', '2026-04-05 19:00:00+05:30', '2026-04-05 18:30:00+05:30', 'upcoming'),
('KKR',  'PBKS', 'Eden Gardens, Kolkata',                           '2026-04-06 19:30:00+05:30', '2026-04-06 19:00:00+05:30', '2026-04-06 18:30:00+05:30', 'upcoming'),
('RR',   'MI',   'Barsapara Cricket Stadium, Guwahati',             '2026-04-07 19:30:00+05:30', '2026-04-07 19:00:00+05:30', '2026-04-07 18:30:00+05:30', 'upcoming'),
('DC',   'GT',   'Arun Jaitley Stadium, Delhi',                     '2026-04-08 19:30:00+05:30', '2026-04-08 19:00:00+05:30', '2026-04-08 18:30:00+05:30', 'upcoming'),
('KKR',  'LSG',  'Eden Gardens, Kolkata',                           '2026-04-09 19:30:00+05:30', '2026-04-09 19:00:00+05:30', '2026-04-09 18:30:00+05:30', 'upcoming'),
('RR',   'RCB',  'Barsapara Cricket Stadium, Guwahati',             '2026-04-10 19:30:00+05:30', '2026-04-10 19:00:00+05:30', '2026-04-10 18:30:00+05:30', 'upcoming'),
('PBKS', 'SRH',  'IS Bindra Stadium, New Chandigarh',               '2026-04-11 15:30:00+05:30', '2026-04-11 15:00:00+05:30', '2026-04-11 14:30:00+05:30', 'upcoming'),
('CSK',  'DC',   'MA Chidambaram Stadium, Chennai',                 '2026-04-11 19:30:00+05:30', '2026-04-11 19:00:00+05:30', '2026-04-11 18:30:00+05:30', 'upcoming'),
('LSG',  'GT',   'BRSABV Ekana Cricket Stadium, Lucknow',           '2026-04-12 15:30:00+05:30', '2026-04-12 15:00:00+05:30', '2026-04-12 14:30:00+05:30', 'upcoming'),
('MI',   'RCB',  'Wankhede Stadium, Mumbai',                        '2026-04-12 19:30:00+05:30', '2026-04-12 19:00:00+05:30', '2026-04-12 18:30:00+05:30', 'upcoming'),

-- PHASE 2 (Apr 13 – May 24)
('SRH',  'RR',   'Rajiv Gandhi International Cricket Stadium, Hyderabad', '2026-04-13 19:30:00+05:30', '2026-04-13 19:00:00+05:30', '2026-04-13 18:30:00+05:30', 'upcoming'),
('CSK',  'KKR',  'MA Chidambaram Stadium, Chennai',                 '2026-04-14 19:30:00+05:30', '2026-04-14 19:00:00+05:30', '2026-04-14 18:30:00+05:30', 'upcoming'),
('RCB',  'LSG',  'M. Chinnaswamy Stadium, Bengaluru',               '2026-04-15 19:30:00+05:30', '2026-04-15 19:00:00+05:30', '2026-04-15 18:30:00+05:30', 'upcoming'),
('MI',   'PBKS', 'Wankhede Stadium, Mumbai',                        '2026-04-16 19:30:00+05:30', '2026-04-16 19:00:00+05:30', '2026-04-16 18:30:00+05:30', 'upcoming'),
('GT',   'KKR',  'Narendra Modi Stadium, Ahmedabad',                '2026-04-17 19:30:00+05:30', '2026-04-17 19:00:00+05:30', '2026-04-17 18:30:00+05:30', 'upcoming'),
('RCB',  'DC',   'M. Chinnaswamy Stadium, Bengaluru',               '2026-04-18 15:30:00+05:30', '2026-04-18 15:00:00+05:30', '2026-04-18 14:30:00+05:30', 'upcoming'),
('SRH',  'CSK',  'Rajiv Gandhi International Cricket Stadium, Hyderabad', '2026-04-18 19:30:00+05:30', '2026-04-18 19:00:00+05:30', '2026-04-18 18:30:00+05:30', 'upcoming'),
('KKR',  'RR',   'Eden Gardens, Kolkata',                           '2026-04-19 15:30:00+05:30', '2026-04-19 15:00:00+05:30', '2026-04-19 14:30:00+05:30', 'upcoming'),
('PBKS', 'LSG',  'IS Bindra Stadium, New Chandigarh',               '2026-04-19 19:30:00+05:30', '2026-04-19 19:00:00+05:30', '2026-04-19 18:30:00+05:30', 'upcoming'),
('GT',   'MI',   'Narendra Modi Stadium, Ahmedabad',                '2026-04-20 19:30:00+05:30', '2026-04-20 19:00:00+05:30', '2026-04-20 18:30:00+05:30', 'upcoming'),
('SRH',  'DC',   'Rajiv Gandhi International Cricket Stadium, Hyderabad', '2026-04-21 19:30:00+05:30', '2026-04-21 19:00:00+05:30', '2026-04-21 18:30:00+05:30', 'upcoming'),
('LSG',  'RR',   'BRSABV Ekana Cricket Stadium, Lucknow',           '2026-04-22 19:30:00+05:30', '2026-04-22 19:00:00+05:30', '2026-04-22 18:30:00+05:30', 'upcoming'),
('MI',   'CSK',  'Wankhede Stadium, Mumbai',                        '2026-04-23 19:30:00+05:30', '2026-04-23 19:00:00+05:30', '2026-04-23 18:30:00+05:30', 'upcoming'),
('RCB',  'GT',   'M. Chinnaswamy Stadium, Bengaluru',               '2026-04-24 19:30:00+05:30', '2026-04-24 19:00:00+05:30', '2026-04-24 18:30:00+05:30', 'upcoming'),
('DC',   'PBKS', 'Arun Jaitley Stadium, Delhi',                     '2026-04-25 15:30:00+05:30', '2026-04-25 15:00:00+05:30', '2026-04-25 14:30:00+05:30', 'upcoming'),
('RR',   'SRH',  'Sawai Mansingh Stadium, Jaipur',                  '2026-04-25 19:30:00+05:30', '2026-04-25 19:00:00+05:30', '2026-04-25 18:30:00+05:30', 'upcoming'),
('GT',   'CSK',  'Narendra Modi Stadium, Ahmedabad',                '2026-04-26 15:30:00+05:30', '2026-04-26 15:00:00+05:30', '2026-04-26 14:30:00+05:30', 'upcoming'),
('LSG',  'KKR',  'BRSABV Ekana Cricket Stadium, Lucknow',           '2026-04-26 19:30:00+05:30', '2026-04-26 19:00:00+05:30', '2026-04-26 18:30:00+05:30', 'upcoming'),
('DC',   'RCB',  'Arun Jaitley Stadium, Delhi',                     '2026-04-27 19:30:00+05:30', '2026-04-27 19:00:00+05:30', '2026-04-27 18:30:00+05:30', 'upcoming'),
('PBKS', 'RR',   'IS Bindra Stadium, New Chandigarh',               '2026-04-28 19:30:00+05:30', '2026-04-28 19:00:00+05:30', '2026-04-28 18:30:00+05:30', 'upcoming'),
('MI',   'SRH',  'Wankhede Stadium, Mumbai',                        '2026-04-29 19:30:00+05:30', '2026-04-29 19:00:00+05:30', '2026-04-29 18:30:00+05:30', 'upcoming'),
('GT',   'RCB',  'Narendra Modi Stadium, Ahmedabad',                '2026-04-30 19:30:00+05:30', '2026-04-30 19:00:00+05:30', '2026-04-30 18:30:00+05:30', 'upcoming'),
('RR',   'DC',   'Sawai Mansingh Stadium, Jaipur',                  '2026-05-01 19:30:00+05:30', '2026-05-01 19:00:00+05:30', '2026-05-01 18:30:00+05:30', 'upcoming'),
('CSK',  'MI',   'MA Chidambaram Stadium, Chennai',                 '2026-05-02 19:30:00+05:30', '2026-05-02 19:00:00+05:30', '2026-05-02 18:30:00+05:30', 'upcoming'),
('SRH',  'KKR',  'Rajiv Gandhi International Cricket Stadium, Hyderabad', '2026-05-03 15:30:00+05:30', '2026-05-03 15:00:00+05:30', '2026-05-03 14:30:00+05:30', 'upcoming'),
('GT',   'PBKS', 'Narendra Modi Stadium, Ahmedabad',                '2026-05-03 19:30:00+05:30', '2026-05-03 19:00:00+05:30', '2026-05-03 18:30:00+05:30', 'upcoming'),
('MI',   'LSG',  'Wankhede Stadium, Mumbai',                        '2026-05-04 19:30:00+05:30', '2026-05-04 19:00:00+05:30', '2026-05-04 18:30:00+05:30', 'upcoming'),
('DC',   'CSK',  'Arun Jaitley Stadium, Delhi',                     '2026-05-05 19:30:00+05:30', '2026-05-05 19:00:00+05:30', '2026-05-05 18:30:00+05:30', 'upcoming'),
('SRH',  'PBKS', 'Rajiv Gandhi International Cricket Stadium, Hyderabad', '2026-05-06 19:30:00+05:30', '2026-05-06 19:00:00+05:30', '2026-05-06 18:30:00+05:30', 'upcoming'),
('LSG',  'RCB',  'BRSABV Ekana Cricket Stadium, Lucknow',           '2026-05-07 19:30:00+05:30', '2026-05-07 19:00:00+05:30', '2026-05-07 18:30:00+05:30', 'upcoming'),
('DC',   'KKR',  'Arun Jaitley Stadium, Delhi',                     '2026-05-08 19:30:00+05:30', '2026-05-08 19:00:00+05:30', '2026-05-08 18:30:00+05:30', 'upcoming'),
('RR',   'GT',   'Sawai Mansingh Stadium, Jaipur',                  '2026-05-09 19:30:00+05:30', '2026-05-09 19:00:00+05:30', '2026-05-09 18:30:00+05:30', 'upcoming'),
('CSK',  'LSG',  'MA Chidambaram Stadium, Chennai',                 '2026-05-10 15:30:00+05:30', '2026-05-10 15:00:00+05:30', '2026-05-10 14:30:00+05:30', 'upcoming'),
('RCB',  'MI',   'Shaheed Veer Narayan Singh International Stadium, Raipur', '2026-05-10 19:30:00+05:30', '2026-05-10 19:00:00+05:30', '2026-05-10 18:30:00+05:30', 'upcoming'),
('PBKS', 'DC',   'HPCA Stadium, Dharamsala',                        '2026-05-11 19:30:00+05:30', '2026-05-11 19:00:00+05:30', '2026-05-11 18:30:00+05:30', 'upcoming'),
('GT',   'SRH',  'Narendra Modi Stadium, Ahmedabad',                '2026-05-12 19:30:00+05:30', '2026-05-12 19:00:00+05:30', '2026-05-12 18:30:00+05:30', 'upcoming'),
('RCB',  'KKR',  'Shaheed Veer Narayan Singh International Stadium, Raipur', '2026-05-13 19:30:00+05:30', '2026-05-13 19:00:00+05:30', '2026-05-13 18:30:00+05:30', 'upcoming'),
('PBKS', 'MI',   'HPCA Stadium, Dharamsala',                        '2026-05-14 19:30:00+05:30', '2026-05-14 19:00:00+05:30', '2026-05-14 18:30:00+05:30', 'upcoming'),
('LSG',  'CSK',  'BRSABV Ekana Cricket Stadium, Lucknow',           '2026-05-15 19:30:00+05:30', '2026-05-15 19:00:00+05:30', '2026-05-15 18:30:00+05:30', 'upcoming'),
('KKR',  'GT',   'Eden Gardens, Kolkata',                           '2026-05-16 19:30:00+05:30', '2026-05-16 19:00:00+05:30', '2026-05-16 18:30:00+05:30', 'upcoming'),
('PBKS', 'RCB',  'HPCA Stadium, Dharamsala',                        '2026-05-17 15:30:00+05:30', '2026-05-17 15:00:00+05:30', '2026-05-17 14:30:00+05:30', 'upcoming'),
('DC',   'RR',   'Arun Jaitley Stadium, Delhi',                     '2026-05-17 19:30:00+05:30', '2026-05-17 19:00:00+05:30', '2026-05-17 18:30:00+05:30', 'upcoming'),
('CSK',  'SRH',  'MA Chidambaram Stadium, Chennai',                 '2026-05-18 19:30:00+05:30', '2026-05-18 19:00:00+05:30', '2026-05-18 18:30:00+05:30', 'upcoming'),
('RR',   'LSG',  'Sawai Mansingh Stadium, Jaipur',                  '2026-05-19 19:30:00+05:30', '2026-05-19 19:00:00+05:30', '2026-05-19 18:30:00+05:30', 'upcoming'),
('KKR',  'MI',   'Eden Gardens, Kolkata',                           '2026-05-20 19:30:00+05:30', '2026-05-20 19:00:00+05:30', '2026-05-20 18:30:00+05:30', 'upcoming'),
('CSK',  'GT',   'MA Chidambaram Stadium, Chennai',                 '2026-05-21 19:30:00+05:30', '2026-05-21 19:00:00+05:30', '2026-05-21 18:30:00+05:30', 'upcoming'),
('SRH',  'RCB',  'Rajiv Gandhi International Cricket Stadium, Hyderabad', '2026-05-22 19:30:00+05:30', '2026-05-22 19:00:00+05:30', '2026-05-22 18:30:00+05:30', 'upcoming'),
('LSG',  'PBKS', 'BRSABV Ekana Cricket Stadium, Lucknow',           '2026-05-23 19:30:00+05:30', '2026-05-23 19:00:00+05:30', '2026-05-23 18:30:00+05:30', 'upcoming'),
('MI',   'RR',   'Wankhede Stadium, Mumbai',                        '2026-05-24 15:30:00+05:30', '2026-05-24 15:00:00+05:30', '2026-05-24 14:30:00+05:30', 'upcoming'),
('KKR',  'DC',   'Eden Gardens, Kolkata',                           '2026-05-24 19:30:00+05:30', '2026-05-24 19:00:00+05:30', '2026-05-24 18:30:00+05:30', 'upcoming');

-- ────────────────────────────────────────────────────────────
-- Players are synced from CricAPI via /api/sync/squads — no hardcoded inserts.
