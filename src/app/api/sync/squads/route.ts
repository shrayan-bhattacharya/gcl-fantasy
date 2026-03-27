import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchTeamSquad, fetchAllSquads, type CricAPIPlayerRow } from '@/lib/cricapi'

function completeness(p: CricAPIPlayerRow): number {
  return (p.imageUrl ? 2 : 0) + (p.country ? 1 : 0)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const team: string | undefined = body.team

    const raw = team ? await fetchTeamSquad(team) : await fetchAllSquads()
    if (!raw.length) return NextResponse.json({ error: 'No players returned from CricAPI' }, { status: 502 })

    // Deduplicate by name — CricAPI can return the same player with different UUIDs
    // across squad entries. Keep the most complete entry (has image > has country).
    const byName = new Map<string, CricAPIPlayerRow>()
    const duplicates: { name: string; ids: string[] }[] = []
    for (const p of raw) {
      const existing = byName.get(p.name)
      if (!existing) {
        byName.set(p.name, p)
      } else {
        // Track for logging
        const dup = duplicates.find(d => d.name === p.name)
        if (dup) dup.ids.push(p.cricapiPlayerId)
        else duplicates.push({ name: p.name, ids: [existing.cricapiPlayerId, p.cricapiPlayerId] })
        // Keep whichever is more complete
        if (completeness(p) > completeness(existing)) byName.set(p.name, p)
      }
    }
    const players = Array.from(byName.values())

    const supabase = await createServiceClient()

    const rows = players.map(p => ({
      cricapi_player_id: p.cricapiPlayerId,
      name: p.name,
      team: p.team,
      role: p.role,
      image_url: p.imageUrl ?? null,
      country: p.country,
      is_active: true,
    }))

    const { error, count } = await supabase
      .from('ipl_players')
      .upsert(rows, { onConflict: 'cricapi_player_id', ignoreDuplicates: false })
      .select('id', { count: 'exact', head: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      raw: raw.length,
      deduped: players.length,
      upserted: count,
      team: team ?? 'all',
      duplicates,
      sample: rows.slice(0, 5),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
