// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomNav } from '@/components/layout/BottomNav'
import type { Equipe } from '@/data/useEquipe'
import type { Acesso, Permissoes } from '@/lib/acesso'
import type { Membro } from '@/lib/equipe'
import { instalarDialogo } from '@/test/dialogo'
import { EquipePage } from './EquipePage'

const simulado = vi.hoisted(() => ({
  equipe: null as unknown as Equipe,
  acesso: null as Acesso | null,
}))

vi.mock('@/data/useEquipe', () => ({ useEquipe: () => simulado.equipe }))
vi.mock('@/data/useAcesso', () => ({ useAcesso: () => simulado.acesso }))

const NENHUMA: Permissoes = { financeiro: false, caixaDoDia: false, exportar: false }

function membro(uid: string, nome: string, extras: Partial<Membro> = {}): Membro {
  return {
    uid, nome, email: `${uid}@loja.com`, ativo: true, permissoes: NENHUMA, pendente: false, ...extras,
  }
}

const ANA = membro('ana', 'Ana Lima', { permissoes: { financeiro: false, caixaDoDia: true, exportar: false } })
const BRUNO = membro('bruno', 'Bruno Reis', { ativo: false })

function equipe(extras: Partial<Equipe> = {}): Equipe {
  return {
    membros: [ANA, BRUNO],
    carregando: false,
    erro: null,
    cadastrar: vi.fn(async () => null),
    alterarPermissoes: vi.fn(),
    definirAtivo: vi.fn(),
    ...extras,
  }
}

function cartao(nome: string): HTMLElement {
  const item = screen.getByText(nome).closest('li')
  if (!item) throw new Error(`Cartão de ${nome} não encontrado.`)
  return item
}

function campo(rotulo: RegExp): HTMLInputElement {
  return screen.getByLabelText(rotulo) as HTMLInputElement
}

function digitar(rotulo: RegExp, valor: string) {
  fireEvent.change(campo(rotulo), { target: { value: valor } })
}

function erroDe(rotulo: RegExp): string | null {
  const id = campo(rotulo).getAttribute('aria-describedby')?.split(' ').find((parte) => parte.endsWith('-erro'))
  return id ? (document.getElementById(id)?.textContent ?? null) : null
}

function abrirCadastro() {
  fireEvent.click(screen.getByRole('button', { name: /Novo funcionário/ }))
  return screen.getByRole('dialog')
}

function preencherCadastro() {
  digitar(/^Nome/, '  Carla Dias ')
  digitar(/^E-mail/, 'Carla@Loja.com')
  digitar(/^Senha/, 'segredo1')
}

beforeEach(() => {
  instalarDialogo()
  simulado.equipe = equipe()
  simulado.acesso = null
})

afterEach(() => {
  cleanup()
})

describe('EquipePage — lista', () => {
  it('mostra nome, e-mail e situação de cada membro', () => {
    render(<EquipePage />)

    const ana = cartao('Ana Lima')
    expect(within(ana).getByText('ana@loja.com')).toBeTruthy()
    expect(within(ana).getByText('Ativo')).toBeTruthy()
    expect(within(ana).queryByText('Desativado')).toBeNull()

    const bruno = cartao('Bruno Reis')
    expect(within(bruno).getByText('bruno@loja.com')).toBeTruthy()
    expect(within(bruno).getByText('Desativado')).toBeTruthy()
    expect(within(bruno).queryByText('Ativo')).toBeNull()
  })

  it('marca o membro com gravação ainda não confirmada como pendente', () => {
    simulado.equipe = equipe({ membros: [membro('caio', 'Caio Melo', { pendente: true }), ANA] })
    render(<EquipePage />)

    expect(within(cartao('Caio Melo')).getByText('Pendente')).toBeTruthy()
    expect(within(cartao('Ana Lima')).queryByText('Pendente')).toBeNull()
  })

  it('mostra o que cada membro vê, na ordem das permissões', () => {
    simulado.equipe = equipe({
      membros: [
        membro('caio', 'Caio Melo', { permissoes: { financeiro: false, caixaDoDia: true, exportar: true } }),
        membro('dora', 'Dora Luz', { permissoes: { financeiro: true, caixaDoDia: false, exportar: false } }),
      ],
    })
    render(<EquipePage />)

    expect(within(cartao('Caio Melo')).getByText('Vê: Caixa do dia, Exportar dados')).toBeTruthy()
    expect(within(cartao('Dora Luz')).getByText('Vê: Financeiro geral')).toBeTruthy()
  })

  it('sem nenhuma permissão, diz que não vê Financeiro nem Exportar', () => {
    render(<EquipePage />)

    const bruno = cartao('Bruno Reis')
    expect(within(bruno).getByText('Sem acesso ao Financeiro nem a Exportar')).toBeTruthy()
    expect(within(bruno).queryByText(/^Vê:/)).toBeNull()
  })

  it('avisa enquanto carrega e quando não há ninguém', () => {
    simulado.equipe = equipe({ membros: [], carregando: true })
    const { rerender } = render(<EquipePage />)
    expect(screen.getByText(/Carregando a equipe/)).toBeTruthy()

    simulado.equipe = equipe({ membros: [] })
    rerender(<EquipePage />)
    expect(screen.getByText(/Nenhum funcionário cadastrado/)).toBeTruthy()
  })

  it('mostra o erro do hook', () => {
    simulado.equipe = equipe({ erro: 'Não foi possível carregar a equipe.' })
    render(<EquipePage />)

    expect(screen.getByText('Não foi possível carregar a equipe.')).toBeTruthy()
  })
})

