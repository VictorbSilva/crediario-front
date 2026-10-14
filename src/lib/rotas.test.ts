import { describe, expect, it } from 'vitest'
import * as rotas from './rotas'
import type { AlteracaoDeVisita, ClienteNaRota, ItemDaRota, Reordenacao } from './rotas'

function cliente(campos: Partial<ClienteNaRota> = {}): ClienteNaRota {
  return { id: 'cliente', numero: 1, diasDeVisita: [5], ...campos }
}

function aplicar(c: ClienteNaRota, alteracao: AlteracaoDeVisita): ClienteNaRota {
  const alterado = Object.assign({}, c, alteracao.definir)
  for (const campo of alteracao.remover) Reflect.deleteProperty(alterado, campo)
  return alterado
}

function aplicarReordenacoes(clientes: readonly ClienteNaRota[], alteracoes: readonly Reordenacao[]): ClienteNaRota[] {
  return clientes.map((c) => {
    let alterado = { ...c }
    for (const alteracao of alteracoes.filter((a) => a.clienteId === c.id)) {
      if (alteracao.tipo === 'dia') {
        alterado = { ...alterado, ordemPorDia: { ...alterado.ordemPorDia, [String(alteracao.dia)]: alteracao.valor } }
      } else {
        alterado = { ...alterado, ordemDoDia: { data: alteracao.data, valor: alteracao.valor } }
      }
    }
    return alterado
  })
}

describe('dataDaVisita', () => {
  it.each([
    [2026, 11, 31, '2026-11-30'],
    [2026, 2, 30, '2026-02-28'],
    [2028, 2, 30, '2028-02-29'],
    [2026, 10, 5, '2026-10-05'],
  ])('limita %i/%i dia %i ao calendário', (ano, mes, dia, esperado) => {
    expect(rotas.dataDaVisita(ano, mes, dia)).toBe(esperado)
  })
})

describe('agendaRecente', () => {
  it.each([
    ['2026-10-14', '2026-10-05', 5],
    ['2026-10-03', '2026-09-20', 20],
    ['2026-10-20', '2026-10-20', 20],
  ])('escolhe a última agenda até %s', (hoje, data, dia) => {
    expect(rotas.agendaRecente(cliente({ diasDeVisita: [5, 20] }), hoje)).toEqual({ data, dia })
  })

  it('consulta dezembro do ano anterior em janeiro', () => {
    expect(rotas.agendaRecente(cliente({ diasDeVisita: [25] }), '2026-01-02'))
      .toEqual({ data: '2025-12-25', dia: 25 })
  })

  it('ignora agendas anteriores a rotaDesde, mas aceita a própria data', () => {
    expect(rotas.agendaRecente(cliente({ rotaDesde: '2026-10-10' }), '2026-10-14')).toBeNull()
    expect(rotas.agendaRecente(cliente({ rotaDesde: '2026-10-05' }), '2026-10-14'))
      .toEqual({ data: '2026-10-05', dia: 5 })
  })

  it.each([{ diasDeVisita: undefined }, { diasDeVisita: [] }])('devolve null sem dias de visita (%j)', ({ diasDeVisita }) => {
    expect(rotas.agendaRecente(cliente({ diasDeVisita }), '2026-10-14')).toBeNull()
  })

  it.each([[30, 31], [31, 30]])('desempata dias que caem em 30 de novembro (%j)', (...diasDeVisita) => {
    expect(rotas.agendaRecente(cliente({ diasDeVisita }), '2026-11-30'))
      .toEqual({ data: '2026-11-30', dia: 30 })
  })

  it.each([
    { hoje: '2027-02-28', dias: [29, 31], dia: 29 },
    { hoje: '2027-02-28', dias: [31, 29], dia: 29 },
    { hoje: '2027-02-28', dias: [28, 31], dia: 28 },
    { hoje: '2027-02-28', dias: [31, 28], dia: 28 },
    { hoje: '2027-03-01', dias: [31, 30, 29], dia: 29 },
    { hoje: '2027-03-01', dias: [29, 30, 31], dia: 29 },
    { hoje: '2028-02-29', dias: [31, 30, 29], dia: 29 },
    { hoje: '2026-11-30', dias: [31, 30], dia: 30 },
    { hoje: '2026-11-30', dias: [31], dia: 31 },
  ])('desempata agendas limitadas usando apenas dias configurados (C2: %j)', ({ hoje, dias, dia }) => {
    const c = cliente({ diasDeVisita: dias })
    const data = hoje === '2027-03-01' ? '2027-02-28' : hoje
    expect(rotas.agendaRecente(c, hoje)).toEqual({ data, dia })
    expect(rotas.estadoNaRota(c, hoje).diaAgendado).toBe(dia)
  })
})

