'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useTransition, useEffect, useReducer } from 'react'
import { PageWrapper, AnimatedSection } from '@/components/layout/PageWrapper'
import { IPL_TEAMS, ROLE_COLORS, ROLE_ICONS, ROLE_LABELS } from '@/constants/ipl'
import { PickablePlayerCard, CompactPlayerCard } from '@/components/ui/PlayerCard'
import { createClient } from '@/lib/supabase/client'
import { Search, CheckCircle, Lock, Zap, X, Filter, Shield } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['ipl_players']['Row']

interface SelectedTeam {
  batsman_1: Player | null
  batsman_2: Player | null
  bowler_1: Player | null
  bowler_2: Player | null
  flex: Player | null
}

const emptyTeam: SelectedTeam = { batsman_1: null, batsman_2: null, bowler_1: null, bowler_2: null, flex: null }

interface Props {
  players: Player[]
  existingTeam: any | null
  isLocked: boolean
  phase: 'league' | 'knockout'
  userId: string
}

const SLOT_LABELS = [
  { key: 'batsman_1', label: 'Batsman 1 (or WK)', role: 'batsman' },
  { key: 'batsman_2', label: 'Batsman 2 (or WK)', role: 'batsman' },
  { key: 'bowler_1', label: 'Bowler 1', role: 'bowler' },
  { key: 'bowler_2', label: 'Bowler 2', role: 'bowler' },
  { key: 'flex', label: 'All-Rounder / WK', role: 'flex' },
] as const

const SLOT_KEYS = SLOT_LABELS.map(s => s.key) as (keyof SelectedTeam)[]

type SquadAction =
  | { type: 'PICK'; slot: keyof SelectedTeam; player: Player }
  | { type: 'REMOVE'; slot: keyof SelectedTeam }
  | { type: 'SET_SLOT'; slot: keyof SelectedTeam | null }

interface SquadState {
  team: SelectedTeam
  activeSlot: keyof SelectedTeam | null
}

function squadReducer(state: SquadState, action: SquadAction): SquadState {
  switch (action.type) {
    case 'PICK': {
      const newTeam = { ...state.team, [action.slot]: action.player }
      const currentIdx = SLOT_KEYS.indexOf(action.slot)
      const nextSlot = SLOT_KEYS.slice(currentIdx + 1).find(k => !newTeam[k]) ?? null
      return { team: newTeam, activeSlot: nextSlot }
    }
    case 'REMOVE':
      return { team: { ...state.team, [action.slot]: null }, activeSlot: action.slot }
    case 'SET_SLOT':
      return { ...state, activeSlot: action.slot }
  }
}

