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
  observacao?: string
  arquivado?: boolean
  cadastradoEm: string
  criadoEm: Timestamp | null
  atualizadoEm: Timestamp | null
  atualizadoPor: string
  pendente: boolean
}
