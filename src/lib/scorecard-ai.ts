export interface PlayerStat {
  name: string
  team: string
  runs: number
  wickets: number
}

export interface ScorecardResult {
  match_winner: string | null
  confidence: 'high' | 'medium' | 'low'
  players: PlayerStat[]
  missing: string[]   // target players whose stats were not found in the extraction
}

export interface TargetPlayer {
  name: string
  team: string
  role?: string   // 'batsman' | 'bowler' | 'allrounder' | 'wicketkeeper'
}

// OpenAI function-calling schema for extraction step
const SCORECARD_FUNCTION = {
  type: 'function' as const,
  function: {
    name: 'submit_scorecard',
    description: 'Submit the extracted match result and player stats.',
    parameters: {
      type: 'object' as const,
      required: ['match_winner', 'confidence', 'players'],
      properties: {
        match_winner: { type: 'string', description: 'Winning team abbreviation (MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT)' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'high = found actual scorecard, medium = from match report, low = uncertain' },
        players: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'team', 'runs', 'wickets'],
            properties: {
              name: { type: 'string' },
              team: { type: 'string' },
              runs: { type: 'number', description: 'Runs scored while batting (all players can bat, including bowlers). 0 if did not bat.' },
              wickets: { type: 'number', description: 'Wickets taken while bowling (0 if did not bowl or pure batsman)' },
            },
          },
        },
      },
    },
  },
}

function getKey() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')
  return key
}

async function callOpenAI(url: string, key: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`OpenAI API ${res.status}: ${text.slice(0, 300)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`OpenAI returned non-JSON: ${text.slice(0, 300)}`)
  }
}

/** Step 1: Search web for match scorecard using GPT-4.1 Responses API */
export async function searchScorecard(
  teamA: string,
  teamB: string,
  matchDate: string,
  targetPlayers: TargetPlayer[],
): Promise<string> {
  const key = getKey()
  const dateStr = new Date(matchDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Build player list grouped by role for clear instructions
  const batsmen = targetPlayers
    .filter(p => p.role === 'batsman' || p.role === 'wicketkeeper')
    .map(p => `${p.name} (${p.team})`)
  const bowlers = targetPlayers
    .filter(p => p.role === 'bowler')
    .map(p => `${p.name} (${p.team})`)
  const allrounders = targetPlayers
    .filter(p => p.role === 'allrounder')
    .map(p => `${p.name} (${p.team})`)
  const allPlayers = targetPlayers.map(p => `${p.name} (${p.team})`).join(', ')

  const data = await callOpenAI('https://api.openai.com/v1/responses', key, {
    model: 'gpt-4.1',
    tools: [{ type: 'web_search_preview', search_context_size: 'high' }],
    instructions: 'You MUST do at least 2 separate web searches to find complete batting AND bowling data. Search for full scorecard pages on thesportstak.com, espncricinfo.com, ndtv sports, or cricbuzz.com. Only report numbers you actually see on the scorecard. Never guess.',
    input: `I need the full scorecard of IPL 2026 match: ${teamA} vs ${teamB} on ${dateStr}.

Do these searches:
1. Search: "${teamA} vs ${teamB} IPL 2026 full batting scorecard"
2. Search: "${teamA} vs ${teamB} IPL 2026 bowling figures scorecard"

I need EXACT stats for these players: ${allPlayers}

${batsmen.length ? `BATSMEN (report runs scored, and 0 wickets): ${batsmen.join(', ')}` : ''}
${bowlers.length ? `BOWLERS (report bowling wickets AND batting runs if they batted): ${bowlers.join(', ')}` : ''}
${allrounders.length ? `ALL-ROUNDERS (report both batting runs AND bowling wickets): ${allrounders.join(', ')}` : ''}

For EACH player report:
- Batting: exact runs scored (from batting scorecard). Write "DNB" if did not bat.
- Bowling: exact overs-runs-wickets (from bowling figures). Write "did not bowl" if they didn't bowl.

Also report the match winner.

CRITICAL: Copy numbers EXACTLY from the scorecard tables. If a bowler did not bat, their runs = 0. If a batsman did not bowl, their wickets = 0.`,
  })

  // Extract text from Responses API output
  const messageBlock = (data.output ?? []).find((b: any) => b.type === 'message')
  if (!messageBlock) throw new Error('No message in search response')
  const textContent = (messageBlock.content ?? []).find((c: any) => c.type === 'output_text')
  const narrative = textContent?.text ?? ''
  if (!narrative.length) throw new Error('No text in search response')

  console.log('[search] model:', data.model, 'status:', data.status, 'narrative length:', narrative.length)
  return narrative
}

/** Step 2: Extract structured stats from narrative using GPT-4.1 Chat Completions */
export async function extractFromNarrative(
  narrative: string,
  targetPlayers: TargetPlayer[],
): Promise<ScorecardResult> {
  const key = getKey()
  const playerList = targetPlayers
    .map(p => p.role ? `${p.name} (${p.team}, ${p.role})` : `${p.name} (${p.team})`)
    .join(', ')

  const data = await callOpenAI('https://api.openai.com/v1/chat/completions', key, {
    model: 'gpt-4.1',
    messages: [{
      role: 'system',
      content: 'You extract exact cricket stats from match reports. Only use numbers explicitly stated in the report. If a stat is not mentioned, use 0. Never invent or estimate numbers.',
    }, {
      role: 'user',
      content: `Extract stats from this match report and call submit_scorecard.

Players to find: ${playerList}

Rules:
- runs = batting runs from scorecard. If "DNB" or "did not bat" → 0
- wickets = bowling wickets from figures. If "did not bowl" → 0
- Bowlers CAN bat: if a bowler scored runs, include them
- confidence = "high" if actual scorecard numbers found, "medium" if approximate, "low" if stats not found
- match_winner = team abbreviation (CSK, MI, RCB, KKR, DC, SRH, PBKS, RR, LSG, GT)

MATCH REPORT:
${narrative}`,
    }],
    tools: [SCORECARD_FUNCTION],
    tool_choice: { type: 'function', function: { name: 'submit_scorecard' } },
  })

  const choice = data.choices?.[0]
  const toolCall = choice?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.function.name !== 'submit_scorecard') {
    throw new Error('No submit_scorecard tool call in extract response')
  }

  const result = JSON.parse(toolCall.function.arguments) as Omit<ScorecardResult, 'missing'>
  console.log('[extract] players:', result.players?.length ?? 0, 'winner:', result.match_winner, 'confidence:', result.confidence)

  // Verification: find which target players were not returned in the extraction
  const foundNames = new Set((result.players ?? []).map((p: PlayerStat) => p.name.toLowerCase()))
  const missing = targetPlayers
    .filter(tp => !foundNames.has(tp.name.toLowerCase()))
    .map(tp => `${tp.name} (${tp.team}${tp.role ? ', ' + tp.role : ''})`)
  if (missing.length) console.log('[extract] missing players:', missing)

  return { ...result, missing }
}
