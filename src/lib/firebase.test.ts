import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const simulado = vi.hoisted(() => ({
  apps: [] as unknown[],
  app: { nome: 'app' },
  auth: { nome: 'auth' },
  db: { nome: 'db' },
  initializeApp: vi.fn(),
  getApp: vi.fn(),
  initializeAuth: vi.fn(),
  getAuth: vi.fn(),
  initializeFirestore: vi.fn(),
  getFirestore: vi.fn(),
  connectAuthEmulator: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}))

vi.mock('firebase/app', () => ({
  getApps: () => simulado.apps,
  getApp: simulado.getApp,
  initializeApp: simulado.initializeApp,
}))
vi.mock('firebase/auth', () => ({
  browserLocalPersistence: 'localStorage',
  indexedDBLocalPersistence: 'indexedDB',
  initializeAuth: simulado.initializeAuth,
  getAuth: simulado.getAuth,
  connectAuthEmulator: simulado.connectAuthEmulator,
}))
vi.mock('firebase/firestore', () => ({
  initializeFirestore: simulado.initializeFirestore,
  getFirestore: simulado.getFirestore,
  memoryLocalCache: () => 'cache-em-memoria',
  persistentLocalCache: (opcoes: unknown) => ({ persistente: opcoes }),
  persistentMultipleTabManager: () => 'varias-abas',
  connectFirestoreEmulator: simulado.connectFirestoreEmulator,
}))

const CONFIG = {
  VITE_FIREBASE_API_KEY: 'chave',
  VITE_FIREBASE_AUTH_DOMAIN: 'loja.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'loja',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
}

async function carregar() {
  vi.resetModules()
  return import('./firebase')
}

beforeEach(() => {
  simulado.apps = []
  simulado.initializeApp.mockReset().mockReturnValue(simulado.app)
  simulado.getApp.mockReset().mockReturnValue(simulado.app)
  simulado.initializeAuth.mockReset().mockReturnValue(simulado.auth)
  simulado.getAuth.mockReset().mockReturnValue(simulado.auth)
  simulado.initializeFirestore.mockReset().mockReturnValue(simulado.db)
  simulado.getFirestore.mockReset().mockReturnValue(simulado.db)
  simulado.connectAuthEmulator.mockReset()
  simulado.connectFirestoreEmulator.mockReset()
  for (const [chave, valor] of Object.entries(CONFIG)) vi.stubEnv(chave, valor)
  vi.stubEnv('VITE_USE_FIREBASE_EMULATORS', '')
  vi.stubGlobal('indexedDB', {})
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('firebase — configuração', () => {
  it('sem as variáveis do projeto, falha dizendo quais faltam', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '')

    await expect(carregar()).rejects.toThrow(
      'Firebase não configurado. Faltam as variáveis: VITE_FIREBASE_API_KEY, VITE_FIREBASE_APP_ID.\n' +
        'Copie .env.example para .env.local e preencha com os dados do seu projeto ' +
        'no console do Firebase (Configurações do projeto → Seus apps → Web).',
    )
    expect(simulado.initializeApp).not.toHaveBeenCalled()
  })

  it('inicializa o app com a config da env', async () => {
    await carregar()

    expect(simulado.initializeApp).toHaveBeenCalledWith({
      apiKey: 'chave', authDomain: 'loja.firebaseapp.com', projectId: 'loja', appId: '1:2:web:3',
    })
  })

  it('reexecução do módulo (HMR) reaproveita o app já inicializado', async () => {
    simulado.apps = [simulado.app]
    await carregar()

    expect(simulado.initializeApp).not.toHaveBeenCalled()
    expect(simulado.getApp).toHaveBeenCalledTimes(1)
  })
})

describe('firebase — Auth', () => {
  it('guarda a sessão em IndexedDB primeiro, para continuar logado offline', async () => {
    const { auth } = await carregar()

    expect(auth).toBe(simulado.auth)
    expect(simulado.initializeAuth).toHaveBeenCalledWith(simulado.app, {
      persistence: ['indexedDB', 'localStorage'],
    })
  })

  it('se o Auth já foi inicializado, reaproveita com getAuth em vez de inicializar de novo', async () => {
    simulado.initializeAuth.mockImplementation(() => {
      throw new Error('already-initialized')
    })
    const { auth } = await carregar()

    expect(auth).toBe(simulado.auth)
    expect(simulado.initializeAuth).toHaveBeenCalledTimes(1)
    expect(simulado.getAuth).toHaveBeenCalledWith(simulado.app)
    expect(console.warn).toHaveBeenCalledWith('[firebase] Reaproveitando instância existente do Auth.', expect.any(Error))
  })
})

describe('firebase — Firestore', () => {
  it('com IndexedDB, usa o cache persistente com várias abas', async () => {
    const { db } = await carregar()

    expect(db).toBe(simulado.db)
    expect(simulado.initializeFirestore).toHaveBeenCalledWith(simulado.app, {
      localCache: { persistente: { tabManager: 'varias-abas' } },
    })
  })

  it.each([['ausente', undefined], ['nulo', null]])('IndexedDB %s cai para cache em memória e avisa no console', async (_caso, valor) => {
    vi.stubGlobal('indexedDB', valor)
    await carregar()

    expect(simulado.initializeFirestore).toHaveBeenCalledWith(simulado.app, {
      localCache: 'cache-em-memoria',
    })
    expect(console.warn).toHaveBeenCalledWith(
      '[firebase] IndexedDB indisponível; usando cache em memória. O app NÃO vai funcionar offline nesta sessão.',
    )
  })

  it('IndexedDB que lança ao ser tocado (armazenamento bloqueado) também cai para memória', async () => {
    vi.unstubAllGlobals()
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      await carregar()
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB')
    }

    expect(simulado.initializeFirestore).toHaveBeenCalledWith(simulado.app, {
      localCache: 'cache-em-memoria',
    })
  })

  it('se o Firestore já foi inicializado, reaproveita com getFirestore, nunca inicializa de novo', async () => {
    simulado.initializeFirestore.mockImplementation(() => {
      throw new Error('initializeFirestore() has already been called with different options')
    })
    const { db } = await carregar()

    expect(db).toBe(simulado.db)
    expect(simulado.initializeFirestore).toHaveBeenCalledTimes(1)
    expect(simulado.getFirestore).toHaveBeenCalledWith(simulado.app)
    expect(console.warn).toHaveBeenCalledWith('[firebase] Reaproveitando instância existente do Firestore.', expect.any(Error))
  })
})

describe('firebase — emuladores', () => {
  it('fora do modo emulador, não conecta em nada local', async () => {
    await carregar()

    expect(simulado.connectAuthEmulator).not.toHaveBeenCalled()
    expect(simulado.connectFirestoreEmulator).not.toHaveBeenCalled()
  })

  it('com VITE_USE_FIREBASE_EMULATORS, aponta Auth e Firestore para as portas locais', async () => {
    vi.stubEnv('VITE_USE_FIREBASE_EMULATORS', 'true')
    await carregar()

    expect(simulado.connectAuthEmulator).toHaveBeenCalledWith(simulado.auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    })
    expect(simulado.connectFirestoreEmulator).toHaveBeenCalledWith(simulado.db, '127.0.0.1', 8080)
    expect(console.info).toHaveBeenCalledWith('[firebase] Usando emuladores locais (Auth :9099, Firestore :8080).')
  })
})
