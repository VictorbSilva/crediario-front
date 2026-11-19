import { describe, expect, it } from 'vitest'
import {
  LIMITES_MEMBRO,
  mensagemDoErroDeCadastro,
  montarCamposMembro,
  validarNovoMembro,
} from './equipe'
import type { EntradaNovoMembro } from './equipe'

function entrada(extra: Partial<EntradaNovoMembro> = {}): EntradaNovoMembro {
  return {
    nome: 'Maria Cobradora',
    email: 'maria@loja.com',
    senha: 'segredo',
    permissoes: { financeiro: false, caixaDoDia: true, exportar: false },
    ...extra,
  }
}

describe('validarNovoMembro', () => {
  it('aceita a entrada completa', () => {
    expect(validarNovoMembro(entrada())).toEqual({})
  })

  it('exige o nome, mesmo que só falte depois do trim', () => {
    expect(validarNovoMembro(entrada({ nome: '' })).nome).toBe('Digite o nome do funcionário.')
    expect(validarNovoMembro(entrada({ nome: '   ' })).nome).toBe('Digite o nome do funcionário.')
  })

  it('aceita nome com exatamente 80 caracteres depois do trim e recusa 81', () => {
    expect(LIMITES_MEMBRO.nome).toBe(80)
    expect(validarNovoMembro(entrada({ nome: `  ${'a'.repeat(80)}  ` })).nome).toBeUndefined()
    expect(validarNovoMembro(entrada({ nome: 'a'.repeat(81) })).nome).toBe(
      'Nome muito longo: máximo 80 caracteres.',
    )
  })

  it('exige o e-mail', () => {
    expect(validarNovoMembro(entrada({ email: '' })).email).toBe('Digite o e-mail do funcionário.')
    expect(validarNovoMembro(entrada({ email: '  ' })).email).toBe('Digite o e-mail do funcionário.')
  })

  it.each(['sem-arroba', 'a@b@c', 'com espaco@loja.com', 'maria@loja .com', '@loja.com', 'maria@'])(
    'recusa o e-mail %j, que a regra recusaria',
    (email) => {
      expect(validarNovoMembro(entrada({ email })).email).toBe('E-mail inválido.')
    },
  )

  it('aceita o menor e-mail que a regra aceita e espaço em volta', () => {
    expect(validarNovoMembro(entrada({ email: 'a@b' })).email).toBeUndefined()
    expect(validarNovoMembro(entrada({ email: '  maria@loja.com  ' })).email).toBeUndefined()
  })

  it('aceita e-mail com exatamente 254 caracteres e recusa 255', () => {
    expect(LIMITES_MEMBRO.email).toBe(254)
    const com254 = `${'a'.repeat(249)}@b.co`
    expect(com254).toHaveLength(254)

    expect(validarNovoMembro(entrada({ email: com254 })).email).toBeUndefined()
    expect(validarNovoMembro(entrada({ email: `a${com254}` })).email).toBe(
      'E-mail muito longo: máximo 254 caracteres.',
    )
  })

  it('aceita senha com exatamente 6 caracteres e recusa 5', () => {
    expect(LIMITES_MEMBRO.senhaMinima).toBe(6)
    expect(validarNovoMembro(entrada({ senha: '123456' })).senha).toBeUndefined()
    expect(validarNovoMembro(entrada({ senha: '12345' })).senha).toBe(
      'Senha fraca: use 6 caracteres ou mais.',
    )
    expect(validarNovoMembro(entrada({ senha: '' })).senha).toBe(
      'Senha fraca: use 6 caracteres ou mais.',
    )
  })

  it('recusa permissões com chave a mais, chave a menos ou valor que não é bool', () => {
    const comChaveAMais = { financeiro: true, caixaDoDia: true, exportar: true, admin: true }
    const semExportar = { financeiro: true, caixaDoDia: true }
    const comTexto = { financeiro: 'sim', caixaDoDia: true, exportar: true }

    for (const permissoes of [comChaveAMais, semExportar, comTexto, null]) {
      const erros = validarNovoMembro(
        entrada({ permissoes: permissoes as unknown as EntradaNovoMembro['permissoes'] }),
      )
      expect(erros.permissoes).toBe('Permissões inválidas.')
    }
  })

  it('aceita qualquer combinação dos três bool, inclusive todos desligados', () => {
    const permissoes = { financeiro: false, caixaDoDia: false, exportar: false }
    expect(validarNovoMembro(entrada({ permissoes }))).toEqual({})
  })

  it('devolve todos os erros de uma vez', () => {
    const erros = validarNovoMembro({
      nome: '',
      email: 'x',
      senha: '1',
      permissoes: {} as EntradaNovoMembro['permissoes'],
    })

    expect(Object.keys(erros).sort()).toEqual(['email', 'nome', 'permissoes', 'senha'])
  })
})

describe('montarCamposMembro', () => {
  it('grava nome com trim, e-mail com trim e minúsculo, ativo, permissões e o dispositivo', () => {
    const campos = montarCamposMembro(
      entrada({ nome: '  Maria Cobradora ', email: '  Maria@Loja.COM ' }),
      { dispositivo: 'abc12345' },
    )

    expect(campos).toEqual({
      nome: 'Maria Cobradora',
      email: 'maria@loja.com',
      ativo: true,
      permissoes: { financeiro: false, caixaDoDia: true, exportar: false },
      atualizadoPor: 'abc12345',
    })
  })

  it('nunca leva a senha para o documento', () => {
    const campos = montarCamposMembro(entrada(), { dispositivo: 'abc12345' })

    expect(campos).not.toHaveProperty('senha')
    expect(JSON.stringify(campos)).not.toContain('segredo')
  })

  it('copia só as três chaves de permissões, que é o que a regra aceita', () => {
    const permissoes = { financeiro: true, caixaDoDia: false, exportar: true, extra: true }
    const campos = montarCamposMembro(
      entrada({ permissoes: permissoes as EntradaNovoMembro['permissoes'] }),
      { dispositivo: 'abc12345' },
    )

    expect(campos.permissoes).toEqual({ financeiro: true, caixaDoDia: false, exportar: true })
  })
})

describe('mensagemDoErroDeCadastro', () => {
  it.each([
    ['auth/email-already-in-use', 'Este e-mail já tem conta.'],
    ['auth/invalid-email', 'E-mail inválido.'],
    ['auth/weak-password', 'Senha fraca: use 6 caracteres ou mais.'],
    ['auth/network-request-failed', 'Sem internet. Criar a conta precisa de conexão.'],
    [
      'auth/admin-restricted-operation',
      'A criação de contas está desligada no Firebase. Ligue em Authentication → Configurações → Ações do usuário.',
    ],
    ['auth/too-many-requests', 'Não foi possível criar a conta.'],
    ['', 'Não foi possível criar a conta.'],
    ['constructor', 'Não foi possível criar a conta.'],
  ])('%j vira %j', (codigo, mensagem) => {
    expect(mensagemDoErroDeCadastro(codigo)).toBe(mensagem)
  })
})
