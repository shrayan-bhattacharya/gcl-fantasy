-- Deduplicate ipl_players: keep the row with cricapi_player_id populated,
-- delete duplicates (same name) that have no cricapi_player_id.

DELETE FROM public.ipl_players
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY name
             ORDER BY (cricapi_player_id IS NOT NULL) DESC, id ASC
           ) AS rn
    FROM public.ipl_players
  ) ranked
  WHERE rn > 1
);

-- Also purge any remaining rows still missing cricapi_player_id
-- (old ESPN-era rows that had no duplicate to lose to above)
DELETE FROM public.ipl_players WHERE cricapi_player_id IS NULL;
