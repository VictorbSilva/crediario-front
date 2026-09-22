import { describe, expect, it } from 'vitest'
import {
  avisoDeValorAlto,
  entradaPagamentoVazia,
  entradaVendaVazia,
  formatarParaCampo,
  montarCamposPagamento,
  montarCamposVenda,
  parseInteiro,
  parseTaxa,
  validarPagamento,
  validarVenda,
} from './venda'
import type { EntradaPagamento, EntradaVenda } from './venda'

const CONTEXTO = { agora: new Date(2026, 8, 22), dispositivo: 'ab12cd34' }

function venda(extras: Partial<EntradaVenda> = {}): EntradaVenda {
  return {
    ...entradaVendaVazia(new Date(2026, 8, 22)),
    valor: '300,00',
    numeroParcelas: '3',
    diaVencimento: '10',
    ...extras,
  }
}

function pagamento(extras: Partial<EntradaPagamento> = {}): EntradaPagamento {
  return { data: '2026-09-22', valor: '100,00', forma: 'dinheiro', observacao: '', ...extras }
}

describe('parseInteiro', () => {
  it('aceita inteiro limpo', () => {
    expect(parseInteiro(' 12 ')).toBe(12)
  })

  it('recusa lixo à direita, que é onde parseInt falharia calado', () => {
    expect(parseInteiro('12x')).toBeNull()
    expect(parseInteiro('3,5')).toBeNull()
  })

  it('recusa negativo e vazio', () => {
    expect(parseInteiro('-3')).toBeNull()
    expect(parseInteiro('')).toBeNull()
  })
})

describe('parseTaxa', () => {
  it('vírgula e ponto são a mesma taxa', () => {
    expect(parseTaxa('0,1')).toBe(0.1)
    expect(parseTaxa('0.1')).toBe(0.1)
  })

  it('aceita o símbolo de percentual que o dono provavelmente digita', () => {
    expect(parseTaxa('2%')).toBe(2)
  })

  it('campo vazio é taxa zero, não erro', () => {
    expect(parseTaxa('')).toBe(0)
  })

  it('recusa o que não é número', () => {
    expect(parseTaxa('dois')).toBeNull()
    expect(parseTaxa('1,2,3')).toBeNull()
  })
})

describe('validarVenda', () => {
  it('a venda mínima passa', () => {
    expect(validarVenda(venda())).toEqual({})
  })

  it('cobra valor e parcelas', () => {
    const erros = validarVenda(venda({ valor: '', numeroParcelas: '' }))

    expect(erros.valor).toBeDefined()
    expect(erros.numeroParcelas).toBeDefined()
  })

  it('recusa valor zero', () => {
    expect(validarVenda(venda({ valor: '0,00' })).valor).toBeDefined()
  })

  it('recusa acima de 120 parcelas, que é o teto da regra do Firestore', () => {
    expect(validarVenda(venda({ numeroParcelas: '121' })).numeroParcelas).toBeDefined()
    expect(validarVenda(venda({ numeroParcelas: '120' })).numeroParcelas).toBeUndefined()
  })

  it('recusa parcelas demais para o valor — a regra exige parcela > 0 centavos', () => {
    // R$ 0,03 em 12 parcelas daria onze parcelas de zero centavo, que o
    // Firestore recusaria só na sincronização.
    expect(validarVenda(venda({ valor: '0,03', numeroParcelas: '12' })).numeroParcelas).toBeDefined()
    expect(validarVenda(venda({ valor: '0,03', numeroParcelas: '3' })).numeroParcelas).toBeUndefined()
  })

  it('recusa dia de vencimento fora de 1..31', () => {
    expect(validarVenda(venda({ diaVencimento: '0' })).diaVencimento).toBeDefined()
    expect(validarVenda(venda({ diaVencimento: '32' })).diaVencimento).toBeDefined()
  })

  it('recusa data que não existe no calendário', () => {
    expect(validarVenda(venda({ dataVenda: '2026-02-31' })).dataVenda).toBeDefined()
  })

  it('não valida taxa nenhuma enquanto o dono não liga as taxas', () => {
    const erros = validarVenda(venda({ cobrarTaxas: false, jurosPercentualDia: 'dois' }))

    expect(erros.jurosPercentualDia).toBeUndefined()
  })

  it('com taxas ligadas, recusa juros inválido', () => {
    const erros = validarVenda(venda({ cobrarTaxas: true, jurosPercentualDia: 'dois' }))

    expect(erros.jurosPercentualDia).toBeDefined()
  })

  it('taxa acima de 100% é recusada, como na regra', () => {
    const erros = validarVenda(
      venda({ cobrarTaxas: true, multaTipo: 'percentual', multaPercentual: '101' }),
    )

    expect(erros.multaPercentual).toBeDefined()
  })
})

