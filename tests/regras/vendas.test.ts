import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import {
  EMPRESA,
  UID_DONO,
  UID_INTRUSO,
  criarAmbiente,
  pagamentoValido,
  parcelaValida,
  vendaValida,
  veredito,
} from './ambiente.ts'

let ambiente: RulesTestEnvironment

beforeAll(async () => {
  ambiente = await criarAmbiente()
})

afterEach(async () => {
  await ambiente.clearFirestore()
})

afterAll(async () => {
  await ambiente.cleanup()
})

function bancoDono(): Firestore {
  return ambiente.authenticatedContext(UID_DONO).firestore() as unknown as Firestore
}

function bancoIntruso(): Firestore {
  return ambiente.authenticatedContext(UID_INTRUSO).firestore() as unknown as Firestore
}

const venda = (id = 'v1') => `businesses/${EMPRESA}/sales/${id}`
const parcela = (id = 'p1') => `businesses/${EMPRESA}/installments/${id}`
const pagamento = (id = 'g1') => `businesses/${EMPRESA}/payments/${id}`

async function semear(caminho: string, dados: Record<string, unknown>) {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    const banco = contexto.firestore() as unknown as Firestore
    await setDoc(doc(banco, caminho), { ...dados, criadoEm: new Date(), atualizadoEm: new Date() })
  })
}

describe('sales — criação', () => {
  it('o dono cria uma venda válida', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida()))).toBe('permitido')
  })

  it('o intruso não cria', async () => {
    expect(await veredito(setDoc(doc(bancoIntruso(), venda()), vendaValida()))).toBe('negado')
  })

  it('recusa campo que não está na lista fechada', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ inventado: 'x' })))).toBe('negado')
  })

  it('recusa venda sem versaoCalculo, que é o que permite recalcular depois', async () => {
    const semVersao: Record<string, unknown> = vendaValida()
    delete semVersao.versaoCalculo
    expect(await veredito(setDoc(doc(bancoDono(), venda()), semVersao))).toBe('negado')
  })

  it('recusa valor zerado ou negativo', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ valorTotalCentavos: 0 })))).toBe('negado')
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ valorParcelaCentavos: -1 })))).toBe('negado')
  })

  it('recusa valor em reais com fração, porque dinheiro é centavo inteiro', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ valorTotalCentavos: 1200.5 })))).toBe('negado')
  })

  it('recusa número de parcelas fora da faixa', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ numeroParcelas: 0 })))).toBe('negado')
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ numeroParcelas: 121 })))).toBe('negado')
  })

  it('recusa dia de vencimento fora do calendário', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ diaVencimento: 0 })))).toBe('negado')
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ diaVencimento: 32 })))).toBe('negado')
  })

  it('recusa data de venda que não é data civil', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ dataVenda: '21/09/2026' })))).toBe('negado')
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ dataVenda: '2026-13-01' })))).toBe('negado')
  })

  it('aceita as taxas de simulação, que são opcionais', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), venda()),
        vendaValida({ multaTipo: 'percentual', multaPercentual: 2, jurosPercentualDia: 0.1 }),
      ))).toBe('permitido')
  })

  it('recusa taxa fora de 0 a 100 e tipo de multa inventado', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ jurosPercentualDia: 101 })))).toBe('negado')
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ multaTipo: 'composto' })))).toBe('negado')
  })

  it('recusa carimbo escolhido pelo aparelho', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), venda()), vendaValida({ criadoEm: new Date(2020, 0, 1) })))).toBe('negado')
  })
})

describe('sales — edição e exclusão', () => {
  it('recusa alterar o que já foi combinado com o cliente', async () => {
    await semear(venda(), vendaValida())
    const banco = bancoDono()

    expect(await veredito(updateDoc(doc(banco, venda()), {
        valorTotalCentavos: 1,
        atualizadoEm: serverTimestamp(),
      }))).toBe('negado')
    expect(await veredito(updateDoc(doc(banco, venda()), { numeroParcelas: 6, atualizadoEm: serverTimestamp() }))).toBe('negado')
  })

  it('aceita mudar só as taxas de simulação', async () => {
    await semear(venda(), vendaValida())

    expect(await veredito(updateDoc(doc(bancoDono(), venda()), {
        multaTipo: 'fixo',
        multaFixaCentavos: 500,
        atualizadoEm: serverTimestamp(),
      }))).toBe('permitido')
  })

  it('nunca apaga', async () => {
    await semear(venda(), vendaValida())
    expect(await veredito(deleteDoc(doc(bancoDono(), venda())))).toBe('negado')
  })
})

