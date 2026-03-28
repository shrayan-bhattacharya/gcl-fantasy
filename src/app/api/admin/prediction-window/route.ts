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

  const { data, error } = await supabase.from('prediction_window').select('*').limit(1).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    if (typeof body.is_open !== 'boolean') {
      return NextResponse.json({ error: 'is_open must be boolean' }, { status: 400 })
    }

    const supabase = await createClient()
    const now = new Date().toISOString()

    const update: Record<string, unknown> = {
      is_open: body.is_open,
      updated_at: now,
      opened_by: admin.id,
    }
    if (body.is_open) {
      update.opened_at = now
    }

    const { data, error } = await supabase
      .from('prediction_window')
      .update(update)
      .not('id', 'is', null)
      .select()
      .single()

    if (error) {
      console.error('prediction-window supabase error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('prediction-window error:', msg, err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
