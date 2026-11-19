import { useId } from 'react'
import { Lock } from 'lucide-react'
import type { Permissoes } from '@/lib/acesso'
import { DESCRICAO_DAS_PERMISSOES, perfilDe, permissoesDoPerfil } from '@/lib/equipe'
import type { GrupoDePermissao, Perfil } from '@/lib/equipe'
import { LinhaDePermissao } from './LinhaDePermissao'

const PERFIS: ReadonlyArray<{ perfil: Perfil; rotulo: string }> = [
  { perfil: 'cobrador', rotulo: 'Cobrador' },
  { perfil: 'gerente', rotulo: 'Gerente' },
  { perfil: 'personalizado', rotulo: 'Personalizado' },
]

const GRUPOS: ReadonlyArray<{ grupo: GrupoDePermissao; titulo: string }> = [
  { grupo: 'ver', titulo: 'Pode ver' },
  { grupo: 'fazer', titulo: 'Pode fazer' },
]

type SeletorDePermissoesProps = Readonly<{
  permissoes: Permissoes
  aoMudar: (permissoes: Permissoes) => void
}>

/** O bloco de permissões dos dois modais da Equipe. Ver docs/padrao-ui.md, seção Equipe. */
export function SeletorDePermissoes({ permissoes, aoMudar }: SeletorDePermissoesProps) {
  const base = useId()
  const ativo = perfilDe(permissoes)

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Permissões</h3>

      <div role="group" aria-label="Perfil" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1">
        {PERFIS.map(({ perfil, rotulo }) => (
          <button
            key={perfil}
            type="button"
            aria-pressed={ativo === perfil}
            // Personalizado é o que sobra quando se mexe num interruptor: não aplica nada.
            onClick={() => {
              if (perfil !== 'personalizado') aoMudar(permissoesDoPerfil(perfil))
            }}
            className={`min-h-11 rounded-lg px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              ativo === perfil ? 'bg-white font-bold text-slate-900 shadow-sm' : 'font-semibold text-slate-600'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-3.5">
        <Lock size={18} aria-hidden className="mt-0.5 shrink-0 text-brand-700" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-brand-800">Sempre liberado</div>
          <div className="mt-0.5 text-[13px] text-brand-700">Clientes, Rotas e o carnê de cada cliente</div>
        </div>
      </div>

      {GRUPOS.map(({ grupo, titulo }) => {
        const doGrupo = DESCRICAO_DAS_PERMISSOES.filter((permissao) => permissao.grupo === grupo)
        if (doGrupo.length === 0) return null

        const idDoTitulo = `${base}-${grupo}`
        return (
          <div key={grupo}>
            <h4 id={idDoTitulo} className="mb-1.5 text-[13px] font-semibold text-slate-600">
              {titulo}
            </h4>
            <div
              role="group"
              aria-labelledby={idDoTitulo}
              className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              {doGrupo.map((permissao) => (
                <LinhaDePermissao
                  key={permissao.chave}
                  permissao={permissao}
                  ligado={permissoes[permissao.chave]}
                  aoMudar={(ligado) => aoMudar({ ...permissoes, [permissao.chave]: ligado })}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
