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
