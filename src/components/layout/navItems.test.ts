import { describe, expect, it } from 'vitest'
import type { Acesso, Permissoes } from '@/lib/acesso'
import { itensDeNavegacao, navItems } from './navItems'

function membro(permissoes: Permissoes): Acesso {
  return { estado: 'liberado', dono: false, permissoes }
}

const rotulos = (acesso: Acesso) => itensDeNavegacao(acesso).map(({ label }) => label)

describe('itensDeNavegacao', () => {
  it('o dono vê todos os itens, na ordem de navItems', () => {
    const dono: Acesso = {
      estado: 'liberado', dono: true, permissoes: { financeiro: true, caixaDoDia: true, exportar: true },
    }

    expect(itensDeNavegacao(dono)).toEqual(navItems)
  })

  it.each([
    ['só financeiro', { financeiro: true, caixaDoDia: false, exportar: false }],
    ['só caixa do dia', { financeiro: false, caixaDoDia: true, exportar: false }],
  ])('com %s, Financeiro continua no menu', (_rotulo, permissoes) => {
    expect(rotulos(membro(permissoes))).toEqual(['Clientes', 'Rotas', 'Financeiro'])
  })

  it('sem financeiro nem caixa do dia, Financeiro sai do menu, mesmo podendo exportar', () => {
    expect(rotulos(membro({ financeiro: false, caixaDoDia: false, exportar: true }))).toEqual(['Clientes', 'Rotas'])
  })

  it('só o item Financeiro exige a permissão', () => {
    expect(navItems.filter((item) => item.exigeFinanceiro).map(({ label }) => label)).toEqual(['Financeiro'])
  })
})
