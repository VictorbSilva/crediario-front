import { useSyncExternalStore } from 'react'

function assinar(avisar: () => void): () => void {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

function lerAgora(): boolean {
  return navigator.onLine
}

/**
 * Se o navegador acha que está conectado, atualizado nos eventos `online` e `offline`. Só
 * serve para avisar e desabilitar botão: `navigator.onLine` verdadeiro não garante que o
 * servidor responde.
 */
export function useEstaOnline(): boolean {
  return useSyncExternalStore(assinar, lerAgora)
}
