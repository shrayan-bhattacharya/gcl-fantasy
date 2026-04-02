import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch lock settings first to know the current phase
  const { data: lockSettings } = await supabase
    .from('fantasy_lock')
    .select('is_locked, phase')
    .limit(1)
    .single()

  const { data: predWindow } = await supabase
    .from('prediction_window')
    .select('is_open, opened_at')
    .limit(1)
    .single()

  const phase = lockSettings?.phase ?? 'league'

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const [
    { data: profile },
    { data: upcomingMatches },
    { data: recentPredictions },
    { data: leaderboardTop },
    { data: fantasyTeam },
    { count: totalPredictions },
    { count: totalMatches },
    { data: todayMatchArr },
    { count: matchday },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user!.id).single(),
    supabase.from('matches').select('*').eq('status', 'upcoming').order('match_date').limit(3),
    supabase.from('predictions').select('*, matches(team_a, team_b, status, match_winner)').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('users').select('id, display_name, total_score, prediction_score, fantasy_score').order('total_score', { ascending: false }).limit(5),
    supabase.from('fantasy_teams').select('*, batsman_1:ipl_players!batsman_1_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate), batsman_2:ipl_players!batsman_2_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate), bowler_1:ipl_players!bowler_1_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate), bowler_2:ipl_players!bowler_2_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate), flex:ipl_players!flex_player_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate)').eq('user_id', user!.id).eq('phase', phase).maybeSingle(),
    supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('matches').select('*').gte('match_date', todayStart.toISOString()).lte('match_date', todayEnd.toISOString()).order('match_date').limit(1),
    supabase.from('matches').select('*', { count: 'exact', head: true }).lte('match_date', todayEnd.toISOString()),
  ])

  // Find user's rank
  const { count: rankCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gt('total_score', profile?.total_score ?? 0)
  const rank = (rankCount ?? 0) + 1

  // Effective prediction window state: combines global flag + per-match deadline + admin override
  const todayMatch = todayMatchArr?.[0] ?? null
  const adminOverride =
    !!predWindow?.is_open &&
    !!predWindow?.opened_at &&
    !!todayMatch?.prediction_deadline &&
    new Date(predWindow.opened_at) > new Date(todayMatch.prediction_deadline)
  const effectivePredWindowOpen =
    (predWindow?.is_open ?? true) &&
    (adminOverride ||
     !todayMatch?.prediction_deadline ||
     new Date() <= new Date(todayMatch.prediction_deadline))

  // Players to watch for today's match
  let playersToWatch: { id: string; name: string; team: string; role: string; times_picked: number }[] = []
  if (todayMatch) {
    const { data: allTeams } = await supabase
      .from('fantasy_teams')
      .select('batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id, user_id')
    const pickCount: Record<string, Set<string>> = {}
    for (const t of allTeams ?? []) {
      for (const pid of [t.batsman_1_id, t.batsman_2_id, t.bowler_1_id, t.bowler_2_id, t.flex_player_id]) {
        if (pid) {
          if (!pickCount[pid]) pickCount[pid] = new Set()
          pickCount[pid].add(t.user_id)
        }
      }
    }
    const pickedIds = Object.keys(pickCount)
    if (pickedIds.length) {
      const { data: players } = await supabase
        .from('ipl_players').select('id, name, team, role')
        .in('id', pickedIds).in('team', [todayMatch.team_a, todayMatch.team_b])
      playersToWatch = (players ?? [])
        .map((p: any) => ({ ...p, times_picked: pickCount[p.id]?.size ?? 0 }))
        .sort((a: any, b: any) => b.times_picked - a.times_picked)
    }
  }

  // Per-player fantasy points for the squad section
  let squadPlayerPoints: Record<string, number> = {}
  if (fantasyTeam?.id) {
    const { data: scores } = await supabase
      .from('fantasy_scores')
      .select('player_id, total_points')
      .eq('fantasy_team_id', fantasyTeam.id)
    if (scores) {
      for (const s of scores) {
        squadPlayerPoints[s.player_id] = (squadPlayerPoints[s.player_id] ?? 0) + s.total_points
      }
    }
  }

  return (
    <DashboardClient
      profile={profile}
      rank={rank}
      upcomingMatches={upcomingMatches ?? []}
      recentPredictions={recentPredictions ?? []}
      leaderboardTop={leaderboardTop ?? []}
      currentUserId={user!.id}
      latestFantasyTeam={fantasyTeam}
      totalPredictions={totalPredictions ?? 0}
      totalMatches={totalMatches ?? 0}
      isFantasyLocked={lockSettings?.is_locked ?? false}
      predictionWindowOpen={effectivePredWindowOpen}
      todayMatch={todayMatch}
      matchday={matchday ?? 0}
      squadPlayerPoints={squadPlayerPoints}
      playersToWatch={playersToWatch}
    />
  )
}
