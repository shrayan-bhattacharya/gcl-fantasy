import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { ScorecardResult } from '@/lib/scorecard-ai'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

/**
 * Stages the AI-extracted scorecard to `pending_scorecards`.
 * Does NOT touch production tables — admin must review and approve.
 */
export async function POST(request: Request) {
  let matchId: string | null = null
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let scorecard: ScorecardResult | undefined
    ;({ matchId, scorecard } = await request.json())
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })
    if (!scorecard) return NextResponse.json({ error: 'scorecard required' }, { status: 400 })

    const supabase = createServiceClient()

    // Upsert proposed scorecard into staging (one pending per match)
    const { error: stageErr } = await supabase
      .from('pending_scorecards')
      .upsert({
        match_id: matchId,
        proposed_winner: scorecard.match_winner,
        confidence: scorecard.confidence,
        players: scorecard.players ?? [],
        missing: scorecard.missing ?? [],
        status: 'pending',
        approved_at: null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'match_id' })

    if (stageErr) {
      console.error('[scorecard-ai] stage error:', stageErr)
      return NextResponse.json({ error: stageErr.message }, { status: 500 })
    }

    // Mark sync_status as 'staged' so the UI knows there's a pending review
    await supabase.from('matches').update({
      sync_status: 'staged',
      sync_error: scorecard.confidence === 'low' ? 'Low confidence — review before approving' : null,
    }).eq('id', matchId)

    return NextResponse.json({
      staged: true,
      matchId,
      proposed_winner: scorecard.match_winner,
      confidence: scorecard.confidence,
      players: scorecard.players,
      missing: scorecard.missing,
    })
  } catch (err: any) {
    console.error('[scorecard-ai] error:', err)
    if (matchId) {
      try {
        const supabase = createServiceClient()
        await supabase.from('matches').update({
          sync_status: 'failed',
          sync_error: err.message?.slice(0, 500),
        }).eq('id', matchId)
      } catch { /* ignore */ }
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
