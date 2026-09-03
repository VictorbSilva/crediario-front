import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-context'

function mensagemDeErro(codigo: string): string {
  if (codigo.startsWith('auth/api-key-not-valid') || codigo === 'auth/invalid-api-key') {
    return 'Configuração do Firebase inválida. Verifique as variáveis de ambiente do app.'
  }

  switch (codigo) {
    case 'auth/invalid-email':
      return 'E-mail inválido.'
    case 'auth/user-disabled':
      return 'Esta conta está desativada.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.'
    case 'auth/operation-not-allowed':
      return 'Login por e-mail e senha não está ativado no projeto Firebase.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
    case 'auth/network-request-failed':
      return 'Sem conexão. É preciso estar online para entrar pela primeira vez.'
    default:
      return 'Não foi possível entrar. Tente novamente.'
  }
}

const PREFIXO_BUSINESS = 'crediario:businessId:'

function businessIdPadrao(): string | null {
  return import.meta.env.VITE_BUSINESS_ID || null
}

function lerBusinessIdSalvo(uid: string): string | null {
  try {
    return localStorage.getItem(PREFIXO_BUSINESS + uid) || null
  } catch {
    return null
  }
}

function salvarBusinessId(uid: string, businessId: string | null): void {
  try {
    if (businessId) {
      localStorage.setItem(PREFIXO_BUSINESS + uid, businessId)
    } else {
      localStorage.removeItem(PREFIXO_BUSINESS + uid)
    }
  } catch {
    // localStorage indisponível não deve impedir o login.
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    const cancelarInscricao = onAuthStateChanged(auth, (u) => {
      void (async () => {
        if (!ativo) return
        setUsuario(u)

        if (!u) {
          setBusinessId(null)
          setCarregando(false)
          return
        }

        let bid: string | null
        try {
          const token = await u.getIdTokenResult()
          const claim = token.claims.businessId
          const doClaim = typeof claim === 'string' && claim ? claim : null

          // Só o claim é verdade sobre este usuário. A env é fallback de
          // bootstrap: cachear o valor dela como "último businessId conhecido"
          // faria o catch abaixo devolver a empresa errada para outro usuário.
          // Sem claim, a entrada é apagada — senão um claim revogado sobrevive
          // no cache e volta a valer no primeiro erro de rede.
          salvarBusinessId(u.uid, doClaim)
          bid = doClaim ?? businessIdPadrao()
        } catch {
          bid = lerBusinessIdSalvo(u.uid) ?? businessIdPadrao()
        }

        if (!ativo || auth.currentUser?.uid !== u.uid) return
        setBusinessId(bid)
        setCarregando(false)
      })()
    })

    return () => {
      ativo = false
      cancelarInscricao()
    }
  }, [])

  const valor = useMemo<AuthContextValue>(
    () => ({
      usuario,
      businessId,
      carregando,
      async entrar(email, senha) {
        try {
          await signInWithEmailAndPassword(auth, email, senha)
        } catch (erro) {
          const codigo =
            typeof erro === 'object' && erro !== null && 'code' in erro
              ? String((erro as { code: unknown }).code)
              : ''
          throw new Error(mensagemDeErro(codigo), { cause: erro })
        }
      },
      async sair() {
        await signOut(auth)
      },
    }),
    [usuario, businessId, carregando],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
