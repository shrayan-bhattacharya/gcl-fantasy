'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IPL_TEAMS, ROLE_ICONS } from '@/constants/ipl'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { formatMatchDate } from '@/lib/utils'
import { Loader2, CheckCircle, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Match = Database['public']['Tables']['matches']['Row']
type Player = Database['public']['Tables']['ipl_players']['Row']
type IPLTeam = Database['public']['Tables']['matches']['Row']['team_a']

interface PlayerStat {
  player_id: string
  runs_scored: number
  wickets: number
}

export default function AdminResults() {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({})
  const [winner, setWinner] = useState<Record<string, IPLTeam | ''>>({})
  const [stats, setStats] = useState<Record<string, Record<string, PlayerStat>>>({})
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [resetting, setResetting] = useState<Record<string, boolean>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from('matches').select('*').order('match_date', { ascending: false }),
      supabase.from('ipl_players').select('*').eq('is_active', true).order('team').order('name'),
    ])
    setMatches(m ?? [])
    setPlayers(p ?? [])
  }

  const upcoming = matches.filter(m => m.status !== 'completed')
  const completed = matches.filter(m => m.status === 'completed')
  const visibleMatches = tab === 'upcoming' ? upcoming : completed

  function getMatchPlayers(match: Match) {
    return players.filter(p => p.team === match.team_a || p.team === match.team_b)
  }

  async function loadMatchStats(matchId: string) {
    setLoadingStats(prev => ({ ...prev, [matchId]: true }))
    const { data } = await supabase
      .from('player_match_stats')
      .select('player_id, runs_scored, wickets')
      .eq('match_id', matchId)
    if (data?.length) {
      const mapped: Record<string, PlayerStat> = {}
      for (const row of data) {
        mapped[row.player_id] = { player_id: row.player_id, runs_scored: row.runs_scored ?? 0, wickets: row.wickets ?? 0 }
      }
      setStats(prev => ({ ...prev, [matchId]: { ...(prev[matchId] ?? {}), ...mapped } }))
    }
    setLoadingStats(prev => ({ ...prev, [matchId]: false }))
  }

  function updateStat(matchId: string, playerId: string, field: 'runs_scored' | 'wickets', value: number) {
    setStats(prev => {
      const existing: PlayerStat = prev[matchId]?.[playerId] ?? { player_id: playerId, runs_scored: 0, wickets: 0 }
      return { ...prev, [matchId]: { ...prev[matchId], [playerId]: { ...existing, [field]: value } } }
    })
  }

  function getStatValue(matchId: string, playerId: string, field: 'runs_scored' | 'wickets'): number {
    return stats[matchId]?.[playerId]?.[field] ?? 0
  }

  async function saveResults(matchId: string) {
    const w = winner[matchId] || (matches.find(m => m.id === matchId)?.match_winner as IPLTeam)
    if (!w) return

    startTransition(async () => {
      try {
        const { error: matchErr } = await supabase.from('matches').update({ match_winner: w, status: 'completed' }).eq('id', matchId)
        if (matchErr) { alert('Match update failed: ' + matchErr.message); return }

        const matchStats = stats[matchId] ?? {}
        for (const stat of Object.values(matchStats)) {
          if (stat.player_id) {
            await supabase.from('player_match_stats').upsert({
              player_id: stat.player_id, match_id: matchId,
              runs_scored: stat.runs_scored, wickets: stat.wickets,
            }, { onConflict: 'player_id,match_id' })
          }
        }

        const res = await fetch('/api/scoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId }),
        })
        const result = await res.json()
        if (!result.success) { alert('Scoring failed: ' + (result.error ?? JSON.stringify(result))); return }

        setSaved(prev => ({ ...prev, [matchId]: true }))
        setTimeout(() => setSaved(prev => ({ ...prev, [matchId]: false })), 3000)
        loadData()
      } catch (e: any) {
        alert('Error: ' + (e?.message ?? String(e)))
      }
    })
  }

  async function resetMatch(matchId: string) {
    if (!confirm('Reset this match? This will clear scores, stats, and predictions for all users.')) return
    setResetting(prev => ({ ...prev, [matchId]: true }))
    try {
      const res = await fetch('/api/admin/reset-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })
      const result = await res.json()
      if (!result.success) alert('Reset failed: ' + (result.error ?? 'Unknown error'))
      else { setExpanded(null); loadData() }
    } catch (e: any) {
      alert('Reset error: ' + e.message)
    }
    setResetting(prev => ({ ...prev, [matchId]: false }))
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Enter Results</h1>
      <p className="text-sm text-dark-muted mb-4">Enter match winner + player stats. Scores update for all users automatically.</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-dark-elevated rounded-xl p-1 w-fit">
        {(['upcoming', 'completed'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setExpanded(null) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize
              ${tab === t ? 'bg-dark-card text-white shadow' : 'text-dark-muted hover:text-white'}`}
          >
            {t} ({t === 'upcoming' ? upcoming.length : completed.length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleMatches.map(match => {
          const isOpen = expanded === match.id
          const matchPlayers = getMatchPlayers(match)
          const teamAPlayers = matchPlayers.filter(p => p.team === match.team_a)
          const teamBPlayers = matchPlayers.filter(p => p.team === match.team_b)
          const currentWinner = winner[match.id] ?? match.match_winner ?? ''

          return (
            <div key={match.id} className="glass rounded-xl border border-dark-border overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-dark-elevated transition-colors"
                onClick={() => {
                  const next = isOpen ? null : match.id
                  setExpanded(next)
                  if (next && !stats[next]) loadMatchStats(next)
                }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium shrink-0
                    ${match.status === 'completed' ? 'bg-dark-elevated text-dark-muted' : match.status === 'live' ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-cyan/10 text-neon-cyan'}`}>
                    {match.status}
                  </span>
                  <TeamLogo team={match.team_a} size="xs" />
                  <span className="text-sm font-semibold text-white">{match.team_a} vs {match.team_b}</span>
                  <TeamLogo team={match.team_b} size="xs" />
                  <span className="text-xs text-dark-muted hidden sm:block">{formatMatchDate(match.match_date)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {match.match_winner && <span className="text-xs text-neon-gold font-semibold">Won: {match.match_winner}</span>}
                  {isOpen ? <ChevronUp className="w-4 h-4 text-dark-muted" /> : <ChevronDown className="w-4 h-4 text-dark-muted" />}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-white/5 px-4 pb-5 pt-4 space-y-5">
                  {loadingStats[match.id] && (
                    <div className="flex items-center gap-2 text-xs text-dark-muted">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading existing stats…
                    </div>
                  )}

                  <div className="max-w-xs">
                    <label className="block text-xs text-dark-muted mb-1.5">Match Winner *</label>
                    <select
                      value={currentWinner}
                      onChange={e => setWinner(p => ({ ...p, [match.id]: e.target.value as IPLTeam }))}
                      className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon-green/50"
                    >
                      <option value="">-- Select winner --</option>
                      <option value={match.team_a}>{match.team_a} — {IPL_TEAMS[match.team_a].name}</option>
                      <option value={match.team_b}>{match.team_b} — {IPL_TEAMS[match.team_b].name}</option>
                    </select>
                  </div>

                  {[{ team: match.team_a, teamPlayers: teamAPlayers }, { team: match.team_b, teamPlayers: teamBPlayers }].map(({ team, teamPlayers }) => (
                    <div key={team}>
                      <div className="flex items-center gap-2 mb-2">
                        <TeamLogo team={team} size="xs" />
                        <h3 className="text-xs font-bold text-white">{IPL_TEAMS[team].name}</h3>
                      </div>
                      <div className="space-y-1">
                        {teamPlayers.map(player => (
                          <div key={player.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-dark-elevated">
                            <span className="text-sm w-5 shrink-0">{ROLE_ICONS[player.role]}</span>
                            <span className="text-xs text-white flex-1 truncate">{player.name}</span>
                            <label className="text-xs text-dark-muted shrink-0">Runs</label>
                            <input
                              type="number" min="0"
                              value={getStatValue(match.id, player.id, 'runs_scored') || ''}
                              onChange={e => updateStat(match.id, player.id, 'runs_scored', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 bg-dark-elevated border border-dark-border rounded-lg text-center text-white text-xs py-1.5 focus:outline-none focus:border-neon-green/50 [appearance:textfield]"
                            />
                            <label className="text-xs text-dark-muted shrink-0">Wkts</label>
                            <input
                              type="number" min="0"
                              value={getStatValue(match.id, player.id, 'wickets') || ''}
                              onChange={e => updateStat(match.id, player.id, 'wickets', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 bg-dark-elevated border border-dark-border rounded-lg text-center text-white text-xs py-1.5 focus:outline-none focus:border-neon-green/50 [appearance:textfield]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => saveResults(match.id)}
                      disabled={isPending || !currentWinner}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                        ${saved[match.id]
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                          : currentWinner
                            ? 'bg-neon-green text-dark-base shadow-[0_0_20px_rgba(57,255,20,0.4)]'
                            : 'bg-dark-elevated text-dark-muted border border-dark-border cursor-not-allowed'
                        }`}
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved[match.id] ? <CheckCircle className="w-4 h-4" /> : null}
                      {saved[match.id] ? 'Saved!' : 'Save & Score All'}
                    </button>

                    <button
                      onClick={() => resetMatch(match.id)}
                      disabled={resetting[match.id]}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {resetting[match.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      Reset Match
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {visibleMatches.length === 0 && (
          <div className="text-center py-12 text-dark-muted text-sm">No {tab} matches.</div>
        )}
      </div>
    </div>
  )
}
