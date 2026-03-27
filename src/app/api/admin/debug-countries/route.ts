import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/admin/debug-countries
// Returns every distinct country value stored in ipl_players so we can verify
// what the flag lookup needs to match against.
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ipl_players')
    .select('country, name')
    .order('country')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Distinct values + one example player per value
  const seen = new Map<string, string>()
  for (const row of data ?? []) {
    const key = row.country ?? '(null)'
    if (!seen.has(key)) seen.set(key, row.name)
  }

  const result = Array.from(seen.entries()).map(([country, example]) => ({
    country,
    example,
  }))

  return NextResponse.json({ distinct_country_values: result, total_players: data?.length ?? 0 })
}
