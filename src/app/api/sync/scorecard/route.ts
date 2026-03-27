import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scrapeMatchScorecard } from '@/lib/espn-scraper'
import { calculateFantasyPoints } from '@/constants/scoring'

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

    // ── Fantasy scoring (season-long squads) ──────────────────────────────

    // Determine current phase
    const { data: lockSettings } = await supabase
      .from('fantasy_lock')
      .select('phase')
      .limit(1)
      .single()

    const phase = lockSettings?.phase ?? 'league'

    // Get ALL fantasy teams for the current phase
    const { data: fantasyTeams } = await supabase
      .from('fantasy_teams')
      .select('id, user_id, batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id, total_points')
      .eq('phase', phase)

    let fantasyTeamsScored = 0

    if (fantasyTeams?.length) {
      // Index the just-upserted stats by player_id for this match
      const statsByPlayer = new Map(
        statRows.filter(Boolean).map((s: any) => [s.player_id, s])
      )

      for (const team of fantasyTeams) {
        const playerIds = [
          team.batsman_1_id, team.batsman_2_id,
          team.bowler_1_id, team.bowler_2_id,
          team.flex_player_id,
        ]

        for (const pid of playerIds) {
          const stat = statsByPlayer.get(pid)
          if (!stat) continue

          const { total, breakdown } = calculateFantasyPoints({ runs_scored: stat.runs_scored, wickets: stat.wickets })
          await supabase.from('fantasy_scores').upsert({
            fantasy_team_id: team.id,
            player_id: pid,
            match_id: matchId,
            points_breakdown: breakdown,
            total_points: total,
          }, { onConflict: 'fantasy_team_id,player_id,match_id' })
        }

        // Recompute total from all stored scores for this team
        const { data: teamScores } = await supabase
          .from('fantasy_scores')
          .select('total_points')
          .eq('fantasy_team_id', team.id)

        const newTotal = (teamScores ?? []).reduce((sum: number, s: any) => sum + s.total_points, 0)
        const diff = newTotal - team.total_points

        await supabase.from('fantasy_teams')
          .update({ total_points: newTotal })
          .eq('id', team.id)

        // Update user totals immediately
        if (diff !== 0) {
          const { data: u } = await supabase
            .from('users')
            .select('fantasy_score, total_score')
            .eq('id', team.user_id)
            .single()

          if (u) {
            await supabase.from('users').update({
              fantasy_score: u.fantasy_score + diff,
              total_score: u.total_score + diff,
            }).eq('id', team.user_id)
          }
        }
        fantasyTeamsScored++
      }
    }

    return NextResponse.json({ statsUpserted: statRows.length, fantasyTeamsScored, playerStats: statRows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
