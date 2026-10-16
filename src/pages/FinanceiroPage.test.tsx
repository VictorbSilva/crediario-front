// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarneDaEmpresa } from '@/data/useCarneDaEmpresa'
import { formatarCentavos } from '@/lib/dinheiro'
import type { DocumentoExportavel } from '@/lib/exportacao'
import type { Cliente } from '@/types/cliente'
import { FinanceiroPage } from './FinanceiroPage'

const simulado = vi.hoisted(() => ({
  carne: {} as CarneDaEmpresa,
  pedidas: [] as unknown[],
  clientes: [] as Cliente[],
}))

vi.mock('@/data/useCarneDaEmpresa', () => ({
  useCarneDaEmpresa: (colecoes: unknown) => {
    simulado.pedidas.push(colecoes)
    return simulado.carne
  },
}))
vi.mock('@/data/useClientes', () => ({ useClientes: () => ({ clientes: simulado.clientes }) }))

// O `getByText` normaliza o espaço não separável do Intl na página, não na string procurada.
const reais = (centavos: number) => formatarCentavos(centavos).replace(/\s/g, ' ')

function cliente(id: string, numero: number, nome: string, extras: Partial<Cliente> = {}): Cliente {
  return {
    id, numero, nome, nomeBusca: nome.toLowerCase(), cadastradoEm: '2026-08-01', criadoEm: null,
    atualizadoEm: null, atualizadoPor: 'x', pendente: false, ...extras,
  }
}

const CLIENTES = [
  cliente('ana', 12, 'Ana Lima'),
  cliente('bia', 13, 'Bia Souza', { arquivado: true }),
  cliente('caio', 14, 'Caio Reis'),
]

function venda(id: string, dados: Record<string, unknown>): DocumentoExportavel {
  return { id, dados: { versaoCalculo: 1, ...dados } }
}

function pagamento(id: string, dados: Record<string, unknown>): DocumentoExportavel {
  return { id, dados: { cancelado: false, ...dados } }
}

// Em 15/10/2026 (contas no texto da tarefa):
//  v1 Ana  3×100 vencendo 10/09, 10/10, 10/11; pagou 100 + 50 → a 2ª vencida com 50 em aberto
//  v2 Bia  2×100 vencendo 20/09, 20/10; pagamento só de encargo → a 1ª vencida inteira
//  v3 fora do cache  1×100 vencida em 05/08
//  v6 Caio 2×50 vencendo 30/10, 30/11; pagou 20 → a 1ª parcial
//  v4 cancelada e v5 de versão 2 ficam fora de tudo
const VENDAS = [
  venda('v1', { clientId: 'ana', dataVenda: '2026-08-20', valorTotalCentavos: 30000, numeroParcelas: 3, diaVencimento: 10 }),
  venda('v2', { clientId: 'bia', dataVenda: '2026-08-01', valorTotalCentavos: 20000, numeroParcelas: 2, diaVencimento: 20 }),
  venda('v3', { clientId: 'fantasma', dataVenda: '2026-07-01', valorTotalCentavos: 10000, numeroParcelas: 1, diaVencimento: 5 }),
  venda('v4', { clientId: 'ana', dataVenda: '2026-06-01', valorTotalCentavos: 50000, numeroParcelas: 5, diaVencimento: 1, cancelada: true }),
  venda('v5', { clientId: 'caio', dataVenda: '2026-09-01', valorTotalCentavos: 99900, numeroParcelas: 12, diaVencimento: 15, versaoCalculo: 2 }),
  venda('v6', { clientId: 'caio', dataVenda: '2026-09-25', valorTotalCentavos: 10000, numeroParcelas: 2, diaVencimento: 30 }),
]
const PAGAMENTOS = [
  pagamento('pg1', { clientId: 'ana', saleId: 'v1', data: '2026-09-12', valorCentavos: 10000 }),
  pagamento('pg2', { clientId: 'ana', saleId: 'v1', data: '2026-10-03', valorCentavos: 5000 }),
  pagamento('pg3', { clientId: 'ana', saleId: 'v1', data: '2026-10-08', valorCentavos: 3000, cancelado: true }),
  pagamento('pg4', { clientId: 'bia', saleId: 'v2', data: '2026-10-14', valorCentavos: 1000, encargoCentavos: 1000 }),
  pagamento('pg5', { clientId: 'caio', saleId: 'v6', data: '2026-10-05', valorCentavos: 2000 }),
]

