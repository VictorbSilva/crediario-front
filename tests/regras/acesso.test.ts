import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import {
  EMPRESA,
  OUTRA_EMPRESA,
  UID_DONO,
  UID_INTRUSO,
  caminhoCliente,
  clienteValido,
  criarAmbiente,
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

/**
 * O contexto do rules-unit-testing devolve a instância de Firestore do pacote
 * @firebase/firestore. É a mesma em tempo de execução, mas os tipos vêm de
 * caminhos diferentes de módulo — daí a conversão, feita num lugar só.
 */
function bancoDe(contexto: { firestore: () => unknown }): Firestore {
  return contexto.firestore() as Firestore
}

async function semearCliente(clientId: string, empresa = EMPRESA) {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(doc(bancoDe(contexto), caminhoCliente(clientId, empresa)), {
      numero: 1,
      nome: 'Semente',
      nomeBusca: 'semente',
    })
  })
}

describe('acesso — o dono', () => {
  it('lê um cliente da empresa', async () => {
    await semearCliente('c1')
    const banco = bancoDe(ambiente.authenticatedContext(UID_DONO))
    expect(await veredito(getDoc(doc(banco, caminhoCliente('c1'))))).toBe('permitido')
  })

  it('cria um cliente na empresa', async () => {
    const banco = bancoDe(ambiente.authenticatedContext(UID_DONO))
    expect(await veredito(setDoc(doc(banco, caminhoCliente('c1')), clienteValido()))).toBe('permitido')
  })

  it('lê sem ter claim nenhum, que é a situação real dele em produção', async () => {
    await semearCliente('c1')
    const banco = bancoDe(ambiente.authenticatedContext(UID_DONO, {}))
    expect(await veredito(getDoc(doc(banco, caminhoCliente('c1'))))).toBe('permitido')
  })

  it('escreve no documento da própria empresa', async () => {
    const banco = bancoDe(ambiente.authenticatedContext(UID_DONO))
    expect(await veredito(setDoc(doc(banco, `businesses/${EMPRESA}`), { nome: 'Loja' }))).toBe('permitido')
  })
})

describe('acesso — o intruso', () => {
  it('não lê cliente nenhum', async () => {
    await semearCliente('c1')
    const banco = bancoDe(ambiente.authenticatedContext(UID_INTRUSO))
    expect(await veredito(getDoc(doc(banco, caminhoCliente('c1'))))).toBe('negado')
  })

  it('não cria cliente', async () => {
    const banco = bancoDe(ambiente.authenticatedContext(UID_INTRUSO))
    expect(await veredito(setDoc(doc(banco, caminhoCliente('c1')), clienteValido()))).toBe('negado')
  })

  it('não lê o documento da empresa', async () => {
    const banco = bancoDe(ambiente.authenticatedContext(UID_INTRUSO))
    expect(await veredito(getDoc(doc(banco, `businesses/${EMPRESA}`)))).toBe('negado')
  })
})

describe('acesso — sem autenticação', () => {
  it('não lê', async () => {
    await semearCliente('c1')
    const banco = bancoDe(ambiente.unauthenticatedContext())
    expect(await veredito(getDoc(doc(banco, caminhoCliente('c1'))))).toBe('negado')
  })

  it('não escreve', async () => {
    const banco = bancoDe(ambiente.unauthenticatedContext())
    expect(await veredito(setDoc(doc(banco, caminhoCliente('c1')), clienteValido()))).toBe('negado')
  })
})

describe('acesso — funcionário com claim businessId', () => {
  it('lê e escreve na empresa do próprio claim', async () => {
    const contexto = ambiente.authenticatedContext('funcionario-1', { businessId: EMPRESA })
    const banco = bancoDe(contexto)
    expect(await veredito(setDoc(doc(banco, caminhoCliente('c1')), clienteValido()))).toBe('permitido')
    expect(await veredito(getDoc(doc(banco, caminhoCliente('c1'))))).toBe('permitido')
  })

  it('não alcança a empresa de outro claim', async () => {
    await semearCliente('c1', OUTRA_EMPRESA)
    const contexto = ambiente.authenticatedContext('funcionario-1', { businessId: EMPRESA })
    const banco = bancoDe(contexto)
    expect(await veredito(getDoc(doc(banco, caminhoCliente('c1', OUTRA_EMPRESA))))).toBe('negado')
    expect(await veredito(setDoc(doc(banco, caminhoCliente('c2', OUTRA_EMPRESA)), clienteValido()))).toBe('negado')
  })

  it('não escreve no documento da empresa — isso é só do dono', async () => {
    const contexto = ambiente.authenticatedContext('funcionario-1', { businessId: EMPRESA })
    expect(await veredito(setDoc(doc(bancoDe(contexto), `businesses/${EMPRESA}`), { nome: 'Loja renomeada' }))).toBe('negado')
  })
})

describe('acesso — coleções que ainda não nasceram', () => {
  // O curinga `{documento=**}` foi removido em 28/08/2026. Enquanto ele
  // existia, estas escritas passavam — e qualquer regra por-coleção que
  // fosse escrita depois seria inerte, porque no Firestore basta uma regra
  // casada permitir. Estes testes são o que impede o curinga de voltar.
  const caminhosFuturos = [
    `businesses/${EMPRESA}/routes/r1`,
    `businesses/${EMPRESA}/erros/e1`,
  ]

  for (const caminho of caminhosFuturos) {
    it(`nega escrita em ${caminho.split('/')[2]} até a regra dela existir`, async () => {
      const banco = bancoDe(ambiente.authenticatedContext(UID_DONO))
      expect(await veredito(setDoc(doc(banco, caminho), { qualquerCoisa: true }))).toBe('negado')
    })
  }

  it('nega em qualquer profundidade, não só no primeiro nível', async () => {
    const banco = bancoDe(ambiente.authenticatedContext(UID_DONO))
    expect(await veredito(setDoc(doc(banco, `businesses/${EMPRESA}/sales/v1/installments/p1`), { valor: 1 }))).toBe('negado')
  })
})
