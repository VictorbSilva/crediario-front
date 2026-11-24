// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Permissoes } from '@/lib/acesso'
import type { DescricaoDePermissao } from '@/lib/equipe'
import { SeletorDePermissoes } from './SeletorDePermissoes'

function temAsClasses(elemento: Element, classes: string) {
  expect(elemento.className.split(/\s+/)).toEqual(expect.arrayContaining(classes.split(' ')))
}

const simulado = vi.hoisted(() => ({ descricoes: null as DescricaoDePermissao[] | null }))

// Só para o teste de grupo vazio: hoje os dois grupos têm permissão.
vi.mock('@/lib/equipe', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/equipe')>()
  return {
    ...real,
    get DESCRICAO_DAS_PERMISSOES() {
      return simulado.descricoes ?? real.DESCRICAO_DAS_PERMISSOES
    },
  }
})

const NENHUMA: Permissoes = { financeiro: false, caixaDoDia: false, exportar: false, cancelar: false }
const TODAS: Permissoes = { financeiro: true, caixaDoDia: true, exportar: true, cancelar: true }

function montar(permissoes: Permissoes) {
  const aoMudar = vi.fn()
  render(<SeletorDePermissoes permissoes={permissoes} aoMudar={aoMudar} />)
  return aoMudar
}

function perfil(nome: string): HTMLElement {
  return within(screen.getByRole('group', { name: 'Perfil' })).getByRole('button', { name: nome })
}

function interruptor(nome: string): HTMLElement {
  return screen.getByRole('switch', { name: nome })
}

function Controlado({ inicial }: { inicial: Permissoes }) {
  const [permissoes, setPermissoes] = useState(inicial)
  return <SeletorDePermissoes permissoes={permissoes} aoMudar={setPermissoes} />
}

afterEach(() => {
  cleanup()
  simulado.descricoes = null
})

describe('SeletorDePermissoes — estrutura', () => {
  it('de cima para baixo: título, perfis, "Sempre liberado", "Pode ver" e "Pode fazer"', () => {
    const { container } = render(<SeletorDePermissoes permissoes={NENHUMA} aoMudar={vi.fn()} />)

    const titulo = screen.getByRole('heading', { name: 'Permissões' })
    temAsClasses(titulo, 'text-xs font-bold uppercase tracking-wider text-slate-600')

    const ordem = [
      titulo,
      screen.getByRole('group', { name: 'Perfil' }),
      screen.getByText('Sempre liberado'),
      screen.getByText('Pode ver'),
      screen.getByText('Pode fazer'),
    ]
    const todos = Array.from(container.querySelectorAll('*'))
    const posicoes = ordem.map((elemento) => todos.indexOf(elemento))
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b))
  })

  it('"Sempre liberado" é uma faixa fixa, com cadeado, sem interruptor', () => {
    render(<SeletorDePermissoes permissoes={NENHUMA} aoMudar={vi.fn()} />)

    const titulo = screen.getByText('Sempre liberado')
    const texto = screen.getByText('Clientes, Rotas e o carnê de cada cliente')
    const faixa = titulo.closest('.rounded-xl') as HTMLElement

    temAsClasses(faixa, 'rounded-xl border border-brand-100 bg-brand-50')
    expect(titulo.className).toContain('text-brand-800')
    expect(texto.className).toContain('text-brand-700')
    expect(faixa.querySelector('svg')).not.toBeNull()
    expect(within(faixa).queryByRole('switch')).toBeNull()
  })

  it('cada grupo tem subtítulo e um cartão com as suas linhas', () => {
    render(<SeletorDePermissoes permissoes={NENHUMA} aoMudar={vi.fn()} />)

    temAsClasses(screen.getByText('Pode ver'), 'text-[13px] font-semibold text-slate-600')

    const ver = screen.getByRole('group', { name: 'Pode ver' })
    const fazer = screen.getByRole('group', { name: 'Pode fazer' })
    for (const cartao of [ver, fazer]) {
      temAsClasses(cartao, 'rounded-xl border border-slate-200 bg-white overflow-hidden')
      expect(cartao.className).toContain('divide-slate-100')
    }

    expect(within(ver).getAllByRole('switch')).toHaveLength(2)
    expect(within(ver).getByRole('switch', { name: 'Financeiro geral' })).toBeTruthy()
    expect(within(ver).getByRole('switch', { name: 'Caixa do dia' })).toBeTruthy()
    expect(within(ver).getByText('Total a receber, vencidos e clientes em atraso')).toBeTruthy()
    expect(within(fazer).getAllByRole('switch')).toHaveLength(2)
    expect(within(fazer).getByRole('switch', { name: 'Exportar dados' })).toBeTruthy()
  })

  it('Cancelar é a última linha de "Pode fazer", no tom de risco', () => {
    render(<SeletorDePermissoes permissoes={NENHUMA} aoMudar={vi.fn()} />)

    const fazer = screen.getByRole('group', { name: 'Pode fazer' })
    const nomes = within(fazer).getAllByRole('switch').map((botao) => botao.getAttribute('aria-labelledby'))
    const rotulos = nomes.map((id) => document.getElementById(id ?? '')?.textContent)
    expect(rotulos).toEqual(['Exportar dados', 'Cancelar vendas e pagamentos'])

    const cancelar = within(fazer).getByText('Cancelar vendas e pagamentos').closest('label') as HTMLElement
    expect(cancelar.className).toContain('bg-danger-soft')
    expect(within(cancelar).getByText('Cancelamento não se desfaz').className).toContain('text-danger')

    const exportar = within(fazer).getByText('Exportar dados').closest('label') as HTMLElement
    expect(exportar.className).not.toContain('bg-danger-soft')
  })

  it('grupo sem nenhuma permissão não aparece', () => {
    simulado.descricoes = [
      { chave: 'financeiro', rotulo: 'Financeiro geral', descricao: 'd', grupo: 'ver' },
      { chave: 'caixaDoDia', rotulo: 'Caixa do dia', descricao: 'd', grupo: 'ver' },
    ]
    render(<SeletorDePermissoes permissoes={NENHUMA} aoMudar={vi.fn()} />)

    expect(screen.getByText('Pode ver')).toBeTruthy()
    expect(screen.queryByText('Pode fazer')).toBeNull()
    expect(screen.getAllByRole('switch')).toHaveLength(2)
  })

  it('os interruptores mostram as permissões recebidas', () => {
    render(<SeletorDePermissoes permissoes={{ ...NENHUMA, caixaDoDia: true, cancelar: true }} aoMudar={vi.fn()} />)

    expect(interruptor('Financeiro geral').getAttribute('aria-checked')).toBe('false')
    expect(interruptor('Caixa do dia').getAttribute('aria-checked')).toBe('true')
    expect(interruptor('Exportar dados').getAttribute('aria-checked')).toBe('false')
    expect(interruptor('Cancelar vendas e pagamentos').getAttribute('aria-checked')).toBe('true')
  })
})

