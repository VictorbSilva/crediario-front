import { useState } from 'react'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { gerarSenha } from '@/lib/equipe'

type CampoDeSenhaProps = Readonly<{
  id: string
  valor: string
  erro?: string
  aoMudar: (valor: string) => void
  aoSair: () => void
}>

const DICA = 'Mínimo de 6 caracteres. No fim, você vê a senha de novo para enviar a ele.'

/**
 * A senha inicial do funcionário. Continua `new-password` mesmo visível: é o que impede o
 * navegador de preencher a senha salva do dono. Visível, o campo vira texto, então
 * maiúscula automática, correção e verificação ortográfica ficam desligadas para não
 * mexerem no que foi digitado.
 */
export function CampoDeSenha({ id, valor, erro, aoMudar, aoSair }: CampoDeSenhaProps) {
  const [visivel, setVisivel] = useState(false)

  const idErro = id + '-erro'
  const idDica = id + '-dica'
  const descrito = [erro ? idErro : null, idDica].filter(Boolean).join(' ')

  const cor = erro
    ? 'border-danger focus:border-danger focus:ring-danger'
    : 'border-slate-200 focus:border-brand-600 focus:ring-brand-600'

  function gerar() {
    aoMudar(gerarSenha())
    setVisivel(true)
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        Senha
      </label>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type={visivel ? 'text' : 'password'}
            value={valor}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={erro ? true : undefined}
            aria-describedby={descrito}
            onChange={(evento) => aoMudar(evento.target.value)}
            onBlur={aoSair}
            className={`h-11 w-full rounded-lg border bg-white pl-3 pr-11 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:ring-1 ${cor}`}
          />
          <button
            type="button"
            aria-label={visivel ? 'Esconder a senha' : 'Mostrar a senha'}
            onClick={() => setVisivel((atual) => !atual)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            {visivel ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>

        <button
          type="button"
          onClick={gerar}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <RefreshCw size={16} aria-hidden />
          Gerar
        </button>
      </div>

      <p id={idDica} className="mt-1 text-xs text-slate-500">
        {DICA}
      </p>

      {erro ? (
        <p id={idErro} role="alert" className="mt-1 text-xs font-medium text-danger">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
