// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { entradaVendaVazia } from '@/lib/venda'
import type { Pagamento, Parcela, Venda } from '@/types/venda'
import { useCarne } from './useCarne'

type Consulta = { colecao: { caminho: string[] }; filtro: { campo: string; op: string; valor: unknown } }
type DocumentoSimulado = { id: string; dados: Record<string, unknown>; pendente?: boolean }
type Ouvinte = {
  consulta: Consulta
  opcoes: unknown
  proximo: (instantaneo: unknown) => void
  erro: (causa: unknown) => void
  cancelar: Mock
}

const simulado = vi.hoisted(() => ({
  businessId: 'loja-treino' as string | null,
  ouvintes: [] as Ouvinte[],
  proximoId: 0,
  lote: { set: vi.fn(), commit: vi.fn(() => Promise.resolve()) },
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ businessId: simulado.businessId }) }))
vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('@/lib/dispositivo', () => ({ identificarDispositivo: () => 'aparelho' }))
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...caminho: string[]) => ({ caminho }),
  // `doc(colecao)` gera id novo; `doc(db, ...caminho)` aponta para um documento existente.
  doc: (base: unknown, ...caminho: string[]) =>
    caminho.length > 0 ? { caminho } : { id: `novo-${++simulado.proximoId}`, colecao: base },
  query: (colecao: unknown, filtro: unknown) => ({ colecao, filtro }),
  where: (campo: string, op: string, valor: unknown) => ({ campo, op, valor }),
  onSnapshot: (
    consulta: Consulta,
    opcoes: unknown,
    proximo: Ouvinte['proximo'],
    erro: Ouvinte['erro'],
  ) => {
    const cancelar = vi.fn()
    simulado.ouvintes.push({ consulta, opcoes, proximo, erro, cancelar })
    return cancelar
  },
  serverTimestamp: () => 'carimbo-do-servidor',
  setDoc: simulado.setDoc,
  updateDoc: simulado.updateDoc,
  writeBatch: () => simulado.lote,
}))

const CHAVE_SINCRONIZADOS = 'crediario:carnes-sincronizados:loja-treino'

function ativos(): Ouvinte[] {
  return simulado.ouvintes.filter((ouvinte) => ouvinte.cancelar.mock.calls.length === 0)
}

function ouvinteDe(colecao: string): Ouvinte {
  const ouvinte = ativos().find((o) => o.consulta.colecao.caminho.at(-1) === colecao)
  if (!ouvinte) throw new Error(`Nenhum listener ativo em ${colecao}`)
  return ouvinte
}

function emitir(colecao: string, documentos: DocumentoSimulado[], fromCache = false) {
  act(() => {
    ouvinteDe(colecao).proximo({
      metadata: { fromCache },
      docs: documentos.map((d) => ({
        id: d.id,
        data: () => d.dados,
        metadata: { hasPendingWrites: d.pendente ?? false },
      })),
    })
  })
}

// R$ 300 em 3×100, vencendo dia 10. Com "hoje" em 15/10, a 1ª e a 2ª já venceram.
const VENDA: DocumentoSimulado = {
  id: 'v1',
  dados: {
    clientId: 'ana', dataVenda: '2026-08-20', valorTotalCentavos: 30000, numeroParcelas: 3,
    valorParcelaCentavos: 10000, diaVencimento: 10, versaoCalculo: 1, atualizadoPor: 'x',
    observacao: 'geladeira',
  },
}
const PARCELAS: DocumentoSimulado[] = ['2026-09-10', '2026-10-10', '2026-11-10'].map((vencimento, i) => ({
  id: `p${i + 1}`,
  dados: {
    clientId: 'ana', saleId: 'v1', numero: i + 1, total: 3, vencimento, valorCentavos: 10000,
    atualizadoPor: 'x',
  },
}))
const PAGAMENTO: DocumentoSimulado = {
  id: 'pg1',
  dados: {
    clientId: 'ana', saleId: 'v1', data: '2026-09-12', valorCentavos: 15000, forma: 'pix',
    cancelado: false, atualizadoPor: 'x',
  },
}

