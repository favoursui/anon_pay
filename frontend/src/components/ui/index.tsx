'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

// Button 
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'primary', size = 'md', loading, children, className, disabled, ...props
}: ButtonProps) {
  const base = 'btn-press inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-accent-primary text-bg-primary hover:bg-accent-primary/90 glow-green',
    secondary: 'bg-bg-elevated border border-border-default text-text-primary hover:border-border-strong',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated',
    danger: 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

// Input 
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  prefix?: string
}

export function Input({ label, error, prefix, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-text-secondary">{label}</label>}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-mono">
            {prefix}
          </span>
        )}
        <input
          className={cn(
            'input-focus w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted',
            prefix && 'pl-8',
            error && 'border-red-500/50',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// Textarea 
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-text-secondary">{label}</label>}
      <textarea
        className={cn(
          'input-focus w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted resize-none',
          error && 'border-red-500/50',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// Card 
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-bg-card border border-border-subtle rounded-2xl', className)}
      {...props}
    >
      {children}
    </div>
  )
}

// Badge 
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
      status === 'confirmed' && 'badge-confirmed',
      status === 'pending' && 'badge-pending',
      status === 'failed' && 'badge-failed',
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        status === 'confirmed' && 'bg-accent-primary',
        status === 'pending' && 'bg-yellow-400 animate-pulse',
        status === 'failed' && 'bg-red-400',
      )} />
      {status}
    </span>
  )
}

// Skeleton 
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg', className)} />
}

// Page Header 
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-text-secondary text-sm mt-1">{subtitle}</p>}
    </div>
  )
}
