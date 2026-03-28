'use client'

import { motion } from 'framer-motion'
import { useState, useTransition, useEffect, useMemo, useCallback, memo } from 'react'
import { PageWrapper, AnimatedSection } from '@/components/layout/PageWrapper'
import { StatusBadge } from '@/components/ui/Badge'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { IPL_TEAMS } from '@/constants/ipl'
import {
  formatTime, formatDayLabel,
  getMatchDay, getMatchDayLockTime, getMatchDayUnlockTime, formatCountdown,
} from '@/lib/utils'
import { Calendar, CheckCircle, Lock, Target, AlertCircle } from 'lucide-react'
import type { Database } from '@/types/database.types'
import { PREDICTION_POINTS } from '@/constants/scoring'

type MatchRow = Database['public']['Tables']['matches']['Row']
type PredictionRow = Database['public']['Tables']['predictions']['Row']
type IPLTeam = Database['public']['Tables']['matches']['Row']['team_a']

interface Props {
  matches: MatchRow[]
  userPredictions: PredictionRow[]
  userId: string
  predictionWindowOpen: boolean
}

interface DayGroup {
  matchDay: string
  matches: MatchRow[]
  lockTime: Date
  unlockTime: Date
  hasLive: boolean
  allCompleted: boolean
}

// ─── MatchCard ─────────────────────────────────────────────────────────────
// Defined outside MatchesClient so React never recreates it as a new type.
// React.memo prevents re-renders when sibling cards' data changes.

interface MatchCardProps {
  match: MatchRow
  dayIsLocked: boolean
  matchDeadlinePassed: boolean
  predWindowOpen: boolean
  existing: PredictionRow | undefined
  confirmedWinner: IPLTeam | undefined
  pickedWinner: IPLTeam | null
  isSaving: boolean
  onSetPick: (matchId: string, team: IPLTeam) => void
  onSubmitPrediction: (matchId: string, winner: IPLTeam) => void
}

