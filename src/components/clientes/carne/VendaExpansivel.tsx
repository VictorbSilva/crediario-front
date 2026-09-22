import { ChevronRight } from 'lucide-react'
import { ListaDeParcelas } from '@/components/clientes/carne/ListaDeParcelas'
import { StatusPill } from '@/components/ui/StatusPill'
import type { TomStatus } from '@/components/ui/StatusPill'
import {
  situacaoDaVenda,
  textoDaMulta,
  textoDasPagas,
  textoDoJuros,
  textoDoPlano,
} from '@/lib/carne'
import type { SituacaoVenda } from '@/lib/carne'
import { dataBonita } from '@/lib/data'
import { formatarCentavos } from '@/lib/dinheiro'
import type { VendaComCarne } from '@/lib/parcelas'
import type { Venda } from '@/types/venda'

const rotulos: Record<SituacaoVenda, string> = {
  quitada: 'Quitada',
  atrasada: 'Atrasada',
  'em-dia': 'Em dia',
}

const tons: Record<SituacaoVenda, TomStatus> = {
  quitada: 'neutro',
  atrasada: 'perigo',
  'em-dia': 'sucesso',
}

type VendaExpansivelProps = Readonly<{
  carne: VendaComCarne<Venda>
  hoje: string
  simulando: boolean
  aberta: boolean
  aoAlternar: () => void
}>

export function VendaExpansivel({
  carne,
  hoje,
  simulando,
  aberta,
  aoAlternar,
}: VendaExpansivelProps) {
  const { venda, parcelas, resumo } = carne
  const situacao = situacaoDaVenda(resumo)
  const painelId = `carne-${venda.id}`

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        aria-controls={painelId}
        className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
          aberta ? 'border-brand-200 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <ChevronRight
          size={20}
          aria-hidden
          className={`shrink-0 transition-transform ${
            aberta ? 'rotate-90 text-brand-600' : 'text-slate-400'
          }`}
        />

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900">
            Venda de {dataBonita(venda.dataVenda)}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {textoDoPlano(venda.numeroParcelas, venda.valorParcelaCentavos)}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold tabular-nums text-slate-900">
            {formatarCentavos(venda.valorTotalCentavos)}
          </span>
          <span className="mt-0.5 block text-xs text-slate-400">
            {textoDasPagas(parcelas, venda.numeroParcelas)}
          </span>
        </span>

        {venda.pendente ? <StatusPill tom="marca">Pendente</StatusPill> : null}
        <StatusPill tom={tons[situacao]}>{rotulos[situacao]}</StatusPill>
      </button>

      {aberta ? (
        <div id={painelId} className="flex flex-col gap-2 pl-0 sm:pl-8">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Taxas desta venda
            </span>
            <StatusPill tom="marca">{textoDaMulta(venda)}</StatusPill>
            <StatusPill tom="marca">{textoDoJuros(venda)}</StatusPill>
            <span className="text-xs text-slate-400">
              informadas por você, não decididas pelo sistema
            </span>
          </div>

          <ListaDeParcelas
            parcelas={parcelas}
            total={venda.numeroParcelas}
            hoje={hoje}
            simulando={simulando}
          />
        </div>
      ) : null}
    </div>
  )
}
