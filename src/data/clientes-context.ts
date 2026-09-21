import { createContext } from 'react'
import type { EntradaCliente } from '@/lib/cliente'
import type { ConfiancaDaLista, EstadoSync } from '@/lib/sync'
import type { Cliente } from '@/types/cliente'

export type FalhaDeEscrita = {
  id: string
  mensagem: string
  quando: Date
}

export type ClientesContextValue = {
  clientes: Cliente[]
  ativos: Cliente[]
  arquivados: Cliente[]
  carregando: boolean
  erro: string | null
  pendentes: number
  doCache: boolean
  estadoSync: EstadoSync
  confianca: ConfiancaDaLista
  falhas: FalhaDeEscrita[]
  descartarFalha: (id: string) => void
  criarCliente: (entrada: EntradaCliente) => void
  alternarArquivo: (cliente: Cliente) => void
}

export const ClientesContext = createContext<ClientesContextValue | null>(null)
