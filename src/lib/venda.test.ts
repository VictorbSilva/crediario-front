import { describe, expect, it } from 'vitest'
import {
  avisoDeValorAlto,
  entradaPagamentoVazia,
  entradaVendaVazia,
  formatarParaCampo,
  montarCamposPagamento,
  montarCamposVenda,
  montarCancelamentoVenda,
  parseInteiro,
  parseTaxa,
  podeCancelarVenda,
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
  it('nasce em branco, com a data de hoje, o dia de hoje como vencimento e multa e juros desligados', () => {
    expect(entradaVendaVazia(new Date(2026, 8, 5, 23, 30))).toEqual({
      dataVenda: '2026-09-05', valor: '', numeroParcelas: '', diaVencimento: '5', cobrarTaxas: false,
      multaTipo: 'percentual', multaPercentual: '', multaFixa: '', jurosPercentualDia: '', observacao: '',
    })
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

  it('valor inválido acusa só no valor, não em "parcelas demais"', () => {
    expect(validarVenda(venda({ valor: '0,00' })).numeroParcelas).toBeUndefined()
    expect(validarVenda(venda({ valor: '' })).numeroParcelas).toBeUndefined()
    expect(validarVenda(venda({ valor: 'abc' })).numeroParcelas).toBeUndefined()
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
          venda({ valor: total, numeroParcelas: n }),
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
    const valor = 'montarCamposVenda recebeu um valor que não passou na validação'
    const parcelas = 'montarCamposVenda recebeu parcelas que não passaram na validação'
    const dia = 'montarCamposVenda recebeu um dia que não passou na validação'

    expect(montar({ valor: '' })).toThrow(valor)
    expect(montar({ valor: '0,00' })).toThrow(valor)
    expect(montar({ numeroParcelas: '' })).toThrow(parcelas)
    expect(montar({ numeroParcelas: '0' })).toThrow(parcelas)
    expect(montar({ diaVencimento: '' })).toThrow(dia)
    expect(montar({ diaVencimento: '0' })).toThrow(dia)
    expect(montar({ diaVencimento: '32' })).toThrow(dia)
    expect(montar({ valor: '0,01', numeroParcelas: '1', diaVencimento: '1' })).not.toThrow()
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
