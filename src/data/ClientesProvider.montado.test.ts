// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { ENTRADA_CLIENTE_VAZIA, entradaDoCliente } from '@/lib/cliente'
import type { Cliente } from '@/types/cliente'
import { ClientesProvider } from './ClientesProvider'
import { useClientes } from './useClientes'

// O `ClientesProvider.test.ts` simula o `useState` para inspecionar as escritas
// de edição e de rota sem montar nada. Aqui o provider monta de verdade: é o
// único jeito de exercitar o listener, que vive num efeito.

type Ouvinte = {
  consulta: unknown
  opcoes: unknown
  proximo: (instantaneo: unknown) => void
  erro: (falha: unknown) => void
  cancelar: Mock
}

const simulado = vi.hoisted(() => ({
  businessId: 'loja-treino' as string | null,
  ouvintes: [] as Ouvinte[],
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  lote: { update: vi.fn(), commit: vi.fn(() => Promise.resolve()) },
}))

vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ businessId: simulado.businessId }) }))
vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('@/lib/dispositivo', () => ({ identificarDispositivo: () => 'aparelho' }))
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...caminho: string[]) => ({ caminho }),
  doc: (base: unknown, ...caminho: string[]) => (caminho.length > 0 ? { caminho } : { novoEm: base }),
  query: (colecao: unknown, ordem: unknown) => ({ colecao, ordem }),
  orderBy: (campo: string) => ({ orderBy: campo }),
  onSnapshot: (consulta: unknown, opcoes: unknown, proximo: Ouvinte['proximo'], erro: Ouvinte['erro']) => {
    const cancelar = vi.fn()
    simulado.ouvintes.push({ consulta, opcoes, proximo, erro, cancelar })
    return cancelar
  },
  serverTimestamp: () => 'carimbo-do-servidor',
  deleteField: () => 'remover-campo',
  setDoc: simulado.setDoc,
  updateDoc: simulado.updateDoc,
  writeBatch: () => simulado.lote,
  FieldPath: class {
    partes: string[]

    constructor(...partes: string[]) {
      this.partes = partes
    }
  },
}))

const CHAVE = 'crediario:sincronizou:loja-treino'

type DocumentoSimulado = { id: string; dados: Record<string, unknown>; pendente?: boolean }

const ANA: DocumentoSimulado = {
  id: 'ana',
  dados: {
    numero: 12, nome: 'Ana', nomeBusca: 'ana', telefone: '(11) 9999-0000', cadastradoEm: '2026-09-03',
    atualizadoPor: 'x', diasDeVisita: [5],
  },
}
const BIA: DocumentoSimulado = {
  id: 'bia',
  dados: { numero: 13, nome: 'Bia', nomeBusca: 'bia', arquivado: true, cadastradoEm: '2026-09-04', atualizadoPor: 'x' },
  pendente: true,
}

function emitir(documentos: DocumentoSimulado[], fromCache = false) {
  act(() => {
    simulado.ouvintes.at(-1)?.proximo({
      metadata: { fromCache },
      docs: documentos.map((d) => ({
        id: d.id,
        data: () => d.dados,
        metadata: { hasPendingWrites: d.pendente ?? false },
      })),
    })
  })
}

function montar() {
  return renderHook(() => useClientes(), { wrapper: ClientesProvider })
}

