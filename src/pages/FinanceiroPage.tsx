import { useMemo, useState } from 'react'
import { DemoBanner } from '@/components/ui/DemoBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kpi } from '@/components/ui/Kpi'
import { Nota } from '@/components/ui/Nota'
import { SearchInput } from '@/components/ui/SearchInput'
import { StatusPill } from '@/components/ui/StatusPill'
import type { TomStatus } from '@/components/ui/StatusPill'
import { parcelasDemo } from '@/demo/dadosDemo'
import type { SituacaoParcela } from '@/demo/dadosDemo'
import { formatarCentavos, formatarCentavosCurto } from '@/lib/dinheiro'
import { normalizar } from '@/lib/texto'

const rotulosParcela: Record<SituacaoParcela, { texto: string; tom: TomStatus }> = {
  atrasada: { texto: 'Atrasada', tom: 'perigo' },
  'vence-hoje': { texto: 'Vence hoje', tom: 'alerta' },
  'a-vencer': { texto: 'A vencer', tom: 'alerta' },
  paga: { texto: 'Paga', tom: 'sucesso' },
}

export function FinanceiroPage() {
  const [busca, setBusca] = useState('')
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)

  const encontradas = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return parcelasDemo
    return parcelasDemo.filter((parcela) =>
      normalizar(parcela.clienteNome).includes(termo),
    )
  }, [busca])

  const selecionada =
    encontradas.find((parcela) => parcela.id === selecionadaId) ?? encontradas[0]

  const somar = (situacoes: SituacaoParcela[]) =>
    parcelasDemo
      .filter((parcela) => situacoes.includes(parcela.situacao))
      .reduce((total, parcela) => total + parcela.valorCentavos, 0)

  return (
    <>
      <DemoBanner />

      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Financeiro</h1>
        <p className="mt-1 text-sm text-slate-500">
          Acompanhe parcelas, vencimentos e pagamentos dos carnês.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          rotulo="A receber"
          valor={formatarCentavosCurto(somar(['atrasada', 'vence-hoje', 'a-vencer']))}
        />
        <Kpi rotulo="Atrasado" valor={formatarCentavosCurto(somar(['atrasada']))} tom="perigo" />
        <Kpi rotulo="Vence hoje" valor={formatarCentavosCurto(somar(['vence-hoje']))} tom="alerta" />
        <Kpi rotulo="Pago" valor={formatarCentavosCurto(somar(['paga']))} tom="sucesso" />
      </div>

      <div className="mb-4">
        <Nota tom="alerta" titulo="Regras financeiras a configurar">
          Juros, multa e arredondamento ainda precisam ser definidos. Os totais acima são
          somas simples dos valores de demonstração, sem nenhum encargo aplicado.
        </Nota>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3">
            <SearchInput
              id="busca-financeiro"
              label="Buscar parcelas por cliente"
              placeholder="Buscar cliente"
              value={busca}
              onChange={setBusca}
            />
          </div>

          {encontradas.length === 0 ? (
            <EmptyState>Nenhuma parcela encontrada para este cliente.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {encontradas.map((parcela) => {
                const ativa = selecionada?.id === parcela.id
                const situacao = rotulosParcela[parcela.situacao]
                return (
                  <li key={parcela.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionadaId(parcela.id)}
                      className={`flex w-full items-center gap-3.5 rounded-xl border bg-white p-3.5 text-left transition-colors ${
                        ativa
                          ? 'border-brand-600 ring-1 ring-brand-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {parcela.clienteNome}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {parcela.descricao}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold text-slate-900">
                          {formatarCentavosCurto(parcela.valorCentavos)}
                        </span>
                        <StatusPill tom={situacao.tom} className="mt-1">
                          {situacao.texto}
                        </StatusPill>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {selecionada ? (
          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-6">
            <div className="border-b border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Parcela selecionada
              </div>
              <div className="mt-1.5 text-base font-bold text-slate-900">
                {selecionada.clienteNome}
              </div>
              <StatusPill tom={rotulosParcela[selecionada.situacao].tom} className="mt-2">
                {rotulosParcela[selecionada.situacao].texto}
              </StatusPill>
            </div>

            <dl className="flex flex-col gap-3 p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Descrição</dt>
                <dd className="text-right font-medium text-slate-900">
                  {selecionada.descricao}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Valor</dt>
                <dd className="font-bold text-slate-900">
                  {formatarCentavos(selecionada.valorCentavos)}
                </dd>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Juros / multa</dt>
                <dd>
                  <StatusPill>a configurar</StatusPill>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Total com encargos</dt>
                <dd>
                  <StatusPill>a configurar</StatusPill>
                </dd>
              </div>
            </dl>

            <div className="border-t border-slate-200 p-4">
              <EmptyState>
                Registrar pagamento depende das regras de juros, multa e estorno.
              </EmptyState>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  )
}
