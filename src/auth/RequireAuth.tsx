import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { usuario, businessId, carregando, sair } = useAuth()
  const local = useLocation()

  if (carregando) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid min-h-dvh place-items-center text-sm text-slate-500"
      >
        Carregando…
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ de: local.pathname }} />
  }

  if (!businessId) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-8">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">
            Conta sem empresa vinculada
          </h1>
          <p className="mb-4 text-sm text-slate-600">
            Esta conta entrou, mas não está associada a nenhuma empresa. Se a
            associação foi feita agora, saia e entre novamente para renovar o
            acesso.
          </p>
          <button
            type="button"
            onClick={() => {
              sair().catch((erro: unknown) => {
                console.error('[auth] Falha ao sair.', erro)
              })
            }}
            className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            Sair
          </button>
        </div>
      </main>
    )
  }

  return <Outlet />
}
