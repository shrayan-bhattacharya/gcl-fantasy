'use client'

import { cn } from '@/lib/utils'
import { motion, HTMLMotionProps } from 'framer-motion'

interface CardProps extends HTMLMotionProps<'div'> {
  glow?: 'green' | 'orange' | 'gold' | 'cyan' | 'none'
  elevated?: boolean
  hover?: boolean
}

export function Card({ className, glow = 'none', elevated = false, hover = false, children, ...props }: CardProps) {
  return (
    <motion.div
      className={cn(
        'rounded-xl relative overflow-hidden',
        elevated ? 'glass-elevated' : 'glass',
        glow === 'green' && 'glow-green',
        glow === 'orange' && 'glow-orange',
        glow === 'gold' && 'glow-gold',
        glow === 'cyan' && 'glow-cyan',
        hover && 'transition-all duration-300 hover:scale-[1.02] cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('px-5 py-4 border-b border-white/5', className)}>
      {children}
    </div>
  )
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('px-5 py-4', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('px-5 py-3 border-t border-white/5', className)}>
      {children}
    </div>
  )
}
