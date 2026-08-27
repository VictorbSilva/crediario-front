import { LogOut } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'

export function SignOutButton({ className = '' }: { className?: string }) {
  const { sair } = useAuth()

  return (
    <button
      type="button"
      onClick={() => {
        sair().catch((erro: unknown) => {
          console.error('[auth] Falha ao sair.', erro)
        })
      }}
      title="Sair"
      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      <LogOut size={20} aria-hidden />
      <span className="sr-only md:not-sr-only">Sair</span>
    </button>
  )
}
