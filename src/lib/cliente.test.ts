import { describe, expect, it } from 'vitest'
import {
  ENTRADA_CLIENTE_VAZIA,
  clienteComNumero,
  montarCamposCliente,
  parseNumeroCadastro,
  validarCliente,
} from './cliente'
import type { ClienteConhecido, EntradaCliente } from './cliente'

const CONTEXTO = { agora: new Date(2026, 8, 21, 15, 30), dispositivo: 'a1b2c3d4' }

const lista: ClienteConhecido[] = [
  { numero: 137, nome: 'Maria Aparecida Santos' },
  { numero: 88, nome: 'João Batista Lima' },
  { numero: 412, nome: 'Registro errado', arquivado: true },
]

function entrada(partes: Partial<EntradaCliente> = {}): EntradaCliente {
  return { ...ENTRADA_CLIENTE_VAZIA, numero: '500', nome: 'Ana Paula Ferreira', ...partes }
}

describe('parseNumeroCadastro', () => {
  it('lê o número que o dono digita do caderno', () => {
    expect(parseNumeroCadastro('137')).toBe(137)
    expect(parseNumeroCadastro(' 137 ')).toBe(137)
    expect(parseNumeroCadastro('#137')).toBe(137)
    expect(parseNumeroCadastro('007')).toBe(7)
  })

  it('devolve null para campo vazio', () => {
    expect(parseNumeroCadastro('')).toBeNull()
    expect(parseNumeroCadastro('   ')).toBeNull()
  })

  it('recusa em vez de truncar como parseInt faria', () => {
    expect(parseNumeroCadastro('12abc')).toBeNull()
    expect(parseNumeroCadastro('1.5')).toBeNull()
    expect(parseNumeroCadastro('1,5')).toBeNull()
    expect(parseNumeroCadastro('12 34')).toBe(1234)
  })

  it('recusa zero e negativo, que a regra exige maiores que zero', () => {
    expect(parseNumeroCadastro('0')).toBeNull()
    expect(parseNumeroCadastro('-5')).toBeNull()
  })

  it('recusa inteiro fora da faixa segura', () => {
    expect(parseNumeroCadastro('99999999999999999999')).toBeNull()
  })
})

describe('clienteComNumero', () => {
  it('encontra o dono do número', () => {
    expect(clienteComNumero(lista, 137)?.nome).toBe('Maria Aparecida Santos')
  })

  it('devolve undefined quando o número está livre', () => {
    expect(clienteComNumero(lista, 999)).toBeUndefined()
  })

  it('ignora arquivado, senão um erro de digitação queimaria o número para sempre', () => {
    expect(clienteComNumero(lista, 412)).toBeUndefined()
  })
})

