import { describe, expect, it } from 'vitest'
import { situacaoCpf } from './cpf'

describe('situacaoCpf', () => {
  it('trata campo vazio como ausência, não como erro', () => {
    expect(situacaoCpf('')).toBe('vazio')
  })

  it('trata menos de 11 dígitos como digitação em andamento', () => {
    expect(situacaoCpf('5')).toBe('incompleto')
    expect(situacaoCpf('5299822472')).toBe('incompleto')
  })

  it('recusa mais de 11 dígitos', () => {
    expect(situacaoCpf('529982247251')).toBe('invalido')
  })

  it('aceita CPF com dígito verificador correto', () => {
    expect(situacaoCpf('52998224725')).toBe('valido')
    expect(situacaoCpf('11144477735')).toBe('valido')
    expect(situacaoCpf('12345678909')).toBe('valido')
  })

  it('recusa CPF com um dígito trocado', () => {
    expect(situacaoCpf('52998224724')).toBe('invalido')
  })

  it('confere os dois dígitos verificadores, não só o último', () => {
    // 529982247 pede 2 no 10º dígito. Com 3 ali, o 11º recalculado sobre os dez
    // primeiros dá 3: o CPF só passaria se o primeiro verificador fosse ignorado.
    expect(situacaoCpf('52998224733')).toBe('invalido')
  })

  it('recusa sequência de dígitos repetidos mesmo passando na conta', () => {
    expect(situacaoCpf('11111111111')).toBe('invalido')
    expect(situacaoCpf('00000000000')).toBe('invalido')
  })

  it('recusa entrada que não seja só dígitos', () => {
    expect(situacaoCpf('529.982.247-25')).toBe('invalido')
    expect(situacaoCpf('5299822472a')).toBe('invalido')
    // Curta demais para cair no limite de tamanho: só a checagem de dígitos a recusa.
    expect(situacaoCpf('abc')).toBe('invalido')
    expect(situacaoCpf('529.')).toBe('invalido')
  })
})
