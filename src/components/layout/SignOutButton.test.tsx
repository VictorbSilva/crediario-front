// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instalarDialogo } from '@/test/dialogo'
import { SignOutButton } from './SignOutButton'

const simulado = vi.hoisted(() => ({ sair: vi.fn(() => Promise.resolve()) }))

vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ sair: simulado.sair }) }))

function dialogo(): HTMLDialogElement {
  const elemento = document.querySelector('dialog')
  if (!elemento) throw new Error('Sem diálogo')
  return elemento
}

function online(valor: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(valor)
}

beforeEach(() => {
  instalarDialogo()
  simulado.sair.mockReset().mockReturnValue(Promise.resolve())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SignOutButton', () => {
  it('sair pede confirmação antes, porque entrar de novo exige internet', () => {
    online(true)
    render(<SignOutButton />)

    expect(dialogo().open).toBe(false)
    fireEvent.click(screen.getByTitle('Sair'))

    expect(dialogo().open).toBe(true)
    expect(screen.getByText('Sair da conta?')).toBeTruthy()
    expect(screen.queryByText(/Você está sem internet agora/)).toBeNull()
    expect(simulado.sair).not.toHaveBeenCalled()
  })

  it('sem internet, avisa que não vai conseguir entrar de novo', () => {
    online(false)
    render(<SignOutButton />)

    fireEvent.click(screen.getByTitle('Sair'))

    expect(screen.getByText(/Você está sem internet agora/)).toBeTruthy()
  })

  it('o diálogo é anunciado pelo título e pela descrição', () => {
    online(true)
    render(<SignOutButton />)
    fireEvent.click(screen.getByTitle('Sair'))

    expect(screen.getByRole('dialog', { name: 'Sair da conta?' })).toBe(dialogo())
    expect(document.getElementById(dialogo().getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Para entrar de novo é preciso internet.',
    )
  })

  it('fechar e pedir de novo reabre o diálogo', () => {
    online(true)
    render(<SignOutButton />)

    fireEvent.click(screen.getByTitle('Sair'))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar conectado' }))
    expect(dialogo().open).toBe(false)

    fireEvent.click(screen.getByTitle('Sair'))
    expect(dialogo().open).toBe(true)
  })

  it('continuar conectado fecha sem sair e limpa o aviso de offline', () => {
    online(false)
    render(<SignOutButton />)
    fireEvent.click(screen.getByTitle('Sair'))

    fireEvent.click(screen.getByRole('button', { name: 'Continuar conectado' }))

    expect(dialogo().open).toBe(false)
    expect(screen.queryByText(/Você está sem internet agora/)).toBeNull()
    expect(simulado.sair).not.toHaveBeenCalled()
  })

  it('confirmar sai e fecha o diálogo', () => {
    online(true)
    render(<SignOutButton />)
    fireEvent.click(screen.getByTitle('Sair'))

    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Sair' }))

    expect(simulado.sair).toHaveBeenCalledTimes(1)
    expect(dialogo().open).toBe(false)
  })

  it('falha ao sair vai para o console', async () => {
    online(true)
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const falha = new Error('rede')
    simulado.sair.mockRejectedValue(falha)
    render(<SignOutButton />)
    fireEvent.click(screen.getByTitle('Sair'))

    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Sair' }))

    await vi.waitFor(() => expect(log).toHaveBeenCalledWith('[auth] Falha ao sair.', falha))
  })
})