describe('EquipePage — novo funcionário', () => {
  it('abre com nome, e-mail, senha escondida e as três permissões desmarcadas', () => {
    render(<EquipePage />)
    const dialogo = abrirCadastro()

    expect(campo(/^Nome/).value).toBe('')
    expect(campo(/^E-mail/).value).toBe('')
    expect(campo(/^Senha/).type).toBe('password')
    for (const rotulo of ['Ver o Financeiro geral', 'Ver o Caixa do dia', 'Exportar dados']) {
      expect((within(dialogo).getByLabelText(rotulo) as HTMLInputElement).checked).toBe(false)
    }
    expect(within(dialogo).getByText(/precisa de internet/)).toBeTruthy()
    expect(within(dialogo).getByText(/Esqueci minha senha/)).toBeTruthy()
  })

  it('a senha pede "new-password", para o navegador não preencher a senha salva do dono', () => {
    render(<EquipePage />)
    abrirCadastro()

    expect(campo(/^Senha/).getAttribute('autocomplete')).toBe('new-password')
    expect(campo(/^Nome/).getAttribute('autocomplete')).toBe('off')
    expect(campo(/^E-mail/).getAttribute('autocomplete')).toBe('off')
  })

  it('o e-mail abre o teclado de e-mail, sem maiúscula, correção nem verificação ortográfica', () => {
    render(<EquipePage />)
    abrirCadastro()

    const email = campo(/^E-mail/)
    expect(email.getAttribute('inputmode')).toBe('email')
    expect(email.getAttribute('autocapitalize')).toBe('none')
    expect(email.getAttribute('autocorrect')).toBe('off')
    expect(email.getAttribute('spellcheck')).toBe('false')

    const nome = campo(/^Nome/)
    expect(nome.getAttribute('inputmode')).toBe('text')
    expect(nome.hasAttribute('autocapitalize')).toBe(false)
    expect(nome.hasAttribute('autocorrect')).toBe(false)
    expect(nome.hasAttribute('spellcheck')).toBe(false)
  })

  it('mostra o erro de validação no campo e não cadastra', () => {
    render(<EquipePage />)
    abrirCadastro()

    digitar(/^E-mail/, 'sem-arroba')
    digitar(/^Senha/, '123')
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(erroDe(/^Nome/)).toBe('Digite o nome do funcionário.')
    expect(erroDe(/^E-mail/)).toBe('E-mail inválido.')
    expect(erroDe(/^Senha/)).toBe('Senha fraca: use 6 caracteres ou mais.')
    expect(simulado.equipe.cadastrar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('não mostra erro em campo ainda não tocado antes de tentar salvar', () => {
    render(<EquipePage />)
    abrirCadastro()

    expect(erroDe(/^Nome/)).toBeNull()

    fireEvent.blur(campo(/^Nome/))
    expect(erroDe(/^Nome/)).toBe('Digite o nome do funcionário.')
    expect(erroDe(/^E-mail/)).toBeNull()
  })

  it('cadastra com o que foi digitado e as permissões marcadas, e fecha', async () => {
    render(<EquipePage />)
    const dialogo = abrirCadastro()

    preencherCadastro()
    fireEvent.click(within(dialogo).getByLabelText('Ver o Caixa do dia'))
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(simulado.equipe.cadastrar).toHaveBeenCalledTimes(1)
    expect(simulado.equipe.cadastrar).toHaveBeenCalledWith({
      nome: '  Carla Dias ',
      email: 'Carla@Loja.com',
      senha: 'segredo1',
      permissoes: { financeiro: false, caixaDoDia: true, exportar: false },
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('mostra a mensagem de erro da criação e continua aberto', async () => {
    simulado.equipe = equipe({ cadastrar: vi.fn(async () => 'Este e-mail já tem conta.') })
    render(<EquipePage />)
    abrirCadastro()

    preencherCadastro()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByText('Este e-mail já tem conta.')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(campo(/^Nome/).value).toBe('  Carla Dias ')
  })

  it('não cadastra duas vezes enquanto espera a resposta', async () => {
    let responder: (mensagem: string | null) => void = () => {}
    const cadastrar = vi.fn(() => new Promise<string | null>((resolver) => { responder = resolver }))
    simulado.equipe = equipe({ cadastrar })
    render(<EquipePage />)
    abrirCadastro()

    preencherCadastro()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fireEvent.click(screen.getByRole('button', { name: /Criando conta/ }))

    expect(cadastrar).toHaveBeenCalledTimes(1)

    responder(null)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('Cancelar fecha sem cadastrar', () => {
    render(<EquipePage />)
    abrirCadastro()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(simulado.equipe.cadastrar).not.toHaveBeenCalled()
  })
})

describe('EquipePage — permissões', () => {
  it('abre com as permissões atuais e salva as alteradas', () => {
    render(<EquipePage />)

    fireEvent.click(within(cartao('Ana Lima')).getByRole('button', { name: 'Permissões' }))
    const dialogo = screen.getByRole('dialog')

    const caixa = within(dialogo).getByLabelText('Ver o Caixa do dia') as HTMLInputElement
    expect(caixa.checked).toBe(true)
    expect((within(dialogo).getByLabelText('Ver o Financeiro geral') as HTMLInputElement).checked).toBe(false)

    fireEvent.click(caixa)
    fireEvent.click(within(dialogo).getByLabelText('Exportar dados'))
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar permissões' }))

    expect(simulado.equipe.alterarPermissoes).toHaveBeenCalledWith('ana', {
      financeiro: false, caixaDoDia: false, exportar: true,
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Cancelar fecha sem alterar', () => {
    render(<EquipePage />)

    fireEvent.click(within(cartao('Ana Lima')).getByRole('button', { name: 'Permissões' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByLabelText('Exportar dados'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(simulado.equipe.alterarPermissoes).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('EquipePage — desativar e reativar', () => {
  it('desativar pede confirmação antes de gravar', () => {
    render(<EquipePage />)

    fireEvent.click(within(cartao('Ana Lima')).getByRole('button', { name: 'Desativar' }))

    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText(/Desativar Ana Lima\?/)).toBeTruthy()
    expect(simulado.equipe.definirAtivo).not.toHaveBeenCalled()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desativar' }))

    expect(simulado.equipe.definirAtivo).toHaveBeenCalledWith('ana', false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Voltar fecha a confirmação sem desativar', () => {
    render(<EquipePage />)

    fireEvent.click(within(cartao('Ana Lima')).getByRole('button', { name: 'Desativar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Voltar' }))

    expect(simulado.equipe.definirAtivo).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('reativar grava direto, sem confirmação', () => {
    render(<EquipePage />)

    expect(within(cartao('Bruno Reis')).queryByRole('button', { name: 'Desativar' })).toBeNull()
    fireEvent.click(within(cartao('Bruno Reis')).getByRole('button', { name: 'Reativar' }))

    expect(simulado.equipe.definirAtivo).toHaveBeenCalledWith('bruno', true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('item Equipe no menu', () => {
  function rotulosDoMenu(acesso: Acesso): string[] {
    simulado.acesso = acesso
    render(<MemoryRouter><BottomNav /></MemoryRouter>)
    return screen.getAllByRole('link').map((link) => link.textContent ?? '')
  }

  it('aparece para o dono', () => {
    const dono: Acesso = {
      estado: 'liberado', dono: true, permissoes: { financeiro: true, caixaDoDia: true, exportar: true },
    }

    expect(rotulosDoMenu(dono)).toContain('Equipe')
  })

  it('some para quem não é dono, mesmo com todas as permissões', () => {
    const funcionario: Acesso = {
      estado: 'liberado', dono: false, permissoes: { financeiro: true, caixaDoDia: true, exportar: true },
    }

    expect(rotulosDoMenu(funcionario)).toEqual(['Clientes', 'Rotas', 'Financeiro'])
  })
})
