import { useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Download, MapPin, Phone, Plus } from 'lucide-react'
import { ExportarClientes } from '@/components/clientes/ExportarClientes'
import { FormularioCliente } from '@/components/clientes/FormularioCliente'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kpi } from '@/components/ui/Kpi'
import { Nota } from '@/components/ui/Nota'
import { SearchInput } from '@/components/ui/SearchInput'
import { StatusPill } from '@/components/ui/StatusPill'
import { useClientes } from '@/data/useClientes'
import { dataBonita } from '@/lib/data'
import { iniciaisDe, normalizar, somenteDigitos } from '@/lib/texto'
import type { Cliente } from '@/types/cliente'

function combina(cliente: Cliente, termo: string, digitos: string): boolean {
  if (cliente.nomeBusca.includes(termo)) return true
  if (normalizar(cliente.endereco ?? '').includes(termo)) return true
  if (digitos === '') return false

  return (
    String(cliente.numero).startsWith(digitos) ||
    (cliente.telefoneDigits ?? '').includes(digitos) ||
    (cliente.cpfDigits ?? '').includes(digitos)
  )
}

export function ClientesPage() {
  const {
    clientes,
    ativos,
    arquivados,
    carregando,
    erro,
    pendentes,
    falhas,
    descartarFalha,
    alternarArquivo,
  } = useClientes()

  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const [exportando, setExportando] = useState(false)

  const visiveis = mostrarArquivados ? clientes : ativos

  const encontrados = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return visiveis

    const digitos = somenteDigitos(busca)
    return visiveis.filter((cliente) => combina(cliente, termo, digitos))
  }, [visiveis, busca])

  const selecionado = encontrados.find((c) => c.id === selecionadoId) ?? encontrados[0]

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastro, contato e situação dos clientes do crediário.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setExportando(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Download size={17} aria-hidden />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            type="button"
            onClick={() => setCadastrando(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Plus size={17} aria-hidden />
            <span className="hidden sm:inline">Novo cliente</span>
          </button>
        </div>
      </div>

      {erro ? (
        <div className="mb-4">
          <Nota tom="alerta" titulo="Não foi possível carregar">
            {erro}
          </Nota>
        </div>
      ) : null}

      {falhas.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          {falhas.map((falha) => (
            <Nota key={falha.id} tom="alerta" titulo="Uma escrita foi recusada">
              <span>{falha.mensagem}</span>
              <button
                type="button"
                onClick={() => descartarFalha(falha.id)}
                className="ml-2 font-semibold underline underline-offset-2"
              >
                Entendi
              </button>
            </Nota>
          ))}
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Clientes" valor={String(ativos.length)} />
        <Kpi rotulo="Alterações pendentes" valor={String(pendentes)} tom="marca" />
        {arquivados.length > 0 ? (
          <Kpi rotulo="Arquivados" valor={String(arquivados.length)} />
        ) : null}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-3">
            <SearchInput
              id="busca-clientes"
              label="Buscar clientes"
              placeholder="Buscar por número, nome, telefone, CPF ou endereço"
              value={busca}
              onChange={setBusca}
            />
          </div>

          {arquivados.length > 0 ? (
            <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={mostrarArquivados}
                onChange={(evento) => setMostrarArquivados(evento.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
              />
              Mostrar arquivados
            </label>
          ) : null}

          {carregando ? (
            <EmptyState>Carregando os clientes deste aparelho…</EmptyState>
          ) : clientes.length === 0 ? (
            <EmptyState>
              Nenhum cliente cadastrado ainda. Comece pelo botão “Novo cliente”.
            </EmptyState>
          ) : encontrados.length === 0 ? (
            <EmptyState>Nenhum cliente encontrado para esta busca.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {encontrados.map((cliente) => {
                const ativo = selecionado?.id === cliente.id

                return (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionadoId(cliente.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors ${
                        ativo ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Avatar
                        iniciais={iniciaisDe(cliente.nome)}
                        destacado={ativo}
                        className="h-10 w-10"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          <span className="text-brand-700">#{cliente.numero}</span> · {cliente.nome}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {cliente.endereco ?? 'Sem endereço'}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {cliente.arquivado ? <StatusPill>Arquivado</StatusPill> : null}
                        {cliente.pendente ? <StatusPill tom="marca">Pendente</StatusPill> : null}
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
                  iniciais={iniciaisDe(selecionado.nome)}
                  destacado
                  className="h-12 w-12 text-base"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold tracking-wide text-brand-700">
                    #{selecionado.numero}
                  </div>
                  <div className="truncate text-base font-bold text-slate-900">
                    {selecionado.nome}
                  </div>
                </div>
              </div>
            </div>

            <dl className="flex flex-col gap-4 p-4">
              {selecionado.telefone ? (
                <div>
                  <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Contato
                  </dt>
                  <dd className="flex items-center gap-2 text-sm text-slate-700">
                    <Phone size={16} aria-hidden className="shrink-0 text-slate-400" />
                    {selecionado.telefone}
                  </dd>
                </div>
              ) : null}

              {selecionado.endereco ? (
                <div>
                  <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Endereço
                  </dt>
                  <dd className="flex items-start gap-2 text-sm text-slate-700">
                    <MapPin size={16} aria-hidden className="mt-0.5 shrink-0 text-slate-400" />
                    {selecionado.endereco}
                  </dd>
                </div>
              ) : null}

              {selecionado.cpf ? (
                <div>
                  <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    CPF
                  </dt>
                  <dd className="text-sm text-slate-700">{selecionado.cpf}</dd>
                </div>
              ) : null}

              <div>
                <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Cadastrado em
                </dt>
                <dd className="text-sm text-slate-700">{dataBonita(selecionado.cadastradoEm)}</dd>
              </div>

              {selecionado.observacao ? (
                <div>
                  <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Observação
                  </dt>
                  <dd className="text-sm text-slate-700">{selecionado.observacao}</dd>
                </div>
              ) : null}

              <div>
                <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Carnês
                </dt>
                <dd>
                  <EmptyState>Carnês e parcelas dependem das regras financeiras.</EmptyState>
                </dd>
              </div>
            </dl>

            <div className="border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={() => alternarArquivo(selecionado)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                {selecionado.arquivado ? (
                  <ArchiveRestore size={17} aria-hidden />
                ) : (
                  <Archive size={17} aria-hidden />
                )}
                {selecionado.arquivado ? 'Desarquivar cliente' : 'Arquivar cliente'}
              </button>
            </div>
          </aside>
        ) : null}
      </div>

      {cadastrando ? <FormularioCliente aoFechar={() => setCadastrando(false)} /> : null}
      {exportando ? <ExportarClientes aoFechar={() => setExportando(false)} /> : null}
    </div>
  )
}
