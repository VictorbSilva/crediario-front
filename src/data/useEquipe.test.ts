// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { EntradaNovoMembro } from '@/lib/equipe'
import { useEquipe } from './useEquipe'

type Ouvinte = {
  consulta: { caminho: string[]; ordem: string }
  opcoes: unknown
  proximo: (instantaneo: unknown) => void
  erro: (causa: unknown) => void
  cancelar: Mock
}

const CARIMBO = { carimbo: 'do-servidor' }

const simulado = vi.hoisted(() => ({
  businessId: 'loja-treino' as string | null,
  ouvintes: [] as Ouvinte[],
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  criarConta: vi.fn(),
}))

vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ businessId: simulado.businessId }) }))
vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('@/lib/dispositivo', () => ({ identificarDispositivo: () => 'abc12345' }))
vi.mock('./criarContaDeFuncionario', () => ({ criarContaDeFuncionario: simulado.criarConta }))
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...caminho: string[]) => caminho,
  doc: (_db: unknown, ...caminho: string[]) => ({ caminho }),
  orderBy: (campo: string) => ({ ordem: campo }),
  query: (caminho: string[], { ordem }: { ordem: string }) => ({ caminho, ordem }),
  serverTimestamp: () => CARIMBO,
  setDoc: simulado.setDoc,
  updateDoc: simulado.updateDoc,
  onSnapshot: (
    consulta: Ouvinte['consulta'],
    opcoes: unknown,
    proximo: Ouvinte['proximo'],
    erro: Ouvinte['erro'],
  ) => {
    const cancelar = vi.fn()
    simulado.ouvintes.push({ consulta, opcoes, proximo, erro, cancelar })
    return cancelar
  },
}))

function ouvinteAtivo(): Ouvinte {
  const ouvinte = simulado.ouvintes.find((o) => o.cancelar.mock.calls.length === 0)
  if (!ouvinte) throw new Error('Nenhum listener ativo')
  return ouvinte
}

type DocumentoSimulado = { id: string; dados: Record<string, unknown>; pendente?: boolean }

function emitir(documentos: DocumentoSimulado[]) {
  act(() => {
    ouvinteAtivo().proximo({
      metadata: { fromCache: false },
      docs: documentos.map(({ id, dados, pendente = false }) => ({
        id,
        data: () => dados,
        metadata: { hasPendingWrites: pendente },
      })),
    })
  })
}

const MARIA = {
  nome: 'Maria',
  email: 'maria@loja.com',
  ativo: true,
  permissoes: { financeiro: false, caixaDoDia: true, exportar: false },
  criadoEm: 'ontem',
  atualizadoEm: 'ontem',
  atualizadoPor: 'outro',
}

function entrada(extra: Partial<EntradaNovoMembro> = {}): EntradaNovoMembro {
  return {
    nome: ' Maria ',
    email: ' Maria@Loja.com ',
    senha: 'segredo',
    permissoes: { financeiro: false, caixaDoDia: true, exportar: false },
    ...extra,
  }
}

function online(valor: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(valor)
}

