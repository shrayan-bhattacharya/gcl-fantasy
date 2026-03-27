'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { PageWrapper, AnimatedSection } from '@/components/layout/PageWrapper'
import { Tabs } from '@/components/ui/Tabs'
import { Trophy, Target, Zap } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface UserScore {
  id: string
  display_name: string | null
  avatar_url: string | null
  total_score: number
  prediction_score: number
  fantasy_score: number
}

interface Props {
  users: UserScore[]
  currentUserId: string
}

const RANK_STYLES = [
  { bg: 'from-yellow-500/20 to-yellow-500/5', border: 'border-yellow-500/40', badge: '🥇', glow: '0 0 30px rgba(255,215,0,0.25), 0 0 1px rgba(255,215,0,0.5)' },
  { bg: 'from-slate-400/20 to-slate-400/5',   border: 'border-slate-400/40',   badge: '🥈', glow: '0 0 20px rgba(192,192,192,0.2)' },
  { bg: 'from-amber-600/20 to-amber-600/5',   border: 'border-amber-600/40',   badge: '🥉', glow: '0 0 20px rgba(205,127,50,0.2)' },
]

function LeaderboardRow({ user, rank, currentUserId, scoreKey, delay }: {
  user: UserScore
  rank: number
  currentUserId: string
  scoreKey: 'total_score' | 'prediction_score' | 'fantasy_score'
  delay: number
}) {
  const isMe = user.id === currentUserId
  const style = rank <= 3 ? RANK_STYLES[rank - 1] : null
  const score = user[scoreKey]

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 250, damping: 25 }}
      className={`relative flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-300
        ${style
          ? `bg-gradient-to-r ${style.bg} ${style.border}`
          : isMe
            ? 'border-neon-blue/40 bg-neon-blue/5'
            : 'border-dark-border bg-dark-card hover:border-dark-muted/50 hover:-translate-y-0.5'
        }
      `}
      style={
        style
          ? { boxShadow: style.glow }
          : isMe
            ? { boxShadow: '0 0 24px rgba(0,102,204,0.15), 0 0 1px rgba(0,102,204,0.3)' }
            : {}
      }
    >
      {/* Rank */}
      <div className="w-8 text-center shrink-0">
        {rank <= 3
          ? <span className="text-xl">{style!.badge}</span>
          : <span className="text-sm font-bold text-dark-muted">#{rank}</span>
        }
      </div>

      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0
        ${isMe
          ? 'bg-neon-blue/20 border-2 border-neon-blue/50 text-neon-blue'
          : rank <= 3
            ? 'bg-dark-elevated border border-dark-border text-neon-gold'
            : 'bg-dark-elevated border border-dark-border text-white'
        }
      `}>
        {getInitials(user.display_name)}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isMe ? 'text-neon-blue' : 'text-white'}`}>
          {user.display_name ?? 'Player'}{isMe ? ' (you)' : ''}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-dark-muted flex items-center gap-1">
            <Target className="w-2.5 h-2.5" />{user.prediction_score}
          </span>
          <span className="text-[10px] text-dark-muted flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />{user.fantasy_score}
          </span>
        </div>
      </div>

      {/* Score */}
      <div className="text-right shrink-0">
        <motion.p
          key={score}
          initial={{ scale: 1.2, color: '#0066CC' }}
          animate={{ scale: 1, color: rank <= 3 ? '#ffd700' : isMe ? '#0066CC' : '#e8edf5' }}
          transition={{ duration: 0.4 }}
          className="text-lg font-black"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          {score.toLocaleString()}
        </motion.p>
        <p className="text-[10px] text-dark-muted">pts</p>
      </div>
    </motion.div>
  )
}

export function LeaderboardClient({ users, currentUserId }: Props) {
  const myRank = users.findIndex(u => u.id === currentUserId) + 1

  const tabs = [
    { id: 'total',       label: 'Combined',    icon: <Trophy className="w-3.5 h-3.5" /> },
    { id: 'predictions', label: 'Predictions', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'fantasy',     label: 'Fantasy',     icon: <Zap className="w-3.5 h-3.5" /> },
  ]

  const scoreKeyMap: Record<string, 'total_score' | 'prediction_score' | 'fantasy_score'> = {
    total:       'total_score',
    predictions: 'prediction_score',
    fantasy:     'fantasy_score',
  }

  function getSorted(tab: string) {
    const key = scoreKeyMap[tab]
    return [...users].sort((a, b) => b[key] - a[key])
  }

  return (
    <PageWrapper title="Leaderboard" subtitle={`${users.length} players competing`}>
      {/* My rank hero */}
      {myRank > 0 && (
        <AnimatedSection className="mb-6">
          <motion.div
            className="relative overflow-hidden rounded-2xl border border-neon-blue/30 p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(0,102,204,0.08), rgba(0,229,255,0.04))',
              boxShadow: '0 0 40px rgba(0,102,204,0.1)',
            }}
          >
            <div className="absolute inset-0 pitch-bg opacity-30" />
            {/* Decorative blue glow blob */}
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-neon-blue/5 blur-3xl" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-dark-muted mb-1">Your Current Rank</p>
                <p className="text-4xl font-black gradient-text" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  #{myRank}
                </p>
                <p className="text-xs text-dark-muted mt-1">
                  out of {users.length} players
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-dark-muted mb-1">Total Points</p>
                <p className="text-3xl font-black text-neon-gold" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {users.find(u => u.id === currentUserId)?.total_score ?? 0}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatedSection>
      )}

      {/* Tabs + table */}
      <AnimatedSection>
        <Tabs tabs={tabs} defaultTab="total">
          {(activeTab) => {
            const sorted = getSorted(activeTab)
            const scoreKey = scoreKeyMap[activeTab]
            return (
              <div className="space-y-2">
                {sorted.map((user, i) => (
                  <LeaderboardRow
                    key={user.id}
                    user={user}
                    rank={i + 1}
                    currentUserId={currentUserId}
                    scoreKey={scoreKey}
                    delay={i * 0.04}
                  />
                ))}
                {users.length === 0 && (
                  <div className="text-center py-16 text-dark-muted">
                    <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No scores yet — first match scores will appear here</p>
                  </div>
                )}
              </div>
            )
          }}
        </Tabs>
      </AnimatedSection>
    </PageWrapper>
  )
}
