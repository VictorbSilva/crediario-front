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
