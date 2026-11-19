import { useContext } from 'react'
import { AcessoContext } from './acesso-context'
import type { AcessoContextValue } from './acesso-context'

export function useAcesso(): AcessoContextValue {
  const contexto = useContext(AcessoContext)
  if (!contexto) {
    throw new Error('useAcesso precisa estar dentro de <AcessoProvider>.')
  }
  return contexto
}
