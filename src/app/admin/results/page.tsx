'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IPL_TEAMS, ROLE_ICONS } from '@/constants/ipl'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { formatMatchDate } from '@/lib/utils'
import { Loader2, CheckCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Match = Database['public']['Tables']['matches']['Row']
type Player = Database['public']['Tables']['ipl_players']['Row']
type IPLTeam = Database['public']['Tables']['matches']['Row']['team_a']

interface PlayerStat {
  player_id: string
  runs_scored: number
  balls_faced: number
  fours: number
  sixes: number
  wickets: number
  catches: number
  stumpings: number
  run_outs: number
  maiden_overs: number
}

export default function AdminResults() {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({})
  const [winner, setWinner] = useState<Record<string, IPLTeam | ''>>({})
  const [tossWinner, setTossWinner] = useState<Record<string, IPLTeam | ''>>({})
  const [tossDecision, setTossDecision] = useState<Record<string, 'bat' | 'bowl'>>({})
  const [stats, setStats] = useState<Record<string, Record<string, PlayerStat>>>({})
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [scoring, setScoring] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from('matches').select('*').order('match_date', { ascending: false }),
      supabase.from('ipl_players').select('*').eq('is_active', true).order('team').order('name'),
    ])
    setMatches(m ?? [])
    setPlayers(p ?? [])
  }

  function getMatchPlayers(match: Match) {
    return players.filter(p => p.team === match.team_a || p.team === match.team_b)
  }

  async function loadMatchStats(matchId: string) {
    setLoadingStats(prev => ({ ...prev, [matchId]: true }))
    const { data } = await supabase
      .from('player_match_stats')
      .select('player_id, runs_scored, balls_faced, fours, sixes, wickets, catches, stumpings, run_outs, maiden_overs')
      .eq('match_id', matchId)
    if (data?.length) {
      const mapped: Record<string, PlayerStat> = {}
      for (const row of data) {
        mapped[row.player_id] = {
          player_id: row.player_id,
          runs_scored: row.runs_scored ?? 0,
          balls_faced: row.balls_faced ?? 0,
          fours: row.fours ?? 0,
          sixes: row.sixes ?? 0,
          wickets: row.wickets ?? 0,
          catches: row.catches ?? 0,
          stumpings: row.stumpings ?? 0,
          run_outs: row.run_outs ?? 0,
          maiden_overs: row.maiden_overs ?? 0,
        }
      }
      setStats(prev => ({ ...prev, [matchId]: { ...(prev[matchId] ?? {}), ...mapped } }))
    }
    setLoadingStats(prev => ({ ...prev, [matchId]: false }))
  }

  function updateStat(matchId: string, playerId: string, field: keyof PlayerStat, value: number) {
    setStats(prev => {
      const existing: PlayerStat = prev[matchId]?.[playerId] ?? {
        player_id: playerId,
        runs_scored: 0, balls_faced: 0, fours: 0, sixes: 0,
        wickets: 0, catches: 0, stumpings: 0, run_outs: 0, maiden_overs: 0,
      }
      return {
        ...prev,
        [matchId]: {
          ...prev[matchId],
          [playerId]: { ...existing, [field]: value },
        },
      }
    })
  }

  function getStatValue(matchId: string, playerId: string, field: keyof PlayerStat): number {
    const val = stats[matchId]?.[playerId]?.[field]
    return typeof val === 'number' ? val : 0
  }

  async function saveResults(matchId: string) {
    const w = winner[matchId]
    if (!w) return

    startTransition(async () => {
      // 1. Update match winner + status (toss stored for reference only)
      await supabase.from('matches').update({
        match_winner: w || null,
        status: 'completed',
      }).eq('id', matchId)

      // 2. Upsert player stats
      const matchStats = stats[matchId] ?? {}
      for (const stat of Object.values(matchStats)) {
        if (stat.player_id) {
          await supabase.from('player_match_stats').upsert({
            player_id: stat.player_id,
            match_id: matchId,
            runs_scored: stat.runs_scored,
            balls_faced: stat.balls_faced,
            fours: stat.fours,
            sixes: stat.sixes,
            wickets: stat.wickets,
            catches: stat.catches,
            stumpings: stat.stumpings,
            run_outs: stat.run_outs,
          }, { onConflict: 'player_id,match_id' })
        }
      }

      // 3. Score predictions for this match
      await scorePredictions(matchId, w)

      setSaved(prev => ({ ...prev, [matchId]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [matchId]: false })), 3000)
      loadData()
    })
  }

  async function scorePredictions(matchId: string, matchWinner: string) {
    const { data: preds } = await supabase
      .from('predictions')
      .select('id, user_id, predicted_match_winner')
      .eq('match_id', matchId)
      .eq('is_scored', false)

    if (!preds?.length) return

    for (const pred of preds) {
      const pts = pred.predicted_match_winner === matchWinner ? 50 : 0

      await supabase.from('predictions').update({ points_earned: pts, is_scored: true }).eq('id', pred.id)
      if (pts > 0) {
        const { data: u } = await supabase.from('users').select('prediction_score, total_score').eq('id', pred.user_id).single()
        if (u) {
          await supabase.from('users').update({
            prediction_score: u.prediction_score + pts,
            total_score: u.total_score + pts,
          }).eq('id', pred.user_id)
        }
      }
    }
  }

  async function triggerFantasyScoring(matchId: string) {
    setScoring(prev => ({ ...prev, [matchId]: true }))
    try {
      const res = await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })
      const result = await res.json()
      if (result.success) {
        alert(`Fantasy scoring complete! Processed ${result.teamsScored} teams.`)
      } else {
        alert('Scoring failed: ' + (result.error ?? 'Unknown error'))
      }
    } catch {
      alert('Failed to trigger scoring')
    }
    setScoring(prev => ({ ...prev, [matchId]: false }))
  }

  const STAT_FIELDS: { key: keyof PlayerStat; label: string; short: string }[] = [
    { key: 'runs_scored', label: 'Runs', short: 'R' },
    { key: 'balls_faced', label: 'Balls', short: 'B' },
    { key: 'fours', label: '4s', short: '4' },
    { key: 'sixes', label: '6s', short: '6' },
    { key: 'wickets', label: 'Wkts', short: 'W' },
    { key: 'catches', label: 'Ct', short: 'Ct' },
    { key: 'stumpings', label: 'St', short: 'St' },
    { key: 'run_outs', label: 'RO', short: 'RO' },
    { key: 'maiden_overs', label: 'Maidens', short: 'M' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Enter Results</h1>
      <p className="text-sm text-dark-muted mb-6">Enter match winner + player stats. Prediction scores are calculated automatically.</p>

      <div className="space-y-3">
        {matches.map(match => {
          const isOpen = expanded === match.id
          const matchPlayers = getMatchPlayers(match)
          const teamAPlayers = matchPlayers.filter(p => p.team === match.team_a)
          const teamBPlayers = matchPlayers.filter(p => p.team === match.team_b)

          return (
            <div key={match.id} className="glass rounded-xl border border-dark-border overflow-hidden">
              {/* Header */}
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
                  {match.match_winner && (
                    <span className="text-xs text-neon-gold font-semibold">Won: {match.match_winner}</span>
                  )}
                  {isOpen ? <ChevronUp className="w-4 h-4 text-dark-muted" /> : <ChevronDown className="w-4 h-4 text-dark-muted" />}
                </div>
              </div>

              {/* Expanded form */}
              {isOpen && (
                <div className="border-t border-white/5 px-4 pb-5 pt-4 space-y-5">
                  {loadingStats[match.id] && (
                    <div className="flex items-center gap-2 text-xs text-dark-muted">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading existing stats…
                    </div>
                  )}
                  {/* Winner + Toss */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-dark-muted mb-1.5">Match Winner *</label>
                      <select
                        value={winner[match.id] ?? match.match_winner ?? ''}
                        onChange={e => setWinner(p => ({ ...p, [match.id]: e.target.value as IPLTeam }))}
                        className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon-green/50"
                      >
                        <option value="">-- Select winner --</option>
                        <option value={match.team_a}>{match.team_a} — {IPL_TEAMS[match.team_a].name}</option>
                        <option value={match.team_b}>{match.team_b} — {IPL_TEAMS[match.team_b].name}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-dark-muted mb-1.5">Toss Winner</label>
                      <select
                        value={tossWinner[match.id] ?? match.toss_winner ?? ''}
                        onChange={e => setTossWinner(p => ({ ...p, [match.id]: e.target.value as IPLTeam }))}
                        className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon-green/50"
                      >
                        <option value="">-- Select toss winner --</option>
                        <option value={match.team_a}>{match.team_a}</option>
                        <option value={match.team_b}>{match.team_b}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-dark-muted mb-1.5">Toss Decision</label>
                      <select
                        value={tossDecision[match.id] ?? match.toss_decision ?? ''}
                        onChange={e => setTossDecision(p => ({ ...p, [match.id]: e.target.value as 'bat' | 'bowl' }))}
                        className="w-full bg-dark-elevated border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon-green/50"
                      >
                        <option value="">-- Chose to --</option>
                        <option value="bat">Bat</option>
                        <option value="bowl">Bowl</option>
                      </select>
                    </div>
                  </div>

                  {/* Player stats */}
                  {[{ team: match.team_a, teamPlayers: teamAPlayers }, { team: match.team_b, teamPlayers: teamBPlayers }].map(({ team, teamPlayers }) => (
                    <div key={team}>
                      <div className="flex items-center gap-2 mb-2">
                        <TeamLogo team={team} size="xs" />
                        <h3 className="text-xs font-bold text-white">{IPL_TEAMS[team].name}</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-dark-muted">
                              <th className="text-left py-1.5 pr-3 font-medium min-w-[140px]">Player</th>
                              {STAT_FIELDS.map(f => (
                                <th key={f.key} className="text-center px-1 py-1.5 font-medium min-w-[40px]">{f.short}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {teamPlayers.map(player => (
                              <tr key={player.id} className="hover:bg-dark-elevated">
                                <td className="py-2 pr-3">
                                  <div className="flex items-center gap-1.5">
                                    <span>{ROLE_ICONS[player.role]}</span>
                                    <span className="text-white font-medium truncate max-w-[110px]">{player.name}</span>
                                  </div>
                                </td>
                                {STAT_FIELDS.map(f => (
                                  <td key={f.key} className="px-1 py-1.5 text-center">
                                    <input
                                      type="number" min="0"
                                      value={getStatValue(match.id, player.id, f.key) || ''}
                                      onChange={e => updateStat(match.id, player.id, f.key, parseInt(e.target.value) || 0)}
                                      className="w-10 bg-dark-elevated border border-dark-border rounded-lg text-center text-white text-xs py-1 focus:outline-none focus:border-neon-green/50 [appearance:textfield]"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => saveResults(match.id)}
                      disabled={isPending || !winner[match.id]}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                        ${saved[match.id]
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                          : winner[match.id]
                            ? 'bg-neon-green text-dark-base shadow-[0_0_20px_rgba(57,255,20,0.4)]'
                            : 'bg-dark-elevated text-dark-muted border border-dark-border cursor-not-allowed'
                        }`}
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved[match.id] ? <CheckCircle className="w-4 h-4" /> : null}
                      {saved[match.id] ? 'Results Saved! Predictions Scored.' : 'Save Results + Score Predictions'}
                    </button>

                    <button
                      onClick={() => triggerFantasyScoring(match.id)}
                      disabled={scoring[match.id] || match.status !== 'completed'}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 hover:bg-neon-cyan/20 transition-colors disabled:opacity-50"
                    >
                      {scoring[match.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Calculate Fantasy Points
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {matches.length === 0 && (
          <div className="text-center py-12 text-dark-muted text-sm">No matches yet. Add matches first.</div>
        )}
      </div>
    </div>
  )
}
