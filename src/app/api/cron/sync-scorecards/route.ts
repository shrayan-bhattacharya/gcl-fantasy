import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { searchScorecard, extractFromNarrative } from '@/lib/scorecard-ai'
import { runScoringPipeline } from '@/lib/scoring-pipeline'

export async function GET(request: Request) {
  // Vercel sends Authorization: Bearer <CRON_SECRET> automatically for cron jobs
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()

  // Find matches that started 4+ hours ago and haven't been successfully synced
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, team_a, team_b, match_date, sync_status')
    .lte('match_date', fourHoursAgo)
    .neq('status', 'completed')
    .or('sync_status.is.null,sync_status.eq.failed')
    .order('match_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!matches?.length) {
    return NextResponse.json({ message: 'No matches pending sync', processed: 0 })
  }

  const results = { processed: 0, synced: 0, failed: 0, skipped: 0 }

  for (const match of matches) {
    results.processed++
    try {
      // Resolve target players from fantasy teams for these match teams
      const { data: fantasyTeams } = await supabase
        .from('fantasy_teams')
        .select('batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id')
      const pickedIds = [...new Set(
        (fantasyTeams ?? []).flatMap((t: any) => [t.batsman_1_id, t.batsman_2_id, t.bowler_1_id, t.bowler_2_id, t.flex_player_id]).filter(Boolean)
      )]
      const { data: pickedPlayers } = pickedIds.length
        ? await supabase.from('ipl_players').select('name, team').in('id', pickedIds).in('team', [match.team_a, match.team_b])
        : { data: [] }
      const targetPlayers = (pickedPlayers ?? []).map((p: any) => ({ name: p.name, team: p.team }))

      const narrative = await searchScorecard(match.team_a, match.team_b, match.match_date, targetPlayers)
      const scorecard = await extractFromNarrative(narrative, targetPlayers)

      if (scorecard.confidence === 'low') {
        await supabase.from('matches').update({
          sync_status: 'failed',
          sync_error: 'Claude returned low confidence — manual retry needed',
        }).eq('id', match.id)
        results.skipped++
        continue
      }

      await runScoringPipeline(match.id, scorecard)

      await supabase.from('matches').update({
        sync_status: 'synced',
        sync_error: null,
        synced_at: new Date().toISOString(),
      }).eq('id', match.id)

      results.synced++
    } catch (err: any) {
      console.error(`[cron] Failed to sync match ${match.id} (${match.team_a} vs ${match.team_b}):`, err.message)
      await supabase.from('matches').update({
        sync_status: 'failed',
        sync_error: err.message?.slice(0, 500) ?? 'Unknown error',
      }).eq('id', match.id)
      results.failed++
    }
  }

  return NextResponse.json(results)
}
