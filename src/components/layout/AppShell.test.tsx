// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EstadoSync } from '@/lib/sync'
import { instalarDialogo } from '@/test/dialogo'
import { AppShell } from './AppShell'
import { SyncBadge } from './SyncBadge'

const simulado = vi.hoisted(() => ({ estadoSync: 'sincronizado' as EstadoSync }))

vi.mock('@/data/ClientesProvider', () => ({
  ClientesProvider: ({ children }: { children: ReactNode }) => <div data-testid="provider">{children}</div>,
}))
vi.mock('@/data/useClientes', () => ({ useClientes: () => ({ estadoSync: simulado.estadoSync }) }))
vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ sair: vi.fn(() => Promise.resolve()) }) }))

function montar(caminho: string) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/rotas" element={<p>conteúdo da rota</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  instalarDialogo()
  simulado.estadoSync = 'sincronizado'
})

afterEach(() => {
  cleanup()
})

describe('AppShell', () => {
  it('a lista e o selo ficam dentro do provider de clientes, com a página no meio', () => {
    montar('/rotas')

    const provider = screen.getByTestId('provider')
    expect(within(provider).getByText('conteúdo da rota')).toBeTruthy()
    expect(within(provider).getByRole('main')).toBeTruthy()
  })

  it('as duas navegações saem da mesma lista e marcam a página aberta', () => {
    montar('/rotas')

    const [lateral, inferior] = screen.getAllByRole('navigation')
    for (const nav of [lateral, inferior]) {
      const links = within(nav).getAllByRole('link')
      expect(links.map((l) => l.textContent)).toEqual(['Clientes', 'Rotas', 'Financeiro'])
      expect(links.map((l) => l.getAttribute('href'))).toEqual(['/clientes', '/rotas', '/financeiro'])
    }
    expect(within(lateral).getByRole('link', { name: 'Rotas' }).className).toContain('bg-brand-50')
    expect(within(lateral).getByRole('link', { name: 'Clientes' }).className).not.toContain('bg-brand-50')
    expect(within(inferior).getByRole('link', { name: 'Rotas' }).className).toContain('text-brand-600')
    expect(within(inferior).getByRole('link', { name: 'Clientes' }).className).toContain('text-slate-500')
  })

  it('a marca aparece no topo e na lateral, com nome para o leitor de tela', () => {
    montar('/rotas')

    expect(screen.getAllByRole('img', { name: 'Crediário' })).toHaveLength(2)
  })

  it('o selo de sincronização aparece no topo e na lateral com o estado dos clientes', () => {
    simulado.estadoSync = 'offline'
    montar('/rotas')

    expect(screen.getAllByText('Offline: salvo no aparelho')).toHaveLength(2)
  })
})

describe('SyncBadge', () => {
  it.each<[EstadoSync, string, boolean]>([
    ['sincronizado', 'Sincronizado', false],
    ['sincronizando', 'Sincronizando…', true],
    ['pendente', 'Alterações pendentes', true],
    ['offline', 'Offline: salvo no aparelho', false],
    ['erro', 'Erro de sincronização', false],
    ['nao-configurado', 'Sync não configurado', false],
  ])('%s diz "%s"', (estado, rotulo, pulsa) => {
    const { container } = render(<SyncBadge estado={estado} />)

    expect(container.textContent).toBe(rotulo)
    expect(container.querySelector('.animate-pulse') !== null).toBe(pulsa)
  })
})
