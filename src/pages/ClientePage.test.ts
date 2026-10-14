import { Children, isValidElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FormularioCliente } from '@/components/clientes/FormularioCliente'
import type { Cliente } from '@/types/cliente'
import { ClientePage } from './ClientePage'

const rota = vi.hoisted(() => ({ id: 'A' }))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: () => [true, vi.fn()],
}))
vi.mock('react-router-dom', () => ({ useParams: () => rota, Link: () => null }))
vi.mock('@/data/useCarne', () => ({ useCarne: () => ({}) }))
vi.mock('@/data/useClientes', () => ({
  useClientes: () => ({
    clientes: [{ id: 'A' }, { id: 'B' }], carregando: false, alternarArquivo: vi.fn(),
  }),
}))

describe('ClientePage — troca de cliente com edição aberta', () => {
  it('entrega uma nova identidade de formulário para o cliente da nova rota', () => {
    function formulario(id: string) {
      rota.id = id
      const pagina = ClientePage()
      const filho = Children.toArray(pagina.props.children).find((item) =>
        isValidElement(item) && item.type === FormularioCliente,
      )
      if (!isValidElement<{ cliente: Cliente }>(filho)) throw new Error('Formulário ausente')
      return filho
    }
    const formularioA = formulario('A')
    const formularioB = formulario('B')
    expect(formularioA.props.cliente.id).toBe('A')
    expect(formularioB.props.cliente.id).toBe('B')
    expect(formularioB.key).not.toBe(formularioA.key)
  })
})
