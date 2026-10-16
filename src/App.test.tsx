// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/auth/RequireAuth', () => ({ RequireAuth: () => <Outlet /> }))
vi.mock('@/components/layout/AppShell', () => ({ AppShell: () => <Outlet /> }))
vi.mock('@/components/pwa/PwaPrompt', () => ({ PwaPrompt: () => <p>aviso do pwa</p> }))
vi.mock('@/pages/LoginPage', () => ({ LoginPage: () => <p>página de login</p> }))
vi.mock('@/pages/ClientesPage', () => ({ ClientesPage: () => <p>página de clientes</p> }))
vi.mock('@/pages/ClientePage', () => ({ ClientePage: () => <p>página de um cliente</p> }))
vi.mock('@/pages/RotasPage', () => ({ RotasPage: () => <p>página de rotas</p> }))
vi.mock('@/pages/FinanceiroPage', () => ({ FinanceiroPage: () => <p>página do financeiro</p> }))

function abrir(caminho: string) {
  window.history.replaceState(null, '', caminho)
  render(<App />)
}

beforeEach(() => {
  vi.stubEnv('VITE_BUSINESS_ID', 'loja-treino')
  vi.stubEnv('VITE_USE_FIREBASE_EMULATORS', '')
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('App — rotas', () => {
  it.each([
    ['/login', 'página de login'],
    ['/clientes', 'página de clientes'],
    ['/clientes/ana', 'página de um cliente'],
    ['/rotas', 'página de rotas'],
    ['/financeiro', 'página do financeiro'],
  ])('%s abre a %s', (caminho, pagina) => {
    abrir(caminho)

    expect(screen.getByText(pagina)).toBeTruthy()
  })

  it.each(['/', '/caminho-que-nao-existe'])('%s cai na lista de clientes', (caminho) => {
    abrir(caminho)

    expect(screen.getByText('página de clientes')).toBeTruthy()
    expect(window.location.pathname).toBe('/clientes')
  })

  it('o aviso de versão nova fica fora da guarda, visível até na tela de login', () => {
    abrir('/login')

    expect(screen.getByText('aviso do pwa')).toBeTruthy()
  })
})

describe('FaixaDeTreino', () => {
  it('fora da produção, avisa que nada ali é real', () => {
    abrir('/clientes')

    expect(screen.getByText('Ambiente de treino — nada do que for lançado aqui é real.')).toBeTruthy()
  })

  it('na empresa de produção, some', () => {
    vi.stubEnv('VITE_BUSINESS_ID', 'loja-principal')
    abrir('/clientes')

    expect(screen.queryByText(/Ambiente de treino/)).toBeNull()
  })
})
