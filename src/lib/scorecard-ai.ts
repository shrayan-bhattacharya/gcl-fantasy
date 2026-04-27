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
              runs: { type: 'number', description: 'Runs scored while batting (all players can bat, including bowlers)' },
              wickets: { type: 'number', description: 'Wickets taken while bowling (0 for pure batsmen)' },
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

/** Step 1: Search web for match result + stats using GPT-4o Responses API */
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
  const allPlayers = targetPlayers.map(p => `${p.name} (${p.team})`).join(', ')
  const bowlers = targetPlayers
    .filter(p => p.role === 'bowler' || p.role === 'allrounder')
    .map(p => `${p.name} (${p.team})`).join(', ') || 'none'

  const data = await callOpenAI('https://api.openai.com/v1/responses', key, {
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview', search_context_size: 'high' }],
    input: `Search for the IPL 2026 cricket match: ${teamA} vs ${teamB} on ${dateStr}.

I need COMPLETE stats for these players: ${allPlayers}

Search for:
1. Full batting scorecard — runs scored by ALL players (bowlers also bat and can score runs like 11, 7, 15 etc.)
2. Bowling figures — wickets taken by: ${bowlers}

IMPORTANT: Report BOTH runs scored (batting) AND wickets taken (bowling) for EVERY player. Bowlers often bat lower in the order and score runs — do NOT skip their batting runs.

Report the match winner and each player's exact runs and wickets.`,
  })

  // Extract text from Responses API output
  const messageBlock = (data.output ?? []).find((b: any) => b.type === 'message')
  if (!messageBlock) throw new Error('No message in search response')
  const textContent = (messageBlock.content ?? []).find((c: any) => c.type === 'output_text')
  const narrative = textContent?.text ?? ''
  if (!narrative.length) throw new Error('No text in search response')

  console.log('[search] status:', data.status, 'narrative length:', narrative.length)
  return narrative
}

/** Step 2: Extract structured stats from narrative using GPT-4o Chat Completions */
export async function extractFromNarrative(
  narrative: string,
  targetPlayers: TargetPlayer[],
): Promise<ScorecardResult> {
  const key = getKey()
  const playerList = targetPlayers
    .map(p => p.role ? `${p.name} (${p.team}, ${p.role})` : `${p.name} (${p.team})`)
    .join(', ')

  const data = await callOpenAI('https://api.openai.com/v1/chat/completions', key, {
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Extract from this cricket match report and call submit_scorecard.

Find stats for ONLY these players: ${playerList}

For each player report:
- runs: total runs scored while BATTING (even bowlers bat — if a bowler scored 7, 11, 15 etc. include those runs)
- wickets: total wickets taken while BOWLING (0 if they are a pure batsman)

Use 0 if they didn't bat or didn't bowl. Do NOT skip bowler batting runs.
Set confidence to "high" if you see actual numbers, "medium" if approximate, "low" if not found.

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
