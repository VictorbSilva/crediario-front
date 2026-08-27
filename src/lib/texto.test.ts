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

  it('remove acento com a faixa combinante escrita em escapes', () => {
    // A faixa \u0300-\u036f cobre os diacríticos combinantes que o NFD gera.
    // Ela é escrita com escapes de propósito: com os caracteres combinantes
    // literais no fonte, qualquer conversão de encoding do arquivo quebra a
    // busca em silêncio — nenhum erro, a busca só para de achar "José".
    expect(normalizar('ÁÀÂÃÄ ÉÊ ÍÏ ÓÔÕÖ ÚÜ Çç Ññ')).toBe('aaaaa ee ii oooo uu cc nn')
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

  it('colapsa espaço interno repetido', () => {
    expect(normalizar('maria  silva')).toBe('maria silva')
    expect(normalizar('mercado     sao   jose')).toBe('mercado sao jose')
  })

  it('colapsa espaço não separável, que é o que vem colado da planilha', () => {
    expect(normalizar('maria\u00a0silva')).toBe('maria silva')
    expect(normalizar('mercado\u00a0 \u00a0sao jose')).toBe('mercado sao jose')
  })

  it('colapsa tabulação e quebra de linha', () => {
    expect(normalizar('maria\tsilva\nsantos')).toBe('maria silva santos')
  })

  it('devolve string vazia quando a entrada é só espaço', () => {
    expect(normalizar('  \u00a0 \t ')).toBe('')
  })

  it('deixa passar dígitos e pontuação', () => {
    // 'º' é ordinal masculino, não é diacrítico combinante: o NFD não o
    // decompõe e ele sobrevive à normalização. Endereço é campo de busca,
    // então vale ter isso escrito.
    expect(normalizar('Rua 7, nº 120')).toBe('rua 7, nº 120')
  })
})
