import { situacaoCpf } from './cpf'
import { dataLocalISO } from './data'
import { montarDiasDeVisita } from './rotas'
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
  diasDeVisita: number[]
}

export const ENTRADA_CLIENTE_VAZIA: EntradaCliente = {
  numero: '',
  nome: '',
  telefone: '',
  cpf: '',
  endereco: '',
  observacao: '',
  diasDeVisita: [],
}

export function entradaDoCliente(cliente: {
  numero: number
  nome: string
  telefone?: string
  cpf?: string
  endereco?: string
  observacao?: string
  diasDeVisita?: number[]
}): EntradaCliente {
  return {
    numero: String(cliente.numero),
    nome: cliente.nome,
    telefone: cliente.telefone ?? '',
    cpf: cliente.cpf ?? '',
    endereco: cliente.endereco ?? '',
    observacao: cliente.observacao ?? '',
    diasDeVisita: [...(cliente.diasDeVisita ?? [])],
  }
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
  diasDeVisita?: number[]
  rotaDesde?: string
  arquivado: boolean
  cadastradoEm: string
  atualizadoPor: string
}

export type CampoRemovivel =
  | 'telefone'
  | 'telefoneDigits'
  | 'cpf'
  | 'cpfDigits'
  | 'endereco'
  | 'observacao'
  | 'diasDeVisita'
  | 'rotaDesde'

