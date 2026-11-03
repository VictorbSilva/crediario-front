import { describe, expect, it } from 'vitest'
import { deveChecarAtualizacao, INTERVALO_DE_CHECAGEM_MS, INTERVALO_MINIMO_MS } from './atualizacao'

const MINUTO = 60 * 1000
const ULTIMA = 1_700_000_000_000

const sinais = {
  online: true,
  instalando: false,
  ultimaChecagem: ULTIMA,
  agora: ULTIMA + INTERVALO_MINIMO_MS,
}

describe('intervalos da checagem de atualização', () => {
  it('checa de hora em hora, com no mínimo 5 minutos entre duas checagens', () => {
    expect(INTERVALO_DE_CHECAGEM_MS).toBe(3_600_000)
    expect(INTERVALO_MINIMO_MS).toBe(300_000)
  })
})

describe('deveChecarAtualizacao', () => {
  it('na primeira checagem, online e sem worker instalando, checa', () => {
    expect(deveChecarAtualizacao({ ...sinais, ultimaChecagem: null })).toBe(true)
  })

  it('offline não checa, nem na primeira vez', () => {
    expect(deveChecarAtualizacao({ ...sinais, online: false })).toBe(false)
    expect(deveChecarAtualizacao({ ...sinais, online: false, ultimaChecagem: null })).toBe(false)
  })

  it('com um worker novo já instalando, não checa de novo, nem na primeira vez', () => {
    expect(deveChecarAtualizacao({ ...sinais, instalando: true })).toBe(false)
    expect(deveChecarAtualizacao({ ...sinais, instalando: true, ultimaChecagem: null })).toBe(false)
  })

  it('4 minutos depois da última checagem ainda não checa', () => {
    expect(deveChecarAtualizacao({ ...sinais, agora: ULTIMA + 4 * MINUTO })).toBe(false)
  })

  it('a 1 ms dos 5 minutos ainda não checa; com 5 minutos exatos, checa', () => {
    expect(deveChecarAtualizacao({ ...sinais, agora: ULTIMA + INTERVALO_MINIMO_MS - 1 })).toBe(false)
    expect(deveChecarAtualizacao({ ...sinais, agora: ULTIMA + 5 * MINUTO })).toBe(true)
  })

  it('logo depois da última checagem não checa', () => {
    expect(deveChecarAtualizacao({ ...sinais, agora: ULTIMA })).toBe(false)
  })

  it('uma hora depois, checa', () => {
    expect(deveChecarAtualizacao({ ...sinais, agora: ULTIMA + INTERVALO_DE_CHECAGEM_MS })).toBe(true)
  })
})
