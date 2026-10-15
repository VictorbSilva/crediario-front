import { Children, isValidElement } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { SeletorDoDia } from '@/components/rotas/SeletorDoDia'
import { RotasPage } from './RotasPage'

type PropsDoSeletor = ComponentProps<typeof SeletorDoDia>

// `useState` devolve, na ordem de chamada, `escolhida` e `mesVisivel` guardados pelo teste.
const estado = vi.hoisted(() => ({
  valores: [] as unknown[],
  setters: [] as ReturnType<typeof vi.fn>[],
  chamada: 0,
}))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: () => {
    const i = estado.chamada++
    return [estado.valores[i], estado.setters[i]]
  },
  useMemo: (calcular: () => unknown) => calcular(),
}))
vi.mock('@dnd-kit/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@dnd-kit/core')>(),
  useSensor: () => null,
  useSensors: () => [],
}))
vi.mock('@/data/useClientes', () => ({
  useClientes: () => ({
    clientes: [], carregando: false, erro: null, falhas: [],
    descartarFalha: vi.fn(), marcarNaRota: vi.fn(), reordenarRota: vi.fn(),
  }),
}))

function acharSeletor(no: ReactNode): ReactElement<PropsDoSeletor> | undefined {
  for (const filho of Children.toArray(no)) {
    if (!isValidElement<{ children?: ReactNode }>(filho)) continue
    if (filho.type === SeletorDoDia) return filho as ReactElement<PropsDoSeletor>
    const achado = acharSeletor(filho.props.children)
    if (achado) return achado
  }
  return undefined
}

function renderizar(escolhida: string | null, mesVisivel: { ano: number; mes: number }) {
  const setEscolhida = vi.fn()
  const setMesVisivel = vi.fn()
  estado.valores = [escolhida, mesVisivel]
  estado.setters = [setEscolhida, setMesVisivel]
  estado.chamada = 0
  const seletor = acharSeletor(RotasPage())
  if (!seletor) throw new Error('Calendário ausente')
  return { props: seletor.props, setEscolhida, setMesVisivel }
}

describe('RotasPage — app aberto na virada do mês', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 1, 10))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('com outubro guardado e hoje em 1/11, mostra novembro e libera o avanço', () => {
    const { props } = renderizar(null, { ano: 2026, mes: 10 })
    expect([props.ano, props.mes]).toEqual([2026, 11])
    expect(props.escolhida).toBe('2026-11-01')
    expect(props.podeAvancar).toBe(true)
    expect(props.podeVoltar).toBe(false)
  })

  it('uma data escolhida num mês que já passou volta para hoje', () => {
    const { props } = renderizar('2026-10-20', { ano: 2026, mes: 10 })
    expect(props.escolhida).toBe('2026-11-01')
    expect([props.ano, props.mes]).toEqual([2026, 11])
  })

  it('uma data do mês atual escolhida no calendário recuperado continua valendo', () => {
    const { props } = renderizar('2026-11-05', { ano: 2026, mes: 10 })
    expect(props.escolhida).toBe('2026-11-05')
    expect([props.ano, props.mes]).toEqual([2026, 11])
  })

  it('"Próximo mês" recupera o calendário e abre 1/12', () => {
    const { props, setEscolhida, setMesVisivel } = renderizar(null, { ano: 2026, mes: 10 })
    props.aoTrocarMes(1)
    expect(setMesVisivel).toHaveBeenCalledWith({ ano: 2026, mes: 12 })
    expect(setEscolhida).toHaveBeenCalledWith('2026-12-01')
  })

  it('o mês seguinte guardado continua o seguinte, com a volta liberada', () => {
    const { props } = renderizar('2026-12-01', { ano: 2026, mes: 12 })
    expect([props.ano, props.mes]).toEqual([2026, 12])
    expect(props.escolhida).toBe('2026-12-01')
    expect(props.podeVoltar).toBe(true)
    expect(props.podeAvancar).toBe(false)
  })
})
