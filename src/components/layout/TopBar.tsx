'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Sun, Moon, HelpCircle } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useState } from 'react'
import { useTheme } from './ThemeProvider'
import { useRouter, usePathname } from 'next/navigation'

interface TopBarProps {
  displayName?: string | null
  email?: string | null
  totalScore?: number
  rank?: number
}

export function TopBar({ displayName, email, totalScore = 0, rank }: TopBarProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const { theme, toggle } = useTheme()
  const initials = getInitials(displayName ?? email ?? null)
  const router = useRouter()
  const pathname = usePathname()

  function handleShowGuide() {
    localStorage.removeItem('gcl-guide-dismissed')
    if (pathname === '/dashboard') {
      window.dispatchEvent(new CustomEvent('show-gcl-guide'))
    } else {
      sessionStorage.setItem('gcl-guide-force', '1')
      router.push('/dashboard')
    }
  }

  return (
    <header
      className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 lg:px-6 border-b border-dark-border/60"
      style={{ background: 'var(--theme-surface)' }}
    >
      {/* Left: branding */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="hidden sm:flex items-center gap-2 text-dark-muted text-xs">
          <span className="text-base">🏏</span>
          <span className="gradient-text font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            GCL Fantasy 2026
          </span>
        </div>
      </div>

      {/* Right: score chip + theme toggle + bell + avatar */}
      <div className="flex items-center gap-2">
        {/* Score chip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 glass rounded-lg border border-neon-blue/20"
        >
          <span className="text-xs text-dark-muted">Points</span>
          <span className="text-sm font-bold text-neon-blue" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {totalScore.toLocaleString()}
          </span>
          {rank && (
            <>
              <span className="text-dark-border">|</span>
              <span className="text-xs text-neon-gold font-semibold">#{rank}</span>
            </>
          )}
        </motion.div>

        {/* Theme toggle */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggle}
          className="relative p-2 rounded-lg hover:bg-dark-elevated transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <AnimatePresence mode="wait">
            {theme === 'dark' ? (
              <motion.div
                key="sun"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.15 }}
              >
                <Sun className="w-4 h-4 text-dark-muted hover:text-neon-gold" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ opacity: 0, rotate: 90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -90 }}
                transition={{ duration: 0.15 }}
              >
                <Moon className="w-4 h-4 text-dark-muted hover:text-neon-blue" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Help / How to play */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleShowGuide}
          className="p-2 rounded-lg hover:bg-dark-elevated transition-colors"
          title="How to play"
        >
          <HelpCircle className="w-4 h-4 text-dark-muted" />
        </motion.button>

        {/* Avatar + dropdown */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-dark-elevated transition-colors"
          >
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-neon-blue/20 border border-neon-blue/40 flex items-center justify-center text-xs font-bold text-neon-blue">
                {initials}
              </div>
              <motion.span
                className="absolute inset-0 rounded-full border border-neon-blue/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <span className="hidden sm:block text-sm font-medium text-white max-w-[100px] truncate">
              {displayName ?? 'User'}
            </span>
            <ChevronDown className={cn('w-3 h-3 text-dark-muted transition-transform duration-200', showDropdown && 'rotate-180')} />
          </motion.button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute right-0 top-full mt-2 w-44 glass-elevated rounded-xl border border-dark-border shadow-2xl overflow-hidden"
                onMouseLeave={() => setShowDropdown(false)}
              >
                <div className="px-3 py-2 border-b border-white/5">
                  <p className="text-xs text-dark-muted truncate">{email}</p>
                </div>
                <div className="p-1">
                  <a href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-dark-elevated rounded-lg transition-colors">
                    Profile
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
