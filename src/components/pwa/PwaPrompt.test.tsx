// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaPrompt } from './PwaPrompt'

const simulado = vi.hoisted(() => ({
  offlineReady: false,
  needRefresh: false,
  setOfflineReady: vi.fn(),
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [simulado.offlineReady, simulado.setOfflineReady],
    needRefresh: [simulado.needRefresh, simulado.setNeedRefresh],
    updateServiceWorker: simulado.updateServiceWorker,
  }),
}))

beforeEach(() => {
  simulado.offlineReady = false
  simulado.needRefresh = false
  simulado.setOfflineReady.mockClear()
  simulado.setNeedRefresh.mockClear()
  simulado.updateServiceWorker.mockReset().mockReturnValue(Promise.resolve())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PwaPrompt', () => {
  it('sem nada a dizer, não ocupa a tela', () => {
    const { container } = render(<PwaPrompt />)

    expect(container.innerHTML).toBe('')
  })

  it('avisa quando o app já funciona sem internet, e OK fecha', () => {
    simulado.offlineReady = true
    render(<PwaPrompt />)

    expect(screen.getByRole('status').textContent).toContain('Pronto para uso sem internet.')
    expect(screen.queryByRole('button', { name: 'Atualizar' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(simulado.setOfflineReady).toHaveBeenCalledWith(false)
    expect(simulado.setNeedRefresh).toHaveBeenCalledWith(false)
  })

  it('versão nova só entra quando a pessoa confirma', () => {
    simulado.needRefresh = true
    render(<PwaPrompt />)

    expect(screen.getByText('Nova versão disponível.')).toBeTruthy()
    expect(simulado.updateServiceWorker).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(simulado.updateServiceWorker).toHaveBeenCalledTimes(1)
  })

  it('"Depois" adia a atualização sem aplicar', () => {
    simulado.needRefresh = true
    render(<PwaPrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))

    expect(simulado.setNeedRefresh).toHaveBeenCalledWith(false)
    expect(simulado.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('falha ao atualizar vai para o console, não vira rejeição solta', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const falha = new Error('sw')
    simulado.needRefresh = true
    simulado.updateServiceWorker.mockRejectedValue(falha)
    render(<PwaPrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith('[pwa] Falha ao aplicar a atualização.', falha),
    )
  })
})
