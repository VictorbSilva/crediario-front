// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { EntradaVenda } from '@/lib/venda'
import { instalarDialogo } from '@/test/dialogo'
import { FormularioVenda } from './FormularioVenda'

// A data da venda é sempre digitada: o padrão do formulário é "hoje", e o teste
// não pode depender do dia em que roda. 10/11/2026 é terça; 16/11/2026, segunda.

function campo(rotulo: RegExp): HTMLInputElement {
  return screen.getByLabelText(rotulo) as HTMLInputElement
}

function digitar(rotulo: RegExp, valor: string) {
  fireEvent.change(campo(rotulo), { target: { value: valor } })
}

function descricaoDe(rotulo: RegExp, sufixo: '-dica' | '-erro'): string | null {
  const id = campo(rotulo)
    .getAttribute('aria-describedby')
    ?.split(' ')
    .find((parte) => parte.endsWith(sufixo))
  return id ? (document.getElementById(id)?.textContent ?? null) : null
}

const COBRAR = /^Cobrar a partir de/
const DATA_VENDA = /^Data da venda/
const DIA = /^Dia do vencimento/

function preencherMensal() {
  digitar(/^Descrição/, 'Jogo de panelas')
  digitar(/^Valor unitário/, '300')
  digitar(/^Parcelas/, '3')
  digitar(DATA_VENDA, '2026-11-10')
  digitar(DIA, '10')
}

function preencherSemanal() {
  digitar(/^Descrição/, 'Jogo de panelas')
  digitar(/^Valor unitário/, '300')
  digitar(/^Parcelas/, '3')
  fireEvent.click(screen.getByRole('radio', { name: 'Semanal' }))
  digitar(DATA_VENDA, '2026-11-16')
}

function previa(): string | null {
  return screen.queryByText(/^Primeira em/)?.textContent ?? null
}

function botaoPadrao() {
  return screen.queryByRole('button', { name: 'Usar o padrão' })
}

let aoSalvar: Mock<(entrada: EntradaVenda) => void>
let aoFechar: Mock<() => void>

beforeEach(() => {
  instalarDialogo()
  aoSalvar = vi.fn()
  aoFechar = vi.fn()
})

afterEach(() => {
  cleanup()
})

function montar() {
  render(<FormularioVenda aoSalvar={aoSalvar} aoFechar={aoFechar} />)
}

describe('FormularioVenda — rodapé do modal', () => {
  it('continua com Cancelar e o envio, e o X fecha sem salvar', () => {
    montar()

    expect(screen.getByRole('button', { name: 'Fechar sem salvar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lançar venda' }).getAttribute('type')).toBe('submit')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })
})

