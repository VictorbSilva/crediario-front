// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instalarDialogo } from '@/test/dialogo'
import { Avatar } from './Avatar'
import { Campo } from './Campo'
import { Kpi } from './Kpi'
import { ModalDeFormulario } from './ModalDeFormulario'
import { Nota } from './Nota'
import { SearchInput } from './SearchInput'
import { StatusPill } from './StatusPill'

beforeEach(() => {
  instalarDialogo()
})

afterEach(() => {
  cleanup()
})

describe('Avatar', () => {
  it('mostra as iniciais, escondidas do leitor de tela, com destaque opcional', () => {
    const { container, rerender } = render(<Avatar iniciais="AL" />)
    const marca = container.firstElementChild as HTMLElement

    expect(marca.textContent).toBe('AL')
    expect(marca.getAttribute('aria-hidden')).toBe('true')
    expect(marca.className).toContain('bg-slate-100')

    rerender(<Avatar iniciais="AL" destacado />)
    expect((container.firstElementChild as HTMLElement).className).toContain('bg-brand-50')
  })
})

describe('SearchInput', () => {
  it('tem rótulo acessível e devolve o texto digitado', () => {
    const aoMudar = vi.fn()
    render(<SearchInput id="busca" label="Buscar cliente" placeholder="Nome ou número" value="" onChange={aoMudar} />)

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'ana' } })

    expect(aoMudar).toHaveBeenCalledWith('ana')
  })
})

describe('Campo', () => {
  const props = { id: 'c', rotulo: 'Nome', valor: '', aoMudar: vi.fn(), aoSair: vi.fn() }

  it('campo opcional diz que é opcional; obrigatório não', () => {
    const { rerender } = render(<Campo {...props} />)
    expect(screen.getByText('opcional')).toBeTruthy()

    rerender(<Campo {...props} obrigatorio />)
    expect(screen.queryByText('opcional')).toBeNull()
  })

  it('liga dica e erro ao campo por aria-describedby, e marca o campo inválido', () => {
    render(<Campo {...props} dica="Como no documento" erro="Obrigatório" />)
    const campo = screen.getByLabelText(/^Nome/)

    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(campo.getAttribute('aria-describedby')).toBe('c-erro c-dica')
    expect(screen.getByRole('alert').textContent).toBe('Obrigatório')
    expect(campo.className).toContain('border-danger')
  })

  it('sem dica nem erro, não aponta para descrição nenhuma', () => {
    render(<Campo {...props} />)
    const campo = screen.getByLabelText(/^Nome/)

    expect(campo.getAttribute('aria-describedby')).toBeNull()
    expect(campo.getAttribute('aria-invalid')).toBeNull()
  })

  it('sem tipo nem teclado informados, é texto com teclado de texto', () => {
    render(<Campo {...props} />)
    const campo = screen.getByLabelText(/^Nome/) as HTMLInputElement

    expect(campo.getAttribute('type')).toBe('text')
    expect(campo.getAttribute('inputmode')).toBe('text')
  })

  it('campo de data não força teclado numérico', () => {
    render(<Campo {...props} tipo="date" inputMode="numeric" />)

    expect(screen.getByLabelText(/^Nome/).getAttribute('inputmode')).toBeNull()
  })

  it('texto longo vira textarea, que também avisa ao mudar e ao sair', () => {
    const aoMudar = vi.fn()
    const aoSair = vi.fn()
    render(<Campo {...props} multilinha erro="Muito longo" aoMudar={aoMudar} aoSair={aoSair} />)
    const area = screen.getByLabelText(/^Nome/)

    expect(area.tagName).toBe('TEXTAREA')
    expect(area.getAttribute('aria-invalid')).toBe('true')
    expect(area.getAttribute('aria-describedby')).toBe('c-erro')
    fireEvent.change(area, { target: { value: 'linha' } })
    fireEvent.blur(area)
    expect(aoMudar).toHaveBeenCalledWith('linha')
    expect(aoSair).toHaveBeenCalledTimes(1)
  })

  it('textarea sem dica nem erro não aponta para descrição', () => {
    render(<Campo {...props} multilinha />)

    expect(screen.getByLabelText(/^Nome/).getAttribute('aria-describedby')).toBeNull()
  })
})

describe('Nota, Kpi e StatusPill', () => {
  it('nota informativa e de alerta têm cores diferentes; o título é opcional', () => {
    const { container, rerender } = render(<Nota tom="info">texto</Nota>)
    expect((container.firstElementChild as HTMLElement).className).toContain('bg-brand-50')

    rerender(<Nota tom="alerta" titulo="Atenção">texto</Nota>)
    expect((container.firstElementChild as HTMLElement).className).toContain('bg-warning-soft')
    expect(screen.getByText('Atenção')).toBeTruthy()
  })

  it.each([
    ['perigo', 'text-danger'],
    ['sucesso', 'text-success'],
    ['alerta', 'text-warning'],
    ['marca', 'text-brand-600'],
  ] as const)('kpi em tom %s', (tom, classe) => {
    render(<Kpi rotulo="Saldo" valor="R$ 10,00" tom={tom} />)

    expect(screen.getByText('R$ 10,00').className).toContain(classe)
  })

  it('kpi sem tom é neutro', () => {
    render(<Kpi rotulo="Clientes" valor="12" />)

    expect(screen.getByText('12').className).toContain('text-slate-900')
  })

  it('pill sem tom é neutra', () => {
    render(<StatusPill>Pago</StatusPill>)

    expect(screen.getByText('Pago').className).toContain('bg-slate-100')
  })
})

describe('ModalDeFormulario', () => {
  function montar(aoEnviar = vi.fn((evento: { preventDefault: () => void }) => evento.preventDefault())) {
    const aoFechar = vi.fn()
    render(
      <ModalDeFormulario titulo="Novo cliente" subtitulo="Dados da ficha" rotuloDeEnvio="Salvar" idDoTitulo="t" aoEnviar={aoEnviar} aoFechar={aoFechar}>
        <input aria-label="nome" />
      </ModalDeFormulario>,
    )
    return { aoEnviar, aoFechar, dialogo: document.querySelector('dialog') as HTMLDialogElement }
  }

  it('abre como modal, com título e subtítulo', () => {
    const { dialogo } = montar()

    expect(dialogo.open).toBe(true)
    expect(dialogo.getAttribute('aria-labelledby')).toBe('t')
    expect(screen.getByText('Dados da ficha')).toBeTruthy()
  })

  it('fechar pelo X, por Cancelar ou pelo próprio diálogo (Esc) chama aoFechar', () => {
    const { aoFechar, dialogo } = montar()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar sem salvar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    dialogo.close()

    expect(aoFechar).toHaveBeenCalledTimes(3)
  })

  it('enviar entrega o evento do formulário', () => {
    const { aoEnviar } = montar()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(aoEnviar).toHaveBeenCalledTimes(1)
  })

  it('sem subtítulo, não desenha a linha vazia', () => {
    render(
      <ModalDeFormulario titulo="Editar" rotuloDeEnvio="Salvar" idDoTitulo="t2" aoEnviar={vi.fn()} aoFechar={vi.fn()}>
        <span />
      </ModalDeFormulario>,
    )

    expect(document.querySelector('#t2')?.nextElementSibling).toBeNull()
  })
})
