import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { extractScorecard } from '@/lib/scorecard-ai'
import { runScoringPipeline } from '@/lib/scoring-pipeline'

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

    ;({ matchId } = await request.json())
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

    const supabase = await createServiceClient()

    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('id, team_a, team_b, match_date')
      .eq('id', matchId)
      .single()

    if (matchErr || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Mark as in-progress so UI can reflect it
    await supabase.from('matches').update({ sync_status: null, sync_error: null }).eq('id', matchId)

    const scorecard = await extractScorecard(match.team_a, match.team_b, match.match_date)
    console.log('[scorecard-ai] extracted:', JSON.stringify({ winner: scorecard.match_winner, confidence: scorecard.confidence, playerCount: scorecard.players?.length ?? 0 }))

    if (scorecard.confidence === 'low') {
      await supabase.from('matches').update({
        sync_status: 'failed',
        sync_error: 'Claude returned low confidence',
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
      raw: scorecard,
    })
  } catch (err: any) {
    console.error('[scorecard-ai] error:', err)

    // Best-effort: mark as failed
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