describe('FormularioVenda — Cobrar a partir de', () => {
  it('nasce vazio, opcional, do tipo data e logo depois da data da venda', () => {
    montar()
    const cobrar = campo(COBRAR)
    expect(cobrar.value).toBe('')
    expect(cobrar.type).toBe('date')
    expect(cobrar.labels?.[0].textContent).toContain('opcional')
    const campos = Array.from(document.querySelectorAll('input, textarea'))
    expect(campos.indexOf(cobrar)).toBe(campos.indexOf(campo(DATA_VENDA)) + 1)
  })

  it('vazio na mensal, a dica diz a data padrão e a prévia não muda', () => {
    montar()
    preencherMensal()
    expect(descricaoDe(COBRAR, '-dica')).toBe('Em branco, a primeira vence em 10/12/2026.')
    expect(previa()).toBe('Primeira em 10/12/2026 · última em 10/02/2027')
  })

  it('vazio na semanal, a dica diz a data padrão: 7 dias depois da venda', () => {
    montar()
    preencherSemanal()
    expect(descricaoDe(COBRAR, '-dica')).toBe('Em branco, a primeira vence em 23/11/2026.')
    expect(previa()).toBe('Primeira em 23/11/2026 · última em 07/12/2026')
  })

  it('vazio, sem dica quando não há data padrão', () => {
    montar()
    preencherMensal()
    digitar(DIA, '')
    expect(descricaoDe(COBRAR, '-dica')).toBeNull()

    digitar(DIA, '10')
    digitar(DATA_VENDA, '')
    expect(descricaoDe(COBRAR, '-dica')).toBeNull()
  })

  it('com data escolhida na mensal, a prévia e a dica partem dela', () => {
    montar()
    preencherMensal()
    digitar(COBRAR, '2027-01-05')
    expect(previa()).toBe('Primeira em 05/01/2027 · última em 05/03/2027')
    expect(descricaoDe(COBRAR, '-dica')).toBe('As seguintes vencem todo dia 5.')
  })

  it('com data escolhida na semanal, a prévia e a dica partem dela', () => {
    montar()
    preencherSemanal()
    digitar(COBRAR, '2026-11-25')
    expect(previa()).toBe('Primeira em 25/11/2026 · última em 09/12/2026')
    expect(descricaoDe(COBRAR, '-dica')).toBe('As seguintes vencem toda quarta-feira.')
  })

  it('na mensal com data escolhida, "Dia do vencimento" some e a data da venda perde a dica', () => {
    montar()
    preencherMensal()
    expect(descricaoDe(DATA_VENDA, '-dica')).toBe('A primeira parcela cai no mês seguinte.')

    digitar(COBRAR, '2026-12-11')
    expect(screen.queryByLabelText(DIA)).toBeNull()
    expect(descricaoDe(DATA_VENDA, '-dica')).toBeNull()
  })

  it('na mensal com a própria data padrão, "Dia do vencimento" fica e a dica também', () => {
    montar()
    preencherMensal()
    digitar(COBRAR, '2026-12-10')
    expect(campo(DIA).value).toBe('10')
    expect(descricaoDe(DATA_VENDA, '-dica')).toBe('A primeira parcela cai no mês seguinte.')
  })

  it('na semanal com data escolhida, a data da venda perde a dica do dia da semana', () => {
    montar()
    preencherSemanal()
    expect(descricaoDe(DATA_VENDA, '-dica')).toBe(
      'Vence toda segunda-feira, a primeira em 23/11/2026.',
    )

    digitar(COBRAR, '2026-11-23')
    expect(descricaoDe(DATA_VENDA, '-dica')).toBe(
      'Vence toda segunda-feira, a primeira em 23/11/2026.',
    )

    digitar(COBRAR, '2026-11-25')
    expect(descricaoDe(DATA_VENDA, '-dica')).toBeNull()
  })

  it('data igual ou anterior à venda mostra o erro; o dia seguinte passa', () => {
    montar()
    preencherMensal()

    digitar(COBRAR, '2026-11-10')
    fireEvent.blur(campo(COBRAR))
    expect(descricaoDe(COBRAR, '-erro')).toBe('Tem que ser depois da data da venda')

    digitar(COBRAR, '2026-11-09')
    expect(descricaoDe(COBRAR, '-erro')).toBe('Tem que ser depois da data da venda')

    digitar(COBRAR, '2026-11-11')
    expect(descricaoDe(COBRAR, '-erro')).toBeNull()
  })

  it('o erro só aparece depois de sair do campo ou de tentar lançar', () => {
    montar()
    preencherMensal()
    digitar(COBRAR, '2026-11-10')
    expect(descricaoDe(COBRAR, '-erro')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Lançar venda' }))
    expect(descricaoDe(COBRAR, '-erro')).toBe('Tem que ser depois da data da venda')
    expect(aoSalvar).not.toHaveBeenCalled()
  })

  it('"Usar o padrão" só aparece com data escolhida, esvazia o campo e não lança a venda', () => {
    montar()
    preencherMensal()
    expect(botaoPadrao()).toBeNull()

    digitar(COBRAR, '2027-01-05')
    const botao = botaoPadrao()
    expect(botao?.getAttribute('type')).toBe('button')

    fireEvent.click(botao as HTMLElement)
    expect(campo(COBRAR).value).toBe('')
    expect(botaoPadrao()).toBeNull()
    expect(campo(DIA).value).toBe('10')
    expect(previa()).toBe('Primeira em 10/12/2026 · última em 10/02/2027')
    expect(aoSalvar).not.toHaveBeenCalled()
  })

  it('lança com a data escolhida mesmo com o dia do vencimento escondido e vazio', () => {
    montar()
    preencherMensal()
    digitar(DIA, '')
    digitar(COBRAR, '2027-01-05')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar venda' }))
    expect(aoSalvar).toHaveBeenCalledTimes(1)
    expect(aoSalvar.mock.calls[0][0]).toMatchObject({ primeiroVencimento: '2027-01-05' })
  })
})
