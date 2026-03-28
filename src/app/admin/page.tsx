import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, Users, BarChart2, UserPlus } from 'lucide-react'
import { FantasyLockControl } from './FantasyLockControl'
import { PredictionWindowControl } from './PredictionWindowControl'

export default async function AdminOverview() {
  const supabase = await createClient()
  const [{ count: matchCount }, { count: playerCount }, { count: userCount }, { data: lockSettings }, { data: predWindow }] = await Promise.all([
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('ipl_players').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('fantasy_lock').select('is_locked, phase').limit(1).single(),
    supabase.from('prediction_window').select('is_open').limit(1).single(),
  ])

  const cards = [
    { label: 'Total Matches', value: matchCount ?? 0, icon: Calendar, href: '/admin/matches', color: '#00e5ff' },
    { label: 'Total Players', value: playerCount ?? 0, icon: Users, href: '/admin/players', color: '#39ff14' },
    { label: 'Users Registered', value: userCount ?? 0, icon: UserPlus, href: '/admin/invites', color: '#ffd700' },
    { label: 'Enter Results', value: '→', icon: BarChart2, href: '/admin/results', color: '#ff6b1a' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Admin Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <Link key={card.label} href={card.href}>
            <div className="glass rounded-xl p-5 border border-dark-border hover:border-white/20 transition-all hover:scale-[1.02] cursor-pointer">
              <card.icon className="w-6 h-6 mb-3" style={{ color: card.color }} />
              <p className="text-2xl font-black mb-1" style={{ fontFamily: 'Outfit, sans-serif', color: card.color }}>{card.value}</p>
              <p className="text-xs text-dark-muted">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Fantasy Lock Control */}
      <FantasyLockControl
        initialLocked={lockSettings?.is_locked ?? false}
        initialPhase={lockSettings?.phase ?? 'league'}
      />

      {/* Prediction Window Control */}
      <PredictionWindowControl
        initialOpen={predWindow?.is_open ?? true}
      />

      <div className="glass rounded-xl border border-dark-border p-6 mt-6">
        <h2 className="text-sm font-bold text-white mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/matches" className="px-4 py-2 rounded-xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 text-sm font-medium hover:bg-neon-cyan/20 transition-colors">+ Add Match</Link>
          <Link href="/admin/players" className="px-4 py-2 rounded-xl bg-neon-green/10 text-neon-green border border-neon-green/20 text-sm font-medium hover:bg-neon-green/20 transition-colors">+ Add Player</Link>
          <Link href="/admin/results" className="px-4 py-2 rounded-xl bg-neon-orange/10 text-neon-orange border border-neon-orange/20 text-sm font-medium hover:bg-neon-orange/20 transition-colors">Enter Results</Link>
          <Link href="/admin/invites" className="px-4 py-2 rounded-xl bg-neon-gold/10 text-neon-gold border border-neon-gold/20 text-sm font-medium hover:bg-neon-gold/20 transition-colors">Generate Invite</Link>
        </div>
      </div>
    </div>
  )
}
