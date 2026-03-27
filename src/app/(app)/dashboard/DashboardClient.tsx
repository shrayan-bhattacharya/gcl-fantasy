'use client'

import { motion, useMotionValue, useSpring, useTransform, type Variants } from 'framer-motion'
import { useEffect } from 'react'
import { PageWrapper, AnimatedSection } from '@/components/layout/PageWrapper'
import { GettingStarted } from '@/components/ui/GettingStarted'
import { Card, CardBody } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { IPL_TEAMS, ROLE_COLORS, ROLE_ICONS, ROLE_LABELS } from '@/constants/ipl'
import { formatMatchDate, ordinal } from '@/lib/utils'
import { CompactPlayerCard } from '@/components/ui/PlayerCard'
import Link from 'next/link'
import { Trophy, Target, Zap, TrendingUp, ArrowRight, Calendar, Lock } from 'lucide-react'
import type { Database } from '@/types/database.types'

type UserRow = Database['public']['Tables']['users']['Row']
type MatchRow = Database['public']['Tables']['matches']['Row']

interface Props {
  profile: UserRow | null
  rank: number
  upcomingMatches: MatchRow[]
  recentPredictions: any[]
  leaderboardTop: any[]
  currentUserId: string
  latestFantasyTeam: any
  totalPredictions: number
  totalMatches: number
  isFantasyLocked: boolean
}

// Count-up animation component
function AnimatedNumber({ value, suffix, prefix }: { value: number; suffix?: string; prefix?: string }) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { duration: 1200, bounce: 0 })
  const display = useTransform(spring, n => Math.round(n).toLocaleString())

  useEffect(() => {
    mv.set(value)
  }, [mv, value])

  return (
    <span>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix && <span className="text-sm font-medium text-dark-muted ml-1">{suffix}</span>}
    </span>
  )
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 250, damping: 25 } },
}

