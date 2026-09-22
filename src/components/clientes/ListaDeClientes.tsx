import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusPill } from '@/components/ui/StatusPill'
import { iniciaisDe } from '@/lib/texto'
import type { Cliente } from '@/types/cliente'

type ListaDeClientesProps = {
  encontrados: readonly Cliente[]
  cadastrados: number
  carregando: boolean
  selecionadoId?: string
  aoSelecionar: (id: string) => void
}

export function ListaDeClientes({
  encontrados,
  cadastrados,
  carregando,
  selecionadoId,
  aoSelecionar,
}: ListaDeClientesProps) {
  if (carregando) {
    return <EmptyState>Carregando os clientes deste aparelho…</EmptyState>
  }

  if (cadastrados === 0) {
    return <EmptyState>Nenhum cliente cadastrado ainda. Comece pelo botão “Novo cliente”.</EmptyState>
  }

  if (encontrados.length === 0) {
    return <EmptyState>Nenhum cliente encontrado para esta busca.</EmptyState>
  }

  return (
    <ul className="flex flex-col gap-2">
      {encontrados.map((cliente) => {
        const ativo = selecionadoId === cliente.id
        const contorno = ativo
          ? 'border-brand-600 ring-1 ring-brand-600'
          : 'border-slate-200 hover:border-slate-300'

        return (
          <li key={cliente.id}>
            <button
              type="button"
              onClick={() => aoSelecionar(cliente.id)}
              className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors ${contorno}`}
            >
              <Avatar iniciais={iniciaisDe(cliente.nome)} destacado={ativo} className="h-10 w-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  <span className="text-brand-700">#{cliente.numero}</span> · {cliente.nome}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {cliente.endereco ?? 'Sem endereço'}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {cliente.arquivado ? <StatusPill>Arquivado</StatusPill> : null}
                {cliente.pendente ? <StatusPill tom="marca">Pendente</StatusPill> : null}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
