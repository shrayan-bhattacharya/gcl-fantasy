'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Calendar, Users, Trophy, User,
  ShieldCheck, LogOut, ChevronRight, Zap, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/matches',     label: 'Matches',       icon: Calendar },
  { href: '/fantasy',     label: 'Fantasy Team',  icon: Zap },
  { href: '/leaderboard', label: 'Leaderboard',   icon: Trophy },
  { href: '/profile',     label: 'Profile',       icon: User },
]

interface SidebarProps {
  userRole?: string
  userEmail?: string
  displayName?: string
}

export function Sidebar({ userRole, displayName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full py-4">

      {/* Logo */}
      <div className="px-5 mb-8">
        <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-neon-blue/10 border border-neon-blue/30 flex items-center justify-center">
            <span className="text-base">🏏</span>
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              GCL Fantasy
            </p>
            <p className="text-[10px] text-dark-muted">by GreyChain AI · 2026</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                active
                  ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20'
                  : 'text-dark-muted hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-neon-blue/5 rounded-xl"
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                />
              )}
              {/* Active left bar */}
              {active && (
                <motion.div
                  layoutId="nav-bar"
                  className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-neon-blue"
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  style={{ boxShadow: '0 0 8px rgba(0,102,204,0.6)' }}
                />
              )}
              <item.icon className={cn('w-4 h-4 shrink-0 relative', active ? 'text-neon-blue' : 'text-dark-muted group-hover:text-white')} />
              <span className="relative">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto text-neon-blue/50 relative" />}
            </Link>
          )
        })}

        {userRole === 'admin' && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border',
              pathname.startsWith('/admin')
                ? 'bg-neon-orange/10 text-neon-orange border-neon-orange/20'
                : 'text-dark-muted hover:text-white hover:bg-white/5 border-transparent'
            )}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Admin Panel
          </Link>
        )}
      </nav>

      {/* Bottom: user + signout + powered by */}
      <div className="px-3 mt-4 space-y-3">
        <div className="p-3 rounded-xl bg-dark-elevated border border-dark-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-neon-blue/20 border border-neon-blue/30 flex items-center justify-center text-xs font-bold text-neon-blue">
              {(displayName?.[0] ?? '?').toUpperCase()}
            </div>
            <p className="text-sm font-medium text-white truncate">{displayName ?? 'User'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-dark-muted hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-colors"
          >
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>

        {/* Powered by GreyChain AI */}
        <div className="flex items-center justify-center gap-1.5 py-1">
          <div className="w-3.5 h-3.5 rounded-sm bg-neon-blue/20 border border-neon-blue/30 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-blue" />
          </div>
          <p className="text-[10px] text-dark-muted/60">
            Powered by <span className="text-neon-blue/70 font-medium">GreyChain AI</span>
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col h-screen sticky top-0 glass border-r border-dark-border">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glass rounded-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-56 glass border-r border-dark-border"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
