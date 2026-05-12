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

// Anthropic tool schema for extraction step
export const SCORECARD_TOOL = {
  name: 'submit_scorecard',
  description: 'Submit the extracted match result and player stats.',
  input_schema: {
    type: 'object' as const,
    required: ['match_winner', 'confidence', 'players'],
    properties: {
      match_winner: { type: 'string', description: 'Winning team abbreviation (MI, KKR, RCB, CSK, DC, SRH, PBKS, RR, LSG, GT)' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'high = found actual scorecard, medium = from match report, low = uncertain/missing data' },
      players: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'team', 'runs', 'wickets'],
          properties: {
            name: { type: 'string' },
            team: { type: 'string' },
            runs: { type: 'number', description: 'Runs scored while batting. 0 if did not bat or stat not found in source.' },
            wickets: { type: 'number', description: 'Wickets taken while bowling. 0 if did not bowl or stat not found in source.' },
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

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Anthropic returned non-JSON: ${text.slice(0, 300)}`)
  }
}

/** Step 1: Search web for match scorecard using Claude Haiku (safer failure mode) */
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
    model: 'claude-haiku-4-5-20251001',
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

If you cannot find exact stats for a player, say "stats not found" — do NOT guess or estimate.

Report the match winner and each player's exact runs and wickets.`,
    }],
  })

  console.log('[search] stop_reason:', data.stop_reason)
  const textBlocks = (data.content ?? []).filter((b: any) => b.type === 'text')
  const narrative = textBlocks.map((b: any) => b.text).join('\n')
  if (!narrative.length) throw new Error('No text in search response')
  return narrative
}

/** Step 2: Extract structured stats from narrative using Claude Sonnet */
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
      content: `Extract stats from this cricket match report and call submit_scorecard.

Find stats for ONLY these players: ${playerList}

CRITICAL RULES:
- Only use numbers EXPLICITLY STATED in the report
- If a player's stat is not mentioned in the report, use 0 (never guess)
- Bowlers CAN bat: if a bowler scored runs (e.g. 7, 11, 15), include them
- Pure batsmen have wickets = 0
- Set confidence to "low" if any target player's stats are missing or unclear
- Set confidence to "high" ONLY if you see exact numbers for ALL players
- Set confidence to "medium" if some players found but others uncertain

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
  console.log('[extract] players:', result.players?.length ?? 0, 'winner:', result.match_winner, 'confidence:', result.confidence)

  // Verification: find which target players were not returned in the extraction
  const foundNames = new Set((result.players ?? []).map((p: PlayerStat) => p.name.toLowerCase()))
  const missing = targetPlayers
    .filter(tp => !foundNames.has(tp.name.toLowerCase()))
    .map(tp => `${tp.name} (${tp.team}${tp.role ? ', ' + tp.role : ''})`)
  if (missing.length) console.log('[extract] missing players:', missing)

  return { ...result, missing }
}
