// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientesContextValue } from '@/data/clientes-context'
import { instalarDialogo } from '@/test/dialogo'
import type { Cliente } from '@/types/cliente'
import { ClientesPage } from './ClientesPage'

const simulado = vi.hoisted(() => ({
  larga: true,
  clientes: {} as ClientesContextValue,
  useCarne: vi.fn(),
}))

vi.mock('@/data/useClientes', () => ({ useClientes: () => simulado.clientes }))
vi.mock('@/components/layout/useTelaLarga', () => ({ useTelaLarga: () => simulado.larga }))
vi.mock('@/data/useCarne', () => ({ useCarne: simulado.useCarne }))
vi.mock('@/data/useCarneDaEmpresa', () => ({
  CARNE_COMPLETO: ['sales', 'installments', 'payments'],
  useCarneDaEmpresa: () => ({
    vendas: [], parcelas: [], pagamentos: [], carregando: false, pendentes: 0,
    confianca: 'confiavel', erro: null,
  }),
}))

function cliente(id: string, numero: number, nome: string, extras: Partial<Cliente> = {}): Cliente {
  return {
    id, numero, nome, nomeBusca: nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),
    cadastradoEm: '2026-09-03', criadoEm: null, atualizadoEm: null, atualizadoPor: 'x', pendente: false,
    ...extras,
  }
}

const JOAO = cliente('joao', 137, 'João da Silva', { endereco: 'Rua das Flôres, 22', telefone: '(11) 98888-7777', telefoneDigits: '11988887777' })
const MARIA = cliente('maria', 1370, 'Maria Souza', { cpf: '529.982.247-25', cpfDigits: '52998224725' })
const ZECA = cliente('zeca', 2137, 'Zeca Lima', { telefoneDigits: '1133334444', pendente: true })
const ARQUIVADA = cliente('rita', 40, 'Rita Arquivada', { arquivado: true })

function estado(clientes: Cliente[], extras: Partial<ClientesContextValue> = {}): ClientesContextValue {
  const ativos = clientes.filter((c) => c.arquivado !== true)
  return {
    clientes, ativos, arquivados: clientes.filter((c) => c.arquivado === true), carregando: false,
    erro: null, pendentes: clientes.filter((c) => c.pendente).length, doCache: false,
    estadoSync: 'sincronizado', confianca: 'confiavel', falhas: [], descartarFalha: vi.fn(),
    criarCliente: vi.fn(), editarCliente: vi.fn(() => true), alternarArquivo: vi.fn(),
    marcarNaRota: vi.fn(), reordenarRota: vi.fn(), ...extras,
  }
}

function PaginaDoCliente() {
  return <p>página do cliente {useParams().id}</p>
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/clientes']}>
      <Routes>
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/:id" element={<PaginaDoCliente />} />
      </Routes>
    </MemoryRouter>,
  )
}

function buscar(termo: string) {
  fireEvent.change(screen.getByLabelText('Buscar clientes'), { target: { value: termo } })
}

