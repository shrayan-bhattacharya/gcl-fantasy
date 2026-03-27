import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMatchDate(dateStr: string): string {
  return format(new Date(dateStr), 'EEE, MMM d • h:mm a')
}

export function formatDateShort(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d')
}

export function formatTime(dateStr: string): string {
  return format(new Date(dateStr), 'h:mm a')
}

export function timeFromNow(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

export function isDeadlinePast(dateStr: string): boolean {
  return isPast(new Date(dateStr))
}

export function isDeadlineFuture(dateStr: string): boolean {
  return isFuture(new Date(dateStr))
}

// Unified lock: 1 hour before match_date (kept for legacy use)
export function isMatchLocked(matchDate: string): boolean {
  return isPast(new Date(new Date(matchDate).getTime() - 60 * 60 * 1000))
}

// IST = UTC+5:30
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

/** Returns the YYYY-MM-DD calendar date in IST for a UTC datetime string */
export function getMatchDay(dateStr: string): string {
  const istDate = new Date(new Date(dateStr).getTime() + IST_OFFSET_MS)
  return istDate.toISOString().slice(0, 10)
}

/** Lock opens 1 hour before the first match on a day */
export function getMatchDayLockTime(firstMatchDate: string): Date {
  return new Date(new Date(firstMatchDate).getTime() - 60 * 60 * 1000)
}

/**
 * Unlock = next day 1:00 AM IST
 * matchDay "2026-04-04" → unlocks at "2026-04-04T19:30:00Z" (= "2026-04-05 01:00 IST")
 */
export function getMatchDayUnlockTime(matchDay: string): Date {
  const [year, month, day] = matchDay.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 19, 30))
}

/** True if current time is in the locked window [lockTime, unlockTime) for a given match day */
export function isMatchDayLocked(matchDayMatches: Array<{ match_date: string }>): boolean {
  if (!matchDayMatches.length) return false
  const earliest = matchDayMatches.reduce((a, b) =>
    new Date(a.match_date) < new Date(b.match_date) ? a : b
  )
  const matchDay = getMatchDay(earliest.match_date)
  const lockTime = getMatchDayLockTime(earliest.match_date)
  const unlockTime = getMatchDayUnlockTime(matchDay)
  const now = new Date()
  return now >= lockTime && now < unlockTime
}

/** Format milliseconds as "Xh Xm" / "Xm Xs" / "Xs" */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Format a YYYY-MM-DD match day as "Sat, Apr 4" (treats input as local calendar date) */
export function formatDayLabel(matchDay: string): string {
  const [year, month, day] = matchDay.split('-').map(Number)
  return format(new Date(year, month - 1, day), 'EEE, MMM d')
}

export function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