describe('estadoNaRota', () => {
  it('fica pendente sem atraso no dia agendado', () => {
    expect(rotas.estadoNaRota(cliente(), '2026-10-05')).toEqual({
      situacao: 'pendente', atrasado: false, agendadoPara: '2026-10-05', diaAgendado: 5, ausenteHoje: false,
    })
  })

  it('fica pendente e atrasado depois da agenda', () => {
    expect(rotas.estadoNaRota(cliente(), '2026-10-07')).toEqual({
      situacao: 'pendente', atrasado: true, agendadoPara: '2026-10-05', diaAgendado: 5, ausenteHoje: false,
    })
  })

  it.each([
    ['2026-10-06', false], ['2026-10-07', true],
  ])('ausente em %s não encerra a pendência', (ultimaMarcaEm, ausenteHoje) => {
    expect(rotas.estadoNaRota(cliente({ ultimaMarca: 'ausente', ultimaMarcaEm }), '2026-10-07'))
      .toEqual({ situacao: 'pendente', atrasado: true, agendadoPara: '2026-10-05', diaAgendado: 5, ausenteHoje })
  })

  it('mantém visitado hoje mesmo com a agenda anterior', () => {
    expect(rotas.estadoNaRota(cliente({ ultimoVisitado: '2026-10-07' }), '2026-10-07'))
      .toEqual({ situacao: 'visitado', atrasado: true, agendadoPara: '2026-10-05', diaAgendado: 5, ausenteHoje: false })
  })

  it.each(['2026-10-05', '2026-10-06'])('sai da rota se a visita %s já cobriu a agenda', (ultimoVisitado) => {
    expect(rotas.estadoNaRota(cliente({ ultimoVisitado }), '2026-10-07').situacao).toBe('fora')
  })

  it('carrega a pendência para o mês seguinte', () => {
    expect(rotas.estadoNaRota(cliente({ diasDeVisita: [30], ultimoVisitado: '2026-09-30' }), '2026-11-02'))
      .toEqual({ situacao: 'pendente', atrasado: true, agendadoPara: '2026-10-30', diaAgendado: 30, ausenteHoje: false })
  })

  it('arquivado fica fora mesmo visitado hoje', () => {
    expect(rotas.estadoNaRota(cliente({ arquivado: true, ultimoVisitado: '2026-10-07' }), '2026-10-07').situacao)
      .toBe('fora')
  })

  it('sem agenda fica fora mesmo visitado hoje', () => {
    expect(rotas.estadoNaRota(cliente({ diasDeVisita: [], ultimoVisitado: '2026-10-07' }), '2026-10-07'))
      .toEqual({ situacao: 'fora', atrasado: false, agendadoPara: null, diaAgendado: null, ausenteHoje: false })
  })
})

describe('rotaDeHoje', () => {
  const hoje = '2026-10-05'
  const doDia = (numero: number, campos: Partial<ClienteNaRota> = {}) =>
    cliente({ id: String(numero), numero, ...campos })
  const ids = (clientes: readonly ClienteNaRota[]) => rotas.rotaDeHoje(clientes, hoje).map((item) => item.cliente.id)

  it('coloca clientes ordenados antes dos sem ordem e desempata por número', () => {
    expect(ids([
      doDia(3), doDia(2, { ordemPorDia: { '5': 1000 } }), doDia(1, { ordemPorDia: { '5': 1000 } }),
    ])).toEqual(['1', '2', '3'])
  })

  it('ordena os sem ordem pelo número e preserva o cliente genérico', () => {
    const clientes = [doDia(9), doDia(2)].map((c) => ({ ...c, nome: `Cliente ${c.numero}` }))
    const antes = structuredClone(clientes)
    const itens = rotas.rotaDeHoje(clientes, hoje)
    expect(itens.map((item) => item.cliente.nome)).toEqual(['Cliente 2', 'Cliente 9'])
    expect(itens.map((item) => item.chave)).toEqual([rotas.BASE_SEM_ORDEM + 2, rotas.BASE_SEM_ORDEM + 9])
    expect(clientes).toEqual(antes)
    expect(itens[0].cliente).toBe(clientes[1])
  })

  it('coloca atrasados no fim, por data e depois número, sem usar a ordem do dia agendado', () => {
    const itens = rotas.rotaDeHoje([
      doDia(8, { diasDeVisita: [3], ordemPorDia: { '3': 1 } }),
      doDia(7, { diasDeVisita: [2] }), doDia(4, { diasDeVisita: [2] }), doDia(9),
    ], hoje)
    expect(itens.map((item) => item.cliente.id)).toEqual(['9', '4', '7', '8'])
    expect(itens.map((item) => item.chave)).toEqual([1_000_009, 1_001_009, 1_002_009, 1_003_009])
  })

  it('usa a ordem temporária de hoje para colocar um atrasado no meio', () => {
    expect(ids([
      doDia(1, { ordemPorDia: { '5': 1000 } }), doDia(2, { ordemPorDia: { '5': 3000 } }),
      doDia(3, { diasDeVisita: [4], ordemDoDia: { data: hoje, valor: 2000 } }),
    ])).toEqual(['1', '3', '2'])
  })

  it('ignora ordem temporária de ontem', () => {
    expect(ids([
      doDia(1, { ordemPorDia: { '5': 1000 } }),
      doDia(2, { diasDeVisita: [4], ordemDoDia: { data: '2026-10-04', valor: 500 } }),
    ])).toEqual(['1', '2'])
  })

  it('usa a maior chave temporária ao anexar os outros atrasados', () => {
    expect(rotas.rotaDeHoje([
      doDia(1, { diasDeVisita: [4], ordemDoDia: { data: hoje, valor: 7000 } }),
      doDia(2, { diasDeVisita: [3] }),
    ], hoje).map((item) => item.chave)).toEqual([7000, 8000])
  })

  it('parte de zero quando só há atrasados sem ordem temporária', () => {
    expect(rotas.rotaDeHoje([doDia(1, { diasDeVisita: [4] })], hoje)[0].chave).toBe(rotas.PASSO)
  })

  it('visitado hoje permanece na mesma posição, inclusive se era atrasado', () => {
    const clientes = [doDia(2, { diasDeVisita: [4] }), doDia(1, { ordemPorDia: { '5': 2000 } })]
    const antes = ids(clientes)
    expect(ids(clientes.map((c) => ({ ...c, ultimoVisitado: hoje })))).toEqual(antes)
    expect(rotas.rotaDeHoje(clientes.map((c) => ({ ...c, ultimoVisitado: hoje })), hoje)
      .map((item) => item.estado.situacao)).toEqual(['visitado', 'visitado'])
  })

  it('exclui clientes fora da rota', () => {
    expect(ids([doDia(1, { arquivado: true }), doDia(2, { diasDeVisita: [] }),
      doDia(3, { diasDeVisita: [4], ultimoVisitado: '2026-10-04' })])).toEqual([])
  })
})

