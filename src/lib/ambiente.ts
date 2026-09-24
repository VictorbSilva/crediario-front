export const EMPRESA_DE_PRODUCAO = 'loja-principal'

export function ehProducao(env: {
  VITE_BUSINESS_ID?: string
  VITE_USE_FIREBASE_EMULATORS?: string
}): boolean {
  return (
    env.VITE_BUSINESS_ID === EMPRESA_DE_PRODUCAO && env.VITE_USE_FIREBASE_EMULATORS !== 'true'
  )
}
