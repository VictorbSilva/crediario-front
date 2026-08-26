export type EstadoSync =
  | 'sincronizado'
  | 'sincronizando'
  | 'pendente'
  | 'offline'
  | 'erro'
  | 'nao-configurado'

type Aparencia = { rotulo: string; caixa: string; ponto: string; pulsa: boolean }

const aparencias: Record<EstadoSync, Aparencia> = {
  sincronizado: {
    rotulo: 'Sincronizado',
    caixa: 'bg-success-soft text-success',
    ponto: 'bg-success',
    pulsa: false,
  },
  sincronizando: {
    rotulo: 'Sincronizando…',
    caixa: 'bg-brand-50 text-brand-700',
    ponto: 'bg-brand-500',
    pulsa: true,
  },
  pendente: {
    rotulo: 'Alterações pendentes',
    caixa: 'bg-brand-50 text-brand-700',
    ponto: 'bg-brand-500',
    pulsa: true,
  },
  offline: {
    rotulo: 'Offline: salvo no aparelho',
    caixa: 'bg-warning-soft text-warning',
    ponto: 'bg-warning',
    pulsa: false,
  },
  erro: {
    rotulo: 'Erro de sincronização',
    caixa: 'bg-danger-soft text-danger',
    ponto: 'bg-danger',
    pulsa: false,
  },
  'nao-configurado': {
    rotulo: 'Sync não configurado',
    caixa: 'bg-slate-100 text-slate-500',
    ponto: 'bg-slate-400',
    pulsa: false,
  },
}

type SyncBadgeProps = {
  estado: EstadoSync
  className?: string
}

export function SyncBadge({ estado, className = '' }: SyncBadgeProps) {
  const { rotulo, caixa, ponto, pulsa } = aparencias[estado]

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${caixa} ${className}`}
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${ponto} ${pulsa ? 'animate-pulse' : ''}`}
      />
      <span className="truncate">{rotulo}</span>
    </span>
  )
}
