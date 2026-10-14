import { montarDiasDeVisita, textoDosDias } from '@/lib/rotas'

type SeletorDeDiasProps = {
  id: string
  dias: readonly number[]
  aoMudar: (dias: number[]) => void
}

export function SeletorDeDias({ id, dias, aoMudar }: Readonly<SeletorDeDiasProps>) {
  function alternar(dia: number) {
    aoMudar(montarDiasDeVisita(
      dias.includes(dia) ? dias.filter((atual) => atual !== dia) : [...dias, dia],
    ))
  }

  return (
    <fieldset id={id} aria-describedby={id + '-resumo ' + id + '-dica'} className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Dias de visita no mês</legend>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
          <button
            key={dia}
            type="button"
            aria-pressed={dias.includes(dia)}
            className={
              'min-h-11 rounded-lg border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ' +
              (dias.includes(dia)
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-700')
            }
            onClick={() => alternar(dia)}
          >
            {dia}
          </button>
        ))}
      </div>
      <p id={id + '-resumo'} className="text-sm text-slate-700">{textoDosDias(dias)}</p>
      <p id={id + '-dica'} className="text-sm text-slate-500">
        Dia 31 cai no último dia dos meses mais curtos.
      </p>
    </fieldset>
  )
}
