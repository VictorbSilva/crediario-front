/**
 * Quando o app procura uma versão nova do service worker. Quem dispara é o
 * `PwaPrompt` (ao voltar para a tela, quando a internet volta e de hora em hora);
 * a decisão de checar ou não fica aqui. Ver docs/armadilhas.md
 * (src/components/pwa/PwaPrompt.tsx).
 */

export const INTERVALO_DE_CHECAGEM_MS = 60 * 60 * 1000

/** Voltar para a tela várias vezes seguidas não vira uma busca do `sw.js` a cada vez. */
export const INTERVALO_MINIMO_MS = 5 * 60 * 1000

export type SinaisDaChecagem = {
  online: boolean
  /** Já há um worker novo sendo instalado: a checagem não teria o que acrescentar. */
  instalando: boolean
  /** `Date.now()` da última checagem feita, ou `null` se ainda não houve nenhuma. */
  ultimaChecagem: number | null
  agora: number
}

export function deveChecarAtualizacao({
  online,
  instalando,
  ultimaChecagem,
  agora,
}: SinaisDaChecagem): boolean {
  if (!online || instalando) return false
  if (ultimaChecagem === null) return true
  return agora - ultimaChecagem >= INTERVALO_MINIMO_MS
}
