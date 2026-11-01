import { useEffect, useId, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { entregarArquivo } from '@/components/entregarArquivo'
import { Nota } from '@/components/ui/Nota'
import { dadosDaLoja } from '@/lib/ambiente'
import { montarRecibo } from '@/lib/carne'
import type { EntradaRecibo } from '@/lib/carne'

type ReciboDoPagamentoProps = Readonly<{
  dados: Omit<EntradaRecibo, 'loja'>
  aoFechar: () => void
}>

export function ReciboDoPagamento({ dados, aoFechar }: ReciboDoPagamentoProps) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const cartao = useRef<HTMLElement>(null)
  const montado = useRef(false)
  const entregaEmCurso = useRef(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const tituloId = useId()
  const recibo = montarRecibo({ ...dados, loja: dadosDaLoja(import.meta.env) })

  useEffect(() => {
    montado.current = true
    dialogo.current?.showModal()
    let ativo = true

    async function prepararImagem() {
      try {
        const blob = await toBlob(cartao.current!, {
          pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true,
        })
        if (!blob) throw new Error('Imagem vazia')
        if (ativo) {
          setArquivo(new File([blob], `recibo-${dados.cliente.numero}-${dados.entrada.data}.png`, {
            type: 'image/png',
          }))
        }
      } catch {
        if (ativo) setFalhou(true)
      }
    }

    void prepararImagem()
    return () => {
      ativo = false
      montado.current = false
    }
  }, [dados])

  function compartilhar() {
    if (!arquivo || entregaEmCurso.current) return
    entregaEmCurso.current = true
    setCompartilhando(true)
    // O File já está pronto: share precisa sair da mesma volta do toque no iOS.
    entregarArquivo(arquivo).finally(() => {
      entregaEmCurso.current = false
      if (montado.current) setCompartilhando(false)
    })
  }

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby={tituloId}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-slate-50 p-0 backdrop:bg-slate-900/40 md:m-auto md:h-auto md:max-h-[90dvh] md:w-[34rem] md:rounded-2xl"
    >
      <div className="flex h-full flex-col md:max-h-[90dvh]">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <article ref={cartao} className="shrink-0 break-words rounded-xl border border-slate-200 bg-white p-6 text-slate-900">
            <header className="border-b border-slate-200 pb-4 text-center">
              {recibo.nomeDaLoja ? <p className="text-xl font-bold">{recibo.nomeDaLoja}</p> : null}
              {recibo.cnpj ? <p className="mt-1 text-sm">{recibo.cnpj}</p> : null}
              {recibo.telefone ? <p className="mt-1 text-sm">{recibo.telefone}</p> : null}
              <h2 id={tituloId} className="mt-2 text-lg font-semibold">{recibo.titulo}</h2>
            </header>
            <div className="flex flex-col gap-4 pt-5">
              <p className="font-semibold">{recibo.cliente}</p>
              <p className="text-base leading-relaxed">{recibo.recebimento}</p>
              <div className="text-sm text-slate-600">
                <p>{recibo.venda}</p>
                {recibo.itens ? <p className="mt-1">{recibo.itens}</p> : null}
              </div>
              <p className="border-t border-slate-200 pt-4 font-semibold">{recibo.restante}</p>
              {recibo.proximaCobranca ? <p className="text-sm">{recibo.proximaCobranca}</p> : null}
            </div>
          </article>
          {falhou ? <Nota tom="alerta">Não deu para gerar a imagem. Tire um print desta tela.</Nota> : null}
        </div>
        <div className="flex shrink-0 gap-3 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-b-2xl md:pb-4">
          <button type="button" onClick={aoFechar}
            className="min-h-11 flex-1 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Fechar
          </button>
          <button type="button" onClick={compartilhar} disabled={!arquivo || compartilhando}
            className="min-h-11 flex-1 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            {!arquivo && !falhou ? 'Preparando a imagem…' : 'Compartilhar'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
