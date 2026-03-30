import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { matchId } = await request.json()
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

  const supabase = createServiceClient()

  // 1. Get fantasy scores for this match (to subtract from user totals)
  const { data: fantasyScores } = await supabase
    .from('fantasy_scores')
    .select('fantasy_team_id, total_points')
    .eq('match_id', matchId)

  // 2. Get predictions for this match (to subtract scored points)
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, user_id, points_earned, is_scored')
    .eq('match_id', matchId)

  // 3. Adjust user fantasy scores for teams affected
  if (fantasyScores?.length) {
    const { data: affectedTeams } = await supabase
      .from('fantasy_teams')
      .select('id, user_id, total_points')
      .in('id', fantasyScores.map((s: any) => s.fantasy_team_id))

    for (const team of affectedTeams ?? []) {
      const matchPts = fantasyScores.filter((s: any) => s.fantasy_team_id === team.id).reduce((sum: number, s: any) => sum + s.total_points, 0)
      const newTeamTotal = Math.max(0, team.total_points - matchPts)
      await supabase.from('fantasy_teams').update({ total_points: newTeamTotal }).eq('id', team.id)

      const { data: u } = await supabase.from('users').select('fantasy_score, total_score').eq('id', team.user_id).single()
      if (u) {
        await supabase.from('users').update({
          fantasy_score: Math.max(0, u.fantasy_score - matchPts),
          total_score: Math.max(0, u.total_score - matchPts),
        }).eq('id', team.user_id)
      }
    }
  }

  // 4. Adjust user prediction scores
  for (const pred of predictions ?? []) {
    if (pred.is_scored && pred.points_earned > 0) {
      const { data: u } = await supabase.from('users').select('prediction_score, total_score').eq('id', pred.user_id).single()
      if (u) {
        await supabase.from('users').update({
          prediction_score: Math.max(0, u.prediction_score - pred.points_earned),
          total_score: Math.max(0, u.total_score - pred.points_earned),
        }).eq('id', pred.user_id)
      }
    }
  }

  // 5. Clear match-specific data
  await Promise.all([
    supabase.from('fantasy_scores').delete().eq('match_id', matchId),
    supabase.from('player_match_stats').delete().eq('match_id', matchId),
    supabase.from('predictions').update({ points_earned: 0, is_scored: false }).eq('match_id', matchId),
  ])

  // 6. Reset match itself
  await supabase.from('matches').update({
    status: 'upcoming',
    match_winner: null,
    sync_status: null,
    sync_error: null,
    synced_at: null,
  }).eq('id', matchId)

  return NextResponse.json({ success: true })
}
