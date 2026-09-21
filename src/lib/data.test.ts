import { describe, expect, it } from 'vitest'
import { dataBonita, dataLocalISO } from './data'

describe('dataLocalISO', () => {
  it('formata uma data comum', () => {
    expect(dataLocalISO(new Date(2026, 8, 3, 14, 0))).toBe('2026-09-03')
  })

  it('completa mês e dia com zero à esquerda', () => {
    expect(dataLocalISO(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05')
  })

  it('devolve o dia local, não o dia em UTC', () => {
    const noiteDeQuinta = new Date(Date.UTC(2026, 8, 4, 2, 30))

    expect(noiteDeQuinta.toISOString().slice(0, 10)).toBe('2026-09-04')
    expect(dataLocalISO(noiteDeQuinta)).toBe('2026-09-03')
  })

  it('não vira o dia às 23h59 do fuso local', () => {
    expect(dataLocalISO(new Date(2026, 8, 3, 23, 59, 59))).toBe('2026-09-03')
  })

  it('recusa uma data inválida em vez de devolver NaN-NaN-NaN', () => {
    expect(() => dataLocalISO(new Date('não é data'))).toThrow(TypeError)
  })
})

describe('dataBonita', () => {
  it('mostra a data do jeito que o dono lê', () => {
    expect(dataBonita('2026-09-21')).toBe('21/09/2026')
  })

  it('devolve a entrada intacta quando não é uma data ISO', () => {
    expect(dataBonita('')).toBe('')
    expect(dataBonita('21/09/2026')).toBe('21/09/2026')
  })
})
