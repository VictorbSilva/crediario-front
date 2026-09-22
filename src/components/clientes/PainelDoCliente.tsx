import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BotaoArquivar } from '@/components/clientes/BotaoArquivar'
import { CabecalhoDoCliente, DadosDoCliente, Linha } from '@/components/clientes/IdentidadeDoCliente'
import { ResumoDeVendas } from '@/components/clientes/carne/ResumoDeVendas'
import { useCarne } from '@/data/useCarne'
import type { Cliente } from '@/types/cliente'

type PainelDoClienteProps = Readonly<{
  cliente: Cliente
  aoAlternarArquivo: (cliente: Cliente) => void
}>

export function PainelDoCliente({ cliente, aoAlternarArquivo }: PainelDoClienteProps) {
  const dados = useCarne(cliente.id)

  return (
    <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-6">
      <div className="border-b border-slate-200 p-4">
        <CabecalhoDoCliente cliente={cliente} />
      </div>

      <dl className="flex flex-col gap-4 p-4">
        <DadosDoCliente cliente={cliente} />

        <Linha rotulo="Vendas em aberto">
          <ResumoDeVendas dados={dados} />
        </Linha>
      </dl>

      <div className="flex flex-col gap-2 border-t border-slate-200 p-4">
        <Link
          to={`/clientes/${cliente.id}`}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Abrir página do cliente
          <ArrowRight size={17} aria-hidden />
        </Link>

        <BotaoArquivar cliente={cliente} aoAlternarArquivo={aoAlternarArquivo} />
      </div>
    </aside>
  )
}
