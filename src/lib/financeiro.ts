import { VERSAO_CALCULO, alocarPagamentos, gerarParcelas, situacaoDaParcela } from './parcelas'
import type { ParcelaGerada } from './parcelas'

export type VendaParaFinanceiro = {
  id: string
  clientId: string
  dataVenda: string
  valorTotalCentavos: number
  numeroParcelas: number
  diaVencimento: number
  versaoCalculo: number
  cancelada?: boolean
}

export type PagamentoParaFinanceiro = {
  id: string
  clientId: string
  saleId: string
  data: string
  valorCentavos: number
  encargoCentavos?: number
  cancelado?: boolean
}

export type ParcelaRegenerada = ParcelaGerada & { id: string }

export function parcelasRegeneradas(venda: VendaParaFinanceiro): ParcelaRegenerada[] | null {
  if (venda.versaoCalculo !== VERSAO_CALCULO) return null

  return gerarParcelas(venda).map((parcela) => ({ ...parcela, id: `${venda.id}#${parcela.numero}` }))
}

export type AtrasoDoCliente = {
  clientId: string
  abertoCentavos: number
  vencidoCentavos: number
  parcelasVencidas: number
  atrasoDesde: string | null
  diasDeAtraso: number
}

export type SituacaoFinanceira = {
  aReceberCentavos: number
  vencidoCentavos: number
  recebidoNoMesCentavos: number
  vendasNaoCalculadas: number
  porCliente: Map<string, AtrasoDoCliente>
}

export function situacaoFinanceira(
  vendas: readonly VendaParaFinanceiro[],
  pagamentos: readonly PagamentoParaFinanceiro[],
  hoje: string,
): SituacaoFinanceira {
  const mesDeHoje = hoje.slice(0, 7)
  let recebidoNoMesCentavos = 0
  const pagamentosPorVenda = new Map<string, PagamentoParaFinanceiro[]>()

  for (const pagamento of pagamentos) {
    if (pagamento.cancelado !== true && pagamento.data.slice(0, 7) === mesDeHoje) {
      recebidoNoMesCentavos += pagamento.valorCentavos
    }

    const daVenda = pagamentosPorVenda.get(pagamento.saleId)
    if (daVenda) daVenda.push(pagamento)
    else pagamentosPorVenda.set(pagamento.saleId, [pagamento])
  }

  let aReceberCentavos = 0
  let vencidoCentavos = 0
  let vendasNaoCalculadas = 0
  const porCliente = new Map<string, AtrasoDoCliente>()

  for (const venda of vendas) {
    if (venda.cancelada === true) continue

    const parcelas = parcelasRegeneradas(venda)
    if (parcelas === null) {
      vendasNaoCalculadas += 1
      continue
    }

    const { cobertura } = alocarPagamentos(parcelas, pagamentosPorVenda.get(venda.id) ?? [])

    let atraso = porCliente.get(venda.clientId)
    if (!atraso) {
      atraso = {
        clientId: venda.clientId,
        abertoCentavos: 0,
        vencidoCentavos: 0,
        parcelasVencidas: 0,
        atrasoDesde: null,
        diasDeAtraso: 0,
      }
      porCliente.set(venda.clientId, atraso)
    }

    for (const parcela of parcelas) {
      const estado = situacaoDaParcela(parcela, cobertura.get(parcela.id) ?? 0, hoje)

      aReceberCentavos += estado.restanteCentavos
      atraso.abertoCentavos += estado.restanteCentavos

      if (estado.situacao === 'vencida') {
        vencidoCentavos += estado.restanteCentavos
        atraso.vencidoCentavos += estado.restanteCentavos
        atraso.parcelasVencidas += 1
        if (atraso.atrasoDesde === null || parcela.vencimento < atraso.atrasoDesde) {
          atraso.atrasoDesde = parcela.vencimento
        }
        atraso.diasDeAtraso = Math.max(atraso.diasDeAtraso, estado.diasDeAtraso)
      }
    }
  }

  return {
    aReceberCentavos,
    vencidoCentavos,
    recebidoNoMesCentavos,
    vendasNaoCalculadas,
    porCliente,
  }
}

export function listaDeAtrasados<
  C extends { id: string; numero: number; nome: string; arquivado?: boolean },
