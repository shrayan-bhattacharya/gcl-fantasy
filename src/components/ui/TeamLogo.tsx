'use client'

import Image from 'next/image'
import { useState } from 'react'
import { IPL_TEAMS } from '@/constants/ipl'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type IPLTeam = Database['public']['Tables']['ipl_players']['Row']['team']

interface TeamLogoProps {
  team: IPLTeam
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showName?: boolean
  className?: string
}

// Map team initials → filename in /public/logos/ (handles the lowercase csk.png)
const LOGO_FILES: Record<string, string> = {
  CSK: 'csk.png',
  DC: 'DC.png',
  GT: 'GT.svg',
  KKR: 'KKR.svg',
  LSG: 'LSG.png',
  MI: 'MI.png',
  PK: 'PK.svg',
  RCB: 'RCB.webp',
  RR: 'RR.png',
  SRH: 'SRH.png',
}

const px = { xs: 24, sm: 32, md: 40, lg: 56 }
const sizes = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
}

// Cricket ball fallback SVG
function CricketBall({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="opacity-40">
      <circle cx="12" cy="12" r="10" fill="#8b4513" stroke="#6b3410" strokeWidth="1" />
      <path d="M12 2C12 2 8 6 8 12s4 10 4 10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M12 2C12 2 16 6 16 12s-4 10-4 10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M2 12h20" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

export function TeamLogo({ team, size = 'md', showName, className }: TeamLogoProps) {
  const [imgError, setImgError] = useState(false)
  const info = IPL_TEAMS[team]
  const filename = LOGO_FILES[team?.toUpperCase()]
  const logoSrc = filename ? `/logos/${filename}` : null
  const dimension = px[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('relative rounded-full overflow-hidden shrink-0 flex items-center justify-center', sizes[size])}
        style={{ backgroundColor: info?.color + '18', border: `1px solid ${info?.color ?? '#ffffff'}30` }}
      >
        {logoSrc && !imgError ? (
          <Image
            src={logoSrc}
            alt={team}
            width={dimension}
            height={dimension}
            className="object-contain w-full h-full p-[2px]"
            onError={() => setImgError(true)}
          />
        ) : (
          <CricketBall size={dimension * 0.65} />
        )}
      </div>
      {showName && info && (
        <span className="text-sm font-medium text-white">{info.name}</span>
      )}
    </div>
  )
}
