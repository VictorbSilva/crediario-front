import { describe, expect, it } from 'vitest'
import { identificarDispositivo } from './dispositivo'

describe('identificarDispositivo', () => {
  it('devolve 8 caracteres hexadecimais, dentro do limite de atualizadoPor', () => {
    const id = identificarDispositivo()

    expect(id).toMatch(/^[0-9a-f]{8}$/)
    expect(id.length).toBeLessThanOrEqual(64)
  })

  it('devolve sempre o mesmo id sem localStorage disponível', () => {
    expect(identificarDispositivo()).toBe(identificarDispositivo())
  })
})
