import { getApps, initializeApp } from 'firebase/app'
import {
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

  try {
    authDoCadastro = initializeAuth(app, { persistence: inMemoryPersistence })
  } catch (erro) {
    // `initializeAuth` lança na segunda chamada (o módulo recarregou, o app não):
    // `getAuth` devolve a instância que já existe. Ver docs/armadilhas.md, src/lib/firebase.ts.
    console.warn('[equipe] Reaproveitando o Auth do cadastro de funcionário.', erro)
    authDoCadastro = getAuth(app)
  }

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
