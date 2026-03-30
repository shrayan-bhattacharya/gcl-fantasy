import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchTeamSquad, fetchAllSquads, type CricAPIPlayerRow } from '@/lib/cricapi'

function completeness(p: CricAPIPlayerRow): number {
  return (p.imageUrl ? 2 : 0) + (p.country ? 1 : 0)
}

function dedupeByName(raw: CricAPIPlayerRow[]): { players: CricAPIPlayerRow[]; duplicates: { name: string; ids: string[] }[] } {
  const byName = new Map<string, CricAPIPlayerRow>()
  const duplicates: { name: string; ids: string[] }[] = []
  for (const p of raw) {
    const existing = byName.get(p.name)
    if (!existing) {
      byName.set(p.name, p)
    } else {
      const dup = duplicates.find(d => d.name === p.name)
      if (dup) dup.ids.push(p.cricapiPlayerId)
      else duplicates.push({ name: p.name, ids: [existing.cricapiPlayerId, p.cricapiPlayerId] })
      if (completeness(p) > completeness(existing)) byName.set(p.name, p)
    }
  }
  return { players: Array.from(byName.values()), duplicates }
}

async function upsertPlayers(players: CricAPIPlayerRow[]) {
  const supabase = createServiceClient()
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
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: false })
    .select('id', { count: 'exact', head: true })
  return { error, count, rows }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const team: string | undefined = body.team
    const reset: boolean = body.reset === true

    const supabase = createServiceClient()

    if (reset) {
      // Full reset: wipe ipl_players cascade then re-sync all squads
      const { error: truncErr } = await supabase.rpc('truncate_players_cascade')
      if (truncErr) return NextResponse.json({ error: `Truncate failed: ${truncErr.message}` }, { status: 500 })
    }

    const raw = team ? await fetchTeamSquad(team) : await fetchAllSquads()
    if (!raw.length) return NextResponse.json({ error: 'No players returned from CricAPI' }, { status: 502 })

    const { players, duplicates } = dedupeByName(raw)
    const { error, count, rows } = await upsertPlayers(players)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      raw: raw.length,
      deduped: players.length,
      upserted: count,
      team: team ?? 'all',
      duplicates,
      reset,
      sample: rows.slice(0, 5),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
