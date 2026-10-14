import { diasNoMes } from './data'

export type MarcaDeVisita = 'visitado' | 'ausente'

export type ClienteNaRota = {
  id: string
  numero: number
  arquivado?: boolean
  diasDeVisita?: number[]
  rotaDesde?: string
  ordemPorDia?: Record<string, number>
  ordemDoDia?: { data: string; valor: number }
  ultimaMarca?: MarcaDeVisita
  ultimaMarcaEm?: string
  ultimoVisitado?: string
  visitadoAnterior?: string
}

export const PASSO = 1000
export const BASE_SEM_ORDEM = 1_000_000

export function dataDaVisita(ano: number, mes: number, dia: number): string {
  const limitado = Math.min(dia, diasNoMes(ano, mes - 1))
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(limitado).padStart(2, '0')}`
}

export function agendaRecente(cliente: ClienteNaRota, hoje: string): { data: string; dia: number } | null {
  const [ano, mes] = hoje.split('-').map(Number)
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
  let recente: { data: string; dia: number } | null = null

  for (const periodo of [{ ano, mes }, anterior]) {
    for (const dia of cliente.diasDeVisita ?? []) {
      const data = dataDaVisita(periodo.ano, periodo.mes, dia)
      if (data > hoje || (cliente.rotaDesde && data < cliente.rotaDesde)) continue
      if (!recente || data > recente.data || (data === recente.data && dia === Number(data.slice(8)))) {
        recente = { data, dia }
      }
    }
  }
  return recente
}

export type EstadoNaRota = {
  situacao: 'fora' | 'pendente' | 'visitado'
  atrasado: boolean
  agendadoPara: string | null
  diaAgendado: number | null
  ausenteHoje: boolean
}

export function estadoNaRota(cliente: ClienteNaRota, hoje: string): EstadoNaRota {
  const agenda = agendaRecente(cliente, hoje)
  const estado: EstadoNaRota = {
    situacao: 'fora',
    atrasado: agenda !== null && agenda.data < hoje,
    agendadoPara: agenda?.data ?? null,
    diaAgendado: agenda?.dia ?? null,
    ausenteHoje: cliente.ultimaMarca === 'ausente' && cliente.ultimaMarcaEm === hoje,
  }
  if (cliente.arquivado || !agenda) return estado
  if (cliente.ultimoVisitado === hoje) return { ...estado, situacao: 'visitado' }
  if (cliente.ultimoVisitado && cliente.ultimoVisitado >= agenda.data) return estado
  return { ...estado, situacao: 'pendente' }
}

export type ItemDaRota<C extends ClienteNaRota> = { cliente: C; estado: EstadoNaRota; chave: number }

function compararChaves<C extends ClienteNaRota>(a: { cliente: C; chave: number }, b: { cliente: C; chave: number }): number {
  return a.chave - b.chave || a.cliente.numero - b.cliente.numero
}

export function rotaDeHoje<C extends ClienteNaRota>(clientes: readonly C[], hoje: string): ItemDaRota<C>[] {
  const itens: ItemDaRota<C>[] = []
  const atrasados: { cliente: C; estado: EstadoNaRota }[] = []
  for (const cliente of clientes) {
    const estado = estadoNaRota(cliente, hoje)
    if (estado.situacao === 'fora') continue
    if (!estado.atrasado) {
      const chave = cliente.ordemPorDia?.[String(estado.diaAgendado)] ?? BASE_SEM_ORDEM + cliente.numero
      itens.push({ cliente, estado, chave })
    } else if (cliente.ordemDoDia?.data === hoje) {
      itens.push({ cliente, estado, chave: cliente.ordemDoDia.valor })
    } else {
      atrasados.push({ cliente, estado })
    }
  }
  atrasados.sort((a, b) => (a.estado.agendadoPara ?? '').localeCompare(b.estado.agendadoPara ?? '')
    || a.cliente.numero - b.cliente.numero)
  const maior = itens.length ? Math.max(...itens.map((item) => item.chave)) : 0
  atrasados.forEach((item, i) => itens.push({ ...item, chave: maior + PASSO * (i + 1) }))
  return itens.sort(compararChaves)
}

export type ItemDoDia<C extends ClienteNaRota> = { cliente: C; chave: number }

export function rotaDoDia<C extends ClienteNaRota>(clientes: readonly C[], dia: number): ItemDoDia<C>[] {
  return clientes.filter((cliente) => !cliente.arquivado && cliente.diasDeVisita?.includes(dia))
    .map((cliente) => ({ cliente, chave: cliente.ordemPorDia?.[String(dia)] ?? BASE_SEM_ORDEM + cliente.numero }))
    .sort(compararChaves)
}

export function contagemPorDia(clientes: readonly ClienteNaRota[]): Map<number, number> {
  const contagem = new Map<number, number>()
  for (const cliente of clientes) {
    if (cliente.arquivado) continue
    for (const dia of cliente.diasDeVisita ?? []) {
      contagem.set(dia, (contagem.get(dia) ?? 0) + 1)
    }
  }
  return contagem
}

export function chaveEntre(anterior: number | null, proxima: number | null): number | null {
  if (anterior === null) return proxima === null ? PASSO : proxima - PASSO
  if (proxima === null) return anterior + PASSO
  const media = (anterior + proxima) / 2
  return media > anterior && media < proxima ? media : null
}

export type Reordenacao =
  | { clienteId: string; tipo: 'dia'; dia: number; valor: number }
  | { clienteId: string; tipo: 'hoje'; data: string; valor: number }

function reordenar<T extends { chave: number }>(
  itens: readonly T[], de: number, para: number,
  alteracao: (item: T, valor: number) => Reordenacao,
): Reordenacao[] {
  if (de === para) return []
  const nova = [...itens]
  const [movido] = nova.splice(de, 1)
  nova.splice(para, 0, movido)
  const chave = chaveEntre(nova[para - 1]?.chave ?? null, nova[para + 1]?.chave ?? null)
  if (chave !== null) return [alteracao(movido, chave)]
  return nova.map((item, i) => alteracao(item, PASSO * (i + 1)))
}

export function arrasteNaRotaDeHoje(
  itens: readonly ItemDaRota<ClienteNaRota>[], de: number, para: number, hoje: string,
): Reordenacao[] {
  return reordenar(itens, de, para, (item, valor) => {
    if (item.estado.atrasado) return { clienteId: item.cliente.id, tipo: 'hoje', data: hoje, valor }
    return { clienteId: item.cliente.id, tipo: 'dia', dia: item.estado.diaAgendado!, valor }
  })
}

export function arrasteNaRotaDoDia(
  itens: readonly ItemDoDia<ClienteNaRota>[], de: number, para: number, dia: number,
): Reordenacao[] {
  return reordenar(itens, de, para, (item, valor) => ({ clienteId: item.cliente.id, tipo: 'dia', dia, valor }))
}

export type AlteracaoDeVisita = { definir: Record<string, string>; remover: string[] }

export function marcarVisitado(cliente: ClienteNaRota, hoje: string): AlteracaoDeVisita {
  const definir: Record<string, string> = { ultimaMarca: 'visitado', ultimaMarcaEm: hoje, ultimoVisitado: hoje }
  if (cliente.ultimoVisitado === hoje) return { definir, remover: [] }
  if (cliente.ultimoVisitado) {
    definir.visitadoAnterior = cliente.ultimoVisitado
    return { definir, remover: [] }
  }
  return { definir, remover: ['visitadoAnterior'] }
}

export function marcarAusente(_cliente: ClienteNaRota, hoje: string): AlteracaoDeVisita {
  return { definir: { ultimaMarca: 'ausente', ultimaMarcaEm: hoje }, remover: [] }
}

export function desmarcar(cliente: ClienteNaRota, hoje: string): AlteracaoDeVisita {
  if (cliente.ultimoVisitado === hoje) {
    const definir: Record<string, string> = {}
    const remover = ['visitadoAnterior', 'ultimaMarca', 'ultimaMarcaEm']
    if (cliente.visitadoAnterior) definir.ultimoVisitado = cliente.visitadoAnterior
    else remover.push('ultimoVisitado')
    return { definir, remover }
  }
  if (cliente.ultimaMarca === 'ausente' && cliente.ultimaMarcaEm === hoje) {
    return { definir: {}, remover: ['ultimaMarca', 'ultimaMarcaEm'] }
  }
  return { definir: {}, remover: [] }
}

export function montarDiasDeVisita(dias: readonly number[]): number[] {
  if (dias.some((dia) => !Number.isInteger(dia) || dia < 1 || dia > 31) || new Set(dias).size !== dias.length) {
    throw new TypeError('Dias de visita devem ser inteiros de 1 a 31, sem repetição')
  }
  return [...dias].sort((a, b) => a - b)
}

export function textoDosDias(dias: readonly number[]): string {
  if (dias.length === 0) return 'Sem dias de visita'
  if (dias.length === 1) return `Dia ${dias[0]}`
  return `Dias ${dias.slice(0, -1).join(', ')} e ${dias[dias.length - 1]}`
}
