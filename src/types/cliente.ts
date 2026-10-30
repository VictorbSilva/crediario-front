import type { Timestamp } from 'firebase/firestore'

export type Cliente = {
  id: string
  numero: number
  nome: string
  nomeBusca: string
  telefone?: string
  telefoneDigits?: string
  cpf?: string
  cpfDigits?: string
  endereco?: string
  rotaId?: string | null
  diasDeVisita?: number[]
  rotaDesde?: string
  ordemPorDia?: Record<string, number>
  ordemDoDia?: { data: string; valor: number }
  ultimaMarca?: 'visitado' | 'ausente'
  ultimaMarcaEm?: string
  ultimoVisitado?: string
  visitadoAnterior?: string
  proximaCobranca?: string
  observacao?: string
  arquivado?: boolean
  cadastradoEm: string
  criadoEm: Timestamp | null
  atualizadoEm: Timestamp | null
  atualizadoPor: string
  pendente: boolean
}
