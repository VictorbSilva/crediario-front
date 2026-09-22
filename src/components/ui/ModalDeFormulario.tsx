import { useEffect, useRef } from 'react'
import type { ReactNode, SubmitEvent } from 'react'
import { X } from 'lucide-react'

type ModalDeFormularioProps = Readonly<{
  titulo: string
  subtitulo?: string
  rotuloDeEnvio: string
  idDoTitulo: string
  children: ReactNode
  aoEnviar: (evento: SubmitEvent<HTMLFormElement>) => void
  aoFechar: () => void
}>

/**
 * Tela cheia no celular, caixa no desktop — o cadastro acontece na rua, em pé,
 * e meia tela ali não serve. O `pb-[env(safe-area-inset-bottom)]` é o que
 * impede o botão de salvar de ficar embaixo da barra do iPhone.
 */
export function ModalDeFormulario({
  titulo,
  subtitulo,
  rotuloDeEnvio,
  idDoTitulo,
  children,
  aoEnviar,
  aoFechar,
}: ModalDeFormularioProps) {
  const dialogo = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby={idDoTitulo}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-slate-50 p-0 backdrop:bg-slate-900/40 md:m-auto md:h-auto md:max-h-[90dvh] md:w-[34rem] md:rounded-2xl md:bg-white"
    >
      <form onSubmit={aoEnviar} className="flex h-full flex-col md:max-h-[90dvh]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white p-4 md:rounded-t-2xl">
          <div>
            <h2 id={idDoTitulo} className="text-lg font-semibold text-slate-900">
              {titulo}
            </h2>
            {subtitulo ? <p className="mt-0.5 text-sm text-slate-500">{subtitulo}</p> : null}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar sem salvar"
            className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>

        <div className="flex shrink-0 gap-3 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-b-2xl md:pb-4">
          <button
            type="button"
            onClick={aoFechar}
            className="min-h-11 flex-1 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 md:flex-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {rotuloDeEnvio}
          </button>
        </div>
      </form>
    </dialog>
  )
}
