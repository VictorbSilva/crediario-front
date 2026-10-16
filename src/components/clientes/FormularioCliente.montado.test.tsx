// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { ENTRADA_CLIENTE_VAZIA, LIMITES_CLIENTE, entradaDoCliente } from '@/lib/cliente'
import type { ConfiancaDaLista } from '@/lib/sync'
import { instalarDialogo } from '@/test/dialogo'
import type { Cliente } from '@/types/cliente'
import { FormularioCliente } from './FormularioCliente'

// O `FormularioCliente.test.ts` substitui o modal e só alcança o envio. Aqui o
// formulário monta inteiro, para o que só aparece digitando: quando cada erro surge.

const simulado = vi.hoisted(() => ({
  clientes: [] as Cliente[],
  confianca: 'confiavel' as ConfiancaDaLista,
  criarCliente: vi.fn(),
  editarCliente: vi.fn((): boolean => true),
}))

vi.mock('@/data/useClientes', () => ({ useClientes: () => simulado }))

function cliente(extras: Partial<Cliente> = {}): Cliente {
  return {
    id: 'joao', numero: 137, nome: 'João da Silva', nomeBusca: 'joao da silva',
    telefone: '(11) 98888-7777', telefoneDigits: '11988887777', endereco: 'Rua A, 10',
    diasDeVisita: [5], cadastradoEm: '2026-09-03', criadoEm: null, atualizadoEm: null,
    atualizadoPor: 'x', pendente: false, ...extras,
  }
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

function salvar(nome = /^Salvar/) {
  fireEvent.click(screen.getByRole('button', { name: nome }))
}

let aoFechar: Mock<() => void>

beforeEach(() => {
  instalarDialogo()
  simulado.clientes = [cliente(), cliente({ id: 'rita', numero: 40, nome: 'Rita', arquivado: true })]
  simulado.confianca = 'confiavel'
  simulado.criarCliente.mockReset()
  simulado.editarCliente.mockReset().mockReturnValue(true)
  aoFechar = vi.fn()
})

afterEach(() => {
  cleanup()
})

describe('FormularioCliente — cadastro', () => {
  it('nasce vazio, com o foco no número e os limites da regra em cada campo', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)

    expect(screen.getByText('Novo cliente')).toBeTruthy()
    expect(document.activeElement).toBe(campo(/^Número/))
    expect(campo(/^Número/).value).toBe('')
    expect(campo(/^Nome/).maxLength).toBe(LIMITES_CLIENTE.nome)
    expect(campo(/^Telefone/).maxLength).toBe(LIMITES_CLIENTE.telefone)
    expect(campo(/^CPF/).maxLength).toBe(LIMITES_CLIENTE.cpf)
    expect(campo(/^Endereço/).maxLength).toBe(LIMITES_CLIENTE.endereco)
    expect(campo(/^Observação/).maxLength).toBe(LIMITES_CLIENTE.observacao)
    // `type="number"` aceitaria "e", "+" e a roda do mouse.
    expect(campo(/^Número/).type).toBe('text')
    expect(campo(/^Número/).inputMode).toBe('numeric')
  })

  it('número repetido acusa na hora, sem esperar sair do campo', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)

    digitar(/^Número/, '137')

    expect(erroDe(/^Número/)).toBe('O número 137 já é de João da Silva.')
  })

  it('número com letra acusa na hora; número vazio só acusa depois de sair do campo', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)

    digitar(/^Número/, '13a')
    expect(erroDe(/^Número/)).toBe('Use só números, sem letras nem pontos.')

    digitar(/^Número/, '')
    expect(erroDe(/^Número/)).toBeNull()

    fireEvent.blur(campo(/^Número/))
    expect(erroDe(/^Número/)).toBe('Digite o número do cliente.')
  })

  it('número de cliente arquivado está livre', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)

    digitar(/^Número/, '40')

    expect(erroDe(/^Número/)).toBeNull()
  })

  it('CPF não grita "incompleto" enquanto se digita, só depois de sair do campo', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)

    digitar(/^CPF/, '529')
    expect(erroDe(/^CPF/)).toBeNull()

    fireEvent.blur(campo(/^CPF/))
    expect(erroDe(/^CPF/)).toBe('CPF incompleto: faltam dígitos.')

    digitar(/^CPF/, '111.111.111-11')
    expect(erroDe(/^CPF/)).toBe('Digite um CPF válido.')

    digitar(/^CPF/, '')
    expect(erroDe(/^CPF/)).toBeNull()
  })

  it('com o número já preenchido, os outros campos continuam esperando sair deles', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)
    digitar(/^Número/, '41')

    digitar(/^CPF/, '529')
    digitar(/^Telefone/, '1'.repeat(21))
    expect(erroDe(/^CPF/)).toBeNull()
    expect(erroDe(/^Telefone/)).toBeNull()

    fireEvent.blur(campo(/^Telefone/))
    expect(erroDe(/^Telefone/)).toBe('Telefone com dígitos demais: máximo 20.')
  })

  it('número só de espaços não acusa enquanto se digita', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)

    digitar(/^Número/, '   ')

    expect(erroDe(/^Número/)).toBeNull()
  })

  it('endereço e observação acusam ao sair, e o que se digita neles é gravado', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)
    expect(screen.getByText('O número é o mesmo da lista de papel.')).toBeTruthy()

    digitar(/^Endereço/, 'a'.repeat(201))
    fireEvent.blur(campo(/^Endereço/))
    digitar(/^Observação/, 'a'.repeat(501))
    fireEvent.blur(campo(/^Observação/))
    expect(erroDe(/^Endereço/)).toBe('Endereço muito longo: máximo 200 caracteres.')
    expect(erroDe(/^Observação/)).toBe('Observação muito longa: máximo 500 caracteres.')

    digitar(/^Número/, '41')
    digitar(/^Nome/, 'Carla')
    digitar(/^Endereço/, 'Rua B, 7')
    digitar(/^Observação/, 'Portão azul')
    salvar()
    expect(simulado.criarCliente).toHaveBeenCalledWith(expect.objectContaining({ endereco: 'Rua B, 7', observacao: 'Portão azul' }))
  })

  it('nome só acusa depois de sair do campo ou de tentar salvar', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)

    digitar(/^Nome/, '')
    expect(erroDe(/^Nome/)).toBeNull()

    fireEvent.blur(campo(/^Nome/))
    expect(erroDe(/^Nome/)).toBe('Digite o nome do cliente.')
  })

  it('salvar com erro mostra todos os erros e não grava nem fecha', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)

    digitar(/^Telefone/, '1'.repeat(21))
    salvar()

    expect(erroDe(/^Número/)).toBe('Digite o número do cliente.')
    expect(erroDe(/^Nome/)).toBe('Digite o nome do cliente.')
    expect(erroDe(/^Telefone/)).toBe('Telefone com dígitos demais: máximo 20.')
    expect(simulado.criarCliente).not.toHaveBeenCalled()
    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('cadastro válido grava o que foi digitado, com os dias de visita em ordem, e fecha', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)

    digitar(/^Número/, '41')
    digitar(/^Nome/, 'Carla Souza')
    digitar(/^Telefone/, '(11) 3333-4444')
    fireEvent.click(screen.getByRole('button', { name: '20' }))
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    salvar()

    expect(simulado.criarCliente).toHaveBeenCalledWith({
      ...ENTRADA_CLIENTE_VAZIA, numero: '41', nome: 'Carla Souza', telefone: '(11) 3333-4444',
      diasDeVisita: [5, 20],
    })
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('lista que não carregou bloqueia o número; lista parcial avisa mas deixa cadastrar', () => {
    simulado.confianca = 'desconhecida'
    render(<FormularioCliente aoFechar={aoFechar} />)
    digitar(/^Número/, '41')
    expect(erroDe(/^Número/)).toBe('Espere a lista de clientes carregar para conferir o número.')
    expect(screen.getByText(/Esperando a lista de clientes carregar/)).toBeTruthy()

    cleanup()
    simulado.confianca = 'parcial'
    render(<FormularioCliente aoFechar={aoFechar} />)
    expect(screen.getByText(/Este aparelho ainda não sincronizou a lista de clientes/)).toBeTruthy()
    digitar(/^Número/, '41')
    digitar(/^Nome/, 'Carla')
    salvar()
    expect(simulado.criarCliente).toHaveBeenCalledTimes(1)
  })

  it('fechar sem salvar não grava', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)
    digitar(/^Número/, '41')

    fireEvent.click(screen.getByRole('button', { name: 'Fechar sem salvar' }))

    expect(aoFechar).toHaveBeenCalledTimes(1)
    expect(simulado.criarCliente).not.toHaveBeenCalled()
  })
})

