import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runScoringPipeline } from '@/lib/scoring-pipeline'
import type { ScorecardResult, PlayerStat } from '@/lib/scorecard-ai'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

/**
 * Approves a staged scorecard (with optional admin edits) and applies to production.
 * Reads from `pending_scorecards`, runs the scoring pipeline, marks staged row as approved.
 *
 * Body:
 *   matchId: string
 *   editedPlayers?: PlayerStat[]   // admin's corrected numbers, overrides staged values
 *   editedWinner?: string          // admin's corrected match winner
 */
export async function POST(request: Request) {
  let matchId: string | null = null
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    matchId = body.matchId
    const editedPlayers: PlayerStat[] | undefined = body.editedPlayers
    const editedWinner: string | undefined = body.editedWinner

    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

    const supabase = createServiceClient()

    // Load the staged scorecard
    const { data: pending, error: loadErr } = await supabase
      .from('pending_scorecards')
      .select('*')
      .eq('match_id', matchId)
      .eq('status', 'pending')
      .maybeSingle()

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
    if (!pending) return NextResponse.json({ error: 'No pending scorecard for this match' }, { status: 404 })

    // Apply admin edits on top of staged values
    const finalPlayers: PlayerStat[] = editedPlayers ?? pending.players ?? []
    const finalWinner: string | null = editedWinner ?? pending.proposed_winner

    if (!finalWinner) {
      return NextResponse.json({ error: 'Match winner is required to approve' }, { status: 400 })
    }

    // Build ScorecardResult for the scoring pipeline
    const scorecard: ScorecardResult = {
      match_winner: finalWinner,
      confidence: 'high',  // admin-approved = high confidence
      players: finalPlayers,
      missing: [],
    }

    // Run the actual scoring pipeline (writes to all production tables)
    const pipeline = await runScoringPipeline(matchId, scorecard)

    // Mark staged row as approved
    await supabase
      .from('pending_scorecards')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', pending.id)

    // Mark match as synced
    await supabase.from('matches').update({
      sync_status: 'synced',
      sync_error: null,
      synced_at: new Date().toISOString(),
    }).eq('id', matchId)

    return NextResponse.json({
      ...pipeline,
      matchWinner: finalWinner,
      approved: true,
    })
  } catch (err: any) {
    console.error('[approve-scorecard] error:', err)
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
