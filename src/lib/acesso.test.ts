import { describe, expect, it } from 'vitest'
import {
  EMPRESA_TREINO,
  PERMISSOES_DO_DONO,
  UID_DONO,
  UID_TESTE,
  acessoDoMembro,
  ehDonoNoApp,
  podeVer,
  veFinanceiro,
} from './acesso'
import type { Acesso, Permissoes } from './acesso'

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

function membro(permissoes: Permissoes): Acesso {
  return { estado: 'liberado', dono: false, permissoes }
}

const NENHUMA: Permissoes = { financeiro: false, caixaDoDia: false, exportar: false }

describe('podeVer', () => {
  it('o dono vê tudo', () => {
    const dono: Acesso = { estado: 'liberado', dono: true, permissoes: PERMISSOES_DO_DONO }

    expect(podeVer(dono, 'financeiro')).toBe(true)
    expect(podeVer(dono, 'caixaDoDia')).toBe(true)
    expect(podeVer(dono, 'exportar')).toBe(true)
  })

  it.each(['financeiro', 'caixaDoDia', 'exportar'] as const)('o membro vê %s só quando ela é true', (chave) => {
    expect(podeVer(membro({ ...NENHUMA, [chave]: true }), chave)).toBe(true)
    expect(podeVer(membro(NENHUMA), chave)).toBe(false)
  })

  it('uma permissão não libera as outras', () => {
    const soExportar = membro({ ...NENHUMA, exportar: true })

    expect(podeVer(soExportar, 'financeiro')).toBe(false)
    expect(podeVer(soExportar, 'caixaDoDia')).toBe(false)
  })

  it.each<Acesso>([
    { estado: 'carregando' },
    { estado: 'sem-acesso', motivo: 'desativado' },
  ])('sem acesso liberado ($estado), não vê nada', (acesso) => {
    expect(podeVer(acesso, 'financeiro')).toBe(false)
    expect(podeVer(acesso, 'caixaDoDia')).toBe(false)
    expect(podeVer(acesso, 'exportar')).toBe(false)
  })
})

describe('veFinanceiro', () => {
  it('basta financeiro ou caixa do dia para ver a tela', () => {
    expect(veFinanceiro(membro({ ...NENHUMA, financeiro: true }))).toBe(true)
    expect(veFinanceiro(membro({ ...NENHUMA, caixaDoDia: true }))).toBe(true)
    expect(veFinanceiro(membro({ ...NENHUMA, financeiro: true, caixaDoDia: true }))).toBe(true)
  })

  it('sem as duas não vê, mesmo podendo exportar', () => {
    expect(veFinanceiro(membro(NENHUMA))).toBe(false)
    expect(veFinanceiro(membro({ ...NENHUMA, exportar: true }))).toBe(false)
  })

  it('carregando não vê', () => {
    expect(veFinanceiro({ estado: 'carregando' })).toBe(false)
  })
})
