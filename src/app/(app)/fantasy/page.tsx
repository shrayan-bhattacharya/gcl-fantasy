import { createClient } from '@/lib/supabase/server'
import { FantasyClient } from './FantasyClient'

export default async function FantasyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch lock settings first (needed to know current phase)
  const { data: lockSettings } = await supabase
    .from('fantasy_lock')
    .select('is_locked, phase')
    .limit(1)
    .single()

  const phase = lockSettings?.phase ?? 'league'

  const [{ data: players }, { data: existingTeam }] = await Promise.all([
    supabase.from('ipl_players')
      .select('id, name, team, role, image_url, country, career_runs, career_wickets, strike_rate, economy_rate')
      .eq('is_active', true)
      .order('team').order('name'),
    supabase.from('fantasy_teams')
      .select(`id, phase, total_points, is_scored,
        batsman_1:ipl_players!batsman_1_id(id, name, team, role, image_url, country, career_runs, career_wickets, strike_rate, economy_rate),
        batsman_2:ipl_players!batsman_2_id(id, name, team, role, image_url, country, career_runs, career_wickets, strike_rate, economy_rate),
        bowler_1:ipl_players!bowler_1_id(id, name, team, role, image_url, country, career_runs, career_wickets, strike_rate, economy_rate),
        bowler_2:ipl_players!bowler_2_id(id, name, team, role, image_url, country, career_runs, career_wickets, strike_rate, economy_rate),
        flex:ipl_players!flex_player_id(id, name, team, role, image_url, country, career_runs, career_wickets, strike_rate, economy_rate)`)
      .eq('user_id', user!.id)
      .eq('phase', phase)
      .maybeSingle(),
  ])

  // Fetch per-player fantasy points for this team
  let playerPoints: Record<string, number> = {}
  if (existingTeam?.id) {
    const { data: scores } = await supabase
      .from('fantasy_scores')
      .select('player_id, total_points')
      .eq('fantasy_team_id', existingTeam.id)
    if (scores) {
      for (const s of scores) {
        playerPoints[s.player_id] = (playerPoints[s.player_id] ?? 0) + s.total_points
      }
    }
  }

  return (
    <FantasyClient
      players={players ?? []}
      existingTeam={existingTeam}
      isLocked={lockSettings?.is_locked ?? false}
      phase={phase}
      userId={user!.id}
      playerPoints={playerPoints}
    />
  )
}
