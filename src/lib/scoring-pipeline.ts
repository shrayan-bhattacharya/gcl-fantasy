import { createServiceClient } from '@/lib/supabase/server'
import { calculateFantasyPoints } from '@/constants/scoring'
import type { ScorecardResult } from '@/lib/scorecard-ai'

export interface PipelineResult {
  statsUpserted: number
  fantasyTeamsScored: number
  unmatched: string[]
}

export async function runScoringPipeline(
  matchId: string,
  scorecard: ScorecardResult,
): Promise<PipelineResult> {
  const supabase = createServiceClient()
  const { match_winner, toss_winner, toss_decision } = scorecard
  const players = Array.isArray(scorecard.players) ? scorecard.players : []

  // 1. Update match result
  const matchUpdate: Record<string, unknown> = {}
  if (match_winner) { matchUpdate.match_winner = match_winner; matchUpdate.status = 'completed' }
  if (toss_winner) matchUpdate.toss_winner = toss_winner
  if (toss_decision) matchUpdate.toss_decision = toss_decision
  if (Object.keys(matchUpdate).length) {
    await supabase.from('matches').update(matchUpdate).eq('id', matchId)
  }

  // 2. Build name → player UUID map (load all active players once)
  const { data: dbPlayers } = await supabase
    .from('ipl_players')
    .select('id, name')
    .eq('is_active', true)

  const nameMap = new Map<string, string>()
  for (const p of dbPlayers ?? []) {
    nameMap.set(p.name.toLowerCase().trim(), p.id)
  }

  function findPlayerId(name: string): string | null {
    const normalized = name.toLowerCase().trim()
    if (nameMap.has(normalized)) return nameMap.get(normalized)!
    // Partial match: check if DB name contains the search name or vice versa
    for (const [dbName, id] of nameMap.entries()) {
      if (dbName.includes(normalized) || normalized.includes(dbName)) return id
    }
    return null
  }

  // 3. Build stat rows
  const statRows: Record<string, unknown>[] = []
  const unmatched: string[] = []

  for (const p of players) {
    const playerId = findPlayerId(p.name)
    if (!playerId) { unmatched.push(p.name); continue }
    statRows.push({
      player_id: playerId,
      match_id: matchId,
      runs_scored: p.runs ?? 0,
      balls_faced: p.balls_faced ?? 0,
      fours: p.fours ?? 0,
      sixes: p.sixes ?? 0,
      wickets: p.wickets ?? 0,
      economy_rate: p.economy_rate || null,
      catches: p.catches ?? 0,
      stumpings: p.stumpings ?? 0,
      run_outs: p.run_outs ?? 0,
    })
  }

  if (statRows.length) {
    await supabase
      .from('player_match_stats')
      .upsert(statRows, { onConflict: 'player_id,match_id' })
  }

  // 4. Fantasy team scoring
  const { data: lockSettings } = await supabase
    .from('fantasy_lock').select('phase').limit(1).single()
  const phase = lockSettings?.phase ?? 'league'

  const { data: fantasyTeams } = await supabase
    .from('fantasy_teams')
    .select('id, user_id, batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id, total_points')
    .eq('phase', phase)

  let fantasyTeamsScored = 0
  const statsByPlayer = new Map(statRows.map((s: any) => [s.player_id, s]))

  for (const team of fantasyTeams ?? []) {
    const playerIds = [
      team.batsman_1_id, team.batsman_2_id,
      team.bowler_1_id, team.bowler_2_id,
      team.flex_player_id,
    ]

    for (const pid of playerIds) {
      if (!pid) continue
      const stat = statsByPlayer.get(pid) as any
      if (!stat) continue
      const { total, breakdown } = calculateFantasyPoints({
        runs_scored: stat.runs_scored,
        wickets: stat.wickets,
      })
      await supabase.from('fantasy_scores').upsert({
        fantasy_team_id: team.id,
        player_id: pid,
        match_id: matchId,
        points_breakdown: breakdown,
        total_points: total,
      }, { onConflict: 'fantasy_team_id,player_id,match_id' })
    }

    const { data: teamScores } = await supabase
      .from('fantasy_scores').select('total_points').eq('fantasy_team_id', team.id)
    const newTotal = (teamScores ?? []).reduce((sum: number, s: any) => sum + s.total_points, 0)
    const diff = newTotal - (team.total_points ?? 0)

    await supabase.from('fantasy_teams').update({ total_points: newTotal }).eq('id', team.id)

    if (diff !== 0) {
      const { data: u } = await supabase
        .from('users').select('fantasy_score, total_score').eq('id', team.user_id).single()
      if (u) {
        await supabase.from('users').update({
          fantasy_score: u.fantasy_score + diff,
          total_score: u.total_score + diff,
        }).eq('id', team.user_id)
      }
    }
    fantasyTeamsScored++
  }

  // 5. Score predictions
  if (match_winner) {
    const { data: preds } = await supabase
      .from('predictions')
      .select('id, user_id, predicted_match_winner')
      .eq('match_id', matchId)
      .eq('is_scored', false)

    for (const pred of preds ?? []) {
      const pts = pred.predicted_match_winner === match_winner ? 50 : 0
      await supabase.from('predictions')
        .update({ points_earned: pts, is_scored: true }).eq('id', pred.id)
      if (pts > 0) {
        const { data: u } = await supabase
          .from('users').select('prediction_score, total_score').eq('id', pred.user_id).single()
        if (u) {
          await supabase.from('users').update({
            prediction_score: u.prediction_score + pts,
            total_score: u.total_score + pts,
          }).eq('id', pred.user_id)
        }
      }
    }
  }

  return { statsUpserted: statRows.length, fantasyTeamsScored, unmatched }
}
