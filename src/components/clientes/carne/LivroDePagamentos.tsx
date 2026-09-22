import { useState } from 'react'
import { StatusPill } from '@/components/ui/StatusPill'
import { dataBonita, dataLocalISO } from '@/lib/data'
import { formatarCentavos } from '@/lib/dinheiro'
import type { FormaDePagamento, Pagamento } from '@/types/venda'

const formas: Record<FormaDePagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
}

type LivroDePagamentosProps = Readonly<{
  pagamentos: readonly Pagamento[]
  aoCancelar: (pagamento: Pagamento, quando: string) => void
}>

/**
 * O protótipo põe "Cancelar pagamento" no botão da parcela. Aqui não dá: no
 * modelo que o dono descreveu, pagamento não pertence a parcela nenhuma — uma
 * parcela pode estar coberta por três pagamentos, e um pagamento pode cobrir
 * três parcelas. Cancelar só faz sentido sobre o lançamento, que é o que esta
 * lista mostra.
 *
 * Cancelar é evento novo, nunca `delete`: a regra do Firestore recusa remoção e
 * só aceita `cancelado` indo de `false` para `true`.
 */
export function LivroDePagamentos({ pagamentos, aoCancelar }: LivroDePagamentosProps) {
  const [confirmando, setConfirmando] = useState<string | null>(null)

  if (pagamentos.length === 0) return null

  const emOrdem = [...pagamentos].sort((a, b) =>
    a.data === b.data ? a.id.localeCompare(b.id) : b.data.localeCompare(a.data),
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Pagamentos recebidos
      </div>

      <ul className="flex flex-col gap-1.5">
        {emOrdem.map((pagamento) => {
          const cancelado = pagamento.cancelado === true

          return (
            <li key={pagamento.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span
                className={`text-sm tabular-nums ${
                  cancelado ? 'text-slate-400 line-through' : 'font-semibold text-slate-900'
                }`}
              >
                {formatarCentavos(pagamento.valorCentavos)}
              </span>
              <span className="text-xs text-slate-500">
                {dataBonita(pagamento.data)} · {formas[pagamento.forma]}
              </span>

              {pagamento.pendente ? <StatusPill tom="marca">Pendente</StatusPill> : null}

              {cancelado ? (
                <StatusPill>
                  Cancelado{pagamento.canceladoEm ? ` em ${dataBonita(pagamento.canceladoEm)}` : ''}
                </StatusPill>
              ) : confirmando === pagamento.id ? (
                <span className="ml-auto flex items-center gap-2 text-xs">
                  <span className="text-slate-600">Cancelar este lançamento?</span>
                  <button
                    type="button"
                    onClick={() => {
                      aoCancelar(pagamento, dataLocalISO(new Date()))
                      setConfirmando(null)
                    }}
                    className="rounded-md bg-danger px-2.5 py-1 font-semibold text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(null)}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-600"
                  >
                    Voltar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(pagamento.id)}
                  className="ml-auto text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-danger"
                >
                  Cancelar
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-xs text-slate-400">
        Cancelar não apaga: registra o estorno e a parcela volta a contar o atraso do vencimento
        original.
      </p>
    </div>
  )
}
