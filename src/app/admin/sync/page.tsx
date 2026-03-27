'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Users, BarChart2, CheckCircle, XCircle, Loader2, RefreshCw, Link } from 'lucide-react'

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
  const [espnMatchId, setEspnMatchId] = useState('')
  const [dbMatchId, setDbMatchId] = useState('')
  const [matches, setMatches] = useState<any[]>([])
  const [matchesLoaded, setMatchesLoaded] = useState(false)

  async function loadMatches() {
    const { data } = await supabase
      .from('matches')
      .select('id, team_a, team_b, match_date, espn_match_id, status')
      .eq('status', 'completed')
      .order('match_date', { ascending: false })
    setMatches(data ?? [])
    setMatchesLoaded(true)
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
      else setSquadResult({ ok: true, message: `Synced ${json.synced} players`, detail: `Team: ${json.team}`, raw: json })
    } catch (e: any) {
      setSquadResult({ ok: false, message: 'Network error', detail: e.message })
    }
    setSquadLoading(false)
  }

  async function syncScorecard() {
    if (!espnMatchId || !dbMatchId) return
    setScorecardLoading(true)
    setScorecardResult(null)
    try {
      const res = await fetch('/api/sync/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ espnMatchId: Number(espnMatchId), matchId: dbMatchId }),
      })
      const json = await res.json()
      if (!res.ok) setScorecardResult({ ok: false, message: 'Sync failed', detail: json.error, raw: json })
      else setScorecardResult({
        ok: true,
        message: `Scorecard synced`,
        detail: `${json.statsUpserted} player stats · ${json.fantasyTeamsScored} fantasy teams scored`,
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
          ESPN Sync
        </h1>
        <p className="text-dark-muted text-sm mt-1">Pull live IPL 2026 data from ESPN Cricinfo into your database.</p>
      </div>

      {/* Schedule */}
      <SyncCard icon={Calendar} title="Sync Schedule" description="Pull all IPL 2026 match fixtures, venues, and results from ESPN.">
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
      <SyncCard icon={Users} title="Sync Player Squads" description="Import all team rosters with player roles from ESPN.">
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
              <label className="text-xs text-dark-muted font-medium">Select completed match</label>
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
                  if (m?.espn_match_id) setEspnMatchId(String(m.espn_match_id))
                }}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-green/50"
              >
                <option value="">— pick a match —</option>
                {matches.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.team_a} vs {m.team_b} · {new Date(m.match_date).toLocaleDateString()}
                    {m.espn_match_id ? ` (ESPN: ${m.espn_match_id})` : ' (no ESPN ID)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Manual ESPN match ID override */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">
              ESPN Match ID
              <span className="text-dark-muted/50 ml-1 font-normal">(from URL: espncricinfo.com/…/match-id)</span>
            </label>
            <input
              type="number"
              value={espnMatchId}
              onChange={e => setEspnMatchId(e.target.value)}
              placeholder="e.g. 1430886"
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
            disabled={scorecardLoading || !espnMatchId || !dbMatchId}
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
          <li>Run <code className="text-neon-green">supabase/migration_espn_ids.sql</code> in Supabase SQL Editor</li>
          <li>Click <strong className="text-white">Sync Full Schedule</strong> — this pulls all 74 IPL 2026 matches</li>
          <li>Click <strong className="text-white">Sync Squads</strong> with "All Teams" — imports all ~220 players</li>
          <li>After each match: find the ESPN Match ID from the scorecard URL, select the match, click <strong className="text-white">Fetch Scorecard</strong></li>
        </ol>
        <p className="text-xs pt-1">ESPN Match ID is the number in the match URL, e.g. <code className="text-neon-green">/match/1430886/...</code></p>
      </div>
    </div>
  )
}
