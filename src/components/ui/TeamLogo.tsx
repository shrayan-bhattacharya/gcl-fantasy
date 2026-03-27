import { IPLTeam } from '@/types/database.types'
import { IPL_TEAMS } from '@/constants/ipl'
import { cn } from '@/lib/utils'

interface TeamLogoProps {
  team: IPLTeam
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showName?: boolean
  className?: string
}

const sizes = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-14 h-14 text-sm',
}

export function TeamLogo({ team, size = 'md', showName, className }: TeamLogoProps) {
  const info = IPL_TEAMS[team]
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-bold shrink-0',
          sizes[size]
        )}
        style={{ backgroundColor: info.color + '25', border: `1px solid ${info.color}50`, color: info.color }}
      >
        {team}
      </div>
      {showName && (
        <span className="text-sm font-medium text-white">{info.name}</span>
      )}
    </div>
  )
}
