import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateFantasyPoints } from '@/constants/scoring'

/**
 * POST /api/scoring { matchId }
 *
 * Scores ALL fantasy teams for a completed match. Fantasy teams are now
 * season-long (one squad per user per phase), so every team in the current
 * phase earns points from this match.
 */
export async function POST(request: Request) {
  const { matchId } = await request.json()
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

  const supabase = await createServiceClient()

  // Look up the match
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, status')
    .eq('id', matchId)
    .single()

  if (matchErr || !match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  // Determine current phase from fantasy_lock settings
  const { data: lockSettings } = await supabase
    .from('fantasy_lock')
    .select('phase')
    .limit(1)
    .single()

  const phase = lockSettings?.phase ?? 'league'

  // Get all fantasy teams for the current phase
  const { data: teams, error: teamsErr } = await supabase
    .from('fantasy_teams')
    .select('id, user_id, batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id, total_points')
    .eq('phase', phase)

  if (teamsErr) return NextResponse.json({ error: teamsErr.message }, { status: 500 })

  // Fetch player stats for this match
  const { data: matchStats } = await supabase
    .from('player_match_stats')
    .select('player_id, runs_scored, wickets')
    .eq('match_id', matchId)

  // Index stats by player_id for fast lookup
  const statsByPlayer = new Map<string, any>((matchStats ?? []).map((s: any) => [s.player_id, s]))

  let teamsScored = 0

  if (teams?.length && matchStats?.length) for (const team of teams) {
    const playerIds = [
      team.batsman_1_id, team.batsman_2_id,
      team.bowler_1_id, team.bowler_2_id,
      team.flex_player_id,
    ]

    // Upsert fantasy_scores for each player in this match
    for (const pid of playerIds) {
      const stat = statsByPlayer.get(pid)
      if (!stat) continue

      const result = calculateFantasyPoints({ runs_scored: stat.runs_scored, wickets: stat.wickets })
      await supabase.from('fantasy_scores').upsert({
        fantasy_team_id: team.id,
        player_id: pid,
        match_id: matchId,
        points_breakdown: result.breakdown,
        total_points: result.total,
      }, { onConflict: 'fantasy_team_id,player_id,match_id' })
    }

    // Recompute total_points from ALL fantasy_scores for this team
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

    teamsScored++
  }

  // Score predictions — idempotent: runs for all predictions, computes diff so re-running is safe
  const { data: match2 } = await supabase.from('matches').select('match_winner').eq('id', matchId).single()
  if (match2?.match_winner) {
    const { data: preds } = await supabase
      .from('predictions')
      .select('id, user_id, predicted_match_winner, points_earned')
      .eq('match_id', matchId)

    for (const pred of preds ?? []) {
      const newPts = pred.predicted_match_winner === match2.match_winner ? 50 : 0
      const oldPts = pred.points_earned ?? 0
      const diff = newPts - oldPts

      await supabase.from('predictions').update({ points_earned: newPts, is_scored: true }).eq('id', pred.id)

      if (diff !== 0) {
        const { data: u } = await supabase.from('users').select('prediction_score, total_score').eq('id', pred.user_id).single()
        if (u) {
          await supabase.from('users').update({
            prediction_score: (u.prediction_score ?? 0) + diff,
            total_score: (u.total_score ?? 0) + diff,
          }).eq('id', pred.user_id)
        }
      }
    }
  }

  return NextResponse.json({ success: true, teamsScored })
}
