import { describe, expect, it } from 'vitest'
import {
  VERSAO_EXPORTACAO,
  conferenciaDoCarne,
  nomeDoArquivo,
  paraCSV,
  paraJSON,
  resumoDaLista,
  serializar,
  situacaoDoBackup,
  situacaoExportacao,
} from './exportacao'
import type { CarneExportavel, ClienteExportavel, DocumentoExportavel } from './exportacao'

function carimbo(iso: string) {
  return { toDate: () => new Date(iso) }
}

function cliente(partes: Partial<ClienteExportavel> = {}): ClienteExportavel {
  return {
    numero: 137,
    nome: 'Maria Aparecida Santos',
    cadastradoEm: '2026-09-21',
    criadoEm: carimbo('2026-09-21T18:30:00.000Z'),
    atualizadoEm: carimbo('2026-09-21T18:30:00.000Z'),
    atualizadoPor: 'a1b2c3d4',
    ...partes,
  }
}

const AGORA = new Date(2026, 8, 21, 15, 30)

const SEM_CARNE: CarneExportavel = { vendas: [], parcelas: [], pagamentos: [] }

function documento(id: string, dados: Record<string, unknown>): DocumentoExportavel {
  return { id, dados }
}

function vendaCom(id: string, numeroParcelas: unknown): DocumentoExportavel {
  return documento(id, { clientId: 'c1', numeroParcelas })
}

function parcelas(quantidade: number): DocumentoExportavel[] {
  return Array.from({ length: quantidade }, (_, i) => documento(`p${i}`, { numero: i + 1 }))
}

describe('paraCSV', () => {
  it('começa com BOM, para o Excel não comer os acentos', () => {
    expect(paraCSV([cliente()]).startsWith('﻿')).toBe(true)
  })

  it('separa por ponto e vírgula, que é o que o Excel em pt-BR espera', () => {
    const linhas = paraCSV([cliente()]).replace('﻿', '').split('\r\n')

    expect(linhas[0]).toBe(
      'numero;nome;telefone;cpf;endereco;observacao;arquivado;cadastradoEm;criadoEm;atualizadoEm;atualizadoPor',
    )
    expect(linhas[1].startsWith('137;Maria Aparecida Santos;')).toBe(true)
  })

  it('escreve arquivado como sim ou não, para o dono ler', () => {
    const ativo = paraCSV([cliente()]).split('\r\n')[1]
    const arquivado = paraCSV([cliente({ arquivado: true })]).split('\r\n')[1]

    expect(ativo).toContain(';não;')
    expect(arquivado).toContain(';sim;')
  })

  it('deixa célula vazia onde o campo opcional não existe', () => {
    const linha = paraCSV([cliente()]).split('\r\n')[1]

    expect(linha).toContain('137;Maria Aparecida Santos;;;;;')
  })

  it('protege o campo que contém o próprio separador', () => {
    const linha = paraCSV([cliente({ observacao: 'Paga dia 5; às vezes dia 6' })]).split('\r\n')[1]

    expect(linha).toContain('"Paga dia 5; às vezes dia 6"')
  })

  it('dobra as aspas de dentro do campo', () => {
    const linha = paraCSV([cliente({ nome: 'Maria "Bié" Santos' })]).split('\r\n')[1]

    expect(linha).toContain('"Maria ""Bié"" Santos"')
  })

  it('protege quebra de linha dentro da observação', () => {
    const csv = paraCSV([cliente({ observacao: 'primeira\nsegunda' })])

    expect(csv).toContain('"primeira\nsegunda"')
  })

  it('deixa a data em branco quando o carimbo ainda não subiu', () => {
    const linha = paraCSV([cliente({ criadoEm: null, atualizadoEm: null })]).split('\r\n')[1]

    expect(linha.endsWith(';;;a1b2c3d4')).toBe(true)
  })
})

describe('serializar', () => {
  it('converte carimbo aninhado para ISO', () => {
    const valor = { venda: { criadoEm: { toDate: () => new Date('2026-10-13T12:00:00Z') } } }

    expect(serializar(valor)).toEqual({ venda: { criadoEm: '2026-10-13T12:00:00.000Z' } })
  })

  it('deixa null, número, texto e booleano como estão', () => {
    expect(serializar(null)).toBeNull()
    expect(serializar(5000)).toBe(5000)
    expect(serializar('2026-11-05')).toBe('2026-11-05')
    expect(serializar(false)).toBe(false)
    expect(serializar({ a: null, b: 1, c: 'x', d: true })).toEqual({ a: null, b: 1, c: 'x', d: true })
  })

  it('converte carimbo dentro de lista', () => {
    const valor = [1, carimbo('2026-10-13T12:00:00Z'), { quando: carimbo('2026-10-14T00:00:00Z') }]

    expect(serializar(valor)).toEqual([
      1,
      '2026-10-13T12:00:00.000Z',
      { quando: '2026-10-14T00:00:00.000Z' },
    ])
  })
})

