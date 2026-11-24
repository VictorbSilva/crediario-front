// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DescricaoDePermissao } from '@/lib/equipe'
import { LinhaDePermissao } from './LinhaDePermissao'

function temAsClasses(elemento: Element, classes: string) {
  expect(elemento.className.split(/\s+/)).toEqual(expect.arrayContaining(classes.split(' ')))
}

const CAIXA: DescricaoDePermissao = {
  chave: 'caixaDoDia',
  rotulo: 'Caixa do dia',
  descricao: 'Quanto entrou em cada dia, por Pix, dinheiro e cartão',
  grupo: 'ver',
}

// "Cancelar vendas e pagamentos" é hoje a única permissão com risco.
const ARRISCADA: DescricaoDePermissao = { ...CAIXA, rotulo: 'Permissão arriscada', risco: true }

function montar(permissao: DescricaoDePermissao, ligado = false) {
  const aoMudar = vi.fn()
  const { container } = render(<LinhaDePermissao permissao={permissao} ligado={ligado} aoMudar={aoMudar} />)
  return {
    aoMudar,
    linha: container.firstElementChild as HTMLElement,
    icone: container.querySelector('svg')?.parentElement as HTMLElement,
    titulo: screen.getByText(permissao.rotulo),
    descricao: screen.getByText(permissao.descricao),
  }
}

afterEach(() => {
  cleanup()
})

describe('LinhaDePermissao', () => {
  it('mostra ícone, título e descrição, com o interruptor nomeado pelo título', () => {
    const { linha, icone, titulo, descricao } = montar(CAIXA, true)

    expect(linha.className).toContain('min-h-16')
    expect(linha.className).toContain('px-3.5')
    expect(linha.className).toContain('py-3')
    temAsClasses(icone, 'h-9 w-9 rounded-lg bg-slate-100 text-slate-700')
    temAsClasses(titulo, 'text-sm font-semibold')
    temAsClasses(descricao, 'text-[13px] text-slate-500')
    expect(screen.getByRole('switch', { name: 'Caixa do dia' }).getAttribute('aria-checked')).toBe('true')
  })

  it.each([
    ['o título', (partes: ReturnType<typeof montar>) => partes.titulo],
    ['a descrição', (partes: ReturnType<typeof montar>) => partes.descricao],
    ['o ícone', (partes: ReturnType<typeof montar>) => partes.icone],
    ['o interruptor', () => screen.getByRole('switch')],
  ])('tocar n%s alterna uma vez só', (_parte, alvo) => {
    const partes = montar(CAIXA)

    fireEvent.click(alvo(partes))

    expect(partes.aoMudar).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('ligada, o toque pede para desligar', () => {
    const { aoMudar, titulo } = montar(CAIXA, true)

    fireEvent.click(titulo)

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('sem risco, nada fica vermelho', () => {
    const { linha, titulo, descricao } = montar(CAIXA)

    expect(linha.className).not.toContain('bg-danger-soft')
    expect(titulo.className).not.toContain('text-danger')
    expect(descricao.className).not.toContain('text-danger')
  })

  it('com risco, fundo, textos e ícone ficam no tom de perigo', () => {
    const { linha, icone, titulo, descricao } = montar(ARRISCADA)

    expect(linha.className).toContain('bg-danger-soft')
    expect(titulo.className).toContain('text-danger')
    expect(descricao.className).toContain('text-danger')
    temAsClasses(icone, 'bg-white text-danger')
    expect(icone.className).not.toContain('bg-slate-100')
  })
})
