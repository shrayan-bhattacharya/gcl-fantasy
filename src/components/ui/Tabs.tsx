'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useState } from 'react'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (id: string) => void
  children?: (activeTab: string) => React.ReactNode
  className?: string
}

export function Tabs({ tabs, defaultTab, onChange, children, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)

  function handleChange(id: string) {
    setActive(id)
    onChange?.(id)
  }

  return (
    <div className={className}>
      <div className="relative flex gap-1 p-1 bg-dark-card rounded-xl border border-dark-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 z-10',
              active === tab.id ? 'text-dark-base' : 'text-dark-muted hover:text-white'
            )}
          >
            {active === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 bg-neon-green rounded-lg glow-green"
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        ))}
      </div>
      {children && (
        <div className="mt-4">{children(active)}</div>
      )}
    </div>
  )
}
