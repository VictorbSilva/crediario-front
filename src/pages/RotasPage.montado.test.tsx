// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { KeyboardSensor, MouseSensor, TouchSensor } from '@dnd-kit/core'
import type { DndContext } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientesContextValue } from '@/data/clientes-context'
import type { Cliente } from '@/types/cliente'
import { RotasPage } from './RotasPage'

// O `RotasPage.test.ts` cobre a virada do mês sem montar nada. Aqui a página monta,
// e o DndContext de verdade é embrulhado só para guardar as props que a página passa:
// o arraste em si é da biblioteca; o que se testa é o que a página grava ao soltar.

type PropsDoDnd = ComponentProps<typeof DndContext>

const simulado = vi.hoisted(() => ({
  clientes: {} as ClientesContextValue,
  dnd: null as unknown,
}))

vi.mock('@/data/useClientes', () => ({ useClientes: () => simulado.clientes }))
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@dnd-kit/core')>()
  const { createElement } = await import('react')
  return {
    ...real,
    DndContext: (props: ComponentProps<typeof real.DndContext>) => {
      simulado.dnd = props
      return createElement(real.DndContext, props)
    },
  }
})

// `rotaDesde` é gravado pelo cadastro junto com os dias de visita. Sem ele, um dia do mês
// anterior que já passou contaria como visita perdida.
function cliente(id: string, numero: number, nome: string, extras: Partial<Cliente> = {}): Cliente {
  return {
    id, numero, nome, nomeBusca: nome.toLowerCase(), cadastradoEm: '2026-08-01', criadoEm: null,
    atualizadoEm: null, atualizadoPor: 'x', pendente: false, rotaDesde: '2026-10-01', ...extras,
  }
}

const HOJE = '2026-10-15'
const ANA = cliente('ana', 12, 'Ana Lima', { diasDeVisita: [15, 20], endereco: 'Rua A, 10' })
const BIA = cliente('bia', 13, 'Bia Souza', {
  diasDeVisita: [15], ordemPorDia: { '15': 500 }, ultimoVisitado: HOJE, ultimaMarca: 'visitado', ultimaMarcaEm: HOJE,
})
const CAIO = cliente('caio', 14, 'Caio Reis', { diasDeVisita: [15], ultimaMarca: 'ausente', ultimaMarcaEm: HOJE })
const DAVI = cliente('davi', 15, 'Davi Melo', { diasDeVisita: [10] })
const EVA = cliente('eva', 16, 'Eva Nunes', { diasDeVisita: [10], ultimoVisitado: '2026-10-10' })
const FABI = cliente('fabi', 17, 'Fabi Arquivada', { diasDeVisita: [15], arquivado: true })
const GIL = cliente('gil', 18, 'Gil Prado', { diasDeVisita: [20], pendente: true })
const TODOS = [ANA, BIA, CAIO, DAVI, EVA, FABI, GIL]

function estado(clientes: Cliente[], extras: Partial<ClientesContextValue> = {}): ClientesContextValue {
  return {
    clientes, ativos: clientes, arquivados: [], carregando: false, erro: null, pendentes: 0,
    doCache: false, estadoSync: 'sincronizado', confianca: 'confiavel', falhas: [],
    descartarFalha: vi.fn(), criarCliente: vi.fn(), editarCliente: vi.fn(() => true),
    alternarArquivo: vi.fn(), marcarNaRota: vi.fn(), reordenarRota: vi.fn(), ...extras,
  }
}

function montar() {
  return render(
    <MemoryRouter>
      <RotasPage />
    </MemoryRouter>,
  )
}

function dnd(): PropsDoDnd {
  if (!simulado.dnd) throw new Error('DndContext não montou')
  return simulado.dnd as PropsDoDnd
}

/** Os itens da rota na ordem da tela, com o separador onde ele estiver. */
function ordem(): string[] {
  return screen.getAllByRole('listitem').map((li) =>
    li.textContent?.startsWith('Visitas de dias anteriores')
      ? '— atrasados —'
      : (/· (\S+)/.exec(li.textContent ?? '')?.[1] ?? '?'),
  )
}