describe('SeletorDePermissoes — perfis', () => {
  it('três botões em grupo; o ativo vem das permissões', () => {
    const { rerender } = render(<SeletorDePermissoes permissoes={NENHUMA} aoMudar={vi.fn()} />)

    const grupo = screen.getByRole('group', { name: 'Perfil' })
    temAsClasses(grupo, 'grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1')
    expect(within(grupo).getAllByRole('button').map((botao) => botao.textContent)).toEqual([
      'Cobrador', 'Gerente', 'Personalizado',
    ])

    const pressionados = () =>
      within(grupo).getAllByRole('button').filter((botao) => botao.getAttribute('aria-pressed') === 'true')

    expect(pressionados().map((botao) => botao.textContent)).toEqual(['Cobrador'])
    temAsClasses(perfil('Cobrador'), 'bg-white font-bold shadow-sm')
    expect(perfil('Gerente').className).not.toContain('bg-white')

    rerender(<SeletorDePermissoes permissoes={TODAS} aoMudar={vi.fn()} />)
    expect(pressionados().map((botao) => botao.textContent)).toEqual(['Gerente'])

    rerender(<SeletorDePermissoes permissoes={{ ...NENHUMA, exportar: true }} aoMudar={vi.fn()} />)
    expect(pressionados().map((botao) => botao.textContent)).toEqual(['Personalizado'])

    rerender(<SeletorDePermissoes permissoes={{ ...TODAS, cancelar: false }} aoMudar={vi.fn()} />)
    expect(pressionados().map((botao) => botao.textContent)).toEqual(['Personalizado'])
  })

  it('Gerente liga as quatro, inclusive cancelar, e Cobrador desliga tudo', () => {
    const aoMudar = montar({ ...NENHUMA, caixaDoDia: true })

    fireEvent.click(perfil('Gerente'))
    expect(aoMudar).toHaveBeenLastCalledWith(TODAS)

    fireEvent.click(perfil('Cobrador'))
    expect(aoMudar).toHaveBeenLastCalledWith(NENHUMA)
  })

  it('Personalizado não muda nada', () => {
    const aoMudar = montar({ ...NENHUMA, caixaDoDia: true })

    fireEvent.click(perfil('Personalizado'))

    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('cada botão de perfil tem toque mínimo de 44 px', () => {
    render(<SeletorDePermissoes permissoes={NENHUMA} aoMudar={vi.fn()} />)

    for (const nome of ['Cobrador', 'Gerente', 'Personalizado']) {
      expect(perfil(nome).className).toContain('min-h-11')
    }
  })
})

describe('SeletorDePermissoes — interruptores', () => {
  it('mexer num interruptor devolve as permissões com só aquela chave trocada', () => {
    const aoMudar = montar({ ...NENHUMA, exportar: true })

    fireEvent.click(interruptor('Caixa do dia'))

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith({ financeiro: false, caixaDoDia: true, exportar: true, cancelar: false })
  })

  it('os perfis ligam e desligam os interruptores, e mexer num depois de Cobrador vira Personalizado', () => {
    render(<Controlado inicial={{ ...NENHUMA, exportar: true }} />)
    const ligados = () =>
      screen.getAllByRole('switch').filter((botao) => botao.getAttribute('aria-checked') === 'true').length

    fireEvent.click(perfil('Gerente'))
    expect(ligados()).toBe(4)
    expect(perfil('Gerente').getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(perfil('Cobrador'))
    expect(ligados()).toBe(0)
    expect(perfil('Cobrador').getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByText('Caixa do dia'))
    expect(ligados()).toBe(1)
    expect(perfil('Personalizado').getAttribute('aria-pressed')).toBe('true')
    expect(perfil('Cobrador').getAttribute('aria-pressed')).toBe('false')
  })
})
