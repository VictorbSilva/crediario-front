import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SeletorDoDia } from './SeletorDoDia'

function html(selecionado: number, contagem = new Map<number, number>()): string {
  return renderToStaticMarkup(
    createElement(SeletorDoDia, { hojeDia: 14, selecionado, contagem, aoEscolher: () => undefined }),
  )
}

describe('SeletorDoDia', () => {
  it('mostra os 31 dias como botões de 44 px com aria-pressed', () => {
    const marcacao = html(14)
    expect(marcacao.match(/<button/g)).toHaveLength(31)
    expect(marcacao.match(/min-h-11/g)).toHaveLength(31)
    expect(marcacao.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(marcacao.match(/aria-pressed="false"/g)).toHaveLength(30)
  })

  it('destaca o selecionado e põe anel e rótulo só em hoje', () => {
    const marcacao = html(20)
    expect(marcacao.match(/bg-brand-600 text-white/g)).toHaveLength(1)
    expect(marcacao.match(/ring-2 ring-brand-600 ring-offset-1/g)).toHaveLength(1)
    expect(marcacao.match(/>Hoje</g)).toHaveLength(1)
    expect(marcacao).toContain('aria-label="Dia 14, hoje, nenhum cliente"')
  })

  it('mostra a contagem de clientes só nos dias que têm', () => {
    const marcacao = html(14, new Map([[5, 1], [20, 3]]))
    expect(marcacao).toContain('aria-label="Dia 5, 1 cliente"')
    expect(marcacao).toContain('aria-label="Dia 20, 3 clientes"')
    expect(marcacao).toContain('aria-label="Dia 6, nenhum cliente"')
    expect(marcacao).toContain('>3</span>')
  })
})
