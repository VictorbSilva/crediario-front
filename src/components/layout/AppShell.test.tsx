// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Acesso } from '@/lib/acesso'
import type { EstadoSync } from '@/lib/sync'
import { instalarDialogo } from '@/test/dialogo'
import { AppShell } from './AppShell'
import { SyncBadge } from './SyncBadge'

const LIBERADO: Acesso = {
  estado: 'liberado',
  dono: true,
  permissoes: { financeiro: true, caixaDoDia: true, exportar: true },
}

const simulado = vi.hoisted(() => ({
  estadoSync: 'sincronizado' as EstadoSync,
  acesso: null as Acesso | null,
}))

vi.mock('@/data/AcessoProvider', () => ({
  AcessoProvider: ({ children }: { children: ReactNode }) => <div data-testid="acesso">{children}</div>,
}))
vi.mock('@/data/useAcesso', () => ({ useAcesso: () => simulado.acesso }))
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
  simulado.acesso = LIBERADO
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

  it('o provider de clientes fica dentro do provider de acesso', () => {
    montar('/rotas')

    expect(within(screen.getByTestId('acesso')).getByTestId('provider')).toBeTruthy()
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

  it('membro sem financeiro nem caixa do dia não vê Financeiro em nenhuma das duas navegações', () => {
    simulado.acesso = {
      estado: 'liberado', dono: false, permissoes: { financeiro: false, caixaDoDia: false, exportar: true },
    }
    montar('/rotas')

    for (const nav of screen.getAllByRole('navigation')) {
      expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Clientes', 'Rotas'])
    }
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

describe('AppShell — acesso', () => {
  it('carregando mostra só o aviso, sem montar clientes nem a página', () => {
    simulado.acesso = { estado: 'carregando' }
    montar('/rotas')

    expect(screen.getByRole('status').textContent).toBe('Carregando…')
    expect(screen.queryByTestId('provider')).toBeNull()
    expect(screen.queryByText('conteúdo da rota')).toBeNull()
    expect(screen.queryAllByRole('navigation')).toHaveLength(0)
  })

  it.each<[Extract<Acesso, { estado: 'sem-acesso' }>['motivo'], string]>([
    ['desativado', 'Seu acesso foi desativado. Fale com o responsável pela loja.'],
    ['sem-cadastro', 'Esta conta não tem acesso a esta loja.'],
    ['erro', 'Esta conta não tem acesso a esta loja.'],
  ])('sem acesso (%s) mostra a mensagem e o botão de sair, sem montar clientes', (motivo, mensagem) => {
    simulado.acesso = { estado: 'sem-acesso', motivo }
    montar('/rotas')

    expect(screen.getByText(mensagem)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy()
    expect(screen.queryByTestId('provider')).toBeNull()
    expect(screen.queryByText('conteúdo da rota')).toBeNull()
    expect(screen.queryAllByRole('navigation')).toHaveLength(0)
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
