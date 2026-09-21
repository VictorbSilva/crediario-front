import { situacaoCpf } from './cpf'
import { dataLocalISO } from './data'
import type { ConfiancaDaLista } from './sync'
import { normalizar, somenteDigitos } from './texto'

export const LIMITES_CLIENTE = {
  nome: 120,
  telefone: 40,
  telefoneDigits: 20,
  cpf: 20,
  cpfDigits: 11,
  endereco: 200,
  observacao: 500,
} as const

export type ClienteConhecido = {
  numero: number
  nome: string
  arquivado?: boolean
}

export type EntradaCliente = {
  numero: string
  nome: string
  telefone: string
  cpf: string
  endereco: string
  observacao: string
}

export const ENTRADA_CLIENTE_VAZIA: EntradaCliente = {
  numero: '',
  nome: '',
  telefone: '',
  cpf: '',
  endereco: '',
  observacao: '',
}

export type ErrosCliente = Partial<Record<keyof EntradaCliente, string>>

export type ContextoEscrita = {
  agora: Date
  dispositivo: string
}

export type CamposCliente = {
  numero: number
  nome: string
  nomeBusca: string
  telefone?: string
  telefoneDigits?: string
  cpf?: string
  cpfDigits?: string
  endereco?: string
  observacao?: string
  arquivado: boolean
  cadastradoEm: string
  atualizadoPor: string
}

export function parseNumeroCadastro(entrada: string): number | null {
  const limpo = entrada.replace(/\s/g, '').replace(/^#/, '')
  if (!/^\d+$/.test(limpo)) return null

  const numero = Number(limpo)
  if (!Number.isSafeInteger(numero) || numero <= 0) return null

  return numero
}

export function clienteComNumero(
  clientes: readonly ClienteConhecido[],
  numero: number,
): ClienteConhecido | undefined {
  return clientes.find((cliente) => cliente.numero === numero && cliente.arquivado !== true)
}

export function validarCliente(
  entrada: EntradaCliente,
  clientes: readonly ClienteConhecido[],
  confianca: ConfiancaDaLista,
): ErrosCliente {
  const erros: ErrosCliente = {}

  const numero = parseNumeroCadastro(entrada.numero)
  if (numero === null) {
    erros.numero = entrada.numero.trim()
      ? 'Use só números, sem letras nem pontos.'
      : 'Digite o número do cliente.'
  } else if (confianca === 'desconhecida') {
    erros.numero = 'Espere a lista de clientes carregar para conferir o número.'
  } else {
    const dono = clienteComNumero(clientes, numero)
    if (dono) erros.numero = `O número ${numero} já é de ${dono.nome}.`
  }

  const nome = entrada.nome.trim()
  if (!nome) {
    erros.nome = 'Digite o nome do cliente.'
  } else if (nome.length > LIMITES_CLIENTE.nome) {
    erros.nome = `Nome muito longo: máximo ${LIMITES_CLIENTE.nome} caracteres.`
  } else if (normalizar(nome).length === 0) {
    erros.nome = 'Digite um nome com pelo menos uma letra ou número.'
  }

  const telefone = entrada.telefone.trim()
  if (telefone.length > LIMITES_CLIENTE.telefone) {
    erros.telefone = `Telefone muito longo: máximo ${LIMITES_CLIENTE.telefone} caracteres.`
  } else if (somenteDigitos(telefone).length > LIMITES_CLIENTE.telefoneDigits) {
    erros.telefone = `Telefone com dígitos demais: máximo ${LIMITES_CLIENTE.telefoneDigits}.`
  }

  const cpf = entrada.cpf.trim()
  if (cpf.length > LIMITES_CLIENTE.cpf) {
    erros.cpf = `CPF muito longo: máximo ${LIMITES_CLIENTE.cpf} caracteres.`
  } else {
    const situacao = situacaoCpf(somenteDigitos(cpf))
    if (situacao === 'incompleto') {
      erros.cpf = 'CPF incompleto: faltam dígitos.'
    } else if (situacao === 'invalido') {
      erros.cpf = 'Digite um CPF válido.'
    }
  }

  const endereco = entrada.endereco.trim()
  if (endereco.length > LIMITES_CLIENTE.endereco) {
    erros.endereco = `Endereço muito longo: máximo ${LIMITES_CLIENTE.endereco} caracteres.`
  }

  const observacao = entrada.observacao.trim()
  if (observacao.length > LIMITES_CLIENTE.observacao) {
    erros.observacao = `Observação muito longa: máximo ${LIMITES_CLIENTE.observacao} caracteres.`
  }

  return erros
}

export function montarCamposCliente(
  entrada: EntradaCliente,
  { agora, dispositivo }: ContextoEscrita,
): CamposCliente {
  const numero = parseNumeroCadastro(entrada.numero)
  if (numero === null) {
    throw new TypeError('montarCamposCliente recebeu um número que não passou na validação')
  }

  const nome = entrada.nome.trim().replace(/\s+/g, ' ')
  const nomeBusca = normalizar(nome)
  if (nomeBusca.length === 0) {
    throw new TypeError('montarCamposCliente recebeu um nome que não passou na validação')
  }

  const campos: CamposCliente = {
    numero,
    nome,
    nomeBusca,
    arquivado: false,
    cadastradoEm: dataLocalISO(agora),
    atualizadoPor: dispositivo,
  }

  const telefone = entrada.telefone.trim()
  if (telefone) {
    campos.telefone = telefone
    const digitos = somenteDigitos(telefone)
    if (digitos) campos.telefoneDigits = digitos
  }

  const cpf = entrada.cpf.trim()
  if (cpf) {
    campos.cpf = cpf
    const digitos = somenteDigitos(cpf)
    if (digitos) campos.cpfDigits = digitos
  }

  const endereco = entrada.endereco.trim()
  if (endereco) campos.endereco = endereco

  const observacao = entrada.observacao.trim()
  if (observacao) campos.observacao = observacao

  return campos
}
