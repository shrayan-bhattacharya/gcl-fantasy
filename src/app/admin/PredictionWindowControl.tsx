'use client'

import { useState } from 'react'
import { Lock, Unlock, Target } from 'lucide-react'

interface Props {
  initialOpen: boolean
}

export function PredictionWindowControl({ initialOpen }: Props) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/prediction-window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_open: !isOpen }),
      })
      if (res.ok) {
        const data = await res.json()
        setIsOpen(data.is_open)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-xl border border-dark-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-neon-blue" />
        <h2 className="text-sm font-bold text-white">Prediction Window</h2>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            isOpen
              ? 'bg-neon-green/10 border-neon-green/20'
              : 'bg-neon-orange/10 border-neon-orange/20'
          }`}>
            {isOpen
              ? <Unlock className="w-4 h-4 text-neon-green" />
              : <Lock className="w-4 h-4 text-neon-orange" />
            }
            <span className={`text-sm font-semibold ${isOpen ? 'text-neon-green' : 'text-neon-orange'}`}>
              {isOpen ? 'Open' : 'Closed'}
            </span>
          </div>

          <button
            onClick={toggle}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              isOpen
                ? 'bg-neon-orange/10 text-neon-orange border border-neon-orange/20 hover:bg-neon-orange/20'
                : 'bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? '...' : isOpen ? 'Close Predictions' : 'Open Predictions'}
          </button>
        </div>
      </div>

      <p className="text-xs text-dark-muted mt-3">
        {isOpen
          ? 'Predictions are open. Users can submit picks until each match\'s deadline (set per match).'
          : 'Predictions are closed. Users will see a "Check back next week" banner.'
        }
      </p>
    </div>
  )
}