describe('paraJSON', () => {
  it('embrulha em envelope com versão, para poder evoluir depois', () => {
    const carne: CarneExportavel = {
      vendas: [vendaCom('v1', 2)],
      parcelas: parcelas(2),
      pagamentos: [documento('g1', { valorCentavos: 5000 })],
    }
    const conteudo = JSON.parse(paraJSON([cliente()], carne, AGORA))

    expect(conteudo.formato).toBe('crediario-backup')
    expect(conteudo.versao).toBe(2)
    expect(conteudo.versao).toBe(VERSAO_EXPORTACAO)
    expect(conteudo.quantidades).toEqual({ clientes: 1, vendas: 1, parcelas: 2, pagamentos: 1 })
    expect(conteudo.clientes).toHaveLength(1)
    expect(conteudo.vendas).toHaveLength(1)
    expect(conteudo.parcelas).toHaveLength(2)
    expect(conteudo.pagamentos).toHaveLength(1)
  })

  it('leva o documento do carnê inteiro, com id e carimbos em texto', () => {
    const carne: CarneExportavel = {
      vendas: [
        documento('v1', {
          clientId: 'c1',
          numeroParcelas: 3,
          criadoEm: carimbo('2026-10-13T12:00:00Z'),
          atualizadoEm: null,
        }),
      ],
      parcelas: [documento('p1', { saleId: 'v1', vencimento: '2026-11-05' })],
      pagamentos: [documento('g1', { saleId: 'v1', valorCentavos: 5000, cancelado: false })],
    }
    const conteudo = JSON.parse(paraJSON([cliente()], carne, AGORA))

    expect(conteudo.vendas[0]).toEqual({
      id: 'v1',
      clientId: 'c1',
      numeroParcelas: 3,
      criadoEm: '2026-10-13T12:00:00.000Z',
      atualizadoEm: null,
    })
    expect(conteudo.parcelas[0]).toEqual({ id: 'p1', saleId: 'v1', vencimento: '2026-11-05' })
    expect(conteudo.pagamentos[0]).toEqual({
      id: 'g1',
      saleId: 'v1',
      valorCentavos: 5000,
      cancelado: false,
    })
  })

  it('preserva campo que este código ainda não conhece', () => {
    const carne: CarneExportavel = {
      ...SEM_CARNE,
      vendas: [documento('v1', { numeroParcelas: 3, cancelada: true })],
    }
    const conteudo = JSON.parse(paraJSON([cliente()], carne, AGORA))

    expect(conteudo.vendas[0].cancelada).toBe(true)
  })

  it('converte os carimbos para texto, que é o que o JSON sabe guardar', () => {
    const conteudo = JSON.parse(paraJSON([cliente()], SEM_CARNE, AGORA))

    expect(conteudo.clientes[0].criadoEm).toBe('2026-09-21T18:30:00.000Z')
  })

  it('guarda null no carimbo que ainda não subiu, em vez de inventar data', () => {
    const conteudo = JSON.parse(paraJSON([cliente({ criadoEm: null })], SEM_CARNE, AGORA))

    expect(conteudo.clientes[0].criadoEm).toBeNull()
  })

  it('não leva estado de tela para dentro do backup', () => {
    const comLixo = { ...cliente(), id: 'abc123', pendente: true } as ClienteExportavel
    const conteudo = JSON.parse(paraJSON([comLixo], SEM_CARNE, AGORA))

    expect(conteudo.clientes[0].id).toBe('abc123')
    expect('pendente' in conteudo.clientes[0]).toBe(false)
  })

  it('preserva todos os campos do cliente', () => {
    const cheio = cliente({
      telefone: '(62) 98114-2270',
      telefoneDigits: '62981142270',
      cpf: '529.982.247-25',
      cpfDigits: '52998224725',
      endereco: 'Rua das Acácias, 412',
      observacao: 'Paga sempre no dia 5',
      arquivado: false,
    })
    const conteudo = JSON.parse(paraJSON([cheio], SEM_CARNE, AGORA))

    expect(conteudo.clientes[0]).toMatchObject({
      numero: 137,
      telefoneDigits: '62981142270',
      cpfDigits: '52998224725',
      endereco: 'Rua das Acácias, 412',
      arquivado: false,
      cadastradoEm: '2026-09-21',
      atualizadoPor: 'a1b2c3d4',
    })
  })
})

describe('nomeDoArquivo', () => {
  it('usa a data local do aparelho', () => {
    expect(nomeDoArquivo('json', AGORA)).toBe('crediario-backup-2026-09-21.json')
    expect(nomeDoArquivo('csv', AGORA)).toBe('crediario-clientes-2026-09-21.csv')
  })
})