async function esvaziarFila() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  simulado.businessId = 'loja-treino'
  simulado.ouvintes = []
  simulado.setDoc.mockReset().mockReturnValue(Promise.resolve())
  simulado.updateDoc.mockReset().mockReturnValue(Promise.resolve())
  simulado.lote.update.mockReset()
  simulado.lote.commit.mockReset().mockReturnValue(Promise.resolve())
  localStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ClientesProvider montado — listener', () => {
  it('assina a coleção de clientes da empresa em ordem de número, ouvindo metadados', () => {
    const { result } = montar()

    expect(simulado.ouvintes).toHaveLength(1)
    expect(simulado.ouvintes[0].consulta).toEqual({
      colecao: { caminho: ['businesses', 'loja-treino', 'clients'] },
      ordem: { orderBy: 'numero' },
    })
    expect(simulado.ouvintes[0].opcoes).toEqual({ includeMetadataChanges: true })
    expect(result.current.carregando).toBe(true)
    expect(result.current.estadoSync).toBe('sincronizando')
    expect(result.current.confianca).toBe('desconhecida')
    expect(result.current.clientes).toEqual([])
    expect(result.current.falhas).toEqual([])
  })

  it('lista que falhou antes do primeiro snapshot não é confiável para conferir número', () => {
    const { result } = montar()

    act(() => simulado.ouvintes[0].erro({ code: 'unavailable' }))

    expect(result.current.clientes).toEqual([])
    expect(result.current.confianca).toBe('parcial')
  })

  it('sincronizou e depois a rede caiu: continua confiável nesta sessão', () => {
    const { result } = montar()
    emitir([ANA])

    emitir([ANA], true)

    expect(result.current.estadoSync).toBe('offline')
    expect(result.current.confianca).toBe('confiavel')
  })

  it('trocar de empresa refaz a assinatura no caminho da empresa nova', () => {
    const { rerender } = montar()
    simulado.businessId = 'loja-principal'
    rerender()

    expect(simulado.ouvintes[0].cancelar).toHaveBeenCalledTimes(1)
    expect(simulado.ouvintes[1].consulta).toEqual({
      colecao: { caminho: ['businesses', 'loja-principal', 'clients'] },
      ordem: { orderBy: 'numero' },
    })
  })

  it('separa ativos de arquivados e conta o que ainda não subiu', () => {
    const { result } = montar()
    emitir([ANA, BIA])

    expect(result.current.clientes.map((c) => c.id)).toEqual(['ana', 'bia'])
    expect(result.current.ativos.map((c) => c.id)).toEqual(['ana'])
    expect(result.current.arquivados.map((c) => c.id)).toEqual(['bia'])
    expect(result.current.pendentes).toBe(1)
    expect(result.current.estadoSync).toBe('pendente')
    expect(result.current.clientes[0]).toMatchObject({
      numero: 12, telefone: '(11) 9999-0000', diasDeVisita: [5], criadoEm: null, atualizadoEm: null, pendente: false,
    })
  })

  it('lista só do cache num aparelho que nunca sincronizou não é confiável', () => {
    const { result } = montar()
    emitir([ANA], true)

    expect(result.current.doCache).toBe(true)
    expect(result.current.confianca).toBe('parcial')
    expect(result.current.estadoSync).toBe('offline')
    expect(localStorage.getItem(CHAVE)).toBeNull()
  })

  it('o primeiro snapshot do servidor fica lembrado neste aparelho, e vale offline depois', () => {
    const primeiro = montar()
    emitir([ANA])
    expect(localStorage.getItem(CHAVE)).toBe('1')
    expect(primeiro.result.current.confianca).toBe('confiavel')

    cleanup()
    const depois = montar()
    emitir([ANA], true)
    expect(depois.result.current.confianca).toBe('confiavel')
  })

  it('armazenamento bloqueado vale como nunca ter sincronizado, sem impedir a lista de carregar', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const { result } = montar()
    emitir([ANA], true)
    expect(result.current.confianca).toBe('parcial')

    emitir([ANA])
    expect(result.current.clientes).toHaveLength(1)
    expect(result.current.confianca).toBe('confiavel')
  })

  it.each([
    [{ code: 'permission-denied' }, 'Sem permissão para ler os clientes. Confira se as regras do Firestore foram publicadas.'],
    [{ code: 'unavailable' }, 'Não foi possível carregar a lista de clientes.'],
    [{ code: 403 }, 'Não foi possível carregar a lista de clientes.'],
    ['falha solta', 'Não foi possível carregar a lista de clientes.'],
    [null, 'Não foi possível carregar a lista de clientes.'],
  ])('erro de leitura %j vira mensagem legível e encerra o carregamento', (falha, mensagem) => {
    const { result } = montar()

    act(() => simulado.ouvintes[0].erro(falha))

    expect(result.current.erro).toBe(mensagem)
    expect(result.current.carregando).toBe(false)
    expect(result.current.estadoSync).toBe('erro')
  })

  it('um snapshot depois do erro limpa o erro', () => {
    const { result } = montar()
    act(() => simulado.ouvintes[0].erro({ code: 'unavailable' }))

    emitir([ANA])

    expect(result.current.erro).toBeNull()
  })

  it('sem empresa não assina nada; desmontar cancela a assinatura', () => {
    simulado.businessId = null
    montar()
    expect(simulado.ouvintes).toHaveLength(0)

    cleanup()
    simulado.businessId = 'loja-treino'
    const { unmount } = montar()
    unmount()
    expect(simulado.ouvintes[0].cancelar).toHaveBeenCalledTimes(1)
  })

  it('useClientes fora do provider avisa em vez de devolver undefined', () => {
    expect(() => renderHook(() => useClientes())).toThrow('useClientes precisa estar dentro de <ClientesProvider>.')
  })
})

