/**
 * ESPN Cricinfo scraper using their internal JSON API.
 * The website calls these endpoints itself — we replicate the browser request.
 */

const ESPN_API = 'https://hs-consumer-api.espncricinfo.com/v1'
const SERIES_ID = 1510719 // IPL 2026

// Browser-like headers to pass ESPN's bot detection
const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.espncricinfo.com/',
  'Origin': 'https://www.espncricinfo.com',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
}

async function espnFetch(url: string) {
  const res = await fetch(url, { headers: ESPN_HEADERS, cache: 'no-store' })
  if (!res.ok) throw new Error(`ESPN API ${res.status}: ${url}`)
  return res.json()
}

// ─── Team abbreviation map (ESPN name → our DB enum) ───────────────────────
const TEAM_MAP: Record<string, string> = {
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

// ESPN squad IDs for IPL 2026 teams (stable across seasons for same team)
// These are the squadId values from ESPN's squads endpoint
export const TEAM_SQUAD_IDS: Record<string, number> = {
  CSK:  4343,
  MI:   4340,
  RCB:  4341,
  KKR:  4342,
  DC:   4344,
  SRH:  4345,
  PBKS: 4346,
  RR:   4347,
  LSG:  4348,
  GT:   4349,
}

// ─── Role detection from ESPN batting/bowling style ────────────────────────
function detectRole(player: any): string {
  const style = (player.playingRoles ?? []).join(' ').toLowerCase()
  const bat = player.battingStyles?.[0]?.toLowerCase() ?? ''
  const bowl = player.bowlingStyles?.[0]?.toLowerCase() ?? ''

  if (style.includes('wicketkeeper') || style.includes('wk')) return 'wicketkeeper'
  if (style.includes('allrounder') || style.includes('all-rounder')) return 'allrounder'
  if (bowl && bowl !== 'none' && bat && bat !== 'none') return 'allrounder'
  if (bowl && bowl !== 'none') return 'bowler'
  return 'batsman'
}

// ─── SCHEDULE ──────────────────────────────────────────────────────────────

export interface ESPNMatch {
  espnMatchId: number
  teamA: string
  teamB: string
  venue: string
  matchDate: string // ISO
  status: 'upcoming' | 'live' | 'completed'
  tossWinner?: string
  tossDecision?: 'bat' | 'bowl'
  matchWinner?: string
}

export async function scrapeIPLSchedule(): Promise<ESPNMatch[]> {
  const url = `${ESPN_API}/pages/series/schedule?seriesId=${SERIES_ID}&page=1&pageSize=100`
  const data = await espnFetch(url)

  const matches: ESPNMatch[] = []
  const matchList = data?.content?.matches ?? []

  for (const m of matchList) {
    const teams = m.teams ?? []
    if (teams.length < 2) continue

    const teamAName = teams[0]?.team?.name ?? ''
    const teamBName = teams[1]?.team?.name ?? ''
    const teamA = TEAM_MAP[teamAName] ?? teams[0]?.team?.abbreviation
    const teamB = TEAM_MAP[teamBName] ?? teams[1]?.team?.abbreviation

    if (!teamA || !teamB) continue

    const statusRaw = (m.status ?? '').toLowerCase()
    let status: 'upcoming' | 'live' | 'completed' = 'upcoming'
    if (statusRaw.includes('result') || statusRaw.includes('complete')) status = 'completed'
    else if (statusRaw.includes('live') || statusRaw.includes('progress')) status = 'live'

    // Toss & winner
    let tossWinner: string | undefined
    let tossDecision: 'bat' | 'bowl' | undefined
    let matchWinner: string | undefined

    if (m.toss) {
      tossWinner = TEAM_MAP[m.toss.winner?.name ?? ''] ?? m.toss.winner?.abbreviation
      tossDecision = m.toss.decision?.toLowerCase().includes('bat') ? 'bat' : 'bowl'
    }
    if (m.winnerTeam) {
      matchWinner = TEAM_MAP[m.winnerTeam?.name ?? ''] ?? m.winnerTeam?.abbreviation
    }

    matches.push({
      espnMatchId: m.objectId,
      teamA,
      teamB,
      venue: m.ground?.name ?? m.venue ?? '',
      matchDate: m.startDate ?? m.date ?? '',
      status,
      tossWinner,
      tossDecision,
      matchWinner,
    })
  }

  return matches
}

// ─── SQUADS ────────────────────────────────────────────────────────────────

export interface ESPNPlayer {
  espnPlayerId: number
  name: string
  team: string
  role: 'batsman' | 'bowler' | 'allrounder' | 'wicketkeeper'
  imageUrl?: string
}

export async function scrapeTeamSquad(teamAbbr: string): Promise<ESPNPlayer[]> {
  const squadId = TEAM_SQUAD_IDS[teamAbbr]
  if (!squadId) throw new Error(`No squad ID for team ${teamAbbr}`)

  const url = `${ESPN_API}/pages/series/squads?seriesId=${SERIES_ID}&squadId=${squadId}`
  const data = await espnFetch(url)

  const players: ESPNPlayer[] = []
  const playerList = data?.content?.players ?? data?.content?.squad?.players ?? []

  for (const entry of playerList) {
    const p = entry.player ?? entry
    if (!p?.name) continue

    players.push({
      espnPlayerId: p.objectId ?? p.id,
      name: p.name,
      team: teamAbbr,
      role: detectRole(p) as any,
      imageUrl: p.image?.url ?? p.imageUrl,
    })
  }

  return players
}

export async function scrapeAllSquads(): Promise<ESPNPlayer[]> {
  const teams = Object.keys(TEAM_SQUAD_IDS)
  const results = await Promise.allSettled(teams.map(t => scrapeTeamSquad(t)))

  const all: ESPNPlayer[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }
  return all
}

// ─── SCORECARD ─────────────────────────────────────────────────────────────

export interface ESPNPlayerStat {
  espnPlayerId: number
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

export async function scrapeMatchScorecard(espnMatchId: number): Promise<ESPNPlayerStat[]> {
  const url = `${ESPN_API}/pages/match/scorecard?objectId=${espnMatchId}&seriesId=${SERIES_ID}`
  const data = await espnFetch(url)

  const innings = data?.content?.matchDetails?.innings ?? []
  const statsMap = new Map<number, ESPNPlayerStat>()

  function getOrCreate(player: any): ESPNPlayerStat {
    const id = player.objectId ?? player.id
    if (!statsMap.has(id)) {
      statsMap.set(id, {
        espnPlayerId: id,
        playerName: player.name ?? '',
        runsScored: 0, ballsFaced: 0, fours: 0, sixes: 0,
        wickets: 0, economyRate: null,
        catches: 0, stumpings: 0, runOuts: 0, maidens: 0,
      })
    }
    return statsMap.get(id)!
  }

  for (const inning of innings) {
    // Batting
    for (const b of inning.inningBatsmen ?? []) {
      if (!b.player) continue
      const s = getOrCreate(b.player)
      s.runsScored += b.runs ?? 0
      s.ballsFaced += b.balls ?? 0
      s.fours += b.fours ?? 0
      s.sixes += b.sixes ?? 0
    }

    // Bowling
    for (const w of inning.inningWickets ?? inning.inningBowlers ?? []) {
      if (!w.bowler) continue
      const s = getOrCreate(w.bowler)
      s.wickets += w.wickets ?? 0
      s.maidens += w.maidens ?? 0
      if (w.economy != null) s.economyRate = parseFloat(w.economy)
    }

    // Fielding
    for (const f of inning.inningFieldingStats ?? []) {
      if (!f.player) continue
      const s = getOrCreate(f.player)
      s.catches += f.catches ?? 0
      s.stumpings += f.stumpings ?? 0
      s.runOuts += (f.directRunOuts ?? 0) + (f.indirectRunOuts ?? 0)
    }
  }

  return Array.from(statsMap.values())
}
