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

// Tool schema — only runs + wickets needed for scoring
export const SCORECARD_TOOL = {
  name: 'submit_scorecard',
  description: 'Submit the extracted match result and player stats.',
  input_schema: {
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
            runs: { type: 'number' },
            wickets: { type: 'number' },
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

/** Step 1: Search web for match result + stats for specific players only */
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

  const data = await callAnthropic(key, {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    messages: [{
      role: 'user',
      content: `Search for the IPL 2026 match: ${teamA} vs ${teamB} on ${dateStr}.

I need stats for these players: ${allPlayers}

Do TWO focused searches:
1. Full batting scorecard — find runs scored by ALL players listed above (bowlers can also bat and score runs like 11, 7, 15 etc.)
2. Bowling figures — find wickets taken by: ${bowlers}

IMPORTANT: Report BOTH runs scored (batting) AND wickets taken (bowling) for EVERY player. Bowlers often bat lower in the order and score runs — do NOT skip their batting runs.

Report the match winner and each player's exact runs and wickets.`,
    }],
  })

  console.log('[search] stop_reason:', data.stop_reason)
  const textBlocks = (data.content ?? []).filter((b: any) => b.type === 'text')
  const narrative = textBlocks.map((b: any) => b.text).join('\n')
  if (!narrative.length) throw new Error('No text in search response')
  return narrative
}

/** Step 2: Extract structured stats from narrative for specific players only */
export async function extractFromNarrative(
  narrative: string,
  targetPlayers: TargetPlayer[],
): Promise<ScorecardResult> {
  const key = getKey()
  const playerList = targetPlayers
    .map(p => p.role ? `${p.name} (${p.team}, ${p.role})` : `${p.name} (${p.team})`)
    .join(', ')

  const data = await callAnthropic(key, {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: [SCORECARD_TOOL],
    tool_choice: { type: 'tool', name: 'submit_scorecard' },
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
  })

  console.log('[extract] stop_reason:', data.stop_reason)
  const toolBlock = (data.content ?? []).find(
    (b: any) => b.type === 'tool_use' && b.name === 'submit_scorecard'
  )
  if (!toolBlock) throw new Error(`No tool_use in extract response`)

  const result = toolBlock.input as Omit<ScorecardResult, 'missing'>
  console.log('[extract] players:', result.players?.length ?? 0, 'winner:', result.match_winner)

  // Verification: find which target players were not returned in the extraction
  const foundNames = new Set((result.players ?? []).map((p: PlayerStat) => p.name.toLowerCase()))
  const missing = targetPlayers
    .filter(tp => !foundNames.has(tp.name.toLowerCase()))
    .map(tp => `${tp.name} (${tp.team}${tp.role ? ', ' + tp.role : ''})`)
  if (missing.length) console.log('[extract] missing players:', missing)

  return { ...result, missing }
}
