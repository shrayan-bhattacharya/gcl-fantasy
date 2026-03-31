'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle, Zap, Search } from 'lucide-react'

interface SyncResult {
  ok: boolean
  message: string
  detail?: string
  missing?: string[]   // players whose stats could not be found by AI
  raw?: any
}

function ResultBadge({ result }: { result: SyncResult }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="mt-3 space-y-2"
      >
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
          result.ok ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {result.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <div>
            <p className="font-medium">{result.message}</p>
            {result.detail && <p className="text-xs opacity-70 mt-0.5">{result.detail}</p>}
          </div>
        </div>
        {result.missing && result.missing.length > 0 && (
          <div className="flex items-start gap-2 text-sm px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Stats not found for {result.missing.length} player{result.missing.length !== 1 ? 's' : ''} — add manually</p>
              <p className="text-xs opacity-70 mt-0.5">{result.missing.join(' · ')}</p>
            </div>
          </div>
        )}
        {result.raw !== undefined && (
          <pre className="text-[11px] text-dark-muted bg-dark-base border border-dark-border rounded-xl p-3 overflow-auto max-h-80 leading-relaxed whitespace-pre-wrap break-all">
            {JSON.stringify(result.raw, null, 2)}
          </pre>
        )}
      </motion.div>
    </AnimatePresence>
  )
}


