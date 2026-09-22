import { useEffect, useId, useRef } from 'react'
import { FileJson, FileSpreadsheet, X } from 'lucide-react'
import { Nota } from '@/components/ui/Nota'
import { useClientes } from '@/data/useClientes'
import {
  nomeDoArquivo,
  paraCSV,
  paraJSON,
  resumoDaLista,
  situacaoExportacao,
} from '@/lib/exportacao'

function baixar(conteudo: string, nome: string, tipo: string): void {
  const endereco = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const link = document.createElement('a')

  link.href = endereco
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(endereco), 1000)
}

export function ExportarClientes({ aoFechar }: Readonly<{ aoFechar: () => void }>) {
  const { clientes, arquivados, confianca, pendentes } = useClientes()

  const dialogo = useRef<HTMLDialogElement>(null)
  const base = useId()

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  const situacao = situacaoExportacao(confianca, clientes.length, pendentes)

  function exportar(extensao: 'json' | 'csv') {
    const agora = new Date()

    if (extensao === 'json') {
      baixar(paraJSON(clientes, agora), nomeDoArquivo('json', agora), 'application/json')
    } else {
      baixar(paraCSV(clientes), nomeDoArquivo('csv', agora), 'text/csv;charset=utf-8')
    }

    aoFechar()
  }

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby={base + '-titulo'}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-slate-50 p-0 backdrop:bg-slate-900/40 md:m-auto md:h-auto md:max-h-[90dvh] md:w-[32rem] md:rounded-2xl md:bg-white"
    >
      <div className="flex h-full flex-col md:max-h-[90dvh]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white p-4 md:rounded-t-2xl">
          <div>
            <h2 id={base + '-titulo'} className="text-lg font-semibold text-slate-900">
              Exportar clientes
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {resumoDaLista(clientes.length, arquivados.length)}. Arquivados entram no arquivo.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {situacao.pode ? null : <Nota tom="alerta">{situacao.motivo}</Nota>}
          {situacao.pode && situacao.alerta ? (
            <Nota tom="alerta" titulo="Confira antes de guardar este arquivo">
              {situacao.alerta}
            </Nota>
          ) : null}

          <button
            type="button"
            disabled={!situacao.pode}
            onClick={() => exportar('json')}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200"
          >
            <FileJson size={20} aria-hidden className="mt-0.5 shrink-0 text-brand-600" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                Backup completo (.json)
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                Guarda tudo, inclusive as datas e o que está arquivado. É o arquivo que
                consegue devolver os clientes se algo acontecer. Guarde fora do celular.
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={!situacao.pode}
            onClick={() => exportar('csv')}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200"
          >
            <FileSpreadsheet size={20} aria-hidden className="mt-0.5 shrink-0 text-brand-600" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                Planilha para conferir (.csv)
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                Abre no Excel e imprime. Serve para ler e conferir a lista — para restaurar,
                use o backup completo.
              </span>
            </span>
          </button>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-b-2xl md:pb-4">
          <button
            type="button"
            onClick={aoFechar}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  )
}
