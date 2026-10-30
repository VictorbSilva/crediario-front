// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientesContextValue } from '@/data/clientes-context'
import type { CarneDaEmpresa } from '@/data/useCarneDaEmpresa'
import type { DocumentoExportavel } from '@/lib/exportacao'
import { instalarDialogo } from '@/test/dialogo'
import type { Cliente } from '@/types/cliente'
import { ClientesPage } from './ClientesPage'

const simulado = vi.hoisted(() => ({
  larga: true,
  clientes: {} as ClientesContextValue,
  useCarne: vi.fn(),
  carneDaEmpresa: {} as CarneDaEmpresa,
  useCarneDaEmpresa: vi.fn(),
}))

vi.mock('@/data/useClientes', () => ({ useClientes: () => simulado.clientes }))
vi.mock('@/components/layout/useTelaLarga', () => ({ useTelaLarga: () => simulado.larga }))
vi.mock('@/data/useCarne', () => ({ useCarne: simulado.useCarne }))
vi.mock('@/data/useCarneDaEmpresa', () => ({
  CARNE_COMPLETO: ['sales', 'installments', 'payments'],
  useCarneDaEmpresa: simulado.useCarneDaEmpresa,
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

function venda(id: string, clientId: string, dataVenda: string, extras = {}): DocumentoExportavel {
  return {
    id,
    dados: {
      clientId, dataVenda, valorTotalCentavos: 10_000, numeroParcelas: 1,
      diaVencimento: 10, versaoCalculo: 1, ...extras,
    },
  }
}

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
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 30, 12))
  instalarDialogo()
  simulado.larga = true
  simulado.clientes = estado([JOAO, MARIA, ZECA])
  simulado.useCarne.mockReset().mockReturnValue({ carnes: [], carregando: false, erro: null })
  simulado.carneDaEmpresa = {
    vendas: [], parcelas: [], pagamentos: [], carregando: false, pendentes: 0,
    confianca: 'confiavel', erro: null,
  }
  simulado.useCarneDaEmpresa.mockReset().mockImplementation(() => simulado.carneDaEmpresa)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
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

  it('conta ativos, alterações pendentes e arquivados, com os dois últimos sem filtro', () => {
    simulado.clientes = estado([JOAO, ZECA, ARQUIVADA])
    montar()

    expect(screen.getByRole('button', { name: 'Clientes 2' })).toBeTruthy()
    const pendentes = screen.getByText('Alterações pendentes')
    const arquivados = screen.getByText('Arquivados')
    expect(pendentes.nextElementSibling?.textContent).toBe('1')
    expect(pendentes.nextElementSibling?.classList.contains('text-brand-600')).toBe(true)
    expect(arquivados.nextElementSibling?.textContent).toBe('1')
    expect(pendentes.closest('button')).toBeNull()
    expect(arquivados.closest('button')).toBeNull()
  })

  it('sem arquivados, o KPI de arquivados não aparece', () => {
    montar()
    expect(screen.queryByText('Arquivados')).toBeNull()
  })
})

