// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { AuthContextValue } from '@/auth/auth-context'
import { LoginPage } from './LoginPage'

type Auth = Omit<AuthContextValue, 'entrar' | 'recuperarSenha'> & {
  entrar: Mock<AuthContextValue['entrar']>
  recuperarSenha: Mock<AuthContextValue['recuperarSenha']>
}

const simulado = vi.hoisted(() => ({ auth: {} as Auth }))

vi.mock('@/auth/useAuth', () => ({ useAuth: () => simulado.auth }))

function Voltar({ texto }: { texto: string }) {
  const navegar = useNavigate()
  return <button type="button" onClick={() => navegar(-1)}>{texto}</button>
}

function montar(estado?: { de: string }) {
  return render(
    <MemoryRouter initialEntries={['/antes', { pathname: '/login', state: estado }]} initialIndex={1}>
      <Routes>
        <Route path="/antes" element={<p>página anterior</p>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/clientes" element={<><p>lista de clientes</p><Voltar texto="voltar" /></>} />
        <Route path="/rotas" element={<p>rota do dia</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function digitar(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })
}

function adiada() {
  let resolver: () => void = () => undefined
  let rejeitar: (erro: unknown) => void = () => undefined
  const promessa = new Promise<void>((res, rej) => {
    resolver = res
    rejeitar = rej
  })
  return { promessa, resolver, rejeitar }
}

beforeEach(() => {
  simulado.auth = {
    usuario: null,
    businessId: null,
    carregando: false,
    entrar: vi.fn(() => Promise.resolve()),
    recuperarSenha: vi.fn(() => Promise.resolve()),
    sair: vi.fn(() => Promise.resolve()),
  }
})

afterEach(() => {
  cleanup()
})

describe('LoginPage', () => {
  it('não desenha nada enquanto a sessão não foi resolvida', () => {
    simulado.auth.carregando = true
    const { container } = montar()

    expect(container.innerHTML).toBe('')
  })

  it('quem já entrou vai direto para onde queria ir', () => {
    simulado.auth.usuario = { uid: 'u1' } as AuthContextValue['usuario']
    montar({ de: '/rotas' })

    expect(screen.getByText('rota do dia')).toBeTruthy()
  })

  it('entra com o e-mail aparado e vai para a lista de clientes', async () => {
    const pedido = adiada()
    simulado.auth.entrar.mockReturnValue(pedido.promessa)
    montar()

    digitar('E-mail', '  dono@loja.com ')
    digitar('Senha', 'segredo')
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }))

    expect(simulado.auth.entrar).toHaveBeenCalledWith('dono@loja.com', 'segredo')
    const botao = screen.getByRole('button', { name: 'Entrando…' }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)

    await act(async () => pedido.resolver())
    expect(screen.getByText('lista de clientes')).toBeTruthy()

    // O login sai do histórico: voltar não cai de novo na tela de entrar.
    fireEvent.click(screen.getByRole('button', { name: 'voltar' }))
    expect(screen.getByText('página anterior')).toBeTruthy()
  })

  it('o formulário nasce vazio', () => {
    montar()

    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Senha') as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('volta para a rota de origem depois de entrar', async () => {
    montar({ de: '/rotas' })

    digitar('E-mail', 'dono@loja.com')
    digitar('Senha', 'segredo')
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }))
    })

    expect(screen.getByText('rota do dia')).toBeTruthy()
  })

  it('mostra a mensagem traduzida quando o login falha, e libera o botão', async () => {
    simulado.auth.entrar.mockRejectedValue(new Error('E-mail ou senha incorretos.'))
    montar()

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }))
    })

    expect(screen.getByRole('alert').textContent).toBe('E-mail ou senha incorretos.')
    expect((screen.getByRole('button', { name: 'Entrar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('falha que não é Error ainda vira mensagem', async () => {
    simulado.auth.entrar.mockRejectedValue('???')
    montar()

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }))
    })

    expect(screen.getByRole('alert').textContent).toBe('Não foi possível entrar.')
  })

  it('recuperar senha sem e-mail pede o e-mail antes', async () => {
    montar()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    })

    expect(screen.getByRole('alert').textContent).toBe('Digite o e-mail primeiro e clique de novo.')
    expect(simulado.auth.recuperarSenha).not.toHaveBeenCalled()
  })

  it('recuperar senha avisa sem dizer se a conta existe', async () => {
    const pedido = adiada()
    simulado.auth.recuperarSenha.mockReturnValue(pedido.promessa)
    montar()
    digitar('E-mail', ' dono@loja.com ')

    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeTruthy()

    await act(async () => pedido.resolver())
    expect(simulado.auth.recuperarSenha).toHaveBeenCalledWith('dono@loja.com')
    expect(screen.getByRole('status').textContent).toMatch(/^Se existir uma conta com esse e-mail/)
  })

  it('recuperar senha mostra o erro, e um novo envio apaga o aviso anterior', async () => {
    simulado.auth.recuperarSenha.mockReturnValueOnce(Promise.resolve())
    simulado.auth.recuperarSenha.mockRejectedValueOnce(new Error('Sem conexão.'))
    simulado.auth.recuperarSenha.mockRejectedValueOnce(42)
    montar()
    digitar('E-mail', 'dono@loja.com')

    const recuperar = () =>
      act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
      })

    await recuperar()
    expect(screen.queryByRole('status')).toBeTruthy()

    await recuperar()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('alert').textContent).toBe('Sem conexão.')

    await recuperar()
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível enviar o link.')
  })
})
