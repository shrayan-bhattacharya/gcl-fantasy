import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.CRICAPI_KEY
  if (!key) return NextResponse.json({ error: 'CRICAPI_KEY not set' }, { status: 500 })

  const url = new URL('https://api.cricapi.com/v1/series')
  url.searchParams.set('apikey', key)
  url.searchParams.set('offset', '0')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const json = await res.json()

  if (json.status !== 'success') {
    return NextResponse.json({ error: 'CricAPI error', raw: json }, { status: 502 })
  }

  const series = (json.data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    startDate: s.startDate,
    endDate: s.endDate,
  }))

  return NextResponse.json({ series, total: json.info?.totalRows })
}