export type EdicaoCliente = {
  definir: {
    nome?: string
    nomeBusca?: string
    telefone?: string
    telefoneDigits?: string
    cpf?: string
    cpfDigits?: string
    endereco?: string
    observacao?: string
    diasDeVisita?: number[]
    rotaDesde?: string
    atualizadoPor: string
  }
  remover: CampoRemovivel[]
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

function erroDoNumero(
  entrada: EntradaCliente,
  clientes: readonly ClienteConhecido[],
  confianca: ConfiancaDaLista,
): string | undefined {
  const numero = parseNumeroCadastro(entrada.numero)

  if (numero === null) {
    return entrada.numero.trim()
      ? 'Use só números, sem letras nem pontos.'
      : 'Digite o número do cliente.'
  }

  if (confianca === 'desconhecida') {
    return 'Espere a lista de clientes carregar para conferir o número.'
  }

  const dono = clienteComNumero(clientes, numero)
  return dono ? `O número ${numero} já é de ${dono.nome}.` : undefined
}

function erroDoNome(valor: string): string | undefined {
  const nome = valor.trim()

  if (!nome) return 'Digite o nome do cliente.'
  if (nome.length > LIMITES_CLIENTE.nome) {
    return `Nome muito longo: máximo ${LIMITES_CLIENTE.nome} caracteres.`
  }
  if (normalizar(nome).length === 0) return 'Digite um nome com pelo menos uma letra ou número.'

  return undefined
}

function erroDoTelefone(valor: string): string | undefined {
  const telefone = valor.trim()

  if (telefone.length > LIMITES_CLIENTE.telefone) {
    return `Telefone muito longo: máximo ${LIMITES_CLIENTE.telefone} caracteres.`
  }
  if (somenteDigitos(telefone).length > LIMITES_CLIENTE.telefoneDigits) {
    return `Telefone com dígitos demais: máximo ${LIMITES_CLIENTE.telefoneDigits}.`
  }

  return undefined
}

function erroDoCpf(valor: string): string | undefined {
  const cpf = valor.trim()

  if (cpf.length > LIMITES_CLIENTE.cpf) {
    return `CPF muito longo: máximo ${LIMITES_CLIENTE.cpf} caracteres.`
  }

  const situacao = situacaoCpf(somenteDigitos(cpf))
  if (situacao === 'incompleto') return 'CPF incompleto: faltam dígitos.'
  if (situacao === 'invalido') return 'Digite um CPF válido.'

  return undefined
}

function erroDeTamanho(valor: string, limite: number, rotulo: string): string | undefined {
  return valor.trim().length > limite ? `${rotulo}: máximo ${limite} caracteres.` : undefined
}

function errosDosDadosCliente(entrada: EntradaCliente): ErrosCliente {
  const candidatos: ErrosCliente = {
    nome: erroDoNome(entrada.nome),
    telefone: erroDoTelefone(entrada.telefone),
    cpf: erroDoCpf(entrada.cpf),
    endereco: erroDeTamanho(entrada.endereco, LIMITES_CLIENTE.endereco, 'Endereço muito longo'),
    observacao: erroDeTamanho(
      entrada.observacao,
      LIMITES_CLIENTE.observacao,
      'Observação muito longa',
    ),
  }

  const erros: ErrosCliente = {}
  for (const [campo, erro] of Object.entries(candidatos)) {
    if (erro) erros[campo as keyof EntradaCliente] = erro
  }

  return erros
}

export function validarCliente(
  entrada: EntradaCliente,
  clientes: readonly ClienteConhecido[],
  confianca: ConfiancaDaLista,
): ErrosCliente {
  const numero = erroDoNumero(entrada, clientes, confianca)
  const erros = errosDosDadosCliente(entrada)
  return numero ? { numero, ...erros } : erros
}

export function validarEdicaoCliente(entrada: EntradaCliente): ErrosCliente {
  return errosDosDadosCliente(entrada)
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

  const dias = montarDiasDeVisita(entrada.diasDeVisita)
  if (dias.length > 0) {
    campos.diasDeVisita = dias
    campos.rotaDesde = dataLocalISO(agora)
  }

  return campos
}

export function montarEdicaoCliente(
  entrada: EntradaCliente,
  contexto: ContextoEscrita,
  original?: EntradaCliente,
): EdicaoCliente {
  const { dispositivo } = contexto
  const nome = entrada.nome.trim().replace(/\s+/g, ' ')
  const nomeBusca = normalizar(nome)
  if (nomeBusca.length === 0) {
    throw new TypeError('montarEdicaoCliente recebeu um nome que não passou na validação')
  }

  const definir: EdicaoCliente['definir'] = { nome, nomeBusca, atualizadoPor: dispositivo }
  let remover: CampoRemovivel[] = []

  const telefone = entrada.telefone.trim()
  if (telefone) definir.telefone = telefone
  else remover.push('telefone')

  const telefoneDigits = somenteDigitos(telefone)
  if (telefoneDigits) definir.telefoneDigits = telefoneDigits
  else remover.push('telefoneDigits')

  const cpf = entrada.cpf.trim()
  if (cpf) definir.cpf = cpf
  else remover.push('cpf')

  const cpfDigits = somenteDigitos(cpf)
  if (cpfDigits) definir.cpfDigits = cpfDigits
  else remover.push('cpfDigits')

  const endereco = entrada.endereco.trim()
  if (endereco) definir.endereco = endereco
  else remover.push('endereco')

  const observacao = entrada.observacao.trim()
  if (observacao) definir.observacao = observacao
  else remover.push('observacao')

  const dias = montarDiasDeVisita(entrada.diasDeVisita)
  if (dias.length > 0) {
    definir.diasDeVisita = dias
    definir.rotaDesde = dataLocalISO(contexto.agora)
  } else remover.push('diasDeVisita', 'rotaDesde')

  if (original) {
    const anterior = montarEdicaoCliente(original, contexto).definir
    type CampoEditavel = Exclude<
      keyof EdicaoCliente['definir'], 'atualizadoPor' | 'diasDeVisita' | 'rotaDesde'
    >
    const grupos: readonly (readonly CampoEditavel[])[] = [
      ['nome', 'nomeBusca'],
      ['telefone', 'telefoneDigits'],
      ['cpf', 'cpfDigits'],
      ['endereco'],
      ['observacao'],
    ]
    const inalterados = new Set<keyof EdicaoCliente['definir']>()
    for (const grupo of grupos) {
      if (definir[grupo[0]] !== anterior[grupo[0]]) continue
      for (const campo of grupo) {
        delete definir[campo]
        inalterados.add(campo)
      }
    }
    remover = remover.filter((campo) => !inalterados.has(campo))

    const diasAnteriores = montarDiasDeVisita(original.diasDeVisita)
    if (diasAnteriores.length === dias.length && dias.every((dia, i) => dia === diasAnteriores[i])) {
      delete definir.diasDeVisita
      delete definir.rotaDesde
      remover = remover.filter((campo) => campo !== 'diasDeVisita' && campo !== 'rotaDesde')
    }
  }

  return { definir, remover }
}
