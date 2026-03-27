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

function generatePassword() {
  return Math.random().toString(36).slice(-8) + 'A1!'
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, display_name, role = 'user' } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const admin = getAdminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: generatePassword(),
    email_confirm: true,
    user_metadata: { full_name: display_name ?? email.split('@')[0] },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (role === 'admin' && data.user) {
    await admin.from('users').update({ role: 'admin' }).eq('id', data.user.id)
  }

  return NextResponse.json({ ok: true, userId: data.user?.id })
}