function carregarTudo(fromCache = false) {
  emitir('sales', [VENDA], fromCache)
  emitir('installments', PARCELAS, fromCache)
  emitir('payments', [PAGAMENTO], fromCache)
}

beforeEach(() => {
  simulado.businessId = 'loja-treino'
  simulado.ouvintes = []
  simulado.proximoId = 0
  simulado.lote.set.mockClear()
  simulado.lote.commit.mockReset().mockReturnValue(Promise.resolve())
  simulado.setDoc.mockReset().mockReturnValue(Promise.resolve())
  simulado.updateDoc.mockReset().mockReturnValue(Promise.resolve())
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 12))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useCarne — listeners', () => {
  it('abre um listener por coleção, filtrado pelo cliente e ouvindo mudança de metadados', () => {
    renderHook(() => useCarne('ana'))

    expect(simulado.ouvintes.map((o) => o.consulta.colecao.caminho)).toEqual([
      ['businesses', 'loja-treino', 'sales'],
      ['businesses', 'loja-treino', 'installments'],
      ['businesses', 'loja-treino', 'payments'],
    ])
    for (const ouvinte of simulado.ouvintes) {
      expect(ouvinte.consulta.filtro).toEqual({ campo: 'clientId', op: '==', valor: 'ana' })
      expect(ouvinte.opcoes).toEqual({ includeMetadataChanges: true })
    }
  })

  it('sem cliente aberto, ou sem empresa, não assina nada', () => {
    const { result } = renderHook(() => useCarne(null))
    expect(simulado.ouvintes).toHaveLength(0)
    expect(result.current.carregando).toBe(true)
    expect(result.current.carnes).toEqual([])

    simulado.businessId = null
    renderHook(() => useCarne('ana'))
    expect(simulado.ouvintes).toHaveLength(0)
  })

  it('desmontar cancela os três listeners', () => {
    const { unmount } = renderHook(() => useCarne('ana'))
    unmount()

    expect(simulado.ouvintes.every((o) => o.cancelar.mock.calls.length === 1)).toBe(true)
  })
})

