import { useEffect, useId, useRef } from 'react'
import { Nota } from '@/components/ui/Nota'
import { pagamentosAtivos, textoDoPlano } from '@/lib/carne'
import { dataBonita } from '@/lib/data'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Pagamento, Venda } from '@/types/venda'

type ConfirmarCancelamentoVendaProps = Readonly<{
  venda: Venda
  pagamentos: readonly Pagamento[]
  aoConfirmar: () => void
  aoFechar: () => void
}>

/**
 * Cancelar a venda não estorna pagamento: o que já foi recebido continua no
 * livro, e estornar é outro gesto, lançamento por lançamento. A confirmação
 * diz isso antes, porque depois não há volta — a regra só aceita `cancelada`
 * indo de `false` para `true`.
 */
export function ConfirmarCancelamentoVenda({
  venda,
  pagamentos,
  aoConfirmar,
  aoFechar,
}: ConfirmarCancelamentoVendaProps) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const base = useId()

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  const ativos = pagamentosAtivos(pagamentos, venda.id)

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby={base + '-titulo'}
      aria-describedby={base + '-descricao'}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-2xl bg-white p-5 backdrop:bg-slate-900/40"
    >
      <h2 id={base + '-titulo'} className="text-lg font-semibold text-slate-900">
        Cancelar a venda de {dataBonita(venda.dataVenda)}?
      </h2>
      <p id={base + '-descricao'} className="mt-1 text-sm text-slate-600">
        {formatarCentavos(venda.valorTotalCentavos)} —{' '}
        {textoDoPlano(venda.numeroParcelas, venda.valorParcelaCentavos)}. A venda sai do saldo e
        das parcelas vencidas. Não dá para desfazer.
      </p>

      {ativos.quantidade > 0 ? (
        <div className="mt-4">
          <Nota tom="alerta">
            {ativos.quantidade === 1
              ? `O pagamento já lançado nesta venda (${formatarCentavos(ativos.totalCentavos)}) continua no histórico. Cancelar a venda não devolve pagamento — se ele precisar ser estornado, cancele o pagamento separadamente.`
              : `Os pagamentos já lançados nesta venda (${ativos.quantidade}, ${formatarCentavos(ativos.totalCentavos)}) continuam no histórico. Cancelar a venda não devolve pagamento — se algum precisar ser estornado, cancele o pagamento separadamente.`}
          </Nota>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          autoFocus
          onClick={aoFechar}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => {
            aoConfirmar()
            aoFechar()
          }}
          className="min-h-11 rounded-lg bg-danger px-4 text-sm font-semibold text-white"
        >
          Cancelar venda
        </button>
      </div>
    </dialog>
  )
}
