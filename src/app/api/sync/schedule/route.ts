import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scrapeIPLSchedule } from '@/lib/espn-scraper'

export async function POST() {
  try {
    const matches = await scrapeIPLSchedule()
    if (!matches.length) return NextResponse.json({ error: 'No matches returned from ESPN' }, { status: 502 })

    const supabase = await createServiceClient()

    const rows = matches.map(m => {
      const matchDate = new Date(m.matchDate)
      const predDeadline = new Date(matchDate.getTime() - 30 * 60 * 1000)
      const fantasyDeadline = new Date(matchDate.getTime() - 60 * 60 * 1000)

      return {
        espn_match_id: m.espnMatchId,
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

    const { error, count } = await supabase
      .from('matches')
      .upsert(rows, { onConflict: 'espn_match_id', ignoreDuplicates: false })
      .select('id', { count: 'exact', head: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ synced: matches.length, upserted: count, sample: rows.slice(0, 5) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
