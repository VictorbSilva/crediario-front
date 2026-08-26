import { createContext } from 'react'
import type { User } from 'firebase/auth'

export type AuthContextValue = {
  usuario: User | null
  businessId: string | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
