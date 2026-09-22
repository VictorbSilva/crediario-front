import type { Timestamp } from 'firebase/firestore'

export type TipoDeMulta = 'percentual' | 'fixo'

export type FormaDePagamento = 'pix' | 'dinheiro' | 'cartao'

export type Venda = {
  id: string
  clientId: string
  dataVenda: string
  valorTotalCentavos: number
  numeroParcelas: number
  valorParcelaCentavos: number
  diaVencimento: number
  multaTipo?: TipoDeMulta
  multaPercentual?: number
  multaFixaCentavos?: number
  jurosPercentualDia?: number
  observacao?: string
  versaoCalculo: number
  criadoEm: Timestamp | null
  atualizadoEm: Timestamp | null
  atualizadoPor: string
  pendente: boolean
}

export type Parcela = {
  id: string
  clientId: string
  saleId: string
  numero: number
  total: number
  vencimento: string
  valorCentavos: number
  multaTipo?: TipoDeMulta
  multaPercentual?: number
  multaFixaCentavos?: number
  jurosPercentualDia?: number
  criadoEm: Timestamp | null
  atualizadoEm: Timestamp | null
  atualizadoPor: string
  pendente: boolean
}

export type Pagamento = {
  id: string
  clientId: string
  saleId: string
  data: string
  valorCentavos: number
  encargoCentavos?: number
  forma: FormaDePagamento
  cancelado: boolean
  canceladoEm?: string
  observacao?: string
  criadoEm: Timestamp | null
  atualizadoEm: Timestamp | null
  atualizadoPor: string
  pendente: boolean
}
