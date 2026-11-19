import type { Permissoes } from '@/lib/acesso'
import { DESCRICAO_DAS_PERMISSOES } from '@/lib/equipe'
import { ICONES_DAS_PERMISSOES } from './iconesDePermissoes'

/** O que o membro tem além do sempre liberado, no cartão da lista. Ver docs/padrao-ui.md. */
export function EtiquetasDePermissoes({ permissoes }: Readonly<{ permissoes: Permissoes }>) {
  const ligadas = DESCRICAO_DAS_PERMISSOES.filter(({ chave }) => permissoes[chave])

  if (ligadas.length === 0) {
    return (
      <span className="inline-flex items-center py-1 text-xs font-semibold text-slate-500">
        Sem permissões extras
      </span>
    )
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {ligadas.map(({ chave, rotulo }) => {
        const Icone = ICONES_DAS_PERMISSOES[chave]
        return (
          <li
            key={chave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
          >
            <Icone size={14} aria-hidden />
            {rotulo}
          </li>
        )
      })}
    </ul>
  )
}
