import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toBlob } from 'html-to-image'
import { entregarArquivo } from '@/components/entregarArquivo'
import { dadosDaLoja } from '@/lib/ambiente'
import { montarDocumentoDaVenda } from '@/lib/carne'
import type { EntradaDocumentoDaVenda } from '@/lib/carne'

type Dados = Omit<EntradaDocumentoDaVenda, 'loja'>
type DocumentoDaVendaProps = Readonly<{
  /** A venda pode chegar pelo listener depois do id devolvido por registrarVenda. */
  dados: Dados | null
  aoFechar: () => void
}>

export function DocumentoDaVenda({ dados, aoFechar }: DocumentoDaVendaProps) {
  const tituloId = useId()
  const cartao = useRef<HTMLElement>(null)
  const montado = useRef(false)
  const entregaEmCurso = useRef(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const [imagem, setImagem] = useState<{ dados: Dados; arquivo: File | null; falhou: boolean } | null>(null)
  const documento = useMemo(() => dados ? montarDocumentoDaVenda({ ...dados, loja: dadosDaLoja(import.meta.env) }) : null, [dados])
  const completo = documento?.vencimentos != null
  const arquivo = imagem?.dados === dados ? imagem?.arquivo : null
  const falhou = imagem?.dados === dados && imagem?.falhou

  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  useEffect(() => {
    if (!dados || !completo) return
    let ativo = true
    async function prepararImagem() {
      try {
        const blob = await toBlob(cartao.current!, {
          pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true,
        })
        if (!blob) throw new Error('Imagem vazia')
        if (ativo) setImagem({ dados: dados!, arquivo: new File([blob], `venda-${dados!.cliente.numero}-${dados!.venda.dataVenda}.png`, { type: 'image/png' }), falhou: false })
      } catch {
        if (ativo) setImagem({ dados: dados!, arquivo: null, falhou: true })
      }
    }
    void prepararImagem()
    return () => { ativo = false }
  }, [dados, completo])

  function compartilhar() {
    if (!arquivo || entregaEmCurso.current) return
    entregaEmCurso.current = true
    setCompartilhando(true)
    // O PNG já está pronto: o share sai na mesma volta do toque no iOS.
    entregarArquivo(arquivo).finally(() => {
      entregaEmCurso.current = false
      if (montado.current) setCompartilhando(false)
    })
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={tituloId}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 p-4 font-sans text-slate-900 print:static print:overflow-visible print:bg-white print:p-0 print:[body:has(&)>#root]:hidden">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap gap-3 print:hidden">
        <button type="button" onClick={() => window.print()} disabled={!completo}
          className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Imprimir</button>
        <button type="button" onClick={compartilhar} disabled={!arquivo || compartilhando}
          className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Compartilhar imagem</button>
        <button type="button" onClick={aoFechar}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">Fechar</button>
        {!arquivo && !falhou && completo ? <p role="status" className="w-full text-sm">Preparando a imagem…</p> : null}
        {falhou ? <p role="alert" className="w-full text-sm">Não deu para gerar a imagem. Use a impressão ou tire um print desta tela.</p> : null}
      </div>
      <article ref={cartao} className="mx-auto w-full max-w-[210mm] break-words bg-white p-6 text-sm shadow-lg print:m-0 print:max-w-[210mm] print:p-0 print:shadow-none">
        <header className="border-b border-slate-300 pb-3 text-center">
          {documento?.nomeDaLoja ? <p className="text-xl font-bold">{documento.nomeDaLoja}</p> : null}
          {documento?.cnpj ? <p>{documento.cnpj}</p> : null}
          {documento?.telefone ? <p>{documento.telefone}</p> : null}
          <h2 id={tituloId} className="mt-2 text-lg font-bold">Comprovante de venda</h2>
        </header>
        {documento ? (
          <>
            <div className="my-4">
              <p className="font-semibold">{documento.cliente}</p>
              {documento.cpf ? <p>{documento.cpf}</p> : null}
              {documento.contato ? <p>{documento.contato}</p> : null}
              {documento.endereco ? <p>{documento.endereco}</p> : null}
              <p className="mt-2">Data da venda: {documento.dataVenda}</p>
            </div>
            {documento.itens && documento.itens.length > 0 ? (
              <table aria-label="Itens da venda" className="w-full border-collapse text-left text-xs sm:text-sm print:text-sm">
                <thead><tr>
                  {['Qtd', 'Descrição', 'Unitário', 'Subtotal'].map((titulo) => <th key={titulo} scope="col" className="border border-slate-300 p-1.5">{titulo}</th>)}
                </tr></thead>
                <tbody>{documento.itens.map((item, indice) => (
                  <tr key={indice} className="break-inside-avoid">
                    <td className="border border-slate-300 p-1.5">{item.quantidade}</td>
                    <td className="border border-slate-300 p-1.5">{item.descricao}</td>
                    <td className="border border-slate-300 p-1.5 text-right tabular-nums">{item.unitario}</td>
                    <td className="border border-slate-300 p-1.5 text-right tabular-nums">{item.subtotal}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : null}
            <p className="my-3 text-right font-bold">Total: {documento.total}</p>
            <p className="mb-3 font-semibold">{documento.plano}</p>
          </>
        ) : null}
        {documento?.vencimentos ? (
          <table aria-label="Vencimentos" className="w-full border-collapse text-left">
            <thead><tr>
              {['Parcela', 'Vencimento', 'Valor'].map((titulo) => <th key={titulo} scope="col" className="border border-slate-300 p-1.5">{titulo}</th>)}
            </tr></thead>
            <tbody>{documento.vencimentos.map((linha) => (
              <tr key={linha.parcela} className="break-inside-avoid">
                <td className="border border-slate-300 p-1.5">{linha.parcela}</td>
                <td className="border border-slate-300 p-1.5">{linha.data}</td>
                <td className="border border-slate-300 p-1.5 text-right tabular-nums">{linha.valor}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p role="status" className="my-4">Carregando os vencimentos…</p>}
        <footer className="mt-6 break-inside-avoid">
          <p>Declaro que comprei os itens acima e estou ciente dos vencimentos.</p>
          <div className="mt-12 border-t border-slate-500 pt-2 text-center">Assinatura do cliente</div>
          <p className="mt-4 text-right">Data: ___/___/______</p>
        </footer>
      </article>
    </div>,
    document.body,
  )
}
