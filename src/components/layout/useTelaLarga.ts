import { useSyncExternalStore } from 'react'

/**
 * O mesmo 1024px do `lg:` do Tailwind, que rege a grade da lista de clientes.
 *
 * Esta decisão não dá para tomar só no CSS: `hidden lg:block` esconde o painel
 * mas **monta** o componente, e com ele os três listeners do carnê de um cliente
 * que ninguém abriu no celular. Quem paga essa leitura é o plano Spark.
 */
const TELA_LARGA = '(min-width: 1024px)'

let consulta: MediaQueryList | null | undefined

function media(): MediaQueryList | null {
  if (consulta === undefined) {
    consulta =
      typeof window === 'undefined' || typeof window.matchMedia !== 'function'
        ? null
        : window.matchMedia(TELA_LARGA)
  }

  return consulta
}

function assinar(aoMudar: () => void): () => void {
  const atual = media()
  if (!atual) return () => {}

  atual.addEventListener('change', aoMudar)

  return () => atual.removeEventListener('change', aoMudar)
}

function ler(): boolean {
  return media()?.matches ?? false
}

export function useTelaLarga(): boolean {
  return useSyncExternalStore(assinar, ler, () => false)
}
