type InterruptorProps = Readonly<{
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  /** O id do texto que nomeia o interruptor (`aria-labelledby`). */
  idDoRotulo: string
  desabilitado?: boolean
}>

/**
 * Liga e desliga, 48×28: trilho da marca ligado e cinza desligado, com a bolinha de 22 px
 * indo para a direita. Ver docs/padrao-ui.md.
 */
export function Interruptor({ ligado, aoMudar, idDoRotulo, desabilitado = false }: InterruptorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-labelledby={idDoRotulo}
      disabled={desabilitado}
      onClick={() => aoMudar(!ligado)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        ligado ? 'bg-brand-600' : 'bg-slate-300'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform ${
          ligado ? 'translate-x-[23px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}
