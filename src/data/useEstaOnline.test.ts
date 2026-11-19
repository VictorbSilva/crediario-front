// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEstaOnline } from './useEstaOnline'

let conectado = true

beforeEach(() => {
  conectado = true
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => conectado })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'onLine')
})

function mudarPara(online: boolean) {
  act(() => {
    conectado = online
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  })
}

describe('useEstaOnline', () => {
  it('começa com o navigator.onLine de agora', () => {
    conectado = false

    expect(renderHook(() => useEstaOnline()).result.current).toBe(false)
  })

  it('acompanha os eventos offline e online da janela', () => {
    const { result } = renderHook(() => useEstaOnline())
    expect(result.current).toBe(true)

    mudarPara(false)
    expect(result.current).toBe(false)

    mudarPara(true)
    expect(result.current).toBe(true)
  })

  it('para de escutar ao desmontar', () => {
    const remover = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useEstaOnline())

    unmount()

    const eventos = remover.mock.calls.map(([evento]) => evento)
    expect(eventos).toContain('online')
    expect(eventos).toContain('offline')
  })
})
