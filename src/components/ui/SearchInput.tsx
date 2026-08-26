import { Search } from 'lucide-react'

type SearchInputProps = {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (valor: string) => void
}

export function SearchInput({ id, label, placeholder, value, onChange }: SearchInputProps) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        size={18}
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(evento) => onChange(evento.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
      />
    </div>
  )
}
