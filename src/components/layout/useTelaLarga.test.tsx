// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

// O módulo guarda a MediaQueryList na primeira leitura; cada teste carrega uma cópia nova.
async function carregar() {
  vi.resetModules()
  return (await import('./useTelaLarga')).useTelaLarga
}

// Guarda os ouvintes por tipo de evento: só quem ouve `change` fica sabendo da mudança.
function consultaSimulada(larga: boolean) {
  const ouvintes = new Map<string, Set<() => void>>()
  const doTipo = (tipo: string) => ouvintes.get(tipo) ?? ouvintes.set(tipo, new Set()).get(tipo)!
  const consulta = {
    matches: larga,
    addEventListener: vi.fn((tipo: string, ouvinte: () => void) => doTipo(tipo).add(ouvinte)),
    removeEventListener: vi.fn((tipo: string, ouvinte: () => void) => doTipo(tipo).delete(ouvinte)),
    mudar(valor: boolean) {
      consulta.matches = valor
      for (const ouvinte of doTipo('change')) ouvinte()
    },
    ouvindo: () => doTipo('change').size,
  }
  return consulta
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useTelaLarga', () => {
  it('sem matchMedia (navegador antigo, teste), trata como tela estreita', async () => {
    vi.stubGlobal('matchMedia', undefined)
    const useTelaLarga = await carregar()

    const { result } = renderHook(() => useTelaLarga())

    expect(result.current).toBe(false)
  })

  it('pergunta pelo mesmo 1024px do lg: e acompanha a mudança de largura', async () => {
    const consulta = consultaSimulada(true)
    const matchMedia = vi.fn(() => consulta)
    vi.stubGlobal('matchMedia', matchMedia)
    const useTelaLarga = await carregar()

    const { result, unmount } = renderHook(() => useTelaLarga())
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 1024px)')
    expect(result.current).toBe(true)

    act(() => consulta.mudar(false))
    expect(result.current).toBe(false)

    unmount()
    expect(consulta.ouvindo()).toBe(0)
  })

  it('no render de servidor responde tela estreita, sem tocar no window', async () => {
    const matchMedia = vi.fn(() => consultaSimulada(true))
    vi.stubGlobal('matchMedia', matchMedia)
    const useTelaLarga = await carregar()

    function Sonda() {
      return <span>{String(useTelaLarga())}</span>
    }

    expect(renderToStaticMarkup(<Sonda />)).toBe('<span>false</span>')
    expect(matchMedia).not.toHaveBeenCalled()
  })
})
