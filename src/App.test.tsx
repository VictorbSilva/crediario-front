// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Acesso, Permissoes } from '@/lib/acesso'
import App from './App'

const simulado = vi.hoisted(() => ({ acesso: null as Acesso | null }))

vi.mock('@/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/auth/RequireAuth', () => ({ RequireAuth: () => <Outlet /> }))
vi.mock('@/components/layout/AppShell', () => ({ AppShell: () => <Outlet /> }))
vi.mock('@/data/useAcesso', () => ({ useAcesso: () => simulado.acesso }))
vi.mock('@/components/pwa/PwaPrompt', () => ({ PwaPrompt: () => <p>aviso do pwa</p> }))
vi.mock('@/pages/LoginPage', () => ({ LoginPage: () => <p>página de login</p> }))
vi.mock('@/pages/ClientesPage', () => ({ ClientesPage: () => <p>página de clientes</p> }))
vi.mock('@/pages/ClientePage', () => ({ ClientePage: () => <p>página de um cliente</p> }))
vi.mock('@/pages/RotasPage', () => ({ RotasPage: () => <p>página de rotas</p> }))
vi.mock('@/pages/FinanceiroPage', () => ({ FinanceiroPage: () => <p>página do financeiro</p> }))
vi.mock('@/pages/EquipePage', () => ({ EquipePage: () => <p>página da equipe</p> }))

function abrir(caminho: string) {
  window.history.replaceState(null, '', caminho)
  render(<App />)
}

beforeEach(() => {
  vi.stubEnv('VITE_BUSINESS_ID', 'loja-treino')
  vi.stubEnv('VITE_USE_FIREBASE_EMULATORS', '')
  simulado.acesso = {
    estado: 'liberado', dono: true, permissoes: { financeiro: true, caixaDoDia: true, exportar: true, cancelar: true },
  }
})

function membro(permissoes: Partial<Permissoes>): Acesso {
  return {
    estado: 'liberado', dono: false,
    permissoes: { financeiro: false, caixaDoDia: false, exportar: false, cancelar: false, ...permissoes },
  }
}

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
    ['/equipe', 'página da equipe'],
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

describe('App — guarda do financeiro', () => {
  it.each([
    ['só financeiro', { financeiro: true }],
    ['só caixa do dia', { caixaDoDia: true }],
  ])('membro com %s abre /financeiro', (_rotulo, permissoes) => {
    simulado.acesso = membro(permissoes)
    abrir('/financeiro')

    expect(screen.getByText('página do financeiro')).toBeTruthy()
  })

  it('membro sem financeiro nem caixa do dia que digita /financeiro cai na lista de clientes', () => {
    simulado.acesso = membro({ exportar: true })
    abrir('/financeiro')

    expect(screen.queryByText('página do financeiro')).toBeNull()
    expect(screen.getByText('página de clientes')).toBeTruthy()
    expect(window.location.pathname).toBe('/clientes')
  })
})

describe('App — guarda da equipe', () => {
  it('membro que digita /equipe cai na lista de clientes, mesmo com todas as permissões', () => {
    simulado.acesso = membro({ financeiro: true, caixaDoDia: true, exportar: true })
    abrir('/equipe')

    expect(screen.queryByText('página da equipe')).toBeNull()
    expect(screen.getByText('página de clientes')).toBeTruthy()
    expect(window.location.pathname).toBe('/clientes')
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
