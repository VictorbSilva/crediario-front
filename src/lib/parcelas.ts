import { arredondarCentavos } from './dinheiro'
import { diferencaEmDias, vencimentoDaParcela } from './data'

export const VERSAO_CALCULO = 1

export type TaxasDeSimulacao = {
  multaTipo?: 'percentual' | 'fixo'
  multaPercentual?: number
  multaFixaCentavos?: number
  jurosPercentualDia?: number
}

export type PlanoDaVenda = {
  dataVenda: string
  numeroParcelas: number
  valorTotalCentavos: number
  diaVencimento: number
}

export type ParcelaGerada = {
  numero: number
  total: number
  vencimento: string
  valorCentavos: number
}

export type ParcelaConhecida = TaxasDeSimulacao & {
  id: string
  numero: number
  vencimento: string
  valorCentavos: number
}

export type PagamentoConhecido = {
  id: string
  valorCentavos: number
  encargoCentavos?: number
  cancelado?: boolean
}

export type Alocacao = {
  cobertura: Map<string, number>
  sobraCentavos: number
}

export type SituacaoParcela = 'paga' | 'vencida' | 'parcial' | 'a-vencer'

export type EstadoDaParcela = {
  situacao: SituacaoParcela
  restanteCentavos: number
  diasDeAtraso: number
}

export type Encargos = {
  multaCentavos: number
  jurosCentavos: number
}

export type ResumoDaVenda = {
  pagoCentavos: number
  abertoCentavos: number
  encargosCentavos: number
  totalComEncargosCentavos: number
  parcelasVencidas: number
  quitada: boolean
}

export function gerarParcelas(plano: PlanoDaVenda): ParcelaGerada[] {
  const { dataVenda, numeroParcelas, valorTotalCentavos, diaVencimento } = plano

  if (!Number.isSafeInteger(numeroParcelas) || numeroParcelas < 1) {
    throw new TypeError('gerarParcelas exige pelo menos uma parcela')
  }
  if (!Number.isSafeInteger(valorTotalCentavos) || valorTotalCentavos < 1) {
    throw new TypeError('gerarParcelas exige um valor total em centavos inteiros')
  }

  const base = Math.floor(valorTotalCentavos / numeroParcelas)
  const sobra = valorTotalCentavos - base * numeroParcelas

  const parcelas: ParcelaGerada[] = []
  for (let numero = 1; numero <= numeroParcelas; numero += 1) {
    parcelas.push({
      numero,
      total: numeroParcelas,
      vencimento: vencimentoDaParcela(dataVenda, numero, diaVencimento),
      valorCentavos: numero === numeroParcelas ? base + sobra : base,
    })
  }

  return parcelas
}

export function alocarPagamentos(
  parcelas: readonly ParcelaConhecida[],
  pagamentos: readonly PagamentoConhecido[],
): Alocacao {
  const ordenadas = [...parcelas].sort((a, b) =>
    a.vencimento === b.vencimento ? a.numero - b.numero : a.vencimento.localeCompare(b.vencimento),
  )

  let disponivel = pagamentos
    .filter((pagamento) => pagamento.cancelado !== true)
    .reduce(
      (soma, pagamento) =>
        soma + Math.max(pagamento.valorCentavos - (pagamento.encargoCentavos ?? 0), 0),
      0,
    )

  const cobertura = new Map<string, number>()
  for (const parcela of ordenadas) {
    const usado = Math.min(disponivel, parcela.valorCentavos)
    cobertura.set(parcela.id, usado)
    disponivel -= usado
  }

  return { cobertura, sobraCentavos: disponivel }
}

export function situacaoDaParcela(
  parcela: Pick<ParcelaConhecida, 'vencimento' | 'valorCentavos'>,
  pagoCentavos: number,
  hoje: string,
): EstadoDaParcela {
  const restanteCentavos = Math.max(parcela.valorCentavos - pagoCentavos, 0)
  const diasDeAtraso = Math.max(diferencaEmDias(parcela.vencimento, hoje), 0)

  if (restanteCentavos === 0) {
    return { situacao: 'paga', restanteCentavos: 0, diasDeAtraso: 0 }
  }
  if (diasDeAtraso > 0) {
    return { situacao: 'vencida', restanteCentavos, diasDeAtraso }
  }
  if (pagoCentavos > 0) {
    return { situacao: 'parcial', restanteCentavos, diasDeAtraso: 0 }
  }

  return { situacao: 'a-vencer', restanteCentavos, diasDeAtraso: 0 }
}

export function temTaxaPropria(parcela: TaxasDeSimulacao): boolean {
  return (
    parcela.multaTipo !== undefined ||
    parcela.multaPercentual !== undefined ||
    parcela.multaFixaCentavos !== undefined ||
    parcela.jurosPercentualDia !== undefined
  )
}

export function taxasEfetivas(
  venda: TaxasDeSimulacao,
  parcela: TaxasDeSimulacao,
): TaxasDeSimulacao {
  return temTaxaPropria(parcela) ? parcela : venda
}

export function simularEncargos(
  taxas: TaxasDeSimulacao,
  valorCentavos: number,
  diasDeAtraso: number,
): Encargos {
  if (diasDeAtraso <= 0) return { multaCentavos: 0, jurosCentavos: 0 }

  const multaCentavos =
    taxas.multaTipo === 'fixo'
      ? (taxas.multaFixaCentavos ?? 0)
      : arredondarCentavos((valorCentavos * (taxas.multaPercentual ?? 0)) / 100)

  const jurosCentavos = arredondarCentavos(
    ((valorCentavos * (taxas.jurosPercentualDia ?? 0)) / 100) * diasDeAtraso,
  )

  return { multaCentavos, jurosCentavos }
}

export function resumoDaVenda(
  parcelas: readonly ParcelaConhecida[],
  pagamentos: readonly PagamentoConhecido[],
  taxasDaVenda: TaxasDeSimulacao,
  hoje: string,
): ResumoDaVenda {
  const { cobertura } = alocarPagamentos(parcelas, pagamentos)

  let pagoCentavos = 0
  let abertoCentavos = 0
  let encargosCentavos = 0
  let parcelasVencidas = 0

  for (const parcela of parcelas) {
    const pago = cobertura.get(parcela.id) ?? 0
    const estado = situacaoDaParcela(parcela, pago, hoje)

    pagoCentavos += pago
    abertoCentavos += estado.restanteCentavos

    if (estado.situacao === 'vencida') {
      parcelasVencidas += 1
      const encargos = simularEncargos(
        taxasEfetivas(taxasDaVenda, parcela),
        estado.restanteCentavos,
        estado.diasDeAtraso,
      )
      encargosCentavos += encargos.multaCentavos + encargos.jurosCentavos
    }
  }

  return {
    pagoCentavos,
    abertoCentavos,
    encargosCentavos,
    totalComEncargosCentavos: abertoCentavos + encargosCentavos,
    parcelasVencidas,
    quitada: abertoCentavos === 0,
  }
}
