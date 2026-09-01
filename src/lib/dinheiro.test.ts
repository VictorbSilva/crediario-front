import { describe, expect, it } from 'vitest'
import {
  formatarCentavos,
  formatarCentavosCurto,
  parseReaisParaCentavos,
} from './dinheiro'

// O Intl em pt-BR separa "R$" do número com espaço não separável (U+00A0), e
// a versão do ICU do Node pode variar. Comparar com espaço comum deixa o teste
// legível sem prendê-lo a esse detalhe.
const semNbsp = (texto: string) => texto.replace(/\u00a0/g, ' ')

describe('formatarCentavos', () => {
  it('formata centavos como moeda brasileira', () => {
    expect(semNbsp(formatarCentavos(123456))).toBe('R$ 1.234,56')
  })

  it('sempre mostra as duas casas, mesmo em valor redondo', () => {
    expect(semNbsp(formatarCentavos(5000))).toBe('R$ 50,00')
  })

  it('formata zero', () => {
    expect(semNbsp(formatarCentavos(0))).toBe('R$ 0,00')
  })

  it('formata valor menor que um real', () => {
    expect(semNbsp(formatarCentavos(7))).toBe('R$ 0,07')
  })

  it('formata valor negativo', () => {
    expect(semNbsp(formatarCentavos(-2550))).toBe('-R$ 25,50')
  })
})

describe('formatarCentavosCurto', () => {
  it('omite os centavos quando são zero', () => {
    expect(semNbsp(formatarCentavosCurto(5000))).toBe('R$ 50')
  })

  it('mantém os centavos quando existem', () => {
    expect(semNbsp(formatarCentavosCurto(5001))).toBe('R$ 50,01')
  })

  it('omite os centavos em zero', () => {
    expect(semNbsp(formatarCentavosCurto(0))).toBe('R$ 0')
  })

  it('mantém o separador de milhar', () => {
    expect(semNbsp(formatarCentavosCurto(1234500))).toBe('R$ 12.345')
  })
})

describe('parseReaisParaCentavos', () => {
  it('lê vírgula como separador decimal', () => {
    expect(parseReaisParaCentavos('12,34')).toBe(1234)
    expect(parseReaisParaCentavos('0,07')).toBe(7)
  })

  it('completa uma casa decimal solta', () => {
    expect(parseReaisParaCentavos('12,5')).toBe(1250)
  })

  it('lê valor inteiro sem separador', () => {
    expect(parseReaisParaCentavos('50')).toBe(5000)
    expect(parseReaisParaCentavos('0')).toBe(0)
  })

  it('lê o formato brasileiro completo', () => {
    expect(parseReaisParaCentavos('1.234,56')).toBe(123456)
    expect(parseReaisParaCentavos('12.345.678,90')).toBe(1234567890)
  })

  it('lê ponto sozinho como milhar quando o grupo tem três dígitos', () => {
    expect(parseReaisParaCentavos('1.234')).toBe(123400)
    expect(parseReaisParaCentavos('12.345.678')).toBe(1234567800)
  })

  it('lê ponto sozinho como decimal quando o grupo tem uma ou duas casas', () => {
    expect(parseReaisParaCentavos('12.34')).toBe(1234)
    expect(parseReaisParaCentavos('12.3')).toBe(1230)
  })

  it('aceita o formato en-US quando os dois separadores aparecem', () => {
    expect(parseReaisParaCentavos('1,234.56')).toBe(123456)
  })

  it('aceita o prefixo R$, com ou sem espaço', () => {
    expect(parseReaisParaCentavos('R$ 1.234,56')).toBe(123456)
    expect(parseReaisParaCentavos('R$1.234,56')).toBe(123456)
    expect(parseReaisParaCentavos('r$ 12,34')).toBe(1234)
  })

  it('ignora espaço em volta, inclusive o não separável colado da planilha', () => {
    expect(parseReaisParaCentavos('  12,34  ')).toBe(1234)
    expect(parseReaisParaCentavos('R$\u00a01.234,56')).toBe(123456)
  })

  it('aceita valor começando pela vírgula', () => {
    expect(parseReaisParaCentavos(',50')).toBe(50)
  })

  it('devolve null para entrada vazia ou só espaço', () => {
    expect(parseReaisParaCentavos('')).toBeNull()
    expect(parseReaisParaCentavos('   ')).toBeNull()
    expect(parseReaisParaCentavos('R$')).toBeNull()
  })

  it('devolve null para pontuação sem nenhum dígito', () => {
    // Regressão: antes da guarda de dígito, "," e "R$," devolviam 0. Como o
    // valor pago é campo digitado, uma vírgula solta virava um pagamento de
    // R$ 0,00 aceito em silêncio — pior que recusar o campo, porque some.
    expect(parseReaisParaCentavos(',')).toBeNull()
    expect(parseReaisParaCentavos('R$,')).toBeNull()
    expect(parseReaisParaCentavos('.')).toBeNull()
    expect(parseReaisParaCentavos(',,')).toBeNull()
    expect(parseReaisParaCentavos('.,')).toBeNull()
    expect(parseReaisParaCentavos('-')).toBeNull()
  })

  it('devolve null para entrada inválida', () => {
    expect(parseReaisParaCentavos('abc')).toBeNull()
    expect(parseReaisParaCentavos('12,34abc')).toBeNull()
    expect(parseReaisParaCentavos('12a,34')).toBeNull()
    expect(parseReaisParaCentavos('12,,34')).toBeNull()
    expect(parseReaisParaCentavos('1,2,3')).toBeNull()
  })

  it('recusa mais de duas casas decimais em vez de arredondar', () => {
    // Arredondar em silêncio é adivinhar a intenção do usuário; em dinheiro
    // isso vira diferença de centavo que ninguém consegue explicar depois.
    expect(parseReaisParaCentavos('12,345')).toBeNull()
    expect(parseReaisParaCentavos('1.234,567')).toBeNull()
  })

  it('recusa separador de milhar mal formado', () => {
    expect(parseReaisParaCentavos('1.23.456')).toBeNull()
    expect(parseReaisParaCentavos('1234.56,78')).toBeNull()
  })

  it('recusa valor negativo', () => {
    // Pagamento e juros nunca são negativos. Estorno é outro fluxo, com
    // registro próprio — não é um pagamento de valor negativo.
    expect(parseReaisParaCentavos('-12,34')).toBeNull()
  })

  it('recusa número grande demais para caber em inteiro seguro', () => {
    expect(parseReaisParaCentavos('999999999999999999,99')).toBeNull()
  })

  it('faz o caminho de volta da formatação', () => {
    for (const centavos of [0, 7, 50, 1234, 123456, 1234567890]) {
      expect(parseReaisParaCentavos(formatarCentavos(centavos))).toBe(centavos)
    }
  })
})