export function FantasyClient({ players, existingTeam, isLocked, phase, userId }: Props) {
  const [{ team, activeSlot }, dispatch] = useReducer(squadReducer, undefined, () => {
    if (existingTeam) {
      return {
        team: {
          batsman_1: existingTeam.batsman_1,
          batsman_2: existingTeam.batsman_2,
          bowler_1: existingTeam.bowler_1,
          bowler_2: existingTeam.bowler_2,
          flex: existingTeam.flex,
        },
        activeSlot: null as keyof SelectedTeam | null,
      }
    }
    return { team: emptyTeam, activeSlot: 'batsman_1' as keyof SelectedTeam | null }
  })
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState<string>('all')
  const [saved, setSaved] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Confetti burst when squad becomes complete
  useEffect(() => {
    if (Object.values(team).every(Boolean)) {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 1400)
      return () => clearTimeout(t)
    }
  }, [team])

  const supabase = createClient()

  // Filter players for the active slot
  const slotRoleFilter = activeSlot
    ? SLOT_LABELS.find(s => s.key === activeSlot)?.role
    : null

  const filteredPlayers = players.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.team.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTeam !== 'all' && p.team !== filterTeam) return false

    if (activeSlot === 'flex') {
      return true
    }
    if (slotRoleFilter === 'batsman') {
      return p.role === 'batsman' || p.role === 'wicketkeeper'
    }
    if (slotRoleFilter === 'bowler') {
      return p.role === 'bowler'
    }
    return true
  })

  // Prevent double-picking
  const pickedIds = new Set(Object.values(team).filter(Boolean).map(p => p!.id))

  function pickPlayer(player: Player) {
    if (!activeSlot) return
    if (pickedIds.has(player.id)) return
    dispatch({ type: 'PICK', slot: activeSlot, player })
  }

  function removePlayer(slot: keyof SelectedTeam) {
    dispatch({ type: 'REMOVE', slot })
  }

  const isComplete = Object.values(team).every(Boolean)

  async function saveTeam() {
    if (!isComplete) return
    startTransition(async () => {
      const { error } = await supabase.from('fantasy_teams').upsert({
        user_id: userId,
        phase,
        batsman_1_id: team.batsman_1!.id,
        batsman_2_id: team.batsman_2!.id,
        bowler_1_id: team.bowler_1!.id,
        bowler_2_id: team.bowler_2!.id,
        flex_player_id: team.flex!.id,
      }, { onConflict: 'user_id,phase' })

      if (!error) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  const phaseLabel = phase === 'league' ? 'League Stage' : 'Knockout Stage'

  return (
    <PageWrapper title="Fantasy Squad" subtitle={`Pick your 5-player squad for the ${phaseLabel}`}>
      {/* Phase badge */}
      <AnimatedSection className="mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20">
            <Shield className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-xs font-bold text-neon-cyan">{phaseLabel}</span>
          </div>
          {isLocked ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neon-orange/10 border border-neon-orange/20">
              <Lock className="w-3 h-3 text-neon-orange" />
              <span className="text-xs font-semibold text-neon-orange">Squads Locked</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neon-green/10 border border-neon-green/20">
              <Zap className="w-3 h-3 text-neon-green" />
              <span className="text-xs font-semibold text-neon-green">Squads Open</span>
            </div>
          )}
        </div>
      </AnimatedSection>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left: Squad builder */}
        <AnimatedSection className="lg:col-span-2">
          <div className="glass rounded-xl border border-dark-border sticky top-20">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Your {phaseLabel} Squad
              </h3>
              <p className="text-xs text-dark-muted">
                Your 5 players will earn points from every {phase === 'league' ? 'league' : 'knockout'} match
              </p>
            </div>

            {isLocked ? (
              <div className="p-6 text-center">
                <Lock className="w-8 h-8 mx-auto text-neon-orange mb-2 opacity-60" />
                <p className="text-sm text-dark-muted">Squad selection is locked</p>
                <p className="text-xs text-dark-muted/60 mt-1">Admin will unlock when changes are allowed</p>
                {/* Still show the current team if it exists */}
                {Object.values(team).some(Boolean) && (
                  <div className="mt-4 space-y-2 text-left">
                    {SLOT_LABELS.map(slot => {
                      const player = team[slot.key]
                      return player ? (
                        <CompactPlayerCard key={slot.key} player={player} showStats />
                      ) : null
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {SLOT_LABELS.map(slot => {
                  const player = team[slot.key]
                  const isActive = activeSlot === slot.key
                  return player ? (
                    <CompactPlayerCard
                      key={slot.key}
                      player={player}
                      showStats
                      onRemove={() => removePlayer(slot.key)}
                    />
                  ) : (
                    <motion.div
                      key={slot.key}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => dispatch({ type: 'SET_SLOT', slot: slot.key })}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200
                        ${isActive ? 'border-neon-blue/50 bg-neon-blue/5 shadow-[0_0_12px_rgba(0,102,204,0.12)]' : 'border-dashed border-dark-border hover:border-dark-muted'}
                      `}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: ROLE_COLORS[slot.role === 'flex' ? 'allrounder' : slot.role] + '18' }}>
                        {ROLE_ICONS[slot.role === 'flex' ? 'allrounder' : slot.role]}
                      </div>
                      <span className={`text-xs ${isActive ? 'text-neon-blue' : 'text-dark-muted'}`}>
                        {isActive ? `→ Select ${slot.label}` : slot.label}
                      </span>
                    </motion.div>
                  )
                })}

                {/* Confetti burst */}
                <AnimatePresence>
                  {showConfetti && (
                    <div className="relative h-0 overflow-visible">
                      {[...Array(10)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-2 h-2 rounded-full pointer-events-none"
                          style={{
                            backgroundColor: ['#0066CC', '#FFD700', '#39ff14', '#00e5ff', '#bf5af2'][i % 5],
                            left: '50%', top: '-8px',
                          }}
                          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                          animate={{
                            x: Math.cos((i / 10) * Math.PI * 2) * (50 + i * 6),
                            y: Math.sin((i / 10) * Math.PI * 2) * (40 + i * 5) - 20,
                            opacity: 0,
                            scale: [0, 1.5, 0],
                          }}
                          transition={{ duration: 0.9, ease: 'easeOut' }}
                        />
                      ))}
                    </div>
                  )}
                </AnimatePresence>

                <motion.button
                  disabled={!isComplete || isPending}
                  whileHover={isComplete ? { scale: 1.02 } : {}}
                  whileTap={isComplete ? { scale: 0.98 } : {}}
                  onClick={saveTeam}
                  className={`w-full mt-2 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300
                    ${saved
                      ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                      : isComplete
                        ? 'bg-neon-blue text-white shadow-[0_0_20px_rgba(0,102,204,0.5)]'
                        : 'bg-dark-elevated text-dark-muted border border-dark-border cursor-not-allowed'
                    }`}
                >
                  {saved ? <><CheckCircle className="w-4 h-4" /> Squad Saved!</> :
                    isPending ? 'Saving...' :
                    isComplete ? <><Zap className="w-4 h-4" /> Lock In Squad</> :
                    `Pick ${5 - Object.values(team).filter(Boolean).length} more player${5 - Object.values(team).filter(Boolean).length !== 1 ? 's' : ''}`
                  }
                </motion.button>
              </div>
            )}
          </div>
        </AnimatedSection>

        {/* Right: Player picker */}
        <AnimatedSection className="lg:col-span-3">
          {/* Search + team filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search players..."
                className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-all"
              />
            </div>
            <select
              value={filterTeam}
              onChange={e => setFilterTeam(e.target.value)}
              className="bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-blue/50 transition-all"
            >
              <option value="all">All Teams</option>
              {Object.keys(IPL_TEAMS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Active slot indicator */}
          {activeSlot && !isLocked && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neon-blue/5 border border-neon-blue/20 mb-3 text-xs text-neon-blue"
            >
              <div className="w-2 h-2 rounded-full bg-neon-blue animate-ping" />
              Selecting: <strong>{SLOT_LABELS.find(s => s.key === activeSlot)?.label}</strong>
              {activeSlot === 'batsman_1' || activeSlot === 'batsman_2'
                ? ' — pick a Batsman or Wicketkeeper'
                : activeSlot === 'bowler_1' || activeSlot === 'bowler_2'
                  ? ' — pick a Bowler'
                  : ' — pick any player'
              }
            </motion.div>
          )}

          {/* Players grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[680px] overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {filteredPlayers.map((player, i) => (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.02, type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <PickablePlayerCard
                    player={player}
                    isPicked={pickedIds.has(player.id)}
                    isLocked={isLocked}
                    onPick={() => pickPlayer(player)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredPlayers.length === 0 && (
              <div className="col-span-2 text-center py-10 text-dark-muted">
                <Filter className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No players match your filters</p>
              </div>
            )}
          </div>
        </AnimatedSection>
      </div>

      {/* Scoring guide */}
      <AnimatedSection className="mt-6">
        <h3 className="text-xs font-bold text-dark-muted mb-2 uppercase tracking-wider">Fantasy Points Guide</h3>
        <div className="flex gap-2">
          {[
            { icon: '🏏', label: 'Per run scored', pts: '1 pt' },
            { icon: '🎯', label: 'Per wicket taken', pts: '10 pts' },
          ].map(item => (
            <div key={item.label} className="glass rounded-lg px-4 py-3 flex items-center gap-3 flex-1">
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs text-dark-muted flex-1">{item.label}</span>
              <span className="text-sm font-bold text-neon-blue">{item.pts}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-dark-muted mt-3 text-center">
          One squad for the entire {phase === 'league' ? 'league stage' : 'knockout stage'} · Your players score from every match
        </p>
      </AnimatedSection>
    </PageWrapper>
  )
}
