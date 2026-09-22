import { Archive, ArchiveRestore } from 'lucide-react'
import type { Cliente } from '@/types/cliente'

type BotaoArquivarProps = Readonly<{
  cliente: Cliente
  aoAlternarArquivo: (cliente: Cliente) => void
}>

export function BotaoArquivar({ cliente, aoAlternarArquivo }: BotaoArquivarProps) {
  const arquivado = cliente.arquivado === true

  return (
    <button
      type="button"
      onClick={() => aoAlternarArquivo(cliente)}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
    >
      {arquivado ? <ArchiveRestore size={17} aria-hidden /> : <Archive size={17} aria-hidden />}
      {arquivado ? 'Desarquivar cliente' : 'Arquivar cliente'}
    </button>
  )
}
