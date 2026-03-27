import { createClient } from '@/lib/supabase/server'
import { LeaderboardClient } from './LeaderboardClient'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, total_score, prediction_score, fantasy_score')
    .order('total_score', { ascending: false })

  return <LeaderboardClient users={users ?? []} currentUserId={user!.id} />
}
