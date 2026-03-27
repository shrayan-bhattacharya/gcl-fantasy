'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IPL_TEAMS } from '@/constants/ipl'
import { formatMatchDate } from '@/lib/utils'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import type { Database, MatchStatus } from '@/types/database.types'

type Match = Database['public']['Tables']['matches']['Row']
type IPLTeam = Database['public']['Tables']['matches']['Row']['team_a']
const TEAMS = Object.keys(IPL_TEAMS) as IPLTeam[]

const emptyForm = { team_a: 'CSK' as IPLTeam, team_b: 'MI' as IPLTeam, venue: '', match_date: '', status: 'upcoming' as MatchStatus }

export default function AdminMatches() {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_date')
    setMatches(data ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.team_a === form.team_b) { setMsg('Teams must be different'); return }

    startTransition(async () => {
      const matchDate = new Date(form.match_date)
      const predDeadline = new Date(matchDate.getTime() - 30 * 60 * 1000).toISOString()
      const fantasyDeadline = new Date(matchDate.getTime() - 60 * 60 * 1000).toISOString()

      const payload = {
        team_a: form.team_a, team_b: form.team_b, venue: form.venue || null,
        match_date: matchDate.toISOString(), status: form.status as any,
        prediction_deadline: predDeadline, fantasy_deadline: fantasyDeadline,
      }

      if (editing) {
        await supabase.from('matches').update(payload).eq('id', editing)
      } else {
        await supabase.from('matches').insert(payload)
      }
      setForm(emptyForm); setEditing(null); setShowForm(false)
      setMsg(editing ? 'Match updated!' : 'Match added!')
      setTimeout(() => setMsg(''), 2500)
      loadMatches()
    })
  }

  async function deleteMatch(id: string) {
    if (!confirm('Delete this match? This will also remove predictions.')) return
    await supabase.from('matches').delete().eq('id', id)
    loadMatches()
  }

  function startEdit(m: Match) {
    setForm({ team_a: m.team_a, team_b: m.team_b, venue: m.venue ?? '', match_date: m.match_date.slice(0, 16), status: m.status })
    setEditing(m.id); setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>Matches</h1>
        <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 text-sm font-medium hover:bg-neon-cyan/20 transition-colors">
          <Plus className="w-4 h-4" /> Add Match
        </button>
      </div>

      {msg && <p className="mb-4 text-sm text-neon-green">{msg}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass rounded-xl border border-dark-border p-5 mb-6 space-y-4">
          <h2 className="text-sm font-bold text-white">{editing ? 'Edit Match' : 'New Match'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-dark-muted mb-1">Team A</label>
              <select value={form.team_a} onChange={e => setForm(p => ({ ...p, team_a: e.target.value as IPLTeam }))}
                className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-green/50">
                {TEAMS.map(t => <option key={t} value={t}>{t} — {IPL_TEAMS[t].name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1">Team B</label>
              <select value={form.team_b} onChange={e => setForm(p => ({ ...p, team_b: e.target.value as IPLTeam }))}
                className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-green/50">
                {TEAMS.map(t => <option key={t} value={t}>{t} — {IPL_TEAMS[t].name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1">Match Date & Time</label>
              <input type="datetime-local" value={form.match_date} onChange={e => setForm(p => ({ ...p, match_date: e.target.value }))} required
                className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-green/50" />
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-green/50">
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-dark-muted mb-1">Venue (optional)</label>
              <input type="text" value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))} placeholder="Wankhede Stadium, Mumbai"
                className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-green/50 placeholder:text-dark-muted/40" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-green text-dark-base font-bold text-sm disabled:opacity-60">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Update Match' : 'Add Match'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null) }}
              className="px-4 py-2.5 rounded-xl border border-dark-border text-dark-muted text-sm hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {matches.map(m => (
          <div key={m.id} className="glass rounded-xl border border-dark-border px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${m.status === 'live' ? 'bg-neon-green/10 text-neon-green' : m.status === 'upcoming' ? 'bg-neon-cyan/10 text-neon-cyan' : 'bg-white/5 text-dark-muted'}`}>
                {m.status}
              </span>
              <p className="text-sm font-semibold text-white">{m.team_a} vs {m.team_b}</p>
              <p className="text-xs text-dark-muted hidden sm:block">{formatMatchDate(m.match_date)}</p>
              {m.venue && <p className="text-xs text-dark-muted hidden lg:block">{m.venue}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => startEdit(m)} className="p-2 rounded-lg text-dark-muted hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteMatch(m.id)} className="p-2 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {matches.length === 0 && <p className="text-center py-10 text-dark-muted text-sm">No matches yet. Add your first match!</p>}
      </div>
    </div>
  )
}
