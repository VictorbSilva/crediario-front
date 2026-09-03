import { afterAll, afterEach, beforeAll, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { UID_DONO, caminhoCliente, clienteValido, criarAmbiente } from './ambiente.ts'

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
  // O contexto devolve a instancia do SDK compat; em tempo de execucao e a
  // mesma, mas os tipos vem de caminhos de modulo diferentes.
  return ambiente.authenticatedContext(UID_DONO).firestore() as unknown as Firestore
}

/** Grava direto, sem passar pelas regras, para montar o estado de partida. */
async function semear(clientId: string, dados: Record<string, unknown>) {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(
      doc(contexto.firestore() as unknown as Firestore, caminhoCliente(clientId)),
      dados,
    )
  })
}

describe('clients — criação válida', () => {
  it('aceita o documento mínimo', async () => {
    await assertSucceeds(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido()),
    )
  })

  it('aceita os campos opcionais preenchidos', async () => {
    await assertSucceeds(
      setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({
          telefone: '(11) 98421-0075',
          telefoneDigits: '11984210075',
          cpf: '123.456.789-09',
          cpfDigits: '12345678909',
          endereco: 'Rua das Flores 120, Centro',
          rotaId: 'rota-centro',
          observacao: 'Prefere ser cobrada de manhã.',
          arquivado: false,
        }),
      ),
    )
  })

  it('aceita rotaId nulo — cliente sem rota é estado normal', async () => {
    await assertSucceeds(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ rotaId: null })),
    )
  })
})

describe('clients — campos obrigatórios', () => {
  const obrigatorios = ['numero', 'nome', 'nomeBusca', 'criadoEm', 'atualizadoEm', 'atualizadoPor']

  for (const campo of obrigatorios) {
    it(`recusa criação sem ${campo}`, async () => {
      const dados = clienteValido() as Record<string, unknown>
      delete dados[campo]
      await assertFails(setDoc(doc(bancoDono(), caminhoCliente('c1')), dados))
    })
  }
})

describe('clients — tipos', () => {
  it('recusa numero como string', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ numero: '7' })),
    )
  })

  it('recusa numero fracionário', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ numero: 7.5 })),
    )
  })

  it('recusa numero zero ou negativo', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ numero: 0 })),
    )
    await assertFails(
      setDoc(doc(bancoDono(), caminhoCliente('c2')), clienteValido({ numero: -1 })),
    )
  })

  it('recusa nome vazio', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ nome: '' })),
    )
  })

  it('recusa nome absurdamente longo', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ nome: 'x'.repeat(121) })),
    )
  })

  it('recusa nome que não é string', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ nome: 12345 })),
    )
  })

  it('recusa arquivado como string', async () => {
    await assertFails(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ arquivado: 'sim' })),
    )
  })

  it('recusa cpfDigits com mais de 11 caracteres', async () => {
    await assertFails(
      setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ cpfDigits: '123456789090' }),
      ),
    )
  })
})

describe('clients — campos desconhecidos', () => {
  it('recusa um campo que ninguém declarou', async () => {
    // Sem Cloud Functions, esta lista fechada é a única coisa entre um typo
    // de campo e 700 documentos tortos.
    await assertFails(
      setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ nomeCompleto: 'Maria' })),
    )
  })

  it('recusa valor monetário gravado como string em campo não declarado', async () => {
    await assertFails(
      setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ valorPrincipal: '1.234,56' }),
      ),
    )
  })
})

describe('clients — carimbos de tempo', () => {
  it('recusa atualizadoEm escolhido pelo dispositivo', async () => {
    await assertFails(
      setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ atualizadoEm: new Date('2020-01-01') }),
      ),
    )
  })

  it('recusa criadoEm escolhido pelo dispositivo', async () => {
    await assertFails(
      setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ criadoEm: new Date('2020-01-01') }),
      ),
    )
  })
})

describe('clients — edição', () => {
  async function semearValido(clientId: string) {
    await semear(clientId, {
      numero: 7,
      nome: 'Maria Aparecida Santos',
      nomeBusca: 'maria aparecida santos',
      criadoEm: new Date('2026-01-01'),
      atualizadoEm: new Date('2026-01-01'),
      atualizadoPor: 'importacao',
    })
  }

  it('aceita alterar o nome mantendo numero e criadoEm', async () => {
    await semearValido('c1')
    await assertSucceeds(
      updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        nome: 'Maria A. Santos',
        nomeBusca: 'maria a. santos',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: 'celular-do-dono',
      }),
    )
  })

  it('recusa alterar o numero', async () => {
    await semearValido('c1')
    await assertFails(
      updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        numero: 8,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('recusa reescrever criadoEm', async () => {
    await semearValido('c1')
    await assertFails(
      updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('recusa edição que não atualiza atualizadoEm', async () => {
    await semearValido('c1')
    await assertFails(
      updateDoc(doc(bancoDono(), caminhoCliente('c1')), { nome: 'Maria A. Santos' }),
    )
  })

  it('aceita arquivar em vez de apagar', async () => {
    await semearValido('c1')
    await assertSucceeds(
      updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        arquivado: true,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: 'celular-do-dono',
      }),
    )
  })
})

describe('clients — exclusão', () => {
  it('nega delete até para o dono', async () => {
    await semear('c1', {
      numero: 7,
      nome: 'Maria',
      nomeBusca: 'maria',
      criadoEm: new Date('2026-01-01'),
      atualizadoEm: new Date('2026-01-01'),
      atualizadoPor: 'importacao',
    })
    await assertFails(deleteDoc(doc(bancoDono(), caminhoCliente('c1'))))
  })
})