/** Os números listados, na ordem da tela. */
function listados(): number[] {
  return screen.queryAllByRole('listitem').map((li) => Number(/#(\d+)/.exec(li.textContent ?? '')?.[1]))
}

function painel(): HTMLElement {
  const aside = document.querySelector('aside')
  if (!aside) throw new Error('Sem painel')
  return aside
}

beforeEach(() => {
  instalarDialogo()
  simulado.larga = true
  simulado.clientes = estado([JOAO, MARIA, ZECA])
  simulado.useCarne.mockReset().mockReturnValue({ carnes: [], carregando: false, erro: null })
})

afterEach(() => {
  cleanup()
})

describe('ClientesPage — busca', () => {
  it('sem termo, lista todos os ativos', () => {
    montar()
    expect(listados()).toEqual([137, 1370, 2137])
  })

  it('nome casa sem acento e sem diferença de maiúscula', () => {
    montar()
    buscar('JOÃO')
    expect(listados()).toEqual([137])
  })

  it('endereço também casa sem acento', () => {
    montar()
    buscar('rua das flores')
    expect(listados()).toEqual([137])
  })

  it('número casa por prefixo, nunca pelo meio: 137 acha 137 e 1370, não 2137', () => {
    montar()
    buscar('137')
    expect(listados()).toEqual([137, 1370])
  })

  it('telefone e CPF casam por trecho dos dígitos, com ou sem pontuação', () => {
    montar()
    buscar('3333-44')
    expect(listados()).toEqual([2137])

    buscar('982.247')
    expect(listados()).toEqual([1370])
  })

  it('termo sem dígito não casa por número: texto que não existe não acha ninguém', () => {
    montar()
    buscar('xyz')

    expect(listados()).toEqual([])
    expect(screen.getByText('Nenhum cliente encontrado para esta busca.')).toBeTruthy()
  })

  it('termo só de espaços vale como busca vazia', () => {
    montar()
    buscar('   ')
    expect(listados()).toEqual([137, 1370, 2137])
  })
})

describe('ClientesPage — lista', () => {
  it('carregando, avisa em vez de dizer que não há clientes', () => {
    simulado.clientes = estado([], { carregando: true })
    montar()
    expect(screen.getByText('Carregando os clientes deste aparelho…')).toBeTruthy()
  })

  it('sem nenhum cadastro, orienta a cadastrar — diferente de busca sem resultado', () => {
    simulado.clientes = estado([])
    montar()
    expect(screen.getByText('Nenhum cliente cadastrado ainda. Comece pelo botão “Novo cliente”.')).toBeTruthy()
    expect(screen.queryByText('Nenhum cliente encontrado para esta busca.')).toBeNull()
  })

  it('mostra endereço ou "Sem endereço", e marca o que ainda não subiu', () => {
    montar()
    const [joao, maria, zeca] = screen.getAllByRole('listitem')

    expect(within(joao).getByText('Rua das Flôres, 22')).toBeTruthy()
    expect(within(maria).getByText('Sem endereço')).toBeTruthy()
    expect(within(zeca).getByText('Pendente')).toBeTruthy()
    expect(within(joao).queryByText('Pendente')).toBeNull()
    expect(within(joao).getByText('JS')).toBeTruthy()
  })

  it('arquivados ficam fora até pedir, e o pedido só aparece se houver algum', () => {
    montar()
    expect(screen.queryByLabelText('Mostrar arquivados')).toBeNull()

    cleanup()
    simulado.clientes = estado([JOAO, ARQUIVADA])
    montar()
    expect(listados()).toEqual([137])

    fireEvent.click(screen.getByLabelText('Mostrar arquivados'))
    expect(listados()).toEqual([137, 40])
    expect(within(screen.getAllByRole('listitem')[1]).getByText('Arquivado')).toBeTruthy()

    buscar('rita')
    expect(listados()).toEqual([40])
  })

  it('o KPI de clientes conta só os ativos; pendentes e arquivados têm o seu', () => {
    simulado.clientes = estado([JOAO, ZECA, ARQUIVADA])
    montar()

    const kpi = (rotulo: string) => screen.getByText(rotulo, { selector: 'div' }).nextElementSibling?.textContent
    expect(kpi('Clientes')).toBe('2')
    expect(kpi('Alterações pendentes')).toBe('1')
    expect(kpi('Arquivados')).toBe('1')
  })

  it('sem arquivados, o KPI de arquivados não aparece', () => {
    montar()
    expect(screen.queryByText('Arquivados')).toBeNull()
  })
})

describe('ClientesPage — painel e navegação', () => {
  it('na tela larga, o painel abre com o primeiro cliente e troca no clique', () => {
    montar()
    expect(within(painel()).getByText('João da Silva')).toBeTruthy()
    expect(simulado.useCarne).toHaveBeenLastCalledWith('joao')

    fireEvent.click(screen.getByRole('button', { name: /Maria Souza/ }))

    expect(within(painel()).getByText('Maria Souza')).toBeTruthy()
    expect(simulado.useCarne).toHaveBeenLastCalledWith('maria')
    expect(screen.getByRole('button', { name: /Maria Souza/ }).className).toContain('ring-1')
    expect(screen.getByRole('button', { name: /João da Silva/ }).className).not.toContain('ring-1')
  })

  it('selecionado que sai da busca dá lugar ao primeiro resultado; sem resultado, sem painel', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /Zeca Lima/ }))

    buscar('maria')
    expect(within(painel()).getByText('Maria Souza')).toBeTruthy()

    buscar('ninguém')
    expect(document.querySelector('aside')).toBeNull()
  })

  it('o painel leva à página do cliente e arquiva sem pedir confirmação', () => {
    montar()

    fireEvent.click(within(painel()).getByRole('button', { name: 'Arquivar cliente' }))
    expect(simulado.clientes.alternarArquivo).toHaveBeenCalledWith(JOAO)

    fireEvent.click(within(painel()).getByRole('link', { name: /Abrir página do cliente/ }))
    expect(screen.getByText('página do cliente joao')).toBeTruthy()
  })

  it('no celular não há painel, nem os listeners do carnê; o clique abre a página', () => {
    simulado.larga = false
    montar()

    expect(document.querySelector('aside')).toBeNull()
    expect(simulado.useCarne).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Maria Souza/ }))
    expect(screen.getByText('página do cliente maria')).toBeTruthy()
  })
})

