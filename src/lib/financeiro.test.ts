import { describe, expect, it } from 'vitest'
import { listaDeAtrasados, parcelasRegeneradas, situacaoFinanceira } from './financeiro'
import type {
  AtrasoDoCliente,
  PagamentoParaFinanceiro,
  SituacaoFinanceira,
  VendaParaFinanceiro,
} from './financeiro'
import { gerarParcelas } from './parcelas'

const HOJE = '2026-10-14'

// 3 × R$ 100,00 com vencimento em 10/09, 10/10 e 10/11: em HOJE, as duas
// primeiras estão vencidas (34 e 4 dias) e a terceira está a vencer.
function venda(partes: Partial<VendaParaFinanceiro> = {}): VendaParaFinanceiro {
  return {
    id: 'v1',
    clientId: 'c1',
    dataVenda: '2026-08-10',
    valorTotalCentavos: 30_000,
    numeroParcelas: 3,
    diaVencimento: 10,
    versaoCalculo: 1,
    ...partes,
  }
}

function pagamento(partes: Partial<PagamentoParaFinanceiro> = {}): PagamentoParaFinanceiro {
  return {
    id: 'g1',
    clientId: 'c1',
    saleId: 'v1',
    data: '2026-10-01',
    valorCentavos: 5_000,
    ...partes,
  }
}

describe('parcelasRegeneradas', () => {
  it('devolve as parcelas de gerarParcelas, campo a campo, com o id da venda', () => {
    const original = venda({ valorTotalCentavos: 10_000, dataVenda: '2026-01-31', diaVencimento: 31 })
    const geradas = gerarParcelas(original)

    const regeneradas = parcelasRegeneradas(original)

    expect(regeneradas).toEqual(
      geradas.map((parcela) => ({ ...parcela, id: `v1#${parcela.numero}` })),
    )
    expect(regeneradas?.map((parcela) => parcela.valorCentavos)).toEqual([3333, 3333, 3334])
    expect(regeneradas?.map((parcela) => parcela.id)).toEqual(['v1#1', 'v1#2', 'v1#3'])
  })

  it('não adivinha: versão de cálculo desconhecida devolve null', () => {
    expect(parcelasRegeneradas(venda({ versaoCalculo: 2 }))).toBeNull()
  })
})

