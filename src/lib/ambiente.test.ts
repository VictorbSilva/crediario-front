import { describe, expect, it } from 'vitest'
import { ehProducao } from './ambiente'

describe('ehProducao', () => {
  it('é produção com a empresa de produção', () => {
    expect(ehProducao({ VITE_BUSINESS_ID: 'loja-principal' })).toBe(true)
  })

  it('é produção com os emuladores explicitamente desligados', () => {
    expect(
      ehProducao({ VITE_BUSINESS_ID: 'loja-principal', VITE_USE_FIREBASE_EMULATORS: 'false' }),
    ).toBe(true)
  })

  it('emulador não é produção, mesmo com a empresa de produção', () => {
    expect(
      ehProducao({ VITE_BUSINESS_ID: 'loja-principal', VITE_USE_FIREBASE_EMULATORS: 'true' }),
    ).toBe(false)
  })

  it('a empresa de treino não é produção', () => {
    expect(ehProducao({ VITE_BUSINESS_ID: 'loja-treino' })).toBe(false)
  })

  it('empresa ausente ou vazia não é produção', () => {
    expect(ehProducao({})).toBe(false)
    expect(ehProducao({ VITE_BUSINESS_ID: '' })).toBe(false)
  })

  it('compara a empresa de forma exata', () => {
    expect(ehProducao({ VITE_BUSINESS_ID: 'Loja-Principal' })).toBe(false)
    expect(ehProducao({ VITE_BUSINESS_ID: ' loja-principal' })).toBe(false)
  })
})
