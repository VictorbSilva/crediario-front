import { FlaskConical } from 'lucide-react'

export function DemoBanner() {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
      <FlaskConical size={18} aria-hidden className="mt-0.5 shrink-0 text-slate-400" />
      <p className="min-w-0 text-sm leading-snug text-slate-600">
        <span className="font-semibold text-slate-900">Dados de demonstração.</span>{' '}
        Esta tela ainda não está ligada ao Firestore — os números e nomes são fixos, só
        para validar o layout. Nenhum valor aqui foi calculado por regra de negócio.
      </p>
    </div>
  )
}
