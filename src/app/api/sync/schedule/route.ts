import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchIPLSchedule } from '@/lib/cricapi'

export async function POST() {
  try {
    const matches = await fetchIPLSchedule()
    if (!matches.length) return NextResponse.json({ error: 'No matches returned from CricAPI' }, { status: 502 })

    const supabase = await createServiceClient()

    const rows = matches.map(m => {
      const matchDate = new Date(m.matchDate)
      const predDeadline = new Date(matchDate.getTime() - 30 * 60 * 1000)
      const fantasyDeadline = new Date(matchDate.getTime() - 60 * 60 * 1000)

      return {
        cricapi_match_id: m.cricapiMatchId,
        team_a: m.teamA,
        team_b: m.teamB,
        venue: m.venue,
        match_date: matchDate.toISOString(),
        prediction_deadline: predDeadline.toISOString(),
        fantasy_deadline: fantasyDeadline.toISOString(),
        status: m.status,
        toss_winner: m.tossWinner ?? null,
        toss_decision: m.tossDecision ?? null,
        match_winner: m.matchWinner ?? null,
      }
    })

    // Two-pass merge:
    // Pass 1 — find seeded rows (cricapi_match_id IS NULL) matching by team + date (±2 h) and update them.
    // Pass 2 — upsert any remaining rows that didn't match a seeded row.
    const TWO_HOURS = 2 * 60 * 60 * 1000
    const mergedIds: string[] = []
    const toUpsert: typeof rows = []

    for (const row of rows) {
      const matchDate = new Date(row.match_date)

      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .is('cricapi_match_id', null)
        .eq('team_a', row.team_a)
        .eq('team_b', row.team_b)
        .gte('match_date', new Date(matchDate.getTime() - TWO_HOURS).toISOString())
        .lte('match_date', new Date(matchDate.getTime() + TWO_HOURS).toISOString())
        .maybeSingle()

      if (existing) {
        await supabase.from('matches').update(row).eq('id', existing.id)
        mergedIds.push(existing.id)
      } else {
        toUpsert.push(row)
      }
    }

    let upserted = 0
    if (toUpsert.length > 0) {
      const { error, count } = await supabase
        .from('matches')
        .upsert(toUpsert, { onConflict: 'cricapi_match_id', ignoreDuplicates: false })
        .select('id', { count: 'exact', head: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      upserted = count ?? 0
    }

    return NextResponse.json({
      synced: matches.length,
      merged: mergedIds.length,
      upserted,
      sample: rows.slice(0, 5),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
