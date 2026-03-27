import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchTeamSquad, fetchAllSquads } from '@/lib/cricapi'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const team: string | undefined = body.team

    const players = team ? await fetchTeamSquad(team) : await fetchAllSquads()
    if (!players.length) return NextResponse.json({ error: 'No players returned from CricAPI' }, { status: 502 })

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

    return NextResponse.json({ synced: players.length, upserted: count, team: team ?? 'all', sample: rows.slice(0, 5) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