function item(nome: string): HTMLElement {
  const li = screen.getAllByRole('listitem').find((el) => el.textContent?.includes(nome))
  if (!li) throw new Error(`Sem ${nome} na rota`)
  return li
}

function kpi(rotulo: string): string | null | undefined {
  return screen.getByText(rotulo, { selector: 'div' }).nextElementSibling?.textContent
}

function soltar(ativo: string, sobre: string | null) {
  act(() => {
    dnd().onDragEnd?.({ active: { id: ativo }, over: sobre === null ? null : { id: sobre } } as never)
  })
}

function escolherDia(rotulo: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: rotulo }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 9))
  simulado.clientes = estado(TODOS)
  simulado.dnd = null
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('RotasPage — rota de hoje', () => {
  it('ordena pela chave do dia, com o separador antes das visitas de dias anteriores', () => {
    montar()

    expect(screen.getByRole('heading', { name: 'Rota de hoje · 15/10/2026' })).toBeTruthy()
    // Eva visitou na data agendada (fora da rota); Fabi está arquivada.
    expect(ordem()).toEqual(['Bia', 'Ana', 'Caio', '— atrasados —', 'Davi'])
  })

  it('os KPIs contam a rota de hoje, e "atrasado" é visita, não parcela', () => {
    montar()

    expect(kpi('Na rota')).toBe('4')
    expect(kpi('Visitados')).toBe('1')
    expect(kpi('Ausentes')).toBe('1')
    expect(kpi('Visitas atrasadas')).toBe('1')
    expect(within(item('Davi')).getByText('Visita pendente desde 10/10/2026')).toBeTruthy()
  })

  it('cada situação oferece só as marcas que fazem sentido, e cada marca grava a ação certa', () => {
    montar()
    const botoes = (nome: string) => within(item(nome)).getAllByRole('button').map((b) => b.textContent).filter(Boolean)

    expect(botoes('Bia')).toEqual(['Desmarcar'])
    expect(botoes('Ana')).toEqual(['Visitado', 'Ausente'])
    expect(botoes('Caio')).toEqual(['Visitado', 'Desmarcar'])
    expect(botoes('Davi')).toEqual(['Visitado', 'Ausente'])

    fireEvent.click(within(item('Ana')).getByRole('button', { name: 'Visitado' }))
    fireEvent.click(within(item('Ana')).getByRole('button', { name: 'Ausente' }))
    fireEvent.click(within(item('Bia')).getByRole('button', { name: 'Desmarcar' }))
    expect(simulado.clientes.marcarNaRota).toHaveBeenNthCalledWith(1, ANA, 'visitado')
    expect(simulado.clientes.marcarNaRota).toHaveBeenNthCalledWith(2, ANA, 'ausente')
    expect(simulado.clientes.marcarNaRota).toHaveBeenNthCalledWith(3, BIA, 'desmarcar')
  })

  it('dia do mês anterior que ficou sem marca entra como atrasado, mas só depois do rotaDesde', () => {
    const desdeSetembro = { ...GIL, rotaDesde: '2026-09-01' }
    simulado.clientes = estado([ANA, desdeSetembro, { ...DAVI, id: 'davi2', rotaDesde: '2026-10-12' }])
    montar()

    // Gil: 20/09 passou sem visita. Davi: o dia 10 é antes de entrar na rota, então não deve nada.
    expect(ordem()).toEqual(['Ana', '— atrasados —', 'Gil'])
    expect(within(item('Gil')).getByText('Visita pendente desde 20/09/2026')).toBeTruthy()
  })

  it('snapshot novo dos clientes atualiza a rota e os nomes anunciados', () => {
    const { rerender } = montar()
    const novo = cliente('hugo', 19, 'Hugo Dias', { diasDeVisita: [15] })

    simulado.clientes = estado([...TODOS, novo])
    rerender(<MemoryRouter><RotasPage /></MemoryRouter>)

    expect(ordem()).toEqual(['Bia', 'Ana', 'Caio', 'Hugo', '— atrasados —', 'Davi'])
    expect(dnd().accessibility?.announcements?.onDragStart({ active: { id: 'hugo' } as never })).toBe(
      'Pegou Hugo Dias. Posição 4 de 5.',
    )
  })

  it('cliente sem endereço aparece como "Sem endereço"', () => {
    montar()

    expect(within(item('Bia')).getByText('Sem endereço')).toBeTruthy()
    expect(within(item('Ana')).getByText('Rua A, 10')).toBeTruthy()
  })

  it('sem atrasado nenhum, não há separador', () => {
    simulado.clientes = estado([ANA, BIA])
    montar()

    expect(ordem()).toEqual(['Bia', 'Ana'])
  })

  it('carregando, ou dia sem ninguém, dizem isso em vez de mostrar uma lista vazia', () => {
    simulado.clientes = estado([], { carregando: true })
    montar()
    expect(screen.getByText('Carregando os clientes deste aparelho…')).toBeTruthy()

    cleanup()
    simulado.clientes = estado([GIL])
    montar()
    expect(screen.getByText('Nenhum cliente neste dia. Escolha os dias de visita no cadastro do cliente.')).toBeTruthy()
  })

  it('erro e escritas recusadas aparecem, e a recusa pode ser dispensada', () => {
    simulado.clientes = estado(TODOS, {
      erro: 'Não foi possível carregar a lista de clientes.',
      falhas: [{ id: 'falha-3', mensagem: 'Não foi possível salvar a nova ordem da rota.', quando: new Date() }],
    })
    montar()

    expect(screen.getByText('Não foi possível carregar a lista de clientes.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(simulado.clientes.descartarFalha).toHaveBeenCalledWith('falha-3')
  })
})

describe('RotasPage — calendário', () => {
  it('conta os clientes de cada data, sem os arquivados', () => {
    montar()

    expect(screen.getByRole('button', { name: '15 de outubro, hoje, 3 clientes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '10 de outubro, 2 clientes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '20 de outubro, 2 clientes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '21 de outubro, nenhum cliente' })).toBeTruthy()
  })

  it('outra data vira planejamento: sem marcas nem KPIs, com o aviso de que a ordem vale todo mês', () => {
    montar()

    escolherDia(/^20 de outubro/)

    expect(screen.getByRole('heading', { name: 'Rota de 20/10/2026' })).toBeTruthy()
    expect(ordem()).toEqual(['Ana', 'Gil'])
    expect(screen.getByText(/A ordem vale para este dia em todos os meses/)).toBeTruthy()
    expect(screen.queryByText('Na rota')).toBeNull()
    expect(within(item('Ana')).queryByRole('button', { name: 'Visitado' })).toBeNull()
    expect(within(item('Gil')).getByText('Pendente')).toBeTruthy()
  })

  it('escolher hoje de novo volta para a rota com marcas', () => {
    montar()
    escolherDia(/^20 de outubro/)

    escolherDia(/^15 de outubro/)

    expect(screen.getByRole('heading', { name: 'Rota de hoje · 15/10/2026' })).toBeTruthy()
    expect(kpi('Na rota')).toBe('4')
  })

  it('"hoje" escolhido no calendário acompanha a virada da meia-noite', () => {
    const { rerender } = montar()
    escolherDia(/^20 de outubro/)
    escolherDia(/^15 de outubro/)

    vi.setSystemTime(new Date(2026, 9, 16, 0, 5))
    rerender(<MemoryRouter><RotasPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Rota de hoje · 16/10/2026' })).toBeTruthy()
  })

  it('o calendário só mostra a contagem nos dias que têm cliente', () => {
    montar()

    expect(within(screen.getByRole('button', { name: '20 de outubro, 2 clientes' })).getByText('2')).toBeTruthy()
    expect(screen.getByRole('button', { name: '21 de outubro, nenhum cliente' }).textContent).toBe('21')
  })

  it('só dois meses: avançar abre o dia 1 do seguinte, voltar retorna à rota de hoje', () => {
    montar()
    const anterior = screen.getByRole('button', { name: 'Mês anterior' }) as HTMLButtonElement
    expect(anterior.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByText('Novembro de 2026')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Rota de 01/11/2026' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Próximo mês' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '20 de novembro, 2 clientes' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(screen.getByText('Outubro de 2026')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Rota de hoje · 15/10/2026' })).toBeTruthy()
  })
})

describe('RotasPage — próxima cobrança (E7)', () => {
  const HUGO = cliente('hugo', 19, 'Hugo Dias', { proximaCobranca: HOJE })
  const IVO = cliente('ivo', 20, 'Ivo Lopes', { proximaCobranca: '2026-10-12' })
  const JOAO = cliente('joao', 21, 'João Reis', { proximaCobranca: '2026-10-20' })
  const LIA = cliente('lia', 22, 'Lia Paz', { proximaCobranca: '2026-10-22' })

  it('na rota de hoje, a cobrança mostra "Cobrança marcada" e a atrasada só "Cobrança pendente desde"', () => {
    simulado.clientes = estado([ANA, HUGO, IVO])
    montar()

    expect(ordem()).toEqual(['Ana', 'Hugo', '— atrasados —', 'Ivo'])
    expect(within(item('Hugo')).getByText('Cobrança marcada')).toBeTruthy()
    expect(within(item('Hugo')).getByRole('button', { name: 'Arrastar Hugo Dias' })).toBeTruthy()
    expect(within(item('Ivo')).getByText('Cobrança pendente desde 12/10/2026')).toBeTruthy()
    expect(within(item('Ivo')).queryByText('Cobrança marcada')).toBeNull()
    expect(within(item('Ivo')).queryByText(/Visita pendente/)).toBeNull()
  })

  it('cliente de dia do mês continua com a alça e sem etiqueta de cobrança', () => {
    simulado.clientes = estado([ANA, HUGO, DAVI])
    montar()

    expect(within(item('Ana')).getByRole('button', { name: 'Arrastar Ana Lima' })).toBeTruthy()
    expect(within(item('Ana')).queryByText(/Cobrança/)).toBeNull()
    expect(within(item('Davi')).getByText('Visita pendente desde 10/10/2026')).toBeTruthy()
    expect(within(item('Davi')).queryByText(/Cobrança/)).toBeNull()
  })

  it('no calendário, a cobrança aparece em "Cobranças marcadas", depois da lista arrastável e sem alça', () => {
    simulado.clientes = estado([...TODOS, JOAO, { ...BIA, id: 'bia2', nome: 'Bia Dupla', diasDeVisita: [20], proximaCobranca: '2026-10-20' }])
    montar()

    escolherDia(/^20 de outubro, 4 clientes/)

    expect(ordem()).toEqual(['Ana', 'Bia', 'Gil', 'João'])
    const cobrancas = screen.getByRole('list', { name: 'Cobranças marcadas' })
    expect(within(cobrancas).getAllByRole('listitem')).toHaveLength(1)
    expect(within(cobrancas).getByText('Cobrança marcada')).toBeTruthy()
    expect(within(cobrancas).queryByRole('button', { name: /^Arrastar/ })).toBeNull()
    expect(within(item('Bia')).queryByText('Cobrança marcada')).toBeNull()
    expect(within(item('Ana')).getByRole('button', { name: 'Arrastar Ana Lima' })).toBeTruthy()
    expect(within(item('Ana')).queryByText('Cobrança marcada')).toBeNull()
    expect(screen.queryByText(/Nenhum cliente neste dia/)).toBeNull()

    // A lista de cobranças fica fora do arraste: soltar o João não grava nada.
    soltar('joao', 'ana')
    expect(simulado.clientes.reordenarRota).not.toHaveBeenCalled()
  })

  it('data só com cobrança mostra a lista, não "Nenhum cliente neste dia"', () => {
    simulado.clientes = estado([...TODOS, LIA])
    montar()

    escolherDia(/^22 de outubro, 1 cliente/)

    expect(ordem()).toEqual(['Lia'])
    expect(screen.getByRole('list', { name: 'Cobranças marcadas' })).toBeTruthy()
    expect(screen.queryByText(/Nenhum cliente neste dia/)).toBeNull()

    escolherDia(/^21 de outubro/)
    expect(screen.getByText(/Nenhum cliente neste dia/)).toBeTruthy()
    expect(screen.queryByText('Cobranças marcadas')).toBeNull()
  })
})

describe('RotasPage — soltar um arraste', () => {
  it('cliente do dia solto no bloco de atrasados para logo acima dele, numa escrita só', () => {
    montar()

    soltar('ana', 'davi')

    // Média entre Caio (1.000.014) e o teto BASE_ATRASADO: nunca entra na faixa dos atrasados.
    expect(simulado.clientes.reordenarRota).toHaveBeenCalledWith([
      { clienteId: 'ana', tipo: 'dia', dia: 15, valor: 500_500_007 },
    ])
  })

  it('atrasado solto no topo grava a ordem de hoje, que expira, e não a do dia', () => {
    montar()

    soltar('davi', 'bia')

    expect(simulado.clientes.reordenarRota).toHaveBeenCalledWith([
      { clienteId: 'davi', tipo: 'hoje', data: HOJE, valor: -500 },
    ])
  })

  it('no planejamento, grava a ordem do dia do mês da data escolhida', () => {
    montar()
    escolherDia(/^20 de outubro/)

    soltar('gil', 'ana')

    expect(simulado.clientes.reordenarRota).toHaveBeenCalledWith([
      { clienteId: 'gil', tipo: 'dia', dia: 20, valor: 999_012 },
    ])
  })

  it('solto fora da lista, no mesmo lugar ou sobre quem não está na rota, não grava nada', () => {
    montar()

    soltar('ana', null)
    soltar('ana', 'ana')
    soltar('ana', 'gil')
    soltar('quem', 'ana')

    expect(simulado.clientes.reordenarRota).not.toHaveBeenCalled()
  })

  it('arrasta com mouse a 8 px e toque segurando 200 ms; nada de PointerSensor', () => {
    montar()
    const sensores = (dnd().sensors ?? []).map((s) => [s.sensor, s.options])

    expect(sensores).toEqual([
      [MouseSensor, { activationConstraint: { distance: 8 } }],
      [TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }],
      [KeyboardSensor, expect.objectContaining({ coordinateGetter: expect.any(Function) })],
    ])
    expect(dnd().modifiers).toEqual([restrictToVerticalAxis, restrictToParentElement])
  })

  it('anuncia ao leitor de tela quem foi pego e onde caiu', () => {
    montar()
    const anuncios = dnd().accessibility?.announcements
    if (!anuncios) throw new Error('Sem anúncios')
    const ana = { id: 'ana' } as never
    const davi = { id: 'davi' } as never

    expect(anuncios.onDragStart({ active: ana })).toBe('Pegou Ana Lima. Posição 2 de 4.')
    expect(anuncios.onDragOver({ active: ana, over: davi } as never)).toBe('Ana Lima está na posição 4 de 4.')
    expect(anuncios.onDragOver({ active: ana, over: null } as never)).toBeUndefined()
    expect(anuncios.onDragEnd({ active: ana, over: davi } as never)).toBe('Ana Lima foi solto na posição 4 de 4.')
    expect(anuncios.onDragEnd({ active: ana, over: null } as never)).toBe('Ana Lima foi solto no mesmo lugar.')
    expect(anuncios.onDragCancel({ active: ana } as never)).toBe('Arrasto cancelado. Ana Lima ficou onde estava.')
    expect(anuncios.onDragStart({ active: { id: 'sumiu' } as never })).toBe('Pegou Cliente. Posição 0 de 4.')
    expect(dnd().accessibility?.screenReaderInstructions?.draggable).toMatch(/^Para mover este cliente/)
  })
})
