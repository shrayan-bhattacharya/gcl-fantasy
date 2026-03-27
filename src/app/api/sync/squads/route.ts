import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scrapeTeamSquad, scrapeAllSquads } from '@/lib/espn-scraper'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const team: string | undefined = body.team // optional — if omitted, sync all

    const players = team ? await scrapeTeamSquad(team) : await scrapeAllSquads()
    if (!players.length) return NextResponse.json({ error: 'No players returned from ESPN' }, { status: 502 })

    const supabase = await createServiceClient()

    const rows = players.map(p => ({
      espn_player_id: p.espnPlayerId,
      name: p.name,
      team: p.team,
      role: p.role,
      image_url: p.imageUrl ?? null,
      is_active: true,
    }))

    const { error, count } = await supabase
      .from('ipl_players')
      .upsert(rows, { onConflict: 'espn_player_id', ignoreDuplicates: false })
      .select('id', { count: 'exact', head: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ synced: players.length, upserted: count, team: team ?? 'all' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
