export type SituacaoCpf = 'vazio' | 'incompleto' | 'invalido' | 'valido'

function digitoVerificador(digitos: string, ate: number): number {
  let soma = 0
  for (let i = 0; i < ate; i += 1) {
    soma += Number(digitos[i]) * (ate + 1 - i)
  }
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

export function situacaoCpf(digitos: string): SituacaoCpf {
  if (!/^\d*$/.test(digitos)) return 'invalido'
  if (digitos.length === 0) return 'vazio'
  if (digitos.length < 11) return 'incompleto'
  if (digitos.length > 11) return 'invalido'
  if (/^(\d)\1{10}$/.test(digitos)) return 'invalido'

  const fecha =
    digitoVerificador(digitos, 9) === Number(digitos[9]) &&
    digitoVerificador(digitos, 10) === Number(digitos[10])

  return fecha ? 'valido' : 'invalido'
}
