import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractFromNarrative } from '@/lib/scorecard-ai'

export const maxDuration = 60

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { narrative, targetPlayers } = await request.json()
    if (!narrative) {
      return NextResponse.json({ error: 'narrative required' }, { status: 400 })
    }

    const scorecard = await extractFromNarrative(narrative, targetPlayers ?? [])
    return NextResponse.json({ scorecard })
  } catch (err: any) {
    console.error('[extract-scorecard] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
