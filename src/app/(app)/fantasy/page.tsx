import { createClient } from '@/lib/supabase/server'
import { FantasyClient, type MatchDayData } from './FantasyClient'
import { getMatchDay, getMatchDayLockTime, getMatchDayUnlockTime } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type MatchRow = Database['public']['Tables']['matches']['Row']

export default async function FantasyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: players }, { data: allMatches }, { data: existingTeams }] = await Promise.all([
    supabase.from('ipl_players')
      .select('id, name, team, role, image_url')
      .eq('is_active', true)
      .order('team').order('name'),
    supabase.from('matches')
      .select('id, team_a, team_b, venue, match_date, status, prediction_deadline, fantasy_deadline')
      .in('status', ['upcoming', 'live'])
      .order('match_date'),
    supabase.from('fantasy_teams')
      .select(`id, match_day, total_points, is_scored,
        batsman_1:ipl_players!batsman_1_id(id, name, team, role),
        batsman_2:ipl_players!batsman_2_id(id, name, team, role),
        bowler_1:ipl_players!bowler_1_id(id, name, team, role),
        bowler_2:ipl_players!bowler_2_id(id, name, team, role),
        flex:ipl_players!flex_player_id(id, name, team, role)`)
      .eq('user_id', user!.id),
  ])

  // Group matches by IST calendar date
  const dayMap: Record<string, MatchRow[]> = {}
  for (const match of allMatches ?? []) {
    const day = getMatchDay(match.match_date)
    if (!dayMap[day]) dayMap[day] = []
    dayMap[day].push(match)
  }

  // Index existing teams by match_day
  const teamsByDay: Record<string, any> = {}
  for (const t of existingTeams ?? []) {
    teamsByDay[t.match_day] = t
  }

  // Build sorted MatchDayData array
  const matchDays: MatchDayData[] = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([matchDay, matches]) => {
      const earliest = matches.reduce((a, b) =>
        new Date(a.match_date) < new Date(b.match_date) ? a : b
      )
      const lockTime = getMatchDayLockTime(earliest.match_date)
      const unlockTime = getMatchDayUnlockTime(matchDay)
      const now = new Date()
      return {
        matchDay,
        matches,
        isLocked: now >= lockTime && now < unlockTime,
        lockTime: lockTime.toISOString(),
        unlockTime: unlockTime.toISOString(),
        existingTeam: teamsByDay[matchDay] ?? null,
      }
    })

  return (
    <FantasyClient
      players={players ?? []}
      matchDays={matchDays}
      userId={user!.id}
    />
  )
}
