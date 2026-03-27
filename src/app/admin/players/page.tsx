'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IPL_TEAMS, ROLE_LABELS, ROLE_COLORS, ROLE_ICONS } from '@/constants/ipl'
import { Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import { TeamLogo } from '@/components/ui/TeamLogo'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['ipl_players']['Row']
type IPLTeam = Database['public']['Tables']['ipl_players']['Row']['team']
type PlayerRole = Database['public']['Tables']['ipl_players']['Row']['role']

const TEAMS = Object.keys(IPL_TEAMS) as IPLTeam[]
const ROLES: PlayerRole[] = ['batsman', 'bowler', 'allrounder', 'wicketkeeper']

const emptyForm = { name: '', team: 'CSK' as IPLTeam, role: 'batsman' as PlayerRole }

export default function AdminPlayers() {
  const supabase = createClient()
  const [players, setPlayers] = useState<Player[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data } = await supabase.from('ipl_players').select('*').order('team').order('name')
    setPlayers(data ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      if (editing) {
        await supabase.from('ipl_players').update({ name: form.name, team: form.team, role: form.role }).eq('id', editing)
        setMsg('Player updated!')
      } else {
        await supabase.from('ipl_players').insert({ name: form.name, team: form.team, role: form.role })
        setMsg('Player added!')
      }
      setForm(emptyForm); setEditing(null); setShowForm(false)
      setTimeout(() => setMsg(''), 2500)
      loadPlayers()
    })
  }

  async function deletePlayer(id: string) {
    if (!confirm('Delete this player?')) return
    await supabase.from('ipl_players').delete().eq('id', id)
    loadPlayers()
  }

  function startEdit(p: Player) {
    setForm({ name: p.name, team: p.team, role: p.role })
    setEditing(p.id); setShowForm(true)
  }

  const filtered = players.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTeam !== 'all' && p.team !== filterTeam) return false
    if (filterRole !== 'all' && p.role !== filterRole) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Players <span className="text-dark-muted text-lg font-normal">({players.length})</span>
        </h1>
        <button
          onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-green/10 text-neon-green border border-neon-green/20 text-sm font-medium hover:bg-neon-green/20 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Player
        </button>
      </div>

      {msg && <p className="mb-4 text-sm text-neon-green">{msg}</p>}

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass rounded-xl border border-dark-border p-5 mb-6 space-y-4">
          <h2 className="text-sm font-bold text-white">{editing ? 'Edit Player' : 'New Player'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs text-dark-muted mb-1.5">Player Name</label>
              <input
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required placeholder="Virat Kohli"
                className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-green/50"
              />
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1.5">Team</label>
              <select
                value={form.team} onChange={e => setForm(p => ({ ...p, team: e.target.value as IPLTeam }))}
                className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon-green/50"
              >
                {TEAMS.map(t => <option key={t} value={t}>{t} — {IPL_TEAMS[t].name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1.5">Role</label>
              <select
                value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as PlayerRole }))}
                className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon-green/50"
              >
                {ROLES.map(r => <option key={r} value={r}>{ROLE_ICONS[r]} {ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-green text-dark-base font-bold text-sm disabled:opacity-60"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Update Player' : 'Add Player'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null) }}
              className="px-4 py-2.5 rounded-xl border border-dark-border text-dark-muted text-sm hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full bg-dark-card border border-dark-border rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-green/50"
          />
        </div>
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
          <option value="all">All Teams</option>
          {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {/* Player list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map(p => (
          <div key={p.id} className="glass rounded-xl border border-dark-border px-4 py-3 flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
              style={{ backgroundColor: ROLE_COLORS[p.role] + '18', border: `1px solid ${ROLE_COLORS[p.role]}30` }}>
              {ROLE_ICONS[p.role]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{p.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <TeamLogo team={p.team} size="xs" />
                <span className="text-[10px]" style={{ color: ROLE_COLORS[p.role] }}>{ROLE_LABELS[p.role]}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-dark-muted hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deletePlayer(p.id)} className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-dark-muted text-sm">
            {players.length === 0 ? 'No players yet. Add IPL 2026 players to get started.' : 'No players match your filters.'}
          </div>
        )}
      </div>
    </div>
  )
}