describe('rotaDoDia', () => {
  it('filtra dia e arquivados e usa a ordem daquele dia antes dos sem ordem', () => {
    const clientes = [
      cliente({ id: 'sem-9', numero: 9 }), cliente({ id: 'sem-2', numero: 2 }),
      cliente({ id: 'ordenado', numero: 20, diasDeVisita: [5, 20], ordemPorDia: { '5': 1000, '20': 9000 } }),
      cliente({ id: 'outro-dia', diasDeVisita: [20] }), cliente({ id: 'sem-dias', diasDeVisita: undefined }),
      cliente({ id: 'arquivado', arquivado: true }),
    ].map((c) => ({ ...c, nome: c.id }))
    const antes = structuredClone(clientes)
    const itens = rotas.rotaDoDia(clientes, 5)
    expect(itens.map((item) => item.cliente.nome)).toEqual(['ordenado', 'sem-2', 'sem-9'])
    expect(itens.map((item) => item.chave)).toEqual([1000, 1_000_002, 1_000_009])
    expect(clientes).toEqual(antes)
    expect(itens[0].cliente).toBe(clientes[2])
  })

  it('desempata chaves iguais por número, independentemente das marcas', () => {
    expect(rotas.rotaDoDia([
      cliente({ numero: 8, ordemPorDia: { '5': 1000 }, ultimoVisitado: '2026-10-05' }),
      cliente({ numero: 2, ordemPorDia: { '5': 1000 } }),
    ], 5).map((item) => item.cliente.numero)).toEqual([2, 8])
  })
})

describe('valores de ordem inválidos — padrão sem erro (C1)', () => {
  const hoje = '2026-10-05'

  it.each([NaN, Infinity, -Infinity, 'abc'])('ignora ordemPorDia inválida (%s) nas duas rotas', (valor) => {
    const clientes = [
      cliente({ id: 'ruim', numero: 4, ordemPorDia: { '5': valor as unknown as number } }),
      cliente({ id: 'sem-ordem', numero: 3 }),
      cliente({ id: 'B', numero: 2, ordemPorDia: { '5': 2000 } }),
      cliente({ id: 'A', numero: 1, ordemPorDia: { '5': 1000 } }),
      cliente({ id: 'solto', numero: 5, diasDeVisita: [4] }),
    ]
    const doDia = rotas.rotaDoDia(clientes, 5)
    expect(doDia.map((item) => item.cliente.id)).toEqual(['A', 'B', 'sem-ordem', 'ruim'])
    expect(doDia.map((item) => item.chave)).toEqual([1000, 2000, 1_000_003, 1_000_004])
    const deHoje = rotas.rotaDeHoje(clientes, hoje)
    expect(deHoje.map((item) => item.cliente.id)).toEqual(['A', 'B', 'sem-ordem', 'ruim', 'solto'])
    expect(deHoje.map((item) => item.chave)).toEqual([1000, 2000, 1_000_003, 1_000_004, 1_001_004])
    expect(deHoje.every((item) => Number.isFinite(item.chave))).toBe(true)
  })

  it.each([NaN, Infinity, -Infinity, 'abc'])('ordemDoDia inválida (%s) volta ao bloco de soltos, inclusive no arraste', (valor) => {
    const clientes = [
      cliente({ id: 'A', numero: 1, ordemPorDia: { '5': 1000 } }),
      cliente({ id: 'B', numero: 2, ordemPorDia: { '5': 2000 } }),
      cliente({ id: 'ruim', numero: 3, diasDeVisita: [4], ordemDoDia: { data: hoje, valor: valor as unknown as number } }),
      cliente({ id: 'antigo', numero: 4, diasDeVisita: [3] }),
    ]
    const lista = rotas.rotaDeHoje(clientes, hoje)
    expect(lista.map((item) => item.cliente.id)).toEqual(['A', 'B', 'antigo', 'ruim'])
    expect(lista.map((item) => item.chave)).toEqual([1000, 2000, 3000, 4000])
    expect(rotas.arrasteNaRotaDeHoje(lista, 3, 2, hoje, clientes)).toEqual([])
  })

  it('preserva ordens finitas zero, negativas e fracionárias', () => {
    const clientes = [
      cliente({ id: 'fracao', numero: 1, ordemPorDia: { '5': 1.5 } }),
      cliente({ id: 'zero', numero: 2, ordemPorDia: { '5': 0 } }),
      cliente({ id: 'negativo', numero: 3, ordemPorDia: { '5': -1000 } }),
    ]
    expect(rotas.rotaDoDia(clientes, 5).map((item) => item.chave)).toEqual([-1000, 0, 1.5])
    expect(rotas.rotaDeHoje(clientes, hoje).map((item) => item.chave)).toEqual([-1000, 0, 1.5])
  })
})

describe('índices de arraste inválidos — sem escrita (C2)', () => {
  const hoje = '2026-10-05'
  const clientes = [1, 2, 3].map((numero) => cliente({
    id: String(numero), numero, ordemPorDia: { '5': numero * rotas.PASSO },
  }))

  it.each([
    [0, 9], [-1, 1], [0, 1.5], [9, 0], [1, -1], [1.5, 0],
    [NaN, 1], [1, NaN], [Infinity, 1], [1, Infinity],
  ])('não grava de %s para %s em nenhuma das rotas', (de, para) => {
    const deHoje = rotas.rotaDeHoje(clientes, hoje)
    const doDia = rotas.rotaDoDia(clientes, 5)
    const antes = structuredClone(clientes)
    expect(rotas.arrasteNaRotaDeHoje(deHoje, de, para, hoje, clientes)).toEqual([])
    expect(rotas.arrasteNaRotaDoDia(doDia, de, para, 5)).toEqual([])
    expect(clientes).toEqual(antes)
    expect(deHoje).toEqual(rotas.rotaDeHoje(clientes, hoje))
    expect(doDia).toEqual(rotas.rotaDoDia(clientes, 5))
  })

  it('não grava em listas vazias', () => {
    expect(rotas.arrasteNaRotaDeHoje([], 0, 1, hoje, [])).toEqual([])
    expect(rotas.arrasteNaRotaDoDia([], 0, 1, 5)).toEqual([])
  })
})

