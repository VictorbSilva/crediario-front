import { describe, expect, it } from 'vitest'
import {
  aReceberNoMes,
  listaDeAtrasados,
  mesesDeRecebimento,
  parcelasRegeneradas,
  situacaoFinanceira,
} from './financeiro'
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

describe('aReceberNoMes', () => {
  function cliente(id: string, numero: number) {
    return { id, numero, nome: `Cliente ${numero}` }
  }

  const clientes = [cliente('c1', 2), cliente('c2', 1), cliente('c3', 3)]

  it('parcela paga some do mês', () => {
    const pagamentos = [pagamento({ valorCentavos: 20_000 })]

    expect(aReceberNoMes([venda()], pagamentos, clientes, 2026, 10, HOJE)).toEqual({
      totalCentavos: 0,
      parcelas: [],
    })
    expect(aReceberNoMes([venda()], pagamentos, clientes, 2026, 11, HOJE)).toEqual({
      totalCentavos: 10_000,
      parcelas: [
        {
          cliente: clientes[0],
          clientId: 'c1',
          saleId: 'v1',
          numero: 3,
          total: 3,
          vencimento: '2026-11-10',
          restanteCentavos: 10_000,
          situacao: 'a-vencer',
        },
      ],
    })
  })

  it('parcela paga pela metade aparece com o restante: parcial antes do vencimento, vencida depois', () => {
    const pagamentos = [pagamento({ valorCentavos: 25_000 })]

    const antes = aReceberNoMes([venda()], pagamentos, clientes, 2026, 11, HOJE)
    const depois = aReceberNoMes([venda()], pagamentos, clientes, 2026, 11, '2026-11-11')

    expect(antes.totalCentavos).toBe(5_000)
    expect(antes.parcelas.map((p) => [p.numero, p.restanteCentavos, p.situacao])).toEqual([
      [3, 5_000, 'parcial'],
    ])
    expect(depois.totalCentavos).toBe(5_000)
    expect(depois.parcelas.map((p) => [p.numero, p.restanteCentavos, p.situacao])).toEqual([
      [3, 5_000, 'vencida'],
    ])
  })

  it('pagamento cancelado não abate', () => {
    const resultado = aReceberNoMes(
      [venda()],
      [
        pagamento({ id: 'g1', valorCentavos: 20_000, cancelado: true }),
        pagamento({ id: 'g2', valorCentavos: 15_000 }),
      ],
      clientes,
      2026,
      10,
      HOJE,
    )

    expect(resultado.totalCentavos).toBe(5_000)
    expect(resultado.parcelas.map((p) => [p.numero, p.restanteCentavos, p.situacao])).toEqual([
      [2, 5_000, 'vencida'],
    ])
  })

  it('encargo pago não abate o principal', () => {
    const resultado = aReceberNoMes(
      [venda()],
      [pagamento({ valorCentavos: 12_000, encargoCentavos: 2_000 })],
      clientes,
      2026,
      10,
      HOJE,
    )

    expect(resultado.totalCentavos).toBe(10_000)
    expect(resultado.parcelas.map((p) => [p.numero, p.restanteCentavos])).toEqual([[2, 10_000]])
  })

  it('venda cancelada e venda de versão desconhecida não entram', () => {
    const resultado = aReceberNoMes(
      [venda({ cancelada: true }), venda({ id: 'v2', versaoCalculo: 2 })],
      [],
      clientes,
      2026,
      10,
      HOJE,
    )

    expect(resultado).toEqual({ totalCentavos: 0, parcelas: [] })
  })

  it('mês sem parcela devolve total zero e lista vazia', () => {
    expect(aReceberNoMes([venda()], [], clientes, 2026, 12, HOJE)).toEqual({
      totalCentavos: 0,
      parcelas: [],
    })
  })

  it('ordena por vencimento, número do cliente (sem cliente no fim) e número da parcela; total soma os restantes', () => {
    const vendas = [
      // c1 (nº 2): parcela 3 em 10/11.
      venda(),
      // cliente fora da lista: parcela 1 em 05/11.
      venda({
        id: 'v4',
        clientId: 'sumido',
        dataVenda: '2026-10-01',
        valorTotalCentavos: 6_000,
        diaVencimento: 5,
      }),
      // c2 (nº 1): 2 × R$ 15,00 em 10/10 e 10/11 — a parcela 2 cai em 10/11.
      venda({
        id: 'v5',
        clientId: 'c2',
        dataVenda: '2026-09-10',
        valorTotalCentavos: 3_000,
        numeroParcelas: 2,
      }),
      // c2 (nº 1): parcela 1 em 10/11.
      venda({ id: 'v2', clientId: 'c2', dataVenda: '2026-10-01' }),
      // c3 (nº 3): parcela 1 em 05/11.
      venda({
        id: 'v3',
        clientId: 'c3',
        dataVenda: '2026-10-01',
        valorTotalCentavos: 9_000,
        diaVencimento: 5,
      }),
    ]

    const resultado = aReceberNoMes(vendas, [], clientes, 2026, 11, HOJE)

    expect(
      resultado.parcelas.map((p) => [p.vencimento, p.saleId, p.numero, p.cliente?.numero ?? null]),
    ).toEqual([
      ['2026-11-05', 'v3', 1, 3],
      ['2026-11-05', 'v4', 1, null],
      ['2026-11-10', 'v2', 1, 1],
      ['2026-11-10', 'v5', 2, 1],
      ['2026-11-10', 'v1', 3, 2],
    ])
    expect(resultado.parcelas[1]).toMatchObject({ clientId: 'sumido', cliente: null })
    expect(resultado.totalCentavos).toBe(3_000 + 2_000 + 10_000 + 1_500 + 10_000)
  })
})

