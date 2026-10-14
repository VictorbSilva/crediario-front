import { createElement, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { entradaDoCliente } from '@/lib/cliente'
import type { Cliente } from '@/types/cliente'
import { ClientesContext } from './clientes-context'
import type { ClientesContextValue } from './clientes-context'
import { ClientesProvider } from './ClientesProvider'

const simulado = vi.hoisted(() => ({
  businessId: 'loja-treino' as string | null,
  updateDoc: vi.fn(() => Promise.resolve()),
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

beforeEach(() => {
  simulado.businessId = 'loja-treino'
  vi.clearAllMocks()
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
