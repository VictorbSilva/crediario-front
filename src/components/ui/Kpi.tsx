export type TomKpi = 'neutro' | 'marca' | 'sucesso' | 'alerta' | 'perigo'

const tons: Record<TomKpi, string> = {
  neutro: 'text-slate-900',
  marca: 'text-brand-600',
  sucesso: 'text-success',
  alerta: 'text-warning',
  perigo: 'text-danger',
}

type KpiProps = {
  rotulo: string
  valor: string
  tom?: TomKpi
}

export function Kpi({ rotulo, valor, tom = 'neutro' }: KpiProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{rotulo}</div>
      <div
        className={`mt-1 text-xl font-bold tracking-tight md:text-2xl ${tons[tom]}`}
      >
        {valor}
      </div>
    </div>
  )
}