describe('ClientesPage — contadores e filtros', () => {
  beforeEach(() => {
    simulado.clientes = estado([JOAO, MARIA, ZECA, ARQUIVADA])
    simulado.carneDaEmpresa.vendas = [
      venda('vencida', 'joao', '2026-08-10'),
      venda('recente', 'maria', '2026-09-10'),
      venda('arquivada', 'rita', '2026-08-10'),
      venda('ausente', 'ausente', '2026-08-10'),
    ]
    simulado.carneDaEmpresa.pagamentos = [{
      id: 'pago', dados: { clientId: 'maria', saleId: 'recente', data: '2026-10-01', valorCentavos: 10_000 },
    }]
  })

  it.each([true, false])('não ouve coleções inteiras ao abrir a lista (tela larga: %s)', (larga) => {
    simulado.larga = larga
    montar()
    expect(simulado.useCarneDaEmpresa).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Com vendas —' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Em atraso —' })).toBeTruthy()
    buscar('joao')
    expect(simulado.useCarneDaEmpresa).not.toHaveBeenCalled()
  })

  it.each(['Com vendas', 'Em atraso'])('ouve só sales e payments ao solicitar %s, com referência estável', (rotulo) => {
    montar()
    expect(simulado.useCarneDaEmpresa).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: `${rotulo} —` }))
    expect(simulado.useCarneDaEmpresa).toHaveBeenCalledWith(['sales', 'payments'])
    const colecoes = simulado.useCarneDaEmpresa.mock.calls[0][0]
    buscar('joao')
    for (const [pedidas] of simulado.useCarneDaEmpresa.mock.calls) {
      expect(pedidas).toBe(colecoes)
    }
    // Sair e reabrir a rota não solicita os dados sem um novo toque.
    cleanup()
    simulado.useCarneDaEmpresa.mockClear()
    montar()
    expect(simulado.useCarneDaEmpresa).not.toHaveBeenCalled()
  })

  it('mostra os três números e filtra os vencidos, mantendo a busca', () => {
    montar()
    const todos = screen.getByRole('button', { name: 'Clientes 3' })
    expect(todos.getAttribute('aria-pressed')).toBe('true')
    expect(todos.classList.contains('ring-2')).toBe(true)
    expect(within(todos).getByText('3').classList.contains('text-slate-900')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Com vendas —' }))
    expect(screen.getByRole('button', { name: 'Com vendas 2' })).toBeTruthy()
    const atrasados = screen.getByRole('button', { name: 'Em atraso 1' })
    fireEvent.click(atrasados)
    expect(atrasados.getAttribute('aria-pressed')).toBe('true')
    expect(atrasados.classList.contains('ring-2')).toBe(true)
    expect(atrasados.classList.contains('ring-brand-600')).toBe(true)
    expect(within(atrasados).getByText('1').classList.contains('text-slate-900')).toBe(true)
    expect(todos.classList.contains('ring-2')).toBe(false)
    expect(listados()).toEqual([137])
    expect(screen.queryByLabelText('Mostrar arquivados')).toBeNull()
    buscar('maria')
    expect(listados()).toEqual([])
    buscar('')
    fireEvent.click(screen.getByRole('button', { name: 'Com vendas 2' }))
    expect(listados()).toEqual([137, 1370])
  })

  it('mostrar arquivados vale só em Clientes, sem alterar os contadores', () => {
    montar()
    fireEvent.click(screen.getByLabelText('Mostrar arquivados'))
    expect(listados()).toEqual([137, 1370, 2137, 40])
    fireEvent.click(screen.getByRole('button', { name: 'Com vendas —' }))
    expect(listados()).toEqual([137, 1370])
    fireEvent.click(screen.getByRole('button', { name: 'Clientes 3' }))
    expect(listados()).toEqual([137, 1370, 2137, 40])
  })

  it('ordena atrasados por dias, valor vencido e número como o Financeiro', () => {
    simulado.carneDaEmpresa.pagamentos = []
    simulado.carneDaEmpresa.vendas = [
      venda('joao', 'joao', '2026-08-10'),
      venda('maria', 'maria', '2026-07-10'),
      venda('zeca', 'zeca', '2026-07-10', { valorTotalCentavos: 20_000 }),
    ]
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Em atraso —' }))
    expect(screen.getByRole('button', { name: 'Em atraso 3' })).toBeTruthy()
    expect(listados()).toEqual([2137, 1370, 137])
  })

  it('confiança desconhecida mostra traços e desabilita os filtros financeiros', () => {
    simulado.carneDaEmpresa.confianca = 'desconhecida'
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Com vendas —' }))
    expect(simulado.useCarneDaEmpresa).toHaveBeenCalledWith(['sales', 'payments'])
    for (const rotulo of ['Com vendas —', 'Em atraso —']) {
      const botao = screen.getByRole('button', { name: rotulo }) as HTMLButtonElement
      expect(botao.disabled).toBe(true)
      fireEvent.click(botao)
    }
    expect(screen.getByText('Carregando os clientes deste aparelho…')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clientes 3' }))
    expect(listados()).toEqual([137, 1370, 2137])
  })

  it('confiança parcial mostra os números e o aviso; erro do carnê também aparece', () => {
    simulado.carneDaEmpresa.confianca = 'parcial'
    simulado.carneDaEmpresa.erro = 'Não foi possível carregar o carnê da empresa.'
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Com vendas —' }))
    expect(screen.getByRole('button', { name: 'Em atraso 1' })).toBeTruthy()
    expect(screen.getByText(/Este aparelho ainda não baixou todas as vendas e pagamentos/)).toBeTruthy()
    expect(screen.getByText('Não foi possível carregar o carnê da empresa.')).toBeTruthy()
  })

  it('lista vazia explica o filtro aplicado', () => {
    simulado.carneDaEmpresa.vendas = []
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Em atraso —' }))
    expect(screen.getByText('Nenhum cliente em atraso.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Com vendas 0' }))
    expect(screen.getByText('Nenhum cliente com vendas.')).toBeTruthy()
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
