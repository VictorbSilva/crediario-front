import { useMemo, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { ExportarClientes } from '@/components/clientes/ExportarClientes'
import { FormularioCliente } from '@/components/clientes/FormularioCliente'
import { ListaDeClientes } from '@/components/clientes/ListaDeClientes'
import { PainelDoCliente } from '@/components/clientes/PainelDoCliente'
import { Kpi } from '@/components/ui/Kpi'
import { Nota } from '@/components/ui/Nota'
import { SearchInput } from '@/components/ui/SearchInput'
import { useClientes } from '@/data/useClientes'
import { normalizar, somenteDigitos } from '@/lib/texto'
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

          <ListaDeClientes
            encontrados={encontrados}
            cadastrados={clientes.length}
            carregando={carregando}
            selecionadoId={selecionado?.id}
            aoSelecionar={setSelecionadoId}
          />
        </div>

        {selecionado ? (
          <PainelDoCliente cliente={selecionado} aoAlternarArquivo={alternarArquivo} />
        ) : null}
      </div>

      {cadastrando ? <FormularioCliente aoFechar={() => setCadastrando(false)} /> : null}
      {exportando ? <ExportarClientes aoFechar={() => setExportando(false)} /> : null}
    </div>
  )
}
