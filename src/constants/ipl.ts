import { IPLTeam } from '@/types/database.types'

export const IPL_TEAMS: Record<IPLTeam, { name: string; shortName: IPLTeam; color: string; textColor: string; bgClass: string }> = {
  CSK: { name: 'Chennai Super Kings', shortName: 'CSK', color: '#ffd700', textColor: '#000000', bgClass: 'bg-yellow-400' },
  MI:  { name: 'Mumbai Indians',      shortName: 'MI',  color: '#004b8d', textColor: '#ffffff', bgClass: 'bg-blue-800' },
  RCB: { name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: '#c41e3a', textColor: '#ffffff', bgClass: 'bg-red-700' },
  KKR: { name: 'Kolkata Knight Riders', shortName: 'KKR', color: '#3a1f7a', textColor: '#ffd700', bgClass: 'bg-purple-900' },
  DC:  { name: 'Delhi Capitals',      shortName: 'DC',  color: '#004c97', textColor: '#ffffff', bgClass: 'bg-blue-700' },
  SRH: { name: 'Sunrisers Hyderabad', shortName: 'SRH', color: '#f26522', textColor: '#000000', bgClass: 'bg-orange-500' },
  PBKS: { name: 'Punjab Kings',       shortName: 'PBKS', color: '#aa4545', textColor: '#ffffff', bgClass: 'bg-red-600' },
  RR:  { name: 'Rajasthan Royals',    shortName: 'RR',  color: '#ea1a85', textColor: '#ffffff', bgClass: 'bg-pink-600' },
  LSG: { name: 'Lucknow Super Giants', shortName: 'LSG', color: '#00b4d8', textColor: '#000000', bgClass: 'bg-cyan-400' },
  GT:  { name: 'Gujarat Titans',      shortName: 'GT',  color: '#1b2845', textColor: '#ffffff', bgClass: 'bg-slate-800' },
}

export const TEAM_LIST = Object.values(IPL_TEAMS)

export const ROLE_LABELS: Record<string, string> = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  allrounder: 'All-Rounder',
  wicketkeeper: 'Wicketkeeper',
}

export const ROLE_COLORS: Record<string, string> = {
  batsman: '#39ff14',
  bowler: '#ff6b1a',
  allrounder: '#00e5ff',
  wicketkeeper: '#bf5af2',
}

export const ROLE_ICONS: Record<string, string> = {
  batsman: '🏏',
  bowler: '🎯',
  allrounder: '⚡',
  wicketkeeper: '🧤',
}