describe('useCarne — carregamento', () => {
  it('não é contador regressivo: três snapshots de sales não terminam o carregamento', () => {
    const { result } = renderHook(() => useCarne('ana'))

    emitir('sales', [VENDA])
    emitir('sales', [VENDA])
    emitir('sales', [VENDA])
    expect(result.current.carregando).toBe(true)
    expect(result.current.estadoSync).toBe('sincronizando')

    emitir('installments', PARCELAS)
    emitir('payments', [PAGAMENTO])
    expect(result.current.carregando).toBe(false)
  })

  it('monta o carnê cruzando as três coleções, com o valor combinado e sem encargos', () => {
    const { result } = renderHook(() => useCarne('ana'))
    carregarTudo()

    const [carne] = result.current.carnes
    expect(carne.venda).toMatchObject({ id: 'v1', observacao: 'geladeira', criadoEm: null, pendente: false })
    expect(carne.parcelas.map((p) => p.estado.situacao)).toEqual(['paga', 'vencida', 'a-vencer'])
    expect(result.current.saldo).toMatchObject({
      pagoCentavos: 15000, abertoCentavos: 15000, encargosCentavos: 0, parcelasVencidas: 1,
    })
    expect(result.current.pagamentos.map((p) => p.id)).toEqual(['pg1'])
    expect(result.current.hoje).toBe('2026-10-15')
    expect(result.current.estadoSync).toBe('sincronizado')
  })

  it('os carimbos do servidor chegam como vieram; ausentes, por escrita que não subiu, viram null', () => {
    const carimbo = { toDate: () => new Date(2026, 9, 1) }
    const outro = { toDate: () => new Date(2026, 9, 2) }
    const { result } = renderHook(() => useCarne('ana'))
    emitir('sales', [{ ...VENDA, dados: { ...VENDA.dados, criadoEm: carimbo, atualizadoEm: outro } }])
    emitir('installments', [{ ...PARCELAS[0], dados: { ...PARCELAS[0].dados, criadoEm: carimbo, atualizadoEm: outro } }])
    emitir('payments', [{ ...PAGAMENTO, dados: { ...PAGAMENTO.dados, criadoEm: carimbo, atualizadoEm: outro } }])

    const [carne] = result.current.carnes
    expect([carne.venda.criadoEm, carne.venda.atualizadoEm]).toEqual([carimbo, outro])
    // O carnê tipa a parcela pela lib, mas o objeto é o `Parcela` que o conversor montou.
    const parcela = carne.parcelas[0].parcela as Parcela
    expect([parcela.criadoEm, parcela.atualizadoEm]).toEqual([carimbo, outro])
    expect([result.current.pagamentos[0].criadoEm, result.current.pagamentos[0].atualizadoEm]).toEqual([carimbo, outro])

    emitir('payments', [PAGAMENTO])
    expect([result.current.pagamentos[0].criadoEm, result.current.pagamentos[0].atualizadoEm]).toEqual([null, null])
  })

  it('conta o que ainda não subiu como pendente', () => {
    const { result } = renderHook(() => useCarne('ana'))
    emitir('sales', [{ ...VENDA, pendente: true }])
    emitir('installments', PARCELAS.map((p) => ({ ...p, pendente: true })))
    emitir('payments', [])

    expect(result.current.pendentes).toBe(4)
    expect(result.current.estadoSync).toBe('pendente')
  })

  it('venda cancelada fica no carnê mas sai do saldo', () => {
    const { result } = renderHook(() => useCarne('ana'))
    emitir('sales', [{ ...VENDA, dados: { ...VENDA.dados, cancelada: true, canceladaEm: '2026-10-01' } }])
    emitir('installments', PARCELAS)
    emitir('payments', [PAGAMENTO])

    expect(result.current.carnes[0].cancelada).toBe(true)
    expect(result.current.carnes[0].venda.canceladaEm).toBe('2026-10-01')
    expect(result.current.saldo.abertoCentavos).toBe(0)
  })

  it('ao trocar de cliente, o carnê anterior não aparece nem por um render', () => {
    const { result, rerender } = renderHook(({ id }) => useCarne(id), {
      initialProps: { id: 'ana' as string | null },
    })
    carregarTudo()
    expect(result.current.carnes).toHaveLength(1)

    rerender({ id: 'bia' })

    expect(result.current.carnes).toEqual([])
    expect(result.current.pagamentos).toEqual([])
    expect(result.current.carregando).toBe(true)
    expect(simulado.ouvintes.slice(0, 3).every((o) => o.cancelar.mock.calls.length === 1)).toBe(true)
    expect(ativos().map((o) => o.consulta.filtro.valor)).toEqual(['bia', 'bia', 'bia'])
  })

  it('voltar a um cliente já aberto recomeça o carregamento, em vez de dizer "sem vendas"', () => {
    const { result, rerender } = renderHook(({ id }) => useCarne(id), {
      initialProps: { id: 'ana' as string | null },
    })
    carregarTudo()
    rerender({ id: 'bia' })
    emitir('sales', [])

    rerender({ id: 'ana' })

    // O estado ainda guarda as listas da Bia: "pronto" aqui mostraria a Ana sem venda nenhuma.
    expect(result.current.carregando).toBe(true)
    expect(result.current.confianca).toBe('desconhecida')
  })

  it('erro de leitura avisa e encerra o carregamento, para a tela não girar para sempre', () => {
    const { result } = renderHook(() => useCarne('ana'))

    act(() => ouvinteDe('payments').erro(new Error('permission-denied')))

    expect(result.current.erro).toBe('Não foi possível carregar o carnê deste cliente.')
    expect(result.current.carregando).toBe(false)
    expect(result.current.estadoSync).toBe('erro')
  })
})

