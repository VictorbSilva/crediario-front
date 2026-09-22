import { ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { BotaoArquivar } from '@/components/clientes/BotaoArquivar'
import { CabecalhoDoCliente, DadosDoCliente } from '@/components/clientes/IdentidadeDoCliente'
import { CarneDoCliente } from '@/components/clientes/carne/CarneDoCliente'
import { EmptyState } from '@/components/ui/EmptyState'
import { Nota } from '@/components/ui/Nota'
import { StatusPill } from '@/components/ui/StatusPill'
import { useCarne } from '@/data/useCarne'
import { useClientes } from '@/data/useClientes'

function Voltar() {
  return (
    <Link
      to="/clientes"
      className="-ml-2 mb-3.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
    >
      <ChevronLeft size={18} aria-hidden />
      Clientes
    </Link>
  )
}

export function ClientePage() {
  const { id } = useParams<{ id: string }>()
  const { clientes, carregando, alternarArquivo } = useClientes()

  const cliente = clientes.find((item) => item.id === id)
  const dados = useCarne(cliente ? cliente.id : null)

  if (!cliente) {
    return (
      <div>
        <Voltar />
        {carregando ? (
          <EmptyState>Carregando os clientes deste aparelho…</EmptyState>
        ) : (
          <Nota tom="alerta" titulo="Cliente não encontrado">
            Ele pode ter sido removido, ou o endereço está errado.
          </Nota>
        )}
      </div>
    )
  }

  return (
    <div>
      <Voltar />

      <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3.5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <CabecalhoDoCliente cliente={cliente} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cliente.arquivado ? <StatusPill>Arquivado</StatusPill> : null}
                {cliente.pendente ? <StatusPill tom="marca">Pendente</StatusPill> : null}
              </div>
            </div>

            <dl className="flex flex-col gap-4 p-4">
              <DadosDoCliente cliente={cliente} />
            </dl>
          </div>

          <BotaoArquivar cliente={cliente} aoAlternarArquivo={alternarArquivo} />
        </div>

        <div className="flex flex-col gap-3.5">
          <h1 className="text-base font-bold text-slate-900">Vendas</h1>
          <CarneDoCliente dados={dados} />
        </div>
      </div>
    </div>
  )
}
