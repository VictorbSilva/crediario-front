import { describe, expect, it } from 'vitest'
import {
  avisoDeValorAlto,
  entradaItemVazia,
  entradaPagamentoVazia,
  entradaVendaVazia,
  formatarParaCampo,
  montarCamposPagamento,
  montarCamposVenda,
  montarCancelamentoVenda,
  parseInteiro,
  parseTaxa,
  podeCancelarVenda,
  totalDosItens,
  validarItens,
  validarPagamento,
  validarVenda,
} from './venda'
import type { EntradaItem, EntradaPagamento, EntradaVenda } from './venda'

const CONTEXTO = { agora: new Date(2026, 8, 22), dispositivo: 'ab12cd34' }

function item(extras: Partial<EntradaItem> = {}): EntradaItem {
  return { ...entradaItemVazia(), descricao: 'Panela', valorUnitario: '10,00', ...extras }
}

/** Venda de um item só, de quantidade 1: o total é o valor unitário. */
const valor = (valorUnitario: string): Partial<EntradaVenda> => ({ itens: [item({ valorUnitario })] })

function venda(extras: Partial<EntradaVenda> = {}): EntradaVenda {
  return {
    ...entradaVendaVazia(new Date(2026, 8, 22)),
    ...valor('300,00'),
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

  it('recusa inteiro grande demais para ser exato', () => {
    expect(parseInteiro('99999999999999999999')).toBeNull()
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

  it('recusa número que estoura para infinito', () => {
    expect(parseTaxa('9'.repeat(400))).toBeNull()
  })

  it('aceita casas decimais e espaço antes do %', () => {
    expect(parseTaxa('0,15')).toBe(0.15)
    expect(parseTaxa(' 2 % ')).toBe(2)
  })

  it('recusa o que Number aceitaria mas ninguém digita como taxa', () => {
    expect(parseTaxa('1e2')).toBeNull()
    expect(parseTaxa('0x5')).toBeNull()
    expect(parseTaxa('.5')).toBeNull()
  })
})

describe('entradaVendaVazia', () => {
  it('nasce em branco, com um item de quantidade 1, a data de hoje, o dia de hoje como vencimento e multa e juros desligados', () => {
    expect(entradaVendaVazia(new Date(2026, 8, 5, 23, 30))).toStrictEqual({
      dataVenda: '2026-09-05', itens: [{ quantidade: '1', descricao: '', valorUnitario: '' }],
      numeroParcelas: '', diaVencimento: '5', cobrarTaxas: false,
      multaTipo: 'percentual', multaPercentual: '', multaFixa: '', jurosPercentualDia: '', observacao: '',
    })
  })
})

describe('entradaItemVazia', () => {
  it('nasce com quantidade 1 e o resto em branco', () => {
    expect(entradaItemVazia()).toStrictEqual({ quantidade: '1', descricao: '', valorUnitario: '' })
  })
})

describe('validarItens', () => {
  const errosDo = (extras: Partial<EntradaItem>) => validarItens([item(extras)]).porItem[0]

  it('item completo não tem erro, e a lista não tem erro geral', () => {
    expect(validarItens([item(), item({ quantidade: '2' })])).toStrictEqual({ porItem: [{}, {}] })
  })

  it('quantidade vazia, zero, acima de 999 ou com vírgula é recusada', () => {
    expect(errosDo({ quantidade: '' })).toStrictEqual({ quantidade: 'Informe a quantidade' })
    expect(errosDo({ quantidade: '   ' })).toStrictEqual({ quantidade: 'Informe a quantidade' })
    expect(errosDo({ quantidade: '0' })).toStrictEqual({ quantidade: 'Pelo menos 1' })
    expect(errosDo({ quantidade: '1000' })).toStrictEqual({ quantidade: 'No máximo 999' })
    expect(errosDo({ quantidade: '1,5' })).toStrictEqual({ quantidade: 'Só número inteiro' })
    expect(errosDo({ quantidade: '-1' })).toStrictEqual({ quantidade: 'Só número inteiro' })
  })

  it('as bordas da quantidade valem: 1 e 999', () => {
    expect(errosDo({ quantidade: '1' })).toStrictEqual({})
    expect(errosDo({ quantidade: '999' })).toStrictEqual({})
  })

  it('descrição vazia, só de espaços ou com 121 caracteres é recusada; 120 com espaços em volta passa', () => {
    expect(errosDo({ descricao: '' })).toStrictEqual({ descricao: 'Informe a descrição' })
    expect(errosDo({ descricao: '   ' })).toStrictEqual({ descricao: 'Informe a descrição' })
    expect(errosDo({ descricao: 'a'.repeat(121) })).toStrictEqual({ descricao: 'No máximo 120 caracteres' })
    expect(errosDo({ descricao: 'a'.repeat(120) })).toStrictEqual({})
    expect(errosDo({ descricao: `  ${'a'.repeat(120)}  ` })).toStrictEqual({})
  })

  it('valor unitário vazio, ilegível ou zero é recusado; um centavo passa', () => {
    expect(errosDo({ valorUnitario: '' })).toStrictEqual({ valorUnitario: 'Informe o valor' })
    expect(errosDo({ valorUnitario: 'abc' })).toStrictEqual({ valorUnitario: 'Informe o valor' })
    expect(errosDo({ valorUnitario: '0,00' })).toStrictEqual({ valorUnitario: 'O valor precisa ser maior que zero' })
    expect(errosDo({ valorUnitario: '0,01' })).toStrictEqual({})
  })

  it('acusa cada campo errado do item, e só no item errado', () => {
    const { porItem } = validarItens([item(), item({ quantidade: '0', descricao: '', valorUnitario: '' })])

    expect(porItem).toStrictEqual([
      {},
      { quantidade: 'Pelo menos 1', descricao: 'Informe a descrição', valorUnitario: 'Informe o valor' },
    ])
  })

  it('lista vazia é recusada no geral', () => {
    expect(validarItens([])).toStrictEqual({ porItem: [], geral: 'Inclua pelo menos um item' })
  })

  it('31 itens é recusado no geral, que é o teto da regra; 30 passa', () => {
    const itens = (quantos: number) => Array.from({ length: quantos }, () => item())

    expect(validarItens(itens(31)).geral).toBe('No máximo 30 itens')
    expect(validarItens(itens(30)).geral).toBeUndefined()
  })

  it('itens válidos cuja soma não é inteiro seguro são recusados no geral', () => {
    // 5 × 10^15 centavos cada: um só cabe, dois passam do maior inteiro exato.
    const caro = item({ valorUnitario: '50.000.000.000.000,00' })

    expect(validarItens([caro]).geral).toBeUndefined()
    expect(validarItens([caro, caro])).toStrictEqual({ porItem: [{}, {}], geral: 'Total grande demais' })
  })

  it('com item errado, não fala em total grande demais', () => {
    expect(validarItens([item({ quantidade: '0' })]).geral).toBeUndefined()
  })
})

describe('totalDosItens', () => {
  it('soma quantidade vezes valor unitário de cada item, em centavos', () => {
    expect(totalDosItens([
      item({ quantidade: '2', valorUnitario: 'R$ 49,90' }),
      item({ quantidade: '1', valorUnitario: '10' }),
    ])).toBe(10_980)
  })

  it('a quantidade multiplica: 3 × um centavo são três centavos', () => {
    expect(totalDosItens([item({ quantidade: '3', valorUnitario: '0,01' })])).toBe(3)
  })

  it('qualquer item inválido anula o total', () => {
    for (const extras of [{ quantidade: '0' }, { descricao: ' ' }, { valorUnitario: '0,00' }]) {
      expect(totalDosItens([item(), item(extras)])).toBeNull()
    }
  })

  it('lista vazia ou acima de 30 itens não tem total', () => {
    expect(totalDosItens([])).toBeNull()
    expect(totalDosItens(Array.from({ length: 31 }, () => item({ valorUnitario: '0,01' })))).toBeNull()
    expect(totalDosItens(Array.from({ length: 30 }, () => item({ valorUnitario: '0,01' })))).toBe(30)
  })

  it('total que não é inteiro seguro vira nulo, no produto e na soma', () => {
    // 999 × 99.999.999.999,99 passa de 9 × 10^15.
    expect(totalDosItens([item({ quantidade: '999', valorUnitario: '99.999.999.999,99' })])).toBeNull()

    const caro = item({ valorUnitario: '50.000.000.000.000,00' })
    expect(totalDosItens([caro])).toBe(5_000_000_000_000_000)
    expect(totalDosItens([caro, caro])).toBeNull()
  })
})

describe('validarVenda', () => {
  it('a venda mínima passa', () => {
    expect(validarVenda(venda())).toEqual({})
  })

  it('cobra itens e parcelas', () => {
    const erros = validarVenda(venda({ itens: [], numeroParcelas: '' }))

    expect(erros.itens).toBe('Inclua pelo menos um item')
    expect(erros.numeroParcelas).toBeDefined()
  })

  it('item com erro bloqueia a venda', () => {
    expect(validarVenda(venda(valor('0,00'))).itens).toBe('Confira os itens')
    expect(validarVenda(venda({ itens: [item(), item({ descricao: '' })] })).itens).toBe('Confira os itens')
  })

  it('o erro geral dos itens tem precedência sobre o de cada item', () => {
    expect(validarVenda(venda({ itens: Array.from({ length: 31 }, () => item({ quantidade: '0' })) })).itens)
      .toBe('No máximo 30 itens')
  })

  it('"parcelas demais" usa a soma dos itens, com a quantidade, e não um item só', () => {
    const doisItens = { itens: [item({ valorUnitario: '0,01' }), item({ valorUnitario: '0,02' })] }
    const tresUnidades = { itens: [item({ quantidade: '3', valorUnitario: '0,01' })] }

    expect(validarVenda(venda({ ...doisItens, numeroParcelas: '4' })).numeroParcelas).toBeDefined()
    expect(validarVenda(venda({ ...doisItens, numeroParcelas: '3' })).numeroParcelas).toBeUndefined()
    expect(validarVenda(venda({ ...tresUnidades, numeroParcelas: '4' })).numeroParcelas).toBeDefined()
    expect(validarVenda(venda({ ...tresUnidades, numeroParcelas: '3' })).numeroParcelas).toBeUndefined()
  })

  it('recusa acima de 120 parcelas, que é o teto da regra do Firestore', () => {
    expect(validarVenda(venda({ numeroParcelas: '121' })).numeroParcelas).toBeDefined()
    expect(validarVenda(venda({ numeroParcelas: '120' })).numeroParcelas).toBeUndefined()
  })

  it('recusa parcelas demais para o valor — a regra exige parcela > 0 centavos', () => {
    // R$ 0,03 em 12 parcelas daria onze parcelas de zero centavo, que o
    // Firestore recusaria só na sincronização.
    expect(validarVenda(venda({ ...valor('0,03'), numeroParcelas: '12' })).numeroParcelas).toBeDefined()
    expect(validarVenda(venda({ ...valor('0,03'), numeroParcelas: '3' })).numeroParcelas).toBeUndefined()
  })

  it('pede pelo menos uma parcela e o dia do vencimento', () => {
    expect(validarVenda(venda({ numeroParcelas: '0' })).numeroParcelas).toBe('Pelo menos uma parcela')
    expect(validarVenda(venda({ diaVencimento: '' })).diaVencimento).toBe('Informe o dia do vencimento')
  })

  it('recusa observação acima de 500 caracteres, que é o teto da regra', () => {
    expect(validarVenda(venda({ observacao: 'a'.repeat(501) })).observacao).toBeDefined()
    expect(validarVenda(venda({ observacao: 'a'.repeat(500) })).observacao).toBeUndefined()
  })

  it('multa fixa vazia vale zero; texto que não é valor é recusado', () => {
    const fixa = (multaFixa: string) =>
      validarVenda(venda({ cobrarTaxas: true, multaTipo: 'fixo', multaFixa })).multaFixa

    expect(fixa('')).toBeUndefined()
    expect(fixa('5,00')).toBeUndefined()
    expect(fixa('cinco')).toBe('Valor inválido')
  })

  it('recusa dia de vencimento fora de 1..31', () => {
    expect(validarVenda(venda({ diaVencimento: '0' })).diaVencimento).toBeDefined()
    expect(validarVenda(venda({ diaVencimento: '32' })).diaVencimento).toBeDefined()
  })

  it('as bordas valem: 1 parcela, dia 1, dia 31 e taxa de 100%', () => {
    expect(validarVenda(venda({ numeroParcelas: '1' }))).toEqual({})
    expect(validarVenda(venda({ diaVencimento: '1' }))).toEqual({})
    expect(validarVenda(venda({ diaVencimento: '31' }))).toEqual({})
    expect(validarVenda(venda({
      cobrarTaxas: true, multaTipo: 'percentual', multaPercentual: '100', jurosPercentualDia: '100',
    }))).toEqual({})
  })

  it('item inválido acusa só nos itens, não em "parcelas demais"', () => {
    expect(validarVenda(venda(valor('0,00'))).numeroParcelas).toBeUndefined()
    expect(validarVenda(venda(valor(''))).numeroParcelas).toBeUndefined()
    expect(validarVenda(venda(valor('abc'))).numeroParcelas).toBeUndefined()
    expect(validarVenda(venda({ itens: [] })).numeroParcelas).toBeUndefined()
  })

  it('taxas escondidas não bloqueiam: sem multa e juros, nada delas é conferido, em nenhum tipo', () => {
    // O dono escolheu um tipo, digitou errado e depois desmarcou "Informar multa e juros".
    for (const multaTipo of ['percentual', 'fixo'] as const) {
      expect(validarVenda(venda({
        cobrarTaxas: false, multaTipo, multaPercentual: '999', multaFixa: 'abc', jurosPercentualDia: 'x',
      }))).toEqual({})
    }
  })

  it('confere só a multa do tipo escolhido', () => {
    expect(validarVenda(venda({ cobrarTaxas: true, multaTipo: 'fixo', multaPercentual: 'abc', multaFixa: '5,00' })))
      .toEqual({})
    expect(validarVenda(venda({ cobrarTaxas: true, multaTipo: 'percentual', multaPercentual: '2', multaFixa: 'abc' })))
      .toEqual({})
  })

  it('espaços sobrando não viram erro: multa fixa só de espaços, observação no teto com espaços', () => {
    expect(validarVenda(venda({ cobrarTaxas: true, multaTipo: 'fixo', multaFixa: '   ' })).multaFixa).toBeUndefined()
    expect(validarVenda(venda({ observacao: `${'a'.repeat(500)}   ` })).observacao).toBeUndefined()
  })

  it('recusa data que não existe no calendário', () => {
    expect(validarVenda(venda({ dataVenda: '2026-02-31' })).dataVenda).toBeDefined()
  })

  it('recusa venda cuja última parcela passaria do ano 9999', () => {
    const erros = validarVenda(
      venda({ dataVenda: '9999-06-01', numeroParcelas: '12', diaVencimento: '10' }),
    )

    expect(erros.dataVenda).toBeDefined()
  })

  it('aceita venda cuja última parcela ainda vence no ano 9999', () => {
    const erros = validarVenda(
      venda({ dataVenda: '9999-11-15', numeroParcelas: '1', diaVencimento: '15' }),
    )

    expect(erros.dataVenda).toBeUndefined()
  })

  it('recusa venda em dezembro de 9999 mesmo com uma só parcela', () => {
    const erros = validarVenda(
      venda({ dataVenda: '9999-12-01', numeroParcelas: '1', diaVencimento: '1' }),
    )

    expect(erros.dataVenda).toBe('Confira o ano: a última parcela passaria do ano 9999.')
  })

  it('o teto do ano também vale nas bordas: 120 parcelas e dia 31', () => {
    expect(validarVenda(venda({ dataVenda: '9990-06-01', numeroParcelas: '120', diaVencimento: '10' })).dataVenda)
      .toBeDefined()
    expect(validarVenda(venda({ dataVenda: '9999-12-01', numeroParcelas: '1', diaVencimento: '31' })).dataVenda)
      .toBeDefined()
  })

  it('perto do ano 9999, parcelas ou dia inválidos acusam no próprio campo, não na data', () => {
    const perto = { dataVenda: '9999-06-01' }

    for (const numeroParcelas of ['121', '0', '']) {
      const erros = validarVenda(venda({ ...perto, numeroParcelas }))
      expect(erros.numeroParcelas).toBeDefined()
      expect(erros.dataVenda).toBeUndefined()
    }
    for (const diaVencimento of ['32', '0', '']) {
      const erros = validarVenda(venda({ dataVenda: '9999-12-01', numeroParcelas: '1', diaVencimento }))
      expect(erros.diaVencimento).toBeDefined()
      expect(erros.dataVenda).toBeUndefined()
    }
  })

  it('parcelas em branco não geram erro na data válida', () => {
    const erros = validarVenda(venda({ numeroParcelas: '' }))

    expect(erros).toEqual({ numeroParcelas: 'Informe em quantas parcelas' })
    expect(erros.dataVenda).toBeUndefined()
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
    const { parcelas } = montarCamposVenda('c1', venda(valor('100,00')), CONTEXTO)

    expect(parcelas.map((p) => p.valorCentavos)).toEqual([3_333, 3_333, 3_334])
  })

  it('valorParcelaCentavos é a parcela comum, não a última com a sobra', () => {
    const { venda: v } = montarCamposVenda('c1', venda(valor('100,00')), CONTEXTO)

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

  it('observação preenchida vai aparada para o documento', () => {
    const { venda: v } = montarCamposVenda('c1', venda({ observacao: '  geladeira  ' }), CONTEXTO)

    expect(v.observacao).toBe('geladeira')
  })

  it('taxa ilegível nunca chega ao documento como NaN', () => {
    const { venda: v } = montarCamposVenda(
      'c1',
      venda({ cobrarTaxas: true, multaTipo: 'percentual', multaPercentual: 'x', jurosPercentualDia: 'y' }),
      CONTEXTO,
    )

    expect(v.multaPercentual).toBe(0)
    expect(v.jurosPercentualDia).toBe(0)

    const fixa = montarCamposVenda(
      'c1',
      venda({ cobrarTaxas: true, multaTipo: 'fixo', multaFixa: 'x' }),
      CONTEXTO,
    ).venda
    expect(fixa.multaFixaCentavos).toBe(0)
  })

  it('a soma das parcelas fecha com o total, sempre', () => {
    for (const total of ['100,00', '300,00', '999,99', '1.234,56']) {
      for (const n of ['1', '3', '7', '12']) {
        const { venda: v, parcelas } = montarCamposVenda(
          'c1',
          venda({ ...valor(total), numeroParcelas: n }),
          CONTEXTO,
        )
        const soma = parcelas.reduce((acc, p) => acc + p.valorCentavos, 0)

        expect(soma).toBe(v.valorTotalCentavos)
      }
    }
  })

  it('recusa montar o que a validação recusaria', () => {
    // A mensagem, e não só o tipo: sem o guarda, outro TypeError estouraria mais adiante.
    const montar = (extras: Partial<EntradaVenda>) => () => montarCamposVenda('c1', venda(extras), CONTEXTO)
    const itens = 'montarCamposVenda recebeu itens que não passaram na validação'
    const parcelas = 'montarCamposVenda recebeu parcelas que não passaram na validação'
    const dia = 'montarCamposVenda recebeu um dia que não passou na validação'

    expect(montar(valor(''))).toThrow(itens)
    expect(montar(valor('0,00'))).toThrow(itens)
    expect(montar({ itens: [] })).toThrow(itens)
    expect(montar({ itens: [item(), item({ quantidade: '0' })] })).toThrow(itens)
    expect(montar({ itens: [item({ quantidade: '1000' })] })).toThrow(itens)
    expect(montar({ itens: [item({ descricao: '   ' })] })).toThrow(itens)
    expect(montar({ itens: [item({ descricao: 'a'.repeat(121) })] })).toThrow(itens)
    expect(montar({ itens: Array.from({ length: 31 }, () => item()) })).toThrow(itens)
    expect(montar({ numeroParcelas: '' })).toThrow(parcelas)
    expect(montar({ numeroParcelas: '0' })).toThrow(parcelas)
    expect(montar({ diaVencimento: '' })).toThrow(dia)
    expect(montar({ diaVencimento: '0' })).toThrow(dia)
    expect(montar({ diaVencimento: '32' })).toThrow(dia)
    expect(montar({ ...valor('0,01'), numeroParcelas: '1', diaVencimento: '1' })).not.toThrow()
  })

  it('grava os itens com a descrição aparada e o total igual à soma deles', () => {
    const { venda: v, parcelas } = montarCamposVenda('c1', venda({
      itens: [
        { quantidade: ' 2 ', descricao: '  Panela  ', valorUnitario: 'R$ 49,90' },
        { quantidade: '1', descricao: 'Jogo de copos', valorUnitario: '10' },
      ],
    }), CONTEXTO)

    expect(v.itens).toStrictEqual([
      { quantidade: 2, descricao: 'Panela', valorUnitarioCentavos: 4_990 },
      { quantidade: 1, descricao: 'Jogo de copos', valorUnitarioCentavos: 1_000 },
    ])
    expect(v.valorTotalCentavos).toBe(10_980)
    expect(parcelas.map((p) => p.valorCentavos)).toEqual([3_660, 3_660, 3_660])
    expect(parcelas.reduce((soma, p) => soma + p.valorCentavos, 0)).toBe(10_980)
  })

  it('o documento não leva o texto digitado, só os números', () => {
    const { venda: v } = montarCamposVenda('c1', venda(), CONTEXTO)

    expect('valor' in v).toBe(false)
    expect(Object.keys(v.itens[0]).sort()).toEqual(['descricao', 'quantidade', 'valorUnitarioCentavos'])
  })
})

describe('cancelamento da venda', () => {
  it('permite cancelar venda antiga sem o campo e venda ainda ativa', () => {
    expect(podeCancelarVenda({})).toBe(true)
    expect(podeCancelarVenda({ cancelada: false })).toBe(true)
  })

  it('não permite cancelar de novo', () => {
    expect(podeCancelarVenda({ cancelada: true })).toBe(false)
  })

  it('monta exatamente o fato do cancelamento e a autoria, sem outros campos', () => {
    expect(montarCancelamentoVenda({
      agora: new Date(2026, 9, 13, 10, 0), dispositivo: 'abc',
    })).toEqual({ cancelada: true, canceladaEm: '2026-10-13', atualizadoPor: 'abc' })
  })

  it('grava o dia do momento da escrita, não o de quando a tela abriu', () => {
    // A tela montou no dia 13 e ficou aberta; o cancelamento é confirmado
    // depois da meia-noite. A data gravada é do dia 14 — e a regra não deixa
    // corrigi-la depois.
    expect(montarCancelamentoVenda({
      agora: new Date(2026, 9, 14, 0, 5), dispositivo: 'abc',
    }).canceladaEm).toBe('2026-10-14')
  })

  it('usa o dia civil local, não o de UTC', () => {
    // 23:30 em São Paulo já é dia 14 em UTC.
    expect(montarCancelamentoVenda({
      agora: new Date(2026, 9, 13, 23, 30), dispositivo: 'abc',
    }).canceladaEm).toBe('2026-10-13')
  })

  it('recusa momento inválido', () => {
    expect(() => montarCancelamentoVenda({
      agora: new Date(Number.NaN), dispositivo: 'abc',
    })).toThrow(TypeError)
  })

  it('recusa data que a regra recusaria, como o ano 10000', () => {
    expect(() => montarCancelamentoVenda({
      agora: new Date(10000, 0, 1), dispositivo: 'abc',
    })).toThrow('montarCancelamentoVenda recebeu uma data que não passou na validação')
  })
})

describe('pagamento', () => {
  it('pré-preenche o que falta na parcela, com hoje, dinheiro e sem observação', () => {
    expect(entradaPagamentoVazia(new Date(2026, 8, 22), 8_750)).toEqual({
      data: '2026-09-22', valor: '87,50', forma: 'dinheiro', observacao: '',
    })
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

  it('recusa data fora do formato civil e observação acima do teto da regra', () => {
    expect(validarPagamento(pagamento({ data: '22/09/2026' })).data).toBe('Data inválida')
    expect(validarPagamento(pagamento({ observacao: 'a'.repeat(501) })).observacao).toBeDefined()
  })

  it('observação preenchida vai aparada; em branco não vira campo', () => {
    expect(montarCamposPagamento('c1', 'v1', pagamento({ observacao: ' troco ' }), CONTEXTO).observacao)
      .toBe('troco')
    expect('observacao' in montarCamposPagamento('c1', 'v1', pagamento({ observacao: '  ' }), CONTEXTO))
      .toBe(false)
  })

  it('recusa montar pagamento que a validação recusaria', () => {
    const mensagem = 'montarCamposPagamento recebeu um valor que não passou na validação'
    expect(() => montarCamposPagamento('c1', 'v1', pagamento({ valor: '0,00' }), CONTEXTO)).toThrow(mensagem)
    expect(() => montarCamposPagamento('c1', 'v1', pagamento({ valor: '' }), CONTEXTO)).toThrow(mensagem)
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
