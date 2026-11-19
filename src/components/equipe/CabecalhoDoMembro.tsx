import { Avatar } from '@/components/ui/Avatar'
import { StatusPill } from '@/components/ui/StatusPill'
import type { Membro } from '@/lib/equipe'
import { iniciaisDe } from '@/lib/texto'

/** Quem está sendo gerenciado, no topo do card. Ver docs/padrao-ui.md, seção Equipe. */
export function CabecalhoDoMembro({ membro }: Readonly<{ membro: Membro }>) {
  return (
    <div className="flex items-center gap-3">
      <Avatar iniciais={iniciaisDe(membro.nome)} destacado={membro.ativo} className="h-12 w-12 text-base" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-slate-900">{membro.nome}</span>
          <StatusPill tom={membro.ativo ? 'sucesso' : 'neutro'}>{membro.ativo ? 'Ativo' : 'Desativado'}</StatusPill>
          {membro.pendente ? <StatusPill tom="marca">Pendente</StatusPill> : null}
        </div>
        <div className="mt-0.5 truncate text-[13px] text-slate-500">{membro.email}</div>
      </div>
    </div>
  )
}
