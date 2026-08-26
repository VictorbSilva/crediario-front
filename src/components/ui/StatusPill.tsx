import type { ReactNode } from 'react'

export type TomStatus = 'neutro' | 'marca' | 'sucesso' | 'alerta' | 'perigo'

const tons: Record<TomStatus, string> = {
  neutro: 'bg-slate-100 text-slate-600',
  marca: 'bg-brand-50 text-brand-700',
  sucesso: 'bg-success-soft text-success',
  alerta: 'bg-warning-soft text-warning',
  perigo: 'bg-danger-soft text-danger',
}

type StatusPillProps = {
  tom?: TomStatus
  children: ReactNode
  className?: string
}

export function StatusPill({ tom = 'neutro', children, className = '' }: StatusPillProps) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tons[tom]} ${className}`}
    >
      {children}
    </span>
  )
}
