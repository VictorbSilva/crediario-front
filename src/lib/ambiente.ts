export const EMPRESA_DE_PRODUCAO = 'loja-principal'

export type DadosDaLoja = { nome?: string; cnpj?: string; telefone?: string }

export function dadosDaLoja(env: {
  VITE_LOJA_NOME?: string
  VITE_LOJA_CNPJ?: string
  VITE_LOJA_TELEFONE?: string
}): DadosDaLoja {
  const dados: DadosDaLoja = {}
  const campos = { nome: env.VITE_LOJA_NOME, cnpj: env.VITE_LOJA_CNPJ, telefone: env.VITE_LOJA_TELEFONE }
  for (const campo of ['nome', 'cnpj', 'telefone'] as const) {
    const texto = campos[campo]?.trim()
    if (texto) dados[campo] = texto
  }
  return dados
}

export function ehProducao(env: {
  VITE_BUSINESS_ID?: string
  VITE_USE_FIREBASE_EMULATORS?: string
}): boolean {
  return (
    env.VITE_BUSINESS_ID === EMPRESA_DE_PRODUCAO && env.VITE_USE_FIREBASE_EMULATORS !== 'true'
  )
}
