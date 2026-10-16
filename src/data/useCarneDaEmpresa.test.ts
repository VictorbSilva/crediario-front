// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { CARNE_COMPLETO, useCarneDaEmpresa } from './useCarneDaEmpresa'
import type { ColecaoDoCarne } from './useCarneDaEmpresa'

type Ouvinte = {
  caminho: string[]
  opcoes: unknown
  proximo: (instantaneo: unknown) => void
  erro: (causa: unknown) => void
  cancelar: Mock
}

const simulado = vi.hoisted(() => ({
  businessId: 'loja-treino' as string | null,
  ouvintes: [] as Ouvinte[],
}))

vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ businessId: simulado.businessId }) }))
vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...caminho: string[]) => caminho,
  onSnapshot: (caminho: string[], opcoes: unknown, proximo: Ouvinte['proximo'], erro: Ouvinte['erro']) => {
    const cancelar = vi.fn()
    simulado.ouvintes.push({ caminho, opcoes, proximo, erro, cancelar })
    return cancelar
  },
}))

// O Financeiro só pede estas duas: `installments` é a maior coleção e ele não precisa dela.
const DO_FINANCEIRO: readonly ColecaoDoCarne[] = ['sales', 'payments']

function ouvinteDe(colecao: string): Ouvinte {
  const ouvinte = simulado.ouvintes.find(
    (o) => o.caminho.at(-1) === colecao && o.cancelar.mock.calls.length === 0,
  )
  if (!ouvinte) throw new Error(`Nenhum listener ativo em ${colecao}`)
  return ouvinte
}

function emitir(colecao: string, ids: string[], { fromCache = false, pendentes = [] as string[] } = {}) {
  act(() => {
    ouvinteDe(colecao).proximo({
      metadata: { fromCache },
      docs: ids.map((id) => ({
        id,
        data: () => ({ nome: id }),
        metadata: { hasPendingWrites: pendentes.includes(id) },
      })),
    })
  })
}

