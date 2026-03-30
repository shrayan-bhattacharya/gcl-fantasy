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
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
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
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    tools: [SCORECARD_TOOL],
    tool_choice: { type: 'tool', name: 'submit_scorecard' },
    messages: [{
      role: 'user',
      content: `Extract ALL cricket match data from this report and call submit_scorecard.

Include every player from both teams (~22 players, 11 per side) who batted, bowled, or fielded.

Rules:
- Team abbreviations: MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT
- confidence: "high" if detailed scorecard found, "medium" if from reports, "low" if uncertain
- Bowlers who didn't bat: runs=0, balls_faced=0
- Batters who didn't bowl: wickets=0, overs_bowled=0, economy_rate=0
- economy_rate = runs per over (e.g. 8.75)

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
  if (!result.players?.length) {
    throw new Error(`Extraction returned 0 players (stop_reason: ${data.stop_reason})`)
  }
  return result
}
