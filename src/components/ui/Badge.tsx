import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'orange' | 'gold' | 'cyan' | 'purple' | 'muted' | 'red'
  size?: 'sm' | 'md'
  className?: string
  dot?: boolean
}

const variants = {
  green:  'bg-neon-green/10 text-neon-green border border-neon-green/20',
  orange: 'bg-neon-orange/10 text-neon-orange border border-neon-orange/20',
  gold:   'bg-neon-gold/10 text-neon-gold border border-neon-gold/20',
  cyan:   'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20',
  purple: 'bg-neon-purple/10 text-neon-purple border border-neon-purple/20',
  muted:  'bg-white/5 text-dark-muted border border-white/10',
  red:    'bg-red-500/10 text-red-400 border border-red-500/20',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs rounded-md',
  md: 'px-2.5 py-1 text-xs rounded-lg',
}

export function Badge({ children, variant = 'muted', size = 'md', className, dot }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', variants[variant], sizes[size], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: 'upcoming' | 'live' | 'completed' }) {
  const config = {
    upcoming: { label: 'Upcoming', variant: 'cyan' as const, dot: true },
    live: { label: 'Live', variant: 'green' as const, dot: true },
    completed: { label: 'Completed', variant: 'muted' as const, dot: false },
  }
  const { label, variant, dot } = config[status]
  return <Badge variant={variant} dot={dot}>{label}</Badge>
}