export default function SyncPage() {
  const supabase = createClient()

  const [resetLoading, setResetLoading] = useState(false)
  const [resetResult, setResetResult] = useState<SyncResult | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)

  const [pendingMatches, setPendingMatches] = useState<any[]>([])
  const [retryResults, setRetryResults] = useState<Record<string, SyncResult | null>>({})
  const [retrying, setRetrying] = useState<Record<string, boolean>>({})
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({})

  const IPL_TEAMS = ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'SRH', 'PBKS', 'RR', 'LSG', 'GT']
  const [pickTeamA, setPickTeamA] = useState('MI')
  const [pickTeamB, setPickTeamB] = useState('RCB')
  const [matchPicks, setMatchPicks] = useState<any[] | null>(null)
  const [loadingPicks, setLoadingPicks] = useState(false)

  useEffect(() => {
    loadPending()
  }, [])

  async function loadPending() {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('matches')
      .select('id, team_a, team_b, match_date, status, sync_status, sync_error')
      .lt('match_date', fiveHoursAgo)
      .order('match_date', { ascending: false })
    setPendingMatches(data ?? [])
  }

  async function retrySync(matchId: string) {
    setRetrying(prev => ({ ...prev, [matchId]: true }))
    setRetryResults(prev => ({ ...prev, [matchId]: null }))
    setSyncStatus(prev => ({ ...prev, [matchId]: '' }))

    try {
      const match = pendingMatches.find(m => m.id === matchId)
      if (!match) throw new Error('Match not found')

      // Resolve which players to look up — only those picked in fantasy teams for these two match teams
      const { data: fantasyTeams } = await supabase
        .from('fantasy_teams')
        .select('batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id')
      const pickedIds = [...new Set(
        (fantasyTeams ?? []).flatMap((t: any) => [t.batsman_1_id, t.batsman_2_id, t.bowler_1_id, t.bowler_2_id, t.flex_player_id]).filter(Boolean)
      )]
      const { data: pickedPlayers } = pickedIds.length
        ? await supabase.from('ipl_players').select('name, team, role').in('id', pickedIds).in('team', [match.team_a, match.team_b])
        : { data: [] }
      const targetPlayers = (pickedPlayers ?? []).map((p: any) => ({ name: p.name, team: p.team, role: p.role }))

      // Step 1: Web search (server-side, up to 60s)
      setSyncStatus(prev => ({ ...prev, [matchId]: `Step 1/3 — Searching for ${targetPlayers.length} players...` }))
      const searchRes = await fetch('/api/sync/search-scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamA: match.team_a, teamB: match.team_b, matchDate: match.match_date, targetPlayers }),
      })
      const searchJson = await searchRes.json()
      if (!searchRes.ok) throw new Error(searchJson.error || 'Search failed')

      // Step 2: Extract structured data (server-side, up to 60s)
      setSyncStatus(prev => ({ ...prev, [matchId]: 'Step 2/3 — Extracting player stats...' }))
      const extractRes = await fetch('/api/sync/extract-scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative: searchJson.narrative, targetPlayers }),
      })
      const extractJson = await extractRes.json()
      if (!extractRes.ok) throw new Error(extractJson.error || 'Extraction failed')
      const missingPlayers: string[] = extractJson.scorecard?.missing ?? []

      // Step 3: Run scoring pipeline (server-side, fast)
      setSyncStatus(prev => ({ ...prev, [matchId]: 'Step 3/3 — Scoring fantasy teams...' }))
      const scoreRes = await fetch('/api/sync/scorecard-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, scorecard: extractJson.scorecard }),
      })
      const scoreJson = await scoreRes.json()
      if (!scoreRes.ok) {
        setRetryResults(prev => ({ ...prev, [matchId]: { ok: false, message: 'Scoring failed', detail: scoreJson.error, missing: missingPlayers, raw: scoreJson } }))
      } else {
        const unmatchedNote = scoreJson.unmatched?.length ? `${scoreJson.unmatched.length} unmatched: ${scoreJson.unmatched.join(', ')}` : undefined
        setRetryResults(prev => ({ ...prev, [matchId]: {
          ok: true,
          message: `Synced — ${scoreJson.statsUpserted} players · ${scoreJson.fantasyTeamsScored} teams scored`,
          detail: unmatchedNote,
          missing: missingPlayers,
          raw: scoreJson,
        }}))
        loadPending()
      }
    } catch (e: any) {
      setRetryResults(prev => ({ ...prev, [matchId]: { ok: false, message: 'Sync failed', detail: e.message } }))
    }
    setRetrying(prev => ({ ...prev, [matchId]: false }))
    setSyncStatus(prev => ({ ...prev, [matchId]: '' }))
  }

  async function fullResetResync() {
    setResetLoading(true)
    setResetResult(null)
    setResetConfirm(false)
    try {
      const res = await fetch('/api/sync/squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      })
      const json = await res.json()
      if (!res.ok) setResetResult({ ok: false, message: 'Reset failed', detail: json.error, raw: json })
      else setResetResult({ ok: true, message: `Reset complete — ${json.deduped} players synced`, detail: `${json.upserted} rows upserted · ${json.duplicates?.length ?? 0} duplicates removed`, raw: json })
    } catch (e: any) {
      setResetResult({ ok: false, message: 'Network error', detail: e.message })
    }
    setResetLoading(false)
  }

  async function loadMatchPicks() {
    setLoadingPicks(true)
    setMatchPicks(null)
    const { data: fantasyTeams } = await supabase
      .from('fantasy_teams')
      .select('batsman_1_id, batsman_2_id, bowler_1_id, bowler_2_id, flex_player_id, user_id')
    const pickCount: Record<string, Set<string>> = {}
    for (const t of fantasyTeams ?? []) {
      for (const pid of [t.batsman_1_id, t.batsman_2_id, t.bowler_1_id, t.bowler_2_id, t.flex_player_id]) {
        if (pid) {
          if (!pickCount[pid]) pickCount[pid] = new Set()
          pickCount[pid].add(t.user_id)
        }
      }
    }
    const pickedIds = Object.keys(pickCount)
    if (!pickedIds.length) { setMatchPicks([]); setLoadingPicks(false); return }
    const { data: players } = await supabase
      .from('ipl_players')
      .select('id, name, team, role')
      .in('id', pickedIds)
      .in('team', [pickTeamA, pickTeamB])
    const result = (players ?? [])
      .map(p => ({ ...p, times_picked: pickCount[p.id]?.size ?? 0 }))
      .sort((a, b) => b.times_picked - a.times_picked || a.team.localeCompare(b.team) || a.name.localeCompare(b.name))
    setMatchPicks(result)
    setLoadingPicks(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Sync
        </h1>
        <p className="text-dark-muted text-sm mt-1">Manage IPL 2026 data — use the tools below to sync scorecards and player data.</p>
      </div>

      {/* Scorecard sync */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border border-dark-border rounded-2xl p-6"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-neon-green" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Scorecard Sync</h3>
            <p className="text-dark-muted text-sm mt-0.5">
              Uses AI to search the web for scorecards. 3-step process — may take 1-2 minutes total.
            </p>
          </div>
          <button
            onClick={loadPending}
            className="text-xs text-dark-muted hover:text-white transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {pendingMatches.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-neon-green px-3 py-2 rounded-lg bg-neon-green/10 border border-neon-green/20">
            <CheckCircle className="w-4 h-4 shrink-0" />
            No past matches yet
          </div>
        ) : (
          <div className="space-y-3">
            {pendingMatches.map(match => (
              <div key={match.id} className="border border-dark-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{match.team_a} vs {match.team_b}</span>
                    <span className="text-xs text-dark-muted">{new Date(match.match_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    {match.sync_status === 'synced' && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-neon-green/10 text-neon-green border border-neon-green/20">synced</span>
                    )}
                    {match.sync_status === 'failed' && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">failed</span>
                    )}
                    {match.status === 'completed' && !match.sync_status && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-dark-elevated text-dark-muted border border-dark-border">manual</span>
                    )}
                  </div>
                  <button
                    onClick={() => retrySync(match.id)}
                    disabled={retrying[match.id]}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-neon-green text-dark-base disabled:opacity-60 hover:brightness-110 transition-all shrink-0"
                    style={{ boxShadow: '0 0 12px rgba(57,255,20,0.2)' }}
                  >
                    {retrying[match.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    {retrying[match.id] ? (syncStatus[match.id] || 'Syncing...') : 'Sync Now'}
                  </button>
                </div>
                {match.sync_error && !retryResults[match.id] && (
                  <p className="text-xs text-red-400 opacity-80">{match.sync_error}</p>
                )}
                {retryResults[match.id] && <ResultBadge result={retryResults[match.id]!} />}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Match picks lookup */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border border-dark-border rounded-2xl p-6"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-neon-blue" />
          </div>
          <div>
            <h3 className="text-white font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Fantasy Picks by Match</h3>
            <p className="text-dark-muted text-sm mt-0.5">See which players from two teams are picked across all fantasy squads.</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap items-center mb-4">
          <select
            value={pickTeamA}
            onChange={e => setPickTeamA(e.target.value)}
            className="bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-blue/50"
          >
            {IPL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-dark-muted text-sm">vs</span>
          <select
            value={pickTeamB}
            onChange={e => setPickTeamB(e.target.value)}
            className="bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-blue/50"
          >
            {IPL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={loadMatchPicks}
            disabled={loadingPicks || pickTeamA === pickTeamB}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-neon-blue text-white disabled:opacity-60 hover:brightness-110 transition-all"
            style={{ boxShadow: '0 0 16px rgba(0,102,204,0.3)' }}
          >
            {loadingPicks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loadingPicks ? 'Loading...' : 'Load Picks'}
          </button>
        </div>
        {matchPicks && (
          matchPicks.length === 0 ? (
            <p className="text-sm text-dark-muted">No players from these teams have been picked yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-dark-muted border-b border-dark-border">
                    <th className="text-left py-2 pr-4">Player</th>
                    <th className="text-left py-2 pr-4">Team</th>
                    <th className="text-left py-2 pr-4">Role</th>
                    <th className="text-right py-2">Picks</th>
                  </tr>
                </thead>
                <tbody>
                  {matchPicks.map(p => (
                    <tr key={p.id} className="border-b border-dark-border/40 hover:bg-dark-elevated transition-colors">
                      <td className="py-2 pr-4 text-white font-medium">{p.name}</td>
                      <td className="py-2 pr-4 text-dark-muted">{p.team}</td>
                      <td className="py-2 pr-4 text-dark-muted capitalize">{p.role}</td>
                      <td className="py-2 text-right font-bold text-neon-blue">{p.times_picked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </motion.div>

      {/* Full Reset */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-red-500/30 bg-red-500/5 rounded-2xl p-6"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Full Reset + Resync Players</h3>
            <p className="text-dark-muted text-sm mt-0.5">Wipes <code className="text-red-400">ipl_players</code>, <code className="text-red-400">fantasy_teams</code>, <code className="text-red-400">fantasy_scores</code>, <code className="text-red-400">player_match_stats</code> and re-imports all squads. Use only if player data is completely broken.</p>
          </div>
        </div>
        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            disabled={resetLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white disabled:opacity-60 hover:bg-red-500 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            Full Reset + Resync
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-red-400 font-medium">This wipes all player + fantasy data. Are you sure?</span>
            <button
              onClick={fullResetResync}
              disabled={resetLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition-all disabled:opacity-60"
            >
              {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {resetLoading ? 'Resetting...' : 'Yes, wipe and resync'}
            </button>
            <button onClick={() => setResetConfirm(false)} className="text-sm text-dark-muted hover:text-white transition-colors">Cancel</button>
          </div>
        )}
        {resetResult && <ResultBadge result={resetResult} />}
      </motion.div>

      {/* Help */}
      <div className="glass border border-dark-border/50 rounded-2xl p-5 text-sm text-dark-muted space-y-2">
        <p className="text-white font-semibold text-sm">How it works</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li><strong className="text-white">Step 1</strong> — AI searches the web for the match scorecard (~30s)</li>
          <li><strong className="text-white">Step 2</strong> — Extracts structured player stats from search results (~15s)</li>
          <li><strong className="text-white">Step 3</strong> — Updates match result, player stats, fantasy scores, predictions (~5s)</li>
          <li>If stats are wrong: <strong className="text-white">Enter Results</strong> → expand match → edit any field → save</li>
        </ol>
      </div>
    </div>
  )
}
