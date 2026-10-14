import { createElement, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FieldPath, doc } from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { entradaDoCliente } from '@/lib/cliente'
import type { Reordenacao } from '@/lib/rotas'
import type { Cliente } from '@/types/cliente'
import { ClientesContext } from './clientes-context'
import type { ClientesContextValue, FalhaDeEscrita } from './clientes-context'
import { ClientesProvider } from './ClientesProvider'

const simulado = vi.hoisted(() => ({
  businessId: 'loja-treino' as string | null,
  updateDoc: vi.fn(() => Promise.resolve()),
  lote: { update: vi.fn(), commit: vi.fn(() => Promise.resolve()) },
  writeBatch: vi.fn(),
  setters: [] as Mock[],
}))

// renderToStaticMarkup não monta nada, então um setState real seria descartado e `falhas`
// jamais seria observável. Cada setter vira um espião; `falhasEmpilhadas` reaplica as
// atualizações em função que o provider mandou para `setFalhas`.
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (inicial: unknown) => {
    const setter = vi.fn()
    simulado.setters.push(setter)
    return [typeof inicial === 'function' ? inicial() : inicial, setter]
  },
}))

vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ businessId: simulado.businessId }) }))
vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('@/lib/dispositivo', () => ({ identificarDispositivo: () => 'aparelho' }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => 'referencia'),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: () => 'carimbo-do-servidor',
  deleteField: () => 'remover-campo',
  setDoc: vi.fn(),
  updateDoc: simulado.updateDoc,
  writeBatch: simulado.writeBatch,
  FieldPath: class {
    partes: string[]

    constructor(...partes: string[]) {
      this.partes = partes
    }
  },
}))

const cliente: Cliente = {
  id: 'ana', numero: 12, nome: 'Ana', nomeBusca: 'ana', telefone: '9999',
  telefoneDigits: '9999', cadastradoEm: '2026-09-03', criadoEm: null, atualizadoEm: null,
  atualizadoPor: 'antigo', pendente: false,
}

function contexto(): ClientesContextValue {
  let valor: ClientesContextValue | null = null
  function Capturar() {
    valor = useContext(ClientesContext)
    return null
  }
  renderToStaticMarkup(createElement(ClientesProvider, null, createElement(Capturar)))
  if (!valor) throw new Error('Provider não entregou contexto')
  return valor
}

function falhasEmpilhadas(): FalhaDeEscrita[] {
  type Atualizacao = (anteriores: FalhaDeEscrita[]) => FalhaDeEscrita[]
  return simulado.setters
    .flatMap((setter) => setter.mock.calls.map(([argumento]) => argumento as unknown))
    .filter((argumento): argumento is Atualizacao => typeof argumento === 'function')
    .reduce<FalhaDeEscrita[]>((lista, atualizar) => atualizar(lista), [])
}

beforeEach(() => {
  simulado.businessId = 'loja-treino'
  simulado.setters.length = 0
  vi.clearAllMocks()
  simulado.writeBatch.mockReturnValue(simulado.lote)
})

describe('editarCliente', () => {
  it('fecha uma edição sem mudanças sem escrever ou trocar carimbos e autoria', () => {
    expect(contexto().editarCliente(cliente, entradaDoCliente(cliente))).toBe(true)
    expect(simulado.updateDoc).not.toHaveBeenCalled()
  })

  it('grava somente o campo alterado em relação à abertura', () => {
    expect(contexto().editarCliente(cliente, {
      ...entradaDoCliente(cliente), endereco: 'Rua A',
    })).toBe(true)
    expect(simulado.updateDoc).toHaveBeenCalledWith('referencia', {
      endereco: 'Rua A', atualizadoPor: 'aparelho', atualizadoEm: 'carimbo-do-servidor',
    })
  })

  it('remove telefone e dígitos sem enviar campos que não mudaram', () => {
    contexto().editarCliente(cliente, { ...entradaDoCliente(cliente), telefone: '' })
    expect(simulado.updateDoc).toHaveBeenCalledWith('referencia', {
      telefone: 'remover-campo', telefoneDigits: 'remover-campo',
      atualizadoPor: 'aparelho', atualizadoEm: 'carimbo-do-servidor',
    })
  })

  it('informa que a edição não foi enfileirada quando falta empresa', () => {
    simulado.businessId = null
    expect(contexto().editarCliente(cliente, {
      ...entradaDoCliente(cliente), endereco: 'Rua A',
    })).toBe(false)
    expect(simulado.updateDoc).not.toHaveBeenCalled()
  })
})