>(
  situacao: SituacaoFinanceira,
  clientes: readonly C[],
): Array<AtrasoDoCliente & { cliente: C | null }> {
  const porId = new Map(clientes.map((cliente) => [cliente.id, cliente]))

  return [...situacao.porCliente.values()]
    .filter((atraso) => atraso.vencidoCentavos > 0)
    .map((atraso) => ({ ...atraso, cliente: porId.get(atraso.clientId) ?? null }))
    .sort((a, b) => {
      if ((a.cliente === null) !== (b.cliente === null)) return a.cliente === null ? 1 : -1
      if (a.diasDeAtraso !== b.diasDeAtraso) return b.diasDeAtraso - a.diasDeAtraso
      if (a.vencidoCentavos !== b.vencidoCentavos) return b.vencidoCentavos - a.vencidoCentavos
      return (a.cliente?.numero ?? 0) - (b.cliente?.numero ?? 0)
    })
}

export type ParcelaAReceber<C> = {
  cliente: C | null
  clientId: string
  saleId: string
  numero: number
  total: number
  vencimento: string
  restanteCentavos: number
  situacao: 'vencida' | 'parcial' | 'a-vencer'
}

function chaveDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`
}

export function aReceberNoMes<
  C extends { id: string; numero: number; nome: string; arquivado?: boolean },
>(
  vendas: readonly VendaParaFinanceiro[],
  pagamentos: readonly PagamentoParaFinanceiro[],
  clientes: readonly C[],
  ano: number,
  mes: number,
  hoje: string,
): { totalCentavos: number; parcelas: ParcelaAReceber<C>[] } {
  const chave = chaveDoMes(ano, mes)
  const porId = new Map(clientes.map((cliente) => [cliente.id, cliente]))
  const pagamentosPorVenda = new Map<string, PagamentoParaFinanceiro[]>()

  for (const pagamento of pagamentos) {
    const daVenda = pagamentosPorVenda.get(pagamento.saleId)
    if (daVenda) daVenda.push(pagamento)
    else pagamentosPorVenda.set(pagamento.saleId, [pagamento])
  }

  let totalCentavos = 0
  const parcelas: ParcelaAReceber<C>[] = []

  for (const venda of vendas) {
    if (venda.cancelada === true) continue

    const regeneradas = parcelasRegeneradas(venda)
    if (regeneradas === null) continue

    const { cobertura } = alocarPagamentos(regeneradas, pagamentosPorVenda.get(venda.id) ?? [])

    for (const parcela of regeneradas) {
      if (parcela.vencimento.slice(0, 7) !== chave) continue

      const estado = situacaoDaParcela(parcela, cobertura.get(parcela.id) ?? 0, hoje)
      if (estado.situacao === 'paga') continue

      totalCentavos += estado.restanteCentavos
      parcelas.push({
        cliente: porId.get(venda.clientId) ?? null,
        clientId: venda.clientId,
        saleId: venda.id,
        numero: parcela.numero,
        total: parcela.total,
        vencimento: parcela.vencimento,
        restanteCentavos: estado.restanteCentavos,
        situacao: estado.situacao,
      })
    }
  }

  parcelas.sort((a, b) => {
    if (a.vencimento !== b.vencimento) return a.vencimento.localeCompare(b.vencimento)
    if ((a.cliente === null) !== (b.cliente === null)) return a.cliente === null ? 1 : -1
    if (a.cliente !== null && b.cliente !== null && a.cliente.numero !== b.cliente.numero) {
      return a.cliente.numero - b.cliente.numero
    }
    return a.numero - b.numero
  })

  return { totalCentavos, parcelas }
}

export function mesesDeRecebimento(
  vendas: readonly VendaParaFinanceiro[],
  hoje: string,
): { ano: number; mes: number }[] {
  const [anoDeHoje, mesDeHoje] = hoje.split('-').map(Number)

  let ultimoVencimento: string | null = null
  for (const venda of vendas) {
    if (venda.cancelada === true) continue

    const regeneradas = parcelasRegeneradas(venda)
    if (regeneradas === null) continue

    for (const parcela of regeneradas) {
      if (ultimoVencimento === null || parcela.vencimento > ultimoVencimento) {
        ultimoVencimento = parcela.vencimento
      }
    }
  }

  const meses = [{ ano: anoDeHoje, mes: mesDeHoje }]
  if (ultimoVencimento === null) return meses

  const fim = ultimoVencimento.slice(0, 7)
  let { ano, mes } = meses[0]
  for (;;) {
    mes = mes === 12 ? 1 : mes + 1
    if (mes === 1) ano += 1
    if (chaveDoMes(ano, mes) > fim) break
    meses.push({ ano, mes })
  }

  return meses
}
