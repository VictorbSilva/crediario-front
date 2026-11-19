// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mensagemDeAcesso } from '@/lib/equipe'
import { ContaCriada } from './ContaCriada'

const DADOS = { nome: 'Joana Souza', email: 'joana@loja.com', senha: 'k7Rm-q4Tz' }
const FALHA = 'Não deu para copiar. Selecione o texto e copie.'

let escrever: ReturnType<typeof vi.fn<(texto: string) => Promise<void>>>

function mensagem(): string {
  return mensagemDeAcesso({ ...DADOS, endereco: window.location.origin })
}

function montar() {
  render(<ContaCriada {...DADOS} />)
}

async function clicar(botao: HTMLElement) {
  await act(async () => {
    fireEvent.click(botao)
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  escrever = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: escrever } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('ContaCriada — conteúdo', () => {
  it('mostra o ícone de sucesso, o título com o primeiro nome e o aviso da senha', () => {
    montar()

    const titulo = screen.getByRole('heading', { name: 'A conta de Joana está pronta' })
    const circulo = titulo.parentElement?.querySelector('svg')?.parentElement as HTMLElement
    expect(circulo.className).toContain('bg-success-soft')
    expect(circulo.className).toContain('text-success')
    expect(circulo.className).toContain('rounded-full')
    expect(screen.getByText('Mande o acesso agora. Esta é a única vez que a senha aparece.')).toBeTruthy()
  })

  it('mostra o e-mail e a senha, cada um com o seu botão de copiar', () => {
    montar()

    expect(screen.getByText('joana@loja.com')).toBeTruthy()
    expect(screen.getByText('k7Rm-q4Tz')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copiar o e-mail' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copiar a senha' })).toBeTruthy()
  })

  it('a mensagem pronta usa o endereço deste app e respeita as quebras de linha', () => {
    montar()

    const grupo = screen.getByText('Mensagem pronta').parentElement as HTMLElement
    const caixa = within(grupo).getByText((_, elemento) => elemento?.textContent === mensagem())
    expect(caixa.className).toContain('whitespace-pre-line')
    expect(caixa.className).toContain('bg-slate-100')
    expect(caixa.textContent).toContain(`Endereço: ${window.location.origin}`)
  })

  it('o WhatsApp abre numa aba nova com a mensagem preenchida', () => {
    montar()

    const link = screen.getByRole('link', { name: 'Enviar pelo WhatsApp' })
    expect(link.getAttribute('href')).toBe('https://wa.me/?text=' + encodeURIComponent(mensagem()))
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener')
    expect(link.querySelector('svg')).not.toBeNull()
    expect(link.className).toContain('bg-brand-600')
  })

  it('dentro do formulário, nenhum botão envia: todos são type="button"', () => {
    montar()

    for (const botao of screen.getAllByRole('button')) {
      expect(botao.getAttribute('type')).toBe('button')
    }
  })
})

describe('ContaCriada — copiar', () => {
  it.each([
    ['Copiar o e-mail', () => DADOS.email],
    ['Copiar a senha', () => DADOS.senha],
    ['Copiar mensagem', mensagem],
  ])('%s copia o texto certo e mostra "Copiado" por 2 s', async (nome, esperado) => {
    montar()
    const botao = screen.getByRole('button', { name: nome })

    await clicar(botao)

    expect(escrever).toHaveBeenCalledExactlyOnceWith(esperado())
    expect(botao.textContent).toContain('Copiado')

    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(botao.textContent).toContain('Copiado')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(botao.textContent).not.toContain('Copiado')
  })

  it('só o botão tocado mostra "Copiado"', async () => {
    montar()

    await clicar(screen.getByRole('button', { name: 'Copiar a senha' }))

    expect(screen.getByRole('button', { name: 'Copiar a senha' }).textContent).toContain('Copiado')
    expect(screen.getByRole('button', { name: 'Copiar o e-mail' }).textContent).not.toContain('Copiado')
    expect(screen.getByRole('button', { name: 'Copiar mensagem' })).toBeTruthy()
  })

  it('se a cópia falhar, pede para selecionar e copiar à mão', async () => {
    escrever.mockRejectedValueOnce(new Error('negado'))
    montar()
    const botao = screen.getByRole('button', { name: 'Copiar a senha' })

    await clicar(botao)

    expect(screen.getByRole('alert').textContent).toBe(FALHA)
    expect(botao.textContent).not.toContain('Copiado')
  })

  it('sem a área de transferência no navegador, também pede para copiar à mão', async () => {
    Reflect.deleteProperty(navigator, 'clipboard')
    montar()

    await clicar(screen.getByRole('button', { name: 'Copiar mensagem' }))

    expect(screen.getByRole('alert').textContent).toBe(FALHA)
  })

  it('uma cópia que dá certo tira o aviso de falha', async () => {
    escrever.mockRejectedValueOnce(new Error('negado'))
    montar()

    await clicar(screen.getByRole('button', { name: 'Copiar a senha' }))
    expect(screen.getByRole('alert')).toBeTruthy()

    await clicar(screen.getByRole('button', { name: 'Copiar a senha' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Copiar a senha' }).textContent).toContain('Copiado')
  })
})
