// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

function etiquetas(item: HTMLElement): string[] {
  return within(item).queryAllByRole('listitem').map((etiqueta) => etiqueta.textContent ?? '')
}

function interruptor(dialogo: HTMLElement, nome: string): HTMLElement {
  return within(dialogo).getByRole('switch', { name: nome })
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

let conectado = true

function mudarConexao(online: boolean) {
  act(() => {
    conectado = online
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  })
}

beforeEach(() => {
  instalarDialogo()
  simulado.equipe = equipe()
  simulado.acesso = null
  conectado = true
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => conectado })
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'onLine')
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

  it('mostra no cartão uma etiqueta por permissão ligada, na ordem das permissões', () => {
    simulado.equipe = equipe({
      membros: [
        membro('caio', 'Caio Melo', { permissoes: { financeiro: false, caixaDoDia: true, exportar: true } }),
        membro('dora', 'Dora Luz', { permissoes: { financeiro: true, caixaDoDia: false, exportar: false } }),
      ],
    })
    render(<EquipePage />)

    expect(etiquetas(cartao('Caio Melo'))).toEqual(['Caixa do dia', 'Exportar dados'])
    expect(etiquetas(cartao('Dora Luz'))).toEqual(['Financeiro geral'])
  })

  it('ativo sem nenhuma permissão: o cartão diz "Sem permissões extras"', () => {
    simulado.equipe = equipe({ membros: [membro('caio', 'Caio Melo')] })
    render(<EquipePage />)

    const caio = cartao('Caio Melo')
    expect(within(caio).getByText('Sem permissões extras')).toBeTruthy()
    expect(etiquetas(caio)).toEqual([])
  })

  it('desativado: o cartão não mostra etiquetas', () => {
    simulado.equipe = equipe({
      membros: [membro('bruno', 'Bruno Reis', { ativo: false, permissoes: { financeiro: true, caixaDoDia: false, exportar: false } })],
    })
    render(<EquipePage />)

    const bruno = cartao('Bruno Reis')
    expect(etiquetas(bruno)).toEqual([])
    expect(within(bruno).queryByText('Sem permissões extras')).toBeNull()
  })

  it('cada cartão tem avatar de 40 px com as iniciais e um único botão, Gerenciar', () => {
    render(<EquipePage />)

    for (const [nome, iniciais] of [['Ana Lima', 'AL'], ['Bruno Reis', 'BR']]) {
      const item = cartao(nome)
      const avatar = item.querySelector('[aria-hidden="true"]') as HTMLElement
      expect(avatar.textContent).toBe(iniciais)
      expect(avatar.className).toContain('h-10')
      expect(avatar.className).toContain('w-10')

      const botoes = within(item).getAllByRole('button')
      expect(botoes.map((botao) => botao.textContent)).toEqual(['Gerenciar'])
      expect(botoes[0].className).toContain('border-slate-200')
    }
    expect(screen.queryByRole('button', { name: 'Permissões' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reativar' })).toBeNull()
  })

  it('o avatar fica destacado só para quem está ativo', () => {
    render(<EquipePage />)

    const destaque = (nome: string) => (cartao(nome).querySelector('[aria-hidden="true"]') as HTMLElement).className
    expect(destaque('Ana Lima')).toContain('bg-brand-50')
    expect(destaque('Bruno Reis')).not.toContain('bg-brand-50')
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
    for (const rotulo of ['Financeiro geral', 'Caixa do dia', 'Exportar dados']) {
      expect(interruptor(dialogo, rotulo).getAttribute('aria-checked')).toBe('false')
    }
    expect(within(dialogo).getByRole('button', { name: 'Cobrador' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(dialogo).queryByText(/Esqueci minha senha/)).toBeNull()
  })

  it('a seção Acesso traz nome, e-mail e senha num cartão, e as permissões vêm abaixo', () => {
    render(<EquipePage />)
    const dialogo = abrirCadastro()

    const acesso = within(dialogo).getByRole('region', { name: 'Acesso' })
    expect(within(acesso).getByLabelText(/^Nome/)).toBeTruthy()
    expect(within(acesso).getByLabelText(/^E-mail/)).toBeTruthy()
    expect(within(acesso).getByLabelText(/^Senha/)).toBeTruthy()
    expect(within(acesso).queryByRole('switch')).toBeNull()

    const cartaoBranco = within(acesso).getByLabelText(/^Nome/).closest('.rounded-xl') as HTMLElement
    expect(cartaoBranco.className).toContain('bg-white')
    expect(cartaoBranco.className).toContain('border-slate-200')

    const permissoes = within(dialogo).getByRole('heading', { name: 'Permissões' })
    expect(acesso.compareDocumentPosition(permissoes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('no rodapé, avisa que criar a conta precisa de internet', () => {
    render(<EquipePage />)
    const dialogo = abrirCadastro()

    const aviso = within(dialogo).getByText('Criar a conta precisa de internet.')
    expect(aviso.querySelector('svg')).not.toBeNull()
    const criar = within(dialogo).getByRole('button', { name: 'Criar conta' }) as HTMLButtonElement
    expect(criar.disabled).toBe(false)
    expect(aviso.compareDocumentPosition(criar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('aberto sem internet, o botão vira "Sem internet", desabilitado, e volta ao reconectar', () => {
    conectado = false
    render(<EquipePage />)
    const dialogo = abrirCadastro()

    const semInternet = within(dialogo).getByRole('button', { name: 'Sem internet' }) as HTMLButtonElement
    expect(semInternet.disabled).toBe(true)
    expect(within(dialogo).getByText('Sem internet agora. Conecte para criar a conta.')).toBeTruthy()
    expect(within(dialogo).queryByText('Criar a conta precisa de internet.')).toBeNull()

    preencherCadastro()
    fireEvent.click(semInternet)
    expect(simulado.equipe.cadastrar).not.toHaveBeenCalled()

    mudarConexao(true)

    const criar = within(dialogo).getByRole('button', { name: 'Criar conta' }) as HTMLButtonElement
    expect(criar.disabled).toBe(false)
    expect(within(dialogo).getByText('Criar a conta precisa de internet.')).toBeTruthy()
  })

  it('perder a internet com o card aberto desabilita o botão', () => {
    render(<EquipePage />)
    const dialogo = abrirCadastro()

    mudarConexao(false)

    expect((within(dialogo).getByRole('button', { name: 'Sem internet' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(dialogo).getByText('Sem internet agora. Conecte para criar a conta.')).toBeTruthy()
  })

  it('Gerar preenche a senha e ela vai para o cadastro', () => {
    render(<EquipePage />)
    abrirCadastro()

    digitar(/^Nome/, 'Carla Dias')
    digitar(/^E-mail/, 'carla@loja.com')
    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }))
    const gerada = campo(/^Senha/).value
    expect(gerada).toMatch(/^[^-]{4}-[^-]{4}$/)
    expect(campo(/^Senha/).type).toBe('text')
    expect(campo(/^Senha/).getAttribute('autocomplete')).toBe('new-password')

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(simulado.equipe.cadastrar).toHaveBeenCalledWith(expect.objectContaining({ senha: gerada }))
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

  it('cadastra com o que foi digitado e as permissões marcadas', async () => {
    render(<EquipePage />)
    const dialogo = abrirCadastro()

    preencherCadastro()
    fireEvent.click(interruptor(dialogo, 'Caixa do dia'))
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(simulado.equipe.cadastrar).toHaveBeenCalledTimes(1)
    expect(simulado.equipe.cadastrar).toHaveBeenCalledWith({
      nome: '  Carla Dias ',
      email: 'Carla@Loja.com',
      senha: 'segredo1',
      permissoes: { financeiro: false, caixaDoDia: true, exportar: false },
    })
    expect(await screen.findByText('A conta de Carla está pronta')).toBeTruthy()
  })

  it('criada a conta, o mesmo card mostra o acesso, com o e-mail como a conta foi criada', async () => {
    render(<EquipePage />)
    const dialogo = abrirCadastro()

    preencherCadastro()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    await screen.findByText('A conta de Carla está pronta')

    expect(screen.getByRole('dialog')).toBe(dialogo)
    expect(within(dialogo).getByRole('heading', { name: 'Conta criada' })).toBeTruthy()
    expect(within(dialogo).getByText('Carla Dias')).toBeTruthy()
    expect(within(dialogo).getByText('carla@loja.com')).toBeTruthy()
    expect(within(dialogo).getByText('segredo1')).toBeTruthy()
    expect(within(dialogo).queryByRole('region', { name: 'Acesso' })).toBeNull()
    expect(within(dialogo).queryByText(/precisa de internet/)).toBeNull()

    expect(within(dialogo).queryByRole('button', { name: 'Cancelar' })).toBeNull()
    expect(within(dialogo).queryByRole('button', { name: 'Fechar sem salvar' })).toBeNull()
    expect(within(dialogo).getByRole('button', { name: 'Fechar' })).toBeTruthy()
    expect(within(dialogo).getByRole('button', { name: 'Concluir' }).getAttribute('type')).toBe('button')
  })

  it('Concluir fecha, e o próximo cadastro começa vazio, sem a senha anterior', async () => {
    render(<EquipePage />)
    abrirCadastro()

    preencherCadastro()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }))

    expect(screen.queryByRole('dialog')).toBeNull()

    abrirCadastro()
    expect(campo(/^Nome/).value).toBe('')
    expect(campo(/^Senha/).value).toBe('')
    expect(screen.queryByText('segredo1')).toBeNull()
  })

  it('um envio do formulário na tela de sucesso não cadastra de novo nem fecha', async () => {
    render(<EquipePage />)
    const dialogo = abrirCadastro()

    preencherCadastro()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    await screen.findByText('A conta de Carla está pronta')

    fireEvent.submit(dialogo.querySelector('form') as HTMLFormElement)

    expect(simulado.equipe.cadastrar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toBe(dialogo)
    expect(screen.getByText('A conta de Carla está pronta')).toBeTruthy()
  })

  it('o X da tela de sucesso também fecha', async () => {
    render(<EquipePage />)
    abrirCadastro()

    preencherCadastro()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Fechar' }))

    expect(screen.queryByRole('dialog')).toBeNull()
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
    expect(await screen.findByText('A conta de Carla está pronta')).toBeTruthy()
  })

  it('Cancelar fecha sem cadastrar', () => {
    render(<EquipePage />)
    abrirCadastro()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(simulado.equipe.cadastrar).not.toHaveBeenCalled()
  })
})

function gerenciar(nome: string): HTMLElement {
  fireEvent.click(within(cartao(nome)).getByRole('button', { name: 'Gerenciar' }))
  return screen.getByRole('dialog')
}

function salvar(dialogo: HTMLElement): HTMLButtonElement {
  return within(dialogo).getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement
}

describe('EquipePage — gerenciar funcionário', () => {
  it('abre com o cabeçalho do funcionário e as permissões atuais', () => {
    render(<EquipePage />)
    const dialogo = gerenciar('Ana Lima')

    expect(within(dialogo).getByRole('heading', { name: 'Gerenciar funcionário' })).toBeTruthy()
    expect(within(dialogo).getByText('Ana Lima')).toBeTruthy()
    expect(within(dialogo).getByText('ana@loja.com')).toBeTruthy()
    expect(within(dialogo).getByText('Ativo')).toBeTruthy()
    expect(interruptor(dialogo, 'Caixa do dia').getAttribute('aria-checked')).toBe('true')
    expect(interruptor(dialogo, 'Financeiro geral').getAttribute('aria-checked')).toBe('false')
  })

  it('Salvar só habilita com mudança, e o rodapé diz se há alteração', () => {
    render(<EquipePage />)
    const dialogo = gerenciar('Ana Lima')

    expect(salvar(dialogo).disabled).toBe(true)
    expect(within(dialogo).getByText('Nenhuma alteração para salvar.')).toBeTruthy()

    fireEvent.click(interruptor(dialogo, 'Exportar dados'))
    expect(salvar(dialogo).disabled).toBe(false)
    expect(within(dialogo).getByText('Alterações não salvas.')).toBeTruthy()

    fireEvent.click(interruptor(dialogo, 'Exportar dados'))
    expect(salvar(dialogo).disabled).toBe(true)
    expect(within(dialogo).getByText('Nenhuma alteração para salvar.')).toBeTruthy()
  })

  it('salva as permissões alteradas e fecha', () => {
    render(<EquipePage />)
    const dialogo = gerenciar('Ana Lima')

    fireEvent.click(interruptor(dialogo, 'Caixa do dia'))
    fireEvent.click(interruptor(dialogo, 'Exportar dados'))
    fireEvent.click(salvar(dialogo))

    expect(simulado.equipe.alterarPermissoes).toHaveBeenCalledExactlyOnceWith('ana', {
      financeiro: false, caixaDoDia: false, exportar: true,
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sem mudança, um envio do formulário não grava', () => {
    render(<EquipePage />)
    const dialogo = gerenciar('Ana Lima')

    fireEvent.submit(dialogo.querySelector('form') as HTMLFormElement)

    expect(simulado.equipe.alterarPermissoes).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBe(dialogo)
  })

  it('Cancelar fecha sem alterar', () => {
    render(<EquipePage />)
    const dialogo = gerenciar('Ana Lima')

    fireEvent.click(interruptor(dialogo, 'Exportar dados'))
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(simulado.equipe.alterarPermissoes).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('EquipePage — zona de risco e reativação', () => {
  it('ativo: a zona de risco oferece desativar o acesso', () => {
    render(<EquipePage />)
    const dialogo = gerenciar('Ana Lima')

    const titulo = within(dialogo).getByRole('heading', { name: 'Zona de risco' })
    expect(titulo.className).toContain('text-danger')
    const zona = within(dialogo).getByRole('region', { name: 'Zona de risco' })
    expect(within(zona).getByText('Desativar o acesso de Ana')).toBeTruthy()
    expect(within(zona).getByText(
      'Fica sem acesso aos dados da loja na hora. A conta não é apagada e dá para reativar depois.',
    )).toBeTruthy()
    expect((within(zona).getByText('Desativar o acesso de Ana').closest('.rounded-xl') as HTMLElement).className)
      .toContain('border-red-200')
    expect(within(dialogo).queryByRole('button', { name: 'Reativar acesso' })).toBeNull()
  })

  it('Desativar acesso pede confirmação; confirmado, grava e fecha o card', () => {
    render(<EquipePage />)
    const dialogo = gerenciar('Ana Lima')

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desativar acesso' }))

    const confirmacao = screen.getAllByRole('dialog').find((elemento) => elemento !== dialogo) as HTMLElement
    expect(within(confirmacao).getByText(/Desativar Ana Lima\?/)).toBeTruthy()
    expect(simulado.equipe.definirAtivo).not.toHaveBeenCalled()

    fireEvent.click(within(confirmacao).getByRole('button', { name: 'Desativar' }))

    expect(simulado.equipe.definirAtivo).toHaveBeenCalledExactlyOnceWith('ana', false)
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
  })

  it('Voltar fecha só a confirmação, sem desativar, e o card continua aberto', () => {
    render(<EquipePage />)
    const dialogo = gerenciar('Ana Lima')

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desativar acesso' }))
    const confirmacao = screen.getAllByRole('dialog').find((elemento) => elemento !== dialogo) as HTMLElement
    fireEvent.click(within(confirmacao).getByRole('button', { name: 'Voltar' }))

    expect(simulado.equipe.definirAtivo).not.toHaveBeenCalled()
    expect(screen.getAllByRole('dialog')).toEqual([dialogo])
    expect(within(dialogo).getByRole('heading', { name: 'Gerenciar funcionário' })).toBeTruthy()
  })

  it('desativado: no lugar da zona de risco, "Acesso desativado" com Reativar acesso, que grava e fecha', () => {
    render(<EquipePage />)
    const dialogo = gerenciar('Bruno Reis')

    expect(within(dialogo).queryByRole('heading', { name: 'Zona de risco' })).toBeNull()
    expect(within(dialogo).queryByRole('button', { name: 'Desativar acesso' })).toBeNull()
    const secao = within(dialogo).getByRole('region', { name: 'Acesso desativado' })
    const reativar = within(secao).getByRole('button', { name: 'Reativar acesso' })
    expect(reativar.getAttribute('type')).toBe('button')
    expect(reativar.className).toContain('border-slate-200')

    fireEvent.click(reativar)

    expect(simulado.equipe.definirAtivo).toHaveBeenCalledExactlyOnceWith('bruno', true)
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
