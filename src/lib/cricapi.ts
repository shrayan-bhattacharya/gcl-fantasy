/**
 * CricketData.org (CricAPI) integration — replaces ESPN scraper (403).
 * Docs: https://cricketdata.org
 */

const BASE = 'https://api.cricapi.com/v1'

// IPL 2026 series ID on CricAPI.
// Override with CRICAPI_SERIES_ID env var if it changes.
const SERIES_ID = process.env.CRICAPI_SERIES_ID ?? 'd5a498c8-7596-4b93-8ab0-e0efc3345312'

async function cricFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const key = process.env.CRICAPI_KEY
  if (!key) throw new Error('CRICAPI_KEY environment variable not set')

  const url = new URL(`${BASE}/${endpoint}`)
  url.searchParams.set('apikey', key)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`CricAPI HTTP ${res.status}: ${endpoint}`)

  const json = await res.json()
  if (json.status !== 'success') throw new Error(`CricAPI error (${endpoint}): ${JSON.stringify(json)}`)

  return json.data as T
}

// ── Team name / shortname → DB enum ─────────────────────────────────────────
const TEAM_MAP: Record<string, string> = {
  // Shortnames (CricAPI may return PBKS or PK for Punjab Kings)
  CSK: 'CSK', MI: 'MI', RCB: 'RCB', KKR: 'KKR', DC: 'DC',
  SRH: 'SRH', PBKS: 'PBKS', PK: 'PBKS', RR: 'RR', LSG: 'LSG', GT: 'GT',
  // Full names
  'Chennai Super Kings': 'CSK',
  'Mumbai Indians': 'MI',
  'Royal Challengers Bengaluru': 'RCB',
  'Royal Challengers Bangalore': 'RCB',
  'Kolkata Knight Riders': 'KKR',
  'Delhi Capitals': 'DC',
  'Sunrisers Hyderabad': 'SRH',
  'Punjab Kings': 'PBKS',
  'Rajasthan Royals': 'RR',
  'Lucknow Super Giants': 'LSG',
  'Gujarat Titans': 'GT',
}

function mapTeam(name: string | undefined | null): string | null {
  if (!name) return null
  return TEAM_MAP[name.trim()] ?? null
}

// ── Role mapping ─────────────────────────────────────────────────────────────
// CricAPI roles: "Batsman", "Bowler", "WK-Batsman", "Batting Allrounder", "Bowling Allrounder"
function mapRole(role: string): 'batsman' | 'bowler' | 'allrounder' | 'wicketkeeper' {
  const r = role.toLowerCase()
  if (r.includes('wk') || r.includes('wicket')) return 'wicketkeeper'
  if (r.includes('allrounder') || r.includes('all-rounder')) return 'allrounder'
  if (r.includes('bowl')) return 'bowler'
  return 'batsman'
}

// ── SCHEDULE ─────────────────────────────────────────────────────────────────

export interface CricAPIMatchRow {
  cricapiMatchId: string
  teamA: string
  teamB: string
  venue: string
  matchDate: string // ISO
  status: 'upcoming' | 'live' | 'completed'
  tossWinner?: string
  tossDecision?: 'bat' | 'bowl'
  matchWinner?: string
}

export async function fetchIPLSchedule(): Promise<CricAPIMatchRow[]> {
  const data = await cricFetch<{ info: any; matchList: any[] }>('series_info', { id: SERIES_ID })
  const matchList = data.matchList ?? []

  const rows: CricAPIMatchRow[] = []
  for (const m of matchList) {
    const teamA =
      mapTeam(m.teamInfo?.[0]?.shortname) ??
      mapTeam(m.teamInfo?.[0]?.name) ??
      mapTeam(m.teams?.[0])
    const teamB =
      mapTeam(m.teamInfo?.[1]?.shortname) ??
      mapTeam(m.teamInfo?.[1]?.name) ??
      mapTeam(m.teams?.[1])
    if (!teamA || !teamB) continue

    let status: 'upcoming' | 'live' | 'completed' = 'upcoming'
    if (m.matchEnded) status = 'completed'
    else if (m.matchStarted) status = 'live'

    rows.push({
      cricapiMatchId: m.id,
      teamA,
      teamB,
      venue: m.venue ?? '',
      matchDate: m.dateTimeGMT ?? m.date ?? '',
      status,
    })
  }

  return rows
}