beforeEach(() => {
  simulado.businessId = 'loja-treino'
  simulado.ouvintes = []
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useCarneDaEmpresa', () => {
  it('ouve as coleções pedidas inteiras, sem filtro, e só elas', () => {
    renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))

    expect(simulado.ouvintes.map((o) => o.caminho)).toEqual([
      ['businesses', 'loja-treino', 'sales'],
      ['businesses', 'loja-treino', 'payments'],
    ])
    expect(simulado.ouvintes[0].opcoes).toEqual({ includeMetadataChanges: true })
  })

  it('a mesma constante de módulo entre renders não refaz os listeners', () => {
    const { rerender } = renderHook(() => useCarneDaEmpresa(CARNE_COMPLETO))
    rerender()
    rerender()

    expect(simulado.ouvintes).toHaveLength(3)
  })

  it('sem empresa não assina nada e fica carregando', () => {
    simulado.businessId = null
    const { result } = renderHook(() => useCarneDaEmpresa(CARNE_COMPLETO))

    expect(simulado.ouvintes).toHaveLength(0)
    expect(result.current.carregando).toBe(true)
    expect(result.current.confianca).toBe('desconhecida')
  })

  it('carrega por coleção, não por contagem de snapshots', () => {
    const { result } = renderHook(() => useCarneDaEmpresa(CARNE_COMPLETO))

    emitir('sales', ['v1'])
    emitir('sales', ['v1', 'v2'])
    emitir('sales', ['v1', 'v2', 'v3'])
    expect(result.current.carregando).toBe(true)

    emitir('installments', ['p1'])
    emitir('payments', [])
    expect(result.current.carregando).toBe(false)
  })

  it('entrega os documentos crus, com todo campo que existir, e soma os pendentes', () => {
    const { result } = renderHook(() => useCarneDaEmpresa(CARNE_COMPLETO))
    emitir('sales', ['v1', 'v2'], { pendentes: ['v2'] })
    emitir('installments', ['p1', 'p2'], { pendentes: ['p1', 'p2'] })
    emitir('payments', ['pg1'])

    expect(result.current.vendas).toEqual([
      { id: 'v1', dados: { nome: 'v1' } },
      { id: 'v2', dados: { nome: 'v2' } },
    ])
    expect(result.current.parcelas.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(result.current.pagamentos.map((p) => p.id)).toEqual(['pg1'])
    expect(result.current.pendentes).toBe(3)
  })

  it('coleção que não foi pedida volta vazia', () => {
    const { result } = renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))
    emitir('sales', ['v1'])
    emitir('payments', ['pg1'])

    expect(result.current.parcelas).toEqual([])
    expect(result.current.carregando).toBe(false)
  })

  it('tudo do cache, num aparelho que nunca leu do servidor, é parcial', () => {
    const { result } = renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))
    emitir('sales', [], { fromCache: true })
    emitir('payments', [], { fromCache: true })

    expect(result.current.confianca).toBe('parcial')
  })

  it('a memória de ter lido do servidor exige todas as coleções pedidas, e leva a lista na chave', () => {
    const { result } = renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))
    emitir('sales', ['v1'])
    emitir('payments', ['pg1'], { fromCache: true })
    expect(localStorage.length).toBe(0)

    emitir('payments', ['pg1'])
    expect(localStorage.getItem('crediario:carne-sincronizou:loja-treino:sales,payments')).toBe('1')
    expect(result.current.confianca).toBe('confiavel')

    // Provar sales + payments não prova o carnê completo do backup.
    cleanup()
    const backup = renderHook(() => useCarneDaEmpresa(CARNE_COMPLETO))
    emitir('sales', [], { fromCache: true })
    emitir('installments', [], { fromCache: true })
    emitir('payments', [], { fromCache: true })
    expect(backup.result.current.confianca).toBe('parcial')
  })

  it('aberto offline depois de já ter lido do servidor, continua confiável', () => {
    localStorage.setItem('crediario:carne-sincronizou:loja-treino:sales,payments', '1')
    const { result } = renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))
    emitir('sales', [], { fromCache: true })
    emitir('payments', [], { fromCache: true })

    expect(result.current.confianca).toBe('confiavel')
  })

  it('armazenamento bloqueado vale como nunca ter lido, e não impede marcar nesta sessão', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const { result } = renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))
    emitir('sales', [], { fromCache: true })
    emitir('payments', [], { fromCache: true })
    expect(result.current.confianca).toBe('parcial')

    emitir('sales', ['v1'])
    emitir('payments', ['pg1'])
    expect(result.current.confianca).toBe('confiavel')
  })

  it('uma coleção do cache e outra do servidor, sem memória, ainda é parcial', () => {
    const { result } = renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))
    emitir('sales', ['v1'])
    emitir('payments', ['pg1'], { fromCache: true })

    expect(result.current.confianca).toBe('parcial')
  })

  it('erro antes de qualquer snapshot não finge uma lista vazia confiável', () => {
    const { result } = renderHook(() => useCarneDaEmpresa(CARNE_COMPLETO))

    act(() => ouvinteDe('sales').erro(new Error('permission-denied')))

    expect(result.current.carregando).toBe(false)
    expect(result.current.vendas).toEqual([])
    expect(result.current.parcelas).toEqual([])
    expect(result.current.pendentes).toBe(0)
    expect(result.current.confianca).toBe('parcial')
  })

  it('o erro continua na tela quando outra coleção manda snapshot depois', () => {
    const { result } = renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))
    act(() => ouvinteDe('payments').erro(new Error('permission-denied')))

    emitir('sales', ['v1'])

    expect(result.current.erro).toBe('Não foi possível carregar o carnê da empresa.')
  })

  it('erro de leitura avisa e marca todas as coleções como chegadas', () => {
    const { result } = renderHook(() => useCarneDaEmpresa(CARNE_COMPLETO))
    emitir('sales', ['v1'])

    act(() => ouvinteDe('payments').erro(new Error('permission-denied')))

    expect(result.current.erro).toBe('Não foi possível carregar o carnê da empresa.')
    expect(result.current.carregando).toBe(false)
    // O que já tinha chegado continua lá.
    expect(result.current.vendas.map((v) => v.id)).toEqual(['v1'])
  })

  it('trocar de empresa volta a carregando em vez de mostrar o carnê da anterior', () => {
    const { result, rerender } = renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))
    emitir('sales', ['v1'])
    emitir('payments', ['pg1'])
    act(() => ouvinteDe('payments').erro(new Error('falhou')))

    simulado.businessId = 'loja-principal'
    rerender()

    expect(result.current.carregando).toBe(true)
    expect(result.current.vendas).toEqual([])
    expect(result.current.erro).toBeNull()
    expect(simulado.ouvintes.slice(0, 2).every((o) => o.cancelar.mock.calls.length === 1)).toBe(true)

    // O primeiro snapshot da empresa nova não herda nada da anterior, nem o erro.
    emitir('sales', ['outra'])
    expect(result.current.vendas.map((v) => v.id)).toEqual(['outra'])
    expect(result.current.pagamentos).toEqual([])
    expect(result.current.carregando).toBe(true)
    expect(result.current.erro).toBeNull()

    act(() => ouvinteDe('payments').erro(new Error('falhou de novo')))
    expect(result.current.vendas.map((v) => v.id)).toEqual(['outra'])
  })

  it('erro logo depois de trocar de empresa não mostra as vendas da empresa anterior', () => {
    const { result, rerender } = renderHook(() => useCarneDaEmpresa(DO_FINANCEIRO))
    emitir('sales', ['v1'])
    emitir('payments', ['pg1'])

    simulado.businessId = 'loja-principal'
    rerender()
    act(() => ouvinteDe('sales').erro(new Error('permission-denied')))

    expect(result.current.vendas).toEqual([])
    expect(result.current.pagamentos).toEqual([])
    expect(result.current.erro).toBe('Não foi possível carregar o carnê da empresa.')
  })
})
