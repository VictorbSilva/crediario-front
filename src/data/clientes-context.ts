import { createContext } from 'react'
import type { EntradaCliente } from '@/lib/cliente'
import type { Reordenacao } from '@/lib/rotas'
import type { ConfiancaDaLista, EstadoSync } from '@/lib/sync'
import type { Cliente } from '@/types/cliente'

export type FalhaDeEscrita = {
  id: string
  mensagem: string
  quando: Date
}

export type AcaoNaRota = 'visitado' | 'ausente' | 'desmarcar'

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
  editarCliente: (cliente: Cliente, entrada: EntradaCliente) => boolean
  alternarArquivo: (cliente: Cliente) => void
  marcarNaRota: (cliente: Cliente, acao: AcaoNaRota) => void
  reordenarRota: (reordenacoes: Reordenacao[]) => void
}

export const ClientesContext = createContext<ClientesContextValue | null>(null)
