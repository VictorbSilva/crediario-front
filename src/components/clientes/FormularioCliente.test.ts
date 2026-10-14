import { createElement } from 'react'
import type { ComponentProps, SubmitEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModalDeFormulario } from '@/components/ui/ModalDeFormulario'
import { entradaDoCliente } from '@/lib/cliente'
import type { Cliente } from '@/types/cliente'
import { FormularioCliente } from './FormularioCliente'

const simulado = vi.hoisted(() => ({
  editarCliente: vi.fn(() => true),
  criarCliente: vi.fn(),
}))
let modal: ComponentProps<typeof ModalDeFormulario>

vi.mock('@/data/useClientes', () => ({
  useClientes: () => ({ clientes: [], confianca: 'confiavel', ...simulado }),
}))
vi.mock('@/components/ui/ModalDeFormulario', () => ({
  ModalDeFormulario: (props: ComponentProps<typeof ModalDeFormulario>) => {
    modal = props
    return null
  },
}))

const cliente: Cliente = {
  id: 'ana', numero: 12, nome: 'Ana', nomeBusca: 'ana', cadastradoEm: '2026-09-03',
  criadoEm: null, atualizadoEm: null, atualizadoPor: 'antigo', pendente: false,
}

function enviar() {
  modal.aoEnviar({ preventDefault: vi.fn() } as unknown as SubmitEvent<HTMLFormElement>)
}

beforeEach(() => {
  vi.clearAllMocks()
  simulado.editarCliente.mockReturnValue(true)
})

describe('FormularioCliente — envio da edição', () => {
  it('mantém o formulário aberto se a edição não pôde ser enfileirada', () => {
    simulado.editarCliente.mockReturnValue(false)
    const aoFechar = vi.fn()
    renderToStaticMarkup(createElement(FormularioCliente, { cliente, aoFechar }))
    enviar()
    expect(simulado.editarCliente).toHaveBeenCalledWith(cliente, entradaDoCliente(cliente))
    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('fecha quando o provider aceita a edição', () => {
    const aoFechar = vi.fn()
    renderToStaticMarkup(createElement(FormularioCliente, { cliente, aoFechar }))
    enviar()
    expect(aoFechar).toHaveBeenCalledOnce()
    expect(simulado.criarCliente).not.toHaveBeenCalled()
  })
})
