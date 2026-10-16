// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarneDoCliente } from '@/data/useCarne'
import { instalarDialogo } from '@/test/dialogo'
import type { Cliente } from '@/types/cliente'
import { ClientePage } from './ClientePage'

// O `ClientePage.test.ts` prova a `key` do formulário olhando a árvore sem montar.
// Aqui a página monta de verdade, com a rota trocando enquanto o formulário está aberto.

const simulado = vi.hoisted(() => ({
  clientes: [] as Cliente[],
  carregando: false,
  alternarArquivo: vi.fn(),
  useCarne: vi.fn(),
}))

vi.mock('@/data/useClientes', () => ({
  useClientes: () => ({
    clientes: simulado.clientes, carregando: simulado.carregando, alternarArquivo: simulado.alternarArquivo,
    confianca: 'confiavel', criarCliente: vi.fn(), editarCliente: vi.fn(() => true),
  }),
}))
vi.mock('@/data/useCarne', () => ({ useCarne: simulado.useCarne }))

function cliente(id: string, numero: number, nome: string, extras: Partial<Cliente> = {}): Cliente {
  return {
    id, numero, nome, nomeBusca: nome.toLowerCase(), cadastradoEm: '2026-09-03', criadoEm: null,
    atualizadoEm: null, atualizadoPor: 'x', pendente: false, ...extras,
  }
}

const ANA = cliente('ana', 12, 'Ana Lima', { telefone: '(11) 9999-0000' })
const BIA = cliente('bia', 13, 'Bia Souza', { arquivado: true, pendente: true })

const CARNE_VAZIO = {
  carnes: [], pagamentos: [], carregando: false, confianca: 'confiavel', erro: null, falhas: [],
  saldo: { pagoCentavos: 0, abertoCentavos: 0, encargosCentavos: 0, totalComEncargosCentavos: 0, parcelasVencidas: 0, quitada: true },
  hoje: '2026-10-15', estadoSync: 'sincronizado', pendentes: 0, descartarFalha: vi.fn(),
  registrarVenda: vi.fn(), registrarPagamento: vi.fn(), cancelarPagamento: vi.fn(), cancelarVenda: vi.fn(),
} as CarneDoCliente

function IrPara({ destino }: { destino: string }) {
  const navegar = useNavigate()
  return <button type="button" onClick={() => navegar(destino)}>ir para {destino}</button>
}

function montar(caminho: string) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route path="/clientes" element={<p>lista de clientes</p>} />
        <Route path="/clientes/:id" element={<><ClientePage /><IrPara destino="/clientes/bia" /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  instalarDialogo()
  simulado.clientes = [ANA, BIA]
  simulado.carregando = false
  simulado.alternarArquivo.mockReset()
  simulado.useCarne.mockReset().mockReturnValue(CARNE_VAZIO)
})

afterEach(() => {
  cleanup()
})

describe('ClientePage montada', () => {
  it('cliente que ainda não chegou ao aparelho: espera, sem abrir o carnê de ninguém', () => {
    simulado.clientes = []
    simulado.carregando = true
    montar('/clientes/ana')

    expect(screen.getByText('Carregando os clientes deste aparelho…')).toBeTruthy()
    expect(simulado.useCarne).toHaveBeenCalledWith(null)
    expect(simulado.useCarne).not.toHaveBeenCalledWith('ana')
  })

  it('lista carregada sem o cliente: diz que não encontrou, e oferece voltar', () => {
    montar('/clientes/ninguem')

    expect(screen.getByText('Cliente não encontrado')).toBeTruthy()
    expect(simulado.useCarne).toHaveBeenCalledWith(null)
    fireEvent.click(screen.getByRole('link', { name: 'Clientes' }))
    expect(screen.getByText('lista de clientes')).toBeTruthy()
  })

  it('abre a ficha e o carnê do cliente da rota, com escrita liberada', () => {
    montar('/clientes/ana')

    expect(simulado.useCarne).toHaveBeenLastCalledWith('ana')
    expect(screen.getByText('Ana Lima')).toBeTruthy()
    expect(screen.getByText('(11) 9999-0000')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Vendas' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nova venda' })).toBeTruthy()
    expect(screen.queryByText('Arquivado')).toBeNull()
    expect(screen.queryByText('Pendente')).toBeNull()
  })

  it('arquivado e pendente aparecem na ficha; o botão oferece desarquivar', () => {
    montar('/clientes/bia')

    expect(screen.getByText('Arquivado')).toBeTruthy()
    expect(screen.getByText('Pendente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Desarquivar cliente' }))
    expect(simulado.alternarArquivo).toHaveBeenCalledWith(BIA)
  })

  it('"Editar dados" abre a edição preenchida, e fechar a desmonta', () => {
    montar('/clientes/ana')
    expect(document.querySelector('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Editar dados' }))
    const dialogo = document.querySelector('dialog[open]') as HTMLElement
    expect(within(dialogo).getByText('Editar cliente')).toBeTruthy()
    expect((within(dialogo).getByLabelText(/^Nome/) as HTMLInputElement).value).toBe('Ana Lima')

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(document.querySelector('dialog')).toBeNull()
  })

  it('trocar de cliente pela rota com a edição aberta remonta o formulário com o cliente novo', () => {
    montar('/clientes/ana')
    fireEvent.click(screen.getByRole('button', { name: 'Editar dados' }))
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Ana digitada pela metade' } })

    fireEvent.click(screen.getByRole('button', { name: 'ir para /clientes/bia' }))

    expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe('Bia Souza')
    expect(screen.getByText('#13 — o número não muda depois do cadastro.')).toBeTruthy()
    expect(simulado.useCarne).toHaveBeenLastCalledWith('bia')
  })
})
