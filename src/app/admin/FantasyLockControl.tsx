'use client'

import { useState } from 'react'
import { Lock, Unlock, Shield, ArrowRightLeft } from 'lucide-react'

interface Props {
  initialLocked: boolean
  initialPhase: 'league' | 'knockout'
}

export function FantasyLockControl({ initialLocked, initialPhase }: Props) {
  const [isLocked, setIsLocked] = useState(initialLocked)
  const [phase, setPhase] = useState(initialPhase)
  const [loading, setLoading] = useState(false)

  async function toggleLock() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/fantasy-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_locked: !isLocked }),
      })
      if (res.ok) {
        const data = await res.json()
        setIsLocked(data.is_locked)
        setPhase(data.phase)
      }
    } finally {
      setLoading(false)
    }
  }

  async function switchPhase() {
    const newPhase = phase === 'league' ? 'knockout' : 'league'
    setLoading(true)
    try {
      const res = await fetch('/api/admin/fantasy-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: newPhase, is_locked: false }),
      })
      if (res.ok) {
        const data = await res.json()
        setIsLocked(data.is_locked)
        setPhase(data.phase)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-xl border border-dark-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-neon-blue" />
        <h2 className="text-sm font-bold text-white">Fantasy Squad Control</h2>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Lock status */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            isLocked
              ? 'bg-neon-orange/10 border-neon-orange/20'
              : 'bg-neon-green/10 border-neon-green/20'
          }`}>
            {isLocked
              ? <Lock className="w-4 h-4 text-neon-orange" />
              : <Unlock className="w-4 h-4 text-neon-green" />
            }
            <span className={`text-sm font-semibold ${isLocked ? 'text-neon-orange' : 'text-neon-green'}`}>
              {isLocked ? 'Locked' : 'Open'}
            </span>
          </div>

          <button
            onClick={toggleLock}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              isLocked
                ? 'bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20'
                : 'bg-neon-orange/10 text-neon-orange border border-neon-orange/20 hover:bg-neon-orange/20'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? '...' : isLocked ? 'Unlock Squads' : 'Lock Squads'}
          </button>
        </div>

        {/* Phase control */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-dark-muted">Phase:</span>
          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
            phase === 'league'
              ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
              : 'bg-neon-gold/10 text-neon-gold border border-neon-gold/20'
          }`}>
            {phase === 'league' ? 'League Stage' : 'Knockout Stage'}
          </span>

          <button
            onClick={switchPhase}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-dark-elevated border border-dark-border text-dark-muted hover:text-white hover:border-white/20 transition-all ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Switch to {phase === 'league' ? 'Knockout' : 'League'}
          </button>
        </div>
      </div>

      <p className="text-xs text-dark-muted mt-3">
        {isLocked
          ? 'Squads are locked. Users cannot edit their fantasy teams.'
          : 'Squads are open. Users can pick or change their fantasy teams.'
        }
        {' '}Switching phase unlocks squads so users can reshuffle.
      </p>
    </div>
  )
}
