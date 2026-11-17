import { arredondarCentavos } from './dinheiro'
import { diferencaEmDias, vencimentoDaParcela, vencimentoSemanal } from './data'

export const VERSAO_CALCULO = 1

/**
 * A semanal nasceu na versão 2 para o app de antes dela não a calcular como
 * mensal: lá, versão 2 é desconhecida e a venda fica fora das somas, avisada.
 */
export const VERSAO_CALCULO_SEMANAL = 2

/**
 * A primeira parcela escolhida (`primeiroVencimento`), mensal ou semanal.
 * Pelo mesmo motivo da semanal: o app de antes dela não conhece o campo e
 * calcularia a partir da `dataVenda`; com a versão 3, deixa a venda de fora.
 */
export const VERSAO_CALCULO_PRIMEIRO_VENCIMENTO = 3

export type Periodicidade = 'mensal' | 'semanal'

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
  /** Ausente é mensal, como em toda venda gravada antes da semanal. */
  periodicidade?: Periodicidade
  /** Só na versão 3. Ausente, a primeira parcela é derivada da `dataVenda`. */
  primeiroVencimento?: string
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

/**
 * A versão que este app sabe calcular para a venda: com `primeiroVencimento`,
 * só a 3; sem ele, a da periodicidade.
 */
export function versaoConhecida(venda: {
  versaoCalculo: number
  periodicidade?: Periodicidade
  primeiroVencimento?: string
}): boolean {
  const { versaoCalculo, periodicidade, primeiroVencimento } = venda

  if (primeiroVencimento !== undefined) {
    return versaoCalculo === VERSAO_CALCULO_PRIMEIRO_VENCIMENTO
  }

  return periodicidade === 'semanal'
    ? versaoCalculo === VERSAO_CALCULO_SEMANAL
    : versaoCalculo === VERSAO_CALCULO
}

function vencimentoDaParcelaNumero(plano: PlanoDaVenda, numero: number): string {
  const { dataVenda, diaVencimento, periodicidade, primeiroVencimento } = plano

  if (primeiroVencimento !== undefined) {
    return periodicidade === 'semanal'
      ? vencimentoSemanal(primeiroVencimento, numero - 1)
      : vencimentoDaParcela(primeiroVencimento, numero - 1, diaVencimento)
  }

  return periodicidade === 'semanal'
    ? vencimentoSemanal(dataVenda, numero)
    : vencimentoDaParcela(dataVenda, numero, diaVencimento)
}

export function gerarParcelas(plano: PlanoDaVenda): ParcelaGerada[] {
  const { numeroParcelas, valorTotalCentavos } = plano

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
      vencimento: vencimentoDaParcelaNumero(plano, numero),
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

export type VendaConhecida = TaxasDeSimulacao & {
  id: string
  dataVenda: string
  numeroParcelas: number
  cancelada?: boolean
}

export type ParcelaDaVenda = ParcelaConhecida & { saleId: string }

export type PagamentoDaVenda = PagamentoConhecido & { saleId: string }

export type ParcelaComEstado = {
  parcela: ParcelaDaVenda
  pagoCentavos: number
  estado: EstadoDaParcela
  encargos: Encargos
  taxaPropria: boolean
}

export type VendaComCarne<V extends VendaConhecida = VendaConhecida> = {
  venda: V
  cancelada: boolean
  /**
   * Todas as parcelas do plano chegaram neste aparelho. Com o cache parcial,
   * somar só as que chegaram pode dar "quitada" para uma venda em aberto.
   */
  completa: boolean
  parcelas: ParcelaComEstado[]
  resumo: ResumoDaVenda
}

export function montarCarne<V extends VendaConhecida>(
  vendas: readonly V[],
  parcelas: readonly ParcelaDaVenda[],
  pagamentos: readonly PagamentoDaVenda[],
  hoje: string,
): VendaComCarne<V>[] {
  const ordenadas = [...vendas].sort((a, b) =>
    a.dataVenda === b.dataVenda ? a.id.localeCompare(b.id) : b.dataVenda.localeCompare(a.dataVenda),
  )

  return ordenadas.map((venda) => {
    const cancelada = venda.cancelada === true
    const daVenda = parcelas.filter((parcela) => parcela.saleId === venda.id)
    const pagas = pagamentos.filter((pagamento) => pagamento.saleId === venda.id)
    const { cobertura } = alocarPagamentos(daVenda, pagas)

    const emOrdem = [...daVenda].sort((a, b) => a.numero - b.numero)

    const comEstado = emOrdem.map((parcela) => {
      const pagoCentavos = cobertura.get(parcela.id) ?? 0
      const estado = situacaoDaParcela(parcela, pagoCentavos, hoje)

      return {
        parcela,
        pagoCentavos,
        estado,
        encargos: simularEncargos(
          taxasEfetivas(venda, parcela),
          estado.restanteCentavos,
          estado.diasDeAtraso,
        ),
        taxaPropria: temTaxaPropria(parcela),
      }
    })

    const resumo = resumoDaVenda(daVenda, pagas, venda, hoje)
    const completa = daVenda.length >= venda.numeroParcelas

    let resumoFinal = resumo
    if (cancelada) {
      resumoFinal = {
        ...resumo,
        abertoCentavos: 0,
        encargosCentavos: 0,
        totalComEncargosCentavos: 0,
        parcelasVencidas: 0,
        quitada: false,
      }
    } else if (!completa) {
      resumoFinal = { ...resumo, quitada: false }
    }

    return {
      venda,
      cancelada,
      completa,
      parcelas: comEstado,
      resumo: resumoFinal,
    }
  })
}

export function saldoDoCliente(carnes: readonly VendaComCarne[]): ResumoDaVenda {
  return carnes.filter((carne) => !carne.cancelada).reduce<ResumoDaVenda>(
    (soma, carne) => ({
      pagoCentavos: soma.pagoCentavos + carne.resumo.pagoCentavos,
      abertoCentavos: soma.abertoCentavos + carne.resumo.abertoCentavos,
      encargosCentavos: soma.encargosCentavos + carne.resumo.encargosCentavos,
      totalComEncargosCentavos:
        soma.totalComEncargosCentavos + carne.resumo.totalComEncargosCentavos,
      parcelasVencidas: soma.parcelasVencidas + carne.resumo.parcelasVencidas,
      quitada: soma.quitada && carne.resumo.quitada,
    }),
    {
      pagoCentavos: 0,
      abertoCentavos: 0,
      encargosCentavos: 0,
      totalComEncargosCentavos: 0,
      parcelasVencidas: 0,
      quitada: true,
    },
  )
}
