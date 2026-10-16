// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

type UsuarioSimulado = { uid: string; getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }> }

const simulado = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string } | null },
  aoMudar: null as null | ((usuario: unknown) => void),
  cancelar: vi.fn(),
  entrar: vi.fn(() => Promise.resolve()),
  recuperar: vi.fn(() => Promise.resolve()),
  sair: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/firebase', () => ({ auth: simulado.auth }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, aoMudar: (usuario: unknown) => void) => {
    simulado.aoMudar = aoMudar
    return simulado.cancelar
  },
  signInWithEmailAndPassword: simulado.entrar,
  sendPasswordResetEmail: simulado.recuperar,
  signOut: simulado.sair,
}))

const CHAVE = 'crediario:businessId:u1'

function usuario(token: () => Promise<{ claims: Record<string, unknown> }>, uid = 'u1'): UsuarioSimulado {
  return { uid, getIdTokenResult: token }
}

const comClaim = (businessId: unknown) => () => Promise.resolve({ claims: { businessId } })
const offline = () => Promise.reject(new Error('auth/network-request-failed'))

async function sessao(u: UsuarioSimulado | null) {
  simulado.auth.currentUser = u
  await act(async () => {
    simulado.aoMudar?.(u)
  })
}

function montar() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider })
}

beforeEach(() => {
  simulado.auth.currentUser = null
  simulado.aoMudar = null
  simulado.cancelar.mockClear()
  simulado.entrar.mockReset().mockReturnValue(Promise.resolve())
  simulado.recuperar.mockReset().mockReturnValue(Promise.resolve())
  simulado.sair.mockReset().mockReturnValue(Promise.resolve())
  vi.stubEnv('VITE_BUSINESS_ID', '')
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('AuthProvider — sessão', () => {
  it('não decide nada enquanto o SDK não responde', () => {
    const { result } = montar()

    expect(result.current.carregando).toBe(true)
    expect(result.current.usuario).toBeNull()
  })

  it('sem sessão salva, termina de carregar sem usuário e sem empresa', async () => {
    const { result } = montar()
    await sessao(null)

    expect(result.current.carregando).toBe(false)
    expect(result.current.usuario).toBeNull()
    expect(result.current.businessId).toBeNull()
  })

  it('a empresa vem do claim do token e fica guardada por uid', async () => {
    const { result } = montar()
    await sessao(usuario(comClaim('loja-treino')))

    expect(result.current.businessId).toBe('loja-treino')
    expect(result.current.carregando).toBe(false)
    expect(localStorage.getItem(CHAVE)).toBe('loja-treino')
  })

  it('offline, com o token sem poder renovar, usa a última empresa conhecida deste uid', async () => {
    localStorage.setItem(CHAVE, 'loja-treino')
    const { result } = montar()
    await sessao(usuario(offline))

    expect(result.current.businessId).toBe('loja-treino')
  })

  it('offline e sem memória, cai na empresa da env', async () => {
    vi.stubEnv('VITE_BUSINESS_ID', 'loja-da-env')
    const { result } = montar()
    await sessao(usuario(offline))

    expect(result.current.businessId).toBe('loja-da-env')
  })

  it('claim revogado apaga a memória, para não voltar a valer no próximo erro de rede', async () => {
    localStorage.setItem(CHAVE, 'loja-antiga')
    const { result } = montar()
    await sessao(usuario(comClaim(undefined)))

    expect(localStorage.getItem(CHAVE)).toBeNull()
    expect(result.current.businessId).toBeNull()
  })

  it('claim que não é texto não vira empresa', async () => {
    vi.stubEnv('VITE_BUSINESS_ID', 'loja-da-env')
    const { result } = montar()
    await sessao(usuario(comClaim(42)))

    expect(result.current.businessId).toBe('loja-da-env')
    expect(localStorage.getItem(CHAVE)).toBeNull()
  })

  it('sessão encerrada enquanto o token resolvia: descarta a resposta sem quebrar', async () => {
    const { result } = montar()
    simulado.auth.currentUser = null

    await act(async () => {
      simulado.aoMudar?.(usuario(comClaim('loja-treino')))
    })

    expect(result.current.businessId).toBeNull()
  })

  it('sem claim, a env vale para a sessão mas não é guardada como empresa do usuário', async () => {
    vi.stubEnv('VITE_BUSINESS_ID', 'loja-da-env')
    const { result } = montar()
    await sessao(usuario(comClaim('')))

    expect(result.current.businessId).toBe('loja-da-env')
    expect(localStorage.getItem(CHAVE)).toBeNull()
  })

  it('localStorage indisponível não impede o login', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const { result } = montar()

    await sessao(usuario(comClaim('loja-treino')))
    expect(result.current.businessId).toBe('loja-treino')

    await sessao(usuario(offline))
    expect(result.current.businessId).toBeNull()
  })

  it('resposta de uma sessão que já não é a atual é descartada', async () => {
    const { result } = montar()
    simulado.auth.currentUser = { uid: 'outro' }
    await act(async () => {
      simulado.aoMudar?.(usuario(comClaim('loja-errada')))
    })

    expect(result.current.businessId).toBeNull()
    expect(result.current.carregando).toBe(true)
  })

  it('desmontar cancela a inscrição e ignora o que chegar depois', async () => {
    const { result, unmount } = montar()
    const callback = simulado.aoMudar
    unmount()

    expect(simulado.cancelar).toHaveBeenCalledTimes(1)
    await act(async () => {
      callback?.(usuario(comClaim('loja-treino')))
    })
    expect(result.current.carregando).toBe(true)
  })

  it('useAuth fora do provider avisa em vez de devolver undefined', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => renderHook(() => useAuth())).toThrow('useAuth precisa estar dentro de <AuthProvider>.')
  })
})

