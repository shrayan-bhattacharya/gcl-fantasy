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

  const prompt = `Search for the complete IPL 2026 cricket match scorecard: ${teamA} vs ${teamB} played on ${dateStr}.

Find the batting scorecard, bowling figures, and fielding contributions from ESPNCricinfo, Cricbuzz, or the official IPL website.

Return ONLY a valid JSON object with NO other text before or after it:
{
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
}

Rules:
- Include every player who batted, bowled, or fielded
- Use team abbreviations exactly: MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT
- Set confidence "high" if you found the actual scorecard table, "medium" if reconstructed from match reports, "low" if uncertain
- Bowlers who didn't bat: runs=0, balls_faced=0
- Batters who didn't bowl: wickets=0, overs_bowled=0, economy_rate=0
- economy_rate should be runs_per_over (e.g. 8.75), not a percentage`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()

  // Find the last text block (after all tool uses)
  const textBlocks = (data.content ?? []).filter((b: any) => b.type === 'text')
  if (!textBlocks.length) throw new Error('No text response from Claude')

  const text = textBlocks[textBlocks.length - 1].text

  // Extract JSON — Claude sometimes wraps it in ```json fences
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) throw new Error(`No JSON found in response: ${text.slice(0, 300)}`)

  const raw = jsonMatch[1] ?? jsonMatch[0]
  return JSON.parse(raw) as ScorecardResult
}
