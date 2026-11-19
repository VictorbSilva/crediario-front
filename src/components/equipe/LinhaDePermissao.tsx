import { useId } from 'react'
import { Interruptor } from '@/components/ui/Interruptor'
import type { DescricaoDePermissao } from '@/lib/equipe'
import { ICONES_DAS_PERMISSOES } from './iconesDePermissoes'

type LinhaDePermissaoProps = Readonly<{
  permissao: DescricaoDePermissao
  ligado: boolean
  aoMudar: (ligado: boolean) => void
}>

/**
 * O `<label>` em volta do interruptor faz a linha inteira tocável: o toque no texto ou no
 * ícone vira um clique no botão, e o toque no próprio botão não se repete.
 */
export function LinhaDePermissao({ permissao, ligado, aoMudar }: LinhaDePermissaoProps) {
  const base = useId()
  const Icone = ICONES_DAS_PERMISSOES[permissao.chave]
  const risco = permissao.risco === true

  return (
    <label
      className={`flex min-h-16 cursor-pointer items-center gap-3 px-3.5 py-3 ${risco ? 'bg-danger-soft' : ''}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          risco ? 'bg-white text-danger' : 'bg-slate-100 text-slate-700'
        }`}
      >
        <Icone size={18} aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span
          id={base + '-titulo'}
          className={`block text-sm font-semibold ${risco ? 'text-danger' : 'text-slate-900'}`}
        >
          {permissao.rotulo}
        </span>
        <span className={`mt-0.5 block text-[13px] ${risco ? 'text-danger' : 'text-slate-500'}`}>
          {permissao.descricao}
        </span>
      </span>

      <Interruptor ligado={ligado} aoMudar={aoMudar} idDoRotulo={base + '-titulo'} />
    </label>
  )
}
