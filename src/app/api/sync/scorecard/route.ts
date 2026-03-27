import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchScorecard } from '@/lib/cricapi'
import { calculateFantasyPoints } from '@/constants/scoring'

export async function POST(request: Request) {
  try {
    const { cricapiMatchId, matchId } = await request.json()
    if (!cricapiMatchId || !matchId) {
      return NextResponse.json({ error: 'cricapiMatchId and matchId required' }, { status: 400 })
    }

    const { stats, matchWinner, tossWinner, tossDecision } = await fetchScorecard(String(cricapiMatchId))
    if (!stats.length) return NextResponse.json({ error: 'No scorecard data from CricAPI' }, { status: 502 })

    const supabase = await createServiceClient()

    // Update match result fields if we got them from the scorecard
    if (matchWinner || tossWinner) {
      await supabase.from('matches').update({
        ...(matchWinner ? { match_winner: matchWinner, status: 'completed' } : {}),
        ...(tossWinner ? { toss_winner: tossWinner } : {}),
        ...(tossDecision ? { toss_decision: tossDecision } : {}),
      }).eq('id', matchId)
    }

    // Build cricapiPlayerId → DB player UUID map
    const cricapiIds = stats.map(s => s.cricapiPlayerId)
    const { data: players, error: pErr } = await supabase
      .from('ipl_players')
      .select('id, cricapi_player_id')
      .in('cricapi_player_id', cricapiIds)

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    const playerIdMap = new Map<string, string>(
      (players ?? []).map((p: any) => [p.cricapi_player_id, p.id])
    )

    // Upsert player_match_stats
    const statRows = stats
      .map(s => {
        const playerId = playerIdMap.get(s.cricapiPlayerId)
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

    const { data: lockSettings } = await supabase
      .from('fantasy_lock')
      .select('phase')
      .limit(1)
      .single()

    const phase = lockSettings?.phase ?? 'league'

    const { data: fantasyTeams } = await supabase
      .from('fantasy_teams')
      .select('id, user_id, batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id, total_points')
      .eq('phase', phase)

    let fantasyTeamsScored = 0

    if (fantasyTeams?.length) {
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

        const { data: teamScores } = await supabase
          .from('fantasy_scores')
          .select('total_points')
          .eq('fantasy_team_id', team.id)

        const newTotal = (teamScores ?? []).reduce((sum: number, s: any) => sum + s.total_points, 0)
        const diff = newTotal - team.total_points

        await supabase.from('fantasy_teams')
          .update({ total_points: newTotal })
          .eq('id', team.id)

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

    return NextResponse.json({
      statsUpserted: statRows.length,
      fantasyTeamsScored,
      matchWinner,
      tossWinner,
      unmatchedPlayers: stats.length - statRows.length,
      playerStats: statRows,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
