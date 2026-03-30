export interface PlayerStat {
  name: string
  team: string
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  wickets: number
  overs_bowled: number
  economy_rate: number
  catches: number
  stumpings: number
  run_outs: number
  maidens: number
}

export interface ScorecardResult {
  match_winner: string | null
  toss_winner: string | null
  toss_decision: 'bat' | 'bowl' | null
  confidence: 'high' | 'medium' | 'low'
  players: PlayerStat[]
}

// Tool schema forces Claude to output structured JSON via tool_use
export const SCORECARD_TOOL = {
  name: 'submit_scorecard',
  description: 'Submit the extracted cricket match scorecard data.',
  input_schema: {
    type: 'object' as const,
    required: ['match_winner', 'toss_winner', 'toss_decision', 'confidence', 'players'],
    properties: {
      match_winner: { type: 'string', description: 'Winning team abbreviation (MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT)' },
      toss_winner: { type: 'string', description: 'Toss winning team abbreviation' },
      toss_decision: { type: 'string', enum: ['bat', 'bowl'], description: 'Toss decision' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'high = actual scorecard found, medium = from match reports, low = uncertain' },
      players: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'team', 'runs', 'balls_faced', 'fours', 'sixes', 'wickets', 'overs_bowled', 'economy_rate', 'catches', 'stumpings', 'run_outs', 'maidens'],
          properties: {
            name: { type: 'string' }, team: { type: 'string' },
            runs: { type: 'number' }, balls_faced: { type: 'number' },
            fours: { type: 'number' }, sixes: { type: 'number' },
            wickets: { type: 'number' }, overs_bowled: { type: 'number' },
            economy_rate: { type: 'number' }, catches: { type: 'number' },
            stumpings: { type: 'number' }, run_outs: { type: 'number' },
            maidens: { type: 'number' },
          },
        },
      },
    },
  },
}

function getKey() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  return key
}

async function callAnthropic(key: string, body: Record<string, unknown>) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

/** Step 1: Web search — returns narrative text about the match */
export async function searchScorecard(teamA: string, teamB: string, matchDate: string): Promise<string> {
  const key = getKey()
  const dateStr = new Date(matchDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const data = await callAnthropic(key, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    messages: [{
      role: 'user',
      content: `Search for the complete IPL 2026 cricket match scorecard: ${teamA} vs ${teamB} played on ${dateStr}.

Find from ESPNCricinfo, Cricbuzz, or IPL website:
- Match result (winner, margin)
- Toss winner and decision
- Full batting scorecard: every batter's runs, balls faced, 4s, 6s
- Full bowling figures: every bowler's overs, maidens, runs, wickets, economy
- Fielding: catches, stumpings, run outs

Report ALL numbers for every player from both teams.`,
    }],
  })

  console.log('[search] stop_reason:', data.stop_reason)
  const textBlocks = (data.content ?? []).filter((b: any) => b.type === 'text')
  const narrative = textBlocks.map((b: any) => b.text).join('\n')
  if (!narrative.length) throw new Error('No text in search response')
  return narrative
}

/** Step 2: Extract structured scorecard from narrative text (no web search) */
export async function extractFromNarrative(narrative: string): Promise<ScorecardResult> {
  const key = getKey()

  const data = await callAnthropic(key, {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    tools: [SCORECARD_TOOL],
    tool_choice: { type: 'tool', name: 'submit_scorecard' },
    messages: [{
      role: 'user',
      content: `You are given a cricket match report below. Extract ALL player statistics and call submit_scorecard.

IMPORTANT: You MUST include every player from BOTH teams. A T20 match has 11 players per side = ~22 players total. For each player include their batting stats (runs, balls faced, 4s, 6s) AND bowling stats (overs, maidens, wickets, economy) AND fielding (catches, stumpings, run outs). If a player only batted, set bowling stats to 0. If they only bowled, set batting stats to 0.

Team abbreviations: MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT
confidence: "high" if you see detailed per-player numbers, "medium" if partial, "low" if very incomplete
economy_rate = runs per over (e.g. 8.50)

MATCH REPORT:
${narrative}`,
    }],
  })

  console.log('[extract] stop_reason:', data.stop_reason)
  const toolBlock = (data.content ?? []).find(
    (b: any) => b.type === 'tool_use' && b.name === 'submit_scorecard'
  )
  if (!toolBlock) throw new Error(`No tool_use in extract response`)

  const result = toolBlock.input as ScorecardResult
  console.log('[extract] players:', result.players?.length ?? 0, 'winner:', result.match_winner)
  if (!result.players?.length) {
    throw new Error(`Extraction returned 0 players (stop_reason: ${data.stop_reason})`)
  }
  return result
}
