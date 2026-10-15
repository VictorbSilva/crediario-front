import { useEffect, useId, useRef } from 'react'
import { FileJson, FileSpreadsheet, X } from 'lucide-react'
import { Nota } from '@/components/ui/Nota'
import { CARNE_COMPLETO, useCarneDaEmpresa } from '@/data/useCarneDaEmpresa'
import { useClientes } from '@/data/useClientes'
import {
  conferenciaDoCarne,
  nomeDoArquivo,
  paraCSV,
  paraJSON,
  resumoDaLista,
  situacaoDoBackup,
  situacaoExportacao,
} from '@/lib/exportacao'

function entregarArquivo(conteudo: string, nome: string, tipo: string): Promise<void> {
  const arquivo = new File([conteudo], nome, { type: tipo })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [arquivo] })) {
    return navigator.share({ files: [arquivo], title: nome }).catch((erro) => {
      if (erro?.name !== 'AbortError') baixarComLink(arquivo, nome)
    })
  }

  baixarComLink(arquivo, nome)
  return Promise.resolve()
}

function baixarComLink(arquivo: File, nome: string): void {
  const endereco = URL.createObjectURL(arquivo)
  const link = document.createElement('a')

  link.href = endereco
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(endereco), 60_000)
}

export function ExportarClientes({ aoFechar }: Readonly<{ aoFechar: () => void }>) {
  const { clientes, arquivados, confianca, pendentes } = useClientes()
  const { vendas, parcelas, pagamentos, ...carne } = useCarneDaEmpresa(CARNE_COMPLETO)

  const dialogo = useRef<HTMLDialogElement>(null)
  const base = useId()

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  const situacao = situacaoExportacao(confianca, clientes.length, pendentes)
  const backup = situacaoDoBackup({
    confianca: carne.confianca,
    pendentes: carne.pendentes,
    conferencia: conferenciaDoCarne(vendas, parcelas),
    erro: carne.erro,
  })

  function exportar(extensao: 'json' | 'csv') {
    const agora = new Date()

    if (extensao === 'json') {
      entregarArquivo(
        paraJSON(clientes, { vendas, parcelas, pagamentos }, agora),
        nomeDoArquivo('json', agora),
        'application/json',
      ).finally(aoFechar)
    } else {
      entregarArquivo(paraCSV(clientes), nomeDoArquivo('csv', agora), 'text/csv;charset=utf-8')
        .finally(aoFechar)
    }
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
              {resumoDaLista(clientes.length, arquivados.length)}
              {carne.carregando
                ? null
                : ` · ${vendas.length} ${vendas.length === 1 ? 'venda' : 'vendas'} · ${pagamentos.length} ${pagamentos.length === 1 ? 'pagamento' : 'pagamentos'}`}
              . Arquivados entram no arquivo.
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
          {backup.pode ? null : <Nota tom="alerta">{backup.motivo}</Nota>}
          {backup.pode && backup.alerta ? (
            <Nota tom="alerta" titulo="Confira o carnê antes de guardar o backup">
              {backup.alerta}
            </Nota>
          ) : null}

          <button
            type="button"
            disabled={!situacao.pode || !backup.pode}
            onClick={() => exportar('json')}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200"
          >
            <FileJson size={20} aria-hidden className="mt-0.5 shrink-0 text-brand-600" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                Backup completo (.json)
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                Clientes, vendas, parcelas e pagamentos — o arquivo que consegue devolver tudo
                se algo acontecer. Guarde fora do celular.
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
