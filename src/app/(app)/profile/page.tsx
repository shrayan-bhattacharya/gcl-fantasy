import { createClient } from '@/lib/supabase/server'
import { PageWrapper, AnimatedSection } from '@/components/layout/PageWrapper'
import { Card, CardBody } from '@/components/ui/Card'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { CompactPlayerCard } from '@/components/ui/PlayerCard'
import { formatMatchDate } from '@/lib/utils'
import { User, Target, Zap, Trophy } from 'lucide-react'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: predictions }, { data: fantasyTeams }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user!.id).single(),
    supabase.from('predictions').select('*, matches(team_a,team_b,match_date,match_winner,status)').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('fantasy_teams').select('*, batsman_1:ipl_players!batsman_1_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate), batsman_2:ipl_players!batsman_2_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate), bowler_1:ipl_players!bowler_1_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate), bowler_2:ipl_players!bowler_2_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate), flex:ipl_players!flex_player_id(id,name,team,role,image_url,country,career_runs,career_wickets,strike_rate,economy_rate)').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(10),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctPredictions = predictions?.filter((p: any) => p.matches?.match_winner === p.predicted_match_winner).length ?? 0
  const totalPredictions = predictions?.length ?? 0
  const accuracy = totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0

  return (
    <PageWrapper title="Profile" subtitle="Your season stats and history">
      {/* Profile card */}
      <AnimatedSection className="mb-5">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-neon-green/20 border-2 border-neon-green/40 flex items-center justify-center text-2xl font-black text-neon-green">
              {(profile?.display_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {profile?.display_name ?? user?.email?.split('@')[0]}
              </h2>
              <p className="text-sm text-dark-muted">{user?.email}</p>
              <p className="text-xs text-dark-muted mt-1">
                Member since {new Date(profile?.created_at ?? '').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-lg text-xs font-bold ${profile?.role === 'admin' ? 'bg-neon-orange/20 text-neon-orange border border-neon-orange/30' : 'bg-neon-green/10 text-neon-green border border-neon-green/20'}`}>
              {profile?.role === 'admin' ? '⚡ Admin' : '🏏 Player'}
            </div>
          </div>
        </Card>
      </AnimatedSection>

      {/* Stats row */}
      <AnimatedSection className="mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Points', value: profile?.total_score ?? 0, icon: Trophy, color: '#ffd700' },
            { label: 'Prediction Pts', value: profile?.prediction_score ?? 0, icon: Target, color: '#39ff14' },
            { label: 'Fantasy Pts', value: profile?.fantasy_score ?? 0, icon: Zap, color: '#00e5ff' },
            { label: 'Pred. Accuracy', value: `${accuracy}%`, icon: User, color: '#ff6b1a' },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-4 border border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-dark-muted">{s.label}</span>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <p className="text-xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </AnimatedSection>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Prediction history */}
        <AnimatedSection>
          <h3 className="text-sm font-bold text-white mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Prediction History ({correctPredictions}/{totalPredictions} correct)
          </h3>
          <Card>
            <CardBody className="p-0 divide-y divide-white/5">
              {predictions?.slice(0, 10).map((pred: any) => {
                const match = pred.matches as any
                const isCorrect = match?.match_winner === pred.predicted_match_winner
                const isDone = match?.status === 'completed'
                return (
                  <div key={pred.id} className="flex items-center gap-3 px-4 py-3">
                    {match && <TeamLogo team={match.team_a} size="xs" />}
                    <span className="text-xs text-dark-muted">vs</span>
                    {match && <TeamLogo team={match.team_b} size="xs" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white">Picked: <strong>{pred.predicted_match_winner}</strong></p>
                      {match && <p className="text-[10px] text-dark-muted">{formatMatchDate(match.match_date)}</p>}
                    </div>
                    {isDone ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${isCorrect ? 'bg-neon-green/10 text-neon-green' : 'bg-red-500/10 text-red-400'}`}>
                        {isCorrect ? `+${pred.points_earned}` : '✗'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-dark-muted">Pending</span>
                    )}
                  </div>
                )
              })}
              {(!predictions || predictions.length === 0) && (
                <div className="px-4 py-8 text-center text-dark-muted text-sm">No predictions yet</div>
              )}
            </CardBody>
          </Card>
        </AnimatedSection>

        {/* Fantasy team history */}
        <AnimatedSection>
          <h3 className="text-sm font-bold text-white mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Fantasy Teams
          </h3>
          <div className="space-y-3">
            {fantasyTeams?.map((ft: any) => {
              const players = [ft.batsman_1, ft.batsman_2, ft.bowler_1, ft.bowler_2, ft.flex].filter(Boolean) as any[]
              return (
                <Card key={ft.id} className="overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                      ft.phase === 'league'
                        ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                        : 'bg-neon-gold/10 text-neon-gold border border-neon-gold/20'
                    }`}>
                      {ft.phase === 'league' ? 'League Stage' : 'Knockout Stage'}
                    </span>
                    {ft.total_points > 0 && (
                      <span className="text-xs font-bold text-neon-gold">{ft.total_points} pts</span>
                    )}
                  </div>
                  <CardBody className="py-2 px-2 space-y-1.5">
                    {players.map((p: any, i: number) => (
                      <CompactPlayerCard key={i} player={p} showStats />
                    ))}
                  </CardBody>
                </Card>
              )
            })}
            {(!fantasyTeams || fantasyTeams.length === 0) && (
              <Card className="p-6 text-center text-dark-muted text-sm">No fantasy teams yet</Card>
            )}
          </div>
        </AnimatedSection>
      </div>
    </PageWrapper>
  )
}
