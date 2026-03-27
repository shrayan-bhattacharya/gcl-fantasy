import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateFantasyPoints } from '@/constants/scoring'
import { getMatchDay } from '@/lib/utils'

/**
 * POST /api/scoring { matchId }
 *
 * Scores fantasy teams for a completed match. Fantasy teams are keyed by
 * match_day (IST date), so a double-header day uses ONE squad for both matches.
 * Points from all matches on the day are accumulated in fantasy_scores.
 * User totals are updated only once — when ALL matches on the day are completed.
 */
export async function POST(request: Request) {
  const { matchId } = await request.json()
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

  const supabase = await createServiceClient()

  // Look up the match to get its IST calendar date
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('match_date, status')
    .eq('id', matchId)
    .single()

  if (matchErr || !match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const matchDay = getMatchDay(match.match_date)

  // Find all matches on this IST day using a UTC window
  // IST day starts at prev-day 18:30 UTC, ends at same-day 18:30 UTC
  const [year, month, day] = matchDay.split('-').map(Number)
  const dayStartUTC = new Date(Date.UTC(year, month - 1, day - 1, 18, 30))
  const dayEndUTC   = new Date(Date.UTC(year, month - 1, day,     18, 30))

  const { data: dayMatches } = await supabase
    .from('matches')
    .select('id, status')
    .gte('match_date', dayStartUTC.toISOString())
    .lt('match_date', dayEndUTC.toISOString())

  const dayMatchIds = (dayMatches ?? []).map((m: any) => m.id)
  const allMatchesCompleted = (dayMatches ?? []).every((m: any) => m.status === 'completed')

  // Get all fantasy teams for this match day
  const { data: teams, error: teamsErr } = await supabase
    .from('fantasy_teams')
    .select('id, user_id, batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id, total_points, is_scored')
    .eq('match_day', matchDay)

  if (teamsErr) return NextResponse.json({ error: teamsErr.message }, { status: 500 })
  if (!teams?.length) return NextResponse.json({ success: true, teamsScored: 0 })

  // Fetch player stats for ALL matches on this day
  const { data: allStats } = await supabase
    .from('player_match_stats')
    .select('player_id, match_id, runs_scored, wickets')
    .in('match_id', dayMatchIds)

  let teamsScored = 0

  for (const team of teams) {
    const playerIds = [
      team.batsman_1_id, team.batsman_2_id,
      team.bowler_1_id, team.bowler_2_id,
      team.flex_player_id,
    ]

    // Upsert one fantasy_scores row per (team, player, match)
    for (const pid of playerIds) {
      const playerMatchStats = (allStats ?? []).filter((s: any) => s.player_id === pid)
      for (const stat of playerMatchStats) {
        const result = calculateFantasyPoints({ runs_scored: stat.runs_scored, wickets: stat.wickets })
        await supabase.from('fantasy_scores').upsert({
          fantasy_team_id: team.id,
          player_id: pid,
          match_id: stat.match_id,
          points_breakdown: result.breakdown,
          total_points: result.total,
        }, { onConflict: 'fantasy_team_id,player_id,match_id' })
      }
    }

    // Recompute total_points from all stored fantasy_scores for this team
    const { data: teamScores } = await supabase
      .from('fantasy_scores')
      .select('total_points')
      .eq('fantasy_team_id', team.id)

    const newTotal = (teamScores ?? []).reduce((sum: number, s: any) => sum + s.total_points, 0)

    await supabase.from('fantasy_teams')
      .update({ total_points: newTotal, is_scored: allMatchesCompleted })
      .eq('id', team.id)

    // Add to user totals only when the full day is done and team not yet scored
    if (allMatchesCompleted && !team.is_scored) {
      const { data: u } = await supabase
        .from('users')
        .select('fantasy_score, total_score')
        .eq('id', team.user_id)
        .single()

      if (u) {
        await supabase.from('users').update({
          fantasy_score: u.fantasy_score + newTotal,
          total_score: u.total_score + newTotal,
        }).eq('id', team.user_id)
      }
      teamsScored++
    }
  }

  return NextResponse.json({ success: true, teamsScored, allMatchesCompleted })
}
