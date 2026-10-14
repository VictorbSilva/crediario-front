import { describe, expect, it } from 'vitest'
import {
  ENTRADA_CLIENTE_VAZIA,
  clienteComNumero,
  entradaDoCliente,
  montarCamposCliente,
  montarEdicaoCliente,
  parseNumeroCadastro,
  validarCliente,
  validarEdicaoCliente,
} from './cliente'
import type { ClienteConhecido, EntradaCliente } from './cliente'
import { normalizar } from './texto'

const CONTEXTO = { agora: new Date(2026, 8, 21, 15, 30), dispositivo: 'a1b2c3d4' }

const lista: ClienteConhecido[] = [
  { numero: 137, nome: 'Maria Aparecida Santos' },
  { numero: 88, nome: 'João Batista Lima' },
  { numero: 412, nome: 'Registro errado', arquivado: true },
]

function entrada(partes: Partial<EntradaCliente> = {}): EntradaCliente {
  return { ...ENTRADA_CLIENTE_VAZIA, numero: '500', nome: 'Ana Paula Ferreira', ...partes }
}

describe('ENTRADA_CLIENTE_VAZIA', () => {
  it('começa sem dias de visita', () => {
    expect(ENTRADA_CLIENTE_VAZIA.diasDeVisita).toEqual([])
  })
})

describe('entradaDoCliente', () => {
  it('preenche a entrada com os dados existentes e deixa opcionais ausentes em branco', () => {
    expect(entradaDoCliente({ numero: 12, nome: 'Ana', telefone: '(83) 99999-0000' })).toEqual({
      numero: '12',
      nome: 'Ana',
      telefone: '(83) 99999-0000',
      cpf: '',
      endereco: '',
      observacao: '',
      diasDeVisita: [],
    })
  })

  it('preserva todos os opcionais preenchidos', () => {
    const dados = entrada({
      telefone: '9999',
      cpf: '529.982.247-25',
      endereco: 'Rua A',
      observacao: 'Aviso',
      diasDeVisita: [5, 20],
    })
    expect(entradaDoCliente({ ...dados, numero: 500 })).toEqual(dados)
  })

  it('copia a lista de dias sem compartilhar o array do cliente', () => {
    const diasDeVisita = [5, 20]
    const dados = entradaDoCliente({ numero: 500, nome: 'Ana', diasDeVisita })

    expect(dados.diasDeVisita).toEqual([5, 20])
    expect(dados.diasDeVisita).not.toBe(diasDeVisita)
  })
})

describe('validarEdicaoCliente', () => {
  it.each(['', 'abc', '137'])('ignora o número %j, sem devolver a chave numero', (numero) => {
    expect(validarEdicaoCliente(entrada({ numero }))).toEqual({})
  })

  it.each([
    { nome: '  ' },
    { nome: 'a'.repeat(121) },
    { nome: '\u0301\u0302' },
    { telefone: 'a'.repeat(41) },
    { telefone: '1'.repeat(21) },
    { cpf: 'a'.repeat(21) },
    { cpf: '529.982.247' },
    { cpf: '529.982.247-24' },
    { cpf: '123456789012' },
    { endereco: 'a'.repeat(201) },
    { observacao: 'a'.repeat(501) },
  ])('devolve os mesmos erros do cadastro para %j', (partes) => {
    const dados = entrada(partes)
    const errosDoCadastro = validarCliente(dados, lista, 'confiavel')
    expect(Object.keys(errosDoCadastro)).not.toHaveLength(0)
    expect(validarEdicaoCliente(dados)).toEqual(errosDoCadastro)
    expect(validarEdicaoCliente({ ...dados, numero: '' })).toEqual(errosDoCadastro)
  })
})

