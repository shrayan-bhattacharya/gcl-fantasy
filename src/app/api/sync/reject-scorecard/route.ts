import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

/** Discards a staged scorecard. Match returns to unsynced state. */
export async function POST(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { matchId } = await request.json()
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

    const supabase = createServiceClient()

    await supabase
      .from('pending_scorecards')
      .update({ status: 'rejected' })
      .eq('match_id', matchId)
      .eq('status', 'pending')

    await supabase.from('matches').update({
      sync_status: null,
      sync_error: null,
    }).eq('id', matchId)

    return NextResponse.json({ rejected: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
