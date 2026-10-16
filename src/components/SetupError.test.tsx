import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SetupError } from './SetupError'

describe('SetupError', () => {
  it('mostra a mensagem do erro que impediu o app de iniciar', () => {
    const html = renderToStaticMarkup(<SetupError erro={new Error('Falta VITE_FIREBASE_APP_ID')} />)

    expect(html).toContain('Falta VITE_FIREBASE_APP_ID')
  })

  it('os passos de configuração ficam legíveis, com os espaços entre as palavras', () => {
    const html = renderToStaticMarkup(<SetupError erro={new Error('x')} />)

    expect(html).toContain('Crie um projeto no <span class="font-medium text-slate-900">console do Firebase</span>')
  })

  it('erro que não é Error ganha uma mensagem genérica', () => {
    const html = renderToStaticMarkup(<SetupError erro="???" />)

    expect(html).toContain('Erro desconhecido ao iniciar o app.')
  })
})
