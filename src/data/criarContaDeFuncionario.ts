import { getApps, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  signOut,
} from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { configuracaoFirebase } from '@/lib/firebase'

const NOME_DO_APP = 'cadastro-de-funcionario'

let authDoCadastro: Auth | null = null

/**
 * Uma segunda instância do app, só para criar contas. `createUserWithEmailAndPassword`
 * entra na conta que cria: na instância principal, o dono sairia da própria conta.
 * A persistência em memória impede que a sessão do funcionário fique salva no aparelho.
 */
function obterAuthDoCadastro(): Auth {
  if (authDoCadastro) return authDoCadastro

  const app =
    getApps().find((existente) => existente.name === NOME_DO_APP) ??
    initializeApp(configuracaoFirebase, NOME_DO_APP)

  let novo: Auth
  try {
    novo = initializeAuth(app, { persistence: inMemoryPersistence })
  } catch (erro) {
    // `initializeAuth` lança na segunda chamada (o módulo recarregou, o app não):
    // `getAuth` devolve a instância que já existe, e que já foi conectada ao emulador
    // quando nasceu. Ver docs/armadilhas.md, src/lib/firebase.ts.
    console.warn('[equipe] Reaproveitando o Auth do cadastro de funcionário.', erro)
    authDoCadastro = getAuth(app)
    return authDoCadastro
  }

  // A mesma condição e o mesmo endereço de src/lib/firebase.ts. Sem isto, com
  // `npm run emu`, a conta iria para o Auth de verdade e o membro só para o emulador.
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(novo, 'http://127.0.0.1:9099', { disableWarnings: true })
  }

  authDoCadastro = novo
  return authDoCadastro
}

/**
 * Cria a conta e devolve o uid. Exige internet e é a única operação do app que
 * espera o servidor: sem o uid não há onde gravar o membro.
 */
export async function criarContaDeFuncionario(email: string, senha: string): Promise<string> {
  const auth = obterAuthDoCadastro()

  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, senha)
    return user.uid
  } finally {
    // Falhar ao sair não pode esconder a conta criada: sem o uid, ela fica sem membro.
    await signOut(auth).catch((erro: unknown) => {
      console.warn('[equipe] Não foi possível sair da conta recém-criada.', erro)
    })
  }
}
