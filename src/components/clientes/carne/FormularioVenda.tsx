import { useId, useMemo, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Campo } from '@/components/ui/Campo'
import { ModalDeFormulario } from '@/components/ui/ModalDeFormulario'
import { Nota } from '@/components/ui/Nota'
import { dataBonita } from '@/lib/data'
import { formatarCentavos } from '@/lib/dinheiro'
import {
  LIMITES_VENDA,
  entradaItemVazia,
  entradaVendaVazia,
  montarCamposVenda,
  totalDosItens,
  validarItens,
  validarVenda,
} from '@/lib/venda'
import type { EntradaItem, EntradaVenda } from '@/lib/venda'

type FormuladorVendaProps = Readonly<{
  aoSalvar: (entrada: EntradaVenda) => void
  aoFechar: () => void
  aviso?: string
}>

export function FormularioVenda({ aoSalvar, aoFechar, aviso }: FormuladorVendaProps) {
  const [entrada, setEntrada] = useState<EntradaVenda>(() => entradaVendaVazia(new Date()))
  const [tocados, setTocados] = useState<Partial<Record<keyof EntradaVenda, boolean>>>({})
  const [tentouSalvar, setTentouSalvar] = useState(false)

  // Uma chave estável por linha, paralela a `entrada.itens`: remover a linha do
  // meio não pode passar o "já saiu do campo" de uma linha para a vizinha.
  const [chaves, setChaves] = useState<number[]>([0])
  const proximaChave = useRef(1)
  const [tocadosItens, setTocadosItens] = useState<
    Record<number, Partial<Record<keyof EntradaItem, boolean>>>
  >({})

  const base = useId()
  const erros = validarVenda(entrada)
  const errosItens = validarItens(entrada.itens)
  const total = totalDosItens(entrada.itens)

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

  function mostrarDoItem(indice: number, campo: keyof EntradaItem): string | undefined {
    const erro = errosItens.porItem[indice]?.[campo]
    if (!erro) return undefined

    return tentouSalvar || tocadosItens[chaves[indice]]?.[campo] ? erro : undefined
  }

  function mudarItem(indice: number, campo: keyof EntradaItem) {
    return (valor: string) =>
      setEntrada((atual) => ({
        ...atual,
        itens: atual.itens.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item)),
      }))
  }

  function sairDoItem(chave: number, campo: keyof EntradaItem) {
    return () =>
      setTocadosItens((atual) => ({ ...atual, [chave]: { ...atual[chave], [campo]: true } }))
  }

  function adicionarItem() {
    const chave = proximaChave.current
    proximaChave.current += 1
    setEntrada((atual) => ({ ...atual, itens: [...atual.itens, entradaItemVazia()] }))
    setChaves((atual) => [...atual, chave])
  }

  function removerItem(indice: number) {
    setEntrada((atual) => ({ ...atual, itens: atual.itens.filter((_, i) => i !== indice) }))
    setChaves((atual) => atual.filter((_, i) => i !== indice))
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
      {aviso ? <Nota tom="alerta">{aviso}</Nota> : null}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Itens</legend>

        <div className="flex flex-col gap-3">
          {entrada.itens.map((item, indice) => {
            const chave = chaves[indice]
            const id = `${base}-item-${chave}`
            const subtotal = totalDosItens([item])

            return (
              <div
                key={chave}
                role="group"
                aria-labelledby={id + '-titulo'}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    id={id + '-titulo'}
                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Item {indice + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removerItem(indice)}
                    disabled={entrada.itens.length === 1}
                    aria-label={`Remover item ${indice + 1}`}
                    className="-m-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                  >
                    <Trash2 size={17} aria-hidden />
                  </button>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-20 shrink-0">
                    <Campo
                      id={id + '-quantidade'}
                      rotulo="Qtd"
                      valor={item.quantidade}
                      maxLength={3}
                      inputMode="numeric"
                      obrigatorio
                      erro={mostrarDoItem(indice, 'quantidade')}
                      aoMudar={mudarItem(indice, 'quantidade')}
                      aoSair={sairDoItem(chave, 'quantidade')}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Campo
                      id={id + '-descricao'}
                      rotulo="Descrição"
                      valor={item.descricao}
                      maxLength={LIMITES_VENDA.descricaoItem}
                      focoInicial
                      obrigatorio
                      erro={mostrarDoItem(indice, 'descricao')}
                      aoMudar={mudarItem(indice, 'descricao')}
                      aoSair={sairDoItem(chave, 'descricao')}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Campo
                      id={id + '-valor'}
                      rotulo="Valor unitário"
                      valor={item.valorUnitario}
                      maxLength={15}
                      inputMode="decimal"
                      obrigatorio
                      erro={mostrarDoItem(indice, 'valorUnitario')}
                      aoMudar={mudarItem(indice, 'valorUnitario')}
                      aoSair={sairDoItem(chave, 'valorUnitario')}
                    />
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Subtotal</span>
                    <span className="flex h-11 items-center justify-end text-sm tabular-nums text-slate-700">
                      {subtotal === null ? '—' : formatarCentavos(subtotal)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="flex">
            <button
              type="button"
              onClick={adicionarItem}
              disabled={entrada.itens.length >= LIMITES_VENDA.itens}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <Plus size={17} aria-hidden />
              Adicionar item
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <span id={base + '-total'} className="text-sm font-medium text-slate-700">
              Total
            </span>
            <output
              aria-labelledby={base + '-total'}
              className="text-base font-bold tabular-nums text-slate-900"
            >
              {total === null ? '—' : formatarCentavos(total)}
            </output>
          </div>

          {tentouSalvar && errosItens.geral ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {errosItens.geral}
            </p>
          ) : null}
        </div>
      </fieldset>

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
