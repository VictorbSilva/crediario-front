export function dataLocalISO(momento: Date): string {
  const tempo = momento.getTime()
  if (!Number.isFinite(tempo)) {
    throw new TypeError('dataLocalISO recebeu uma data inválida')
  }

  const ano = String(momento.getFullYear()).padStart(4, '0')
  const mes = String(momento.getMonth() + 1).padStart(2, '0')
  const dia = String(momento.getDate()).padStart(2, '0')

  return `${ano}-${mes}-${dia}`
}

export function dataBonita(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!partes) return iso
  return `${partes[3]}/${partes[2]}/${partes[1]}`
}

function comoUTC(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function comoISO(momento: Date): string {
  const ano = String(momento.getUTCFullYear()).padStart(4, '0')
  const mes = String(momento.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(momento.getUTCDate()).padStart(2, '0')

  return `${ano}-${mes}-${dia}`
}

export function diferencaEmDias(de: string, ate: string): number {
  return Math.round((comoUTC(ate).getTime() - comoUTC(de).getTime()) / 86400000)
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
}

export function vencimentoDaParcela(dataVenda: string, ordem: number, diaDesejado: number): string {
  const base = comoUTC(dataVenda)
  const alvo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + ordem, 1))

  const ano = alvo.getUTCFullYear()
  const mes = alvo.getUTCMonth()
  const dia = Math.min(diaDesejado, diasNoMes(ano, mes))

  return comoISO(new Date(Date.UTC(ano, mes, dia)))
}
