'use client'

import { motion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 200 } },
}

export function PageWrapper({ children, className, title, subtitle, actions }: PageWrapperProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex-1 min-h-screen px-4 py-6 lg:px-8 lg:py-8', className)}
    >
      {(title || actions) && (
        <motion.div variants={itemVariants} className="mb-6 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h1
                className="text-2xl font-bold text-white"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm text-dark-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </motion.div>
      )}
      {children}
    </motion.div>
  )
}

// Use this for individual animated sections inside a page
export function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      variants={itemVariants}
      className={className}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

export { itemVariants, containerVariants }