describe('montarCamposVenda', () => {
  it('grava entradas e saídas, e carimba a versão do cálculo', () => {
    const { venda: v, parcelas } = montarCamposVenda('c1', venda(), CONTEXTO)

    expect(v.valorTotalCentavos).toBe(30_000)
    expect(v.numeroParcelas).toBe(3)
    expect(v.versaoCalculo).toBeGreaterThan(0)
    expect(parcelas).toHaveLength(3)
  })

  it('a sobra da divisão vai para a última parcela', () => {
    const { parcelas } = montarCamposVenda('c1', venda({ valor: '100,00' }), CONTEXTO)

    expect(parcelas.map((p) => p.valorCentavos)).toEqual([3_333, 3_333, 3_334])
  })

  it('valorParcelaCentavos é a parcela comum, não a última com a sobra', () => {
    const { venda: v } = montarCamposVenda('c1', venda({ valor: '100,00' }), CONTEXTO)

    expect(v.valorParcelaCentavos).toBe(3_333)
  })

  it('a primeira parcela cai no mês seguinte ao da venda', () => {
    const { parcelas } = montarCamposVenda(
      'c1',
      venda({ dataVenda: '2026-09-22', diaVencimento: '10' }),
      CONTEXTO,
    )

    expect(parcelas[0].vencimento).toBe('2026-10-10')
    expect(parcelas[2].vencimento).toBe('2026-12-10')
  })

  it('dia 31 encolhe para o último dia dos meses curtos', () => {
    const { parcelas } = montarCamposVenda(
      'c1',
      venda({ dataVenda: '2026-01-15', numeroParcelas: '2', diaVencimento: '31' }),
      CONTEXTO,
    )

    expect(parcelas[0].vencimento).toBe('2026-02-28')
    expect(parcelas[1].vencimento).toBe('2026-03-31')
  })

  it('sem taxas ligadas, nenhum campo de taxa é gravado', () => {
    const { venda: v } = montarCamposVenda('c1', venda({ cobrarTaxas: false }), CONTEXTO)

    expect('multaTipo' in v).toBe(false)
    expect('multaPercentual' in v).toBe(false)
    expect('jurosPercentualDia' in v).toBe(false)
  })

  it('multa fixa não grava percentual, e vice-versa', () => {
    const fixa = montarCamposVenda(
      'c1',
      venda({ cobrarTaxas: true, multaTipo: 'fixo', multaFixa: '5,00' }),
      CONTEXTO,
    ).venda

    expect(fixa.multaFixaCentavos).toBe(500)
    expect('multaPercentual' in fixa).toBe(false)

    const pct = montarCamposVenda(
      'c1',
      venda({ cobrarTaxas: true, multaTipo: 'percentual', multaPercentual: '2' }),
      CONTEXTO,
    ).venda

    expect(pct.multaPercentual).toBe(2)
    expect('multaFixaCentavos' in pct).toBe(false)
  })

  it('observação em branco não vira campo vazio no documento', () => {
    const { venda: v } = montarCamposVenda('c1', venda({ observacao: '   ' }), CONTEXTO)

    expect('observacao' in v).toBe(false)
  })

  it('a soma das parcelas fecha com o total, sempre', () => {
    for (const total of ['100,00', '300,00', '999,99', '1.234,56']) {
      for (const n of ['1', '3', '7', '12']) {
        const { venda: v, parcelas } = montarCamposVenda(
          'c1',
          venda({ valor: total, numeroParcelas: n }),
          CONTEXTO,
        )
        const soma = parcelas.reduce((acc, p) => acc + p.valorCentavos, 0)

        expect(soma).toBe(v.valorTotalCentavos)
      }
    }
  })

  it('recusa montar o que a validação recusaria', () => {
    expect(() => montarCamposVenda('c1', venda({ valor: '' }), CONTEXTO)).toThrow(TypeError)
  })
})

describe('pagamento', () => {
  it('pré-preenche o que falta na parcela', () => {
    expect(entradaPagamentoVazia(new Date(2026, 8, 22), 8_750).valor).toBe('87,50')
  })

  it('parcela sem saldo não sugere valor nenhum', () => {
    expect(entradaPagamentoVazia(new Date(2026, 8, 22), 0).valor).toBe('')
  })

  it('formatarParaCampo devolve o que parseReaisParaCentavos aceita de volta', () => {
    expect(formatarParaCampo(10_000)).toBe('100,00')
    expect(formatarParaCampo(7)).toBe('0,07')
  })

  it('exige valor maior que zero', () => {
    expect(validarPagamento(pagamento({ valor: '0,00' })).valor).toBeDefined()
    expect(validarPagamento(pagamento({ valor: '' })).valor).toBeDefined()
  })

  it('o pagamento válido passa', () => {
    expect(validarPagamento(pagamento())).toEqual({})
  })

  it('nasce por cancelar e sem canceladoEm — a regra recusa o contrário', () => {
    const campos = montarCamposPagamento('c1', 'v1', pagamento(), CONTEXTO)

    expect(campos.cancelado).toBe(false)
    expect('canceladoEm' in campos).toBe(false)
  })

  it('grava contra a venda, nunca contra a parcela', () => {
    const campos = montarCamposPagamento('c1', 'v1', pagamento(), CONTEXTO)

    expect(campos.saleId).toBe('v1')
    expect('installmentId' in campos).toBe(false)
    expect('numeroParcela' in campos).toBe(false)
  })

  it('avisa sem bloquear quando o valor passa do saldo da venda', () => {
    expect(avisoDeValorAlto('1.000,00', 30_000)).toBeDefined()
    expect(avisoDeValorAlto('300,00', 30_000)).toBeUndefined()
    expect(avisoDeValorAlto('100,00', 30_000)).toBeUndefined()
  })
})
