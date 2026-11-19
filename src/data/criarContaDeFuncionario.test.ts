import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const simulado = vi.hoisted(() => ({
  apps: [] as { name: string }[],
  appDoCadastro: { name: 'cadastro-de-funcionario' },
  authDoCadastro: { nome: 'auth-do-cadastro' },
  initializeApp: vi.fn(),
  initializeAuth: vi.fn(),
  getAuth: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

const CONFIGURACAO = {
  apiKey: 'chave',
  authDomain: 'loja.firebaseapp.com',
  projectId: 'loja',
  appId: '1:2:web:3',
}

vi.mock('@/lib/firebase', () => ({ configuracaoFirebase: CONFIGURACAO }))
vi.mock('firebase/app', () => ({
  getApps: () => simulado.apps,
  initializeApp: simulado.initializeApp,
}))
vi.mock('firebase/auth', () => ({
  inMemoryPersistence: 'em-memoria',
  initializeAuth: simulado.initializeAuth,
  getAuth: simulado.getAuth,
  createUserWithEmailAndPassword: simulado.createUserWithEmailAndPassword,
  signOut: simulado.signOut,
}))

// O módulo guarda o Auth secundário: cada teste precisa de uma cópia nova.
async function carregar() {
  vi.resetModules()
  return import('./criarContaDeFuncionario')
}

beforeEach(() => {
  simulado.apps = [{ name: '[DEFAULT]' }]
  simulado.initializeApp.mockReset().mockImplementation((_config: unknown, nome: string) => {
    const app = { name: nome }
    simulado.apps.push(app)
    return app
  })
  simulado.initializeAuth.mockReset().mockReturnValue(simulado.authDoCadastro)
  simulado.getAuth.mockReset().mockReturnValue(simulado.authDoCadastro)
  simulado.createUserWithEmailAndPassword
    .mockReset()
    .mockResolvedValue({ user: { uid: 'uid-da-maria' } })
  simulado.signOut.mockReset().mockResolvedValue(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('criarContaDeFuncionario', () => {
  it('cria a conta numa segunda instância, em memória, e devolve o uid', async () => {
    const { criarContaDeFuncionario } = await carregar()

    await expect(criarContaDeFuncionario('maria@loja.com', 'segredo')).resolves.toBe('uid-da-maria')

    expect(simulado.initializeApp).toHaveBeenCalledExactlyOnceWith(
      CONFIGURACAO,
      'cadastro-de-funcionario',
    )
    const app = simulado.initializeApp.mock.results[0].value
    expect(simulado.initializeAuth).toHaveBeenCalledExactlyOnceWith(app, {
      persistence: 'em-memoria',
    })
    expect(simulado.createUserWithEmailAndPassword).toHaveBeenCalledExactlyOnceWith(
      simulado.authDoCadastro,
      'maria@loja.com',
      'segredo',
    )
  })

  it('sai da conta criada no fim, na instância secundária', async () => {
    const { criarContaDeFuncionario } = await carregar()

    await criarContaDeFuncionario('maria@loja.com', 'segredo')

    expect(simulado.signOut).toHaveBeenCalledExactlyOnceWith(simulado.authDoCadastro)
    expect(simulado.signOut.mock.invocationCallOrder[0]).toBeGreaterThan(
      simulado.createUserWithEmailAndPassword.mock.invocationCallOrder[0],
    )
  })

  it('o segundo cadastro reaproveita o app e o Auth, sem inicializar de novo', async () => {
    const { criarContaDeFuncionario } = await carregar()

    await criarContaDeFuncionario('maria@loja.com', 'segredo')
    simulado.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'uid-do-joao' } })
    await expect(criarContaDeFuncionario('joao@loja.com', 'segredo')).resolves.toBe('uid-do-joao')

    expect(simulado.initializeApp).toHaveBeenCalledTimes(1)
    expect(simulado.initializeAuth).toHaveBeenCalledTimes(1)
    expect(simulado.createUserWithEmailAndPassword).toHaveBeenLastCalledWith(
      simulado.authDoCadastro,
      'joao@loja.com',
      'segredo',
    )
  })

  it('reaproveita a instância secundária que já existir, sem criar outra', async () => {
    simulado.apps.push(simulado.appDoCadastro)
    const { criarContaDeFuncionario } = await carregar()

    await criarContaDeFuncionario('maria@loja.com', 'segredo')

    expect(simulado.initializeApp).not.toHaveBeenCalled()
    expect(simulado.initializeAuth).toHaveBeenCalledExactlyOnceWith(simulado.appDoCadastro, {
      persistence: 'em-memoria',
    })
  })

  it('o app principal sozinho não conta como instância secundária', async () => {
    simulado.apps = [{ name: '[DEFAULT]' }]
    const { criarContaDeFuncionario } = await carregar()

    await criarContaDeFuncionario('maria@loja.com', 'segredo')

    expect(simulado.initializeApp).toHaveBeenCalledTimes(1)
  })

  it('Auth já inicializado nesse app (módulo recarregado) cai para getAuth em vez de lançar', async () => {
    simulado.apps.push(simulado.appDoCadastro)
    simulado.initializeAuth.mockImplementation(() => {
      throw new Error('auth/already-initialized')
    })
    const { criarContaDeFuncionario } = await carregar()

    await expect(criarContaDeFuncionario('maria@loja.com', 'segredo')).resolves.toBe('uid-da-maria')

    expect(simulado.getAuth).toHaveBeenCalledExactlyOnceWith(simulado.appDoCadastro)
    expect(simulado.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      simulado.authDoCadastro,
      'maria@loja.com',
      'segredo',
    )
  })

  it('falha ao criar devolve o erro do SDK e ainda assim sai da instância', async () => {
    const recusa = Object.assign(new Error('Firebase: Error'), { code: 'auth/email-already-in-use' })
    simulado.createUserWithEmailAndPassword.mockRejectedValue(recusa)
    const { criarContaDeFuncionario } = await carregar()

    await expect(criarContaDeFuncionario('maria@loja.com', 'segredo')).rejects.toBe(recusa)

    expect(simulado.signOut).toHaveBeenCalledExactlyOnceWith(simulado.authDoCadastro)
  })

  it('falha ao sair não esconde a conta que foi criada', async () => {
    simulado.signOut.mockRejectedValue(new Error('falhou ao sair'))
    const { criarContaDeFuncionario } = await carregar()

    await expect(criarContaDeFuncionario('maria@loja.com', 'segredo')).resolves.toBe('uid-da-maria')

    expect(console.warn).toHaveBeenCalledOnce()
  })
})