describe('contagemPorDia', () => {
  it('conta cada dia dos clientes ativos, sem depender de visitas ou ordem', () => {
    expect(rotas.contagemPorDia([
      cliente({ diasDeVisita: [5, 20, 31], ultimoVisitado: '2026-10-05' }),
      cliente({ diasDeVisita: [5] }), cliente({ diasDeVisita: [20], arquivado: true }),
      cliente({ diasDeVisita: undefined }), cliente({ diasDeVisita: [] }),
    ])).toEqual(new Map([[5, 2], [20, 1], [31, 1]]))
  })

  it('devolve mapa vazio sem clientes', () => {
    expect(rotas.contagemPorDia([])).toEqual(new Map())
  })
})

describe('chaveEntre', () => {
  it.each([
    [null, null, 1000], [1000, null, 2000], [null, 1000, 0],
    [1000, 3000, 2000], [-1000, 0, -500], [0, 1000, 500],
    [1, 1 + Number.EPSILON, null], [1000, 1000, null],
  ])('entre %s e %s resulta em %s', (anterior, proxima, esperado) => {
    expect(rotas.chaveEntre(anterior, proxima)).toBe(esperado)
  })
})

describe('arrasteNaRotaDeHoje', () => {
  const hoje = '2026-10-05'
  function itens(chaves = [1000, 2000, 3000, 4000]): ItemDaRota<ClienteNaRota>[] {
    return chaves.map((chave, i) => {
      const c = cliente({ id: String(i + 1), numero: i + 1 })
      return { cliente: c, estado: rotas.estadoNaRota(c, hoje), chave }
    })
  }

  it('gera uma única alteração entre os novos vizinhos sem modificar a lista', () => {
    const lista = itens()
    const antes = structuredClone(lista)
    expect(rotas.arrasteNaRotaDeHoje(lista, 0, 2, hoje, lista.map((item) => item.cliente)))
      .toEqual([{ clienteId: '1', tipo: 'dia', dia: 5, valor: 3500 }])
    expect(lista).toEqual(antes)
  })

  it.each([
    [3, 0, '4', 0], [0, 3, '1', 5000], [2, 1, '3', 1500],
  ])('move de %i para %i', (de, para, clienteId, valor) => {
    const lista = itens()
    expect(rotas.arrasteNaRotaDeHoje(lista, de, para, hoje, lista.map((item) => item.cliente)))
      .toEqual([{ clienteId, tipo: 'dia', dia: 5, valor }])
  })

  it('não escreve quando a posição não muda', () => {
    const lista = itens()
    expect(rotas.arrasteNaRotaDeHoje(lista, 1, 1, hoje, lista.map((item) => item.cliente))).toEqual([])
  })

  it('gera tipo hoje ao arrastar um atrasado, mesmo visitado hoje', () => {
    const lista = itens()
    lista[3].cliente.diasDeVisita = [4]
    lista[3].cliente.ultimoVisitado = hoje
    lista[3].estado = rotas.estadoNaRota(lista[3].cliente, hoje)
    expect(rotas.arrasteNaRotaDeHoje(lista, 3, 1, hoje, lista.map((item) => item.cliente)))
      .toEqual([{ clienteId: '4', tipo: 'hoje', data: hoje, valor: 1500 }])
  })

  it('rebalanceia a lista inteira na ordem nova quando acaba a precisão', () => {
    const lista = itens([1, 1 + Number.EPSILON, 1000])
    lista[1].cliente.diasDeVisita = [4]
    lista[1].cliente.ordemDoDia = { data: hoje, valor: lista[1].chave }
    lista[1].estado = rotas.estadoNaRota(lista[1].cliente, hoje)
    const antes = structuredClone(lista)
    expect(rotas.arrasteNaRotaDeHoje(lista, 2, 1, hoje, lista.map((item) => item.cliente))).toEqual([
      { clienteId: '1', tipo: 'dia', dia: 5, valor: 1000 },
      { clienteId: '3', tipo: 'dia', dia: 5, valor: 2000 },
      { clienteId: '2', tipo: 'hoje', data: hoje, valor: 3000 },
    ])
    expect(lista).toEqual(antes)
  })
})

