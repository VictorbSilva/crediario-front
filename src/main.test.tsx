// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O App de verdade inicializa o Firebase no import. Aqui ele vira um marcador,
// ou lança como o `firebase.ts` lança quando falta variável de ambiente.
// `doMock` dentro do teste, e não `vi.mock`, porque cada teste quer um App diferente.
async function iniciar(falha?: Error) {
  vi.resetModules()
  vi.doMock('./App', () => ({
    // Lançar na fábrica faria o Vitest embrulhar o erro; lançar na leitura do
    // `default` entrega ao `main` o erro original, como um import que falha.
    get default() {
      if (falha) throw falha
      return () => <p>app montado</p>
    },
  }))
  await import('./main')
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.doUnmock('./App')
  vi.restoreAllMocks()
})

describe('main', () => {
  it('monta o App no #root', async () => {
    await iniciar()

    await vi.waitFor(() => expect(document.body.textContent).toBe('app montado'))
  })

  it('se o App não carrega, mostra o motivo em vez de uma tela branca', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await iniciar(new Error('Variáveis do Firebase ausentes: VITE_FIREBASE_API_KEY'))

    await vi.waitFor(() =>
      expect(document.querySelector('h1')?.textContent).toBe('O app não conseguiu iniciar'),
    )
    expect(document.querySelector('pre')?.textContent).toContain(
      'Variáveis do Firebase ausentes: VITE_FIREBASE_API_KEY',
    )
    expect(console.error).toHaveBeenCalled()
  })

  it('sem #root no index.html, falha alto', async () => {
    document.body.innerHTML = ''

    await expect(iniciar()).rejects.toThrow('Elemento #root não encontrado no index.html.')
  })
})