describe('marcarNaRota', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 14, 10))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('grava Visitado em um único update, com a data de hoje, o carimbo e a autoria', () => {
    contexto().marcarNaRota(cliente, 'visitado')
    expect(simulado.updateDoc).toHaveBeenCalledTimes(1)
    expect(simulado.updateDoc).toHaveBeenCalledWith('referencia', {
      ultimaMarca: 'visitado', ultimaMarcaEm: '2026-10-14', ultimoVisitado: '2026-10-14',
      visitadoAnterior: 'remover-campo',
      atualizadoPor: 'aparelho', atualizadoEm: 'carimbo-do-servidor',
    })
  })

  it('grava Ausente sem tocar na última visita', () => {
    contexto().marcarNaRota(cliente, 'ausente')
    expect(simulado.updateDoc).toHaveBeenCalledWith('referencia', {
      ultimaMarca: 'ausente', ultimaMarcaEm: '2026-10-14',
      atualizadoPor: 'aparelho', atualizadoEm: 'carimbo-do-servidor',
    })
  })

  it('Desmarcar apaga a marca de hoje e devolve a visita anterior no mesmo update', () => {
    contexto().marcarNaRota({
      ...cliente, ultimaMarca: 'visitado', ultimaMarcaEm: '2026-10-14',
      ultimoVisitado: '2026-10-14', visitadoAnterior: '2026-09-14',
    }, 'desmarcar')
    expect(simulado.updateDoc).toHaveBeenCalledWith('referencia', {
      ultimoVisitado: '2026-09-14',
      visitadoAnterior: 'remover-campo', ultimaMarca: 'remover-campo', ultimaMarcaEm: 'remover-campo',
      atualizadoPor: 'aparelho', atualizadoEm: 'carimbo-do-servidor',
    })
  })

  it('não escreve quando a alteração é vazia', () => {
    contexto().marcarNaRota(cliente, 'desmarcar')
    contexto().marcarNaRota({ ...cliente, ultimoVisitado: '2026-10-14' }, 'ausente')
    expect(simulado.updateDoc).not.toHaveBeenCalled()
  })

  it('não escreve sem empresa', () => {
    simulado.businessId = null
    contexto().marcarNaRota(cliente, 'visitado')
    expect(simulado.updateDoc).not.toHaveBeenCalled()
  })

  it('empilha a falha com o nome do cliente quando o servidor recusa', async () => {
    const causa = new Error('permission-denied')
    simulado.updateDoc.mockReturnValueOnce(Promise.reject(causa))
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    contexto().marcarNaRota(cliente, 'visitado')
    expect(falhasEmpilhadas()).toEqual([])
    await Promise.resolve()
    await Promise.resolve()
    expect(erro).toHaveBeenCalledWith('[clientes]', 'Não foi possível marcar a visita de Ana.', causa)
    expect(falhasEmpilhadas()).toEqual([{
      id: expect.any(String), mensagem: 'Não foi possível marcar a visita de Ana.',
      quando: expect.any(Date),
    }])
    erro.mockRestore()
  })
})

describe('reordenarRota', () => {
  const doDia: Reordenacao = { clienteId: 'ana', tipo: 'dia', dia: 5, valor: 1500 }
  const dehoje: Reordenacao = { clienteId: 'bia', tipo: 'hoje', data: '2026-10-14', valor: 2500 }

  it('grava o dia de um arraste só por FieldPath, sem substituir o mapa inteiro', () => {
    contexto().reordenarRota([doDia])
    expect(doc).toHaveBeenCalledWith({}, 'businesses', 'loja-treino', 'clients', 'ana')
    expect(simulado.updateDoc).toHaveBeenCalledTimes(1)
    expect(simulado.updateDoc).toHaveBeenCalledWith(
      'referencia', new FieldPath('ordemPorDia', '5'), 1500,
      'atualizadoEm', 'carimbo-do-servidor', 'atualizadoPor', 'aparelho',
    )
    expect(simulado.writeBatch).not.toHaveBeenCalled()
  })

  it('grava a posição de hoje como o objeto inteiro { data, valor }', () => {
    contexto().reordenarRota([dehoje])
    expect(simulado.updateDoc).toHaveBeenCalledWith(
      'referencia', 'ordemDoDia', { data: '2026-10-14', valor: 2500 },
      'atualizadoEm', 'carimbo-do-servidor', 'atualizadoPor', 'aparelho',
    )
  })

  it('manda um rebalanceamento inteiro em um único writeBatch', () => {
    contexto().reordenarRota([doDia, dehoje, { clienteId: 'ana', tipo: 'dia', dia: 6, valor: 3000 }])
    expect(simulado.updateDoc).not.toHaveBeenCalled()
    expect(simulado.writeBatch).toHaveBeenCalledTimes(1)
    expect(simulado.lote.update).toHaveBeenCalledTimes(3)
    expect(simulado.lote.update).toHaveBeenNthCalledWith(
      1, 'referencia', new FieldPath('ordemPorDia', '5'), 1500,
      'atualizadoEm', 'carimbo-do-servidor', 'atualizadoPor', 'aparelho',
    )
    expect(simulado.lote.update).toHaveBeenNthCalledWith(
      2, 'referencia', 'ordemDoDia', { data: '2026-10-14', valor: 2500 },
      'atualizadoEm', 'carimbo-do-servidor', 'atualizadoPor', 'aparelho',
    )
    expect(simulado.lote.update).toHaveBeenNthCalledWith(
      3, 'referencia', new FieldPath('ordemPorDia', '6'), 3000,
      'atualizadoEm', 'carimbo-do-servidor', 'atualizadoPor', 'aparelho',
    )
    expect(simulado.lote.commit).toHaveBeenCalledTimes(1)
  })

  it('não escreve com lista vazia nem sem empresa', () => {
    contexto().reordenarRota([])
    simulado.businessId = null
    contexto().reordenarRota([doDia])
    expect(simulado.updateDoc).not.toHaveBeenCalled()
    expect(simulado.writeBatch).not.toHaveBeenCalled()
  })

  it('empilha a falha da nova ordem quando o servidor recusa o update ou o lote', async () => {
    const causa = new Error('permission-denied')
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    simulado.updateDoc.mockReturnValueOnce(Promise.reject(causa))
    contexto().reordenarRota([doDia])
    simulado.lote.commit.mockReturnValueOnce(Promise.reject(causa))
    contexto().reordenarRota([doDia, dehoje])
    expect(falhasEmpilhadas()).toEqual([])
    await Promise.resolve()
    await Promise.resolve()
    expect(erro).toHaveBeenCalledTimes(2)
    expect(erro).toHaveBeenCalledWith('[clientes]', 'Não foi possível salvar a nova ordem da rota.', causa)
    expect(falhasEmpilhadas().map((falha) => falha.mensagem)).toEqual([
      'Não foi possível salvar a nova ordem da rota.',
      'Não foi possível salvar a nova ordem da rota.',
    ])
    erro.mockRestore()
  })
})
