import { cn } from '@/lib/utils'
import { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-sm font-medium text-dark-muted">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted">{icon}</span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-dark-card border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm',
              'placeholder:text-dark-muted/50',
              'focus:outline-none focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20',
              'transition-all duration-200',
              icon && 'pl-10',
              error && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-sm font-medium text-dark-muted">{label}</label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full bg-dark-card border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm',
            'focus:outline-none focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20',
            'transition-all duration-200 cursor-pointer',
            error && 'border-red-500/50',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