describe('AuthProvider — entrar', () => {
  it('repassa e-mail e senha ao Firebase', async () => {
    const { result } = montar()
    await result.current.entrar('dono@loja.com', 'segredo')

    expect(simulado.entrar).toHaveBeenCalledWith(simulado.auth, 'dono@loja.com', 'segredo')
  })

  it.each([
    ['auth/invalid-credential', 'E-mail ou senha incorretos.'],
    ['auth/wrong-password', 'E-mail ou senha incorretos.'],
    ['auth/user-not-found', 'E-mail ou senha incorretos.'],
    ['auth/invalid-email', 'E-mail inválido.'],
    ['auth/user-disabled', 'Esta conta está desativada.'],
    ['auth/operation-not-allowed', 'Login por e-mail e senha não está ativado no projeto Firebase.'],
    ['auth/too-many-requests', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
    ['auth/network-request-failed', 'Sem conexão. É preciso estar online para entrar pela primeira vez.'],
    ['auth/api-key-not-valid.-please-pass-a-valid-api-key.', 'Configuração do Firebase inválida. Verifique as variáveis de ambiente do app.'],
    ['auth/invalid-api-key', 'Configuração do Firebase inválida. Verifique as variáveis de ambiente do app.'],
    ['auth/qualquer-outra', 'Não foi possível entrar. Tente novamente.'],
  ])('traduz %s sem vazar o código cru', async (code, mensagem) => {
    const original = Object.assign(new Error('firebase'), { code })
    simulado.entrar.mockRejectedValue(original)
    const { result } = montar()

    const erro = await result.current.entrar('a@b.c', 'x').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(Error)
    expect((erro as Error).message).toBe(mensagem)
    expect((erro as Error).cause).toBe(original)
  })

  it('erro sem código, ou com código que não é texto, cai na mensagem genérica', async () => {
    const { result } = montar()

    simulado.entrar.mockRejectedValue('texto solto')
    await expect(result.current.entrar('a@b.c', 'x')).rejects.toThrow('Não foi possível entrar. Tente novamente.')

    simulado.entrar.mockRejectedValue({ code: 42 })
    await expect(result.current.entrar('a@b.c', 'x')).rejects.toThrow('Não foi possível entrar. Tente novamente.')

    simulado.entrar.mockRejectedValue(null)
    await expect(result.current.entrar('a@b.c', 'x')).rejects.toThrow('Não foi possível entrar. Tente novamente.')
  })
})

describe('AuthProvider — recuperar senha e sair', () => {
  it('pede o link ao Firebase', async () => {
    const { result } = montar()
    await result.current.recuperarSenha('dono@loja.com')

    expect(simulado.recuperar).toHaveBeenCalledWith(simulado.auth, 'dono@loja.com')
  })

  it('e-mail sem conta não vira erro, para não revelar quem tem conta', async () => {
    simulado.recuperar.mockRejectedValue({ code: 'auth/user-not-found' })
    const { result } = montar()

    await expect(result.current.recuperarSenha('ninguem@loja.com')).resolves.toBeUndefined()
  })

  it.each([
    ['auth/invalid-email', 'E-mail inválido.'],
    ['auth/missing-email', 'Digite o e-mail para receber o link.'],
    ['auth/too-many-requests', 'Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.'],
    ['auth/network-request-failed', 'Sem conexão. É preciso estar online para pedir o link.'],
    ['auth/outra', 'Não foi possível enviar o link agora. Tente de novo em instantes.'],
  ])('traduz %s, guardando o erro original como causa', async (code, mensagem) => {
    const original = { code }
    simulado.recuperar.mockRejectedValue(original)
    const { result } = montar()

    const erro = await result.current.recuperarSenha('a@b.c').catch((e: unknown) => e)

    expect((erro as Error).message).toBe(mensagem)
    expect((erro as Error).cause).toBe(original)
  })

  it('sair encerra a sessão no Firebase', async () => {
    const { result } = montar()
    await result.current.sair()

    expect(simulado.sair).toHaveBeenCalledWith(simulado.auth)
  })
})
