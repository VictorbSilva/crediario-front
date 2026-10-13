import { dataLocalISO } from './data'
import type { ConfiancaDaLista } from './sync'

export type CarimboExportavel = { toDate: () => Date } | null

export type ClienteExportavel = {
  id?: string
  numero: number
  nome: string
  telefone?: string
  telefoneDigits?: string
  cpf?: string
  cpfDigits?: string
  endereco?: string
  rotaId?: string | null
  observacao?: string
  arquivado?: boolean
  cadastradoEm: string
  criadoEm: CarimboExportavel
  atualizadoEm: CarimboExportavel
  atualizadoPor: string
}

export type DocumentoExportavel = { id: string; dados: Record<string, unknown> }

export type CarneExportavel = {
  vendas: readonly DocumentoExportavel[]
  parcelas: readonly DocumentoExportavel[]
  pagamentos: readonly DocumentoExportavel[]
}

export type SituacaoExportacao =
  | { pode: false; motivo: string }
  | { pode: true; alerta: string | null }

export const VERSAO_EXPORTACAO = 2

const COLUNAS = [
  'numero',
  'nome',
  'telefone',
  'cpf',
  'endereco',
  'observacao',
  'arquivado',
  'cadastradoEm',
  'criadoEm',
  'atualizadoEm',
  'atualizadoPor',
] as const

function iso(carimbo: CarimboExportavel): string | null {
  return carimbo ? carimbo.toDate().toISOString() : null
}

