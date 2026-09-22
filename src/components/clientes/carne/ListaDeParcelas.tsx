import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { StatusPill } from '@/components/ui/StatusPill'
import type { TomStatus } from '@/components/ui/StatusPill'
import { janelaDeParcelas, textoDaSituacao, textoDoResto } from '@/lib/carne'
import { dataBonita } from '@/lib/data'
import { formatarCentavos } from '@/lib/dinheiro'
import type { ParcelaComEstado, SituacaoParcela } from '@/lib/parcelas'

const tons: Record<SituacaoParcela, TomStatus> = {
  paga: 'sucesso',
  vencida: 'perigo',
  parcial: 'alerta',
  'a-vencer': 'neutro',
}

type LinhaProps = Readonly<{
  item: ParcelaComEstado
  total: number
  hoje: string
  simulando: boolean
  aoRegistrarPagamento?: (item: ParcelaComEstado) => void
}>

function Linha({ item, total, hoje, simulando, aoRegistrarPagamento }: LinhaProps) {
  const { parcela, pagoCentavos, estado, encargos, taxaPropria } = item
  const vencida = estado.situacao === 'vencida'
  const encargoTotal = encargos.multaCentavos + encargos.jurosCentavos
  const mostrarEncargo = simulando && encargoTotal > 0

  return (
    <li
      className={`rounded-lg border p-3 ${
        vencida ? 'border-danger/25 bg-danger-soft' : 'border-slate-200 bg-white'
      } ${taxaPropria ? 'border-warning' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-900">
          {parcela.numero}/{total}
        </span>
        <span className={`text-sm ${vencida ? 'font-semibold text-danger' : 'text-slate-700'}`}>
          {dataBonita(parcela.vencimento)}
        </span>
        <StatusPill tom={tons[estado.situacao]}>{textoDaSituacao(item, hoje)}</StatusPill>
        <span className="ml-auto text-base font-bold tabular-nums text-slate-900">
          {formatarCentavos(parcela.valorCentavos)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-slate-700">
        {estado.situacao === 'paga' ? (
          <span>quitada, sem acréscimo</span>
        ) : (
          <span>
            {pagoCentavos > 0 ? `pago ${formatarCentavos(pagoCentavos)} · ` : ''}
            resta {formatarCentavos(estado.restanteCentavos)}
          </span>
        )}

        {taxaPropria ? <StatusPill tom="alerta">taxa própria</StatusPill> : null}
      </div>

      {aoRegistrarPagamento && estado.situacao !== 'paga' ? (
        <button
          type="button"
          onClick={() => aoRegistrarPagamento(item)}
          className={`mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors sm:w-auto ${
            vencida
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Registrar pagamento
        </button>
      ) : null}

      {mostrarEncargo ? (
        <div className="mt-1.5 text-sm font-semibold tabular-nums text-warning">
          {formatarCentavos(estado.restanteCentavos)} + multa{' '}
          {formatarCentavos(encargos.multaCentavos)} + juros{' '}
          {formatarCentavos(encargos.jurosCentavos)} ={' '}
          {formatarCentavos(estado.restanteCentavos + encargoTotal)}
        </div>
      ) : null}
    </li>
  )
}

type ListaDeParcelasProps = Readonly<{
  parcelas: readonly ParcelaComEstado[]
  /** Quantas parcelas o plano da venda tem — ver `textoDasPagas`. */
  total: number
  hoje: string
  simulando: boolean
  /** Ausente no painel lateral, que é só leitura. */
  aoRegistrarPagamento?: (item: ParcelaComEstado) => void
}>

export function ListaDeParcelas({
  parcelas,
  total,
  hoje,
  simulando,
  aoRegistrarPagamento,
}: ListaDeParcelasProps) {
  const [mostrarTodas, setMostrarTodas] = useState(false)

  const { visiveis, resto } = janelaDeParcelas(parcelas)
  const todas = [...parcelas].sort((a, b) => a.parcela.numero - b.parcela.numero)

  // A janela é o padrão, não um teto: ela põe na frente as parcelas que
  // importam na porta do cliente. Esconder o resto sem saída foi reclamação
  // do teste manual de 22/09 — agora abre.
  const listadas = mostrarTodas ? todas : visiveis
  const escondidas = todas.length - visiveis.length

  return (
    <>
      <ul className="flex flex-col gap-2">
        {listadas.map((item) => (
          <Linha
            key={item.parcela.id}
            item={item}
            total={total}
            hoje={hoje}
            simulando={simulando}
            aoRegistrarPagamento={aoRegistrarPagamento}
          />
        ))}
      </ul>

      {escondidas > 0 ? (
        <button
          type="button"
          onClick={() => setMostrarTodas((atual) => !atual)}
          aria-expanded={mostrarTodas}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {mostrarTodas ? (
            <>
              <ChevronUp size={16} aria-hidden />
              Mostrar só as próximas
            </>
          ) : (
            <>
              <ChevronDown size={16} aria-hidden />
              Ver todas as {total} parcelas
            </>
          )}
        </button>
      ) : null}

      {resto && !mostrarTodas ? (
        <p className="px-1 pt-1.5 text-xs text-slate-600">{textoDoResto(resto, total)}</p>
      ) : null}
    </>
  )
}
