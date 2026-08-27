import { describe, expect, it } from 'vitest'
import { formatarCentavos, formatarCentavosCurto } from './dinheiro'

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