describe('montarEdicaoCliente', () => {
  const contexto = { ...CONTEXTO, dispositivo: 'abc' }

  it('limpa os dados preenchidos e deriva os campos de busca do novo conteúdo', () => {
    const { definir, remover } = montarEdicaoCliente(
      entrada({
        nome: '  Joana   Cláudia  ',
        telefone: '  (83) 99999-0000  ',
        cpf: ' 529.982.247-25 ',
        endereco: ' Rua A ',
        observacao: ' Aviso ',
      }),
      contexto,
    )
    expect(definir).toEqual({
      nome: 'Joana Cláudia',
      nomeBusca: normalizar('Joana Cláudia'),
      telefone: '(83) 99999-0000',
      telefoneDigits: '83999990000',
      cpf: '529.982.247-25',
      cpfDigits: '52998224725',
      endereco: 'Rua A',
      observacao: 'Aviso',
      atualizadoPor: 'abc',
    })
    expect(remover).toEqual(['diasDeVisita', 'rotaDesde'])
  })

  it.each(['', '   '])('remove opcionais apagados (%j), incluindo os pares de dígitos', (vazio) => {
    const { definir, remover } = montarEdicaoCliente(
      entrada({ telefone: vazio, cpf: vazio, endereco: vazio, observacao: vazio }),
      contexto,
    )
    expect(definir).toEqual({
      nome: 'Ana Paula Ferreira',
      nomeBusca: normalizar('Ana Paula Ferreira'),
      atualizadoPor: 'abc',
    })
    expect(remover.sort()).toEqual([
      'cpf',
      'cpfDigits',
      'diasDeVisita',
      'endereco',
      'observacao',
      'rotaDesde',
      'telefone',
      'telefoneDigits',
    ])
  })

  it('remove dígitos antigos quando o texto novo não tem dígitos', () => {
    const { definir, remover } = montarEdicaoCliente(
      entrada({
        telefone: ' sem telefone ',
        cpf: ' sem CPF ',
        endereco: 'Rua A',
        observacao: 'Aviso',
      }),
      contexto,
    )
    expect(definir.telefone).toBe('sem telefone')
    expect(definir.cpf).toBe('sem CPF')
    expect(definir).not.toHaveProperty('telefoneDigits')
    expect(definir).not.toHaveProperty('cpfDigits')
    expect(remover.sort()).toEqual(['cpfDigits', 'diasDeVisita', 'rotaDesde', 'telefoneDigits'])
  })

  it('nunca define o número, datas de cadastro e criação ou o arquivamento', () => {
    const { definir } = montarEdicaoCliente(entrada({ numero: '' }), contexto)
    for (const campo of ['numero', 'cadastradoEm', 'arquivado', 'criadoEm']) {
      expect(definir).not.toHaveProperty(campo)
    }
  })

  it('recusa nome feito só de acentos combinantes', () => {
    expect(() => montarEdicaoCliente(entrada({ nome: '\u0301\u0302' }), contexto)).toThrow(TypeError)
  })

  it('não monta alterações quando o conteúdo limpo continua igual ao da abertura', () => {
    const original = entrada({ nome: 'Ana Paula', telefone: '9999' })
    expect(montarEdicaoCliente(
      { ...original, nome: ' Ana   Paula ', telefone: ' 9999 ', endereco: '  ' },
      contexto,
      original,
    )).toEqual({ definir: { atualizadoPor: 'abc' }, remover: [] })
  })

  it('envia só o endereço alterado, preservando dados atualizados em outro aparelho', () => {
    const original = entrada({ telefone: '9999', endereco: 'Rua A', diasDeVisita: [5, 20] })
    const edicao = montarEdicaoCliente(
      { ...original, endereco: 'Rua B', diasDeVisita: [20, 5] }, contexto, original,
    )
    expect(edicao).toEqual({ definir: { endereco: 'Rua B', atualizadoPor: 'abc' }, remover: [] })
    const documentoAtual = { nome: 'Nome novo', telefone: '8888', telefoneDigits: '8888' }
    expect({ ...documentoAtual, ...edicao.definir }).toMatchObject(documentoAtual)
  })

  it('mantém nome e nomeBusca juntos quando só a grafia do nome muda', () => {
    const original = entrada({ nome: 'Ana' })
    expect(montarEdicaoCliente({ ...original, nome: 'Ána' }, contexto, original)).toEqual({
      definir: { nome: 'Ána', nomeBusca: 'ana', atualizadoPor: 'abc' }, remover: [],
    })
  })

  it('remove somente os opcionais apagados na edição', () => {
    const original = entrada({ telefone: '9999', cpf: '529.982.247-25' })
    expect(montarEdicaoCliente({ ...original, telefone: '' }, contexto, original)).toEqual({
      definir: { atualizadoPor: 'abc' }, remover: ['telefone', 'telefoneDigits'],
    })
  })

  it('remove o derivado antigo quando um texto alterado não tem dígitos', () => {
    const original = entrada({ telefone: 'sem número' })
    expect(montarEdicaoCliente({ ...original, telefone: 'recado' }, contexto, original)).toEqual({
      definir: { telefone: 'recado', atualizadoPor: 'abc' }, remover: ['telefoneDigits'],
    })
  })

  it('preserva os campos de rota quando os dias continuam iguais em outra ordem', () => {
    const original = entrada({ diasDeVisita: [5, 20] })
    const edicao = montarEdicaoCliente({ ...original, diasDeVisita: [20, 5] }, contexto, original)

    expect(edicao).toEqual({ definir: { atualizadoPor: 'abc' }, remover: [] })
  })

  it('ordena dias alterados e recomeça a rota na data local do aparelho', () => {
    const original = entrada({ diasDeVisita: [5, 20] })
    const edicao = montarEdicaoCliente(
      { ...original, diasDeVisita: [31, 10] },
      { ...contexto, agora: new Date(2026, 8, 21, 23, 40) },
      original,
    )

    expect(edicao).toEqual({
      definir: { diasDeVisita: [10, 31], rotaDesde: '2026-09-21', atualizadoPor: 'abc' },
      remover: [],
    })
  })

  it('remove diasDeVisita e rotaDesde quando a lista é esvaziada', () => {
    const original = entrada({ diasDeVisita: [5, 20] })
    const edicao = montarEdicaoCliente({ ...original, diasDeVisita: [] }, contexto, original)

    expect(edicao).toEqual({
      definir: { atualizadoPor: 'abc' }, remover: ['diasDeVisita', 'rotaDesde'],
    })
  })

  it('não altera a rota de cliente que continua sem dias de visita', () => {
    const original = entradaDoCliente({ numero: 500, nome: 'Ana Paula Ferreira' })

    expect(montarEdicaoCliente(entrada({ diasDeVisita: [] }), contexto, original)).toEqual({
      definir: { atualizadoPor: 'abc' }, remover: [],
    })
  })

  it('envia os dias e o início da rota quando não recebe a entrada original', () => {
    const { definir, remover } = montarEdicaoCliente(entrada({ diasDeVisita: [20, 5] }), contexto)

    expect(definir).toMatchObject({ diasDeVisita: [5, 20], rotaDesde: '2026-09-21' })
    expect(remover).not.toContain('diasDeVisita')
    expect(remover).not.toContain('rotaDesde')
  })
})

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
  it('ordena os dias de visita e grava o início da rota na data local do aparelho', () => {
    const campos = montarCamposCliente(entrada({ diasDeVisita: [20, 5] }), {
      ...CONTEXTO,
      agora: new Date(2026, 8, 21, 23, 40),
    })

    expect(campos).toMatchObject({ diasDeVisita: [5, 20], rotaDesde: '2026-09-21' })
  })

  it('omite diasDeVisita e rotaDesde quando a lista está vazia', () => {
    const campos = montarCamposCliente(entrada({ diasDeVisita: [] }), CONTEXTO)

    expect(campos).not.toHaveProperty('diasDeVisita')
    expect(campos).not.toHaveProperty('rotaDesde')
  })

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
