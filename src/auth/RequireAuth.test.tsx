// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from './auth-context'
import { RequireAuth } from './RequireAuth'

const simulado = vi.hoisted(() => ({ auth: {} as Partial<AuthContextValue> }))

vi.mock('./useAuth', () => ({ useAuth: () => simulado.auth }))

function TelaDeLogin() {
  const local = useLocation()
  return <p>login, vindo de {(local.state as { de: string }).de}</p>
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/clientes/ana']}>
      <Routes>
        <Route path="/login" element={<TelaDeLogin />} />
        <Route element={<RequireAuth />}>
          <Route path="/clientes/:id" element={<p>ficha da cliente</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  simulado.auth = {
    usuario: { uid: 'u1' } as AuthContextValue['usuario'],
    businessId: 'loja-treino',
    carregando: false,
    sair: vi.fn(() => Promise.resolve()),
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RequireAuth', () => {
  it('enquanto o SDK não resolve a sessão, espera em vez de mandar para o login', () => {
    simulado.auth.carregando = true
    montar()

    expect(screen.getByRole('status').textContent).toBe('Carregando…')
  })

  it('sem sessão, manda para o login lembrando para onde a pessoa queria ir', () => {
    simulado.auth.usuario = null
    montar()

    expect(screen.getByText('login, vindo de /clientes/ana')).toBeTruthy()
  })

  it('com sessão e empresa, mostra a rota pedida', () => {
    montar()

    expect(screen.getByText('ficha da cliente')).toBeTruthy()
  })

  it('conta sem empresa explica o caso e oferece sair', () => {
    simulado.auth.businessId = null
    montar()

    expect(screen.getByRole('heading').textContent).toBe('Conta sem empresa vinculada')
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(simulado.auth.sair).toHaveBeenCalledTimes(1)
  })

  it('falha ao sair vai para o console, não vira rejeição solta', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const falha = new Error('rede')
    simulado.auth.businessId = null
    simulado.auth.sair = vi.fn(() => Promise.reject(falha))
    montar()

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith('[auth] Falha ao sair.', falha))
  })
})