describe('arrasteNaRotaDeHoje — bloco de atrasados soltos (B1)', () => {
  const hoje = '2026-10-05'
  const clientes = [
    cliente({ id: 'A', numero: 1, ordemPorDia: { '5': 1000 } }),
    cliente({ id: 'B', numero: 2, ordemPorDia: { '5': 2000 } }),
    cliente({ id: 'X', numero: 3, diasDeVisita: [2] }),
    cliente({ id: 'Y', numero: 4, diasDeVisita: [3], ordemDoDia: { data: '2026-10-04', valor: 100 } }),
  ]

  it.each([1, 2, 3])('encaixa o cliente do dia antes do bloco ao mover para %i', (para) => {
    const lista = rotas.rotaDeHoje(clientes, hoje)
    const antes = structuredClone(lista)
    const alteracoes = rotas.arrasteNaRotaDeHoje(lista, 0, para, hoje, clientes)
    expect(alteracoes).toEqual([{ clienteId: 'A', tipo: 'dia', dia: 5, valor: 3000 }])
    expect(rotas.rotaDeHoje(aplicarReordenacoes(clientes, alteracoes), hoje).map((item) => item.cliente.id))
      .toEqual(['B', 'A', 'X', 'Y'])
    expect(lista).toEqual(antes)
  })

  it.each([[2, 3], [3, 2]])('não grava ao mover um solto dentro do bloco (%i → %i)', (de, para) => {
    const alteracoes = rotas.arrasteNaRotaDeHoje(rotas.rotaDeHoje(clientes, hoje), de, para, hoje, clientes)
    expect(alteracoes).toEqual([])
    expect(rotas.rotaDeHoje(aplicarReordenacoes(clientes, alteracoes), hoje).map((item) => item.cliente.id))
      .toEqual(['A', 'B', 'X', 'Y'])
  })

  it('posiciona um solto acima do bloco entre vizinhos fixos', () => {
    const alteracoes = rotas.arrasteNaRotaDeHoje(rotas.rotaDeHoje(clientes, hoje), 3, 1, hoje, clientes)
    expect(alteracoes).toEqual([{ clienteId: 'Y', tipo: 'hoje', data: hoje, valor: 1500 }])
    expect(rotas.rotaDeHoje(aplicarReordenacoes(clientes, alteracoes), hoje).map((item) => item.cliente.id))
      .toEqual(['A', 'Y', 'B', 'X'])
  })

  it('encaixa um atrasado com posição antes do bloco usando a última chave fixa', () => {
    const todos = [
      ...clientes,
      cliente({ id: 'P', numero: 5, diasDeVisita: [4], ordemDoDia: { data: hoje, valor: 2500 } }),
      cliente({ id: 'C', numero: 6, ordemPorDia: { '5': 5000 } }),
    ]
    const antes = rotas.rotaDeHoje(todos, hoje).map((item) => item.cliente.id)
    expect(antes).toEqual(['A', 'B', 'P', 'C', 'X', 'Y'])
    const alteracoes = rotas.arrasteNaRotaDeHoje(rotas.rotaDeHoje(todos, hoje), 2, 5, hoje, todos)
    expect(alteracoes).toEqual([{ clienteId: 'P', tipo: 'hoje', data: hoje, valor: 6000 }])
    expect(rotas.rotaDeHoje(aplicarReordenacoes(todos, alteracoes), hoje).map((item) => item.cliente.id))
      .toEqual(['A', 'B', 'C', 'P', 'X', 'Y'])
  })

  it('não grava ao encaixar o único fixo na posição que ele já ocupava', () => {
    const todos = [{ ...clientes[0], ordemPorDia: { '5': 2500 } }, clientes[2], clientes[3]]
    const alteracoes = rotas.arrasteNaRotaDeHoje(rotas.rotaDeHoje(todos, hoje), 0, 2, hoje, todos)
    expect(alteracoes).toEqual([])
    expect(aplicarReordenacoes(todos, alteracoes)).toEqual(todos)
  })

  it('não grava ao devolver o último fixo à posição original, preservando o dia inteiro', () => {
    const data = '2026-10-13'
    const todos = [
      cliente({ id: 'A', numero: 1, diasDeVisita: [13], ordemPorDia: { '13': 1000 } }),
      cliente({ id: 'B', numero: 2, diasDeVisita: [13], ordemPorDia: { '13': 2500 } }),
      cliente({ id: 'S', numero: 3, diasDeVisita: [12] }),
      cliente({ id: 'fora', numero: 4, diasDeVisita: [13], rotaDesde: '2026-10-14', ordemPorDia: { '13': 2250 } }),
    ]
    const lista = rotas.rotaDeHoje(todos, data)
    const antes = structuredClone(todos)
    expect(lista.map((item) => item.cliente.id)).toEqual(['A', 'B', 'S'])
    const alteracoes = rotas.arrasteNaRotaDeHoje(lista, 1, 2, data, todos)
    expect(alteracoes).toEqual([])
    const depois = aplicarReordenacoes(todos, alteracoes)
    expect(rotas.rotaDeHoje(depois, data)).toEqual(lista)
    expect(rotas.rotaDoDia(depois, 13).map((item) => item.cliente.id)).toEqual(['A', 'fora', 'B'])
    expect(todos).toEqual(antes)
  })

  it('preserva a chave temporária quando o atrasado com posição volta ao mesmo lugar', () => {
    const todos = [...clientes, cliente({ id: 'P', numero: 5, diasDeVisita: [4], ordemDoDia: { data: hoje, valor: 2500 } })]
    const lista = rotas.rotaDeHoje(todos, hoje)
    const alteracoes = rotas.arrasteNaRotaDeHoje(lista, 2, 4, hoje, todos)
    expect(alteracoes).toEqual([])
    expect(rotas.rotaDeHoje(aplicarReordenacoes(todos, alteracoes), hoje)).toEqual(lista)
  })

  it('não grava quando a lista inteira é um bloco de soltos', () => {
    expect(rotas.arrasteNaRotaDeHoje(rotas.rotaDeHoje(clientes.slice(2), hoje), 1, 0, hoje, clientes)).toEqual([])
  })
})