describe('mesesDeRecebimento', () => {
  it('vai do mês de hoje até o mês do último vencimento, inclusive', () => {
    // 12 parcelas com vencimento de 14/11/2026 a 14/10/2027.
    const meses = mesesDeRecebimento(
      [venda({ dataVenda: '2026-10-14', valorTotalCentavos: 120_000, numeroParcelas: 12, diaVencimento: 14 })],
      '2026-10-14',
    )

    expect(meses).toHaveLength(13)
    expect(meses[0]).toEqual({ ano: 2026, mes: 10 })
    expect(meses[2]).toEqual({ ano: 2026, mes: 12 })
    expect(meses[3]).toEqual({ ano: 2027, mes: 1 })
    expect(meses[12]).toEqual({ ano: 2027, mes: 10 })
  })

  it('venda cancelada e venda de versão desconhecida não estendem o fim', () => {
    const meses = mesesDeRecebimento(
      [
        venda({ id: 'v1' }),
        venda({ id: 'v2', numeroParcelas: 24, cancelada: true }),
        venda({ id: 'v3', numeroParcelas: 24, versaoCalculo: 2 }),
      ],
      HOJE,
    )

    expect(meses).toEqual([
      { ano: 2026, mes: 10 },
      { ano: 2026, mes: 11 },
    ])
  })

  it('atravessa a virada do ano', () => {
    // 3 parcelas com vencimento em 10/12/2026, 10/01/2027 e 10/02/2027.
    const meses = mesesDeRecebimento([venda({ dataVenda: '2026-11-10' })], '2026-12-05')

    expect(meses).toEqual([
      { ano: 2026, mes: 12 },
      { ano: 2027, mes: 1 },
      { ano: 2027, mes: 2 },
    ])
  })

  it('sem venda devolve só o mês de hoje', () => {
    expect(mesesDeRecebimento([], HOJE)).toEqual([{ ano: 2026, mes: 10 }])
  })

  it('último vencimento antes do mês de hoje devolve só o mês de hoje', () => {
    // 3 parcelas com vencimento em fev, mar e abr/2026.
    expect(mesesDeRecebimento([venda({ dataVenda: '2026-01-10' })], HOJE)).toEqual([
      { ano: 2026, mes: 10 },
    ])
  })
})