describe('ClientesProvider montado — escritas', () => {
  const ana = { id: 'ana', numero: 12, nome: 'Ana', arquivado: false } as Cliente
  const novo = () => ({ ...ENTRADA_CLIENTE_VAZIA, numero: '40', nome: 'Carla Souza' })

  it('cadastrar grava sem esperar o servidor, com os carimbos do servidor', () => {
    const { result } = montar()

    const retorno = result.current.criarCliente(novo())

    expect(retorno).toBeUndefined()
    expect(simulado.setDoc).toHaveBeenCalledWith(
      { novoEm: { caminho: ['businesses', 'loja-treino', 'clients'] } },
      expect.objectContaining({
        numero: 40, nome: 'Carla Souza', atualizadoPor: 'aparelho',
        criadoEm: 'carimbo-do-servidor', atualizadoEm: 'carimbo-do-servidor',
      }),
    )
  })

  it('cadastro recusado vira falha que diz qual cliente sumiu, e pode ser dispensada', async () => {
    simulado.setDoc.mockRejectedValue(new Error('permission-denied'))
    const { result } = montar()

    result.current.criarCliente(novo())
    await esvaziarFila()

    expect(result.current.falhas.map((f) => f.mensagem)).toEqual([
      'O cliente 40 — Carla Souza foi recusado pelo servidor e saiu da lista.',
    ])
    act(() => result.current.descartarFalha(result.current.falhas[0].id))
    expect(result.current.falhas).toEqual([])
  })

  it('arquivar e desarquivar invertem o campo, e a falha diz qual dos dois falhou', async () => {
    simulado.updateDoc.mockRejectedValue(new Error('negado'))
    const { result } = montar()

    result.current.alternarArquivo(ana)
    result.current.alternarArquivo({ ...ana, arquivado: true })
    await esvaziarFila()

    expect(simulado.updateDoc).toHaveBeenNthCalledWith(1, { caminho: ['businesses', 'loja-treino', 'clients', 'ana'] }, {
      arquivado: true, atualizadoEm: 'carimbo-do-servidor', atualizadoPor: 'aparelho',
    })
    expect(simulado.updateDoc.mock.calls[1]).toEqual([
      { caminho: ['businesses', 'loja-treino', 'clients', 'ana'] },
      { arquivado: false, atualizadoEm: 'carimbo-do-servidor', atualizadoPor: 'aparelho' },
    ])
    expect(result.current.falhas.map((f) => f.mensagem)).toEqual([
      'Não foi possível arquivar Ana.',
      'Não foi possível desarquivar Ana.',
    ])
    expect(new Set(result.current.falhas.map((f) => f.id)).size).toBe(2)

    // Dispensar uma não leva a outra junto.
    act(() => result.current.descartarFalha(result.current.falhas[0].id))
    expect(result.current.falhas.map((f) => f.mensagem)).toEqual(['Não foi possível desarquivar Ana.'])
  })

  it('edição grava só o que mudou, no documento do cliente; recusa vira falha com o nome', async () => {
    simulado.updateDoc.mockRejectedValue(new Error('negado'))
    const { result } = montar()

    expect(result.current.editarCliente(ana, { ...entradaDoCliente(ana), nome: 'Ana Lima' })).toBe(true)
    await esvaziarFila()

    expect(simulado.updateDoc).toHaveBeenCalledWith(
      { caminho: ['businesses', 'loja-treino', 'clients', 'ana'] },
      { nome: 'Ana Lima', nomeBusca: 'ana lima', atualizadoPor: 'aparelho', atualizadoEm: 'carimbo-do-servidor' },
    )
    expect(result.current.falhas.map((f) => f.mensagem)).toEqual(['Não foi possível salvar as alterações de Ana.'])
  })

  it('edição sem mudança nenhuma fecha sem escrever, para não trocar carimbo nem autoria', () => {
    const { result } = montar()

    expect(result.current.editarCliente(ana, entradaDoCliente(ana))).toBe(true)
    expect(simulado.updateDoc).not.toHaveBeenCalled()
  })

  it('depois de trocar de empresa, toda escrita vai para a empresa nova', () => {
    const { result, rerender } = montar()
    simulado.businessId = 'loja-principal'
    rerender()

    result.current.criarCliente(novo())
    result.current.editarCliente(ana, { ...entradaDoCliente(ana), nome: 'Ana Lima' })
    result.current.alternarArquivo(ana)
    result.current.marcarNaRota({ ...ana, diasDeVisita: [15] } as Cliente, 'ausente')
    result.current.reordenarRota([{ clienteId: 'ana', tipo: 'dia', dia: 15, valor: 1500 }])

    expect(simulado.setDoc).toHaveBeenCalledWith({ novoEm: { caminho: ['businesses', 'loja-principal', 'clients'] } }, expect.anything())
    const caminhos = (simulado.updateDoc.mock.calls as unknown as [unknown][]).map(([referencia]) => referencia)
    expect(caminhos).toEqual(Array(4).fill({ caminho: ['businesses', 'loja-principal', 'clients', 'ana'] }))
  })

  it('sem empresa, nenhuma escrita sai', () => {
    simulado.businessId = null
    const { result } = montar()

    result.current.criarCliente(novo())
    result.current.alternarArquivo(ana)
    result.current.marcarNaRota(ana, 'visitado')
    result.current.reordenarRota([{ clienteId: 'ana', tipo: 'dia', dia: 15, valor: 1500 }])

    expect(result.current.editarCliente(ana, entradaDoCliente(ana))).toBe(false)
    expect(simulado.setDoc).not.toHaveBeenCalled()
    expect(simulado.updateDoc).not.toHaveBeenCalled()
    expect(simulado.lote.commit).not.toHaveBeenCalled()
  })
})

