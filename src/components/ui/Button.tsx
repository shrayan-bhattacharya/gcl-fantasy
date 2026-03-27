'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const variants = {
  primary: 'bg-neon-green text-dark-base font-semibold hover:bg-neon-green/90 shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:shadow-[0_0_30px_rgba(57,255,20,0.6)]',
  secondary: 'bg-neon-orange text-white font-semibold hover:bg-neon-orange/90 shadow-[0_0_20px_rgba(255,107,26,0.4)] hover:shadow-[0_0_30px_rgba(255,107,26,0.6)]',
  ghost: 'bg-transparent text-dark-muted hover:text-white hover:bg-dark-elevated',
  danger: 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30',
  outline: 'bg-transparent border border-dark-border text-white hover:border-neon-green/50 hover:bg-neon-green/5',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
}

export function Button({
  className, variant = 'primary', size = 'md', loading, icon, disabled, children, ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-200 select-none',
        variants[variant],
        sizes[size],
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || loading}
      {...(props as any)}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  )
}