describe('ClientesPage — avisos e diálogos', () => {
  it('erro de leitura aparece no topo', () => {
    simulado.clientes = estado([], { erro: 'Sem permissão para ler os clientes.' })
    montar()
    expect(screen.getByText('Sem permissão para ler os clientes.')).toBeTruthy()
  })

  it('cada escrita recusada aparece e pode ser dispensada', () => {
    simulado.clientes = estado([JOAO], {
      falhas: [
        { id: 'falha-1', mensagem: 'O cliente 40 — Rita foi recusado.', quando: new Date() },
        { id: 'falha-2', mensagem: 'Não foi possível arquivar João.', quando: new Date() },
      ],
    })
    montar()

    expect(screen.getAllByText('Uma escrita foi recusada')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Entendi' })[1])
    expect(simulado.clientes.descartarFalha).toHaveBeenCalledWith('falha-2')
  })

  it('"Novo cliente" abre o cadastro, e cancelar desmonta o formulário', () => {
    montar()

    fireEvent.click(screen.getByRole('button', { name: 'Novo cliente' }))
    const dialogo = document.querySelector('dialog[open]') as HTMLElement
    expect(within(dialogo).getByText('Novo cliente')).toBeTruthy()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(document.querySelector('dialog')).toBeNull()
  })

  it('"Exportar" abre a exportação, e fechar desmonta — com ela, o listener do carnê inteiro', () => {
    montar()

    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(screen.getByText('Exportar clientes')).toBeTruthy()

    // O X do topo e o botão do rodapé fecham igual; aqui, o do rodapé.
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' }).at(-1) as HTMLElement)
    expect(screen.queryByText('Exportar clientes')).toBeNull()
  })
})

describe('Ficha do cliente no painel', () => {
  it('só mostra os dados que existem', () => {
    simulado.clientes = estado([MARIA])
    montar()
    const aside = painel()

    expect(within(aside).getByText('CPF')).toBeTruthy()
    expect(within(aside).getByText('529.982.247-25')).toBeTruthy()
    expect(within(aside).getByText('03/09/2026')).toBeTruthy()
    expect(within(aside).queryByText('Contato')).toBeNull()
    expect(within(aside).queryByText('Endereço')).toBeNull()
    expect(within(aside).queryByText('Observação')).toBeNull()
  })

  it('com tudo preenchido, mostra contato, endereço e observação', () => {
    simulado.clientes = estado([{ ...JOAO, observacao: 'Prefere visita de manhã' }])
    montar()
    const aside = painel()

    expect(within(aside).getByText('(11) 98888-7777')).toBeTruthy()
    expect(within(aside).getByText('Rua das Flôres, 22')).toBeTruthy()
    expect(within(aside).getByText('Prefere visita de manhã')).toBeTruthy()
    expect(within(aside).getByText('#137')).toBeTruthy()
  })

  it('cliente arquivado oferece desarquivar', () => {
    simulado.clientes = estado([ARQUIVADA])
    montar()
    fireEvent.click(screen.getByLabelText('Mostrar arquivados'))

    fireEvent.click(within(painel()).getByRole('button', { name: 'Desarquivar cliente' }))
    expect(simulado.clientes.alternarArquivo).toHaveBeenCalledWith(ARQUIVADA)
  })
})
