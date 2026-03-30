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
const SCORECARD_TOOL = {
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
            name: { type: 'string' },
            team: { type: 'string' },
            runs: { type: 'number' },
            balls_faced: { type: 'number' },
            fours: { type: 'number' },
            sixes: { type: 'number' },
            wickets: { type: 'number' },
            overs_bowled: { type: 'number' },
            economy_rate: { type: 'number' },
            catches: { type: 'number' },
            stumpings: { type: 'number' },
            run_outs: { type: 'number' },
            maidens: { type: 'number' },
          },
        },
      },
    },
  },
}

async function callAnthropic(key: string, body: Record<string, unknown>): Promise<any> {
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

export async function extractScorecard(
  teamA: string,
  teamB: string,
  matchDate: string,
): Promise<ScorecardResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')

  const dateStr = new Date(matchDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Step 1: Web search — gather scorecard data (narrative is fine) ──
  const searchPrompt = `Search for the complete IPL 2026 cricket match scorecard: ${teamA} vs ${teamB} played on ${dateStr}.

Find the full batting scorecard (runs, balls, 4s, 6s for every batter), bowling figures (overs, maidens, runs, wickets, economy for every bowler), and fielding (catches, stumpings, run outs) from ESPNCricinfo, Cricbuzz, or the official IPL website.

Also find: match winner, toss winner, toss decision.

Report ALL the numbers you find — every batter and bowler from both teams.`

  const searchData = await callAnthropic(key, {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    messages: [{ role: 'user', content: searchPrompt }],
  })

  console.log('[scorecard-ai] step1 stop_reason:', searchData.stop_reason)

  // Collect all text from the search response
  const textBlocks = (searchData.content ?? []).filter((b: any) => b.type === 'text')
  if (!textBlocks.length) throw new Error('No text response from web search step')
  const narrative = textBlocks.map((b: any) => b.text).join('\n')
  console.log('[scorecard-ai] step1 narrative length:', narrative.length, 'chars')

  // ── Step 2: Convert narrative → structured JSON via forced tool_use ──
  const extractPrompt = `Extract the cricket scorecard from this match data and call the submit_scorecard tool with ALL the data.

You MUST include every player from both teams who batted, bowled, or fielded. There should be approximately 22 players total (11 per team).

MATCH DATA:
${narrative}

Rules:
- Use team abbreviations exactly: MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT
- Set confidence "high" if actual scorecard numbers were found, "medium" if from match reports, "low" if uncertain
- Bowlers who didn't bat: runs=0, balls_faced=0
- Batters who didn't bowl: wickets=0, overs_bowled=0, economy_rate=0
- economy_rate should be runs_per_over (e.g. 8.75)
- Include ALL players — batsmen, bowlers, fielders, even those who scored 0

Call submit_scorecard now with the complete data.`

  const jsonData = await callAnthropic(key, {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    tools: [SCORECARD_TOOL],
    tool_choice: { type: 'tool', name: 'submit_scorecard' },
    messages: [
      { role: 'user', content: extractPrompt },
    ],
  })

  console.log('[scorecard-ai] step2 stop_reason:', jsonData.stop_reason)

  // Find the tool_use block — Claude is forced to call submit_scorecard
  const toolBlock = (jsonData.content ?? []).find((b: any) => b.type === 'tool_use' && b.name === 'submit_scorecard')
  if (!toolBlock) {
    throw new Error(`No tool_use block in response: ${JSON.stringify(jsonData.content).slice(0, 500)}`)
  }

  const result = toolBlock.input as ScorecardResult
  console.log('[scorecard-ai] extracted:', JSON.stringify({
    winner: result.match_winner,
    confidence: result.confidence,
    playerCount: result.players?.length ?? 0,
    stopReason: jsonData.stop_reason,
  }))

  // Fail loudly if we got an empty result
  if (!result.players?.length) {
    throw new Error(`Extraction returned 0 players. stop_reason=${jsonData.stop_reason}, input keys: ${Object.keys(result).join(',')}`)
  }

  return result
}
