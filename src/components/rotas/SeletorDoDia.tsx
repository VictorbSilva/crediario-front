import { gradeDoMes, nomeDoMes } from '@/lib/rotas'

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const BOTAO_DO_MES =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-2xl leading-none text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent'

type SeletorDoDiaProps = Readonly<{
  ano: number
  mes: number
  hoje: string
  escolhida: string
  contagem: ReadonlyMap<string, number>
  podeVoltar: boolean
  podeAvancar: boolean
  aoEscolher: (data: string) => void
  aoTrocarMes: (direcao: -1 | 1) => void
}>

function descricaoDaData(dia: number, mes: string, ehHoje: boolean, quantos: number): string {
  const clientes = quantos === 1 ? '1 cliente' : `${quantos} clientes`
  return `${dia} de ${mes}${ehHoje ? ', hoje' : ''}, ${quantos === 0 ? 'nenhum cliente' : clientes}`
}

export function SeletorDoDia({
  ano,
  mes,
  hoje,
  escolhida,
  contagem,
  podeVoltar,
  podeAvancar,
  aoEscolher,
  aoTrocarMes,
}: SeletorDoDiaProps) {
  const titulo = nomeDoMes(ano, mes)
  const mesPorExtenso = titulo.split(' de ')[0].toLowerCase()

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          disabled={!podeVoltar}
          onClick={() => aoTrocarMes(-1)}
          className={BOTAO_DO_MES}
        >
          <span aria-hidden>‹</span>
        </button>
        <p aria-live="polite" className="text-sm font-semibold text-slate-900">
          {titulo}
        </p>
        <button
          type="button"
          aria-label="Próximo mês"
          disabled={!podeAvancar}
          onClick={() => aoTrocarMes(1)}
          className={BOTAO_DO_MES}
        >
          <span aria-hidden>›</span>
        </button>
      </div>

      <div
        aria-hidden
        className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-slate-500 sm:gap-2"
      >
        {DIAS_DA_SEMANA.map((letra, i) => (
          <span key={i}>{letra}</span>
        ))}
      </div>

      <div role="group" aria-label={titulo} className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {gradeDoMes(ano, mes).map((data, i) => {
          if (data === null) return <div key={`vazio-${i}`} aria-hidden />

          const dia = Number(data.slice(8, 10))
          const ehHoje = data === hoje
          const ehEscolhida = data === escolhida
          const quantos = contagem.get(data) ?? 0
          const aparencia = ehEscolhida
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          const anel = ehHoje ? 'ring-2 ring-brand-600 ring-offset-1' : ''

          return (
            <button
              key={data}
              type="button"
              aria-pressed={ehEscolhida}
              aria-label={descricaoDaData(dia, mesPorExtenso, ehHoje, quantos)}
              onClick={() => aoEscolher(data)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg border px-0.5 py-1 leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${aparencia} ${anel}`}
            >
              <span aria-hidden className="text-sm font-semibold">
                {dia}
              </span>
              {quantos > 0 ? (
                <span
                  aria-hidden
                  className={`text-[11px] font-medium ${ehEscolhida ? 'text-brand-50' : 'text-slate-500'}`}
                >
                  {quantos}
                </span>
              ) : null}
              {ehHoje ? (
                <span
                  aria-hidden
                  className={`text-[10px] font-semibold uppercase ${ehEscolhida ? 'text-brand-50' : 'text-brand-700'}`}
                >
                  Hoje
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
