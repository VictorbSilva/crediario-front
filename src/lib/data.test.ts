import { describe, expect, it } from 'vitest'
import {
  dataBonita,
  dataLocalISO,
  diferencaEmDias,
  vencimentoDaParcela,
} from './data'

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

describe('diferencaEmDias', () => {
  it('conta dias entre datas civis', () => {
    expect(diferencaEmDias('2026-08-19', '2026-09-03')).toBe(15)
    expect(diferencaEmDias('2026-09-03', '2026-09-03')).toBe(0)
  })

  it('devolve negativo para data ainda no futuro', () => {
    expect(diferencaEmDias('2026-09-19', '2026-09-03')).toBe(-16)
  })

  it('atravessa virada de ano e ano bissexto sem perder um dia', () => {
    expect(diferencaEmDias('2026-12-31', '2027-01-01')).toBe(1)
    expect(diferencaEmDias('2028-02-28', '2028-03-01')).toBe(2)
  })
})

describe('vencimentoDaParcela', () => {
  it('avança um mês por parcela mantendo o dia combinado', () => {
    expect(vencimentoDaParcela('2026-04-19', 1, 19)).toBe('2026-05-19')
    expect(vencimentoDaParcela('2026-04-19', 4, 19)).toBe('2026-08-19')
  })

  it('atravessa a virada de ano', () => {
    expect(vencimentoDaParcela('2026-11-10', 3, 10)).toBe('2027-02-10')
  })

  it('encolhe o dia 31 para o último dia do mês curto', () => {
    expect(vencimentoDaParcela('2026-01-31', 1, 31)).toBe('2026-02-28')
    expect(vencimentoDaParcela('2026-01-31', 3, 31)).toBe('2026-04-30')
  })

  it('respeita fevereiro de ano bissexto', () => {
    expect(vencimentoDaParcela('2028-01-31', 1, 31)).toBe('2028-02-29')
  })
})
