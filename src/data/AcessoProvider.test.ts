// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { PERMISSOES_DO_DONO, UID_DONO, UID_TESTE } from '@/lib/acesso'
import { AcessoProvider } from './AcessoProvider'
import { useAcesso } from './useAcesso'

// Como no `ClientesProvider.montado.test.ts`, o provider monta de verdade: o
// listener vive num efeito, e só montando dá para ver quando ele assina e cancela.

type Ouvinte = {
  referencia: unknown
  opcoes: unknown
  proximo: (instantaneo: unknown) => void
  erro: (falha: unknown) => void
  cancelar: Mock
}

const simulado = vi.hoisted(() => ({
  uid: 'funcionario-1' as string | null,
  businessId: 'loja-principal' as string | null,
  ouvintes: [] as Ouvinte[],
}))

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({
    usuario: simulado.uid === null ? null : { uid: simulado.uid },
    businessId: simulado.businessId,
  }),
}))
vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...caminho: string[]) => ({ caminho }),
  onSnapshot: (referencia: unknown, opcoes: unknown, proximo: Ouvinte['proximo'], erro: Ouvinte['erro']) => {
    const cancelar = vi.fn()
    simulado.ouvintes.push({ referencia, opcoes, proximo, erro, cancelar })
    return cancelar
  },
}))

function emitir(dados: Record<string, unknown> | undefined, fromCache = false) {
  act(() => {
    simulado.ouvintes.at(-1)?.proximo({
      exists: () => dados !== undefined,
      data: () => dados,
      metadata: { fromCache },
    })
  })
}

function montar() {
  return renderHook(() => useAcesso(), { wrapper: AcessoProvider })
}

const permissoes = { financeiro: false, caixaDoDia: true, exportar: false, cancelar: false }

beforeEach(() => {
  simulado.uid = 'funcionario-1'
  simulado.businessId = 'loja-principal'
  simulado.ouvintes = []
})

afterEach(() => {
  cleanup()
})

describe('AcessoProvider — dono', () => {
  it('o dono é liberado na hora, com todas as permissões e sem ler nada', () => {
    simulado.uid = UID_DONO
    const { result } = montar()

    expect(result.current).toEqual({ estado: 'liberado', dono: true, permissoes: PERMISSOES_DO_DONO })
    expect(simulado.ouvintes).toHaveLength(0)
  })

  it('a conta de testes é dona na loja-treino, sem ler nada', () => {
    simulado.uid = UID_TESTE
    simulado.businessId = 'loja-treino'
    const { result } = montar()

    expect(result.current).toEqual({ estado: 'liberado', dono: true, permissoes: PERMISSOES_DO_DONO })
    expect(simulado.ouvintes).toHaveLength(0)
  })

  it('a conta de testes fora da loja-treino lê o próprio membro, como qualquer conta', () => {
    simulado.uid = UID_TESTE
    const { result } = montar()

    expect(result.current).toEqual({ estado: 'carregando' })
    expect(simulado.ouvintes[0].referencia).toEqual({
      caminho: ['businesses', 'loja-principal', 'membros', UID_TESTE],
    })
  })
})

describe('AcessoProvider — membro', () => {
  it('assina o próprio documento em membros, ouvindo metadados, e começa carregando', () => {
    const { result } = montar()

    expect(simulado.ouvintes).toHaveLength(1)
    expect(simulado.ouvintes[0].referencia).toEqual({
      caminho: ['businesses', 'loja-principal', 'membros', 'funcionario-1'],
    })
    expect(simulado.ouvintes[0].opcoes).toEqual({ includeMetadataChanges: true })
    expect(result.current).toEqual({ estado: 'carregando' })
  })

  it('membro ativo é liberado com as permissões do documento, inclusive vindo do cache', () => {
    const { result } = montar()

    emitir({ ativo: true, permissoes }, true)

    expect(result.current).toEqual({ estado: 'liberado', dono: false, permissoes })
  })

  it('ausente no cache segue carregando; ausente no servidor é conta sem cadastro', () => {
    const { result } = montar()

    emitir(undefined, true)
    expect(result.current).toEqual({ estado: 'carregando' })

    emitir(undefined)
    expect(result.current).toEqual({ estado: 'sem-acesso', motivo: 'sem-cadastro' })
  })

  it('desativado enquanto o app está aberto fecha o acesso no próximo snapshot', () => {
    const { result } = montar()
    emitir({ ativo: true, permissoes })

    emitir({ ativo: false, permissoes })

    expect(result.current).toEqual({ estado: 'sem-acesso', motivo: 'desativado' })
  })

  it('erro de leitura vira sem acesso, com motivo erro', () => {
    const { result } = montar()

    act(() => simulado.ouvintes[0].erro({ code: 'permission-denied' }))

    expect(result.current).toEqual({ estado: 'sem-acesso', motivo: 'erro' })
  })

  it('trocar de empresa cancela a assinatura, volta a carregar e assina na empresa nova', () => {
    const { result, rerender } = montar()
    emitir({ ativo: true, permissoes })

    simulado.businessId = 'loja-treino'
    rerender()

    expect(simulado.ouvintes[0].cancelar).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ estado: 'carregando' })
    expect(simulado.ouvintes[1].referencia).toEqual({
      caminho: ['businesses', 'loja-treino', 'membros', 'funcionario-1'],
    })
  })

  it('desmontar cancela a assinatura', () => {
    const { unmount } = montar()

    unmount()

    expect(simulado.ouvintes[0].cancelar).toHaveBeenCalledTimes(1)
  })

  it('sem usuário ou sem empresa não assina nada e fica carregando', () => {
    simulado.uid = null
    expect(montar().result.current).toEqual({ estado: 'carregando' })
    cleanup()

    simulado.uid = 'funcionario-1'
    simulado.businessId = null
    expect(montar().result.current).toEqual({ estado: 'carregando' })

    expect(simulado.ouvintes).toHaveLength(0)
  })

  it('useAcesso fora do provider avisa em vez de devolver undefined', () => {
    expect(() => renderHook(() => useAcesso())).toThrow('useAcesso precisa estar dentro de <AcessoProvider>.')
  })
})
