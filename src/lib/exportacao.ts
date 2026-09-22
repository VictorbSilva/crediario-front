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

export type SituacaoExportacao =
  | { pode: false; motivo: string }
  | { pode: true; alerta: string | null }

export const VERSAO_EXPORTACAO = 1

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

export function paraJSON(clientes: readonly ClienteExportavel[], agora: Date): string {
  const conteudo = {
    formato: 'crediario-clientes',
    versao: VERSAO_EXPORTACAO,
    geradoEm: agora.toISOString(),
    quantidade: clientes.length,
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
  }

  return JSON.stringify(conteudo, null, 2)
}

export function nomeDoArquivo(extensao: 'json' | 'csv', agora: Date): string {
  return `crediario-clientes-${dataLocalISO(agora)}.${extensao}`
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
