import { useMemo, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ExportarClientes } from '@/components/clientes/ExportarClientes'
import { FormularioCliente } from '@/components/clientes/FormularioCliente'
import { ListaDeClientes } from '@/components/clientes/ListaDeClientes'
import { PainelDoCliente } from '@/components/clientes/PainelDoCliente'
import { useTelaLarga } from '@/components/layout/useTelaLarga'
import { Kpi } from '@/components/ui/Kpi'
import { Nota } from '@/components/ui/Nota'
import { SearchInput } from '@/components/ui/SearchInput'
import { useCarneDaEmpresa } from '@/data/useCarneDaEmpresa'
import { useClientes } from '@/data/useClientes'
import { dataLocalISO } from '@/lib/data'
import { contagemDeClientes, documentosParaFinanceiro, listaDeAtrasados, situacaoFinanceira } from '@/lib/financeiro'
import { normalizar, somenteDigitos } from '@/lib/texto'
import type { Cliente } from '@/types/cliente'

const COLECOES_DOS_CONTADORES = ['sales', 'payments'] as const

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
    falhas,
    descartarFalha,
    alternarArquivo,
  } = useClientes()
  const { vendas, pagamentos, confianca, erro: erroDoCarne } = useCarneDaEmpresa(COLECOES_DOS_CONTADORES)

  const larga = useTelaLarga()
  const navigate = useNavigate()

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'com-vendas' | 'em-atraso'>('todos')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const [exportando, setExportando] = useState(false)

  const hoje = dataLocalISO(new Date())
  const { contagem, atrasados } = useMemo(() => {
    const documentos = documentosParaFinanceiro(vendas, pagamentos)
    const situacao = situacaoFinanceira(documentos.vendas, documentos.pagamentos, hoje)
    return {
      contagem: contagemDeClientes(situacao, documentos.vendas, clientes, hoje),
      atrasados: listaDeAtrasados(situacao, ativos),
    }
  }, [vendas, pagamentos, clientes, ativos, hoje])

  const visiveis = useMemo(() => {
    if (filtro === 'todos') return mostrarArquivados ? clientes : ativos
    if (filtro === 'com-vendas') return ativos.filter((cliente) => contagem.comVendas.has(cliente.id))
    return atrasados.flatMap(({ cliente }) =>
      cliente !== null && contagem.emAtraso.has(cliente.id) ? [cliente] : [],
    )
  }, [filtro, mostrarArquivados, clientes, ativos, contagem, atrasados])

  const encontrados = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return visiveis

    const digitos = somenteDigitos(busca)
    return visiveis.filter((cliente) => combina(cliente, termo, digitos))
  }, [visiveis, busca])

  // No desktop o clique alimenta o painel ao lado; no celular ele navega para a
  // página, que é a única forma do carnê caber. Sem o painel montado no celular,
  // os três listeners do carnê também não sobem para um cliente que ninguém abriu.
  const selecionado = larga
    ? (encontrados.find((c) => c.id === selecionadoId) ?? encontrados[0])
    : undefined

  const aoSelecionar = (id: string) => {
    if (larga) setSelecionadoId(id)
    else navigate(`/clientes/${id}`)
  }

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

      {erroDoCarne ? <div className="mb-4"><Nota tom="alerta">{erroDoCarne}</Nota></div> : null}

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

      <div className="mb-5 grid grid-cols-3 gap-3">
        {([
          { id: 'todos', rotulo: 'Clientes', valor: contagem.total },
          { id: 'com-vendas', rotulo: 'Com vendas', valor: contagem.comVendas.size },
          { id: 'em-atraso', rotulo: 'Em atraso', valor: contagem.emAtraso.size },
        ] as const).map(({ id, rotulo, valor }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filtro === id}
            disabled={id !== 'todos' && confianca === 'desconhecida'}
            onClick={() => setFiltro(id)}
            className="min-w-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-wait disabled:opacity-60"
          >
            <Kpi
              rotulo={rotulo}
              valor={id !== 'todos' && confianca === 'desconhecida' ? '—' : String(valor)}
              tom={filtro === id ? 'marca' : 'neutro'}
            />
          </button>
        ))}
      </div>

      {confianca === 'parcial' ? (
        <div className="mb-4">
          <Nota tom="alerta">
            Este aparelho ainda não baixou todas as vendas e pagamentos. Os números podem
            estar incompletos ou desatualizados.
          </Nota>
        </div>
      ) : null}

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

          {filtro === 'todos' && arquivados.length > 0 ? (
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
            carregando={carregando || (filtro !== 'todos' && confianca === 'desconhecida')}
            mensagemVazia={filtro === 'em-atraso' ? 'Nenhum cliente em atraso.' : filtro === 'com-vendas' ? 'Nenhum cliente com vendas.' : undefined}
            selecionadoId={selecionado?.id}
            aoSelecionar={aoSelecionar}
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
