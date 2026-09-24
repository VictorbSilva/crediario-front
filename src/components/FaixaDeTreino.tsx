import { ehProducao } from '@/lib/ambiente'

export function FaixaDeTreino() {
  if (ehProducao(import.meta.env)) return null

  return (
    <div className="border-b border-warning/30 bg-warning-soft px-4 py-1.5 text-center text-sm font-semibold text-warning">
      Ambiente de treino — nada do que for lançado aqui é real.
    </div>
  )
}
