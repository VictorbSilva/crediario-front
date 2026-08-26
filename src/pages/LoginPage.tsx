import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/auth/useAuth'

export function LoginPage() {
  const { usuario, carregando, entrar } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const destino = (local.state as { de?: string } | null)?.de ?? '/clientes'

  if (carregando) return null
  if (usuario) return <Navigate to={destino} replace />

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await entrar(email.trim(), senha)
      navegar(destino, { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <BrandMark className="h-10 w-10 text-brand-600" />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Crediário
          </h1>
        </div>

        <form
          onSubmit={(evento) => void aoEnviar(evento)}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-base text-slate-900 outline-none transition-colors focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="senha" className="text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-base text-slate-900 outline-none transition-colors focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            />
          </div>

          {erro && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
