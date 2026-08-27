type AvatarProps = {
  iniciais: string
  destacado?: boolean
  className?: string
}

export function Avatar({ iniciais, destacado = false, className = '' }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        destacado ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
      } ${className}`}
    >
      {iniciais}
    </span>
  )
}
