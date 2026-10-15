import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SeletorDoDia } from './SeletorDoDia'

type Opcoes = {
  ano?: number
  mes?: number
  escolhida?: string
  contagem?: Map<string, number>
  podeVoltar?: boolean
  podeAvancar?: boolean
}

function html({
  ano = 2026, mes = 10, escolhida = '2026-10-14', contagem = new Map<string, number>(),
  podeVoltar = false, podeAvancar = true,
}: Opcoes = {}): string {
  return renderToStaticMarkup(
    createElement(SeletorDoDia, {
      ano, mes, hoje: '2026-10-14', escolhida, contagem, podeVoltar, podeAvancar,
      aoEscolher: () => undefined, aoTrocarMes: () => undefined,
    }),
  )
}

function datas(marcacao: string): string[] {
  return [...marcacao.matchAll(/aria-pressed="(?:true|false)"/g)].map((m) => m[0])
}

describe('SeletorDoDia', () => {
  it('mostra o mês, os dias da semana e as 31 datas de outubro como botões de 44 px', () => {
    const marcacao = html()
    expect(marcacao).toContain('Outubro de 2026')
    expect(marcacao).toContain('>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S<')
    expect(datas(marcacao)).toHaveLength(31)
    expect(marcacao.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(marcacao.match(/min-h-11/g)!.length).toBeGreaterThanOrEqual(33)
  })

  it('deixa quatro células vazias antes de 1/10/2026, que cai numa quinta', () => {
    const marcacao = html()
    const antesDoDia1 = marcacao.slice(0, marcacao.indexOf('aria-label="1 de outubro'))
    expect(antesDoDia1.match(/<div aria-hidden="true"><\/div>/g)).toHaveLength(4)
  })

  it('descreve cada data com dia, mês, "hoje" e a contagem no singular e no plural', () => {
    const marcacao = html({ contagem: new Map([['2026-10-05', 1], ['2026-10-14', 3], ['2026-10-20', 2]]) })
    expect(marcacao).toContain('aria-label="14 de outubro, hoje, 3 clientes"')
    expect(marcacao).toContain('aria-label="5 de outubro, 1 cliente"')
    expect(marcacao).toContain('aria-label="20 de outubro, 2 clientes"')
    expect(marcacao).toContain('aria-label="6 de outubro, nenhum cliente"')
    expect(marcacao).toContain('>3</span>')
  })

  it('destaca a escolhida e põe anel e rótulo só em hoje', () => {
    const marcacao = html({ escolhida: '2026-10-20' })
    expect(marcacao.match(/bg-brand-600 text-white/g)).toHaveLength(1)
    expect(marcacao.match(/ring-2 ring-brand-600 ring-offset-1/g)).toHaveLength(1)
    expect(marcacao.match(/>Hoje</g)).toHaveLength(1)
    expect(marcacao).toContain('aria-label="14 de outubro, hoje, nenhum cliente"')
  })

  it('no mês seguinte não marca hoje e libera só a volta', () => {
    const marcacao = html({ mes: 11, escolhida: '2026-11-01', podeVoltar: true, podeAvancar: false })
    expect(marcacao).toContain('Novembro de 2026')
    expect(datas(marcacao)).toHaveLength(30)
    expect(marcacao).not.toContain('>Hoje<')
    expect(marcacao).toContain('aria-label="1 de novembro, nenhum cliente"')
    expect(marcacao).toContain('aria-label="Mês anterior" class=')
    expect(marcacao).toContain('aria-label="Próximo mês" disabled=""')
  })

  it('no mês atual desabilita "Mês anterior"', () => {
    const marcacao = html()
    expect(marcacao).toContain('aria-label="Mês anterior" disabled=""')
    expect(marcacao).toContain('aria-label="Próximo mês" class=')
  })
})
