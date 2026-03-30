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
  description: 'Submit the extracted cricket match scorecard data. Call this after searching for the scorecard.',
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

  // Single API call: web_search finds data, then Claude calls submit_scorecard
  const prompt = `Search for the complete IPL 2026 cricket match scorecard: ${teamA} vs ${teamB} played on ${dateStr}.

Find the full batting scorecard, bowling figures, and fielding from ESPNCricinfo, Cricbuzz, or the IPL website.

After searching, you MUST call the submit_scorecard tool with ALL the data:
- match_winner, toss_winner, toss_decision
- Every player from both teams (~22 players) who batted, bowled, or fielded
- Team abbreviations: MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT
- confidence: "high" if actual scorecard found, "medium" if from match reports, "low" if uncertain
- Bowlers who didn't bat: runs=0, balls_faced=0
- Batters who didn't bowl: wickets=0, overs_bowled=0, economy_rate=0
- economy_rate = runs per over (e.g. 8.75)`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
        SCORECARD_TOOL,
      ],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  console.log('[scorecard-ai] stop_reason:', data.stop_reason)

  // Look for submit_scorecard tool_use in response
  const toolBlock = (data.content ?? []).find(
    (b: any) => b.type === 'tool_use' && b.name === 'submit_scorecard'
  )

  if (toolBlock) {
    const result = toolBlock.input as ScorecardResult
    console.log('[scorecard-ai] tool_use found:', JSON.stringify({
      winner: result.match_winner,
      confidence: result.confidence,
      playerCount: result.players?.length ?? 0,
    }))

    if (!result.players?.length) {
      throw new Error(`submit_scorecard called with 0 players. stop_reason=${data.stop_reason}`)
    }
    return result
  }

  // Fallback: Claude did web search but responded with text instead of calling the tool.
  // Extract text and make a second (fast, no web search) call with forced tool_choice.
  console.log('[scorecard-ai] no tool_use in response, falling back to step 2')
  const textBlocks = (data.content ?? []).filter((b: any) => b.type === 'text')
  const narrative = textBlocks.map((b: any) => b.text).join('\n')

  if (!narrative.length) {
    throw new Error('No text and no tool_use in response')
  }

  const step2Res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      tools: [SCORECARD_TOOL],
      tool_choice: { type: 'tool', name: 'submit_scorecard' },
      messages: [{ role: 'user', content: `Extract ALL player data from this cricket match report and call submit_scorecard. Include ~22 players (11 per team). Team abbreviations: MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT.\n\n${narrative}` }],
    }),
  })

  if (!step2Res.ok) {
    const body = await step2Res.text()
    throw new Error(`Anthropic API step2 ${step2Res.status}: ${body.slice(0, 200)}`)
  }

  const step2Data = await step2Res.json()
  const step2Tool = (step2Data.content ?? []).find(
    (b: any) => b.type === 'tool_use' && b.name === 'submit_scorecard'
  )

  if (!step2Tool) {
    throw new Error(`No tool_use in step2: ${JSON.stringify(step2Data.content).slice(0, 500)}`)
  }

  const result = step2Tool.input as ScorecardResult
  if (!result.players?.length) {
    throw new Error(`Step2 returned 0 players. stop_reason=${step2Data.stop_reason}`)
  }

  return result
}
