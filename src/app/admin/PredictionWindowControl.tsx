'use client'

import { useState } from 'react'
import { Lock, Unlock, Target, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  initialOpen: boolean
}

export function PredictionWindowControl({ initialOpen }: Props) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [savedMsg, setSavedMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function toggle() {
    const newValue = !isOpen
    setIsOpen(newValue)   // optimistic update
    setLoading(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/admin/prediction-window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_open: newValue }),
      })
      const data = await res.json()
      if (res.ok) {
        setIsOpen(data.is_open)   // confirm with server value
        setSavedMsg(data.is_open ? 'Predictions opened' : 'Predictions closed')
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 2000)
      } else {
        setIsOpen(!newValue)      // revert on failure
        setStatus('error')
        setErrorMsg(data.error ?? 'Failed to update')
        setTimeout(() => setStatus('idle'), 4000)
      }
    } catch {
      setIsOpen(!newValue)        // revert on network error
      setStatus('error')
      setErrorMsg('Network error')
      setTimeout(() => setStatus('idle'), 4000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-xl border border-dark-border p-6 mt-6">
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

          {status === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-neon-green font-semibold">
              <CheckCircle className="w-3.5 h-3.5" /> {savedMsg}
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" /> {errorMsg}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-dark-muted mt-3">
        {isOpen
          ? 'Predictions are open. Users can submit picks until each match\'s deadline (set per match).'
          : 'Predictions are closed. Users will see a "Check back when admin opens the window" banner.'
        }
      </p>
    </div>
  )
}
