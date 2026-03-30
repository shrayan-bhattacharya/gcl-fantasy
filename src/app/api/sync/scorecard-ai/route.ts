import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runScoringPipeline } from '@/lib/scoring-pipeline'
import type { ScorecardResult } from '@/lib/scorecard-ai'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function POST(request: Request) {
  let matchId: string | null = null
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let scorecard: ScorecardResult | undefined
    ;({ matchId, scorecard } = await request.json())
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })
    if (!scorecard) return NextResponse.json({ error: 'scorecard required — extraction happens client-side' }, { status: 400 })

    const supabase = await createServiceClient()

    if (scorecard.confidence === 'low') {
      await supabase.from('matches').update({
        sync_status: 'failed',
        sync_error: 'Low confidence extraction',
      }).eq('id', matchId)
      return NextResponse.json({
        error: 'Low confidence extraction — check the raw data and retry or enter manually',
        confidence: 'low',
        raw: scorecard,
      }, { status: 422 })
    }

    const pipeline = await runScoringPipeline(matchId, scorecard)

    await supabase.from('matches').update({
      sync_status: 'synced',
      sync_error: null,
      synced_at: new Date().toISOString(),
    }).eq('id', matchId)

    return NextResponse.json({
      ...pipeline,
      matchWinner: scorecard.match_winner,
      confidence: scorecard.confidence,
    })
  } catch (err: any) {
    console.error('[scorecard-ai] error:', err)

    if (matchId) {
      try {
        const supabase = await createServiceClient()
        await supabase.from('matches').update({
          sync_status: 'failed',
          sync_error: err.message?.slice(0, 500),
        }).eq('id', matchId)
      } catch { /* ignore */ }
    }

    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
