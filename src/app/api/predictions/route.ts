import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { IPLTeam } from '@/types/database.types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { matchId, winner } = body as { matchId?: string; winner?: IPLTeam }

  if (!matchId || !winner) {
    return NextResponse.json({ error: 'matchId and winner are required' }, { status: 400 })
  }

  // Check 1: is the prediction window open?
  const { data: window } = await supabase
    .from('prediction_window')
    .select('is_open')
    .limit(1)
    .single()

  if (!window?.is_open) {
    return NextResponse.json({ error: 'Predictions are closed this week' }, { status: 403 })
  }

  // Check 2: has this individual match's deadline passed?
  const { data: match } = await supabase
    .from('matches')
    .select('prediction_deadline, status')
    .eq('id', matchId)
    .single()

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }
  if (match.status === 'completed') {
    return NextResponse.json({ error: 'This match has already finished' }, { status: 403 })
  }
  if (match.prediction_deadline && new Date() > new Date(match.prediction_deadline)) {
    return NextResponse.json({ error: 'This match has already locked' }, { status: 403 })
  }

  // Both checks passed — upsert via service client
  const service = createServiceClient()
  const { error } = await service.from('predictions').upsert({
    user_id: user.id,
    match_id: matchId,
    predicted_toss_winner: winner,
    predicted_match_winner: winner,
  }, { onConflict: 'user_id,match_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