describe('ordenações que não podem depender da ordem de chegada', () => {
  const cliente = (id: string, numero: number) => ({ id, numero, nome: `Cliente ${numero}` })

  it('empate em dias e vencido desempata pelo número, chegue a lista em que ordem chegar', () => {
    const atrasos = (ids: string[]): SituacaoFinanceira => ({
      aReceberCentavos: 0, vencidoCentavos: 0, recebidoNoMesCentavos: 0, vendasNaoCalculadas: 0,
      porCliente: new Map(ids.map((clientId) => [clientId, {
        clientId, abertoCentavos: 5_000, vencidoCentavos: 5_000, parcelasVencidas: 1, atrasoDesde: '2026-10-04', diasDeAtraso: 10,
      }])),
    })
    const clientes = [cliente('a', 7), cliente('b', 3), cliente('c', 5)]

    for (const ordem of [['a', 'b', 'c'], ['c', 'b', 'a'], ['b', 'a', 'c']]) {
      expect(listaDeAtrasados(atrasos(ordem), clientes).map((item) => item.cliente?.numero)).toEqual([3, 5, 7])
    }
  })

  it('dois clientes fora do cache empatados não derrubam a lista', () => {
    const empate: SituacaoFinanceira = {
      aReceberCentavos: 0, vencidoCentavos: 0, recebidoNoMesCentavos: 0, vendasNaoCalculadas: 0,
      porCliente: new Map(['sumido-1', 'sumido-2'].map((clientId) => [clientId, {
        clientId, abertoCentavos: 1_000, vencidoCentavos: 1_000, parcelasVencidas: 1, atrasoDesde: '2026-10-01', diasDeAtraso: 13,
      }])),
    }

    expect(listaDeAtrasados(empate, []).map((item) => item.cliente)).toEqual([null, null])
  })

  it('a receber no mês sai na mesma ordem com as vendas em qualquer ordem', () => {
    const clientes = [cliente('c1', 2), cliente('c2', 1), cliente('c3', 3)]
    const vendas = [
      venda(),
      venda({ id: 'v4', clientId: 'sumido', dataVenda: '2026-10-01', valorTotalCentavos: 6_000, diaVencimento: 5 }),
      venda({ id: 'v5', clientId: 'c2', dataVenda: '2026-09-10', valorTotalCentavos: 3_000, numeroParcelas: 2 }),
      venda({ id: 'v2', clientId: 'c2', dataVenda: '2026-10-01' }),
      venda({ id: 'v3', clientId: 'c3', dataVenda: '2026-10-01', valorTotalCentavos: 9_000, diaVencimento: 5 }),
    ]
    const esperado = [['v3', 1], ['v4', 1], ['v2', 1], ['v5', 2], ['v1', 3]]

    for (const ordem of [vendas, [...vendas].reverse(), [vendas[1], vendas[4], vendas[0], vendas[3], vendas[2]]]) {
      expect(aReceberNoMes(ordem, [], clientes, 2026, 11, HOJE).parcelas.map((p) => [p.saleId, p.numero])).toEqual(esperado)
    }
  })

  it('o último mês do seletor é o do maior vencimento, mesmo com a venda longa chegando primeiro', () => {
    const longa = venda({ id: 'longa', dataVenda: '2026-10-01', numeroParcelas: 6 })
    const curta = venda({ id: 'curta', dataVenda: '2026-10-01', numeroParcelas: 1 })

    for (const vendas of [[longa, curta], [curta, longa]]) {
      expect(mesesDeRecebimento(vendas, HOJE).at(-1)).toEqual({ ano: 2027, mes: 4 })
    }
  })
})

describe('desempates que só aparecem quando os critérios discordam', () => {
  const cliente = (id: string, numero: number) => ({ id, numero, nome: `Cliente ${numero}` })

  it('na mesma data, vale o número do cliente, não o número da parcela', () => {
    // c1 (nº 2) tem a parcela 1 em 10/11; c2 (nº 1) tem a parcela 3 na mesma data.
    const vendas = [
      venda({ id: 'de-c1', clientId: 'c1', dataVenda: '2026-10-01', numeroParcelas: 1, valorTotalCentavos: 1_000 }),
      venda({ id: 'de-c2', clientId: 'c2', dataVenda: '2026-08-01', numeroParcelas: 3 }),
    ]
    const clientes = [cliente('c1', 2), cliente('c2', 1)]

    for (const ordem of [vendas, [...vendas].reverse()]) {
      expect(aReceberNoMes(ordem, [], clientes, 2026, 11, HOJE).parcelas.map((p) => [p.saleId, p.numero])).toEqual([
        ['de-c2', 3], ['de-c1', 1],
      ])
    }
  })

  it('na mesma data, cliente fora do cache vai para o fim mesmo com parcela de número menor', () => {
    const vendas = [
      venda({ id: 'sumida', clientId: 'sumido', dataVenda: '2026-10-01', numeroParcelas: 1, valorTotalCentavos: 1_000 }),
      venda({ id: 'conhecida', clientId: 'c1', dataVenda: '2026-08-01', numeroParcelas: 3 }),
    ]

    for (const ordem of [vendas, [...vendas].reverse()]) {
      expect(aReceberNoMes(ordem, [], [cliente('c1', 1)], 2026, 11, HOJE).parcelas.map((p) => p.saleId)).toEqual([
        'conhecida', 'sumida',
      ])
    }
  })
})