beforeEach(() => {
  simulado.businessId = 'loja-treino'
  simulado.ouvintes = []
  simulado.setDoc.mockReset().mockResolvedValue(undefined)
  simulado.updateDoc.mockReset().mockResolvedValue(undefined)
  simulado.criarConta.mockReset().mockResolvedValue('uid-da-maria')
  online(true)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useEquipe — leitura', () => {
  it('ouve membros da empresa por nome, com metadados, e encerra ao desmontar', () => {
    const { unmount } = renderHook(() => useEquipe())

    expect(simulado.ouvintes).toHaveLength(1)
    expect(simulado.ouvintes[0].consulta).toEqual({
      caminho: ['businesses', 'loja-treino', 'membros'],
      ordem: 'nome',
    })
    expect(simulado.ouvintes[0].opcoes).toEqual({ includeMetadataChanges: true })

    unmount()
    expect(simulado.ouvintes[0].cancelar).toHaveBeenCalledOnce()
  })

  it('re-renderizar não refaz o listener', () => {
    const { rerender } = renderHook(() => useEquipe())
    rerender()
    rerender()

    expect(simulado.ouvintes).toHaveLength(1)
  })

  it('sem empresa não assina nada e fica carregando', () => {
    simulado.businessId = null
    const { result } = renderHook(() => useEquipe())

    expect(simulado.ouvintes).toHaveLength(0)
    expect(result.current.carregando).toBe(true)
    expect(result.current.membros).toEqual([])
  })

  it('carrega até o primeiro snapshot e entrega os membros com o uid e a pendência', () => {
    const { result } = renderHook(() => useEquipe())
    expect(result.current.carregando).toBe(true)

    emitir([
      { id: 'uid-da-maria', dados: MARIA },
      {
        id: 'uid-do-joao',
        dados: { ...MARIA, nome: 'João', email: 'joao@loja.com', ativo: false },
        pendente: true,
      },
    ])

    expect(result.current.carregando).toBe(false)
    expect(result.current.erro).toBeNull()
    expect(result.current.membros).toEqual([
      {
        uid: 'uid-da-maria',
        nome: 'Maria',
        email: 'maria@loja.com',
        ativo: true,
        permissoes: { financeiro: false, caixaDoDia: true, exportar: false },
        pendente: false,
      },
      {
        uid: 'uid-do-joao',
        nome: 'João',
        email: 'joao@loja.com',
        ativo: false,
        permissoes: { financeiro: false, caixaDoDia: true, exportar: false },
        pendente: true,
      },
    ])
  })

  it('ativo e permissões só valem true quando são exatamente true', () => {
    const { result } = renderHook(() => useEquipe())

    emitir([
      {
        id: 'uid-estranho',
        dados: { nome: 'X', email: 'x@y', ativo: 'sim', permissoes: { financeiro: 1 } },
      },
    ])

    expect(result.current.membros[0]).toMatchObject({
      ativo: false,
      permissoes: { financeiro: false, caixaDoDia: false, exportar: false },
    })
  })

  it('erro de leitura avisa e para de carregar', () => {
    const { result } = renderHook(() => useEquipe())

    act(() => ouvinteAtivo().erro(new Error('permission-denied')))

    expect(result.current.carregando).toBe(false)
    expect(result.current.membros).toEqual([])
    expect(result.current.erro).toBe('Não foi possível carregar a equipe.')
  })

  it('trocar de empresa volta a carregando em vez de mostrar a equipe da anterior', () => {
    const { result, rerender } = renderHook(() => useEquipe())
    emitir([{ id: 'uid-da-maria', dados: MARIA }])
    act(() => ouvinteAtivo().erro(new Error('falhou')))

    simulado.businessId = 'loja-principal'
    rerender()

    expect(simulado.ouvintes[0].cancelar).toHaveBeenCalledOnce()
    expect(simulado.ouvintes[1].consulta.caminho).toEqual(['businesses', 'loja-principal', 'membros'])
    expect(result.current.carregando).toBe(true)
    expect(result.current.membros).toEqual([])
    expect(result.current.erro).toBeNull()
  })
})

describe('useEquipe — cadastrar', () => {
  it('cria a conta com o e-mail gravado e grava membros/{uid} com os carimbos', async () => {
    const { result } = renderHook(() => useEquipe())

    let resposta: string | null = 'não respondeu'
    await act(async () => {
      resposta = await result.current.cadastrar(entrada())
    })

    expect(resposta).toBeNull()
    expect(simulado.criarConta).toHaveBeenCalledExactlyOnceWith('maria@loja.com', 'segredo')
    expect(simulado.setDoc).toHaveBeenCalledExactlyOnceWith(
      { caminho: ['businesses', 'loja-treino', 'membros', 'uid-da-maria'] },
      {
        nome: 'Maria',
        email: 'maria@loja.com',
        ativo: true,
        permissoes: { financeiro: false, caixaDoDia: true, exportar: false },
        atualizadoPor: 'abc12345',
        criadoEm: CARIMBO,
        atualizadoEm: CARIMBO,
      },
    )
    expect(simulado.setDoc.mock.invocationCallOrder[0]).toBeGreaterThan(
      simulado.criarConta.mock.invocationCallOrder[0],
    )
  })

  it('não espera o servidor confirmar o documento do membro', async () => {
    simulado.setDoc.mockReturnValue(new Promise(() => undefined))
    const { result } = renderHook(() => useEquipe())

    let resposta: string | null = 'não respondeu'
    await act(async () => {
      resposta = await result.current.cadastrar(entrada())
    })

    expect(resposta).toBeNull()
  })

  it('offline recusa antes de criar a conta', async () => {
    online(false)
    const { result } = renderHook(() => useEquipe())

    let resposta: string | null = null
    await act(async () => {
      resposta = await result.current.cadastrar(entrada())
    })

    expect(resposta).toBe('Sem internet. Criar a conta precisa de conexão.')
    expect(simulado.criarConta).not.toHaveBeenCalled()
    expect(simulado.setDoc).not.toHaveBeenCalled()
  })

  it('conta recusada pelo Auth devolve a mensagem traduzida e não grava membro', async () => {
    simulado.criarConta.mockRejectedValue(
      Object.assign(new Error('Firebase: Error'), { code: 'auth/email-already-in-use' }),
    )
    const { result } = renderHook(() => useEquipe())

    let resposta: string | null = null
    await act(async () => {
      resposta = await result.current.cadastrar(entrada())
    })

    expect(resposta).toBe('Este e-mail já tem conta.')
    expect(simulado.setDoc).not.toHaveBeenCalled()
    expect(result.current.erro).toBeNull()
  })

  it('erro sem código vira a mensagem genérica', async () => {
    simulado.criarConta.mockRejectedValue('caiu')
    const { result } = renderHook(() => useEquipe())

    let resposta: string | null = null
    await act(async () => {
      resposta = await result.current.cadastrar(entrada())
    })

    expect(resposta).toBe('Não foi possível criar a conta.')
  })

  it('membro recusado pelo servidor fica no erro, avisando da conta sem acesso', async () => {
    simulado.setDoc.mockRejectedValue(new Error('permission-denied'))
    const { result } = renderHook(() => useEquipe())

    await act(async () => {
      await result.current.cadastrar(entrada())
    })

    expect(result.current.erro).toBe(
      'O cadastro de Maria foi recusado pelo servidor. A conta ficou criada sem acesso; ' +
        'apague-a no console do Firebase antes de cadastrar de novo.',
    )
    expect(console.error).toHaveBeenCalled()
  })

  it('sem empresa não cria conta nenhuma', async () => {
    simulado.businessId = null
    const { result } = renderHook(() => useEquipe())

    let resposta: string | null = null
    await act(async () => {
      resposta = await result.current.cadastrar(entrada())
    })

    expect(resposta).toBe('Não foi possível criar a conta.')
    expect(simulado.criarConta).not.toHaveBeenCalled()
  })
})

