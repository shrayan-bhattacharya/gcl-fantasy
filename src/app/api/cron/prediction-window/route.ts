import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 10

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'open'
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  if (action === 'open') {
    const { error } = await supabase
      .from('prediction_window')
      .update({ is_open: true, opened_at: now, updated_at: now })
      .not('id', 'is', null)

    if (error) {
      console.error('[cron/prediction-window] open error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.log('[cron/prediction-window] opened at', now)
    return NextResponse.json({ ok: true, action: 'open' })
  }

  if (action === 'close') {
    // Only close if a match is starting within the next 90 minutes
    const in90min = new Date(Date.now() + 90 * 60 * 1000).toISOString()
    const { data: upcomingMatch } = await supabase
      .from('matches')
      .select('id, match_date')
      .eq('status', 'upcoming')
      .gte('match_date', now)
      .lte('match_date', in90min)
      .limit(1)
      .maybeSingle()

    if (!upcomingMatch) {
      return NextResponse.json({ ok: true, action: 'close', skipped: true, reason: 'no match in next 90min' })
    }

    const { error } = await supabase
      .from('prediction_window')
      .update({ is_open: false, updated_at: now })
      .not('id', 'is', null)

    if (error) {
      console.error('[cron/prediction-window] close error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.log('[cron/prediction-window] closed for match', upcomingMatch.id, 'at', now)
    return NextResponse.json({ ok: true, action: 'close', matchId: upcomingMatch.id })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