describe('arrasteNaRotaDeHoje — rebalanceamento do dia inteiro (C3)', () => {
  const hoje = '2026-10-05'
  const todos = [
    cliente({ id: 'A', numero: 1, ordemPorDia: { '5': 1 } }),
    cliente({ id: 'B', numero: 2, ordemPorDia: { '5': 1 + Number.EPSILON } }),
    cliente({ id: 'C', numero: 3, ordemPorDia: { '5': 1000 } }),
    cliente({ id: 'solto', numero: 4, diasDeVisita: [4] }),
    cliente({ id: 'fora-2', numero: 6, rotaDesde: '2026-10-06', ordemPorDia: { '5': 700 } }),
    cliente({ id: 'fora-1', numero: 5, rotaDesde: '2026-10-06', ordemPorDia: { '5': 500 } }),
    cliente({ id: 'arquivado', numero: 7, arquivado: true }),
    cliente({ id: 'outro-dia', numero: 8, diasDeVisita: [20], rotaDesde: '2026-10-06' }),
  ]

  it('anexa clientes fora de hoje na ordem atual do dia e posiciona os soltos', () => {
    const lista = rotas.rotaDeHoje(todos, hoje)
    const antes = structuredClone(todos)
    const alteracoes = rotas.arrasteNaRotaDeHoje(lista, 2, 1, hoje, todos)
    expect(alteracoes).toEqual([
      { clienteId: 'A', tipo: 'dia', dia: 5, valor: 1000 },
      { clienteId: 'C', tipo: 'dia', dia: 5, valor: 2000 },
      { clienteId: 'B', tipo: 'dia', dia: 5, valor: 3000 },
      { clienteId: 'solto', tipo: 'hoje', data: hoje, valor: 4000 },
      { clienteId: 'fora-1', tipo: 'dia', dia: 5, valor: 5000 },
      { clienteId: 'fora-2', tipo: 'dia', dia: 5, valor: 6000 },
    ])
    const depois = aplicarReordenacoes(todos, alteracoes)
    expect(rotas.rotaDeHoje(depois, hoje).map((item) => item.cliente.id)).toEqual(['A', 'C', 'B', 'solto'])
    expect(rotas.rotaDoDia(depois, 5).map((item) => item.cliente.id)).toEqual(['A', 'C', 'B', 'fora-1', 'fora-2'])
    expect(todos).toEqual(antes)
    expect(lista).toEqual(rotas.rotaDeHoje(todos, hoje))
  })

  it('arraste simples continua gerando uma alteração mesmo com clientes fora da lista', () => {
    expect(rotas.arrasteNaRotaDeHoje(rotas.rotaDeHoje(todos, hoje), 2, 0, hoje, todos))
      .toEqual([{ clienteId: 'C', tipo: 'dia', dia: 5, valor: -999 }])
  })

  it('completa cada dia agendado presente, usando o tamanho da lista de hoje em todos eles', () => {
    const data = '2026-11-30'
    const clientes = [
      cliente({ id: 'A', numero: 1, diasDeVisita: [30], ordemPorDia: { '30': 1 } }),
      cliente({ id: 'B', numero: 2, diasDeVisita: [31], ordemPorDia: { '31': 1 + Number.EPSILON } }),
      cliente({ id: 'C', numero: 3, diasDeVisita: [30], ordemPorDia: { '30': 1000 } }),
      cliente({ id: 'fora-30', numero: 4, diasDeVisita: [30], rotaDesde: '2026-12-01', ordemPorDia: { '30': 500 } }),
      cliente({ id: 'fora-31', numero: 5, diasDeVisita: [31], rotaDesde: '2026-12-01', ordemPorDia: { '31': 600 } }),
    ]
    const alteracoes = rotas.arrasteNaRotaDeHoje(rotas.rotaDeHoje(clientes, data), 2, 1, data, clientes)
    expect(alteracoes).toEqual([
      { clienteId: 'A', tipo: 'dia', dia: 30, valor: 1000 },
      { clienteId: 'C', tipo: 'dia', dia: 30, valor: 2000 },
      { clienteId: 'B', tipo: 'dia', dia: 31, valor: 3000 },
      { clienteId: 'fora-30', tipo: 'dia', dia: 30, valor: 4000 },
      { clienteId: 'fora-31', tipo: 'dia', dia: 31, valor: 4000 },
    ])
    const depois = aplicarReordenacoes(clientes, alteracoes)
    expect(rotas.rotaDoDia(depois, 30).map((item) => item.cliente.id)).toEqual(['A', 'C', 'fora-30'])
    expect(rotas.rotaDoDia(depois, 31).map((item) => item.cliente.id)).toEqual(['B', 'fora-31'])
  })

  it.each([
    { data: '2026-11-30', dia: 30, desde: '2026-12-01', seguinte: '2026-12-31' },
    { data: '2027-02-28', dia: 28, desde: '2027-03-01', seguinte: '2027-03-31' },
  ])('rebalanceia o outro dia de um cliente presente hoje em mês curto (%j)', ({ data, dia, desde, seguinte }) => {
    const clientes = [
      cliente({ id: 'A', numero: 1, diasDeVisita: [dia, 31], ordemPorDia: { [String(dia)]: 1, '31': 777 } }),
      cliente({ id: 'B', numero: 2, diasDeVisita: [31], ordemPorDia: { '31': 1 + Number.EPSILON } }),
      cliente({ id: 'C', numero: 3, diasDeVisita: [dia], ordemPorDia: { [String(dia)]: 1000 } }),
      cliente({ id: 'D', numero: 4, diasDeVisita: [31], rotaDesde: desde, ordemPorDia: { '31': 600 } }),
    ]
    const antes = structuredClone(clientes)
    expect(rotas.rotaDoDia(clientes, 31).map((item) => item.cliente.id)).toEqual(['B', 'D', 'A'])
    const alteracoes = rotas.arrasteNaRotaDeHoje(rotas.rotaDeHoje(clientes, data), 2, 1, data, clientes)
    expect(alteracoes).toEqual([
      { clienteId: 'A', tipo: 'dia', dia, valor: 1000 },
      { clienteId: 'C', tipo: 'dia', dia, valor: 2000 },
      { clienteId: 'B', tipo: 'dia', dia: 31, valor: 3000 },
      { clienteId: 'D', tipo: 'dia', dia: 31, valor: 4000 },
      { clienteId: 'A', tipo: 'dia', dia: 31, valor: 5000 },
    ])
    const depois = aplicarReordenacoes(clientes, alteracoes)
    expect(rotas.rotaDeHoje(depois, data).map((item) => item.cliente.id)).toEqual(['A', 'C', 'B'])
    expect(rotas.rotaDoDia(depois, 31).map((item) => item.cliente.id)).toEqual(['B', 'D', 'A'])
    expect(rotas.rotaDeHoje(depois, seguinte).filter((item) => item.estado.diaAgendado === 31)
      .map((item) => item.cliente.id)).toEqual(['B', 'D', 'A'])
    expect(clientes).toEqual(antes)
  })
})