describe('validarCliente', () => {
  it('aceita um cadastro completo e válido', () => {
    expect(validarCliente(entrada(), lista, 'confiavel')).toEqual({})
  })

  it('exige número e nome', () => {
    const erros = validarCliente(entrada({ numero: '', nome: '  ' }), lista, 'confiavel')

    expect(erros.numero).toBeTypeOf('string')
    expect(erros.nome).toBeTypeOf('string')
  })

  it('recusa número que já é de um cliente ativo, dizendo de quem é', () => {
    const erros = validarCliente(entrada({ numero: '137' }), lista, 'confiavel')

    expect(erros.numero).toContain('137')
    expect(erros.numero).toContain('Maria Aparecida Santos')
  })

  it('aceita o número de um cliente arquivado', () => {
    expect(validarCliente(entrada({ numero: '412' }), lista, 'confiavel').numero).toBeUndefined()
  })

  it('bloqueia o salvamento enquanto a lista não carregou', () => {
    const erros = validarCliente(entrada({ numero: '999' }), [], 'desconhecida')

    expect(erros.numero).toBeTypeOf('string')
  })

  it('deixa salvar com lista parcial, porque offline é o caso comum', () => {
    expect(validarCliente(entrada({ numero: '999' }), [], 'parcial')).toEqual({})
  })

  it('recusa nome acima do limite da regra', () => {
    expect(validarCliente(entrada({ nome: 'a'.repeat(121) }), lista, 'confiavel').nome).toBeTypeOf(
      'string',
    )
    expect(
      validarCliente(entrada({ nome: 'a'.repeat(120) }), lista, 'confiavel').nome,
    ).toBeUndefined()
  })

  it('recusa nome que viraria nomeBusca vazio e seria negado pela regra', () => {
    expect(validarCliente(entrada({ nome: '́̂' }), lista, 'confiavel').nome).toBeTypeOf(
      'string',
    )
  })

  it('aceita CPF vazio, porque o campo é opcional', () => {
    expect(validarCliente(entrada({ cpf: '' }), lista, 'confiavel').cpf).toBeUndefined()
  })

  it('aceita CPF com dígito verificador correto, formatado ou cru', () => {
    expect(validarCliente(entrada({ cpf: '529.982.247-25' }), lista, 'confiavel').cpf).toBeUndefined()
    expect(validarCliente(entrada({ cpf: '52998224725' }), lista, 'confiavel').cpf).toBeUndefined()
  })

  it('bloqueia CPF com dígito verificador errado', () => {
    expect(validarCliente(entrada({ cpf: '529.982.247-24' }), lista, 'confiavel').cpf).toBe(
      'Digite um CPF válido.',
    )
  })

  it('bloqueia CPF incompleto com mensagem própria', () => {
    expect(validarCliente(entrada({ cpf: '529.982.247' }), lista, 'confiavel').cpf).toBe(
      'CPF incompleto: faltam dígitos.',
    )
  })

  it('bloqueia CPF com mais dígitos do que cpfDigits aceita', () => {
    expect(validarCliente(entrada({ cpf: '123456789012' }), lista, 'confiavel').cpf).toBeTypeOf(
      'string',
    )
  })

  it('recusa endereço e observação acima do limite da regra', () => {
    const erros = validarCliente(
      entrada({ endereco: 'a'.repeat(201), observacao: 'a'.repeat(501) }),
      lista,
      'confiavel',
    )

    expect(erros.endereco).toBeTypeOf('string')
    expect(erros.observacao).toBeTypeOf('string')
  })
})

describe('montarCamposCliente', () => {
  it('monta o documento cheio com os derivados certos', () => {
    const campos = montarCamposCliente(
      entrada({
        numero: '#137',
        nome: '  Maria   Aparecida  Santos ',
        telefone: '(62) 98114-2270',
        cpf: '529.982.247-25',
        endereco: 'Rua das Acácias, 412',
        observacao: 'Paga sempre no dia 5',
      }),
      CONTEXTO,
    )

    expect(campos).toEqual({
      numero: 137,
      nome: 'Maria Aparecida Santos',
      nomeBusca: 'maria aparecida santos',
      telefone: '(62) 98114-2270',
      telefoneDigits: '62981142270',
      cpf: '529.982.247-25',
      cpfDigits: '52998224725',
      endereco: 'Rua das Acácias, 412',
      observacao: 'Paga sempre no dia 5',
      arquivado: false,
      cadastradoEm: '2026-09-21',
      atualizadoPor: 'a1b2c3d4',
    })
  })

  it('omite os opcionais em vez de gravar string vazia', () => {
    const campos = montarCamposCliente(entrada(), CONTEXTO)

    expect(Object.keys(campos).sort()).toEqual([
      'arquivado',
      'atualizadoPor',
      'cadastradoEm',
      'nome',
      'nomeBusca',
      'numero',
    ])
  })

  it('grava arquivado: false explícito, para não existir documento sem o campo', () => {
    expect(montarCamposCliente(entrada(), CONTEXTO).arquivado).toBe(false)
  })

  it('usa a data local do aparelho, não a da sincronização', () => {
    const campos = montarCamposCliente(entrada(), {
      ...CONTEXTO,
      agora: new Date(2026, 8, 21, 23, 40),
    })

    expect(campos.cadastradoEm).toBe('2026-09-21')
  })

  it('explode em vez de montar documento com número que não passou na validação', () => {
    expect(() => montarCamposCliente(entrada({ numero: 'abc' }), CONTEXTO)).toThrow(TypeError)
  })
})
