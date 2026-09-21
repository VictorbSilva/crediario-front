import { useContext } from 'react'
import { ClientesContext } from './clientes-context'
import type { ClientesContextValue } from './clientes-context'

export function useClientes(): ClientesContextValue {
  const contexto = useContext(ClientesContext)
  if (!contexto) {
    throw new Error('useClientes precisa estar dentro de <ClientesProvider>.')
  }
  return contexto
}
