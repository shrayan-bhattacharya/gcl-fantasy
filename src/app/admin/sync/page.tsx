'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Users, BarChart2, CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle, Zap } from 'lucide-react'

interface SyncResult {
  ok: boolean
  message: string
  detail?: string
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
        {result.raw !== undefined && (
          <pre className="text-[11px] text-dark-muted bg-dark-base border border-dark-border rounded-xl p-3 overflow-auto max-h-80 leading-relaxed whitespace-pre-wrap break-all">
            {JSON.stringify(result.raw, null, 2)}
          </pre>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function SyncCard({ icon: Icon, title, description, children }: {
  icon: any; title: string; description: string; children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass border border-dark-border rounded-2xl p-6"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-neon-green" />
        </div>
        <div>
          <h3 className="text-white font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>{title}</h3>
          <p className="text-dark-muted text-sm mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </motion.div>
  )
}

export default function SyncPage() {
  const supabase = createClient()

  // Full reset
  const [resetLoading, setResetLoading] = useState(false)
  const [resetResult, setResetResult] = useState<SyncResult | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)

  // Schedule sync
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleResult, setScheduleResult] = useState<SyncResult | null>(null)

  // Squad sync
  const [squadLoading, setSquadLoading] = useState(false)
  const [squadResult, setSquadResult] = useState<SyncResult | null>(null)
  const [squadTeam, setSquadTeam] = useState('all')

  // Pending scorecard sync
  const [pendingMatches, setPendingMatches] = useState<any[]>([])
  const [retryResults, setRetryResults] = useState<Record<string, SyncResult | null>>({})
  const [retrying, setRetrying] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadPending()
  }, [])

  async function loadPending() {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    const [{ data: overdue }, { data: failed }] = await Promise.all([
      supabase
        .from('matches')
        .select('id, team_a, team_b, match_date, status, sync_status, sync_error')
        .lt('match_date', fiveHoursAgo)
        .neq('status', 'completed')
        .order('match_date', { ascending: false }),
      supabase
        .from('matches')
        .select('id, team_a, team_b, match_date, status, sync_status, sync_error')
        .eq('sync_status', 'failed')
        .order('match_date', { ascending: false }),
    ])
    const combined = [...(overdue ?? []), ...(failed ?? [])]
    const unique = combined.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
    setPendingMatches(unique)
  }

  async function retrySync(matchId: string) {
    setRetrying(prev => ({ ...prev, [matchId]: true }))
    setRetryResults(prev => ({ ...prev, [matchId]: null }))
    try {
      const res = await fetch('/api/sync/scorecard-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setRetryResults(prev => ({ ...prev, [matchId]: { ok: false, message: 'Sync failed', detail: json.error, raw: json } }))
      } else {
        const unmatchedNote = json.unmatched?.length ? `${json.unmatched.length} unmatched: ${json.unmatched.join(', ')}` : undefined
        setRetryResults(prev => ({ ...prev, [matchId]: {
          ok: true,
          message: `Synced — ${json.statsUpserted} players · ${json.fantasyTeamsScored} teams scored`,
          detail: unmatchedNote,
          raw: json,
        }}))
        loadPending()
      }
    } catch (e: any) {
      setRetryResults(prev => ({ ...prev, [matchId]: { ok: false, message: 'Network error', detail: e.message } }))
    }
    setRetrying(prev => ({ ...prev, [matchId]: false }))
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

  async function syncSchedule() {
    setScheduleLoading(true)
    setScheduleResult(null)
    try {
      const res = await fetch('/api/sync/schedule', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) setScheduleResult({ ok: false, message: 'Sync failed', detail: json.error, raw: json })
      else setScheduleResult({ ok: true, message: `Synced ${json.synced} matches`, detail: `${json.upserted ?? json.synced} rows upserted`, raw: json })
    } catch (e: any) {
      setScheduleResult({ ok: false, message: 'Network error', detail: e.message })
    }
    setScheduleLoading(false)
  }

  async function syncSquads() {
    setSquadLoading(true)
    setSquadResult(null)
    try {
      const res = await fetch('/api/sync/squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: squadTeam === 'all' ? undefined : squadTeam }),
      })
      const json = await res.json()
      if (!res.ok) setSquadResult({ ok: false, message: 'Sync failed', detail: json.error, raw: json })
      else setSquadResult({ ok: true, message: `Synced ${json.deduped ?? json.synced} players`, detail: `${json.raw} raw · ${json.duplicates?.length ?? 0} dupes removed · Team: ${json.team}`, raw: json })
    } catch (e: any) {
      setSquadResult({ ok: false, message: 'Network error', detail: e.message })
    }
    setSquadLoading(false)
  }


  const IPL_TEAMS = ['all', 'CSK', 'MI', 'RCB', 'KKR', 'DC', 'SRH', 'PBKS', 'RR', 'LSG', 'GT']

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
          CricAPI Sync
        </h1>
        <p className="text-dark-muted text-sm mt-1">Pull live IPL 2026 data from CricAPI (cricketdata.org) into your database.</p>
      </div>

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
            <h3 className="text-white font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Full Reset + Resync</h3>
            <p className="text-dark-muted text-sm mt-0.5">Wipes ipl_players, fantasy_teams, fantasy_scores, player_match_stats — then re-syncs all squads from CricAPI. Use in emergencies only.</p>
          </div>
        </div>
        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            disabled={resetLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white disabled:opacity-60 hover:bg-red-500 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            Full Reset + Resync Players
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-400 font-medium">This will wipe all player + fantasy data. Sure?</span>
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

      {/* Schedule */}
      <SyncCard icon={Calendar} title="Sync Schedule" description="Pull all IPL 2026 match fixtures, venues, and results from CricAPI.">
        <button
          onClick={syncSchedule}
          disabled={scheduleLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-neon-green text-dark-base disabled:opacity-60 hover:brightness-110 transition-all"
          style={{ boxShadow: '0 0 16px rgba(57,255,20,0.3)' }}
        >
          {scheduleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scheduleLoading ? 'Syncing...' : 'Sync Full Schedule'}
        </button>
        {scheduleResult && <ResultBadge result={scheduleResult} />}
      </SyncCard>

      {/* Squads */}
      <SyncCard icon={Users} title="Sync Player Squads" description="Import all team rosters with player roles from CricAPI. Deduplicates by name automatically.">
        <div className="flex gap-3 flex-wrap">
          <select
            value={squadTeam}
            onChange={e => setSquadTeam(e.target.value)}
            className="bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-green/50"
          >
            {IPL_TEAMS.map(t => (
              <option key={t} value={t}>{t === 'all' ? 'All Teams' : t}</option>
            ))}
          </select>
          <button
            onClick={syncSquads}
            disabled={squadLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-neon-green text-dark-base disabled:opacity-60 hover:brightness-110 transition-all"
            style={{ boxShadow: '0 0 16px rgba(57,255,20,0.3)' }}
          >
            {squadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {squadLoading ? 'Syncing...' : 'Sync Squads'}
          </button>
        </div>
        {squadResult && <ResultBadge result={squadResult} />}
      </SyncCard>

      {/* Scorecard sync — auto via cron, manual retry here */}
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
              Runs automatically every hour via cron — 5 hours after each match. Matches needing sync appear below.
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
            All completed matches have been synced
          </div>
        ) : (
          <div className="space-y-3">
            {pendingMatches.map(match => (
              <div key={match.id} className="border border-dark-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{match.team_a} vs {match.team_b}</span>
                    <span className="text-xs text-dark-muted">{new Date(match.match_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    {match.sync_status === 'failed' && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">failed</span>
                    )}
                  </div>
                  <button
                    onClick={() => retrySync(match.id)}
                    disabled={retrying[match.id]}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-neon-green text-dark-base disabled:opacity-60 hover:brightness-110 transition-all shrink-0"
                    style={{ boxShadow: '0 0 12px rgba(57,255,20,0.2)' }}
                  >
                    {retrying[match.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    {retrying[match.id] ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
                {match.sync_error && (
                  <p className="text-xs text-red-400 opacity-80">{match.sync_error}</p>
                )}
                {retryResults[match.id] && <ResultBadge result={retryResults[match.id]!} />}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Help */}
      <div className="glass border border-dark-border/50 rounded-2xl p-5 text-sm text-dark-muted space-y-2">
        <p className="text-white font-semibold text-sm">Setup checklist</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Run <code className="text-neon-green">migration_sync_status.sql</code> in Supabase SQL Editor (adds sync tracking columns)</li>
          <li>Add <code className="text-neon-green">CRON_SECRET</code> to Vercel env vars (any random string)</li>
          <li>Click <strong className="text-white">Sync Full Schedule</strong> — seeds match rows</li>
          <li>Click <strong className="text-white">Sync Squads (All Teams)</strong> — imports ~220 players, deduped by name</li>
          <li>Scorecards sync automatically 5 hours after each match via cron — or click <strong className="text-white">Sync Now</strong> above</li>
          <li>If stats are wrong: go to <strong className="text-white">Enter Results</strong> and edit manually</li>
          <li>If player duplicates appear: use <strong className="text-red-400">Full Reset + Resync</strong></li>
        </ol>
        <p className="text-xs pt-1">Scorecard data: Claude AI web search (ANTHROPIC_API_KEY)</p>
      </div>
    </div>
  )
}
