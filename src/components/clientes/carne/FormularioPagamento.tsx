import { useId, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Campo } from '@/components/ui/Campo'
import { ModalDeFormulario } from '@/components/ui/ModalDeFormulario'
import { Nota } from '@/components/ui/Nota'
import { dataBonita } from '@/lib/data'
import { formatarCentavos } from '@/lib/dinheiro'
import type { ParcelaComEstado } from '@/lib/parcelas'
import {
  LIMITES_VENDA,
  avisoDeValorAlto,
  entradaPagamentoVazia,
  validarPagamento,
} from '@/lib/venda'
import type { EntradaPagamento } from '@/lib/venda'
import type { FormaDePagamento } from '@/types/venda'

const FORMAS: { valor: FormaDePagamento; rotulo: string }[] = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'cartao', rotulo: 'Cartão' },
]

type FormularioPagamentoProps = Readonly<{
  /** A parcela em que o dono clicou — serve para sugerir o valor e dar contexto. */
  item: ParcelaComEstado
  totalDeParcelas: number
  abertoDaVendaCentavos: number
  aoSalvar: (entrada: EntradaPagamento) => void
  aoFechar: () => void
}>

export function FormularioPagamento({
  item,
  totalDeParcelas,
  abertoDaVendaCentavos,
  aoSalvar,
  aoFechar,
}: FormularioPagamentoProps) {
  const [entrada, setEntrada] = useState<EntradaPagamento>(() =>
    entradaPagamentoVazia(new Date(), item.estado.restanteCentavos),
  )
  const [tocados, setTocados] = useState<Partial<Record<keyof EntradaPagamento, boolean>>>({})
  const [tentouSalvar, setTentouSalvar] = useState(false)

  const base = useId()
  const erros = validarPagamento(entrada)
  const aviso = avisoDeValorAlto(entrada.valor, abertoDaVendaCentavos)

  function mostrar(campo: keyof EntradaPagamento): string | undefined {
    const erro = erros[campo]
    if (!erro) return undefined

    return tentouSalvar || tocados[campo] ? erro : undefined
  }

  function mudar(campo: keyof EntradaPagamento) {
    return (valor: string) => setEntrada((atual) => ({ ...atual, [campo]: valor }))
  }

  function sair(campo: keyof EntradaPagamento) {
    return () => setTocados((atual) => ({ ...atual, [campo]: true }))
  }

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    setTentouSalvar(true)
    if (Object.keys(erros).length > 0) return

    aoSalvar(entrada)
    aoFechar()
  }

  return (
    <ModalDeFormulario
      titulo="Registrar pagamento"
      subtitulo={`Parcela ${item.parcela.numero}/${totalDeParcelas}, vencimento ${dataBonita(item.parcela.vencimento)}`}
      rotuloDeEnvio="Lançar pagamento"
      idDoTitulo={base + '-titulo'}
      aoEnviar={enviar}
      aoFechar={aoFechar}
    >
      <Nota tom="info">
        O valor sugerido é o que falta nesta parcela, mas o lançamento é{' '}
        <strong>contra a venda</strong>: o sistema cobre da parcela mais antiga para a mais nova.
        Se o cliente pagar menos, a parcela continua vencida pelo resto, contando do vencimento
        original.
      </Nota>

      <Campo
        id={base + '-valor'}
        rotulo="Valor recebido"
        valor={entrada.valor}
        maxLength={15}
        inputMode="decimal"
        focoInicial
        obrigatorio
        erro={mostrar('valor')}
        dica={`Falta ${formatarCentavos(item.estado.restanteCentavos)} nesta parcela · ${formatarCentavos(abertoDaVendaCentavos)} na venda toda`}
        aoMudar={mudar('valor')}
        aoSair={sair('valor')}
      />

      {aviso ? <Nota tom="alerta">{aviso}</Nota> : null}

      <Campo
        id={base + '-data'}
        rotulo="Data do recebimento"
        valor={entrada.data}
        tipo="date"
        obrigatorio
        erro={mostrar('data')}
        aoMudar={mudar('data')}
        aoSair={sair('data')}
      />

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Forma</legend>
        <div className="flex flex-wrap gap-4">
          {FORMAS.map((forma) => (
            <label key={forma.valor} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={base + '-forma'}
                checked={entrada.forma === forma.valor}
                onChange={() => setEntrada((atual) => ({ ...atual, forma: forma.valor }))}
                className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600"
              />
              {forma.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <Campo
        id={base + '-observacao'}
        rotulo="Observação"
        valor={entrada.observacao}
        maxLength={LIMITES_VENDA.observacao}
        multilinha
        erro={mostrar('observacao')}
        aoMudar={mudar('observacao')}
        aoSair={sair('observacao')}
      />
    </ModalDeFormulario>
  )
}