const MatchCard = memo(function MatchCard({
  match, dayIsLocked, matchDeadlinePassed, predWindowOpen,
  existing, confirmedWinner, pickedWinner, isSaving,
  onSetPick, onSubmitPrediction,
}: MatchCardProps) {
  const isLocked = !predWindowOpen || dayIsLocked || matchDeadlinePassed || match.status === 'completed'
  const hasSaved = !!confirmedWinner
  const lockReason = !predWindowOpen
    ? 'Predictions are closed this week'
    : matchDeadlinePassed
      ? 'Match locked'
      : 'Predictions locked for this match'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 250, damping: 25 }}
      className={`glass rounded-xl border transition-all duration-200 overflow-hidden relative
        ${match.status === 'live' ? 'border-neon-green/40' : 'border-dark-border'}
      `}
      style={match.status === 'live' ? { boxShadow: '0 0 24px rgba(57,255,20,0.12)' } : {}}
      whileHover={{ y: match.status === 'completed' ? 0 : -2 }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ backgroundColor: IPL_TEAMS[match.team_a]?.color ?? '#0066CC' }} />

      {/* Match header */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamLogo team={match.team_a} size="sm" />
            <div className="flex-1 min-w-0 px-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-bold text-white">{match.team_a}</span>
                <span className="text-xs text-dark-muted font-medium">VS</span>
                <span className="text-sm font-bold text-white">{match.team_b}</span>
              </div>
              <p className="text-xs text-dark-muted text-center mt-0.5">{formatTime(match.match_date)}</p>
              {match.venue && <p className="text-xs text-dark-muted/60 text-center truncate">{match.venue}</p>}
            </div>
            <TeamLogo team={match.team_b} size="sm" />
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={match.status} />
            {hasSaved && !isLocked && (
              <span className="flex items-center gap-1 text-[10px] text-neon-blue font-medium">
                <CheckCircle className="w-2.5 h-2.5" /> {confirmedWinner} picked
              </span>
            )}
            {match.status === 'completed' && existing && (
              <span className={`text-[10px] font-bold ${existing.points_earned > 0 ? 'text-neon-green' : 'text-dark-muted'}`}>
                {existing.points_earned > 0 ? `+${existing.points_earned}pts` : '0pts'}
              </span>
            )}
          </div>
        </div>

        {/* Completed result — always visible */}
        {match.status === 'completed' && match.match_winner && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-dark-muted">Result:</span>
            <div className="flex items-center gap-1.5">
              <TeamLogo team={match.match_winner} size="xs" />
              <span className="text-xs font-bold text-neon-gold">{IPL_TEAMS[match.match_winner].name} won</span>
            </div>
            {existing && (
              <span className={`text-xs font-bold ${match.match_winner === existing.predicted_match_winner ? 'text-neon-green' : 'text-red-400'}`}>
                {match.match_winner === existing.predicted_match_winner ? '✓ Correct' : '✗ Wrong'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Prediction section — always visible for upcoming matches */}
      {match.status !== 'completed' && (
        <div className="px-4 pb-4 pt-1 border-t border-white/5">
          {isLocked ? (
            /* Locked state */
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neon-orange/5 border border-neon-orange/20 text-xs text-dark-muted">
              <Lock className="w-3 h-3 text-neon-orange shrink-0" />
              {hasSaved
                ? <span>Locked in · You picked <strong className="text-white">{confirmedWinner}</strong></span>
                : <span>{lockReason}</span>
              }
            </div>
          ) : (
            /* Prediction picker — always visible */
            <div className="space-y-3">
              <p className="text-xs font-medium text-dark-muted flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Pick the match winner
                <span className="text-neon-green">+{PREDICTION_POINTS.MATCH_WINNER}pts</span>
              </p>

              {hasSaved && !pickedWinner && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neon-blue/10 border border-neon-blue/20 text-neon-blue text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">You picked <strong>{confirmedWinner}</strong></span>
                  <button
                    onClick={() => onSetPick(match.id, confirmedWinner!)}
                    className="ml-auto text-xs underline text-dark-muted hover:text-white"
                  >
                    Change
                  </button>
                </div>
              )}

              {(!hasSaved || pickedWinner) && (
                <div className="grid grid-cols-2 gap-2">
                  {([match.team_a, match.team_b] as IPLTeam[]).map(team => {
                    const isSelected = pickedWinner === team || (!pickedWinner && confirmedWinner === team)
                    return (
                      <motion.button
                        key={team}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onSetPick(match.id, team)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all duration-200
                          ${isSelected
                            ? 'border-neon-blue/50 bg-neon-blue/10 text-neon-blue'
                            : 'border-dark-border bg-dark-elevated text-white hover:border-dark-muted'
                          }`}
                      >
                        <TeamLogo team={team} size="xs" />
                        {IPL_TEAMS[team].name}
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 ml-auto" />}
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {pickedWinner && (
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  disabled={isSaving}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSubmitPrediction(match.id, pickedWinner)}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-neon-blue text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ boxShadow: '0 0 20px rgba(0,102,204,0.4)' }}
                >
                  {isSaving ? 'Saving...' : hasSaved ? `Update to ${pickedWinner}` : `Lock in ${pickedWinner}`}
                </motion.button>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
})

// ─── DaySection ────────────────────────────────────────────────────────────
// Also defined outside MatchesClient. Owns its own 1-second timer so only
// the countdown text updates — the parent list never re-renders per tick.

interface DaySectionProps {
  group: DayGroup
  confirmed: Record<string, IPLTeam>
  picks: Record<string, IPLTeam | null>
  saving: string | null
  predMap: Record<string, PredictionRow>
  predWindowOpen: boolean
  onSetPick: (matchId: string, team: IPLTeam) => void
  onSubmitPrediction: (matchId: string, winner: IPLTeam) => void
}

function DaySection({
  group, confirmed, picks, saving, predMap, predWindowOpen,
  onSetPick, onSubmitPrediction,
}: DaySectionProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const isLocked = now >= group.lockTime && now < group.unlockTime
  const msUntilLock = Math.max(0, group.lockTime.getTime() - now.getTime())
  const msUntilUnlock = Math.max(0, group.unlockTime.getTime() - now.getTime())

  return (
    <AnimatedSection className="mb-6">
      {/* Day header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold flex items-center gap-2 text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {group.hasLive && (
            <span className="w-2 h-2 rounded-full bg-neon-green animate-ping shrink-0" />
          )}
          {!group.hasLive && <Calendar className="w-4 h-4 text-neon-cyan shrink-0" />}
          {formatDayLabel(group.matchDay)}
          <span className="text-dark-muted font-normal text-xs">
            ({group.matches.length} {group.matches.length === 1 ? 'match' : 'matches'})
          </span>
        </h2>

        {!group.allCompleted && (
          <div className="text-xs">
            {isLocked ? (
              <span className="flex items-center gap-1 text-neon-orange">
                <Lock className="w-3 h-3" />
                Locked · unlocks in {formatCountdown(msUntilUnlock)}
              </span>
            ) : msUntilLock > 0 ? (
              <span className="text-dark-muted">
                Locks in{' '}
                <span className="text-neon-orange font-semibold">{formatCountdown(msUntilLock)}</span>
              </span>
            ) : null}
          </div>
        )}
      </div>

      {isLocked && !group.allCompleted && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neon-orange/5 border border-neon-orange/20 text-xs text-dark-muted mb-3"
        >
          <Lock className="w-3 h-3 text-neon-orange shrink-0" />
          Predictions and squad are locked · unlocks at 1:00 AM
        </motion.div>
      )}

      <div className="space-y-3">
        {group.matches.map(m => (
          <MatchCard
            key={m.id}
            match={m}
            dayIsLocked={isLocked}
            matchDeadlinePassed={!!m.prediction_deadline && now >= new Date(m.prediction_deadline)}
            predWindowOpen={predWindowOpen}
            existing={predMap[m.id]}
            confirmedWinner={confirmed[m.id]}
            pickedWinner={picks[m.id] ?? null}
            isSaving={saving === m.id}
            onSetPick={onSetPick}
            onSubmitPrediction={onSubmitPrediction}
          />
        ))}
      </div>
    </AnimatedSection>
  )
}

// ─── MatchesClient ─────────────────────────────────────────────────────────

export function MatchesClient({ matches, userPredictions, userId, predictionWindowOpen }: Props) {
  const [picks, setPicks] = useState<Record<string, IPLTeam | null>>({})
  const [confirmed, setConfirmed] = useState<Record<string, IPLTeam>>(() =>
    Object.fromEntries(userPredictions.map(p => [p.match_id, p.predicted_match_winner]))
  )
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState<string | null>(null)

  // Stable predMap — don't recreate on each render
  const predMap = useMemo(
    () => Object.fromEntries(userPredictions.map(p => [p.match_id, p])),
    [userPredictions]
  )

  // Group + sort matches by IST date — stable, only recomputes when matches change
  const dayGroups = useMemo((): DayGroup[] => {
    const grouped: Record<string, MatchRow[]> = {}
    for (const m of matches) {
      const day = getMatchDay(m.match_date)
      if (!grouped[day]) grouped[day] = []
      grouped[day].push(m)
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([matchDay, dayMatches]) => {
        // Stable sort: match_date ASC, then id as tiebreaker
        const sorted = [...dayMatches].sort(
          (a, b) =>
            new Date(a.match_date).getTime() - new Date(b.match_date).getTime() ||
            a.id.localeCompare(b.id)
        )
        const earliest = sorted[0]
        return {
          matchDay,
          matches: sorted,
          lockTime: getMatchDayLockTime(earliest.match_date),
          unlockTime: getMatchDayUnlockTime(matchDay),
          hasLive: dayMatches.some(m => m.status === 'live'),
          allCompleted: dayMatches.every(m => m.status === 'completed'),
        }
      })
  }, [matches])

  // Split into upcoming/completed — computed once per matches change, not per tick
  const { upcomingDays, completedDays } = useMemo(() => {
    const today = getMatchDay(new Date().toISOString())
    return {
      upcomingDays: dayGroups.filter(d => !d.allCompleted || d.matchDay >= today),
      completedDays: dayGroups.filter(d => d.allCompleted && d.matchDay < today).reverse(),
    }
  }, [dayGroups])

  const handleSetPick = useCallback((matchId: string, team: IPLTeam) => {
    setPicks(prev => ({ ...prev, [matchId]: team }))
  }, [])

  const handleSubmitPrediction = useCallback((matchId: string, winner: IPLTeam) => {
    setSaving(matchId)
    startTransition(async () => {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, winner }),
      })
      if (res.ok) {
        setConfirmed(prev => ({ ...prev, [matchId]: winner }))
        setPicks(prev => ({ ...prev, [matchId]: null }))
      }
      setSaving(null)
    })
  }, [])

  // suppress unused warning — startTransition keeps isPending for future use
  void isPending

  return (
    <PageWrapper title="Matches" subtitle="Predict the match winner to earn 50 points">
      <AnimatedSection className="mb-5">
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 glass px-3 py-2 rounded-xl border border-dark-border text-xs">
            <span className="text-dark-muted">Correct match winner</span>
            <span className="font-bold text-neon-blue">+{PREDICTION_POINTS.MATCH_WINNER} pts</span>
          </div>
          <div className="flex items-center gap-2 glass px-3 py-2 rounded-xl border border-dark-border text-xs">
            <Lock className="w-3 h-3 text-dark-muted" />
            <span className="text-dark-muted">Locks 1 hr before each match</span>
          </div>
        </div>
      </AnimatedSection>

      {!predictionWindowOpen && (
        <AnimatedSection className="mb-5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-elevated border border-dark-border text-sm text-dark-muted">
            <AlertCircle className="w-4 h-4 text-neon-orange shrink-0" />
            <span>Predictions closed — check back next week when admin opens the window.</span>
          </div>
        </AnimatedSection>
      )}

      {upcomingDays.map(group => (
        <DaySection
          key={group.matchDay}
          group={group}
          confirmed={confirmed}
          picks={picks}
          saving={saving}
          predMap={predMap}
          predWindowOpen={predictionWindowOpen}
          onSetPick={handleSetPick}
          onSubmitPrediction={handleSubmitPrediction}
        />
      ))}

      {completedDays.length > 0 && (
        <AnimatedSection>
          <h2 className="text-sm font-bold text-dark-muted mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Completed ({completedDays.reduce((n, g) => n + g.matches.length, 0)} matches)
          </h2>
          {completedDays.map(group => (
            <DaySection
              key={group.matchDay}
              group={group}
              confirmed={confirmed}
              picks={picks}
              saving={saving}
              predMap={predMap}
              predWindowOpen={predictionWindowOpen}
              onSetPick={handleSetPick}
              onSubmitPrediction={handleSubmitPrediction}
            />
          ))}
        </AnimatedSection>
      )}

      {matches.length === 0 && (
        <AnimatedSection>
          <div className="text-center py-20 text-dark-muted">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No matches scheduled yet</p>
          </div>
        </AnimatedSection>
      )}
    </PageWrapper>
  )
}
