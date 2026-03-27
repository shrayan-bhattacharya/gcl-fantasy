import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('fantasy_lock').select('*').limit(1).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const supabase = await createClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: admin.id }
  if (typeof body.is_locked === 'boolean') update.is_locked = body.is_locked
  if (body.phase === 'league' || body.phase === 'knockout') update.phase = body.phase

  // Update the single settings row
  const { data, error } = await supabase
    .from('fantasy_lock')
    .update(update)
    .not('id', 'is', null) // matches all rows (there's only one)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
