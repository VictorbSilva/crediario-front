import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { describe, expect, it } from 'vitest'
import type { EstadoNaRota } from '@/lib/rotas'
import type { Cliente } from '@/types/cliente'
import { ParadaDaRota } from './ParadaDaRota'

const cliente: Cliente = {
  id: 'ana', numero: 12, nome: 'Ana', nomeBusca: 'ana', endereco: 'Rua A, 10',
  cadastradoEm: '2026-09-03', criadoEm: null, atualizadoEm: null, atualizadoPor: 'x', pendente: false,
}
const pendente: EstadoNaRota = {
  situacao: 'pendente', atrasado: false, agendadoPara: '2026-10-14', diaAgendado: 14, ausenteHoje: false,
}

function html(c: Cliente, estado?: EstadoNaRota): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null,
      createElement(DndContext, null,
        createElement(SortableContext, {
          items: [c.id],
          children: createElement(ParadaDaRota, {
            cliente: c, estado, aoMarcar: estado ? () => undefined : undefined,
          }),
        }))),
  )
}

describe('ParadaDaRota', () => {
  it('só a alça tem touch-none; o resto do item deixa o dedo rolar a lista', () => {
    const marcacao = html(cliente, pendente)
    expect(marcacao.match(/touch-none/g)).toHaveLength(1)
    const alca = /<button[^>]*aria-label="Arrastar Ana"[^>]*>/.exec(marcacao)?.[0] ?? ''
    expect(alca).toContain('touch-none')
    expect(alca).toContain('min-h-11')
  })

  it('mostra número, nome, endereço e o atalho para o carnê', () => {
    const marcacao = html(cliente, pendente)
    expect(marcacao).toContain('#12')
    expect(marcacao).toContain('Ana')
    expect(marcacao).toContain('Rua A, 10')
    expect(marcacao).toMatch(/<a [^>]*href="\/clientes\/ana"[^>]*>Carnê<\/a>/)
  })

  it('pendente na rota de hoje oferece Visitado e Ausente, não Desmarcar', () => {
    const marcacao = html(cliente, pendente)
    expect(marcacao).toContain('>Visitado<')
    expect(marcacao).toContain('>Ausente<')
    expect(marcacao).not.toContain('>Desmarcar<')
  })

  it('visitado fica esmaecido, com a pill Visitado e só Desmarcar', () => {
    const marcacao = html(cliente, { ...pendente, situacao: 'visitado' })
    expect(marcacao).toContain('opacity-60')
    expect(marcacao).toMatch(/text-success[^>]*>Visitado</)
    expect(marcacao).toContain('>Desmarcar<')
    expect(marcacao).not.toContain('>Ausente<')
  })

  it('ausente hoje mantém o cliente pendente, com a pill Ausente e Desmarcar', () => {
    const marcacao = html(cliente, { ...pendente, ausenteHoje: true })
    expect(marcacao).toMatch(/text-warning[^>]*>Ausente</)
    expect(marcacao).toContain('>Visitado<')
    expect(marcacao).toContain('>Desmarcar<')
    expect(marcacao).not.toContain('opacity-60')
  })

  it('atrasado mostra desde quando; pendente de sincronização mostra a pill Pendente', () => {
    const marcacao = html(
      { ...cliente, pendente: true },
      { ...pendente, atrasado: true, agendadoPara: '2026-10-05' },
    )
    expect(marcacao).toContain('Atrasado desde 05/10/2026')
    expect(marcacao).toMatch(/text-brand-700[^>]*>Pendente</)
  })

  it('fora da rota de hoje não há marcas, só alça e carnê', () => {
    const marcacao = html(cliente)
    expect(marcacao).not.toContain('>Visitado<')
    expect(marcacao).not.toContain('>Ausente<')
    expect(marcacao).not.toContain('>Desmarcar<')
    expect(marcacao).toContain('>Carnê<')
  })
})