describe('ClientesProvider montado — rota', () => {
  const HOJE = '2026-10-15'
  const visitadaHoje = {
    id: 'ana', numero: 12, nome: 'Ana', diasDeVisita: [15], ultimoVisitado: HOJE, ultimaMarca: 'visitado',
    ultimaMarcaEm: HOJE,
  } as Cliente

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 15, 10))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('desmarcar a visita de hoje, sem visita anterior, só apaga campos — e apaga mesmo', () => {
    const { result } = montar()

    result.current.marcarNaRota(visitadaHoje, 'desmarcar')

    expect(simulado.updateDoc).toHaveBeenCalledWith(
      { caminho: ['businesses', 'loja-treino', 'clients', 'ana'] },
      {
        visitadoAnterior: 'remover-campo', ultimaMarca: 'remover-campo', ultimaMarcaEm: 'remover-campo',
        ultimoVisitado: 'remover-campo', atualizadoEm: 'carimbo-do-servidor', atualizadoPor: 'aparelho',
      },
    )
  })

  it('marca que não muda nada não escreve: ausente para quem já foi visitado hoje', () => {
    const { result } = montar()

    result.current.marcarNaRota(visitadaHoje, 'ausente')

    expect(simulado.updateDoc).not.toHaveBeenCalled()
  })

  it('marca recusada vira falha com o nome do cliente', async () => {
    simulado.updateDoc.mockRejectedValue(new Error('negado'))
    const { result } = montar()

    result.current.marcarNaRota({ ...visitadaHoje, ultimoVisitado: undefined, ultimaMarca: undefined }, 'visitado')
    await esvaziarFila()

    expect(result.current.falhas.map((f) => f.mensagem)).toEqual(['Não foi possível marcar a visita de Ana.'])
  })

  it('a ordem de um dia vai por FieldPath, mexendo só naquele dia do mapa', () => {
    const { result } = montar()

    result.current.reordenarRota([{ clienteId: 'ana', tipo: 'dia', dia: 5, valor: 1500 }])

    const [[referencia, campo, valor, ...resto]] = simulado.updateDoc.mock.calls as unknown as unknown[][]
    expect(referencia).toEqual({ caminho: ['businesses', 'loja-treino', 'clients', 'ana'] })
    expect(campo).toEqual({ partes: ['ordemPorDia', '5'] })
    expect(valor).toBe(1500)
    expect(resto).toEqual(['atualizadoEm', 'carimbo-do-servidor', 'atualizadoPor', 'aparelho'])
  })

  it('a ordem de hoje vai inteira, com data e valor juntos', () => {
    const { result } = montar()

    result.current.reordenarRota([{ clienteId: 'ana', tipo: 'hoje', data: HOJE, valor: -500 }])

    const [[, campo, valor]] = simulado.updateDoc.mock.calls as unknown as unknown[][]
    expect(campo).toBe('ordemDoDia')
    expect(valor).toEqual({ data: HOJE, valor: -500 })
  })

  it('rebalancear vários clientes vai num lote só, ou nada entra', async () => {
    simulado.lote.commit.mockRejectedValue(new Error('negado'))
    const { result } = montar()

    result.current.reordenarRota([
      { clienteId: 'ana', tipo: 'dia', dia: 5, valor: 1000 },
      { clienteId: 'bia', tipo: 'hoje', data: HOJE, valor: 2000 },
    ])
    await esvaziarFila()

    expect(simulado.updateDoc).not.toHaveBeenCalled()
    expect(simulado.lote.update.mock.calls).toEqual([
      [{ caminho: ['businesses', 'loja-treino', 'clients', 'ana'] }, { partes: ['ordemPorDia', '5'] }, 1000, 'atualizadoEm', 'carimbo-do-servidor', 'atualizadoPor', 'aparelho'],
      [{ caminho: ['businesses', 'loja-treino', 'clients', 'bia'] }, 'ordemDoDia', { data: HOJE, valor: 2000 }, 'atualizadoEm', 'carimbo-do-servidor', 'atualizadoPor', 'aparelho'],
    ])
    expect(simulado.lote.commit).toHaveBeenCalledTimes(1)
    expect(result.current.falhas.map((f) => f.mensagem)).toEqual(['Não foi possível salvar a nova ordem da rota.'])
  })

  it('reordenação vazia não escreve nada', () => {
    const { result } = montar()

    result.current.reordenarRota([])

    expect(simulado.updateDoc).not.toHaveBeenCalled()
    expect(simulado.lote.commit).not.toHaveBeenCalled()
  })
})
