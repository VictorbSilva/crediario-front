// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarneDoCliente as DadosDoCarne } from '@/data/useCarne'
import { formatarCentavos } from '@/lib/dinheiro'
import { montarCarne, saldoDoCliente } from '@/lib/parcelas'
import { instalarDialogo } from '@/test/dialogo'
import type { Pagamento, Parcela, Venda } from '@/types/venda'
import { CarneDoCliente } from './CarneDoCliente'
import { ListaDeParcelas } from './ListaDeParcelas'

const HOJE = '2026-10-15'

// O `getByText` normaliza o espaço não separável que o Intl põe em "R$ 1,00" no texto da
// página, mas não no texto procurado. `toContain` sobre `textContent` usa o valor cru.
const reais = (centavos: number) => formatarCentavos(centavos).replace(/\s/g, ' ')

function venda(id: string, extras: Partial<Venda> = {}): Venda {
  return {
    id, clientId: 'ana', dataVenda: '2026-08-20', valorTotalCentavos: 30000, numeroParcelas: 3,
    valorParcelaCentavos: 10000, diaVencimento: 10, multaTipo: 'percentual', multaPercentual: 2,
    jurosPercentualDia: 0.1, versaoCalculo: 1, criadoEm: null, atualizadoEm: null,
    atualizadoPor: 'x', pendente: false, ...extras,
  }
}

/** Uma parcela por mês a partir de setembro de 2026, no dia de vencimento da venda. */
function parcelasDe(v: Venda, quantas = v.numeroParcelas): Parcela[] {
  return Array.from({ length: quantas }, (_, i) => {
    const mes = 9 + i
    const ano = 2026 + Math.floor((mes - 1) / 12)
    const vencimento = `${ano}-${String(((mes - 1) % 12) + 1).padStart(2, '0')}-${String(v.diaVencimento).padStart(2, '0')}`
    return {
      id: `${v.id}-p${i + 1}`, clientId: 'ana', saleId: v.id, numero: i + 1, total: v.numeroParcelas,
      vencimento, valorCentavos: v.valorParcelaCentavos, criadoEm: null, atualizadoEm: null,
      atualizadoPor: 'x', pendente: false,
    }
  })
}

function pagamento(id: string, saleId: string, extras: Partial<Pagamento> = {}): Pagamento {
  return {
    id, clientId: 'ana', saleId, data: '2026-09-12', valorCentavos: 15000, forma: 'pix',
    cancelado: false, criadoEm: null, atualizadoEm: null, atualizadoPor: 'x', pendente: false,
    ...extras,
  }
}

function dados(
  vendas: Venda[],
  parcelas: Parcela[],
  pagamentos: Pagamento[],
  extras: Partial<DadosDoCarne> = {},
): DadosDoCarne {
  const carnes = montarCarne(vendas, parcelas, pagamentos, HOJE)
  return {
    carnes, pagamentos, saldo: saldoDoCliente(carnes), hoje: HOJE, carregando: false,
    confianca: 'confiavel', erro: null, estadoSync: 'sincronizado', pendentes: 0, falhas: [],
    descartarFalha: vi.fn(), registrarVenda: vi.fn(), registrarPagamento: vi.fn(),
    cancelarPagamento: vi.fn(), cancelarVenda: vi.fn(), ...extras,
  }
}

// R$ 300 em 3×100 com multa de 2% e juros de 0,1% ao dia; pagou R$ 150 em setembro.
// Em 15/10: a 1ª está paga, a 2ª venceu há 5 dias com R$ 50 em aberto, a 3ª vence em novembro.
const V1 = venda('v1')
const PADRAO = () => dados([V1], parcelasDe(V1), [pagamento('pg1', 'v1')])