describe('useEquipe — alterar', () => {
  it('alterarPermissoes grava só as três chaves, o carimbo e o dispositivo', () => {
    const { result } = renderHook(() => useEquipe())
    const permissoes = { financeiro: true, caixaDoDia: false, exportar: true, extra: true }

    act(() => result.current.alterarPermissoes('uid-da-maria', permissoes))

    expect(simulado.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { caminho: ['businesses', 'loja-treino', 'membros', 'uid-da-maria'] },
      {
        permissoes: { financeiro: true, caixaDoDia: false, exportar: true },
        atualizadoEm: CARIMBO,
        atualizadoPor: 'abc12345',
      },
    )
  })

  it('permissões recusadas pelo servidor ficam no erro', async () => {
    simulado.updateDoc.mockRejectedValue(new Error('permission-denied'))
    const { result } = renderHook(() => useEquipe())

    await act(async () => {
      result.current.alterarPermissoes('uid-da-maria', MARIA.permissoes)
    })

    expect(result.current.erro).toBe('Não foi possível alterar as permissões deste funcionário.')
  })

  it.each([
    [false, 'Não foi possível desativar este funcionário.'],
    [true, 'Não foi possível reativar este funcionário.'],
  ])('definirAtivo(%j) grava ativo, carimbo e dispositivo, e avisa se for recusado', async (ativo, mensagem) => {
    const { result } = renderHook(() => useEquipe())

    act(() => result.current.definirAtivo('uid-da-maria', ativo))

    expect(simulado.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { caminho: ['businesses', 'loja-treino', 'membros', 'uid-da-maria'] },
      { ativo, atualizadoEm: CARIMBO, atualizadoPor: 'abc12345' },
    )
    expect(result.current.erro).toBeNull()

    simulado.updateDoc.mockRejectedValue(new Error('permission-denied'))
    await act(async () => {
      result.current.definirAtivo('uid-da-maria', ativo)
    })

    expect(result.current.erro).toBe(mensagem)
  })

  it('erro de gravação continua na tela quando chega outro snapshot', async () => {
    simulado.updateDoc.mockRejectedValue(new Error('permission-denied'))
    const { result } = renderHook(() => useEquipe())

    await act(async () => {
      result.current.definirAtivo('uid-da-maria', false)
    })
    emitir([{ id: 'uid-da-maria', dados: MARIA }])

    expect(result.current.erro).toBe('Não foi possível desativar este funcionário.')
  })

  it('sem empresa não grava nada', () => {
    simulado.businessId = null
    const { result } = renderHook(() => useEquipe())

    act(() => {
      result.current.alterarPermissoes('uid-da-maria', MARIA.permissoes)
      result.current.definirAtivo('uid-da-maria', false)
    })

    expect(simulado.updateDoc).not.toHaveBeenCalled()
  })

  it('as ações usam a empresa atual depois de trocar', () => {
    const { result, rerender } = renderHook(() => useEquipe())
    simulado.businessId = 'loja-principal'
    rerender()

    act(() => result.current.definirAtivo('uid-da-maria', false))

    expect(simulado.updateDoc.mock.calls[0][0]).toEqual({
      caminho: ['businesses', 'loja-principal', 'membros', 'uid-da-maria'],
    })
  })
})
