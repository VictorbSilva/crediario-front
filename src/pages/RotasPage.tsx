import { useMemo, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { DemoBanner } from '@/components/ui/DemoBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kpi } from '@/components/ui/Kpi'
import { Nota } from '@/components/ui/Nota'
import { SearchInput } from '@/components/ui/SearchInput'
import { StatusPill } from '@/components/ui/StatusPill'
import type { TomStatus } from '@/components/ui/StatusPill'
import { rotasDemo } from '@/demo/dadosDemo'
import type { SituacaoParada } from '@/demo/dadosDemo'
import { formatarCentavosCurto } from '@/lib/dinheiro'
import { normalizar } from '@/lib/texto'

const rotulosParada: Record<SituacaoParada, { texto: string; tom: TomStatus }> = {
  cobrar: { texto: 'Cobrar', tom: 'marca' },
  pago: { texto: 'Pago', tom: 'sucesso' },
  ausente: { texto: 'Ausente', tom: 'alerta' },
  atrasado: { texto: 'Atrasado', tom: 'perigo' },
}

export function RotasPage() {
  const [busca, setBusca] = useState('')
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)

  const encontradas = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return rotasDemo
    return rotasDemo.filter((rota) => normalizar(rota.nome).includes(termo))
  }, [busca])

  const selecionada =
    encontradas.find((rota) => rota.id === selecionadaId) ?? encontradas[0]

  return (
    <>
      <DemoBanner />

      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Rotas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monte a ordem de visita e acompanhe a cobrança em campo.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[300px_1fr]">
        <div>
          <div className="mb-3">
            <SearchInput
              id="busca-rotas"
              label="Buscar rotas pelo nome"
              placeholder="Buscar rota pelo nome"
              value={busca}
              onChange={setBusca}
            />
          </div>

          {encontradas.length === 0 ? (
            <EmptyState>Nenhuma rota encontrada para esta busca.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {encontradas.map((rota) => {
                const ativa = selecionada?.id === rota.id
                return (
                  <li key={rota.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionadaId(rota.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-3.5 text-left transition-colors ${
                        ativa
                          ? 'border-brand-600 ring-1 ring-brand-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {rota.nome}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {rota.concluidas} de {rota.visitas} visitas
                        </span>
                      </span>
                      {rota.pendentesSync > 0 ? (
                        <StatusPill tom="marca">{rota.pendentesSync} pend.</StatusPill>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {selecionada ? (
          <div>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi rotulo="Visitas" valor={String(selecionada.visitas)} />
              <Kpi rotulo="Concluídas" valor={String(selecionada.concluidas)} tom="sucesso" />
              <Kpi
                rotulo="Previsto"
                valor={formatarCentavosCurto(selecionada.previstoCentavos)}
              />
              <Kpi
                rotulo="Pendentes de sync"
                valor={String(selecionada.pendentesSync)}
                tom="marca"
              />
            </div>

            <div className="mb-4">
              <Nota tom="info">
                Alterações na ordem ficam salvas neste dispositivo e sincronizam quando a
                conexão voltar.
              </Nota>
            </div>

            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Ordem de visita · {selecionada.nome}
            </h2>

            {selecionada.paradas.length === 0 ? (
              <EmptyState>Esta rota ainda não tem paradas.</EmptyState>
            ) : (
              <ul className="flex max-w-3xl flex-col gap-2.5">
                {selecionada.paradas.map((parada, indice) => {
                  const situacao = rotulosParada[parada.situacao]
                  return (
                    <li
                      key={parada.id}
                      className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5"
                    >
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
                      >
                        {indice + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {parada.clienteNome}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {parada.endereco}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-slate-900">
                          {formatarCentavosCurto(parada.valorCentavos)}
                        </div>
                        <StatusPill tom={situacao.tom} className="mt-1">
                          {situacao.texto}
                        </StatusPill>
                      </div>
                      <GripVertical
                        size={20}
                        aria-hidden
                        className="shrink-0 text-slate-300"
                      />
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="mt-3 max-w-3xl text-xs text-slate-400">
              Reordenar por arrastar ainda não está ligado — a alça é visual até a
              integração com o Firestore.
            </p>
          </div>
        ) : null}
      </div>
    </>
  )
}