function carne(extras: Partial<CarneDaEmpresa> = {}): CarneDaEmpresa {
  return {
    vendas: VENDAS, parcelas: [], pagamentos: PAGAMENTOS, carregando: false, pendentes: 0,
    confianca: 'confiavel', erro: null, ...extras,
  }
}

function Pagina() {
  return (
    <MemoryRouter>
      <FinanceiroPage />
    </MemoryRouter>
  )
}

function kpi(rotulo: string): HTMLElement {
  const elemento = screen.getByText(rotulo, { selector: 'div' }).nextElementSibling
  if (!(elemento instanceof HTMLElement)) throw new Error(`Sem KPI ${rotulo}`)
  return elemento
}

function lista(titulo: string): HTMLElement[] {
  const secao = screen.getByRole('heading', { name: titulo }).closest('section') as HTMLElement
  return within(secao).queryAllByRole('listitem')
}

function escolherMes(valor: string) {
  fireEvent.change(screen.getByLabelText('Mês de recebimento'), { target: { value: valor } })
}

function buscar(termo: string) {
  fireEvent.change(screen.getByLabelText('Buscar por nome ou número'), { target: { value: termo } })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 12))
  simulado.carne = carne()
  simulado.pedidas = []
  simulado.clientes = CLIENTES
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('FinanceiroPage — leitura', () => {
  it('ouve só vendas e pagamentos, sempre com a mesma lista, para não refazer os listeners', () => {
    const { rerender } = render(<Pagina />)
    rerender(<Pagina />)

    expect(simulado.pedidas[0]).toEqual(['sales', 'payments'])
    expect(simulado.pedidas[1]).toBe(simulado.pedidas[0])
  })

  it('enquanto a confiança é desconhecida, mostra carregando em vez de números', () => {
    simulado.carne = carne({ confianca: 'desconhecida' })
    render(<Pagina />)

    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(screen.queryByText('A receber', { selector: 'div' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Clientes em atraso' })).toBeNull()
  })

  it('erro de leitura aparece no topo', () => {
    simulado.carne = carne({ erro: 'Não foi possível carregar o carnê da empresa.' })
    render(<Pagina />)

    expect(screen.getByText('Não foi possível carregar o carnê da empresa.')).toBeTruthy()
  })

  it('dado parcial e venda de versão nova avisam que os números estão abaixo do real', () => {
    simulado.carne = carne({ confianca: 'parcial' })
    render(<Pagina />)

    expect(screen.getByText(/ainda não baixou todas as vendas e pagamentos/)).toBeTruthy()
    expect(screen.getByText(/^1 venda\(s\) foram lançadas por uma versão mais nova do app/)).toBeTruthy()
  })

  it('sem venda de versão nova nem dado parcial, nenhum dos dois avisos', () => {
    simulado.carne = carne({ vendas: VENDAS.filter((v) => v.id !== 'v5') })
    render(<Pagina />)

    expect(screen.queryByText(/versão mais nova/)).toBeNull()
    expect(screen.queryByText(/ainda não baixou/)).toBeNull()
  })
})

describe('FinanceiroPage — números', () => {
  it('a receber e vencido são o combinado, sem encargos; cancelada e versão nova ficam fora', () => {
    render(<Pagina />)

    expect(kpi('A receber').textContent).toBe(formatarCentavos(53000))
    expect(kpi('Vencido').textContent).toBe(formatarCentavos(25000))
    expect(kpi('Vencido').className).toContain('text-danger')
  })

  it('recebido no mês é o dinheiro que entrou, encargo incluído, sem o cancelado nem o de setembro', () => {
    render(<Pagina />)

    expect(kpi('Recebido no mês').textContent).toBe(formatarCentavos(8000))
  })

  it('sem nada vencido, o KPI de vencido não fica vermelho', () => {
    simulado.carne = carne({ vendas: [VENDAS[5]], pagamentos: [] })
    render(<Pagina />)

    expect(kpi('Vencido').textContent).toBe(formatarCentavos(0))
    expect(kpi('Vencido').className).toContain('text-slate-900')
  })
})

describe('FinanceiroPage — clientes em atraso', () => {
  it('ordena por dias de atraso, com o cliente fora do cache no fim e sem link', () => {
    render(<Pagina />)
    const [bia, ana, fantasma] = lista('Clientes em atraso')

    expect(lista('Clientes em atraso')).toHaveLength(3)
    expect(bia.textContent).toContain('Bia Souza')
    expect(within(bia).getByText('Vencido desde 20/09/2026 · 25 dia(s)')).toBeTruthy()
    expect(within(bia).getByText('Arquivado')).toBeTruthy()
    expect(within(bia).getByRole('link').getAttribute('href')).toBe('/clientes/bia')
    expect(within(bia).getByText(reais(10000))).toBeTruthy()

    expect(within(ana).getByText('Vencido desde 10/10/2026 · 5 dia(s)')).toBeTruthy()
    expect(within(ana).getByText(reais(5000))).toBeTruthy()
    expect(within(ana).queryByText('Arquivado')).toBeNull()

    expect(within(fantasma).getByText('Cliente não encontrado neste aparelho')).toBeTruthy()
    expect(within(fantasma).getByText('Vencido desde 05/08/2026 · 71 dia(s)')).toBeTruthy()
    expect(within(fantasma).queryByRole('link')).toBeNull()
    expect(fantasma.textContent).not.toContain('#')
  })

  it('cliente em dia não entra na lista de atraso', () => {
    render(<Pagina />)

    expect(lista('Clientes em atraso').some((li) => li.textContent?.includes('Caio'))).toBe(false)
  })

  it('sem atraso nenhum, diz isso', () => {
    simulado.carne = carne({ vendas: [], pagamentos: [] })
    render(<Pagina />)

    expect(screen.getByText('Nenhum cliente em atraso.')).toBeTruthy()
    expect(screen.getByText('Nenhuma parcela a receber neste mês.')).toBeTruthy()
  })
})

describe('FinanceiroPage — a receber no mês', () => {
  it('o seletor vai do mês atual ao do último vencimento, sem meses passados', () => {
    render(<Pagina />)
    const opcoes = within(screen.getByLabelText('Mês de recebimento')).getAllByRole('option')

    expect(opcoes.map((o) => [o.getAttribute('value'), o.textContent])).toEqual([
      ['2026-10', 'Outubro de 2026'],
      ['2026-11', 'Novembro de 2026'],
    ])
    expect((screen.getByLabelText('Mês de recebimento') as HTMLSelectElement).value).toBe('2026-10')
  })

  it('outubro lista o que falta de cada parcela, em ordem de vencimento, com a situação', () => {
    render(<Pagina />)
    const [ana, bia, caio] = lista('A receber em Outubro de 2026')

    expect(kpi('A receber em Outubro de 2026').textContent).toBe(formatarCentavos(18000))
    expect(within(ana).getByText('Parcela 2/3 · vence 10/10/2026')).toBeTruthy()
    expect(within(ana).getByText(reais(5000))).toBeTruthy()
    expect(within(ana).getByText('Vencida').className).toContain('text-danger')

    expect(within(bia).getByText('Parcela 2/2 · vence 20/10/2026')).toBeTruthy()
    expect(within(bia).getByText('A vencer').className).toContain('text-slate-600')
    expect(within(bia).getByText('Arquivado')).toBeTruthy()

    expect(within(caio).getByText('Parcela 1/2 · vence 30/10/2026')).toBeTruthy()
    expect(within(caio).getByText(reais(3000))).toBeTruthy()
    expect(within(caio).getByText('Parcial').className).toContain('text-warning')
    expect(within(caio).getByRole('link').getAttribute('href')).toBe('/clientes/caio')
  })

  it('trocar o mês muda a lista e o KPI do mês, e só eles', () => {
    render(<Pagina />)

    escolherMes('2026-11')

    expect(lista('A receber em Novembro de 2026').map((li) => li.textContent?.match(/Parcela \S+/)?.[0])).toEqual([
      'Parcela 3/3', 'Parcela 2/2',
    ])
    expect(kpi('A receber em Novembro de 2026').textContent).toBe(formatarCentavos(15000))
    expect(kpi('A receber').textContent).toBe(formatarCentavos(53000))
    expect(kpi('Vencido').textContent).toBe(formatarCentavos(25000))
    expect(kpi('Recebido no mês').textContent).toBe(formatarCentavos(8000))
  })

  it('se o mês escolhido some das opções, volta para o primeiro', () => {
    const { rerender } = render(<Pagina />)
    escolherMes('2026-11')

    // As vendas que venciam em novembro foram canceladas em outro aparelho.
    simulado.carne = carne({ vendas: [VENDAS[1], VENDAS[2]] })
    rerender(<Pagina />)

    expect((screen.getByLabelText('Mês de recebimento') as HTMLSelectElement).value).toBe('2026-10')
    expect(screen.getByRole('heading', { name: 'A receber em Outubro de 2026' })).toBeTruthy()
  })

  it('venda em 13 vezes: outubro de 2027 é outro mês que outubro de 2026, e janeiro tem valor 01', () => {
    const treze = venda('v8', { clientId: 'ana', dataVenda: '2026-09-15', valorTotalCentavos: 130000, numeroParcelas: 13, diaVencimento: 5 })
    simulado.carne = carne({ vendas: [treze], pagamentos: [] })
    render(<Pagina />)
    const seletor = screen.getByLabelText('Mês de recebimento') as HTMLSelectElement

    const valores = within(seletor).getAllByRole('option').map((o) => o.getAttribute('value'))
    expect(valores).toEqual([
      '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05',
      '2027-06', '2027-07', '2027-08', '2027-09', '2027-10',
    ])

    escolherMes('2027-01')
    expect(seletor.value).toBe('2027-01')
    expect(screen.getByRole('heading', { name: 'A receber em Janeiro de 2027' })).toBeTruthy()
    expect(lista('A receber em Janeiro de 2027')[0].textContent).toContain('Parcela 4/13 · vence 05/01/2027')

    // O mês se repete na lista: escolher o de 2027 não pode abrir o de 2026.
    escolherMes('2027-10')
    expect(seletor.value).toBe('2027-10')
    expect(lista('A receber em Outubro de 2027')[0].textContent).toContain('Parcela 13/13')
  })

  it('parcela de cliente fora do cache aparece sem link e depois das de cliente conhecido', () => {
    const mesmaData = venda('v7', { clientId: 'fantasma', dataVenda: '2026-08-20', valorTotalCentavos: 4000, numeroParcelas: 2, diaVencimento: 10 })
    simulado.carne = carne({ vendas: [mesmaData, VENDAS[0]], pagamentos: [] })
    render(<Pagina />)
    const itens = lista('A receber em Outubro de 2026')

    expect(itens.map((li) => (li.textContent?.includes('Ana') ? 'ana' : 'fantasma'))).toEqual(['ana', 'fantasma'])
    expect(within(itens[1]).getByText('Cliente não encontrado neste aparelho')).toBeTruthy()
    expect(within(itens[1]).queryByRole('link')).toBeNull()
  })
})

describe('FinanceiroPage — busca', () => {
  it('filtra as duas listas por nome sem acento nem caixa, sem mexer nos KPIs', () => {
    render(<Pagina />)

    buscar('BIÁ')

    expect(lista('Clientes em atraso').map((li) => li.textContent?.includes('Bia'))).toEqual([true])
    expect(lista('A receber em Outubro de 2026')).toHaveLength(1)
    expect(kpi('A receber').textContent).toBe(formatarCentavos(53000))
    expect(kpi('A receber em Outubro de 2026').textContent).toBe(formatarCentavos(18000))
  })

  it('casa pelo número, e cada lista diz quando a busca não achou nada nela', () => {
    render(<Pagina />)

    buscar('14')

    expect(screen.getByText('Nenhum cliente em atraso com esse nome ou número.')).toBeTruthy()
    expect(lista('A receber em Outubro de 2026')).toHaveLength(1)
    expect(lista('A receber em Outubro de 2026')[0].textContent).toContain('Caio Reis')
  })

  it('com termo, cliente fora do cache não aparece em nenhuma das listas, e a tela não quebra', () => {
    // v7 põe uma parcela do cliente desconhecido no mês aberto, além do atraso de agosto (v3).
    const deOutubro = venda('v7', { clientId: 'fantasma', dataVenda: '2026-09-02', valorTotalCentavos: 4000, numeroParcelas: 1, diaVencimento: 25 })
    simulado.carne = carne({ vendas: [...VENDAS, deOutubro] })
    render(<Pagina />)
    expect(lista('A receber em Outubro de 2026').some((li) => li.textContent?.includes('Cliente não encontrado'))).toBe(true)

    buscar('fantasma')

    expect(lista('Clientes em atraso')).toHaveLength(0)
    expect(screen.getByText('Nenhuma parcela a receber com esse nome ou número.')).toBeTruthy()
  })

  it('termo só de espaços não filtra', () => {
    render(<Pagina />)

    buscar('   ')

    expect(lista('Clientes em atraso')).toHaveLength(3)
    expect(lista('A receber em Outubro de 2026')).toHaveLength(3)
  })
})