describe('useCarne — confiança no carnê deste aparelho', () => {
  it('lista vinda só do cache, num aparelho que nunca leu este carnê, é parcial', () => {
    const { result } = renderHook(() => useCarne('ana'))
    emitir('sales', [], true)
    emitir('installments', [], true)
    emitir('payments', [], true)

    expect(result.current.confianca).toBe('parcial')
    expect(result.current.estadoSync).toBe('offline')
  })

  it('só marca o carnê como lido quando as três coleções vieram do servidor', () => {
    const { result } = renderHook(() => useCarne('ana'))
    emitir('sales', [VENDA])
    emitir('installments', PARCELAS, true)
    emitir('payments', [PAGAMENTO])
    expect(localStorage.getItem(CHAVE_SINCRONIZADOS)).toBeNull()
    // Uma coleção só do cache basta para o carnê não ser confiável.
    expect(result.current.confianca).toBe('parcial')
    expect(result.current.estadoSync).toBe('offline')

    emitir('installments', PARCELAS)
    expect(JSON.parse(localStorage.getItem(CHAVE_SINCRONIZADOS) ?? '')).toEqual(['ana'])
    expect(result.current.confianca).toBe('confiavel')

    // Um snapshot novo do servidor não regrava nem duplica.
    emitir('sales', [VENDA])
    expect(JSON.parse(localStorage.getItem(CHAVE_SINCRONIZADOS) ?? '')).toEqual(['ana'])
  })

  it('carnê já lido do servidor antes continua confiável aberto offline', () => {
    localStorage.setItem(CHAVE_SINCRONIZADOS, JSON.stringify(['bia', 'ana']))
    const { result } = renderHook(() => useCarne('ana'))
    carregarTudo(true)

    expect(result.current.confianca).toBe('confiavel')
  })

  it('carnê baixado nesta sessão continua confiável quando a rede cai em seguida', () => {
    const { result } = renderHook(() => useCarne('ana'))
    carregarTudo()

    emitir('payments', [PAGAMENTO], true)

    expect(result.current.estadoSync).toBe('offline')
    expect(result.current.confianca).toBe('confiavel')
  })

  it('não duplica o cliente se outra aba já gravou a mesma marca', () => {
    const { rerender } = renderHook(() => useCarne('ana'))
    localStorage.setItem(CHAVE_SINCRONIZADOS, JSON.stringify(['ana']))
    carregarTudo()
    rerender()

    expect(JSON.parse(localStorage.getItem(CHAVE_SINCRONIZADOS) ?? '')).toEqual(['ana'])
  })

  it.each([
    ['JSON quebrado', '{não é json'],
    ['objeto no lugar da lista', JSON.stringify({ ana: true })],
  ])('memória com %s vale como nenhuma, e a próxima gravação a substitui por uma lista limpa', (_caso, guardado) => {
    localStorage.setItem(CHAVE_SINCRONIZADOS, guardado)
    const { result } = renderHook(() => useCarne('ana'))
    carregarTudo(true)
    expect(result.current.confianca).toBe('parcial')

    carregarTudo()
    expect(JSON.parse(localStorage.getItem(CHAVE_SINCRONIZADOS) ?? '')).toEqual(['ana'])
  })

  it('lixo dentro da lista guardada é descartado, e o que é id continua valendo', () => {
    localStorage.setItem(CHAVE_SINCRONIZADOS, JSON.stringify([1, null, 'bia', { ana: true }]))
    const { result } = renderHook(() => useCarne('ana'))
    carregarTudo(true)
    expect(result.current.confianca).toBe('parcial')

    carregarTudo()
    expect(JSON.parse(localStorage.getItem(CHAVE_SINCRONIZADOS) ?? '')).toEqual(['bia', 'ana'])
  })

  it('armazenamento bloqueado não impede marcar o carnê nesta sessão', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useCarne('ana'))
    carregarTudo()

    expect(result.current.confianca).toBe('confiavel')
  })
})

