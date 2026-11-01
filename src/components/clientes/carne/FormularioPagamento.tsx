import { useId, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Campo } from '@/components/ui/Campo'
import { ModalDeFormulario } from '@/components/ui/ModalDeFormulario'
import { Nota } from '@/components/ui/Nota'
import { dataBonita, dataLocalISO, ehDataCivil } from '@/lib/data'
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
  aoDefinirProximaCobranca?: (data: string) => void
  aoFechar: () => void
}>

export function FormularioPagamento({
  item,
  totalDeParcelas,
  abertoDaVendaCentavos,
  aoSalvar,
  aoDefinirProximaCobranca,
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
  const diaSeguinte = ehDataCivil(entrada.data) ? new Date(entrada.data + 'T12:00:00') : null
  if (diaSeguinte) diaSeguinte.setDate(diaSeguinte.getDate() + 1)
  const minimoDaCobranca = diaSeguinte ? dataLocalISO(diaSeguinte) : undefined
  const erroDaCobranca = mostrar('proximaCobranca')

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
    if (entrada.proximaCobranca) aoDefinirProximaCobranca?.(entrada.proximaCobranca)
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

      <div>
        <label htmlFor={base + '-proxima-cobranca'} className="mb-1.5 block text-sm font-medium text-slate-700">
          Próxima cobrança (opcional)
        </label>
        <input
          id={base + '-proxima-cobranca'}
          type="date"
          value={entrada.proximaCobranca ?? ''}
          min={minimoDaCobranca}
          autoComplete="off"
          aria-invalid={erroDaCobranca ? true : undefined}
          aria-describedby={`${base}-cobranca-dica${erroDaCobranca ? ` ${base}-cobranca-erro` : ''}`}
          onChange={(evento) => mudar('proximaCobranca')(evento.target.value)}
          onBlur={sair('proximaCobranca')}
          className={`h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:ring-1 ${erroDaCobranca ? 'border-danger focus:border-danger focus:ring-danger' : 'border-slate-200 focus:border-brand-600 focus:ring-brand-600'}`}
        />
        <p id={base + '-cobranca-dica'} className="mt-1 text-xs text-slate-500">
          O cliente entra na rota desse dia
        </p>
        {erroDaCobranca ? (
          <p id={base + '-cobranca-erro'} role="alert" className="mt-1 text-xs font-medium text-danger">
            {erroDaCobranca}
          </p>
        ) : null}
      </div>

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
