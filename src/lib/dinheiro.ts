const formatadorCompleto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatadorSemCentavos = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatarCentavos(centavos: number): string {
  return formatadorCompleto.format(centavos / 100)
}

export function formatarCentavosCurto(centavos: number): string {
  return centavos % 100 === 0
    ? formatadorSemCentavos.format(centavos / 100)
    : formatadorCompleto.format(centavos / 100)
}

/** Aceita "1", "12", "123", "1.234", "12.345.678" — nunca "1.23.4". */
function milharValido(inteiros: string, separador: string): boolean {
  if (!inteiros.includes(separador)) return /^\d+$/.test(inteiros)
  const grupos = inteiros.split(separador)
  return (
    grupos.length > 1 &&
    /^\d{1,3}$/.test(grupos[0]) &&
    grupos.slice(1).every((grupo) => /^\d{3}$/.test(grupo))
  )
}

/**
 * Converte o que o usuário digitou em centavos inteiros. Devolve `null` quando
 * a entrada está vazia ou não é um valor reconhecível — a tela trata isso como
 * campo inválido, não como exceção.
 *
 * Nunca usar `parseFloat` aqui: ele aceita lixo à direita ("12,5x" vira 12),
 * ignora separador de milhar ("1.234" vira 1) e devolve ponto flutuante, que é
 * exatamente o que representar dinheiro em centavos inteiros existe para evitar.
 * A conversão abaixo é feita por manipulação de string.
 */
export function parseReaisParaCentavos(entrada: string): number | null {
  const limpo = entrada.replace(/\s/g, '').replace(/r\$/gi, '')
  if (!limpo) return null

  const ultimoPonto = limpo.lastIndexOf('.')
  const ultimaVirgula = limpo.lastIndexOf(',')

  let inteiros: string
  let centavos: string

  if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
    // Os dois separadores aparecem: o último é o decimal, o outro é milhar.
    // Cobre "1.234,56" (pt-BR) e "1,234.56" (quem digita no formato en-US).
    const corte = Math.max(ultimoPonto, ultimaVirgula)
    const milhar = corte === ultimoPonto ? ',' : '.'
    inteiros = limpo.slice(0, corte)
    centavos = limpo.slice(corte + 1)
    if (!milharValido(inteiros, milhar)) return null
    inteiros = inteiros.split(milhar).join('')
  } else if (ultimaVirgula >= 0) {
    // Vírgula sozinha é sempre decimal: em pt-BR ela nunca separa milhar.
    inteiros = limpo.slice(0, ultimaVirgula)
    centavos = limpo.slice(ultimaVirgula + 1)
    if (inteiros.includes(',')) return null
  } else if (ultimoPonto >= 0) {
    // Ponto sozinho é ambíguo: "1.234" são mil duzentos e trinta e quatro
    // reais, "12.34" são doze reais e trinta e quatro centavos. O que decide é
    // o tamanho do grupo à direita — três dígitos é milhar, um ou dois é
    // decimal. Qualquer outra forma é recusada em vez de adivinhada.
    if (milharValido(limpo, '.')) {
      inteiros = limpo.split('.').join('')
      centavos = ''
    } else if (/^\d*\.\d{1,2}$/.test(limpo)) {
      inteiros = limpo.slice(0, ultimoPonto)
      centavos = limpo.slice(ultimoPonto + 1)
    } else {
      return null
    }
  } else {
    inteiros = limpo
    centavos = ''
  }

  if (inteiros === '') inteiros = '0'
  // Mais de duas casas não é arredondado em silêncio: em dinheiro, adivinhar a
  // intenção do usuário é pior do que pedir que ele digite de novo.
  if (!/^\d+$/.test(inteiros) || !/^\d{0,2}$/.test(centavos)) return null

  const total = Number(inteiros) * 100 + Number(centavos.padEnd(2, '0') || '0')
  return Number.isSafeInteger(total) ? total : null
}
