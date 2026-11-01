import { describe, expect, it } from 'vitest'
import { dadosDaLoja, ehProducao } from './ambiente'

describe('dadosDaLoja', () => {
  it('apara o texto e omite valores vazios ou ausentes', () => {
    expect(dadosDaLoja({ VITE_LOJA_NOME: ' Loja X ', VITE_LOJA_CNPJ: '', VITE_LOJA_TELEFONE: undefined }))
      .toEqual({ nome: 'Loja X' })
    expect(dadosDaLoja({ VITE_LOJA_NOME: ' ', VITE_LOJA_CNPJ: ' ', VITE_LOJA_TELEFONE: '' })).toEqual({})
    expect(dadosDaLoja({})).toEqual({})
  })

  it('inclui CNPJ e telefone somente quando informados', () => {
    expect(dadosDaLoja({ VITE_LOJA_CNPJ: ' CNPJ de teste ', VITE_LOJA_TELEFONE: ' telefone de teste ' }))
      .toEqual({ cnpj: 'CNPJ de teste', telefone: 'telefone de teste' })
  })
})

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