function campoCsv(valor: string): string {
  if (!/[;"\r\n]/.test(valor)) return valor
  return `"${valor.replaceAll('"', '""')}"`
}

function celula(cliente: ClienteExportavel, coluna: (typeof COLUNAS)[number]): string {
  switch (coluna) {
    case 'numero':
      return String(cliente.numero)
    case 'arquivado':
      return cliente.arquivado === true ? 'sim' : 'não'
    case 'criadoEm':
      return iso(cliente.criadoEm) ?? ''
    case 'atualizadoEm':
      return iso(cliente.atualizadoEm) ?? ''
    default:
      return cliente[coluna] ?? ''
  }
}

export function paraCSV(clientes: readonly ClienteExportavel[]): string {
  const linhas = [COLUNAS.join(';')]

  for (const cliente of clientes) {
    linhas.push(COLUNAS.map((coluna) => campoCsv(celula(cliente, coluna))).join(';'))
  }

  return '﻿' + linhas.join('\r\n') + '\r\n'
}

function ehCarimbo(valor: object): valor is { toDate: () => Date } {
  return 'toDate' in valor && typeof valor.toDate === 'function'
}

export function serializar(valor: unknown): unknown {
  if (typeof valor !== 'object' || valor === null) return valor
  if (ehCarimbo(valor)) return valor.toDate().toISOString()
  if (Array.isArray(valor)) return valor.map(serializar)

  return Object.fromEntries(
    Object.entries(valor).map(([campo, conteudo]) => [campo, serializar(conteudo)]),
  )
}

function documentoParaJSON({ id, dados }: DocumentoExportavel) {
  return { id, ...(serializar(dados) as Record<string, unknown>) }
}

export function paraJSON(
  clientes: readonly ClienteExportavel[],
  carne: CarneExportavel,
  agora: Date,
): string {
  const conteudo = {
    formato: 'crediario-backup',
    versao: VERSAO_EXPORTACAO,
    geradoEm: agora.toISOString(),
    quantidades: {
      clientes: clientes.length,
      vendas: carne.vendas.length,
      parcelas: carne.parcelas.length,
      pagamentos: carne.pagamentos.length,
    },
    clientes: clientes.map((cliente) => ({
      id: cliente.id,
      numero: cliente.numero,
      nome: cliente.nome,
      telefone: cliente.telefone,
      telefoneDigits: cliente.telefoneDigits,
      cpf: cliente.cpf,
      cpfDigits: cliente.cpfDigits,
      endereco: cliente.endereco,
      rotaId: cliente.rotaId,
      observacao: cliente.observacao,
      arquivado: cliente.arquivado,
      cadastradoEm: cliente.cadastradoEm,
      criadoEm: iso(cliente.criadoEm),
      atualizadoEm: iso(cliente.atualizadoEm),
      atualizadoPor: cliente.atualizadoPor,
    })),
    vendas: carne.vendas.map(documentoParaJSON),
    parcelas: carne.parcelas.map(documentoParaJSON),
    pagamentos: carne.pagamentos.map(documentoParaJSON),
  }

  return JSON.stringify(conteudo, null, 2)
}

export function nomeDoArquivo(extensao: 'json' | 'csv', agora: Date): string {
  const conteudo = extensao === 'json' ? 'backup' : 'clientes'
  return `crediario-${conteudo}-${dataLocalISO(agora)}.${extensao}`
}

export function conferenciaDoCarne(
  vendas: readonly DocumentoExportavel[],
  parcelas: readonly DocumentoExportavel[],
): string | null {
  const anunciadas = vendas.reduce((soma, { dados }) => {
    const numero = dados.numeroParcelas
    return typeof numero === 'number' && Number.isFinite(numero) ? soma + numero : soma
  }, 0)
  const diferenca = anunciadas - parcelas.length

  if (diferenca === 0) return null

  if (diferenca > 0) {
    const falta = diferenca === 1 ? 'falta 1' : `faltam ${diferenca}`
    return `As vendas somam ${anunciadas} parcelas, mas só ${parcelas.length} estão neste aparelho: ${falta}, e o arquivo sairia com carnê incompleto.`
  }

  const sobra = -diferenca === 1 ? '1 parcela' : `${-diferenca} parcelas`
  return `Há ${sobra} a mais do que as vendas somam: alguma venda ainda não chegou a este aparelho e sairia fora do arquivo.`
}

export type SinaisDoBackup = {
  confianca: ConfiancaDaLista
  pendentes: number
  conferencia: string | null
  erro?: string | null
}

export function situacaoDoBackup({
  confianca,
  pendentes,
  conferencia,
  erro = null,
}: SinaisDoBackup): SituacaoExportacao {
  if (erro) {
    return {
      pode: false,
      motivo: `${erro} O backup completo fica bloqueado para não sair sem as vendas e os pagamentos.`,
    }
  }

  if (confianca === 'desconhecida') {
    return {
      pode: false,
      motivo: 'As vendas e os pagamentos ainda estão carregando. Espere terminar para fazer o backup completo.',
    }
  }

  const alertas: string[] = []

  if (confianca === 'parcial') {
    alertas.push(
      'Este aparelho ainda não sincronizou as vendas e os pagamentos com o servidor, então o backup pode sair com apenas parte do carnê.',
    )
  }

  if (pendentes > 0) {
    alertas.push(
      pendentes === 1
        ? '1 lançamento do carnê ainda não subiu: no arquivo ele sai sem a data de sincronização.'
        : `${pendentes} lançamentos do carnê ainda não subiram: no arquivo eles saem sem a data de sincronização.`,
    )
  }

  if (conferencia) alertas.push(conferencia)

  return { pode: true, alerta: alertas.length > 0 ? alertas.join(' ') : null }
}

export function situacaoExportacao(
  confianca: ConfiancaDaLista,
  quantidade: number,
  pendentes: number,
): SituacaoExportacao {
  if (confianca === 'desconhecida') {
    return {
      pode: false,
      motivo: 'A lista de clientes ainda está carregando. Espere terminar para exportar.',
    }
  }

  if (quantidade === 0) {
    return { pode: false, motivo: 'Não há nenhum cliente para exportar ainda.' }
  }

  const alertas: string[] = []

  if (confianca === 'parcial') {
    alertas.push(
      'Este aparelho ainda não sincronizou a lista com o servidor, então o arquivo pode sair com apenas parte dos clientes. Um backup incompleto é pior do que nenhum, porque ninguém desconfia dele.',
    )
  }

  if (pendentes > 0) {
    alertas.push(
      pendentes === 1
        ? '1 cadastro ainda não subiu: no arquivo ele sai sem a data de sincronização.'
        : `${pendentes} cadastros ainda não subiram: no arquivo eles saem sem a data de sincronização.`,
    )
  }

  return { pode: true, alerta: alertas.length > 0 ? alertas.join(' ') : null }
}

export function resumoDaLista(total: number, arquivados: number): string {
  const contagem = total === 1 ? '1 cliente' : `${total} clientes`
  if (arquivados === 0) return contagem

  const rotulo = arquivados === 1 ? 'arquivado' : 'arquivados'
  return `${contagem}, sendo ${arquivados} ${rotulo}`
}
