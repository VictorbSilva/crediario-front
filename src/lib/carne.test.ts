import { describe, expect, it } from 'vitest'
import {
  janelaDeParcelas,
  situacaoDaVenda,
  textoDaMulta,
  textoDaSituacao,
  textoDasPagas,
  textoDoJuros,
  textoDoPlano,
  textoDoPlanoCurto,
  textoDoResto,
} from './carne'
import type { ParcelaComEstado } from './parcelas'

const semNbsp = (texto: string) => texto.replace(/\u00a0/g, ' ')

function parcela(numero: number, restanteCentavos: number, extras: Partial<ParcelaComEstado> = {}) {
  const vencida = restanteCentavos > 0 && (extras.estado?.diasDeAtraso ?? 0) > 0
  let situacao: ParcelaComEstado['estado']['situacao'] = 'a-vencer'
  if (restanteCentavos === 0) situacao = 'paga'
  else if (vencida) situacao = 'vencida'

  return {
    parcela: {
      id: `p${numero}`,
      saleId: 'v1',
      numero,
      vencimento: '2026-10-10',
      valorCentavos: 10_000,
    },
    pagoCentavos: 10_000 - restanteCentavos,
    estado: { situacao, restanteCentavos, diasDeAtraso: 0 },
    encargos: { multaCentavos: 0, jurosCentavos: 0 },
    taxaPropria: false,
    ...extras,
  } as ParcelaComEstado
}

describe('situacaoDaVenda', () => {
  const base = {
    pagoCentavos: 0,
    abertoCentavos: 0,
    encargosCentavos: 0,
    totalComEncargosCentavos: 0,
    parcelasVencidas: 0,
    quitada: false,
  }

  it('quitada vence qualquer outra leitura', () => {
    expect(situacaoDaVenda({ ...base, quitada: true })).toBe('quitada')
  })

  it('uma parcela vencida basta para a venda estar atrasada', () => {
    expect(situacaoDaVenda({ ...base, parcelasVencidas: 1 })).toBe('atrasada')
  })

  it('em aberto sem vencidas está em dia', () => {
    expect(situacaoDaVenda({ ...base, abertoCentavos: 10_000 })).toBe('em-dia')
  })
})

describe('janelaDeParcelas', () => {
  it('mostra a última paga, a primeira em aberto e as duas seguintes', () => {
    const parcelas = [
      parcela(1, 0),
      parcela(2, 0),
      parcela(3, 0),
      parcela(4, 10_000),
      parcela(5, 10_000),
      parcela(6, 10_000),
      parcela(7, 10_000),
    ]

    const { visiveis, resto } = janelaDeParcelas(parcelas)

    expect(visiveis.map((item) => item.parcela.numero)).toEqual([3, 4, 5, 6])
    expect(resto).toEqual({ de: 7, ate: 7 })
  })

  it('não inventa resto quando o carnê inteiro cabe na janela', () => {
    const { visiveis, resto } = janelaDeParcelas([parcela(1, 0), parcela(2, 10_000)])

    expect(visiveis.map((item) => item.parcela.numero)).toEqual([1, 2])
    expect(resto).toBeNull()
  })

  it('carnê quitado mostra a última parcela', () => {
    const { visiveis, resto } = janelaDeParcelas([parcela(1, 0), parcela(2, 0), parcela(3, 0)])

    expect(visiveis.map((item) => item.parcela.numero)).toEqual([3])
    expect(resto).toBeNull()
  })

  it('ordena por número antes de cortar, não confia na ordem de chegada', () => {
    const { visiveis } = janelaDeParcelas([parcela(3, 10_000), parcela(1, 0), parcela(2, 0)])

    expect(visiveis.map((item) => item.parcela.numero)).toEqual([2, 3])
  })

  it('carnê vazio não quebra', () => {
    expect(janelaDeParcelas([])).toEqual({ visiveis: [], resto: null })
  })
})

describe('textoDaSituacao', () => {
  const hoje = '2026-10-01'

  it('parcela paga não fala de prazo', () => {
    expect(textoDaSituacao(parcela(1, 0), hoje)).toBe('Paga')
  })

  it('vencida conta os dias de atraso, no singular quando é um só', () => {
    const item = parcela(1, 10_000, {
      estado: { situacao: 'vencida', restanteCentavos: 10_000, diasDeAtraso: 1 },
    })

    expect(textoDaSituacao(item, hoje)).toBe('Vencida há 1 dia')
  })

  it('vencida no plural', () => {
    const item = parcela(1, 10_000, {
      estado: { situacao: 'vencida', restanteCentavos: 10_000, diasDeAtraso: 15 },
    })

    expect(textoDaSituacao(item, hoje)).toBe('Vencida há 15 dias')
  })

  it('a vencer conta quantos dias faltam', () => {
    expect(textoDaSituacao(parcela(1, 10_000), hoje)).toBe('Vence em 9 dias')
  })

  it('vencendo hoje não diz "em 0 dias"', () => {
    expect(textoDaSituacao(parcela(1, 10_000), '2026-10-10')).toBe('Vence hoje')
  })

  it('parcial diz que já recebeu algo sem perder o prazo', () => {
    const item = parcela(1, 4_000, {
      estado: { situacao: 'parcial', restanteCentavos: 4_000, diasDeAtraso: 0 },
    })

    expect(textoDaSituacao(item, hoje)).toBe('Parcial · vence em 9 dias')
  })
})

describe('textos do carnê', () => {
  it('plano no singular quando é uma parcela só', () => {
    expect(semNbsp(textoDoPlano(1, 10_000))).toBe('1 parcela de R$ 100,00')
  })

  it('plano no plural', () => {
    expect(semNbsp(textoDoPlano(12, 10_000))).toBe('12 parcelas de R$ 100,00')
  })

  it('a frase curta do painel troca o valor pela contagem', () => {
    expect(textoDoPlanoCurto(12, [parcela(1, 0), parcela(2, 0), parcela(3, 10_000)])).toBe(
      '12 parcelas · 2 pagas',
    )
  })

  it('conta as pagas sobre o total', () => {
    expect(textoDasPagas([parcela(1, 0), parcela(2, 0), parcela(3, 10_000)], 3)).toBe('2/3 pagas')
  })

  it('usa o total do plano, não o que chegou do cache', () => {
    expect(textoDasPagas([parcela(1, 0), parcela(2, 10_000)], 12)).toBe('1/12 pagas')
  })

  it('o resto nomeia a faixa escondida', () => {
    expect(textoDoResto({ de: 7, ate: 12 }, 12)).toBe(
      '7/12 a 12/12 · mesmas condições, nada vencido',
    )
  })

  it('multa percentual e multa fixa se distinguem', () => {
    expect(semNbsp(textoDaMulta({ multaTipo: 'percentual', multaPercentual: 2 }))).toBe('Multa 2%')
    expect(semNbsp(textoDaMulta({ multaTipo: 'fixo', multaFixaCentavos: 500 }))).toBe('Multa R$ 5,00')
  })

  it('juros é sempre ao dia — nunca ao mês', () => {
    expect(semNbsp(textoDoJuros({ jurosPercentualDia: 0.1 }))).toBe('Juros 0.1% ao dia')
  })

  it('taxa ausente vira zero em vez de "undefined"', () => {
    expect(semNbsp(textoDaMulta({}))).toBe('Multa 0%')
    expect(semNbsp(textoDoJuros({}))).toBe('Juros 0% ao dia')
  })
})
