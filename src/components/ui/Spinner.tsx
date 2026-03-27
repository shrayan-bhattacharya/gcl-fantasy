import { cn } from '@/lib/utils'

export function Spinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div className={cn(
      'rounded-full border-2 border-dark-border border-t-neon-green animate-spin',
      sizes[size], className
    )} />
  )
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-base">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-dark-border border-t-neon-green animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-dark-border border-b-neon-orange animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.6s' }} />
        </div>
        <p className="text-dark-muted text-sm">Loading...</p>
      </div>
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('glass rounded-xl p-5', className)}>
      <div className="skeleton h-4 w-1/3 rounded-md mb-3" />
      <div className="skeleton h-6 w-2/3 rounded-md mb-2" />
      <div className="skeleton h-4 w-1/2 rounded-md" />
    </div>
  )
}
