import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { deveChecarAtualizacao, INTERVALO_DE_CHECAGEM_MS } from '@/lib/atualizacao'

/**
 * O caminho normal recarrega antes, no `controlling` do vite-plugin-pwa; este relógio
 * só garante que, tocado "Atualizar", ninguém fica parado sem recarregar.
 */
const ESPERA_PARA_RECARREGAR_MS = 5 * 1000

// O React em modo estrito pode registrar duas vezes no desenvolvimento: os gatilhos
// da checagem ligam uma vez só por página.
let checagensLigadas = false

/**
 * Sem isto o navegador só confere o `sw.js` numa navegação, e o app instalado volta
 * do segundo plano sem navegar. Ver docs/armadilhas.md (src/components/pwa/PwaPrompt.tsx).
 */
function ligarChecagens(swUrl: string, registro: ServiceWorkerRegistration | undefined) {
  if (!registro || checagensLigadas) return
  checagensLigadas = true
  let ultimaChecagem: number | null = null

  const checar = () => {
    const agora = Date.now()
    const deve = deveChecarAtualizacao({
      online: navigator.onLine,
      instalando: Boolean(registro.installing),
      ultimaChecagem,
      agora,
    })
    if (!deve) return
    ultimaChecagem = agora
    fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
      .then((resposta) => {
        if (resposta.status === 200) return registro.update()
      })
      // Offline é o estado normal do app: a checagem que falha não é erro.
      .catch(() => {})
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checar()
  })
  window.addEventListener('online', checar)
  setInterval(checar, INTERVALO_DE_CHECAGEM_MS)
}

export function PwaPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: ligarChecagens })
  const [atualizando, setAtualizando] = useState(false)

  if (!offlineReady && !needRefresh) return null

  function fechar() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  function atualizar() {
    setAtualizando(true)
    updateServiceWorker().catch((erro: unknown) => {
      console.error('[pwa] Falha ao aplicar a atualização.', erro)
    })
    setTimeout(() => window.location.reload(), ESPERA_PARA_RECARREGAR_MS)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 md:inset-x-auto md:bottom-4 md:right-4 md:px-0"
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg md:mx-0">
        <p className="min-w-0 flex-1 text-sm text-slate-700">
          {needRefresh
            ? 'Nova versão disponível.'
            : 'Pronto para uso sem internet.'}
        </p>

        {needRefresh && (
          <button
            type="button"
            onClick={atualizar}
            disabled={atualizando}
            className="min-h-11 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {atualizando ? 'Atualizando…' : 'Atualizar'}
          </button>
        )}

        <button
          type="button"
          onClick={fechar}
          className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          {needRefresh ? 'Depois' : 'OK'}
        </button>
      </div>
    </div>
  )
}
