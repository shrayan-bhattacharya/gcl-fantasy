'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { X, ChevronUp, CheckCircle, Target, Zap, ArrowRight } from 'lucide-react'

const STORAGE_KEY = 'gcl-guide-dismissed'
const SESSION_FORCE_KEY = 'gcl-guide-force'

interface Props {
  totalPredictions: number
  totalMatches: number
  hasFantasyTeam: boolean
}

interface QuestCardProps {
  emoji: string
  title: string
  bullets: string[]
  progress: React.ReactNode
  cta: string
  href: string
  delay: number
  color: string
  glow: string
}

function QuestCard({ emoji, title, bullets, progress, cta, href, delay, color, glow }: QuestCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 250, damping: 25 }}
      whileHover={{ y: -2, boxShadow: glow }}
      className="flex-1 min-w-0 rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: `linear-gradient(var(--theme-surface), var(--theme-surface)) padding-box,
                     linear-gradient(135deg, ${color}50, #FFD70030) border-box`,
        border: '1px solid transparent',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <span className="text-sm font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {title}
        </span>
      </div>

      {/* Bullets */}
      <ul className="space-y-1.5 flex-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-dark-muted leading-relaxed">
            <span className="mt-0.5 shrink-0 w-1 h-1 rounded-full bg-dark-muted/60 translate-y-1" />
            {b}
          </li>
        ))}
      </ul>

      {/* Progress */}
      <div>{progress}</div>

      {/* CTA */}
      <Link href={href}>
        <motion.div
          animate={{ scale: [1, 1.015, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.5 }}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 0 14px ${color}40` }}
        >
          {cta} <ArrowRight className="w-3 h-3" />
        </motion.div>
      </Link>
    </motion.div>
  )
}

export function GettingStarted({ totalPredictions, totalMatches, hasFantasyTeam }: Props) {
  const [hydrated, setHydrated] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [forceShow, setForceShow] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // Check for cross-page "?" navigation flag
    const forced = sessionStorage.getItem(SESSION_FORCE_KEY) === '1'
    if (forced) {
      sessionStorage.removeItem(SESSION_FORCE_KEY)
      setForceShow(true)
      setDismissed(false)
    } else {
      setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    function handler() {
      setForceShow(true)
      setDismissed(false)
      setCollapsed(false)
    }
    window.addEventListener('show-gcl-guide', handler)
    return () => window.removeEventListener('show-gcl-guide', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
    setForceShow(false)
  }

  const bothComplete = totalPredictions > 0 && hasFantasyTeam
  const visible = hydrated && (forceShow || (!dismissed && !bothComplete))

  const pct = totalMatches > 0 ? Math.min(100, (totalPredictions / totalMatches) * 100) : 0

  const predProgress = (
    <div className="space-y-1">
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #0066CC, #00e5ff)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
        />
      </div>
      <p className="text-[11px] text-dark-muted">
        {totalPredictions}/{totalMatches} matches predicted
      </p>
    </div>
  )

  const squadProgress = hasFantasyTeam ? (
    <div className="flex items-center gap-1.5 text-neon-green text-xs font-semibold">
      <CheckCircle className="w-3.5 h-3.5" /> Squad ready!
    </div>
  ) : (
    <p className="text-[11px] text-dark-muted">No squad set yet</p>
  )

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="getting-started"
          initial={{ opacity: 0, y: -12, scaleY: 0.95 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: -12, scaleY: 0.95, transition: { duration: 0.2 } }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="mb-6 rounded-2xl overflow-hidden"
          style={{
            background: `linear-gradient(var(--theme-bg), var(--theme-bg)) padding-box,
                         linear-gradient(135deg, rgba(0,102,204,0.4), rgba(255,215,0,0.3)) border-box`,
            border: '1px solid transparent',
          }}
        >
          {/* Header bar */}
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
            style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)' }}
            onClick={() => setCollapsed(c => !c)}
          >
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 1.5, delay: 1, repeat: Infinity, repeatDelay: 6 }}
                className="text-base"
              >
                🎮
              </motion.span>
              <span className="text-sm font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
                How to Play
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neon-blue/15 text-neon-blue font-semibold border border-neon-blue/20">
                GUIDE
              </span>
            </div>
            <div className="flex items-center gap-1">
              <motion.div
                animate={{ rotate: collapsed ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronUp className="w-4 h-4 text-dark-muted" />
              </motion.div>
              <button
                onClick={e => { e.stopPropagation(); dismiss() }}
                className="ml-1 p-1 rounded-lg hover:bg-dark-elevated transition-colors text-dark-muted hover:text-white"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Collapsible body */}
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-4 space-y-4">
                  {/* Quest cards */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <QuestCard
                      emoji="🏏"
                      title="Predict & Win"
                      bullets={[
                        'Pick the match winner before each game',
                        '50 points for every correct prediction',
                        'Locks 1 hour before match — don\'t miss it!',
                      ]}
                      progress={predProgress}
                      cta="Make Predictions"
                      href="/matches"
                      delay={0.1}
                      color="#0066CC"
                      glow="0 0 24px rgba(0,102,204,0.2)"
                    />
                    <QuestCard
                      emoji="⚡"
                      title="Build Your Squad"
                      bullets={[
                        'Pick 5 players: 2 batsmen, 2 bowlers, 1 flex',
                        '1pt per run · 10pts per wicket from your squad',
                        'One squad for the entire stage — choose wisely!',
                      ]}
                      progress={squadProgress}
                      cta="Pick Your Squad"
                      href="/fantasy"
                      delay={0.2}
                      color="#FFD700"
                      glow="0 0 24px rgba(255,215,0,0.15)"
                    />
                  </div>

                  {/* Footer line */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-center text-xs text-dark-muted pb-1"
                  >
                    Points from both games add up on the Leaderboard. May the best predictor win!{' '}
                    <span>🏆</span>
                  </motion.p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
