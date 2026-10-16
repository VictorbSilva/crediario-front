import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CarneDoCliente } from '@/data/useCarne'
import { formatarCentavos } from '@/lib/dinheiro'
import { montarCarne } from '@/lib/parcelas'
import type { Pagamento, Parcela, Venda } from '@/types/venda'
import { ResumoDeVendas } from './ResumoDeVendas'

const HOJE = '2026-10-15'

function venda(id: string, extras: Partial<Venda> = {}): Venda {
  return {
    id, clientId: 'ana', dataVenda: '2026-08-20', valorTotalCentavos: 20000, numeroParcelas: 2,
    valorParcelaCentavos: 10000, diaVencimento: 10, versaoCalculo: 1, criadoEm: null,
    atualizadoEm: null, atualizadoPor: 'x', pendente: false, ...extras,
  }
}

function parcela(saleId: string, numero: number, vencimento: string): Parcela {
  return {
    id: `${saleId}-${numero}`, clientId: 'ana', saleId, numero, total: 2, vencimento,
    valorCentavos: 10000, criadoEm: null, atualizadoEm: null, atualizadoPor: 'x', pendente: false,
  }
}

const pago: Pagamento = {
  id: 'pg', clientId: 'ana', saleId: 'v1', data: '2026-09-10', valorCentavos: 10000, forma: 'pix',
  cancelado: false, criadoEm: null, atualizadoEm: null, atualizadoPor: 'x', pendente: false,
}

function html(extras: Partial<CarneDoCliente>, vendas: Venda[] = [], parcelas: Parcela[] = [], pagamentos: Pagamento[] = []) {
  const dados = {
    carnes: montarCarne(vendas, parcelas, pagamentos, HOJE),
    carregando: false,
    erro: null,
    ...extras,
  } as CarneDoCliente
  return renderToStaticMarkup(<ResumoDeVendas dados={dados} />)
}

describe('ResumoDeVendas', () => {
  it('erro e carregamento têm mensagem própria', () => {
    expect(html({ erro: 'falhou' })).toContain('Não foi possível carregar o carnê.')
    expect(html({ carregando: true })).toContain('Carregando…')
  })

  it('só lista vendas em aberto, com o saldo de cada uma', () => {
    const v1 = venda('v1')
    const quitada = venda('v2', { numeroParcelas: 1, valorTotalCentavos: 10000 })
    const cancelada = venda('v3', { cancelada: true })
    const saida = html(
      {},
      [v1, quitada, cancelada],
      [parcela('v1', 1, '2026-09-10'), parcela('v1', 2, '2026-10-10'), parcela('v2', 1, '2026-09-10'), parcela('v3', 1, '2026-09-10')],
      [pago, { ...pago, id: 'pg2', saleId: 'v2' }],
    )

    expect(saida.match(/Venda de/g)).toHaveLength(1)
    expect(saida).toContain('2 parcelas · 1 pagas')
    expect(saida).toContain(formatarCentavos(10000))
  })

  it('sem venda em aberto, diz isso', () => {
    expect(html({})).toContain('Nenhuma venda em aberto.')
  })
})