describe('FormularioCliente — edição', () => {
  it('nasce preenchido, sem campo de número, com o foco no nome', () => {
    const joao = cliente()
    render(<FormularioCliente cliente={joao} aoFechar={aoFechar} />)

    expect(screen.getByText('Editar cliente')).toBeTruthy()
    expect(screen.getByText('#137 — o número não muda depois do cadastro.')).toBeTruthy()
    expect(screen.queryByLabelText(/^Número/)).toBeNull()
    expect(campo(/^Nome/).value).toBe('João da Silva')
    expect(campo(/^Telefone/).value).toBe('(11) 98888-7777')
    expect(document.activeElement).toBe(campo(/^Nome/))
    expect(screen.getByRole('button', { name: '5' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('não confere número nem avisa da lista parcial, que só importam no cadastro', () => {
    simulado.confianca = 'desconhecida'
    render(<FormularioCliente cliente={cliente()} aoFechar={aoFechar} />)

    expect(screen.queryByText(/Esperando a lista de clientes carregar/)).toBeNull()
    salvar(/Salvar alterações/)
    expect(simulado.editarCliente).toHaveBeenCalledTimes(1)
  })

  it('salva contra o cliente da abertura, mesmo que o listener mude a ficha no meio', () => {
    const naAbertura = cliente()
    const { rerender } = render(<FormularioCliente cliente={naAbertura} aoFechar={aoFechar} />)

    // Outro aparelho trocou o telefone enquanto este formulário estava aberto.
    rerender(<FormularioCliente cliente={cliente({ telefone: '(11) 5555-0000' })} aoFechar={aoFechar} />)
    digitar(/^Nome/, 'João Silva')
    salvar(/Salvar alterações/)

    expect(simulado.editarCliente).toHaveBeenCalledWith(naAbertura, {
      ...entradaDoCliente(naAbertura), nome: 'João Silva',
    })
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('sem empresa vinculada, fica aberto e diz por quê', () => {
    simulado.editarCliente.mockReturnValue(false)
    render(<FormularioCliente cliente={cliente()} aoFechar={aoFechar} />)

    expect(screen.queryByText(/nenhuma empresa está vinculada/)).toBeNull()
    salvar(/Salvar alterações/)

    expect(screen.getByText('Não foi possível salvar: nenhuma empresa está vinculada a esta conta.')).toBeTruthy()
    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('apagar o nome na edição é erro, e nada é gravado', () => {
    render(<FormularioCliente cliente={cliente()} aoFechar={aoFechar} />)

    digitar(/^Nome/, '   ')
    salvar(/Salvar alterações/)

    expect(erroDe(/^Nome/)).toBe('Digite o nome do cliente.')
    expect(simulado.editarCliente).not.toHaveBeenCalled()
  })
})

describe('SeletorDeDias', () => {
  it('liga e desliga dias, sempre em ordem, e resume o que foi escolhido', () => {
    render(<FormularioCliente aoFechar={aoFechar} />)
    const grupo = screen.getByRole('group', { name: 'Dias de visita no mês' })
    const dia = (n: number) => within(grupo).getByRole('button', { name: String(n) })

    expect(within(grupo).getAllByRole('button')).toHaveLength(31)
    expect(within(grupo).getByText('Sem dias de visita')).toBeTruthy()

    fireEvent.click(dia(31))
    expect(within(grupo).getByText('Dia 31')).toBeTruthy()
    expect(dia(31).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(dia(2))
    fireEvent.click(dia(15))
    expect(within(grupo).getByText('Dias 2, 15 e 31')).toBeTruthy()

    fireEvent.click(dia(15))
    expect(dia(15).getAttribute('aria-pressed')).toBe('false')
    expect(within(grupo).getByText('Dias 2 e 31')).toBeTruthy()
    expect(within(grupo).getByText('Dia 31 cai no último dia dos meses mais curtos.')).toBeTruthy()
  })
})