describe('arrasteNaRotaDoDia', () => {
  const itens = (chaves = [1000, 2000, 3000, 4000]) => chaves.map((chave, i) => ({
    cliente: cliente({ id: String(i + 1), numero: i + 1 }), chave,
  }))

  it.each([
    [0, 2, '1', 3500], [3, 0, '4', 0], [0, 3, '1', 5000], [2, 1, '3', 1500],
  ])('gera uma única alteração ao mover de %i para %i', (de, para, clienteId, valor) => {
    const lista = itens()
    const antes = structuredClone(lista)
    expect(rotas.arrasteNaRotaDoDia(lista, de, para, 20))
      .toEqual([{ clienteId, tipo: 'dia', dia: 20, valor }])
    expect(lista).toEqual(antes)
  })

  it('não escreve quando a posição não muda', () => {
    expect(rotas.arrasteNaRotaDoDia(itens(), 0, 0, 5)).toEqual([])
  })

  it('rebalanceia todos no dia informado quando acaba a precisão', () => {
    const lista = itens([1, 1 + Number.EPSILON, 1000])
    const antes = structuredClone(lista)
    expect(rotas.arrasteNaRotaDoDia(lista, 2, 1, 20)).toEqual([
      { clienteId: '1', tipo: 'dia', dia: 20, valor: 1000 },
      { clienteId: '3', tipo: 'dia', dia: 20, valor: 2000 },
      { clienteId: '2', tipo: 'dia', dia: 20, valor: 3000 },
    ])
    expect(lista).toEqual(antes)
  })
})

describe('marcarVisitado', () => {
  const hoje = '2026-10-07'

  it('registra a visita e guarda a anterior em um nível', () => {
    const c = cliente({ ultimoVisitado: '2026-09-05', visitadoAnterior: '2026-08-05' })
    const antes = structuredClone(c)
    expect(rotas.marcarVisitado(c, hoje)).toEqual({
      definir: { ultimaMarca: 'visitado', ultimaMarcaEm: hoje, ultimoVisitado: hoje, visitadoAnterior: '2026-09-05' },
      remover: [],
    })
    expect(c).toEqual(antes)
  })

  it('remove visitadoAnterior quando não havia visita anterior', () => {
    expect(rotas.marcarVisitado(cliente(), hoje)).toEqual({
      definir: { ultimaMarca: 'visitado', ultimaMarcaEm: hoje, ultimoVisitado: hoje }, remover: ['visitadoAnterior'],
    })
  })

  it('não altera visitadoAnterior ao marcar de novo no mesmo dia', () => {
    expect(rotas.marcarVisitado(cliente({ ultimoVisitado: hoje, visitadoAnterior: '2026-09-05' }), hoje)).toEqual({
      definir: { ultimaMarca: 'visitado', ultimaMarcaEm: hoje, ultimoVisitado: hoje }, remover: [],
    })
  })
})

describe('marcarAusente', () => {
  it('não altera a visita ao marcar Ausente depois de Visitado no mesmo dia (C1)', () => {
    const hoje = '2026-10-07'
    const visitado = aplicar(cliente(), rotas.marcarVisitado(cliente(), hoje))
    const antes = structuredClone(visitado)
    const alteracao = rotas.marcarAusente(visitado, hoje)
    expect(alteracao).toEqual({ definir: {}, remover: [] })
    const depois = aplicar(visitado, alteracao)
    expect(rotas.estadoNaRota(depois, hoje)).toEqual(rotas.estadoNaRota(visitado, hoje))
    expect(rotas.estadoNaRota(depois, hoje)).toMatchObject({ situacao: 'visitado', ausenteHoje: false })
    expect(visitado).toEqual(antes)
  })

  it('registra só a tentativa, sem modificar visitas anteriores nem o cliente', () => {
    const c = cliente({ ultimoVisitado: '2026-09-05', visitadoAnterior: '2026-08-05' })
    const antes = structuredClone(c)
    expect(rotas.marcarAusente(c, '2026-10-07')).toEqual({
      definir: { ultimaMarca: 'ausente', ultimaMarcaEm: '2026-10-07' }, remover: [],
    })
    expect(c).toEqual(antes)
  })
})

