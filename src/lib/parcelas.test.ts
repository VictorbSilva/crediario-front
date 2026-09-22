import { describe, expect, it } from 'vitest'
import {
  alocarPagamentos,
  gerarParcelas,
  resumoDaVenda,
  simularEncargos,
  situacaoDaParcela,
  taxasEfetivas,
  temTaxaPropria,
} from './parcelas'
import type { PagamentoConhecido, ParcelaConhecida } from './parcelas'

const HOJE = '2026-09-21'

function parcela(partes: Partial<ParcelaConhecida> = {}): ParcelaConhecida {
  return { id: 'p1', numero: 1, vencimento: '2026-09-19', valorCentavos: 10000, ...partes }
}

function pagamento(partes: Partial<PagamentoConhecido> = {}): PagamentoConhecido {
  return { id: 'g1', valorCentavos: 5000, ...partes }
}

describe('gerarParcelas', () => {
  it('gera o carnê inteiro com vencimento mensal', () => {
    const parcelas = gerarParcelas({
      dataVenda: '2026-04-19',
      numeroParcelas: 3,
      valorTotalCentavos: 30000,
      diaVencimento: 19,
    })

    expect(parcelas).toEqual([
      { numero: 1, total: 3, vencimento: '2026-05-19', valorCentavos: 10000 },
      { numero: 2, total: 3, vencimento: '2026-06-19', valorCentavos: 10000 },
      { numero: 3, total: 3, vencimento: '2026-07-19', valorCentavos: 10000 },
    ])
  })

  it('soma exatamente o total, jogando a sobra na última parcela', () => {
    const parcelas = gerarParcelas({
      dataVenda: '2026-04-19',
      numeroParcelas: 3,
      valorTotalCentavos: 10000,
      diaVencimento: 19,
    })

    expect(parcelas.map((p) => p.valorCentavos)).toEqual([3333, 3333, 3334])
    expect(parcelas.reduce((soma, p) => soma + p.valorCentavos, 0)).toBe(10000)
  })

  it('encolhe o vencimento para o último dia do mês curto', () => {
    const parcelas = gerarParcelas({
      dataVenda: '2026-01-31',
      numeroParcelas: 3,
      valorTotalCentavos: 30000,
      diaVencimento: 31,
    })

    expect(parcelas.map((p) => p.vencimento)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('recusa plano impossível em vez de gerar carnê torto', () => {
    const base = { dataVenda: '2026-04-19', diaVencimento: 19 }
    expect(() => gerarParcelas({ ...base, numeroParcelas: 0, valorTotalCentavos: 100 })).toThrow()
    expect(() => gerarParcelas({ ...base, numeroParcelas: 3, valorTotalCentavos: 0 })).toThrow()
  })
})

describe('alocarPagamentos', () => {
  const carne = [
    parcela({ id: 'a', numero: 1, vencimento: '2026-07-19' }),
    parcela({ id: 'b', numero: 2, vencimento: '2026-08-19' }),
    parcela({ id: 'c', numero: 3, vencimento: '2026-09-19' }),
  ]

  it('cobre da parcela mais antiga para a mais nova', () => {
    const { cobertura } = alocarPagamentos(carne, [pagamento({ valorCentavos: 15000 })])

    expect(cobertura.get('a')).toBe(10000)
    expect(cobertura.get('b')).toBe(5000)
    expect(cobertura.get('c')).toBe(0)
  })

  it('representa o pagamento parcial que o dono descreveu', () => {
    const { cobertura } = alocarPagamentos(carne, [pagamento({ valorCentavos: 5000 })])

    expect(cobertura.get('a')).toBe(5000)
    expect(cobertura.get('b')).toBe(0)
  })

  it('soma vários pagamentos antes de distribuir', () => {
    const { cobertura } = alocarPagamentos(carne, [
      pagamento({ id: 'g1', valorCentavos: 5000 }),
      pagamento({ id: 'g2', valorCentavos: 5000 }),
      pagamento({ id: 'g3', valorCentavos: 5000 }),
    ])

    expect(cobertura.get('a')).toBe(10000)
    expect(cobertura.get('b')).toBe(5000)
  })

  it('ignora pagamento cancelado, que é o estorno do dono', () => {
    const { cobertura } = alocarPagamentos(carne, [
      pagamento({ id: 'g1', valorCentavos: 10000 }),
      pagamento({ id: 'g2', valorCentavos: 10000, cancelado: true }),
    ])

    expect(cobertura.get('a')).toBe(10000)
    expect(cobertura.get('b')).toBe(0)
  })

  it('abate só o principal, não o encargo que veio junto', () => {
    const { cobertura } = alocarPagamentos(carne, [
      pagamento({ valorCentavos: 10350, encargoCentavos: 350 }),
    ])

    expect(cobertura.get('a')).toBe(10000)
    expect(cobertura.get('b')).toBe(0)
  })

  it('devolve a sobra quando entra mais dinheiro que dívida', () => {
    const { cobertura, sobraCentavos } = alocarPagamentos(carne, [
      pagamento({ valorCentavos: 35000 }),
    ])

    expect(cobertura.get('c')).toBe(10000)
    expect(sobraCentavos).toBe(5000)
  })

  it('aloca pela ordem de vencimento, não pela ordem da lista', () => {
    const embaralhado = [carne[2], carne[0], carne[1]]
    const { cobertura } = alocarPagamentos(embaralhado, [pagamento({ valorCentavos: 10000 })])

    expect(cobertura.get('a')).toBe(10000)
    expect(cobertura.get('c')).toBe(0)
  })
})

describe('situacaoDaParcela', () => {
  it('conta atraso a partir do primeiro dia depois do vencimento', () => {
    expect(situacaoDaParcela(parcela({ vencimento: '2026-09-21' }), 0, HOJE)).toEqual({
      situacao: 'a-vencer',
      restanteCentavos: 10000,
      diasDeAtraso: 0,
    })
    expect(situacaoDaParcela(parcela({ vencimento: '2026-09-20' }), 0, HOJE).diasDeAtraso).toBe(1)
  })

  it('marca como paga só quando o valor inteiro foi coberto', () => {
    expect(situacaoDaParcela(parcela(), 10000, HOJE).situacao).toBe('paga')
    expect(situacaoDaParcela(parcela(), 12000, HOJE).situacao).toBe('paga')
  })

  it('mantém vencida a parcela coberta pela metade, contando do vencimento original', () => {
    const estado = situacaoDaParcela(parcela({ vencimento: '2026-08-19' }), 5000, HOJE)

    expect(estado).toEqual({ situacao: 'vencida', restanteCentavos: 5000, diasDeAtraso: 33 })
  })

  it('chama de parcial o que está pago pela metade e ainda não venceu', () => {
    const estado = situacaoDaParcela(parcela({ vencimento: '2026-10-19' }), 5000, HOJE)

    expect(estado.situacao).toBe('parcial')
    expect(estado.diasDeAtraso).toBe(0)
  })
})

describe('simularEncargos', () => {
  const taxas = { multaTipo: 'percentual' as const, multaPercentual: 2, jurosPercentualDia: 0.1 }

  it('fica zerado enquanto não há atraso', () => {
    expect(simularEncargos(taxas, 10000, 0)).toEqual({ multaCentavos: 0, jurosCentavos: 0 })
  })

  it('reproduz a conta que o dono vai mostrar ao cliente', () => {
    expect(simularEncargos(taxas, 10000, 15)).toEqual({ multaCentavos: 200, jurosCentavos: 150 })
  })

  it('cobra a multa uma vez só, e os juros por dia', () => {
    const quinze = simularEncargos(taxas, 10000, 15)
    const trinta = simularEncargos(taxas, 10000, 30)

    expect(trinta.multaCentavos).toBe(quinze.multaCentavos)
    expect(trinta.jurosCentavos).toBe(quinze.jurosCentavos * 2)
  })

  it('aceita multa de valor fixo', () => {
    const fixa = { multaTipo: 'fixo' as const, multaFixaCentavos: 500, jurosPercentualDia: 0.1 }

    expect(simularEncargos(fixa, 10000, 15)).toEqual({ multaCentavos: 500, jurosCentavos: 150 })
  })

  it('não cobra nada quando nenhuma taxa foi informada, que é o padrão', () => {
    expect(simularEncargos({}, 10000, 15)).toEqual({ multaCentavos: 0, jurosCentavos: 0 })
  })

  it('incide sobre a parcela, nunca sobre parcela mais multa', () => {
    const sem = simularEncargos({ jurosPercentualDia: 1 }, 10000, 10)
    const com = simularEncargos({ ...taxas, jurosPercentualDia: 1 }, 10000, 10)

    expect(com.jurosCentavos).toBe(sem.jurosCentavos)
  })
})

describe('taxasEfetivas', () => {
  const daVenda = { multaTipo: 'percentual' as const, multaPercentual: 2, jurosPercentualDia: 0.1 }

  it('usa a taxa da venda quando a parcela não tem a dela', () => {
    expect(taxasEfetivas(daVenda, parcela())).toBe(daVenda)
    expect(temTaxaPropria(parcela())).toBe(false)
  })

  it('deixa a parcela sobrepor por inteiro, inclusive para zerar os juros', () => {
    const propria = parcela({ jurosPercentualDia: 0 })

    expect(temTaxaPropria(propria)).toBe(true)
    expect(simularEncargos(taxasEfetivas(daVenda, propria), 10000, 15).jurosCentavos).toBe(0)
  })
})

describe('resumoDaVenda', () => {
  const carne = [
    parcela({ id: 'a', numero: 1, vencimento: '2026-06-19' }),
    parcela({ id: 'b', numero: 2, vencimento: '2026-07-19' }),
    parcela({ id: 'c', numero: 3, vencimento: '2026-10-19' }),
  ]
  const taxas = { multaTipo: 'percentual' as const, multaPercentual: 2, jurosPercentualDia: 0.1 }

  it('separa o que é principal do que é simulação de encargo', () => {
    const resumo = resumoDaVenda(carne, [pagamento({ valorCentavos: 10000 })], taxas, HOJE)

    expect(resumo.pagoCentavos).toBe(10000)
    expect(resumo.abertoCentavos).toBe(20000)
    expect(resumo.parcelasVencidas).toBe(1)
    expect(resumo.encargosCentavos).toBeGreaterThan(0)
    expect(resumo.totalComEncargosCentavos).toBe(
      resumo.abertoCentavos + resumo.encargosCentavos,
    )
  })

  it('não cobra encargo nenhum sem taxa configurada, que é o padrão do dono', () => {
    const resumo = resumoDaVenda(carne, [], {}, HOJE)

    expect(resumo.encargosCentavos).toBe(0)
    expect(resumo.totalComEncargosCentavos).toBe(resumo.abertoCentavos)
  })

  it('reconhece a venda quitada', () => {
    const resumo = resumoDaVenda(carne, [pagamento({ valorCentavos: 30000 })], taxas, HOJE)

    expect(resumo.quitada).toBe(true)
    expect(resumo.abertoCentavos).toBe(0)
    expect(resumo.parcelasVencidas).toBe(0)
  })

  it('simula encargo sobre o que falta, não sobre o valor cheio da parcela', () => {
    const inteira = resumoDaVenda([carne[0]], [], taxas, HOJE)
    const metade = resumoDaVenda([carne[0]], [pagamento({ valorCentavos: 5000 })], taxas, HOJE)

    expect(metade.encargosCentavos).toBeLessThan(inteira.encargosCentavos)
  })
})
