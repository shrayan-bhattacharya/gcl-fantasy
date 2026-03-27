'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { ROLE_COLORS, ROLE_ICONS, ROLE_LABELS } from '@/constants/ipl'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['ipl_players']['Row']
type PlayerRole = Player['role']

// ─── Country → flagcdn.com code ───────────────────────────────────────────
// Keys are lowercase. West Indies has no ISO code — omitted so nothing renders.
const COUNTRY_CODES: Record<string, string> = {
  'india': 'in',
  'australia': 'au',
  'england': 'gb-eng',
  'south africa': 'za',
  'new zealand': 'nz',
  'sri lanka': 'lk',
  'afghanistan': 'af',
  'bangladesh': 'bd',
  'pakistan': 'pk',
  'zimbabwe': 'zw',
  'ireland': 'ie',
  'scotland': 'gb-sct',
  'netherlands': 'nl',
}

function countryCode(country: string | null): string | null {
  if (!country) return null
  return COUNTRY_CODES[country.toLowerCase().trim()] ?? null
}

function CountryFlag({ country }: { country: string | null }) {
  const [failed, setFailed] = useState(false)
  const code = countryCode(country)
  if (!code || failed) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w20/${code}.png`}
      width={20}
      height={15}
      alt={country ?? ''}
      className="rounded-sm inline-block shrink-0"
      onError={() => setFailed(true)}
    />
  )
}

// ─── Stat relevance by role ────────────────────────────────────────────────
function isStatRelevant(stat: 'runs' | 'wickets' | 'sr' | 'eco', role: PlayerRole): boolean {
  if (role === 'allrounder' || role === 'wicketkeeper') return true
  if (role === 'batsman') return stat === 'runs' || stat === 'sr'
  if (role === 'bowler') return stat === 'wickets' || stat === 'eco'
  return true
}

// ─── Animated counter (fires once when visible) ────────────────────────────
function AnimatedStat({
  value,
  decimals = 0,
  visible,
}: {
  value: number
  decimals?: number
  visible: boolean
}) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { duration: 1000, bounce: 0 })
  const display = useTransform(spring, n =>
    decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()
  )

  useEffect(() => {
    if (visible) mv.set(value)
  }, [visible, value, mv])

  return <motion.span>{display}</motion.span>
}

// ─── Single stat cell ──────────────────────────────────────────────────────
function StatCell({
  label,
  value,
  decimals,
  relevant,
  visible,
  color,
}: {
  label: string
  value: number | null
  decimals?: number
  relevant: boolean
  visible: boolean
  color: string
}) {
  const show = relevant && value !== null && value > 0
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span
        className="text-[11px] font-bold tabular-nums"
        style={{ color: show ? color : 'rgba(255,255,255,0.18)' }}
      >
        {show ? (
          <AnimatedStat value={value!} decimals={decimals} visible={visible} />
        ) : (
          '—'
        )}
      </span>
      <span className="text-[9px] text-dark-muted/50 uppercase tracking-wide leading-none">
        {label}
      </span>
    </div>
  )
}

// ─── Stat row ──────────────────────────────────────────────────────────────
function PlayerStats({
  player,
  visible,
}: {
  player: Player
  visible: boolean
}) {
  const color = ROLE_COLORS[player.role]
  return (
    <div className="flex items-center justify-between gap-1 pt-2 mt-2 border-t border-white/5">
      <StatCell label="Runs" value={player.career_runs} relevant={isStatRelevant('runs', player.role)} visible={visible} color={color} />
      <div className="w-px h-4 bg-white/6 shrink-0" />
      <StatCell label="Wkts" value={player.career_wickets} relevant={isStatRelevant('wickets', player.role)} visible={visible} color={color} />
      <div className="w-px h-4 bg-white/6 shrink-0" />
      <StatCell label="SR" value={player.strike_rate} decimals={1} relevant={isStatRelevant('sr', player.role)} visible={visible} color={color} />
      <div className="w-px h-4 bg-white/6 shrink-0" />
      <StatCell label="Eco" value={player.economy_rate} decimals={2} relevant={isStatRelevant('eco', player.role)} visible={visible} color={color} />
    </div>
  )
}

// ─── Viewport visibility hook ──────────────────────────────────────────────
function useInView(ref: React.RefObject<Element>): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold: 0.3 }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref])
  return inView
}

// ─── Full pickable card (fantasy squad builder grid) ──────────────────────
interface PickableCardProps {
  player: Player
  isPicked: boolean
  isLocked: boolean
  onPick: () => void
}

export function PickablePlayerCard({ player, isPicked, isLocked, onPick }: PickableCardProps) {
  const ref = useRef<HTMLButtonElement>(null!)
  const inView = useInView(ref)
  const color = ROLE_COLORS[player.role]


  return (
    <motion.button
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={!isPicked && !isLocked ? { scale: 1.02, y: -2 } : {}}
      whileTap={!isPicked && !isLocked ? { scale: 0.98 } : {}}
      onClick={() => !isPicked && !isLocked && onPick()}
      disabled={isPicked || isLocked}
      className={`text-left p-3 rounded-xl border flex flex-col gap-0 transition-colors duration-200 group w-full
        ${isPicked
          ? 'border-neon-blue/40 bg-neon-blue/8 opacity-70 cursor-not-allowed shadow-[0_0_12px_rgba(0,102,204,0.15)]'
          : isLocked
            ? 'border-dark-border bg-dark-card opacity-50 cursor-not-allowed'
            : 'border-dark-border bg-dark-card hover:border-[color:var(--card-accent)] hover:bg-dark-elevated cursor-pointer'
        }
      `}
      style={{ '--card-accent': color + '66' } as React.CSSProperties}
    >
      {/* Top row: icon + name/team + picked check */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: color + '18', border: `1px solid ${color}30` }}
        >
          {ROLE_ICONS[player.role]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">{player.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <CountryFlag country={player.country} />
            <TeamLogo team={player.team} size="xs" />
            <span className="text-[10px]" style={{ color }}>
              {ROLE_LABELS[player.role]}
            </span>
          </div>
        </div>
        {isPicked && (
          <svg className="w-4 h-4 text-neon-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      {/* Stats row */}
      <PlayerStats player={player} visible={inView} />
    </motion.button>
  )
}

// ─── Compact chip (selected slot display, dashboard, profile) ─────────────
interface CompactCardProps {
  player: Player
  showStats?: boolean
  onRemove?: () => void
}

export function CompactPlayerCard({ player, showStats = false, onRemove }: CompactCardProps) {
  const ref = useRef<HTMLDivElement>(null!)
  const inView = useInView(ref)
  const color = ROLE_COLORS[player.role]

  return (
    <motion.div
      ref={ref}
      whileHover={{ scale: 1.01 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-dark-border bg-dark-elevated group transition-colors duration-200 hover:border-white/15"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
        style={{ backgroundColor: color + '18', border: `1px solid ${color}30` }}
      >
        {ROLE_ICONS[player.role]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate leading-tight">{player.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <CountryFlag country={player.country} />
          <TeamLogo team={player.team} size="xs" />
          <span className="text-[10px] text-dark-muted">{ROLE_LABELS[player.role]}</span>
        </div>
        {showStats && (
          <PlayerStats player={player} visible={inView} />
        )}
      </div>
      {onRemove && (
        <motion.button
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="p-1 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      )}
    </motion.div>
  )
}
