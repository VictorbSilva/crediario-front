import { Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

type NotaProps = {
  tom: 'info' | 'alerta'
  titulo?: string
  children: ReactNode
}

export function Nota({ tom, titulo, children }: NotaProps) {
  const info = tom === 'info'
  const Icone = info ? Info : TriangleAlert

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${
        info
          ? 'border-brand-100 bg-brand-50 text-brand-700'
          : 'border-warning/30 bg-warning-soft text-warning'
      }`}
    >
      <Icone size={18} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-sm leading-snug">
        {titulo ? <div className="font-semibold">{titulo}</div> : null}
        <div className={titulo ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  )
}
