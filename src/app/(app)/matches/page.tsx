import { createClient } from '@/lib/supabase/server'
import { MatchesClient } from './MatchesClient'

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: matches }, { data: predictions }, { data: predWindow }] = await Promise.all([
    supabase.from('matches')
      .select('id, team_a, team_b, venue, match_date, status, match_winner, toss_winner, prediction_deadline, fantasy_deadline')
      .order('match_date'),
    supabase.from('predictions')
      .select('id, match_id, predicted_match_winner, predicted_toss_winner, points_earned, is_scored')
      .eq('user_id', user!.id),
    supabase.from('prediction_window').select('is_open, opened_at').limit(1).single(),
  ])

  return (
    <MatchesClient
      matches={matches ?? []}
      userPredictions={predictions ?? []}
      userId={user!.id}
      predictionWindowOpen={predWindow?.is_open ?? true}
      predWindowOpenedAt={predWindow?.opened_at ?? null}
    />
  )
}
