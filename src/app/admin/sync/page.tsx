'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Users, BarChart2, CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'

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

  // Scorecard sync
  const [scorecardLoading, setScorecardLoading] = useState(false)
  const [scorecardResult, setScorecardResult] = useState<SyncResult | null>(null)
  const [cricapiMatchId, setCricapiMatchId] = useState('')
  const [dbMatchId, setDbMatchId] = useState('')
  const [matches, setMatches] = useState<any[]>([])
  const [matchesLoaded, setMatchesLoaded] = useState(false)

  async function loadMatches() {
    const { data } = await supabase
      .from('matches')
      .select('id, team_a, team_b, match_date, cricapi_match_id, status')
      .not('cricapi_match_id', 'is', null)
      .order('match_date', { ascending: false })
    setMatches(data ?? [])
    setMatchesLoaded(true)
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

  async function syncScorecard() {
    if (!cricapiMatchId || !dbMatchId) return
    setScorecardLoading(true)
    setScorecardResult(null)
    try {
      const res = await fetch('/api/sync/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cricapiMatchId, matchId: dbMatchId }),
      })
      const json = await res.json()
      if (!res.ok) setScorecardResult({ ok: false, message: 'Sync failed', detail: json.error, raw: json })
      else setScorecardResult({
        ok: true,
        message: `Scorecard synced`,
        detail: `${json.statsUpserted} player stats · ${json.fantasyTeamsScored} fantasy teams scored · ${json.unmatchedPlayers ?? 0} unmatched`,
        raw: json,
      })
    } catch (e: any) {
      setScorecardResult({ ok: false, message: 'Network error', detail: e.message })
    }
    setScorecardLoading(false)
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

      {/* Scorecard */}
      <SyncCard icon={BarChart2} title="Sync Match Scorecard" description="Fetch a completed match scorecard and auto-calculate fantasy points.">
        <div className="space-y-3">
          {/* Match picker from DB */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-xs text-dark-muted font-medium">Select match</label>
              {!matchesLoaded && (
                <button onClick={loadMatches} className="text-xs text-neon-green underline">Load matches</button>
              )}
            </div>
            {matchesLoaded && (
              <select
                value={dbMatchId}
                onChange={e => {
                  setDbMatchId(e.target.value)
                  const m = matches.find(x => x.id === e.target.value)
                  if (m?.cricapi_match_id) setCricapiMatchId(String(m.cricapi_match_id))
                }}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-green/50"
              >
                <option value="">— pick a match —</option>
                {matches.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.team_a} vs {m.team_b} · {new Date(m.match_date).toLocaleDateString()} [{m.status}]
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Manual CricAPI match ID override */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">
              CricAPI Match ID
              <span className="text-dark-muted/50 ml-1 font-normal">(UUID — auto-filled when you pick a synced match above)</span>
            </label>
            <input
              type="text"
              value={cricapiMatchId}
              onChange={e => setCricapiMatchId(e.target.value)}
              placeholder="e.g. b39bbd39-c67f-4892-9a48-02e958946718"
              className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white text-sm placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-green/50"
            />
          </div>

          {!dbMatchId && (
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">DB Match ID (UUID)</label>
              <input
                type="text"
                value={dbMatchId}
                onChange={e => setDbMatchId(e.target.value)}
                placeholder="paste match UUID from Supabase"
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white text-sm placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-green/50"
              />
            </div>
          )}

          <button
            onClick={syncScorecard}
            disabled={scorecardLoading || !cricapiMatchId || !dbMatchId}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-neon-green text-dark-base disabled:opacity-40 hover:brightness-110 transition-all"
            style={{ boxShadow: '0 0 16px rgba(57,255,20,0.3)' }}
          >
            {scorecardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            {scorecardLoading ? 'Fetching scorecard...' : 'Fetch Scorecard + Score Fantasy'}
          </button>
        </div>
        {scorecardResult && <ResultBadge result={scorecardResult} />}
      </SyncCard>

      {/* Help */}
      <div className="glass border border-dark-border/50 rounded-2xl p-5 text-sm text-dark-muted space-y-2">
        <p className="text-white font-semibold text-sm">Setup checklist</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Run <code className="text-neon-green">migration_cricapi.sql</code> then <code className="text-neon-green">migration_unique_player_name.sql</code> in Supabase SQL Editor</li>
          <li>Click <strong className="text-white">Sync Full Schedule</strong> — pulls all IPL 2026 matches</li>
          <li>Click <strong className="text-white">Sync Squads (All Teams)</strong> — imports ~220 players, deduped by name</li>
          <li>After each match: <strong className="text-white">Load matches</strong> → select → <strong className="text-white">Fetch Scorecard + Score Fantasy</strong></li>
          <li>If duplicates appear: use <strong className="text-red-400">Full Reset + Resync</strong> to start clean</li>
        </ol>
        <p className="text-xs pt-1">Data source: <code className="text-neon-green">cricketdata.org</code> (CricAPI)</p>
      </div>
    </div>
  )
}
