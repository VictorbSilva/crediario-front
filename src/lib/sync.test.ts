import { describe, expect, it } from 'vitest'
import { avisoDeConferencia, confiancaDaLista, estadoDeSync } from './sync'

const sinais = {
  carregando: false,
  erro: false,
  pendentes: 0,
  doCache: false,
}

describe('estadoDeSync', () => {
  it('mostra "sincronizando" enquanto o primeiro snapshot não chegou', () => {
    expect(estadoDeSync({ ...sinais, carregando: true })).toBe('sincronizando')
    expect(estadoDeSync({ ...sinais, carregando: true, erro: true })).toBe('sincronizando')
  })

  it('mostra "erro" acima de qualquer outro estado já carregado', () => {
    expect(estadoDeSync({ ...sinais, erro: true, pendentes: 3, doCache: true })).toBe('erro')
  })

  it('prefere "offline" a "pendente" quando o snapshot veio do cache', () => {
    expect(estadoDeSync({ ...sinais, doCache: true })).toBe('offline')
    expect(estadoDeSync({ ...sinais, doCache: true, pendentes: 3 })).toBe('offline')
  })

  it('mostra "pendente" quando há escrita não confirmada com o servidor respondendo', () => {
    expect(estadoDeSync({ ...sinais, pendentes: 1 })).toBe('pendente')
  })

  it('mostra "sincronizado" quando não há nada pendente nem cache', () => {
    expect(estadoDeSync(sinais)).toBe('sincronizado')
  })
})

describe('confiancaDaLista', () => {
  it('não sabe nada antes do primeiro snapshot', () => {
    expect(
      confiancaDaLista({ carregando: true, doCache: true, jaSincronizouNesteAparelho: true }),
    ).toBe('desconhecida')
  })

  it('confia num snapshot confirmado pelo servidor', () => {
    expect(
      confiancaDaLista({ carregando: false, doCache: false, jaSincronizouNesteAparelho: false }),
    ).toBe('confiavel')
  })

  it('confia no cache de um aparelho que já sincronizou alguma vez', () => {
    expect(
      confiancaDaLista({ carregando: false, doCache: true, jaSincronizouNesteAparelho: true }),
    ).toBe('confiavel')
  })

  it('desconfia do cache de um aparelho que nunca sincronizou', () => {
    expect(
      confiancaDaLista({ carregando: false, doCache: true, jaSincronizouNesteAparelho: false }),
    ).toBe('parcial')
  })
})

describe('avisoDeConferencia', () => {
  it('cala a boca só quando a lista é confiável', () => {
    expect(avisoDeConferencia('confiavel')).toBeNull()
    expect(avisoDeConferencia('desconhecida')).toBeTypeOf('string')
    expect(avisoDeConferencia('parcial')).toBeTypeOf('string')
  })
})
