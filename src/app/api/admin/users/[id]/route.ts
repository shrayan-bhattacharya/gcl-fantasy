import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { role } = await req.json()

  const admin = getAdminClient()
  const { error } = await admin.from('users').update({ role }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }, { status: 500 })
  }

  const { id } = await params
  const admin = getAdminClient()

  // Explicitly delete from public.users first so all FK-cascading child rows
  // (predictions, fantasy_teams, fantasy_scores) are removed regardless of
  // whether the auth.users → public.users FK has ON DELETE CASCADE.
  const { error: dbErr } = await admin.from('users').delete().eq('id', id)
  if (dbErr) return NextResponse.json({ error: `Profile delete failed: ${dbErr.message}` }, { status: 400 })

  // Delete from auth.users
  const { error: authErr } = await admin.auth.admin.deleteUser(id)
  if (authErr) return NextResponse.json({ error: `Auth delete failed: ${authErr.message}` }, { status: 400 })

  return NextResponse.json({ ok: true })
}
