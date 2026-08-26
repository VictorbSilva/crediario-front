import { getApp, getApps, initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

const chavesObrigatorias = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const faltando = chavesObrigatorias.filter((chave) => !import.meta.env[chave])

if (faltando.length > 0) {
  throw new Error(
    `Firebase não configurado. Faltam as variáveis: ${faltando.join(', ')}.\n` +
      'Copie .env.example para .env.local e preencha com os dados do seu projeto ' +
      'no console do Firebase (Configurações do projeto → Seus apps → Web).',
  )
}

const jaInicializado = getApps().length > 0

const app: FirebaseApp = jaInicializado
  ? getApp()
  : initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    })

function suportaPersistencia(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function criarAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
  } catch (erro) {
    console.warn('[firebase] Reaproveitando instância existente do Auth.', erro)
    return getAuth(app)
  }
}

export const auth: Auth = criarAuth()

function criarFirestore(): Firestore {
  if (!suportaPersistencia()) {
    console.warn(
      '[firebase] IndexedDB indisponível; usando cache em memória. ' +
        'O app NÃO vai funcionar offline nesta sessão.',
    )
    return initializeFirestore(app, { localCache: memoryLocalCache() })
  }

  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch (erro) {
    console.warn('[firebase] Reaproveitando instância existente do Firestore.', erro)
    return getFirestore(app)
  }
}

export const db = criarFirestore()

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  console.info('[firebase] Usando emuladores locais (Auth :9099, Firestore :8080).')
}
