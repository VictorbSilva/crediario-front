type CampoProps = Readonly<{
  id: string
  rotulo: string
  valor: string
  maxLength?: number
  erro?: string
  dica?: string
  obrigatorio?: boolean
  multilinha?: boolean
  tipo?: 'text' | 'date'
  inputMode?: 'numeric' | 'decimal' | 'tel' | 'text'
  focoInicial?: boolean
  aoMudar: (valor: string) => void
  aoSair: () => void
}>

export function Campo({
  id,
  rotulo,
  valor,
  maxLength,
  erro,
  dica,
  obrigatorio = false,
  multilinha = false,
  tipo = 'text',
  inputMode = 'text',
  focoInicial = false,
  aoMudar,
  aoSair,
}: CampoProps) {
  const idErro = id + '-erro'
  const idDica = id + '-dica'
  const descrito = [erro ? idErro : null, dica ? idDica : null].filter(Boolean).join(' ')

  const comum =
    'w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:ring-1 '
  const cor = erro
    ? 'border-danger focus:border-danger focus:ring-danger'
    : 'border-slate-200 focus:border-brand-600 focus:ring-brand-600'

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {rotulo}
        {obrigatorio ? null : <span className="ml-1.5 text-xs text-slate-400">opcional</span>}
      </label>

      {multilinha ? (
        <textarea
          id={id}
          value={valor}
          rows={3}
          maxLength={maxLength}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descrito || undefined}
          onChange={(evento) => aoMudar(evento.target.value)}
          onBlur={aoSair}
          className={comum + cor + ' py-2'}
        />
      ) : (
        <input
          id={id}
          type={tipo}
          value={valor}
          inputMode={tipo === 'date' ? undefined : inputMode}
          maxLength={maxLength}
          autoFocus={focoInicial}
          autoComplete="off"
          aria-invalid={erro ? true : undefined}
          aria-describedby={descrito || undefined}
          onChange={(evento) => aoMudar(evento.target.value)}
          onBlur={aoSair}
          className={comum + cor + ' h-11'}
        />
      )}

      {dica ? (
        <p id={idDica} className="mt-1 text-xs text-slate-500">
          {dica}
        </p>
      ) : null}

      {erro ? (
        <p id={idErro} role="alert" className="mt-1 text-xs font-medium text-danger">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
