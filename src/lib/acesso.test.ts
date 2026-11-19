import { describe, expect, it } from 'vitest'
import {
  EMPRESA_TREINO,
  PERMISSOES_DO_DONO,
  UID_DONO,
  UID_TESTE,
  acessoDoMembro,
  ehDonoNoApp,
} from './acesso'

const permissoes = { financeiro: false, caixaDoDia: true, exportar: false }

describe('literais do dono', () => {
  it('são os mesmos de ehDono() e ehTesteNoTreino() no firestore.rules', () => {
    expect(UID_DONO).toBe('zQKH3lJ6mtYu5uE32PeHcUGZEEs1')
    expect(UID_TESTE).toBe('B3HGx0RggpXWzy400742432aLw72')
    expect(EMPRESA_TREINO).toBe('loja-treino')
  })

  it('o dono tem as três permissões', () => {
    expect(PERMISSOES_DO_DONO).toEqual({ financeiro: true, caixaDoDia: true, exportar: true })
  })
})

describe('ehDonoNoApp', () => {
  it('o dono é dono em qualquer loja', () => {
    expect(ehDonoNoApp(UID_DONO, 'loja-principal')).toBe(true)
    expect(ehDonoNoApp(UID_DONO, EMPRESA_TREINO)).toBe(true)
    expect(ehDonoNoApp(UID_DONO, 'loja-do-vizinho')).toBe(true)
  })

  it('a conta de testes é dona só na loja-treino', () => {
    expect(ehDonoNoApp(UID_TESTE, EMPRESA_TREINO)).toBe(true)
    expect(ehDonoNoApp(UID_TESTE, 'loja-principal')).toBe(false)
  })

  it('qualquer outra conta não é dona, nem na loja-treino', () => {
    expect(ehDonoNoApp('funcionario-1', 'loja-principal')).toBe(false)
    expect(ehDonoNoApp('funcionario-1', EMPRESA_TREINO)).toBe(false)
  })
})

describe('acessoDoMembro', () => {
  it('documento ausente no cache ainda não diz nada: o servidor pode ter', () => {
    expect(acessoDoMembro({ existe: false, doCache: true, dados: undefined })).toEqual({
      estado: 'carregando',
    })
  })

  it('documento ausente no servidor é conta sem cadastro na loja', () => {
    expect(acessoDoMembro({ existe: false, doCache: false, dados: undefined })).toEqual({
      estado: 'sem-acesso',
      motivo: 'sem-cadastro',
    })
  })

  it.each([
    ['false', false],
    ['ausente', undefined],
    ['texto "true"', 'true'],
    ['número 1', 1],
  ])('ativo %s é desativado, venha do cache ou do servidor', (_rotulo, ativo) => {
    for (const doCache of [true, false]) {
      expect(acessoDoMembro({ existe: true, doCache, dados: { ativo, permissoes } })).toEqual({
        estado: 'sem-acesso',
        motivo: 'desativado',
      })
    }
  })

  it('membro ativo é liberado, sem ser dono, com as permissões lidas', () => {
    expect(acessoDoMembro({ existe: true, doCache: false, dados: { ativo: true, permissoes } })).toEqual({
      estado: 'liberado',
      dono: false,
      permissoes,
    })
  })

  it('membro ativo vindo do cache já libera, para abrir offline', () => {
    expect(acessoDoMembro({ existe: true, doCache: true, dados: { ativo: true, permissoes } })).toEqual({
      estado: 'liberado',
      dono: false,
      permissoes,
    })
  })

  it.each([
    ['ausentes', undefined],
    ['não mapa', 'tudo'],
    ['nulas', null],
    ['com texto e número', { financeiro: 'true', caixaDoDia: 1, exportar: true }],
    ['faltando chaves', { exportar: true }],
  ])('permissões %s: só o que for true vale true', (_rotulo, lidas) => {
    const acesso = acessoDoMembro({ existe: true, doCache: false, dados: { ativo: true, permissoes: lidas } })
    const exportar = typeof lidas === 'object' && lidas !== null && lidas.exportar === true

    expect(acesso).toEqual({
      estado: 'liberado',
      dono: false,
      permissoes: { financeiro: false, caixaDoDia: false, exportar },
    })
  })

  it('existe sem dados lidos é desativado', () => {
    expect(acessoDoMembro({ existe: true, doCache: false, dados: undefined })).toEqual({
      estado: 'sem-acesso',
      motivo: 'desativado',
    })
  })
})
