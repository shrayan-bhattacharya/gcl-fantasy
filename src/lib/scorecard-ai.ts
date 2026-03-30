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

const JSON_SCHEMA = `{
  "match_winner": "MI",
  "toss_winner": "KKR",
  "toss_decision": "bat",
  "confidence": "high",
  "players": [
    {
      "name": "Rohit Sharma",
      "team": "MI",
      "runs": 78,
      "balls_faced": 38,
      "fours": 6,
      "sixes": 6,
      "wickets": 0,
      "overs_bowled": 0.0,
      "economy_rate": 0.0,
      "catches": 0,
      "stumpings": 0,
      "run_outs": 0,
      "maidens": 0
    }
  ]
}`

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
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    messages: [{ role: 'user', content: searchPrompt }],
  })

  // Collect all text from the search response
  const textBlocks = (searchData.content ?? []).filter((b: any) => b.type === 'text')
  if (!textBlocks.length) throw new Error('No text response from web search step')
  const narrative = textBlocks.map((b: any) => b.text).join('\n')

  // ── Step 2: Convert narrative → structured JSON (no tools, prefilled) ──
  const extractPrompt = `Convert the following cricket match data into the exact JSON format specified. Include every player from both teams who batted, bowled, or fielded.

MATCH DATA:
${narrative}

REQUIRED JSON FORMAT:
${JSON_SCHEMA}

Rules:
- Include every player who batted, bowled, or fielded
- Use team abbreviations exactly: MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT
- Set confidence "high" if actual scorecard numbers were found, "medium" if from match reports, "low" if uncertain
- Bowlers who didn't bat: runs=0, balls_faced=0
- Batters who didn't bowl: wickets=0, overs_bowled=0, economy_rate=0
- economy_rate should be runs_per_over (e.g. 8.75)
- Output ONLY the JSON object, nothing else`

  const jsonData = await callAnthropic(key, {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      'You are a JSON-only API endpoint.',
      'You MUST output a single valid JSON object and absolutely nothing else.',
      'No explanations. No markdown. No code fences. No text before or after the JSON.',
      'Your entire response must start with { and end with }.',
      'If you output anything other than valid JSON, the system will crash.',
    ].join(' '),
    messages: [
      { role: 'user', content: extractPrompt },
    ],
  })

  const jsonBlocks = (jsonData.content ?? []).filter((b: any) => b.type === 'text')
  if (!jsonBlocks.length) throw new Error('No text response from extraction step')

  const raw = jsonBlocks.map((b: any) => b.text).join('')

  // Strip any accidental code fences
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON found in extraction: ${cleaned.slice(0, 300)}`)
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as ScorecardResult
}
