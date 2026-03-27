// Prediction scoring — correct match winner = 50 points
export const PREDICTION_POINTS = {
  MATCH_WINNER: 50,
} as const

// Fantasy scoring — runs and wickets only
export const FANTASY_POINTS = {
  RUN: 1,
  WICKET: 10,
} as const

export function calculateFantasyPoints(stats: {
  runs_scored: number
  wickets: number
}): { breakdown: Record<string, number>; total: number } {
  const breakdown: Record<string, number> = {}

  if (stats.runs_scored > 0) breakdown.runs = stats.runs_scored * FANTASY_POINTS.RUN
  if (stats.wickets > 0) breakdown.wickets = stats.wickets * FANTASY_POINTS.WICKET

  const total = Object.values(breakdown).reduce((sum, pts) => sum + pts, 0)
  return { breakdown, total }
}
