import { describe, expect, it } from 'vitest'
import { normalizar } from './texto'

describe('normalizar', () => {
  it('remove acentos', () => {
    expect(normalizar('José')).toBe('jose')
  })

  it('remove acentos de várias famílias', () => {
    expect(normalizar('Conceição Ramírez Müller Gonçalves')).toBe(
      'conceicao ramirez muller goncalves',
    )
  })

  it('baixa a caixa', () => {
    expect(normalizar('MERCADO SÃO JOSÉ')).toBe('mercado sao jose')
  })

  it('tira espaço das pontas', () => {
    expect(normalizar('  Maria  ')).toBe('maria')
  })

  it('devolve string vazia para entrada vazia', () => {
    expect(normalizar('')).toBe('')
  })

  it('deixa passar dígitos e pontuação', () => {
    // 'º' é ordinal masculino, não é diacrítico combinante: o NFD não o
    // decompõe e ele sobrevive à normalização. Endereço é campo de busca, então
    // vale ter isso escrito.
    expect(normalizar('Rua 7, nº 120')).toBe('rua 7, nº 120')
  })
})