describe('useCarne — escritas', () => {
  const entradaVenda = () => ({
    ...entradaVendaVazia(new Date(2026, 9, 15)),
    valor: '300,00',
    numeroParcelas: '3',
    diaVencimento: '10',
  })

  const pagamento = { id: 'pg1' } as Pagamento
  const venda = { id: 'v1' } as Venda

  async function esvaziarFila() {
    await act(async () => {
      await Promise.resolve()
    })
  }

  it('grava a venda e as parcelas num lote só, sem esperar o servidor', () => {
    const { result } = renderHook(() => useCarne('ana'))

    const retorno = result.current.registrarVenda(entradaVenda())

    expect(retorno).toBeUndefined()
    expect(simulado.lote.set).toHaveBeenCalledTimes(4)
    const [[refVenda, camposVenda], ...parcelas] = simulado.lote.set.mock.calls
    expect(refVenda.colecao).toEqual({ caminho: ['businesses', 'loja-treino', 'sales'] })
    expect(camposVenda).toMatchObject({
      clientId: 'ana', valorTotalCentavos: 30000, numeroParcelas: 3, atualizadoPor: 'aparelho',
      criadoEm: 'carimbo-do-servidor', atualizadoEm: 'carimbo-do-servidor',
    })
    expect(parcelas.map(([, campos]) => campos.numero)).toEqual([1, 2, 3])
    for (const [refParcela, campos] of parcelas) {
      expect(refParcela.colecao).toEqual({ caminho: ['businesses', 'loja-treino', 'installments'] })
      expect(refParcela.id).not.toBe(refVenda.id)
      expect(campos).toMatchObject({
        saleId: refVenda.id, clientId: 'ana', valorCentavos: 10000, atualizadoPor: 'aparelho',
        criadoEm: 'carimbo-do-servidor', atualizadoEm: 'carimbo-do-servidor',
      })
    }
    expect(simulado.lote.commit).toHaveBeenCalledTimes(1)
  })

  it('lote recusado vira falha visível, que o usuário pode dispensar', async () => {
    simulado.lote.commit.mockRejectedValue(new Error('permission-denied'))
    const { result } = renderHook(() => useCarne('ana'))

    result.current.registrarVenda(entradaVenda())
    await esvaziarFila()

    expect(result.current.falhas).toHaveLength(1)
    expect(result.current.falhas[0].mensagem).toMatch(/venda foi recusada/)

    act(() => result.current.descartarFalha(result.current.falhas[0].id))
    expect(result.current.falhas).toEqual([])
  })

  it('pagamento vai contra a venda, sem parcela, e falha vira aviso', async () => {
    simulado.setDoc.mockRejectedValue(new Error('negado'))
    const { result } = renderHook(() => useCarne('ana'))

    result.current.registrarPagamento('v1', {
      data: '2026-10-15', valor: '50,00', forma: 'dinheiro', observacao: '',
    })
    await esvaziarFila()

    const [[referencia, campos]] = simulado.setDoc.mock.calls as unknown as [[{ colecao: { caminho: string[] } }, object]]
    expect(referencia.colecao.caminho).toEqual(['businesses', 'loja-treino', 'payments'])
    expect(campos).toMatchObject({
      saleId: 'v1', clientId: 'ana', valorCentavos: 5000, cancelado: false, atualizadoPor: 'aparelho',
      criadoEm: 'carimbo-do-servidor', atualizadoEm: 'carimbo-do-servidor',
    })
    expect(campos).not.toHaveProperty('installmentId')
    expect(result.current.falhas[0].mensagem).toMatch(/pagamento foi recusado/)
  })

  it('cancelar pagamento é um update com data própria, nunca um delete', async () => {
    simulado.updateDoc.mockRejectedValue(new Error('negado'))
    const { result } = renderHook(() => useCarne('ana'))

    result.current.cancelarPagamento(pagamento, '2026-10-15')
    await esvaziarFila()

    expect(simulado.updateDoc).toHaveBeenCalledWith(
      { caminho: ['businesses', 'loja-treino', 'payments', 'pg1'] },
      {
        cancelado: true, canceladoEm: '2026-10-15', atualizadoEm: 'carimbo-do-servidor',
        atualizadoPor: 'aparelho',
      },
    )
    expect(result.current.falhas[0].mensagem).toBe('Não foi possível cancelar este pagamento.')
  })

  it('cancelar venda marca só o documento da venda, com a data do momento da escrita', async () => {
    simulado.updateDoc.mockRejectedValue(new Error('negado'))
    const { result } = renderHook(() => useCarne('ana'))

    result.current.cancelarVenda(venda)
    await esvaziarFila()

    expect(simulado.updateDoc).toHaveBeenCalledTimes(1)
    expect(simulado.updateDoc).toHaveBeenCalledWith(
      { caminho: ['businesses', 'loja-treino', 'sales', 'v1'] },
      {
        cancelada: true, canceladaEm: '2026-10-15', atualizadoPor: 'aparelho',
        atualizadoEm: 'carimbo-do-servidor',
      },
    )
    expect(result.current.falhas[0].mensagem).toBe('Não foi possível cancelar esta venda.')
  })

  it('falhas seguidas ganham ids diferentes', async () => {
    simulado.updateDoc.mockRejectedValue(new Error('negado'))
    const { result } = renderHook(() => useCarne('ana'))

    result.current.cancelarVenda(venda)
    result.current.cancelarPagamento(pagamento, '2026-10-15')
    await esvaziarFila()

    const ids = result.current.falhas.map((f) => f.id)
    expect(new Set(ids).size).toBe(2)
    expect(console.error).toHaveBeenCalledWith('[carne]', 'Não foi possível cancelar esta venda.', expect.any(Error))

    // Dispensar uma não leva a outra junto.
    act(() => result.current.descartarFalha(ids[0]))
    expect(result.current.falhas.map((f) => f.mensagem)).toEqual(['Não foi possível cancelar este pagamento.'])
  })

  it('depois de trocar de cliente, venda e pagamento vão para o cliente novo', () => {
    const { result, rerender } = renderHook(({ id }) => useCarne(id), {
      initialProps: { id: 'ana' as string | null },
    })
    rerender({ id: 'bia' })

    result.current.registrarVenda(entradaVenda())
    result.current.registrarPagamento('v9', {
      data: '2026-10-15', valor: '50,00', forma: 'pix', observacao: '',
    })

    expect(simulado.lote.set.mock.calls.every(([, campos]) => campos.clientId === 'bia')).toBe(true)
    expect(simulado.setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ clientId: 'bia', saleId: 'v9' }))
  })

  it('depois de trocar de empresa, os cancelamentos vão para a empresa nova', () => {
    const { result, rerender } = renderHook(() => useCarne('ana'))
    simulado.businessId = 'loja-principal'
    rerender()

    result.current.cancelarPagamento(pagamento, '2026-10-15')
    result.current.cancelarVenda(venda)

    expect((simulado.updateDoc.mock.calls as unknown as [unknown][]).map(([referencia]) => referencia)).toEqual([
      { caminho: ['businesses', 'loja-principal', 'payments', 'pg1'] },
      { caminho: ['businesses', 'loja-principal', 'sales', 'v1'] },
    ])
  })

  it('sem empresa, nenhuma escrita sai', () => {
    simulado.businessId = null
    const { result } = renderHook(() => useCarne('ana'))

    result.current.registrarVenda(entradaVenda())
    result.current.registrarPagamento('v1', {
      data: '2026-10-15', valor: '50,00', forma: 'dinheiro', observacao: '',
    })
    result.current.cancelarPagamento(pagamento, '2026-10-15')
    result.current.cancelarVenda(venda)

    expect(simulado.lote.commit).not.toHaveBeenCalled()
    expect(simulado.setDoc).not.toHaveBeenCalled()
    expect(simulado.updateDoc).not.toHaveBeenCalled()
  })

  it('sem cliente aberto, venda e pagamento não saem', () => {
    const { result } = renderHook(() => useCarne(null))

    result.current.registrarVenda(entradaVenda())
    result.current.registrarPagamento('v1', {
      data: '2026-10-15', valor: '50,00', forma: 'dinheiro', observacao: '',
    })

    expect(simulado.lote.commit).not.toHaveBeenCalled()
    expect(simulado.setDoc).not.toHaveBeenCalled()
  })
})