export function DashboardClient({ profile, rank, upcomingMatches, recentPredictions, leaderboardTop, currentUserId, latestFantasyTeam, totalPredictions, totalMatches, isFantasyLocked }: Props) {

  const stats = [
    {
      label: 'Total Points',
      value: profile?.total_score ?? 0,
      icon: Trophy,
      color: '#ffd700',
      glow: 'rgba(255,215,0,0.3)',
      suffix: 'pts',
    },
    {
      label: 'Prediction Pts',
      value: profile?.prediction_score ?? 0,
      icon: Target,
      color: '#0066CC',
      glow: 'rgba(0,102,204,0.3)',
      suffix: 'pts',
    },
    {
      label: 'Fantasy Pts',
      value: profile?.fantasy_score ?? 0,
      icon: Zap,
      color: '#00e5ff',
      glow: 'rgba(0,229,255,0.3)',
      suffix: 'pts',
    },
    {
      label: 'Current Rank',
      value: rank,
      icon: TrendingUp,
      color: '#ff6b1a',
      glow: 'rgba(255,107,26,0.3)',
      prefix: '#',
    },
  ]

  return (
    <PageWrapper>
      {/* Header greeting */}
      <AnimatedSection className="mb-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-dark-muted text-sm mb-1">Welcome back 👋</p>
            <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {profile?.display_name ?? 'Champ'}
            </h1>
            <p className="text-dark-muted text-sm mt-1">
              You&apos;re ranked <span className="text-neon-gold font-bold">{ordinal(rank)}</span> on the leaderboard
            </p>
            {isFantasyLocked ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-neon-orange/8 border border-neon-orange/20 text-xs"
              >
                <Lock className="w-3 h-3 text-neon-orange" />
                <span className="text-neon-orange font-semibold">Squads Locked</span>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-neon-green/8 border border-neon-green/20 text-xs"
              >
                <Zap className="w-3 h-3 text-neon-green" />
                <span className="text-neon-green font-semibold">Squads Open</span>
              </motion.div>
            )}
          </div>
          <div className="hidden sm:block text-4xl animate-[float_6s_ease-in-out_infinite]">🏏</div>
        </div>
      </AnimatedSection>

      {/* Getting Started guide */}
      <GettingStarted
        totalPredictions={totalPredictions}
        totalMatches={totalMatches}
        hasFantasyTeam={!!latestFantasyTeam}
      />

      {/* Stats grid — staggered with count-up */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
      >
        {stats.map(stat => (
          <motion.div key={stat.label} variants={cardVariants}>
            <div
              className="glass rounded-xl p-4 border border-dark-border relative overflow-hidden group hover:scale-[1.03] transition-transform duration-300"
              style={{ boxShadow: `0 0 30px ${stat.glow}` }}
            >
              <div className="absolute inset-0 opacity-5 rounded-xl" style={{ background: `radial-gradient(circle at top right, ${stat.color}, transparent 70%)` }} />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-dark-muted font-medium">{stat.label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + '18', border: `1px solid ${stat.color}30` }}>
                  <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: stat.color }}>
                <AnimatedNumber value={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Upcoming matches */}
        <AnimatedSection className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <Calendar className="w-4 h-4 text-neon-cyan" /> Upcoming Matches
            </h2>
            <Link href="/matches" className="text-xs text-neon-blue hover:text-neon-blue/80 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingMatches.length === 0 ? (
              <Card className="p-6 text-center text-dark-muted text-sm">No upcoming matches scheduled</Card>
            ) : upcomingMatches.map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 250, damping: 25 }}
              >
                <Link href={`/matches/${match.id}`}>
                  <div className="glass rounded-xl p-4 border border-dark-border hover:border-neon-blue/30 hover:bg-neon-blue/[0.02] hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden">
                    {/* Team color stripe */}
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ backgroundColor: IPL_TEAMS[match.team_a]?.color ?? '#0066CC' }} />
                    <div className="flex items-center justify-between gap-3 pl-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <TeamLogo team={match.team_a} size="sm" />
                        <div className="text-center shrink-0">
                          <div className="text-xs text-dark-muted font-medium">VS</div>
                        </div>
                        <TeamLogo team={match.team_b} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {IPL_TEAMS[match.team_a].shortName} <span className="text-dark-muted">vs</span> {IPL_TEAMS[match.team_b].shortName}
                          </p>
                          <p className="text-xs text-dark-muted">{formatMatchDate(match.match_date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={match.status} />
                        <ArrowRight className="w-3.5 h-3.5 text-dark-muted group-hover:text-neon-blue transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            <Link href="/matches">
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-dark-border text-dark-muted text-sm hover:border-neon-blue/30 hover:text-neon-blue transition-all duration-300 cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                See all matches + make predictions
              </motion.div>
            </Link>
          </div>
        </AnimatedSection>

        {/* Mini leaderboard */}
        <AnimatedSection>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <Trophy className="w-4 h-4 text-neon-gold" /> Top Players
            </h2>
            <Link href="/leaderboard" className="text-xs text-neon-blue hover:text-neon-blue/80 flex items-center gap-1 transition-colors">
              Full board <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <Card className="divide-y divide-white/5">
            {leaderboardTop.map((entry, i) => {
              const rankColors = ['rank-gold', 'rank-silver', 'rank-bronze']
              const isMe = entry.id === currentUserId
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.06, type: 'spring', stiffness: 250, damping: 25 }}
                  className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-neon-blue/5' : ''}`}
                  style={isMe ? { boxShadow: 'inset 0 0 20px rgba(0,102,204,0.05)' } : {}}
                >
                  <span className={`text-sm font-bold w-5 text-center shrink-0 ${rankColors[i] ?? 'text-dark-muted'}`}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
                  </span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isMe ? 'bg-neon-blue/20 border border-neon-blue/30 text-neon-blue' : 'bg-dark-elevated text-neon-blue/60'}`}>
                    {(entry.display_name?.[0] ?? '?').toUpperCase()}
                  </div>
                  <span className={`text-sm flex-1 truncate ${isMe ? 'text-neon-blue font-semibold' : 'text-white'}`}>
                    {entry.display_name ?? 'User'}{isMe ? ' (you)' : ''}
                  </span>
                  <span className="text-sm font-bold text-neon-gold shrink-0" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {entry.total_score}
                  </span>
                </motion.div>
              )
            })}
            {leaderboardTop.length === 0 && (
              <div className="px-4 py-6 text-center text-dark-muted text-sm">No scores yet — be the first!</div>
            )}
          </Card>
        </AnimatedSection>

        {/* Recent predictions */}
        {recentPredictions.length > 0 && (
          <AnimatedSection className="lg:col-span-2">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <Target className="w-4 h-4 text-neon-blue" /> Recent Predictions
            </h2>
            <div className="space-y-2">
              {recentPredictions.map((pred: any, i) => {
                const match = pred.matches
                const isCorrect = match?.match_winner && match.match_winner === pred.predicted_match_winner
                const isScored = match?.status === 'completed'
                return (
                  <motion.div
                    key={pred.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {match && <TeamLogo team={match.team_a} size="xs" />}
                      <span className="text-xs text-dark-muted">vs</span>
                      {match && <TeamLogo team={match.team_b} size="xs" />}
                      <span className="text-xs text-white truncate ml-1">
                        Picked: <strong>{pred.predicted_match_winner}</strong>
                      </span>
                    </div>
                    <div className="shrink-0">
                      {isScored ? (
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isCorrect ? 'bg-neon-green/10 text-neon-green' : 'bg-red-500/10 text-red-400'}`}>
                          {isCorrect ? `+${pred.points_earned}pts` : '0pts'}
                        </span>
                      ) : (
                        <span className="text-xs text-dark-muted">Pending</span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </AnimatedSection>
        )}

        {/* Fantasy team quick view */}
        {latestFantasyTeam && (
          <AnimatedSection>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                <Zap className="w-4 h-4 text-neon-cyan" /> Your Squad
              </h2>
              <Link href="/fantasy" className="text-xs text-neon-blue hover:text-neon-blue/80 flex items-center gap-1 transition-colors">
                Edit <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <Card>
              <CardBody className="space-y-2 p-3">
                {[
                  latestFantasyTeam.batsman_1,
                  latestFantasyTeam.batsman_2,
                  latestFantasyTeam.bowler_1,
                  latestFantasyTeam.bowler_2,
                  latestFantasyTeam.flex,
                ].filter(Boolean).map((player: any, i: number) => (
                  <CompactPlayerCard key={i} player={player} showStats />
                ))}
              </CardBody>
            </Card>
          </AnimatedSection>
        )}
      </div>
    </PageWrapper>
  )
}
