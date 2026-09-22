import { Archive, ArchiveRestore, MapPin, Phone } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { dataBonita } from '@/lib/data'
import { iniciaisDe } from '@/lib/texto'
import type { Cliente } from '@/types/cliente'

function Linha({ rotulo, children }: Readonly<{ rotulo: string; children: ReactNode }>) {
  return (
    <div>
      <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {rotulo}
      </dt>
      <dd className="text-sm text-slate-700">{children}</dd>
    </div>
  )
}

type PainelDoClienteProps = {
  cliente: Cliente
  aoAlternarArquivo: (cliente: Cliente) => void
}

export function PainelDoCliente({ cliente, aoAlternarArquivo }: PainelDoClienteProps) {
  const arquivado = cliente.arquivado === true

  return (
    <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-6">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <Avatar iniciais={iniciaisDe(cliente.nome)} destacado className="h-12 w-12 text-base" />
          <div className="min-w-0">
            <div className="text-xs font-bold tracking-wide text-brand-700">#{cliente.numero}</div>
            <div className="truncate text-base font-bold text-slate-900">{cliente.nome}</div>
          </div>
        </div>
      </div>

      <dl className="flex flex-col gap-4 p-4">
        {cliente.telefone ? (
          <Linha rotulo="Contato">
            <span className="flex items-center gap-2">
              <Phone size={16} aria-hidden className="shrink-0 text-slate-400" />
              {cliente.telefone}
            </span>
          </Linha>
        ) : null}

        {cliente.endereco ? (
          <Linha rotulo="Endereço">
            <span className="flex items-start gap-2">
              <MapPin size={16} aria-hidden className="mt-0.5 shrink-0 text-slate-400" />
              {cliente.endereco}
            </span>
          </Linha>
        ) : null}

        {cliente.cpf ? <Linha rotulo="CPF">{cliente.cpf}</Linha> : null}

        <Linha rotulo="Cadastrado em">{dataBonita(cliente.cadastradoEm)}</Linha>

        {cliente.observacao ? (
          <Linha rotulo="Observação">{cliente.observacao}</Linha>
        ) : null}

        <Linha rotulo="Carnês">
          <EmptyState>Carnês e parcelas dependem das regras financeiras.</EmptyState>
        </Linha>
      </dl>

      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={() => aoAlternarArquivo(cliente)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          {arquivado ? (
            <ArchiveRestore size={17} aria-hidden />
          ) : (
            <Archive size={17} aria-hidden />
          )}
          {arquivado ? 'Desarquivar cliente' : 'Arquivar cliente'}
        </button>
      </div>
    </aside>
  )
}
