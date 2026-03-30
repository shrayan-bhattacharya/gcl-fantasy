'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, ShieldCheck, Calendar, Users, BarChart2, RefreshCw, UserCog } from 'lucide-react'

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: ShieldCheck },
  { href: '/admin/sync', label: 'CricAPI Sync', icon: RefreshCw },
  { href: '/admin/matches', label: 'Matches', icon: Calendar },
  { href: '/admin/players', label: 'Players', icon: Users },
  { href: '/admin/results', label: 'Enter Results', icon: BarChart2 },
  { href: '/admin/users', label: 'Users', icon: UserCog },
]

export default function AdminSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center px-4 h-14 border-b border-dark-border glass">
        <button onClick={() => setOpen(true)} className="p-1 text-white">
          <Menu className="w-5 h-5" />
        </button>
        <p className="ml-3 text-sm font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>Admin Panel</p>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-52 glass border-r border-dark-border flex flex-col py-4 transition-transform duration-200
          md:relative md:inset-auto md:translate-x-0 md:sticky md:top-0 md:h-screen md:shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neon-orange/20 border border-neon-orange/40 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-neon-orange" />
            </div>
            <div>
              <p className="text-sm font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>Admin Panel</p>
              <p className="text-[10px] text-dark-muted">IPL Fantasy 2026</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden p-1 text-dark-muted hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {ADMIN_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-muted hover:text-white hover:bg-dark-elevated transition-all"
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-muted hover:text-white hover:bg-dark-elevated transition-all mt-4"
          >
            ← Back to App
          </Link>
        </nav>
      </aside>
    </>
  )
}