describe('desmarcar', () => {
  const hoje = '2026-10-07'

  it('restaura a visita anterior e remove as marcas de hoje', () => {
    const c = cliente({ ultimoVisitado: hoje, visitadoAnterior: '2026-09-05', ultimaMarca: 'visitado', ultimaMarcaEm: hoje })
    const antes = structuredClone(c)
    expect(rotas.desmarcar(c, hoje)).toEqual({
      definir: { ultimoVisitado: '2026-09-05' }, remover: ['visitadoAnterior', 'ultimaMarca', 'ultimaMarcaEm'],
    })
    expect(c).toEqual(antes)
  })

  it('remove ultimoVisitado se não havia visita anterior', () => {
    const c = cliente({ ultimoVisitado: hoje, ultimaMarca: 'visitado', ultimaMarcaEm: hoje })
    const alteracao = rotas.desmarcar(c, hoje)
    expect(alteracao.definir).toEqual({})
    expect(alteracao.remover).toEqual(expect.arrayContaining(['ultimoVisitado', 'visitadoAnterior', 'ultimaMarca', 'ultimaMarcaEm']))
    expect(alteracao.remover).toHaveLength(4)
    expect(aplicar(c, alteracao)).toEqual(cliente())
  })

  it('ausente hoje remove apenas a tentativa e preserva a visita anterior', () => {
    const c = cliente({ ultimoVisitado: '2026-09-05', visitadoAnterior: '2026-08-05', ultimaMarca: 'ausente', ultimaMarcaEm: hoje })
    expect(rotas.desmarcar(c, hoje)).toEqual({ definir: {}, remover: ['ultimaMarca', 'ultimaMarcaEm'] })
  })

  it.each([
    {}, { ultimoVisitado: '2026-10-06', ultimaMarca: 'visitado', ultimaMarcaEm: '2026-10-06' },
    { ultimaMarca: 'ausente', ultimaMarcaEm: '2026-10-06' },
  ] satisfies Partial<ClienteNaRota>[])('não altera marca de outro dia (%j)', (campos) => {
    expect(rotas.desmarcar(cliente(campos), hoje)).toEqual({ definir: {}, remover: [] })
  })

  it.each([
    {}, { ultimoVisitado: '2026-09-05', visitadoAnterior: '2026-08-05' },
  ])('marcar e desmarcar visitado devolve o estado da rota anterior (%j)', (campos) => {
      const c = cliente(campos)
      const marcado = aplicar(c, rotas.marcarVisitado(c, hoje))
      expect(rotas.estadoNaRota(marcado, hoje).situacao).toBe('visitado')
      const desmarcado = aplicar(marcado, rotas.desmarcar(marcado, hoje))
      expect(rotas.estadoNaRota(desmarcado, hoje)).toEqual(rotas.estadoNaRota(c, hoje))
    })

  it('marcar e desmarcar ausente devolve o estado da rota anterior', () => {
    const c = cliente()
    const marcado = aplicar(c, rotas.marcarAusente(c, hoje))
    expect(rotas.estadoNaRota(marcado, hoje).ausenteHoje).toBe(true)
    const desmarcado = aplicar(marcado, rotas.desmarcar(marcado, hoje))
    expect(rotas.estadoNaRota(desmarcado, hoje)).toEqual(rotas.estadoNaRota(c, hoje))
  })

  it('visitar duas vezes no mesmo dia preserva a visita anterior para desfazer', () => {
    const c = cliente({ ultimoVisitado: '2026-09-05' })
    const primeira = aplicar(c, rotas.marcarVisitado(c, hoje))
    const segunda = aplicar(primeira, rotas.marcarVisitado(primeira, hoje))
    expect(segunda.visitadoAnterior).toBe('2026-09-05')
    const desmarcado = aplicar(segunda, rotas.desmarcar(segunda, hoje))
    expect(desmarcado.ultimoVisitado).toBe(c.ultimoVisitado)
    expect(rotas.estadoNaRota(desmarcado, hoje)).toEqual(rotas.estadoNaRota(c, hoje))
  })
})

describe('visita no futuro é ignorada (C3)', () => {
  const hoje = '2026-10-13'
  const c = cliente({
    diasDeVisita: [13], ultimoVisitado: '2026-10-20', visitadoAnterior: '2026-09-13',
    ultimaMarca: 'visitado', ultimaMarcaEm: '2026-10-20',
  })

  it('mantém o cliente pendente e presente na rota de hoje', () => {
    expect(rotas.estadoNaRota(c, hoje)).toEqual({
      situacao: 'pendente', atrasado: false, agendadoPara: hoje, diaAgendado: 13, ausenteHoje: false,
    })
    expect(rotas.rotaDeHoje([c], hoje).map((item) => item.cliente.id)).toEqual([c.id])
  })

  it('marcar de novo substitui a visita futura e remove visitadoAnterior', () => {
    const antes = structuredClone(c)
    const alteracao = rotas.marcarVisitado(c, hoje)
    expect(alteracao).toEqual({
      definir: { ultimaMarca: 'visitado', ultimaMarcaEm: hoje, ultimoVisitado: hoje }, remover: ['visitadoAnterior'],
    })
    const marcado = aplicar(c, alteracao)
    expect(marcado.ultimoVisitado).toBe(hoje)
    expect(marcado.visitadoAnterior).toBeUndefined()
    expect(rotas.estadoNaRota(marcado, hoje).situacao).toBe('visitado')
    expect(c).toEqual(antes)
  })

  it('desmarcar a visita futura não altera o cliente', () => {
    const alteracao = rotas.desmarcar(c, hoje)
    expect(alteracao).toEqual({ definir: {}, remover: [] })
    expect(aplicar(c, alteracao)).toEqual(c)
  })
})

describe('montarDiasDeVisita', () => {
  it('ordena os dias sem modificar a entrada', () => {
    const dias = Object.freeze([31, 5, 1, 20])
    expect(rotas.montarDiasDeVisita(dias)).toEqual([1, 5, 20, 31])
    expect(dias).toEqual([31, 5, 1, 20])
  })

  it('aceita lista vazia', () => {
    expect(rotas.montarDiasDeVisita([])).toEqual([])
  })

  it.each([
    { dias: [0] }, { dias: [32] }, { dias: [-1] }, { dias: [1.5] },
    { dias: [NaN] }, { dias: [Infinity] }, { dias: [5, 5] },
  ])('recusa dias inválidos ou repetidos (%j)', ({ dias }) => {
    expect(() => rotas.montarDiasDeVisita(dias)).toThrow(TypeError)
  })
})

describe('textoDosDias', () => {
  it.each([
    { dias: [], texto: 'Sem dias de visita' },
    { dias: [5], texto: 'Dia 5' },
    { dias: [5, 20], texto: 'Dias 5 e 20' },
    { dias: [1, 10, 20], texto: 'Dias 1, 10 e 20' },
  ])('apresenta os dias em português (%j)', ({ dias, texto }) => {
    expect(rotas.textoDosDias(dias)).toBe(texto)
  })
})
