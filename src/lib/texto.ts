export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

export function iniciaisDe(nome: string): string {
  const partes = normalizar(nome).split(' ').filter(Boolean)
  if (partes.length === 0) return '?'

  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : ''

  return (primeira + ultima).toUpperCase()
}
