import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scrapeMatchScorecard } from '@/lib/espn-scraper'
import { calculateFantasyPoints } from '@/constants/scoring'
import { getMatchDay } from '@/lib/utils'

export async function POST(request: Request) {
  try {
    const { espnMatchId, matchId } = await request.json()
    if (!espnMatchId || !matchId) {
      return NextResponse.json({ error: 'espnMatchId and matchId required' }, { status: 400 })
    }

    const stats = await scrapeMatchScorecard(Number(espnMatchId))
    if (!stats.length) return NextResponse.json({ error: 'No scorecard data from ESPN' }, { status: 502 })

    const supabase = await createServiceClient()

    // Build espnPlayerId → DB player UUID map
    const espnIds = stats.map(s => s.espnPlayerId)
    const { data: players, error: pErr } = await supabase
      .from('ipl_players')
      .select('id, espn_player_id')
      .in('espn_player_id', espnIds)

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    const playerIdMap = new Map<number, string>(
      (players ?? []).map((p: any) => [p.espn_player_id, p.id])
    )

    // Upsert player_match_stats
    const statRows = stats
      .map(s => {
        const playerId = playerIdMap.get(s.espnPlayerId)
        if (!playerId) return null
        return {
          player_id: playerId,
          match_id: matchId,
          runs_scored: s.runsScored,
          balls_faced: s.ballsFaced,
          fours: s.fours,
          sixes: s.sixes,
          wickets: s.wickets,
          economy_rate: s.economyRate,
          catches: s.catches,
          stumpings: s.stumpings,
          run_outs: s.runOuts,
        }
      })
      .filter(Boolean)

    const { error: statsErr } = await supabase
      .from('player_match_stats')
      .upsert(statRows, { onConflict: 'player_id,match_id' })

    if (statsErr) return NextResponse.json({ error: statsErr.message }, { status: 500 })

    // ── Fantasy scoring (per match_day, not per match_id) ────────────────────

    // Get this match's IST date and all matches on that day
    const { data: thisMatch } = await supabase
      .from('matches')
      .select('match_date, status')
      .eq('id', matchId)
      .single()

    if (!thisMatch) return NextResponse.json({ statsUpserted: statRows.length, fantasyTeamsScored: 0 })

    const matchDay = getMatchDay(thisMatch.match_date)
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

    // Fantasy teams for this day
    const { data: fantasyTeams } = await supabase
      .from('fantasy_teams')
      .select('id, user_id, batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id, is_scored')
      .eq('match_day', matchDay)

    let fantasyTeamsScored = 0

    if (fantasyTeams?.length) {
      // All player stats across all day's matches
      const { data: allDayStats } = await supabase
        .from('player_match_stats')
        .select('player_id, match_id, runs_scored, wickets')
        .in('match_id', dayMatchIds)

      for (const team of fantasyTeams) {
        const playerIds = [
          team.batsman_1_id, team.batsman_2_id,
          team.bowler_1_id, team.bowler_2_id,
          team.flex_player_id,
        ]

        // Upsert one fantasy_scores row per (team, player, match)
        for (const pid of playerIds) {
          const playerMatchStats = (allDayStats ?? []).filter((s: any) => s.player_id === pid)
          for (const stat of playerMatchStats) {
            const { total, breakdown } = calculateFantasyPoints(stat as any)
            await supabase.from('fantasy_scores').upsert({
              fantasy_team_id: team.id,
              player_id: pid,
              match_id: stat.match_id,
              points_breakdown: breakdown,
              total_points: total,
            }, { onConflict: 'fantasy_team_id,player_id,match_id' })
          }
        }

        // Recompute total from all stored scores for this team
        const { data: teamScores } = await supabase
          .from('fantasy_scores')
          .select('total_points')
          .eq('fantasy_team_id', team.id)

        const newTotal = (teamScores ?? []).reduce((sum: number, s: any) => sum + s.total_points, 0)

        await supabase.from('fantasy_teams')
          .update({ total_points: newTotal, is_scored: allMatchesCompleted })
          .eq('id', team.id)

        // Update user totals only once — when the full day is done
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
          fantasyTeamsScored++
        }
      }
    }

    return NextResponse.json({ statsUpserted: statRows.length, fantasyTeamsScored })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
