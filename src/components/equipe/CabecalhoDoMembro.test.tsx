// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Membro } from '@/lib/equipe'
import { CabecalhoDoMembro } from './CabecalhoDoMembro'

function membro(extras: Partial<Membro> = {}): Membro {
  return {
    uid: 'ana', nome: 'Ana Lima', email: 'ana.lima@loja.com', ativo: true,
    permissoes: { financeiro: false, caixaDoDia: false, exportar: false }, pendente: false, ...extras,
  }
}

function avatar(container: HTMLElement): HTMLElement {
  return container.querySelector('[aria-hidden="true"]') as HTMLElement
}

afterEach(() => {
  cleanup()
})

describe('CabecalhoDoMembro', () => {
  it('ativo: avatar de 48 px destacado com as iniciais, nome, Ativo e e-mail com reticências', () => {
    const { container } = render(<CabecalhoDoMembro membro={membro()} />)

    const iniciais = avatar(container)
    expect(iniciais.textContent).toBe('AL')
    expect(iniciais.className).toContain('h-12')
    expect(iniciais.className).toContain('w-12')
    expect(iniciais.className).toContain('bg-brand-50')

    const nome = screen.getByText('Ana Lima')
    expect(nome.className).toContain('text-base')
    expect(nome.className).toContain('font-semibold')

    const situacao = screen.getByText('Ativo')
    expect(situacao.className).toContain('text-success')
    expect(screen.queryByText('Pendente')).toBeNull()

    const email = screen.getByText('ana.lima@loja.com')
    expect(email.className).toContain('text-[13px]')
    expect(email.className).toContain('text-slate-500')
    expect(email.className).toContain('truncate')
  })

  it('desativado: avatar sem destaque e "Desativado" em tom neutro', () => {
    const { container } = render(<CabecalhoDoMembro membro={membro({ ativo: false })} />)

    expect(avatar(container).className).not.toContain('bg-brand-50')
    expect(screen.getByText('Desativado').className).toContain('bg-slate-100')
    expect(screen.queryByText('Ativo')).toBeNull()
  })

  it('com gravação pendente, mostra "Pendente" no tom da marca', () => {
    render(<CabecalhoDoMembro membro={membro({ pendente: true })} />)

    expect(screen.getByText('Pendente').className).toContain('text-brand-700')
  })
})
