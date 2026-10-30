import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kpi } from '@/components/ui/Kpi'
import { Nota } from '@/components/ui/Nota'
import { SearchInput } from '@/components/ui/SearchInput'
import { StatusPill } from '@/components/ui/StatusPill'
import { useCarneDaEmpresa } from '@/data/useCarneDaEmpresa'
import { useClientes } from '@/data/useClientes'
import { dataBonita, dataLocalISO } from '@/lib/data'
import { formatarCentavos } from '@/lib/dinheiro'
import { aReceberNoMes, documentosParaFinanceiro, listaDeAtrasados, mesesDeRecebimento, situacaoFinanceira } from '@/lib/financeiro'
import { nomeDoMes } from '@/lib/rotas'
import { normalizar } from '@/lib/texto'

const COLECOES_DO_FINANCEIRO = ['sales', 'payments'] as const

export function FinanceiroPage() {
  const { vendas, pagamentos, confianca, erro } = useCarneDaEmpresa(COLECOES_DO_FINANCEIRO)
  const { clientes } = useClientes()
  const [busca, setBusca] = useState('')
  const hoje = dataLocalISO(new Date())
  const [mesEscolhido, setMesEscolhido] = useState<{ ano: number; mes: number }>(() => ({
    ano: Number(hoje.slice(0, 4)),
    mes: Number(hoje.slice(5, 7)),
  }))

  const { situacao, atrasados, meses, mes, aReceber } = useMemo(() => {
    const documentos = documentosParaFinanceiro(vendas, pagamentos)
    const situacao = situacaoFinanceira(documentos.vendas, documentos.pagamentos, hoje)
    const meses = mesesDeRecebimento(documentos.vendas, hoje)
    const mes = meses.find(({ ano, mes }) =>
      ano === mesEscolhido.ano && mes === mesEscolhido.mes,
    ) ?? meses[0]
    const aReceber = aReceberNoMes(
      documentos.vendas, documentos.pagamentos, clientes, mes.ano, mes.mes, hoje,
    )
    return { situacao, atrasados: listaDeAtrasados(situacao, clientes), meses, mes, aReceber }
  }, [vendas, pagamentos, clientes, hoje, mesEscolhido])

  const mesPorExtenso = nomeDoMes(mes.ano, mes.mes)

  const encontrados = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return atrasados
    return atrasados.filter(({ cliente }) =>
      cliente !== null && (
        normalizar(cliente.nome).includes(termo) || String(cliente.numero).includes(termo)
      ),
    )
  }, [atrasados, busca])

  const parcelasEncontradas = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return aReceber.parcelas
    return aReceber.parcelas.filter(({ cliente }) =>
      cliente !== null && (
        normalizar(cliente.nome).includes(termo) || String(cliente.numero).includes(termo)
      ),
    )
  }, [aReceber.parcelas, busca])

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Financeiro</h1>
        <p className="mt-1 text-sm text-slate-500">Valores combinados, sem multa e juros.</p>
      </div>

      <div className="mb-5">
        <label htmlFor="mes-de-recebimento" className="mb-1 block text-sm font-medium text-slate-700">
          Mês de recebimento
        </label>
        <select
          id="mes-de-recebimento"
          value={`${mes.ano}-${String(mes.mes).padStart(2, '0')}`}
          onChange={(evento) => {
            const [ano, mes] = evento.target.value.split('-').map(Number)
            setMesEscolhido({ ano, mes })
          }}
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600 sm:w-auto"
        >
          {meses.map(({ ano, mes }) => (
            <option key={`${ano}-${mes}`} value={`${ano}-${String(mes).padStart(2, '0')}`}>
              {nomeDoMes(ano, mes)}
            </option>
          ))}
        </select>
      </div>

      {erro ? <div className="mb-4"><Nota tom="alerta">{erro}</Nota></div> : null}

      {confianca === 'desconhecida' ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi rotulo="A receber" valor={formatarCentavos(situacao.aReceberCentavos)} />
            <Kpi
              rotulo="Vencido"
              valor={formatarCentavos(situacao.vencidoCentavos)}
              tom={situacao.vencidoCentavos > 0 ? 'perigo' : 'neutro'}
            />
            <Kpi
              rotulo="Recebido no mês"
              valor={formatarCentavos(situacao.recebidoNoMesCentavos)}
              tom="sucesso"
            />
            <Kpi
              rotulo={`A receber em ${mesPorExtenso}`}
              valor={formatarCentavos(aReceber.totalCentavos)}
            />
          </div>

          {confianca === 'parcial' ? (
            <div className="mb-4">
              <Nota tom="alerta">
                Este aparelho ainda não baixou todas as vendas e pagamentos. Os números podem
                estar incompletos ou desatualizados.
              </Nota>
            </div>
          ) : null}

          {situacao.vendasNaoCalculadas > 0 ? (
            <div className="mb-4">
              <Nota tom="alerta">
                {situacao.vendasNaoCalculadas} venda(s) foram lançadas por uma versão mais nova
                do app e não entram nestes números. Atualize o app.
              </Nota>
            </div>
          ) : null}

          <section aria-labelledby="clientes-em-atraso">
            <h2 id="clientes-em-atraso" className="mb-3 text-lg font-semibold text-slate-900">
              Clientes em atraso
            </h2>
            <div className="mb-3">
              <SearchInput
                id="busca-financeiro"
                label="Buscar por nome ou número"
                placeholder="Buscar por nome ou número"
                value={busca}
                onChange={setBusca}
              />
            </div>

            {encontrados.length === 0 ? (
              <EmptyState>
                {normalizar(busca)
                  ? 'Nenhum cliente em atraso com esse nome ou número.'
                  : 'Nenhum cliente em atraso.'}
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {encontrados.map((atraso) => {
                  const { cliente } = atraso
                  const conteudo = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          {cliente ? (
                            <span className="shrink-0 text-xs font-semibold text-slate-500">
                              #{cliente.numero}
                            </span>
                          ) : null}
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {cliente?.nome ?? 'Cliente não encontrado neste aparelho'}
                          </span>
                        </span>
                        {atraso.atrasoDesde !== null ? (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            Vencido desde {dataBonita(atraso.atrasoDesde)} · {atraso.diasDeAtraso} dia(s)
                          </span>
                        ) : null}
                        {cliente?.arquivado ? <StatusPill className="mt-1">Arquivado</StatusPill> : null}
                      </span>
                      <span className="shrink-0 text-right text-sm font-bold text-danger">
                        {formatarCentavos(atraso.vencidoCentavos)}
                      </span>
                    </>
                  )
                  const classe = 'flex min-h-11 items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5'
                  return (
                    <li key={atraso.clientId}>
                      {cliente ? (
                        <Link
                          to={`/clientes/${cliente.id}`}
                          className={`${classe} transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                        >
                          {conteudo}
                        </Link>
                      ) : <div className={classe}>{conteudo}</div>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="parcelas-a-receber" className="mt-6">
            <h2 id="parcelas-a-receber" className="mb-3 text-lg font-semibold text-slate-900">
              A receber em {mesPorExtenso}
            </h2>
            {parcelasEncontradas.length === 0 ? (
              <EmptyState>
                {normalizar(busca)
                  ? 'Nenhuma parcela a receber com esse nome ou número.'
                  : 'Nenhuma parcela a receber neste mês.'}
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {parcelasEncontradas.map((parcela) => {
                  const { cliente } = parcela
                  const conteudo = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          {cliente ? (
                            <span className="shrink-0 text-xs font-semibold text-slate-500">
                              #{cliente.numero}
                            </span>
                          ) : null}
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {cliente?.nome ?? 'Cliente não encontrado neste aparelho'}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Parcela {parcela.numero}/{parcela.total} · vence {dataBonita(parcela.vencimento)}
                        </span>
                        {cliente?.arquivado ? <StatusPill className="mt-1">Arquivado</StatusPill> : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-bold text-slate-900">
                          {formatarCentavos(parcela.restanteCentavos)}
                        </span>
                        <StatusPill tom={parcela.situacao === 'vencida' ? 'perigo' : parcela.situacao === 'parcial' ? 'alerta' : 'neutro'}>
                          {parcela.situacao === 'vencida' ? 'Vencida' : parcela.situacao === 'parcial' ? 'Parcial' : 'A vencer'}
                        </StatusPill>
                      </span>
                    </>
                  )
                  const classe = 'flex min-h-11 items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5'
                  return (
                    <li key={`${parcela.saleId}#${parcela.numero}`}>
                      {cliente ? (
                        <Link
                          to={`/clientes/${cliente.id}`}
                          className={`${classe} transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                        >
                          {conteudo}
                        </Link>
                      ) : <div className={classe}>{conteudo}</div>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  )
}
