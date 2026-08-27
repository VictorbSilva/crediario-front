import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  function fechar() {
    setOfflineReady(false)
    setNeedRefresh(false)
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
            onClick={() => {
              updateServiceWorker().catch((erro: unknown) => {
                console.error('[pwa] Falha ao aplicar a atualização.', erro)
              })
            }}
            className="min-h-11 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            Atualizar
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
