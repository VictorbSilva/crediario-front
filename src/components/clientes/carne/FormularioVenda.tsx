import { useId, useMemo, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Campo } from '@/components/ui/Campo'
import { ModalDeFormulario } from '@/components/ui/ModalDeFormulario'
import { Nota } from '@/components/ui/Nota'
import { dataBonita } from '@/lib/data'
import { formatarCentavos } from '@/lib/dinheiro'
import { LIMITES_VENDA, entradaVendaVazia, montarCamposVenda, validarVenda } from '@/lib/venda'
import type { EntradaVenda } from '@/lib/venda'

type FormuladorVendaProps = Readonly<{
  aoSalvar: (entrada: EntradaVenda) => void
  aoFechar: () => void
}>

export function FormularioVenda({ aoSalvar, aoFechar }: FormuladorVendaProps) {
  const [entrada, setEntrada] = useState<EntradaVenda>(() => entradaVendaVazia(new Date()))
  const [tocados, setTocados] = useState<Partial<Record<keyof EntradaVenda, boolean>>>({})
  const [tentouSalvar, setTentouSalvar] = useState(false)

  const base = useId()
  const erros = validarVenda(entrada)

  // A prévia é o mesmo `gerarParcelas` que vai gravar, não uma conta paralela:
  // o que o dono vê aqui é literalmente o que fica no Firestore.
  const previa = useMemo(() => {
    if (Object.keys(validarVenda(entrada)).length > 0) return null

    try {
      return montarCamposVenda('previa', entrada, { agora: new Date(), dispositivo: 'previa' })
    } catch {
      return null
    }
  }, [entrada])

  function mostrar(campo: keyof EntradaVenda): string | undefined {
    const erro = erros[campo]
    if (!erro) return undefined

    return tentouSalvar || tocados[campo] ? erro : undefined
  }

  function mudar(campo: keyof EntradaVenda) {
    return (valor: string) => setEntrada((atual) => ({ ...atual, [campo]: valor }))
  }

  function sair(campo: keyof EntradaVenda) {
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
      titulo="Nova venda"
      subtitulo="O carnê é gerado a partir destes campos."
      rotuloDeEnvio="Lançar venda"
      idDoTitulo={base + '-titulo'}
      aoEnviar={enviar}
      aoFechar={aoFechar}
    >
      <Campo
        id={base + '-valor'}
        rotulo="Valor total"
        valor={entrada.valor}
        maxLength={15}
        inputMode="decimal"
        focoInicial
        obrigatorio
        erro={mostrar('valor')}
        dica="Em reais, como no papel: 300,00"
        aoMudar={mudar('valor')}
        aoSair={sair('valor')}
      />

      <div className="grid grid-cols-2 gap-3">
        <Campo
          id={base + '-parcelas'}
          rotulo="Parcelas"
          valor={entrada.numeroParcelas}
          maxLength={3}
          inputMode="numeric"
          obrigatorio
          erro={mostrar('numeroParcelas')}
          aoMudar={mudar('numeroParcelas')}
          aoSair={sair('numeroParcelas')}
        />

        <Campo
          id={base + '-dia'}
          rotulo="Dia do vencimento"
          valor={entrada.diaVencimento}
          maxLength={2}
          inputMode="numeric"
          obrigatorio
          erro={mostrar('diaVencimento')}
          aoMudar={mudar('diaVencimento')}
          aoSair={sair('diaVencimento')}
        />
      </div>

      <Campo
        id={base + '-data'}
        rotulo="Data da venda"
        valor={entrada.dataVenda}
        tipo="date"
        obrigatorio
        erro={mostrar('dataVenda')}
        dica="A primeira parcela cai no mês seguinte."
        aoMudar={mudar('dataVenda')}
        aoSair={sair('dataVenda')}
      />

      {previa ? (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Como fica o carnê
          </div>
          <div className="mt-1.5 text-sm text-slate-700">
            {previa.venda.numeroParcelas}× {formatarCentavos(previa.venda.valorParcelaCentavos)}
            {previa.parcelas.at(-1)?.valorCentavos !== previa.venda.valorParcelaCentavos ? (
              <span className="text-slate-500">
                {' '}
                (a última fica {formatarCentavos(previa.parcelas.at(-1)?.valorCentavos ?? 0)}, com
                a sobra da divisão)
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Primeira em {dataBonita(previa.parcelas[0].vencimento)} · última em{' '}
            {dataBonita(previa.parcelas.at(-1)?.vencimento ?? '')}
          </div>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={entrada.cobrarTaxas}
          onChange={(evento) =>
            setEntrada((atual) => ({ ...atual, cobrarTaxas: evento.target.checked }))
          }
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
        />
        <span>
          <span className="font-medium">Informar multa e juros</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Só para a simulação de atraso. Não entra no valor do carnê nem é cobrado
            automaticamente.
          </span>
        </span>
      </label>

      {entrada.cobrarTaxas ? (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Multa</legend>
            <div className="flex gap-4">
              {(['percentual', 'fixo'] as const).map((tipo) => (
                <label key={tipo} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={base + '-multaTipo'}
                    checked={entrada.multaTipo === tipo}
                    onChange={() => setEntrada((atual) => ({ ...atual, multaTipo: tipo }))}
                    className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600"
                  />
                  {tipo === 'percentual' ? 'Percentual' : 'Valor fixo'}
                </label>
              ))}
            </div>
          </fieldset>

          {entrada.multaTipo === 'percentual' ? (
            <Campo
              id={base + '-multaPercentual'}
              rotulo="Multa (%)"
              valor={entrada.multaPercentual}
              maxLength={6}
              inputMode="decimal"
              erro={mostrar('multaPercentual')}
              dica="Aplicada uma vez, quando a parcela vence."
              aoMudar={mudar('multaPercentual')}
              aoSair={sair('multaPercentual')}
            />
          ) : (
            <Campo
              id={base + '-multaFixa'}
              rotulo="Multa (R$)"
              valor={entrada.multaFixa}
              maxLength={15}
              inputMode="decimal"
              erro={mostrar('multaFixa')}
              dica="Aplicada uma vez, quando a parcela vence."
              aoMudar={mudar('multaFixa')}
              aoSair={sair('multaFixa')}
            />
          )}

          <Campo
            id={base + '-juros'}
            rotulo="Juros (% ao dia)"
            valor={entrada.jurosPercentualDia}
            maxLength={6}
            inputMode="decimal"
            erro={mostrar('jurosPercentualDia')}
            dica="Por dia de atraso. Não existe juros ao mês neste sistema."
            aoMudar={mudar('jurosPercentualDia')}
            aoSair={sair('jurosPercentualDia')}
          />
        </div>
      ) : null}

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

      {tentouSalvar && Object.keys(erros).length > 0 ? (
        <Nota tom="alerta">Confira os campos marcados antes de lançar.</Nota>
      ) : null}
    </ModalDeFormulario>
  )
}
