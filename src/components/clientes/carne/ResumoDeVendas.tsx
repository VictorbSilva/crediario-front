import { EmptyState } from '@/components/ui/EmptyState'
import type { CarneDoCliente } from '@/data/useCarne'
import { textoDoPlanoCurto } from '@/lib/carne'
import { dataBonita } from '@/lib/data'
import { formatarCentavos } from '@/lib/dinheiro'

type ResumoDeVendasProps = Readonly<{
  dados: CarneDoCliente
}>

/**
 * O bloco compacto do painel lateral: só as vendas em aberto, sem parcelas.
 * O carnê inteiro mora na página do cliente — ver `ClientePage`.
 */
export function ResumoDeVendas({ dados }: ResumoDeVendasProps) {
  const { carnes, carregando, erro } = dados

  if (erro) return <EmptyState>Não foi possível carregar o carnê.</EmptyState>
  if (carregando) return <EmptyState>Carregando…</EmptyState>

  const abertas = carnes.filter((carne) => !carne.resumo.quitada)

  if (abertas.length === 0) {
    return <EmptyState>Nenhuma venda em aberto.</EmptyState>
  }

  return (
    <div className="flex flex-col gap-2">
      {abertas.map(({ venda, parcelas, resumo }) => (
        <div
          key={venda.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              Venda de {dataBonita(venda.dataVenda)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {textoDoPlanoCurto(venda.numeroParcelas, parcelas)}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-bold tabular-nums text-slate-900">
              {formatarCentavos(resumo.abertoCentavos)}
            </div>
            <div className="text-xs text-slate-400">saldo</div>
          </div>
        </div>
      ))}
    </div>
  )
}
