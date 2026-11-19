import { Outlet } from 'react-router-dom'
import { AcessoProvider } from '@/data/AcessoProvider'
import { ClientesProvider } from '@/data/ClientesProvider'
import { useAcesso } from '@/data/useAcesso'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { SignOutButton } from './SignOutButton'
import { TopBar } from './TopBar'

export function AppShell() {
  return (
    <AcessoProvider>
      <ConteudoConformeAcesso />
    </AcessoProvider>
  )
}

function ConteudoConformeAcesso() {
  const acesso = useAcesso()

  if (acesso.estado === 'carregando') {
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

  // Sem acesso, o `ClientesProvider` não pode montar: a regra negaria o listener dele.
  if (acesso.estado === 'sem-acesso') {
    const mensagem =
      acesso.motivo === 'desativado'
        ? 'Seu acesso foi desativado. Fale com o responsável pela loja.'
        : 'Esta conta não tem acesso a esta loja.'

    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-8">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-slate-600">{mensagem}</p>
          <SignOutButton />
        </div>
      </main>
    )
  }

  return (
    <ClientesProvider>
      <div className="min-h-dvh md:flex print:hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 px-4 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-6 md:pb-8">
            <Outlet />
          </main>
        </div>
        <BottomNav />
      </div>
    </ClientesProvider>
  )
}