// ── SQUADS ───────────────────────────────────────────────────────────────────

export interface CricAPIPlayerRow {
  cricapiPlayerId: string
  name: string
  team: string
  role: 'batsman' | 'bowler' | 'allrounder' | 'wicketkeeper'
  country: string | null
  imageUrl: string | null
}

export async function fetchAllSquads(): Promise<CricAPIPlayerRow[]> {
  const data = await cricFetch<any[]>('series_squad', { id: SERIES_ID })

  const players: CricAPIPlayerRow[] = []
  for (const squad of data) {
    const team =
      mapTeam(squad.shortname) ??
      mapTeam(squad.teamName)
    if (!team) continue

    for (const p of squad.players ?? []) {
      if (!p.name || !p.id) continue
      players.push({
        cricapiPlayerId: p.id,
        name: p.name,
        team,
        role: mapRole(p.role ?? 'Batsman'),
        country: p.country ?? null,
        imageUrl: p.playerImg ?? null,
      })
    }
  }

  return players
}

export async function fetchTeamSquad(teamAbbr: string): Promise<CricAPIPlayerRow[]> {
  const all = await fetchAllSquads()
  return all.filter(p => p.team === teamAbbr)
}

// ── SCORECARD ────────────────────────────────────────────────────────────────

export interface CricAPIPlayerStat {
  cricapiPlayerId: string
  playerName: string
  runsScored: number
  ballsFaced: number
  fours: number
  sixes: number
  wickets: number
  economyRate: number | null
  catches: number
  stumpings: number
  runOuts: number
  maidens: number
}

export interface CricAPIScorecardResult {
  matchWinner: string | null
  tossWinner: string | null
  tossDecision: 'bat' | 'bowl' | null
  stats: CricAPIPlayerStat[]
}

export async function fetchScorecard(cricapiMatchId: string): Promise<CricAPIScorecardResult> {
  const data = await cricFetch<any>('match_scorecard', { id: cricapiMatchId })

  const matchWinner = mapTeam(data.matchWinner)
  const tossWinner = mapTeam(data.tossWinner)
  const tossDecision: 'bat' | 'bowl' | null =
    data.tossChoice?.toLowerCase().includes('bat') ? 'bat'
    : data.tossChoice ? 'bowl'
    : null

  const statsMap = new Map<string, CricAPIPlayerStat>()

  function getOrCreate(player: any): CricAPIPlayerStat {
    const id = String(player.id)
    if (!statsMap.has(id)) {
      statsMap.set(id, {
        cricapiPlayerId: id,
        playerName: player.name ?? '',
        runsScored: 0, ballsFaced: 0, fours: 0, sixes: 0,
        wickets: 0, economyRate: null,
        catches: 0, stumpings: 0, runOuts: 0, maidens: 0,
      })
    }
    return statsMap.get(id)!
  }

  for (const inning of data.scorecard ?? []) {
    // Batting
    for (const b of inning.batting ?? []) {
      if (!b.batsman?.id) continue
      const s = getOrCreate(b.batsman)
      s.runsScored += b.r ?? 0
      s.ballsFaced += b.b ?? 0
      s.fours += b['4s'] ?? 0
      s.sixes += b['6s'] ?? 0
    }

    // Bowling
    for (const w of inning.bowling ?? []) {
      if (!w.bowler?.id) continue
      const s = getOrCreate(w.bowler)
      s.wickets += w.w ?? 0
      s.maidens += w.m ?? 0
      if (w.eco != null) s.economyRate = typeof w.eco === 'number' ? w.eco : parseFloat(String(w.eco))
    }

    // Fielding
    for (const f of inning.catching ?? []) {
      if (!f.catcher?.id) continue
      const s = getOrCreate(f.catcher)
      s.catches += f.catch ?? 0
      s.stumpings += f.stumped ?? 0
      s.runOuts += f.runout ?? f.runOuts ?? 0
    }
  }

  return {
    matchWinner,
    tossWinner,
    tossDecision,
    stats: Array.from(statsMap.values()),
  }
}
