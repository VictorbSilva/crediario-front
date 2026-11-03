// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RegisterSWOptions } from 'virtual:pwa-register/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INTERVALO_DE_CHECAGEM_MS } from '@/lib/atualizacao'
import { PwaPrompt } from './PwaPrompt'

const MINUTO = 60 * 1000

const simulado = vi.hoisted(() => ({
  offlineReady: false,
  needRefresh: false,
  setOfflineReady: vi.fn(),
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
  opcoes: undefined as RegisterSWOptions | undefined,
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (opcoes?: RegisterSWOptions) => {
    simulado.opcoes = opcoes
    return {
      offlineReady: [simulado.offlineReady, simulado.setOfflineReady],
      needRefresh: [simulado.needRefresh, simulado.setNeedRefresh],
      updateServiceWorker: simulado.updateServiceWorker,
    }
  },
}))

// `location.reload` não é configurável no jsdom, mas `window.location` é: o teste troca o
// objeto inteiro. Assim nenhum teste deste arquivo navega de verdade.
const localizacaoOriginal = Object.getOwnPropertyDescriptor(window, 'location')!
let recarregar: ReturnType<typeof vi.fn>
let buscar: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  simulado.offlineReady = false
  simulado.needRefresh = false
  simulado.opcoes = undefined
  simulado.setOfflineReady.mockClear()
  simulado.setNeedRefresh.mockClear()
  simulado.updateServiceWorker.mockReset().mockReturnValue(Promise.resolve())
  recarregar = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: recarregar },
  })
  buscar = vi.fn().mockResolvedValue({ status: 200 })
  vi.stubGlobal('fetch', buscar)
})

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'location', localizacaoOriginal)
  vi.unstubAllGlobals()
  vi.useRealTimers()
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
    vi.advanceTimersByTime(60 * MINUTO)
    expect(recarregar).not.toHaveBeenCalled()
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