describe('installments', () => {
  it('o dono cria uma parcela válida', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), parcela()), parcelaValida()))).toBe('permitido')
  })

  it('o intruso não cria', async () => {
    expect(await veredito(setDoc(doc(bancoIntruso(), parcela()), parcelaValida()))).toBe('negado')
  })

  it('recusa parcela numerada além do total', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), parcela()), parcelaValida({ numero: 13, total: 12 })))).toBe('negado')
  })

  it('recusa vencimento que não é data civil', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), parcela()), parcelaValida({ vencimento: '2026-02-30x' })))).toBe('negado')
  })

  it('recusa parcela aninhada dentro da venda, que é o caminho antigo', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), `${venda()}/installments/p1`), parcelaValida()))).toBe('negado')
  })

  it('recusa alterar vencimento ou valor de parcela já emitida', async () => {
    await semear(parcela(), parcelaValida())
    const banco = bancoDono()

    expect(await veredito(updateDoc(doc(banco, parcela()), { valorCentavos: 1, atualizadoEm: serverTimestamp() }))).toBe('negado')
    expect(await veredito(updateDoc(doc(banco, parcela()), {
        vencimento: '2027-01-19',
        atualizadoEm: serverTimestamp(),
      }))).toBe('negado')
  })

  it('aceita a taxa própria daquela parcela', async () => {
    await semear(parcela(), parcelaValida())

    expect(await veredito(updateDoc(doc(bancoDono(), parcela()), {
        jurosPercentualDia: 0,
        atualizadoEm: serverTimestamp(),
      }))).toBe('permitido')
  })

  it('nunca apaga', async () => {
    await semear(parcela(), parcelaValida())
    expect(await veredito(deleteDoc(doc(bancoDono(), parcela())))).toBe('negado')
  })
})

describe('payments', () => {
  it('o dono registra um pagamento válido', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), pagamento()), pagamentoValido()))).toBe('permitido')
  })

  it('o intruso não registra', async () => {
    expect(await veredito(setDoc(doc(bancoIntruso(), pagamento()), pagamentoValido()))).toBe('negado')
  })

  it('aceita valor livre, que é como o dono recebe de verdade', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ valorCentavos: 5000 })))).toBe('permitido')
  })

  it('recusa valor zerado', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ valorCentavos: 0 })))).toBe('negado')
  })

  it('recusa forma de pagamento fora das três combinadas', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ forma: 'boleto' })))).toBe('negado')
  })

  it('recusa encargo maior que o próprio pagamento', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ encargoCentavos: 5001 })))).toBe('negado')
    expect(await veredito(setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ encargoCentavos: 350 })))).toBe('permitido')
  })

  it('nasce sempre não cancelado', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), pagamento()),
        pagamentoValido({ cancelado: true, canceladoEm: '2026-09-21' }),
      ))).toBe('negado')
  })

  it('recusa canceladoEm em pagamento que não foi cancelado', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ canceladoEm: '2026-09-21' })))).toBe('negado')
  })

  it('cancela registrando a data, sem apagar nada', async () => {
    await semear(pagamento(), pagamentoValido())

    expect(await veredito(updateDoc(doc(bancoDono(), pagamento()), {
        cancelado: true,
        canceladoEm: '2026-09-22',
        atualizadoEm: serverTimestamp(),
      }))).toBe('permitido')
  })

  it('recusa cancelar sem dizer quando', async () => {
    await semear(pagamento(), pagamentoValido())

    expect(await veredito(updateDoc(doc(bancoDono(), pagamento()), {
        cancelado: true,
        atualizadoEm: serverTimestamp(),
      }))).toBe('negado')
  })

  it('recusa reescrever o valor recebido, mesmo junto do cancelamento', async () => {
    await semear(pagamento(), pagamentoValido())

    expect(await veredito(updateDoc(doc(bancoDono(), pagamento()), {
        cancelado: true,
        canceladoEm: '2026-09-22',
        valorCentavos: 9999,
        atualizadoEm: serverTimestamp(),
      }))).toBe('negado')
  })

  it('recusa descancelar, porque estorno também é fato', async () => {
    await semear(pagamento(), pagamentoValido({ cancelado: true, canceladoEm: '2026-09-22' }))

    expect(await veredito(updateDoc(doc(bancoDono(), pagamento()), {
        cancelado: false,
        atualizadoEm: serverTimestamp(),
      }))).toBe('negado')
  })

  it('nunca apaga', async () => {
    await semear(pagamento(), pagamentoValido())
    expect(await veredito(deleteDoc(doc(bancoDono(), pagamento())))).toBe('negado')
  })
})