describe('situacaoFinanceira', () => {
  it('venda paga pela metade com uma parcela vencida: o vencido é o que falta dela', () => {
    const situacao = situacaoFinanceira([venda()], [pagamento({ valorCentavos: 15_000 })], HOJE)

    expect(situacao.aReceberCentavos).toBe(15_000)
    expect(situacao.vencidoCentavos).toBe(5_000)
    expect(situacao.porCliente.get('c1')).toEqual({
      clientId: 'c1',
      abertoCentavos: 15_000,
      vencidoCentavos: 5_000,
      parcelasVencidas: 1,
      atrasoDesde: '2026-10-10',
      diasDeAtraso: 4,
    })
  })

  it('soma as vendas do cliente e conta o atraso da parcela vencida mais antiga', () => {
    const situacao = situacaoFinanceira(
      [
        // 2 × R$ 100,00 com vencimento em 05/10 (vencida há 9 dias) e 05/11.
        venda({
          id: 'v2',
          dataVenda: '2026-09-25',
          valorTotalCentavos: 20_000,
          numeroParcelas: 2,
          diaVencimento: 5,
        }),
        venda(),
      ],
      [],
      HOJE,
    )

    expect(situacao.aReceberCentavos).toBe(50_000)
    expect(situacao.vencidoCentavos).toBe(30_000)
    expect(situacao.porCliente.get('c1')).toEqual({
      clientId: 'c1',
      abertoCentavos: 50_000,
      vencidoCentavos: 30_000,
      parcelasVencidas: 3,
      atrasoDesde: '2026-09-10',
      diasDeAtraso: 34,
    })
  })

  it('separa por cliente; quem só tem parcela a vencer fica sem atraso', () => {
    const situacao = situacaoFinanceira(
      [venda(), venda({ id: 'v2', clientId: 'c2', dataVenda: '2026-10-01', diaVencimento: 1 })],
      [],
      HOJE,
    )

    expect(situacao.aReceberCentavos).toBe(60_000)
    expect(situacao.vencidoCentavos).toBe(20_000)
    expect(situacao.porCliente.get('c1')?.vencidoCentavos).toBe(20_000)
    expect(situacao.porCliente.get('c2')).toEqual({
      clientId: 'c2',
      abertoCentavos: 30_000,
      vencidoCentavos: 0,
      parcelasVencidas: 0,
      atrasoDesde: null,
      diasDeAtraso: 0,
    })
  })

  it('venda cancelada atrasada fica fora do a receber, do vencido e dos clientes', () => {
    const situacao = situacaoFinanceira([venda({ cancelada: true })], [], HOJE)

    expect(situacao).toEqual({
      aReceberCentavos: 0,
      vencidoCentavos: 0,
      recebidoNoMesCentavos: 0,
      vendasNaoCalculadas: 0,
      porCliente: new Map(),
    })
  })

  it('pagamento cancelado não abate o saldo nem entra no recebido', () => {
    const situacao = situacaoFinanceira(
      [venda()],
      [
        pagamento({ id: 'g1', valorCentavos: 10_000, cancelado: true }),
        pagamento({ id: 'g2', valorCentavos: 5_000 }),
      ],
      HOJE,
    )

    expect(situacao.aReceberCentavos).toBe(25_000)
    expect(situacao.vencidoCentavos).toBe(15_000)
    expect(situacao.recebidoNoMesCentavos).toBe(5_000)
  })

  it('encargo pago não abate o principal, mas entra no recebido', () => {
    const situacao = situacaoFinanceira(
      [venda()],
      [pagamento({ valorCentavos: 12_000, encargoCentavos: 2_000 })],
      HOJE,
    )

    expect(situacao.aReceberCentavos).toBe(20_000)
    expect(situacao.vencidoCentavos).toBe(10_000)
    expect(situacao.recebidoNoMesCentavos).toBe(12_000)
  })

  it('pagamento de venda fora da lista não mexe no saldo, mas conta no recebido do mês', () => {
    const situacao = situacaoFinanceira(
      [venda()],
      [pagamento({ saleId: 'v-sumida', valorCentavos: 7_000 })],
      HOJE,
    )

    expect(situacao.aReceberCentavos).toBe(30_000)
    expect(situacao.vencidoCentavos).toBe(20_000)
    expect(situacao.recebidoNoMesCentavos).toBe(7_000)
  })

  it('pagamento de venda cancelada depois continua no recebido do mês', () => {
    const situacao = situacaoFinanceira(
      [venda({ cancelada: true })],
      [pagamento({ valorCentavos: 10_000 })],
      HOJE,
    )

    expect(situacao.aReceberCentavos).toBe(0)
    expect(situacao.recebidoNoMesCentavos).toBe(10_000)
  })

  it('venda de versão de cálculo desconhecida fica fora da conta e é contada', () => {
    const situacao = situacaoFinanceira(
      [venda({ versaoCalculo: 2 }), venda({ id: 'v2', clientId: 'c2' })],
      [pagamento({ saleId: 'v1', valorCentavos: 4_000 })],
      HOJE,
    )

    expect(situacao.vendasNaoCalculadas).toBe(1)
    expect(situacao.aReceberCentavos).toBe(30_000)
    expect(situacao.vencidoCentavos).toBe(20_000)
    expect(situacao.porCliente.has('c1')).toBe(false)
    expect(situacao.recebidoNoMesCentavos).toBe(4_000)
  })

  it('venda cancelada de versão desconhecida não entra na contagem: não falta nada na conta', () => {
    const situacao = situacaoFinanceira([venda({ versaoCalculo: 2, cancelada: true })], [], HOJE)

    expect(situacao.vendasNaoCalculadas).toBe(0)
  })

  it('recebido no mês soma só os pagamentos não cancelados com data no mês de hoje', () => {
    const situacao = situacaoFinanceira(
      [],
      [
        pagamento({ id: 'g1', data: '2026-10-01', valorCentavos: 1_000 }),
        pagamento({ id: 'g2', data: '2026-10-14', valorCentavos: 2_000 }),
        pagamento({ id: 'g3', data: '2026-09-30', valorCentavos: 4_000 }),
        pagamento({ id: 'g4', data: '2025-10-14', valorCentavos: 8_000 }),
        pagamento({ id: 'g5', data: '2026-10-14', valorCentavos: 16_000, cancelado: true }),
      ],
      HOJE,
    )

    expect(situacao.recebidoNoMesCentavos).toBe(3_000)
  })
})

