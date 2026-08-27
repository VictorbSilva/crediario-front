import { useMemo, useState } from 'react'
import { MapPin, Phone, Plus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { DemoBanner } from '@/components/ui/DemoBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kpi } from '@/components/ui/Kpi'
import { SearchInput } from '@/components/ui/SearchInput'
import { StatusPill } from '@/components/ui/StatusPill'
import type { TomStatus } from '@/components/ui/StatusPill'
import { clientesDemo } from '@/demo/dadosDemo'
import type { SituacaoCliente } from '@/demo/dadosDemo'
import { formatarCentavos, formatarCentavosCurto } from '@/lib/dinheiro'
import { normalizar } from '@/lib/texto'

const rotulosSituacao: Record<SituacaoCliente, { texto: string; tom: TomStatus }> = {
  'em-dia': { texto: 'Em dia', tom: 'sucesso' },
  atrasado: { texto: 'Atrasado', tom: 'perigo' },
  'sem-rota': { texto: 'Sem rota', tom: 'alerta' },
}

export function ClientesPage() {
  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  const encontrados = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return clientesDemo
    return clientesDemo.filter((cliente) =>
      [cliente.nome, cliente.telefone, cliente.endereco, cliente.rota ?? ''].some((campo) =>
        normalizar(campo).includes(termo),
      ),
    )
  }, [busca])

  const selecionado =
    encontrados.find((cliente) => cliente.id === selecionadoId) ?? encontrados[0]

  const comAtraso = clientesDemo.filter((cliente) => cliente.situacao === 'atrasado').length
  const semRota = clientesDemo.filter((cliente) => !cliente.rota).length

  return (
    <>
      <DemoBanner />

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastro, contato e situação dos clientes do crediário.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus size={17} aria-hidden />
          <span className="hidden sm:inline">Novo cliente</span>
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Clientes" valor={String(clientesDemo.length)} />
        <Kpi rotulo="Com atraso" valor={String(comAtraso)} tom="perigo" />
        <Kpi rotulo="Sem rota" valor={String(semRota)} tom="alerta" />
        <Kpi rotulo="Alterações pendentes" valor="—" tom="marca" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-3">
            <SearchInput
              id="busca-clientes"
              label="Buscar clientes"
              placeholder="Buscar por nome, telefone, endereço ou rota"
              value={busca}
              onChange={setBusca}
            />
          </div>

          {encontrados.length === 0 ? (
            <EmptyState>Nenhum cliente encontrado para esta busca.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {encontrados.map((cliente) => {
                const ativo = selecionado?.id === cliente.id
                const situacao = rotulosSituacao[cliente.situacao]
                return (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionadoId(cliente.id)}
                      className={`flex w-full items-center gap-3.5 rounded-xl border bg-white p-3.5 text-left transition-colors ${
                        ativo
                          ? 'border-brand-600 ring-1 ring-brand-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Avatar
                        iniciais={cliente.iniciais}
                        destacado={ativo}
                        className="h-10 w-10"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {cliente.nome}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {cliente.endereco}
                          {' · '}
                          <span
                            className={
                              cliente.rota
                                ? 'font-medium text-slate-600'
                                : 'font-medium text-warning'
                            }
                          >
                            {cliente.rota ?? 'Sem rota'}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold text-slate-900">
                          {formatarCentavosCurto(cliente.emAbertoCentavos)}
                        </span>
                        <span className="block text-xs text-slate-400">em aberto</span>
                        <StatusPill tom={situacao.tom} className="mt-1.5">
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

        {selecionado ? (
          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-6">
            <div className="border-b border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <Avatar
                  iniciais={selecionado.iniciais}
                  destacado
                  className="h-12 w-12 text-base"
                />
                <div className="min-w-0">
                  <div className="truncate text-base font-bold text-slate-900">
                    {selecionado.nome}
                  </div>
                  <StatusPill tom={rotulosSituacao[selecionado.situacao].tom} className="mt-1">
                    {rotulosSituacao[selecionado.situacao].texto}
                  </StatusPill>
                </div>
              </div>
            </div>

            <dl className="flex flex-col gap-4 p-4">
              <div>
                <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Contato
                </dt>
                <dd className="flex items-center gap-2 text-sm text-slate-700">
                  <Phone size={16} aria-hidden className="shrink-0 text-slate-400" />
                  {selecionado.telefone}
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Endereço
                </dt>
                <dd className="flex items-start gap-2 text-sm text-slate-700">
                  <MapPin size={16} aria-hidden className="mt-0.5 shrink-0 text-slate-400" />
                  {selecionado.endereco}
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Rota
                </dt>
                <dd>
                  <StatusPill tom={selecionado.rota ? 'marca' : 'alerta'}>
                    {selecionado.rota ?? 'Sem rota'}
                  </StatusPill>
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Em aberto
                </dt>
                <dd className="text-lg font-bold text-slate-900">
                  {formatarCentavos(selecionado.emAbertoCentavos)}
                </dd>
              </div>
            </dl>

            <div className="border-t border-slate-200 p-4">
              <EmptyState>Carnês e parcelas dependem das regras financeiras.</EmptyState>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  )
}
