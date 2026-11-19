// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validarNovoMembro } from '@/lib/equipe'
import { CampoDeSenha } from './CampoDeSenha'

const FORMATO_GERADO = /^[^-]{4}-[^-]{4}$/
const DICA = 'Mínimo de 6 caracteres. No fim, você vê a senha de novo para enviar a ele.'

function Controlado({ erro, aoMudar = vi.fn(), aoSair = vi.fn() }: {
  erro?: string
  aoMudar?: (valor: string) => void
  aoSair?: () => void
}) {
  const [valor, setValor] = useState('')
  return (
    <CampoDeSenha
      id="senha"
      valor={valor}
      erro={erro}
      aoMudar={(novo) => {
        setValor(novo)
        aoMudar(novo)
      }}
      aoSair={aoSair}
    />
  )
}

function senha(): HTMLInputElement {
  return screen.getByLabelText('Senha') as HTMLInputElement
}

function descricoes(): string[] {
  return (senha().getAttribute('aria-describedby') ?? '').split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
}

afterEach(() => {
  cleanup()
})

describe('CampoDeSenha', () => {
  it('nasce escondida, como senha nova, sem maiúscula nem correção, com a dica', () => {
    render(<Controlado />)

    expect(senha().type).toBe('password')
    expect(senha().getAttribute('autocomplete')).toBe('new-password')
    expect(senha().getAttribute('autocapitalize')).toBe('none')
    expect(senha().getAttribute('autocorrect')).toBe('off')
    expect(senha().getAttribute('spellcheck')).toBe('false')
    expect(senha().hasAttribute('aria-invalid')).toBe(false)
    expect(descricoes()).toEqual([DICA])
  })

  it('o olho mostra e esconde, sem deixar de ser senha nova', () => {
    render(<Controlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar a senha' }))
    expect(senha().type).toBe('text')
    expect(senha().getAttribute('autocomplete')).toBe('new-password')

    fireEvent.click(screen.getByRole('button', { name: 'Esconder a senha' }))
    expect(senha().type).toBe('password')
    expect(screen.getByRole('button', { name: 'Mostrar a senha' })).toBeTruthy()
  })

  it('Gerar preenche com uma senha gerada e já mostra', () => {
    const aoMudar = vi.fn()
    render(<Controlado aoMudar={aoMudar} />)

    const gerar = screen.getByRole('button', { name: 'Gerar' })
    expect(gerar.querySelector('svg')).not.toBeNull()
    expect(gerar.className).toContain('min-h-11')

    fireEvent.click(gerar)

    expect(senha().value).toMatch(FORMATO_GERADO)
    expect(aoMudar).toHaveBeenCalledExactlyOnceWith(senha().value)
    expect(senha().type).toBe('text')
    expect(screen.getByRole('button', { name: 'Esconder a senha' })).toBeTruthy()
    expect(validarNovoMembro({
      nome: 'Ana', email: 'ana@loja.com', senha: senha().value,
      permissoes: { financeiro: false, caixaDoDia: false, exportar: false },
    })).toEqual({})
  })

  it('Gerar de novo troca a senha', () => {
    render(<Controlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }))
    const primeira = senha().value
    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }))

    expect(senha().value).toMatch(FORMATO_GERADO)
    expect(senha().value).not.toBe(primeira)
  })

  it('digitar avisa a mudança e sair do campo avisa a saída', () => {
    const aoMudar = vi.fn()
    const aoSair = vi.fn()
    render(<Controlado aoMudar={aoMudar} aoSair={aoSair} />)

    fireEvent.change(senha(), { target: { value: 'segredo' } })
    fireEvent.blur(senha())

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith('segredo')
    expect(aoSair).toHaveBeenCalledTimes(1)
  })

  it('mostra o erro como o Campo: alerta, borda vermelha e descrito no campo', () => {
    render(<Controlado erro="Senha fraca: use 6 caracteres ou mais." />)

    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toBe('Senha fraca: use 6 caracteres ou mais.')
    expect(alerta.className).toContain('text-danger')
    expect(senha().getAttribute('aria-invalid')).toBe('true')
    expect(senha().className).toContain('border-danger')
    expect(descricoes()).toEqual(['Senha fraca: use 6 caracteres ou mais.', DICA])
  })
})