function abrirVenda(data = '20/08/2026') {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Venda de ${data}`) }))
}

function dialogoAberto(): HTMLElement {
  const dialogo = [...document.querySelectorAll('dialog')].find((d) => d.open)
  if (!dialogo) throw new Error('Nenhum diálogo aberto')
  return dialogo
}

function digitar(rotulo: string | RegExp, valor: string) {
  const campo = within(dialogoAberto()).getByLabelText(rotulo)
  fireEvent.change(campo, { target: { value: valor } })
  fireEvent.blur(campo)
}

beforeEach(() => {
  instalarDialogo()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 12))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('CarneDoCliente — estados da tela', () => {
  it('erro de leitura vira aviso no lugar do carnê', () => {
    render(<CarneDoCliente dados={dados([], [], [], { erro: 'Não foi possível carregar o carnê deste cliente.' })} />)

    expect(screen.getByText('Não foi possível carregar o carnê')).toBeTruthy()
    expect(screen.getByText('Não foi possível carregar o carnê deste cliente.')).toBeTruthy()
  })

  it('carregando, avisa e ainda mostra as escritas recusadas, que podem ser dispensadas', () => {
    const carne = dados([], [], [], {
      carregando: true,
      falhas: [{ id: 'falha-1', mensagem: 'A venda foi recusada pelo servidor.', quando: new Date() }],
    })
    render(<CarneDoCliente dados={carne} />)

    expect(screen.getByText('Carregando o carnê deste cliente…')).toBeTruthy()
    expect(screen.getByText('A venda foi recusada pelo servidor.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(carne.descartarFalha).toHaveBeenCalledWith('falha-1')
  })

  it('sem vendas num carnê confiável, diz que não há venda', () => {
    render(<CarneDoCliente dados={dados([], [], [])} />)

    expect(screen.getByText('Nenhuma venda registrada para este cliente ainda.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nova venda' })).toBeNull()
  })

  it('lista vazia só do cache não é "nenhuma venda": avisa, e o formulário repete o aviso', () => {
    render(<CarneDoCliente dados={dados([], [], [], { confianca: 'parcial' })} permiteEscrita />)

    expect(screen.getByText('Este carnê ainda não foi baixado neste aparelho')).toBeTruthy()
    expect(screen.queryByText('Nenhuma venda registrada para este cliente ainda.')).toBeNull()

    // Avisa, não bloqueia: vender offline num aparelho novo é o caso de uso.
    fireEvent.click(screen.getByRole('button', { name: 'Nova venda' }))
    expect(within(dialogoAberto()).getByText(/Pode haver vendas que só o outro aparelho conhece/)).toBeTruthy()
  })

  it('carnê incompleto neste aparelho avisa que o saldo pode estar menor', () => {
    render(<CarneDoCliente dados={dados([V1], parcelasDe(V1, 2), [])} />)

    expect(screen.getByText(/Parte deste carnê ainda não chegou neste aparelho/)).toBeTruthy()
    expect(screen.getByText('Incompleta neste aparelho')).toBeTruthy()
    // A contagem vem do plano da venda, não do que chegou.
    expect(screen.getByText('0/3 pagas')).toBeTruthy()
  })

  it('basta uma venda incompleta para avisar; venda cancelada incompleta não avisa', () => {
    const outra = venda('v2', { dataVenda: '2026-09-01' })
    render(<CarneDoCliente dados={dados([V1, outra], [...parcelasDe(V1), ...parcelasDe(outra, 1)], [])} />)
    expect(screen.getByText(/Parte deste carnê ainda não chegou/)).toBeTruthy()

    cleanup()
    const cancelada = venda('v2', { dataVenda: '2026-09-01', cancelada: true, canceladaEm: '2026-09-10' })
    render(<CarneDoCliente dados={dados([V1, cancelada], [...parcelasDe(V1), ...parcelasDe(cancelada, 1)], [])} />)
    expect(screen.queryByText(/Parte deste carnê ainda não chegou/)).toBeNull()
  })

  it('carnê completo não avisa nada', () => {
    render(<CarneDoCliente dados={PADRAO()} />)

    expect(screen.queryByText(/Parte deste carnê ainda não chegou/)).toBeNull()
    expect(screen.queryByText('Uma escrita foi recusada')).toBeNull()
  })

  it('com vendas na tela, a lista parcial não repete o aviso de carnê não baixado no formulário', () => {
    render(<CarneDoCliente dados={{ ...PADRAO(), confianca: 'parcial' }} permiteEscrita />)

    fireEvent.click(screen.getByRole('button', { name: 'Nova venda' }))

    expect(within(dialogoAberto()).queryByText(/Pode haver vendas que só o outro aparelho conhece/)).toBeNull()
  })
})

describe('CarneDoCliente — indicadores', () => {
  function kpi(rotulo: string): HTMLElement {
    const elemento = screen.getByText(rotulo).nextElementSibling
    if (!(elemento instanceof HTMLElement)) throw new Error(`Sem KPI ${rotulo}`)
    return elemento
  }

  it('vendas em aberto não contam quitada nem cancelada; vencidas ficam em vermelho', () => {
    // Duas abertas, uma quitada, uma cancelada: contar só a cancelada, ou só a quitada,
    // daria 1; só o critério certo dá 2.
    const outraAberta = venda('v4', { dataVenda: '2026-09-01', valorTotalCentavos: 30000 })
    const quitada = venda('v2', { dataVenda: '2026-07-01', numeroParcelas: 1, valorTotalCentavos: 5000, valorParcelaCentavos: 5000 })
    const cancelada = venda('v3', { dataVenda: '2026-06-01', cancelada: true, canceladaEm: '2026-06-02' })
    render(<CarneDoCliente dados={dados(
      [V1, outraAberta, quitada, cancelada],
      [...parcelasDe(V1), ...parcelasDe(outraAberta), ...parcelasDe(quitada), ...parcelasDe(cancelada)],
      [pagamento('pg1', 'v1'), pagamento('pg2', 'v2', { valorCentavos: 5000 })],
    )} />)

    expect(kpi('Vendas em aberto').textContent).toBe('2')
    // `parcelasDe` gera a partir de setembro. V1: a 2ª (10/10) com R$ 50 em aberto.
    // v4, sem pagamento: 10/09 e 10/10.
    expect(kpi('Parcelas vencidas').textContent).toBe('3')
    expect(kpi('Parcelas vencidas').className).toContain('text-danger')
  })

  it('sem vencida, o KPI de vencidas fica neutro', () => {
    const emDia = venda('v1', { dataVenda: '2026-10-01' })
    const vencimentos = ['2026-11-10', '2026-12-10', '2027-01-10']
    render(<CarneDoCliente dados={dados([emDia], parcelasDe(emDia).map((p, i) => ({ ...p, vencimento: vencimentos[i] })), [])} />)

    expect(kpi('Parcelas vencidas').textContent).toBe('0')
    expect(kpi('Parcelas vencidas').className).toContain('text-slate-900')
  })

  it('o saldo simulado muda de cor, para não passar por valor a cobrar', () => {
    render(<CarneDoCliente dados={PADRAO()} />)
    expect(kpi('Saldo devedor').className).toContain('text-slate-900')

    fireEvent.click(screen.getByRole('checkbox'))
    expect(kpi('Saldo devedor').className).toContain('text-warning')
  })
})

describe('CarneDoCliente — saldo e simulação', () => {
  it('o saldo mostrado por padrão é o valor combinado, sem multa nem juros', () => {
    render(<CarneDoCliente dados={PADRAO()} />)

    const simular = screen.getByRole('checkbox') as HTMLInputElement
    expect(simular.checked).toBe(false)
    expect(screen.getByText(reais(15000))).toBeTruthy()
    expect(screen.getByText('Mostra quanto a dívida daria com os encargos. Não é o valor a cobrar.')).toBeTruthy()
  })

  it('ligar a simulação mostra o total com encargos, sempre dizendo qual é o combinado', () => {
    render(<CarneDoCliente dados={PADRAO()} />)

    fireEvent.click(screen.getByRole('checkbox'))

    // Multa de 2% sobre R$ 50 = R$ 1,00; juros de 0,1% × 5 dias = R$ 0,25.
    expect(screen.getByText(reais(15125))).toBeTruthy()
    expect(
      screen.getByText(
        `O combinado continua sendo ${reais(15000)} — a simulação acrescenta ${reais(125)} e não é cobrança.`,
      ),
    ).toBeTruthy()

    abrirVenda()
    expect(
      screen.getByText(
        `${reais(5000)} + multa ${reais(100)} + juros ${reais(25)} = ${reais(5125)}`,
      ),
    ).toBeTruthy()
  })

  it('com a simulação desligada, nenhuma parcela mostra encargo; ligada, só a vencida', () => {
    render(<CarneDoCliente dados={PADRAO()} />)
    abrirVenda()
    expect(screen.queryByText(/\+ multa/)).toBeNull()

    fireEvent.click(screen.getByRole('checkbox'))

    // Só a 2ª parcela venceu; a que ainda vai vencer não ganha "+ multa R$ 0,00".
    expect(screen.getAllByText(/\+ multa/)).toHaveLength(1)
  })

  it('cada parcela diz quanto foi pago e quanto resta, e a paga diz que está quitada', () => {
    render(<CarneDoCliente dados={PADRAO()} />)
    abrirVenda()
    const [paga, vencida, aVencer] = screen.getAllByRole('listitem')

    expect(within(paga).getByText('quitada, sem acréscimo')).toBeTruthy()
    expect(within(vencida).getByText(`pago ${reais(5000)} · resta ${reais(5000)}`)).toBeTruthy()
    expect(within(aVencer).getByText(`resta ${reais(10000)}`)).toBeTruthy()
    expect(aVencer.textContent).not.toContain('pago')
  })

  it('sem parcela vencida, não oferece simulação', () => {
    const quitada = venda('v2', { numeroParcelas: 1, valorTotalCentavos: 5000, valorParcelaCentavos: 5000 })
    render(<CarneDoCliente dados={dados([quitada], parcelasDe(quitada), [pagamento('pg', 'v2', { valorCentavos: 5000 })])} />)

    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText('Quitada')).toBeTruthy()
  })
})

describe('CarneDoCliente — a venda aberta', () => {
  it('abre e fecha a venda, com as taxas e a situação de cada parcela', () => {
    render(<CarneDoCliente dados={PADRAO()} />)
    const cabecalho = screen.getByRole('button', { name: /Venda de 20\/08\/2026/ })

    expect(cabecalho.getAttribute('aria-expanded')).toBe('false')
    abrirVenda()
    expect(cabecalho.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Multa 2%')).toBeTruthy()
    expect(screen.getByText('Juros 0.1% ao dia')).toBeTruthy()
    expect(screen.getByText('Paga')).toBeTruthy()
    expect(screen.getByText('Vencida há 5 dias')).toBeTruthy()
    expect(screen.getByText('Vence em 26 dias')).toBeTruthy()
    expect(screen.getByText('Atrasada')).toBeTruthy()

    abrirVenda()
    expect(cabecalho.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Vencida há 5 dias')).toBeNull()
  })

  it('no painel só de leitura, não há botão de escrita nenhum', () => {
    render(<CarneDoCliente dados={PADRAO()} />)
    abrirVenda()

    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).toBeNull()
    expect(screen.queryByText('Pagamentos recebidos')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nova venda' })).toBeNull()
  })

  it('carnê longo mostra a janela e deixa abrir todas as parcelas', () => {
    const longa = venda('v3', { numeroParcelas: 6, valorTotalCentavos: 60000 })
    render(<CarneDoCliente dados={dados([longa], parcelasDe(longa), [pagamento('pg', 'v3', { valorCentavos: 10000 })])} />)
    abrirVenda()

    expect(screen.getByText('5/6 a 6/6 · mesmas condições, nada vencido')).toBeTruthy()
    expect(screen.queryByText('6/6')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Ver todas as 6 parcelas' }))
    expect(screen.getByText('6/6')).toBeTruthy()
    expect(screen.queryByText(/mesmas condições/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar só as próximas' }))
    expect(screen.queryByText('6/6')).toBeNull()
  })

  it('carnê que cabe inteiro na janela não oferece "ver todas"', () => {
    render(<CarneDoCliente dados={PADRAO()} />)
    abrirVenda()

    expect(screen.queryByRole('button', { name: /Ver todas/ })).toBeNull()
    expect(screen.queryByText(/mesmas condições/)).toBeNull()
  })

  it('o livro de cada venda mostra só os pagamentos dela', () => {
    const outra = venda('v2', { dataVenda: '2026-09-01' })
    render(<CarneDoCliente dados={dados(
      [V1, outra],
      [...parcelasDe(V1), ...parcelasDe(outra)],
      [pagamento('pg1', 'v1'), pagamento('pg9', 'v2', { valorCentavos: 777, data: '2026-09-30' })],
    )} permiteEscrita />)

    abrirVenda('20/08/2026')

    const livro = screen.getByText('Pagamentos recebidos').parentElement as HTMLElement
    expect(within(livro).getAllByRole('listitem')).toHaveLength(1)
    expect(livro.textContent).not.toContain(formatarCentavos(777))
  })

  it('venda sem pagamento nenhum não mostra o livro vazio', () => {
    render(<CarneDoCliente dados={dados([V1], parcelasDe(V1), [])} permiteEscrita />)
    abrirVenda()

    expect(screen.queryByText('Pagamentos recebidos')).toBeNull()
  })

  it('venda cancelada mostra a data do cancelamento e não oferece cancelar de novo', () => {
    const cancelada = venda('v1', { cancelada: true, canceladaEm: '2026-10-01' })
    render(<CarneDoCliente dados={dados([cancelada], parcelasDe(cancelada), [])} permiteEscrita />)

    expect(screen.getByText('Cancelada em 01/10/2026')).toBeTruthy()
    abrirVenda()
    expect(screen.getByText(/Venda cancelada. Não entra no saldo nem nas vencidas/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).toBeNull()
  })

  it('venda que ainda não subiu aparece como pendente', () => {
    const pendente = venda('v1', { pendente: true })
    render(<CarneDoCliente dados={dados([pendente], parcelasDe(pendente), [])} />)

    expect(screen.getByText('Pendente')).toBeTruthy()
  })
})

describe('CarneDoCliente — registrar pagamento', () => {
  it('o botão fica na parcela e pré-preenche o que falta nela, mas o pagamento vai contra a venda', () => {
    const carne = PADRAO()
    render(<CarneDoCliente dados={carne} permiteEscrita />)
    abrirVenda()

    // Só as parcelas em aberto oferecem o botão.
    const botoes = screen.getAllByRole('button', { name: 'Registrar pagamento' })
    expect(botoes).toHaveLength(2)
    fireEvent.click(botoes[0])

    const dialogo = dialogoAberto()
    expect(within(dialogo).getByText('Parcela 2/3, vencimento 10/10/2026')).toBeTruthy()
    expect((within(dialogo).getByLabelText('Valor recebido') as HTMLInputElement).value).toBe('50,00')
    expect(within(dialogo).getByText(`Falta ${reais(5000)} nesta parcela · ${reais(15000)} na venda toda`)).toBeTruthy()

    fireEvent.click(within(dialogo).getByLabelText('Pix'))
    digitar(/^Observação/, 'pagou na porta')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Lançar pagamento' }))

    expect(carne.registrarPagamento).toHaveBeenCalledWith('v1', {
      data: '2026-10-15', valor: '50,00', forma: 'pix', observacao: 'pagou na porta',
    })
    expect(document.querySelector('dialog[open]')).toBeNull()
  })

  it('valor acima do saldo da venda avisa sem bloquear', () => {
    const carne = PADRAO()
    render(<CarneDoCliente dados={carne} permiteEscrita />)
    abrirVenda()
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar pagamento' })[0])

    digitar('Valor recebido', '1.500,00')

    expect(within(dialogoAberto()).getByText('Valor maior do que o saldo desta venda. Confira antes de lançar.')).toBeTruthy()
    fireEvent.click(within(dialogoAberto()).getByRole('button', { name: 'Lançar pagamento' }))
    expect(carne.registrarPagamento).toHaveBeenCalledTimes(1)
  })

  it('nasce em dinheiro, com hoje, e só acusa erro depois de sair do campo', () => {
    render(<CarneDoCliente dados={PADRAO()} permiteEscrita />)
    abrirVenda()
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar pagamento' })[0])
    const dialogo = dialogoAberto()

    expect(dialogo.textContent).toContain('o lançamento é contra a venda: o sistema cobre da parcela mais antiga')
    expect((within(dialogo).getByLabelText('Dinheiro') as HTMLInputElement).checked).toBe(true)
    expect((within(dialogo).getByLabelText('Pix') as HTMLInputElement).checked).toBe(false)
    expect((within(dialogo).getByLabelText('Data do recebimento') as HTMLInputElement).value).toBe(HOJE)

    fireEvent.change(within(dialogo).getByLabelText('Valor recebido'), { target: { value: '' } })
    fireEvent.change(within(dialogo).getByLabelText('Data do recebimento'), { target: { value: '' } })
    expect(within(dialogo).queryByRole('alert')).toBeNull()

    fireEvent.blur(within(dialogo).getByLabelText('Valor recebido'))
    fireEvent.blur(within(dialogo).getByLabelText('Data do recebimento'))
    expect(within(dialogo).getAllByRole('alert').map((a) => a.textContent)).toEqual(['Informe o valor recebido', 'Data inválida'])
  })

  it('a data escolhida e a observação longa demais chegam ao formulário', () => {
    const carne = PADRAO()
    render(<CarneDoCliente dados={carne} permiteEscrita />)
    abrirVenda()
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar pagamento' })[0])

    digitar(/^Observação/, 'a'.repeat(501))
    expect(within(dialogoAberto()).getByRole('alert').textContent).toBe('Observação muito longa')
    digitar(/^Observação/, '')
    digitar('Data do recebimento', '2026-10-14')
    fireEvent.click(within(dialogoAberto()).getByRole('button', { name: 'Lançar pagamento' }))

    expect(carne.registrarPagamento).toHaveBeenCalledWith('v1', expect.objectContaining({ data: '2026-10-14' }))
  })

  it('valor vazio não sai, e o erro aparece', () => {
    const carne = PADRAO()
    render(<CarneDoCliente dados={carne} permiteEscrita />)
    abrirVenda()
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar pagamento' })[0])

    fireEvent.change(within(dialogoAberto()).getByLabelText('Valor recebido'), { target: { value: '' } })
    fireEvent.click(within(dialogoAberto()).getByRole('button', { name: 'Lançar pagamento' }))

    expect(within(dialogoAberto()).getByRole('alert').textContent).toBe('Informe o valor recebido')
    expect(carne.registrarPagamento).not.toHaveBeenCalled()
  })

  it('fechar sem salvar não lança nada', () => {
    const carne = PADRAO()
    render(<CarneDoCliente dados={carne} permiteEscrita />)
    abrirVenda()
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar pagamento' })[0])

    fireEvent.click(within(dialogoAberto()).getByRole('button', { name: 'Fechar sem salvar' }))

    expect(document.querySelector('dialog')).toBeNull()
    expect(carne.registrarPagamento).not.toHaveBeenCalled()
  })
})

describe('CarneDoCliente — livro de pagamentos', () => {
  const comCancelado = () =>
    dados([V1], parcelasDe(V1), [
      pagamento('pg1', 'v1'),
      pagamento('pg0', 'v1', { data: '2026-09-01', valorCentavos: 2000, forma: 'dinheiro', cancelado: true, canceladoEm: '2026-09-02' }),
      pagamento('pg2', 'v1', { data: '2026-10-01', valorCentavos: 1000, forma: 'cartao', pendente: true }),
    ])

  it('lista do mais novo para o mais antigo, com o cancelado riscado e o pendente marcado', () => {
    render(<CarneDoCliente dados={comCancelado()} permiteEscrita />)
    abrirVenda()

    const itens = within(screen.getByText('Pagamentos recebidos').parentElement as HTMLElement).getAllByRole('listitem')
    expect(itens.map((li) => /Dinheiro|Pix|Cartão/.exec(li.textContent ?? '')?.[0])).toEqual(['Cartão', 'Pix', 'Dinheiro'])
    expect(within(itens[1]).queryByText('Pendente')).toBeNull()
    expect(within(itens[0]).getByText('Pendente')).toBeTruthy()
    expect(within(itens[2]).getByText('Cancelado em 02/09/2026')).toBeTruthy()
    expect(within(itens[2]).queryByRole('button')).toBeNull()
  })

  it('pagamentos do mesmo dia saem numa ordem fixa, não na ordem em que chegaram', () => {
    const mesmoDia = (ordem: string[]) => dados([V1], parcelasDe(V1), ordem.map((id) => pagamento(id, 'v1', { valorCentavos: id === 'pg1' ? 1111 : 2222 })))
    render(<CarneDoCliente dados={mesmoDia(['pg2', 'pg1'])} permiteEscrita />)
    abrirVenda()

    const itens = within(screen.getByText('Pagamentos recebidos').parentElement as HTMLElement).getAllByRole('listitem')
    expect(itens[0].textContent).toContain(formatarCentavos(1111))
  })

  it('cancelar um pagamento pede confirmação e grava a data de hoje', () => {
    const carne = comCancelado()
    render(<CarneDoCliente dados={carne} permiteEscrita />)
    abrirVenda()
    const livro = screen.getByText('Pagamentos recebidos').parentElement as HTMLElement
    const pix = within(livro).getAllByRole('listitem')[1]

    fireEvent.click(within(pix).getByRole('button', { name: 'Cancelar' }))
    expect(within(pix).getByText('Cancelar este lançamento?')).toBeTruthy()
    fireEvent.click(within(pix).getByRole('button', { name: 'Voltar' }))
    expect(within(pix).queryByText('Cancelar este lançamento?')).toBeNull()
    expect(carne.cancelarPagamento).not.toHaveBeenCalled()

    fireEvent.click(within(pix).getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(within(pix).getByRole('button', { name: 'Cancelar' }))
    expect(carne.cancelarPagamento).toHaveBeenCalledWith(expect.objectContaining({ id: 'pg1' }), HOJE)
  })
})

describe('CarneDoCliente — cancelar venda', () => {
  it('confirma antes, avisando que o pagamento recebido não é devolvido', () => {
    const carne = PADRAO()
    render(<CarneDoCliente dados={carne} permiteEscrita />)
    abrirVenda()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar venda' }))
    const dialogo = dialogoAberto()
    expect(within(dialogo).getByText('Cancelar a venda de 20/08/2026?')).toBeTruthy()
    // O leitor de tela anuncia o diálogo pelo título e pela descrição.
    expect(screen.getByRole('dialog', { name: 'Cancelar a venda de 20/08/2026?' })).toBe(dialogo)
    expect(dialogo.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.getElementById(dialogo.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(/^R\$\s300,00 — 3 parcelas de R\$\s100,00/)
    expect(within(dialogo).getByText(/O pagamento já lançado nesta venda \(R\$\s150,00\) continua no histórico/)).toBeTruthy()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Voltar' }))
    expect(document.querySelector('dialog')).toBeNull()
    expect(carne.cancelarVenda).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar venda' }))
    fireEvent.click(within(dialogoAberto()).getByRole('button', { name: 'Cancelar venda' }))
    expect(carne.cancelarVenda).toHaveBeenCalledWith(V1)
    expect(document.querySelector('dialog')).toBeNull()
  })

  it('com vários pagamentos, diz quantos e o total; sem nenhum, não fala de pagamento', () => {
    const dois = dados([V1], parcelasDe(V1), [
      pagamento('pg1', 'v1', { valorCentavos: 5000 }),
      pagamento('pg2', 'v1', { valorCentavos: 2500 }),
    ])
    render(<CarneDoCliente dados={dois} permiteEscrita />)
    abrirVenda()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar venda' }))
    expect(within(dialogoAberto()).getByText(/Os pagamentos já lançados nesta venda \(2, R\$\s75,00\)/)).toBeTruthy()

    cleanup()
    render(<CarneDoCliente dados={dados([V1], parcelasDe(V1), [])} permiteEscrita />)
    abrirVenda()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar venda' }))
    expect(within(dialogoAberto()).queryByText(/pagamento já lançado|pagamentos já lançados/)).toBeNull()
  })
})

describe('CarneDoCliente — nova venda', () => {
  function abrirFormulario(carne = dados([], [], [])) {
    render(<CarneDoCliente dados={carne} permiteEscrita />)
    fireEvent.click(screen.getByRole('button', { name: 'Nova venda' }))
    return carne
  }

  it('a prévia do carnê é a mesma conta que vai ser gravada, com a sobra na última', () => {
    abrirFormulario()

    digitar('Valor total', '100,00')
    digitar('Parcelas', '3')
    digitar('Dia do vencimento', '10')

    const dialogo = dialogoAberto()
    expect(within(dialogo).getByText('Como fica o carnê')).toBeTruthy()
    // Com o espaço entre o valor e o parêntese: sem ele, a frase sai grudada.
    expect(dialogo.textContent).toContain(`3× ${formatarCentavos(3333)} (a última fica ${formatarCentavos(3334)}, com a sobra da divisão)`)
    expect(within(dialogo).getByText('Primeira em 10/11/2026 · última em 10/01/2027')).toBeTruthy()
  })

  it('divisão exata não fala em sobra', () => {
    abrirFormulario()

    digitar('Valor total', '300,00')
    digitar('Parcelas', '3')
    digitar('Dia do vencimento', '10')

    expect(dialogoAberto().textContent).not.toContain('com a sobra da divisão')
  })

  it('abre sem erro nenhum na tela, mesmo com os campos obrigatórios vazios', () => {
    abrirFormulario()

    expect(within(dialogoAberto()).queryByRole('alert')).toBeNull()
    expect(within(dialogoAberto()).queryByText('Confira os campos marcados antes de lançar.')).toBeNull()
  })

  it('cada campo acusa ao sair dele, com a mensagem do próprio campo', () => {
    abrirFormulario()
    const dialogo = dialogoAberto()
    const erroDe = (rotulo: string | RegExp) => {
      const id = within(dialogo).getByLabelText(rotulo).getAttribute('aria-describedby')?.split(' ').find((p) => p.endsWith('-erro'))
      return id ? document.getElementById(id)?.textContent : undefined
    }

    digitar('Valor total', 'abc')
    digitar('Dia do vencimento', '32')
    digitar('Data da venda', '')
    digitar(/^Observação/, 'a'.repeat(501))

    expect(erroDe('Valor total')).toBe('Informe o valor da venda')
    expect(erroDe('Dia do vencimento')).toBe('Entre 1 e 31')
    expect(erroDe('Data da venda')).toBe('Data inválida')
    expect(erroDe(/^Observação/)).toBeTruthy()
  })

  it('a data da venda muda a prévia; data que estoura o ano 9999 some com a prévia', () => {
    abrirFormulario()
    digitar('Valor total', '300,00')
    digitar('Parcelas', '3')
    digitar('Dia do vencimento', '10')

    digitar('Data da venda', '2026-12-20')
    expect(within(dialogoAberto()).getByText('Primeira em 10/01/2027 · última em 10/03/2027')).toBeTruthy()

    digitar('Data da venda', '9999-11-20')
    expect(within(dialogoAberto()).queryByText('Como fica o carnê')).toBeNull()
    expect(within(dialogoAberto()).getByText('Confira o ano: a última parcela passaria do ano 9999.')).toBeTruthy()
  })

  it('multa percentual nasce marcada, e o que se digita nela vai para a venda', () => {
    const carne = abrirFormulario()
    const dialogo = dialogoAberto()
    digitar('Valor total', '300,00')
    digitar('Parcelas', '3')
    digitar('Dia do vencimento', '10')
    fireEvent.click(within(dialogo).getByRole('checkbox'))

    expect((within(dialogo).getByLabelText('Percentual') as HTMLInputElement).checked).toBe(true)
    expect((within(dialogo).getByLabelText('Valor fixo') as HTMLInputElement).checked).toBe(false)
    digitar(/^Multa \(%\)/, '101')
    expect(within(dialogo).getByText('No máximo 100%')).toBeTruthy()
    digitar(/^Multa \(%\)/, '2')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Lançar venda' }))

    expect(carne.registrarVenda).toHaveBeenCalledWith(expect.objectContaining({ cobrarTaxas: true, multaTipo: 'percentual', multaPercentual: '2' }))
  })

  it('a nota "confira os campos" some quando os erros são corrigidos', () => {
    abrirFormulario()
    fireEvent.click(within(dialogoAberto()).getByRole('button', { name: 'Lançar venda' }))
    expect(within(dialogoAberto()).getByText('Confira os campos marcados antes de lançar.')).toBeTruthy()

    digitar('Valor total', '300,00')
    digitar('Parcelas', '3')
    digitar('Dia do vencimento', '10')

    expect(within(dialogoAberto()).queryByText('Confira os campos marcados antes de lançar.')).toBeNull()
  })

  it('lançar sem os campos obrigatórios mostra o que falta e não grava', () => {
    const carne = abrirFormulario()

    fireEvent.click(within(dialogoAberto()).getByRole('button', { name: 'Lançar venda' }))

    expect(within(dialogoAberto()).getByText('Confira os campos marcados antes de lançar.')).toBeTruthy()
    expect(within(dialogoAberto()).getByText('Informe o valor da venda')).toBeTruthy()
    expect(within(dialogoAberto()).queryByText('Como fica o carnê')).toBeNull()
    expect(carne.registrarVenda).not.toHaveBeenCalled()
  })

  it('o erro de um campo só aparece depois que a pessoa sai dele', () => {
    abrirFormulario()
    const dialogo = dialogoAberto()

    fireEvent.change(within(dialogo).getByLabelText('Parcelas'), { target: { value: '0' } })
    expect(within(dialogo).queryByText('Pelo menos uma parcela')).toBeNull()

    fireEvent.blur(within(dialogo).getByLabelText('Parcelas'))
    expect(within(dialogo).getByText('Pelo menos uma parcela')).toBeTruthy()
  })

  it('multa e juros nascem desligados; ligados, aceitam multa percentual ou fixa', () => {
    const carne = abrirFormulario()
    const dialogo = dialogoAberto()
    digitar('Valor total', '300,00')
    digitar('Parcelas', '3')
    digitar('Dia do vencimento', '10')

    const taxas = within(dialogo).getByRole('checkbox') as HTMLInputElement
    expect(taxas.checked).toBe(false)
    expect(within(dialogo).queryByLabelText(/^Juros/)).toBeNull()

    fireEvent.click(taxas)
    expect(within(dialogo).getByLabelText(/^Multa \(%\)/)).toBeTruthy()
    digitar(/^Juros/, '200')
    expect(within(dialogo).getByText('No máximo 100%')).toBeTruthy()
    digitar(/^Juros/, '0,5')

    fireEvent.click(within(dialogo).getByLabelText('Valor fixo'))
    expect(within(dialogo).queryByLabelText(/^Multa \(%\)/)).toBeNull()
    digitar(/^Multa \(R\$\)/, 'cinco')
    expect(within(dialogo).getByText('Valor inválido')).toBeTruthy()
    digitar(/^Multa \(R\$\)/, '5,00')

    fireEvent.click(within(dialogo).getByLabelText('Percentual'))
    expect(within(dialogo).getByLabelText(/^Multa \(%\)/)).toBeTruthy()
    fireEvent.click(within(dialogo).getByLabelText('Valor fixo'))

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Lançar venda' }))

    expect(carne.registrarVenda).toHaveBeenCalledWith(
      expect.objectContaining({
        valor: '300,00', numeroParcelas: '3', diaVencimento: '10', dataVenda: HOJE,
        cobrarTaxas: true, multaTipo: 'fixo', multaFixa: '5,00', jurosPercentualDia: '0,5',
      }),
    )
    expect(document.querySelector('dialog')).toBeNull()
  })

  it('cancelar fecha o formulário sem gravar', () => {
    const carne = abrirFormulario()

    fireEvent.click(within(dialogoAberto()).getByRole('button', { name: 'Cancelar' }))

    expect(document.querySelector('dialog')).toBeNull()
    expect(carne.registrarVenda).not.toHaveBeenCalled()
  })

  it('com carnê existente, o botão de nova venda continua acima das vendas', () => {
    abrirFormulario(PADRAO())

    expect(within(dialogoAberto()).getByText('Nova venda')).toBeTruthy()
    expect(within(dialogoAberto()).queryByText(/Pode haver vendas/)).toBeNull()
  })
})

describe('ListaDeParcelas sozinha', () => {
  const longa = venda('v3', { numeroParcelas: 6, valorTotalCentavos: 60000 })
  const [carne] = montarCarne([longa], parcelasDe(longa), [], HOJE)

  it('a lista completa sai em ordem de número mesmo com as parcelas chegando fora de ordem', () => {
    render(<ListaDeParcelas parcelas={[...carne.parcelas].reverse()} total={6} hoje={HOJE} simulando={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ver todas as 6 parcelas' }))

    expect(screen.getAllByRole('listitem').map((li) => /(\d)\/6/.exec(li.textContent ?? '')?.[1])).toEqual([
      '1', '2', '3', '4', '5', '6',
    ])
  })

  it('a parcela vencida fica em vermelho; a que ainda vai vencer, não', () => {
    render(<ListaDeParcelas parcelas={carne.parcelas} total={6} hoje={HOJE} simulando={false} />)
    // Sem pagamento, a janela mostra 1/6 e 2/6 (vencidas em setembro e outubro) e 3/6, a vencer.
    const [vencida, , aVencer] = screen.getAllByRole('listitem')

    expect(vencida.className).toContain('bg-danger-soft')
    expect(aVencer.className).not.toContain('bg-danger-soft')
  })
})