describe('PwaPrompt — botão Atualizar', () => {
  it('ao tocar, fica desabilitado com "Atualizando…" e recarrega 5 s depois', () => {
    simulado.needRefresh = true
    render(<PwaPrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    const botao = screen.getByRole('button', { name: 'Atualizando…' }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Atualizar' })).toBeNull()
    expect(simulado.updateServiceWorker).toHaveBeenCalledTimes(1)

    fireEvent.click(botao)
    expect(simulado.updateServiceWorker).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4999)
    expect(recarregar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(recarregar).toHaveBeenCalledTimes(1)
  })

  it('recarrega 5 s depois mesmo quando a atualização falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    simulado.needRefresh = true
    simulado.updateServiceWorker.mockRejectedValue(new Error('sw'))
    render(<PwaPrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await vi.advanceTimersByTimeAsync(5000)

    expect(recarregar).toHaveBeenCalledTimes(1)
  })

  it('sem o toque, nada recarrega', () => {
    simulado.needRefresh = true
    render(<PwaPrompt />)

    vi.advanceTimersByTime(60 * MINUTO)

    expect(recarregar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeTruthy()
  })
})

describe('PwaPrompt — procura versão nova', () => {
  type RegistroFalso = {
    installing: ServiceWorker | null
    update: ReturnType<typeof vi.fn>
  }

  const ouvintes: Array<() => void> = []

  // Os gatilhos ficam ligados enquanto a página vive, e o jsdom é o mesmo para o
  // arquivo inteiro: sem tirar os ouvintes, um teste dispararia as checagens do outro.
  beforeEach(() => {
    for (const alvo of [document, window] as EventTarget[]) {
      const adicionar = alvo.addEventListener.bind(alvo)
      vi.spyOn(alvo, 'addEventListener').mockImplementation((tipo, ouvinte, opcoes) => {
        ouvintes.push(() => alvo.removeEventListener(tipo, ouvinte, opcoes))
        adicionar(tipo, ouvinte, opcoes)
      })
    }
  })

  afterEach(() => {
    for (const tirar of ouvintes.splice(0)) tirar()
  })

  function registroFalso({ instalando = false } = {}): RegistroFalso {
    return {
      installing: instalando ? ({} as ServiceWorker) : null,
      update: vi.fn(() => Promise.resolve()),
    }
  }

  // A guarda "liga uma vez só" vive no módulo: cada teste precisa de uma cópia nova.
  async function montar() {
    vi.resetModules()
    const modulo = await import('./PwaPrompt')
    render(<modulo.PwaPrompt />)
  }

  function registrar(registro: RegistroFalso | undefined) {
    simulado.opcoes?.onRegisteredSW?.(
      '/sw.js',
      registro as unknown as ServiceWorkerRegistration | undefined,
    )
  }

  function voltarParaATela(estado: DocumentVisibilityState = 'visible') {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(estado)
    document.dispatchEvent(new Event('visibilitychange'))
  }

  async function escoar() {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }

  it('ao voltar para a tela, busca o sw.js sem cache e atualiza o registro', async () => {
    const registro = registroFalso()
    await montar()
    registrar(registro)

    voltarParaATela()
    await escoar()

    expect(buscar).toHaveBeenCalledTimes(1)
    expect(buscar).toHaveBeenCalledWith('/sw.js', {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    })
    expect(registro.update).toHaveBeenCalledTimes(1)
    expect(recarregar).not.toHaveBeenCalled()
    expect(simulado.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('a tela sumindo não checa', async () => {
    const registro = registroFalso()
    await montar()
    registrar(registro)

    voltarParaATela('hidden')
    await escoar()

    expect(buscar).not.toHaveBeenCalled()
    expect(registro.update).not.toHaveBeenCalled()
  })

  it('voltar de novo 1 min depois não checa outra vez; 5 min depois da primeira, checa', async () => {
    const registro = registroFalso()
    await montar()
    registrar(registro)

    voltarParaATela()
    await escoar()
    expect(registro.update).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(MINUTO)
    voltarParaATela()
    await escoar()
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(registro.update).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4 * MINUTO)
    voltarParaATela()
    await escoar()
    expect(buscar).toHaveBeenCalledTimes(2)
    expect(registro.update).toHaveBeenCalledTimes(2)
  })

  it('sem internet não checa, e a tentativa não conta como checagem', async () => {
    const registro = registroFalso()
    await montar()
    registrar(registro)
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    voltarParaATela()
    await escoar()
    expect(buscar).not.toHaveBeenCalled()
    expect(registro.update).not.toHaveBeenCalled()

    online.mockReturnValue(true)
    voltarParaATela()
    await escoar()
    expect(registro.update).toHaveBeenCalledTimes(1)
  })

  it('com um worker novo já instalando, não checa', async () => {
    const registro = registroFalso({ instalando: true })
    await montar()
    registrar(registro)

    voltarParaATela()
    await escoar()

    expect(buscar).not.toHaveBeenCalled()
    expect(registro.update).not.toHaveBeenCalled()
  })

  it('quando a internet volta, checa', async () => {
    const registro = registroFalso()
    await montar()
    registrar(registro)

    window.dispatchEvent(new Event('online'))
    await escoar()

    expect(buscar).toHaveBeenCalledWith('/sw.js', expect.anything())
    expect(registro.update).toHaveBeenCalledTimes(1)
  })

  it('de hora em hora, checa sozinho, e nunca recarrega sem o toque', async () => {
    const registro = registroFalso()
    await montar()
    registrar(registro)

    await vi.advanceTimersByTimeAsync(INTERVALO_DE_CHECAGEM_MS - 1)
    expect(buscar).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await escoar()
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(registro.update).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(INTERVALO_DE_CHECAGEM_MS)
    await escoar()
    expect(registro.update).toHaveBeenCalledTimes(2)
    expect(recarregar).not.toHaveBeenCalled()
    expect(simulado.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('registrado duas vezes (modo estrito), liga os gatilhos uma vez só', async () => {
    const registro = registroFalso()
    await montar()
    registrar(registro)
    registrar(registro)

    voltarParaATela()
    await escoar()
    expect(buscar).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(INTERVALO_DE_CHECAGEM_MS)
    await escoar()
    expect(buscar).toHaveBeenCalledTimes(2)
    expect(registro.update).toHaveBeenCalledTimes(2)
  })

  it('sem registro, não liga nada; o registro que chega depois liga', async () => {
    const registro = registroFalso()
    await montar()
    registrar(undefined)

    voltarParaATela()
    await vi.advanceTimersByTimeAsync(INTERVALO_DE_CHECAGEM_MS)
    expect(buscar).not.toHaveBeenCalled()

    registrar(registro)
    voltarParaATela()
    await escoar()
    expect(registro.update).toHaveBeenCalledTimes(1)
  })

  it('sw.js que não volta com 200 não atualiza', async () => {
    buscar.mockResolvedValue({ status: 404 })
    const registro = registroFalso()
    await montar()
    registrar(registro)

    voltarParaATela()
    await escoar()

    expect(buscar).toHaveBeenCalledTimes(1)
    expect(registro.update).not.toHaveBeenCalled()
  })

  describe('offline não é falha', () => {
    // O `tsconfig.app.json` não carrega os tipos do Node (o app roda no navegador);
    // o teste só precisa destes dois métodos do `process`, que existe no Vitest.
    type ProcessoDoNode = {
      on(evento: 'unhandledRejection', ouvinte: (motivo: unknown) => void): void
      off(evento: 'unhandledRejection', ouvinte: (motivo: unknown) => void): void
    }
    const processo = (globalThis as unknown as { process: ProcessoDoNode }).process
    const rejeicoesSoltas = vi.fn()

    beforeEach(() => {
      rejeicoesSoltas.mockClear()
      processo.on('unhandledRejection', rejeicoesSoltas)
    })

    afterEach(() => {
      processo.off('unhandledRejection', rejeicoesSoltas)
    })

    // O Node só avisa da rejeição solta depois de esvaziar a fila de microtarefas:
    // é preciso deixar passar uma volta do relógio de verdade.
    async function esperarAvisoDoNode() {
      vi.useRealTimers()
      await new Promise((resolver) => setTimeout(resolver, 20))
    }

    it('a busca do sw.js falhando sem rede não vira rejeição solta nem erro no console', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      buscar.mockRejectedValue(new TypeError('Failed to fetch'))
      const registro = registroFalso()
      await montar()
      registrar(registro)

      voltarParaATela()
      await escoar()
      await esperarAvisoDoNode()

      expect(buscar).toHaveBeenCalledTimes(1)
      expect(registro.update).not.toHaveBeenCalled()
      expect(rejeicoesSoltas).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
    })

    it('o update falhando também não vira rejeição solta', async () => {
      const registro = registroFalso()
      registro.update.mockRejectedValue(new TypeError('Failed to update a ServiceWorker'))
      await montar()
      registrar(registro)

      voltarParaATela()
      await escoar()
      await esperarAvisoDoNode()

      expect(registro.update).toHaveBeenCalledTimes(1)
      expect(rejeicoesSoltas).not.toHaveBeenCalled()
    })
  })
})
