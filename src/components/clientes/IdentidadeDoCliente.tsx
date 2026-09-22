import { MapPin, Phone } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { dataBonita } from '@/lib/data'
import { iniciaisDe } from '@/lib/texto'
import type { Cliente } from '@/types/cliente'

export function Linha({ rotulo, children }: Readonly<{ rotulo: string; children: ReactNode }>) {
  return (
    <div>
      <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {rotulo}
      </dt>
      <dd className="text-sm text-slate-700">{children}</dd>
    </div>
  )
}

export function CabecalhoDoCliente({ cliente }: Readonly<{ cliente: Cliente }>) {
  return (
    <div className="flex items-center gap-3">
      <Avatar iniciais={iniciaisDe(cliente.nome)} destacado className="h-12 w-12 text-base" />
      <div className="min-w-0">
        <div className="text-xs font-bold tracking-wide text-brand-700">#{cliente.numero}</div>
        <div className="truncate text-base font-bold text-slate-900">{cliente.nome}</div>
      </div>
    </div>
  )
}

/** Contato, endereço, CPF e cadastro — o mesmo conteúdo no painel e na página. */
export function DadosDoCliente({ cliente }: Readonly<{ cliente: Cliente }>) {
  return (
    <>
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

      {cliente.observacao ? <Linha rotulo="Observação">{cliente.observacao}</Linha> : null}
    </>
  )
}
