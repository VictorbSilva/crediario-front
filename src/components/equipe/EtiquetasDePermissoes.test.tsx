// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Permissoes } from '@/lib/acesso'
import { EtiquetasDePermissoes } from './EtiquetasDePermissoes'

function temAsClasses(elemento: Element, classes: string) {
  expect(elemento.className.split(/\s+/)).toEqual(expect.arrayContaining(classes.split(' ')))
}

const NENHUMA: Permissoes = { financeiro: false, caixaDoDia: false, exportar: false }

afterEach(() => {
  cleanup()
})

describe('EtiquetasDePermissoes', () => {
  it('uma etiqueta com ícone de 14 px por permissão ligada, na ordem da descrição', () => {
    render(<EtiquetasDePermissoes permissoes={{ financeiro: false, caixaDoDia: true, exportar: true }} />)

    const etiquetas = screen.getAllByRole('listitem')
    expect(etiquetas.map((etiqueta) => etiqueta.textContent)).toEqual(['Caixa do dia', 'Exportar dados'])
    for (const etiqueta of etiquetas) {
      temAsClasses(etiqueta, 'inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700')
      const icone = etiqueta.querySelector('svg')
      expect(icone?.getAttribute('width')).toBe('14')
      expect(icone?.getAttribute('aria-hidden')).toBe('true')
    }
    expect(screen.queryByText('Sem permissões extras')).toBeNull()
  })

  it('todas ligadas: as três etiquetas', () => {
    render(<EtiquetasDePermissoes permissoes={{ financeiro: true, caixaDoDia: true, exportar: true }} />)

    expect(screen.getAllByRole('listitem').map((etiqueta) => etiqueta.textContent)).toEqual([
      'Financeiro geral', 'Caixa do dia', 'Exportar dados',
    ])
  })

  it('nenhuma ligada: uma etiqueta tracejada "Sem permissões extras"', () => {
    render(<EtiquetasDePermissoes permissoes={NENHUMA} />)

    const vazia = screen.getByText('Sem permissões extras')
    temAsClasses(vazia, 'border border-dashed border-slate-300 text-slate-500')
    expect(vazia.className).not.toContain('bg-slate-100')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})
