const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)

type SeletorDoDiaProps = Readonly<{
  hojeDia: number
  selecionado: number
  contagem: ReadonlyMap<number, number>
  aoEscolher: (dia: number) => void
}>

function descricaoDoDia(dia: number, ehHoje: boolean, quantos: number): string {
  const clientes = quantos === 1 ? '1 cliente' : `${quantos} clientes`
  return `Dia ${dia}${ehHoje ? ', hoje' : ''}, ${quantos === 0 ? 'nenhum cliente' : clientes}`
}

export function SeletorDoDia({ hojeDia, selecionado, contagem, aoEscolher }: SeletorDoDiaProps) {
  return (
    <div role="group" aria-label="Dia do mês" className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {DIAS.map((dia) => {
        const ehHoje = dia === hojeDia
        const escolhido = dia === selecionado
        const quantos = contagem.get(dia) ?? 0
        const aparencia = escolhido
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        const anel = ehHoje ? 'ring-2 ring-brand-600 ring-offset-1' : ''

        return (
          <button
            key={dia}
            type="button"
            aria-pressed={escolhido}
            aria-label={descricaoDoDia(dia, ehHoje, quantos)}
            onClick={() => aoEscolher(dia)}
            className={`flex min-h-11 flex-col items-center justify-center rounded-lg border px-0.5 py-1 leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${aparencia} ${anel}`}
          >
            <span aria-hidden className="text-sm font-semibold">
              {dia}
            </span>
            {quantos > 0 ? (
              <span
                aria-hidden
                className={`text-[11px] font-medium ${escolhido ? 'text-brand-50' : 'text-slate-500'}`}
              >
                {quantos}
              </span>
            ) : null}
            {ehHoje ? (
              <span
                aria-hidden
                className={`text-[10px] font-semibold uppercase ${escolhido ? 'text-brand-50' : 'text-brand-700'}`}
              >
                Hoje
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
