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
import type { DocumentoExportavel } from '@/lib/exportacao'
import { listaDeAtrasados, situacaoFinanceira } from '@/lib/financeiro'
import type { PagamentoParaFinanceiro, VendaParaFinanceiro } from '@/lib/financeiro'
import { normalizar } from '@/lib/texto'

const COLECOES_DO_FINANCEIRO = ['sales', 'payments'] as const

function converterDocumentos(
  vendas: readonly DocumentoExportavel[],
  pagamentos: readonly DocumentoExportavel[],
) {
  return {
    vendas: vendas.map(({ id, dados }): VendaParaFinanceiro => ({
      id,
      clientId: dados.clientId as string,
      dataVenda: dados.dataVenda as string,
      valorTotalCentavos: dados.valorTotalCentavos as number,
      numeroParcelas: dados.numeroParcelas as number,
      diaVencimento: dados.diaVencimento as number,
      versaoCalculo: dados.versaoCalculo as number,
      cancelada: dados.cancelada === true,
    })),
    pagamentos: pagamentos.map(({ id, dados }): PagamentoParaFinanceiro => ({
      id,
      clientId: dados.clientId as string,
      saleId: dados.saleId as string,
      data: dados.data as string,
      valorCentavos: dados.valorCentavos as number,
      encargoCentavos: dados.encargoCentavos as number | undefined,
      cancelado: dados.cancelado === true,
    })),
  }
}

export function FinanceiroPage() {
  const { vendas, pagamentos, confianca, erro } = useCarneDaEmpresa(COLECOES_DO_FINANCEIRO)
  const { clientes } = useClientes()
  const [busca, setBusca] = useState('')
  const hoje = dataLocalISO(new Date())

  const { situacao, atrasados } = useMemo(() => {
    const documentos = converterDocumentos(vendas, pagamentos)
    const situacao = situacaoFinanceira(documentos.vendas, documentos.pagamentos, hoje)
    return { situacao, atrasados: listaDeAtrasados(situacao, clientes) }
  }, [vendas, pagamentos, clientes, hoje])

  const encontrados = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return atrasados
    return atrasados.filter(({ cliente }) =>
      cliente !== null && (
        normalizar(cliente.nome).includes(termo) || String(cliente.numero).includes(termo)
      ),
    )
  }, [atrasados, busca])

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Financeiro</h1>
        <p className="mt-1 text-sm text-slate-500">Valores combinados, sem multa e juros.</p>
      </div>

      {erro ? <div className="mb-4"><Nota tom="alerta">{erro}</Nota></div> : null}

      {confianca === 'desconhecida' ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
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
          </div>

          {confianca === 'parcial' ? (
            <div className="mb-4">
              <Nota tom="alerta">
                Este aparelho ainda não baixou todas as vendas e pagamentos. Os números podem
                estar menores do que os reais.
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
                label="Buscar clientes em atraso por nome ou número"
                placeholder="Buscar por nome ou número"
                value={busca}
                onChange={setBusca}
              />
            </div>

            {encontrados.length === 0 ? (
              <EmptyState>Nenhum cliente em atraso.</EmptyState>
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
                  const classe = 'flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5'
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
        </>
      )}
    </>
  )
}