describe('conferenciaDoCarne', () => {
  it('não diz nada quando as parcelas fecham com o que as vendas anunciam', () => {
    expect(conferenciaDoCarne([vendaCom('v1', 3), vendaCom('v2', 2)], parcelas(5))).toBeNull()
    expect(conferenciaDoCarne([], [])).toBeNull()
  })

  it('avisa quantas parcelas faltam', () => {
    const mensagem = conferenciaDoCarne([vendaCom('v1', 3), vendaCom('v2', 2)], parcelas(3))

    expect(mensagem).toContain('faltam 2')
  })

  it('usa o singular quando falta uma só', () => {
    expect(conferenciaDoCarne([vendaCom('v1', 3)], parcelas(2))).toContain('falta 1')
  })

  it('avisa também quando sobra parcela, porque aí falta venda', () => {
    expect(conferenciaDoCarne([vendaCom('v1', 2)], parcelas(3))).not.toBeNull()
  })

  it('conta zero para numeroParcelas ausente ou que não é número', () => {
    const vendas = [vendaCom('v1', 2), documento('v2', { clientId: 'c1' }), vendaCom('v3', '4')]

    expect(conferenciaDoCarne(vendas, parcelas(2))).toBeNull()
  })
})

describe('situacaoDoBackup', () => {
  it('bloqueia enquanto o carnê não carregou', () => {
    const situacao = situacaoDoBackup({ confianca: 'desconhecida', pendentes: 0, conferencia: null })

    expect(situacao.pode).toBe(false)
    expect(!situacao.pode && situacao.motivo).toBeTruthy()
  })

  it('bloqueia quando a leitura do carnê falhou, em vez de sair sem ele', () => {
    const situacao = situacaoDoBackup({
      confianca: 'confiavel',
      pendentes: 0,
      conferencia: null,
      erro: 'Não foi possível carregar o carnê da empresa.',
    })

    expect(situacao.pode).toBe(false)
    expect(!situacao.pode && situacao.motivo).toContain('Não foi possível carregar o carnê')
  })

  it('deixa sair com carnê parcial, mas avisa', () => {
    const situacao = situacaoDoBackup({ confianca: 'parcial', pendentes: 0, conferencia: null })

    expect(situacao.pode).toBe(true)
    expect(situacao.pode && situacao.alerta).toContain('parte do carnê')
  })

  it('avisa sobre lançamentos que ainda não subiram, no singular e no plural', () => {
    const um = situacaoDoBackup({ confianca: 'confiavel', pendentes: 1, conferencia: null })
    const varios = situacaoDoBackup({ confianca: 'confiavel', pendentes: 3, conferencia: null })

    expect(um.pode && um.alerta).toContain('1 lançamento do carnê ainda não subiu')
    expect(varios.pode && varios.alerta).toContain('3 lançamentos do carnê ainda não subiram')
  })

  it('repete o aviso da conferência', () => {
    const situacao = situacaoDoBackup({
      confianca: 'confiavel',
      pendentes: 0,
      conferencia: 'faltam 2 parcelas',
    })

    expect(situacao.pode).toBe(true)
    expect(situacao.pode && situacao.alerta).toContain('faltam 2 parcelas')
  })

  it('sai calado quando o carnê é confiável, nada está pendente e as parcelas fecham', () => {
    expect(situacaoDoBackup({ confianca: 'confiavel', pendentes: 0, conferencia: null })).toEqual({
      pode: true,
      alerta: null,
    })
  })
})

describe('situacaoExportacao', () => {
  it('bloqueia enquanto a lista não carregou', () => {
    const situacao = situacaoExportacao('desconhecida', 10, 0)

    expect(situacao.pode).toBe(false)
  })

  it('bloqueia quando não há cliente nenhum', () => {
    expect(situacaoExportacao('confiavel', 0, 0).pode).toBe(false)
  })

  it('exporta calado quando a lista é confiável e nada está pendente', () => {
    const situacao = situacaoExportacao('confiavel', 10, 0)

    expect(situacao).toEqual({ pode: true, alerta: null })
  })

  it('deixa exportar com lista parcial, mas avisa que o backup pode sair incompleto', () => {
    const situacao = situacaoExportacao('parcial', 3, 0)

    expect(situacao.pode).toBe(true)
    expect(situacao.pode && situacao.alerta).toContain('parte dos clientes')
  })

  it('avisa sobre cadastros que ainda não subiram, no singular e no plural', () => {
    const um = situacaoExportacao('confiavel', 10, 1)
    const varios = situacaoExportacao('confiavel', 10, 4)

    expect(um.pode && um.alerta).toContain('1 cadastro ainda não subiu')
    expect(varios.pode && varios.alerta).toContain('4 cadastros ainda não subiram')
  })

  it('junta os dois avisos quando os dois valem', () => {
    const situacao = situacaoExportacao('parcial', 3, 2)

    expect(situacao.pode && situacao.alerta).toContain('parte dos clientes')
    expect(situacao.pode && situacao.alerta).toContain('2 cadastros')
  })
})

describe('resumoDaLista', () => {
  it('concorda em número com o que vai no arquivo', () => {
    expect(resumoDaLista(1, 0)).toBe('1 cliente')
    expect(resumoDaLista(4, 0)).toBe('4 clientes')
  })

  it('diz quantos estão arquivados, no singular e no plural', () => {
    expect(resumoDaLista(4, 1)).toBe('4 clientes, sendo 1 arquivado')
    expect(resumoDaLista(9, 2)).toBe('9 clientes, sendo 2 arquivados')
  })
})
