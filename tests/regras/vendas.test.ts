import { afterAll, afterEach, beforeAll, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
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
    await assertSucceeds(setDoc(doc(bancoDono(), venda()), vendaValida()))
  })

  it('o intruso não cria', async () => {
    await assertFails(setDoc(doc(bancoIntruso(), venda()), vendaValida()))
  })

  it('recusa campo que não está na lista fechada', async () => {
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ inventado: 'x' })))
  })

  it('recusa venda sem versaoCalculo, que é o que permite recalcular depois', async () => {
    const semVersao: Record<string, unknown> = vendaValida()
    delete semVersao.versaoCalculo
    await assertFails(setDoc(doc(bancoDono(), venda()), semVersao))
  })

  it('recusa valor zerado ou negativo', async () => {
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ valorTotalCentavos: 0 })))
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ valorParcelaCentavos: -1 })))
  })

  it('recusa valor em reais com fração, porque dinheiro é centavo inteiro', async () => {
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ valorTotalCentavos: 1200.5 })))
  })

  it('recusa número de parcelas fora da faixa', async () => {
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ numeroParcelas: 0 })))
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ numeroParcelas: 121 })))
  })

  it('recusa dia de vencimento fora do calendário', async () => {
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ diaVencimento: 0 })))
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ diaVencimento: 32 })))
  })

  it('recusa data de venda que não é data civil', async () => {
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ dataVenda: '21/09/2026' })))
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ dataVenda: '2026-13-01' })))
  })

  it('aceita as taxas de simulação, que são opcionais', async () => {
    await assertSucceeds(
      setDoc(
        doc(bancoDono(), venda()),
        vendaValida({ multaTipo: 'percentual', multaPercentual: 2, jurosPercentualDia: 0.1 }),
      ),
    )
  })

  it('recusa taxa fora de 0 a 100 e tipo de multa inventado', async () => {
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ jurosPercentualDia: 101 })))
    await assertFails(setDoc(doc(bancoDono(), venda()), vendaValida({ multaTipo: 'composto' })))
  })

  it('recusa carimbo escolhido pelo aparelho', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), venda()), vendaValida({ criadoEm: new Date(2020, 0, 1) })),
    )
  })
})

describe('sales — edição e exclusão', () => {
  it('recusa alterar o que já foi combinado com o cliente', async () => {
    await semear(venda(), vendaValida())
    const banco = bancoDono()

    await assertFails(
      updateDoc(doc(banco, venda()), {
        valorTotalCentavos: 1,
        atualizadoEm: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(banco, venda()), { numeroParcelas: 6, atualizadoEm: serverTimestamp() }),
    )
  })

  it('aceita mudar só as taxas de simulação', async () => {
    await semear(venda(), vendaValida())

    await assertSucceeds(
      updateDoc(doc(bancoDono(), venda()), {
        multaTipo: 'fixo',
        multaFixaCentavos: 500,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('nunca apaga', async () => {
    await semear(venda(), vendaValida())
    await assertFails(deleteDoc(doc(bancoDono(), venda())))
  })
})

describe('installments', () => {
  it('o dono cria uma parcela válida', async () => {
    await assertSucceeds(setDoc(doc(bancoDono(), parcela()), parcelaValida()))
  })

  it('o intruso não cria', async () => {
    await assertFails(setDoc(doc(bancoIntruso(), parcela()), parcelaValida()))
  })

  it('recusa parcela numerada além do total', async () => {
    await assertFails(setDoc(doc(bancoDono(), parcela()), parcelaValida({ numero: 13, total: 12 })))
  })

  it('recusa vencimento que não é data civil', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), parcela()), parcelaValida({ vencimento: '2026-02-30x' })),
    )
  })

  it('recusa parcela aninhada dentro da venda, que é o caminho antigo', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), `${venda()}/installments/p1`), parcelaValida()),
    )
  })

  it('recusa alterar vencimento ou valor de parcela já emitida', async () => {
    await semear(parcela(), parcelaValida())
    const banco = bancoDono()

    await assertFails(
      updateDoc(doc(banco, parcela()), { valorCentavos: 1, atualizadoEm: serverTimestamp() }),
    )
    await assertFails(
      updateDoc(doc(banco, parcela()), {
        vencimento: '2027-01-19',
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('aceita a taxa própria daquela parcela', async () => {
    await semear(parcela(), parcelaValida())

    await assertSucceeds(
      updateDoc(doc(bancoDono(), parcela()), {
        jurosPercentualDia: 0,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('nunca apaga', async () => {
    await semear(parcela(), parcelaValida())
    await assertFails(deleteDoc(doc(bancoDono(), parcela())))
  })
})

describe('payments', () => {
  it('o dono registra um pagamento válido', async () => {
    await assertSucceeds(setDoc(doc(bancoDono(), pagamento()), pagamentoValido()))
  })

  it('o intruso não registra', async () => {
    await assertFails(setDoc(doc(bancoIntruso(), pagamento()), pagamentoValido()))
  })

  it('aceita valor livre, que é como o dono recebe de verdade', async () => {
    await assertSucceeds(
      setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ valorCentavos: 5000 })),
    )
  })

  it('recusa valor zerado', async () => {
    await assertFails(setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ valorCentavos: 0 })))
  })

  it('recusa forma de pagamento fora das três combinadas', async () => {
    await assertFails(setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ forma: 'boleto' })))
  })

  it('recusa encargo maior que o próprio pagamento', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ encargoCentavos: 5001 })),
    )
    await assertSucceeds(
      setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ encargoCentavos: 350 })),
    )
  })

  it('nasce sempre não cancelado', async () => {
    await assertFails(
      setDoc(
        doc(bancoDono(), pagamento()),
        pagamentoValido({ cancelado: true, canceladoEm: '2026-09-21' }),
      ),
    )
  })

  it('recusa canceladoEm em pagamento que não foi cancelado', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), pagamento()), pagamentoValido({ canceladoEm: '2026-09-21' })),
    )
  })

  it('cancela registrando a data, sem apagar nada', async () => {
    await semear(pagamento(), pagamentoValido())

    await assertSucceeds(
      updateDoc(doc(bancoDono(), pagamento()), {
        cancelado: true,
        canceladoEm: '2026-09-22',
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('recusa cancelar sem dizer quando', async () => {
    await semear(pagamento(), pagamentoValido())

    await assertFails(
      updateDoc(doc(bancoDono(), pagamento()), {
        cancelado: true,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('recusa reescrever o valor recebido, mesmo junto do cancelamento', async () => {
    await semear(pagamento(), pagamentoValido())

    await assertFails(
      updateDoc(doc(bancoDono(), pagamento()), {
        cancelado: true,
        canceladoEm: '2026-09-22',
        valorCentavos: 9999,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('recusa descancelar, porque estorno também é fato', async () => {
    await semear(pagamento(), pagamentoValido({ cancelado: true, canceladoEm: '2026-09-22' }))

    await assertFails(
      updateDoc(doc(bancoDono(), pagamento()), {
        cancelado: false,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('nunca apaga', async () => {
    await semear(pagamento(), pagamentoValido())
    await assertFails(deleteDoc(doc(bancoDono(), pagamento())))
  })
})