describe('listaDeAtrasados', () => {
  function atraso(partes: Partial<AtrasoDoCliente> & { clientId: string }): AtrasoDoCliente {
    return {
      abertoCentavos: 10_000,
      vencidoCentavos: 5_000,
      parcelasVencidas: 1,
      atrasoDesde: '2026-10-04',
      diasDeAtraso: 10,
      ...partes,
    }
  }

  function situacao(atrasos: AtrasoDoCliente[]): SituacaoFinanceira {
    return {
      aReceberCentavos: 0,
      vencidoCentavos: 0,
      recebidoNoMesCentavos: 0,
      vendasNaoCalculadas: 0,
      porCliente: new Map(atrasos.map((item) => [item.clientId, item])),
    }
  }

  function cliente(id: string, numero: number) {
    return { id, numero, nome: `Cliente ${numero}` }
  }

  it('lista só quem tem vencido, do maior atraso para o menor, depois maior vencido e menor número', () => {
    const clientes = [cliente('c1', 3), cliente('c2', 2), cliente('c3', 4), cliente('c4', 1), cliente('c5', 5)]

    const lista = listaDeAtrasados(
      situacao([
        atraso({ clientId: 'c1', diasDeAtraso: 10, vencidoCentavos: 5_000 }),
        atraso({ clientId: 'c2', diasDeAtraso: 30, vencidoCentavos: 1_000 }),
        atraso({ clientId: 'c3', diasDeAtraso: 10, vencidoCentavos: 9_000 }),
        atraso({ clientId: 'c4', diasDeAtraso: 10, vencidoCentavos: 5_000 }),
        atraso({
          clientId: 'c5',
          vencidoCentavos: 0,
          parcelasVencidas: 0,
          atrasoDesde: null,
          diasDeAtraso: 0,
        }),
      ]),
      clientes,
    )

    expect(lista.map((item) => item.clientId)).toEqual(['c2', 'c3', 'c4', 'c1'])
    expect(lista[0]).toEqual({
      ...atraso({ clientId: 'c2', diasDeAtraso: 30, vencidoCentavos: 1_000 }),
      cliente: clientes[1],
    })
  })

  it('cliente que não está na lista vem com null, no fim', () => {
    const conhecido = cliente('c1', 1)

    const lista = listaDeAtrasados(
      situacao([
        atraso({ clientId: 'sumido-1', diasDeAtraso: 40, vencidoCentavos: 90_000 }),
        atraso({ clientId: 'c1', diasDeAtraso: 1, vencidoCentavos: 100 }),
        atraso({ clientId: 'sumido-2', diasDeAtraso: 90, vencidoCentavos: 1_000 }),
      ]),
      [conhecido],
    )

    expect(lista.map((item) => [item.clientId, item.cliente])).toEqual([
      ['c1', conhecido],
      ['sumido-2', null],
      ['sumido-1', null],
    ])
  })
})
