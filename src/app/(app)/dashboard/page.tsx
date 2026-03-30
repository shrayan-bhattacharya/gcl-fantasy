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
      todayMatch={todayMatchArr?.[0] ?? null}
      matchday={matchday ?? 0}
    />
  )
}
