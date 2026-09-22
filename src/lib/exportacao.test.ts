import { describe, expect, it } from 'vitest'
import {
  VERSAO_EXPORTACAO,
  nomeDoArquivo,
  paraCSV,
  paraJSON,
  resumoDaLista,
  situacaoExportacao,
} from './exportacao'
import type { ClienteExportavel } from './exportacao'

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

describe('paraJSON', () => {
  it('embrulha em envelope com versão, para poder evoluir depois', () => {
    const conteudo = JSON.parse(paraJSON([cliente()], AGORA))

    expect(conteudo.formato).toBe('crediario-clientes')
    expect(conteudo.versao).toBe(VERSAO_EXPORTACAO)
    expect(conteudo.quantidade).toBe(1)
    expect(conteudo.clientes).toHaveLength(1)
  })

  it('converte os carimbos para texto, que é o que o JSON sabe guardar', () => {
    const conteudo = JSON.parse(paraJSON([cliente()], AGORA))

    expect(conteudo.clientes[0].criadoEm).toBe('2026-09-21T18:30:00.000Z')
  })

  it('guarda null no carimbo que ainda não subiu, em vez de inventar data', () => {
    const conteudo = JSON.parse(paraJSON([cliente({ criadoEm: null })], AGORA))

    expect(conteudo.clientes[0].criadoEm).toBeNull()
  })

  it('não leva estado de tela para dentro do backup', () => {
    const comLixo = { ...cliente(), id: 'abc123', pendente: true } as ClienteExportavel
    const conteudo = JSON.parse(paraJSON([comLixo], AGORA))

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
    const conteudo = JSON.parse(paraJSON([cheio], AGORA))

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
    expect(nomeDoArquivo('json', AGORA)).toBe('crediario-clientes-2026-09-21.json')
    expect(nomeDoArquivo('csv', AGORA)).toBe('crediario-clientes-2026-09-21.csv')
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
