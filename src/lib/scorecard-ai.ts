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
}

export interface TargetPlayer {
  name: string
  team: string
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
  const playerList = targetPlayers.map(p => `${p.name} (${p.team})`).join(', ')

  const data = await callAnthropic(key, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    messages: [{
      role: 'user',
      content: `Search for the IPL 2026 cricket match: ${teamA} vs ${teamB} on ${dateStr}.

Find:
1. Which team won the match
2. Runs scored and wickets taken by ONLY these players: ${playerList}

Search ESPNCricinfo or Cricbuzz. Report the match winner and each player's runs and wickets.`,
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
  const playerList = targetPlayers.map(p => `${p.name} (${p.team})`).join(', ')

  const data = await callAnthropic(key, {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: [SCORECARD_TOOL],
    tool_choice: { type: 'tool', name: 'submit_scorecard' },
    messages: [{
      role: 'user',
      content: `Extract from this cricket match report and call submit_scorecard.

Find stats for ONLY these players: ${playerList}

For each player: runs scored (batting) and wickets taken (bowling). Use 0 if they didn't bat or bowl.
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

  const result = toolBlock.input as ScorecardResult
  console.log('[extract] players:', result.players?.length ?? 0, 'winner:', result.match_winner)
  return result
}
