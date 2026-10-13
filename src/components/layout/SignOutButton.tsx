import { useEffect, useId, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { Nota } from '@/components/ui/Nota'

export function SignOutButton({ className = '' }: { className?: string }) {
  const { sair } = useAuth()
  const dialogo = useRef<HTMLDialogElement>(null)
  const base = useId()
  const [aberto, setAberto] = useState(false)
  const [semInternet, setSemInternet] = useState(false)

  useEffect(() => {
    if (aberto) dialogo.current?.showModal()
  }, [aberto])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSemInternet(navigator.onLine === false)
          setAberto(true)
        }}
        title="Sair"
        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 ${className}`}
      >
        <LogOut size={20} aria-hidden />
        <span className="sr-only md:not-sr-only">Sair</span>
      </button>

      <dialog
        ref={dialogo}
        onClose={() => {
          setAberto(false)
          setSemInternet(false)
        }}
        aria-labelledby={base + '-titulo'}
        aria-describedby={base + '-descricao'}
        className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-2xl bg-white p-5 backdrop:bg-slate-900/40"
      >
        <h2 id={base + '-titulo'} className="text-lg font-semibold text-slate-900">
          Sair da conta?
        </h2>
        <p id={base + '-descricao'} className="mt-1 text-sm text-slate-600">
          Para entrar de novo é preciso internet.
        </p>

        {semInternet ? (
          <div className="mt-4">
            <Nota tom="alerta">
              Você está sem internet agora. Se sair, só vai conseguir entrar de novo quando a
              conexão voltar.
            </Nota>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => dialogo.current?.close()}
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Continuar conectado
          </button>
          <button
            type="button"
            onClick={() => {
              sair().catch((erro: unknown) => {
                console.error('[auth] Falha ao sair.', erro)
              })
              dialogo.current?.close()
            }}
            className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Sair
          </button>
        </div>
      </dialog>
    </>
  )
}
