import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import {
  UID_DONO,
  caminhoCliente,
  clienteComoOAppEscreve,
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

function bancoDono(): Firestore {
  return ambiente.authenticatedContext(UID_DONO).firestore() as unknown as Firestore
}

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
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido()))).toBe('permitido')
  })

  it('aceita os campos opcionais preenchidos', async () => {
    expect(await veredito(setDoc(
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
      ))).toBe('permitido')
  })

  it('aceita rotaId nulo — cliente sem rota é estado normal', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ rotaId: null })))).toBe('permitido')
  })

  it('aceita o documento que o formulário monta com tudo preenchido', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteComoOAppEscreve()))).toBe('permitido')
  })

  it('aceita o documento que o formulário monta com só o obrigatório', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), {
        numero: 138,
        nome: 'João Batista Lima',
        nomeBusca: 'joao batista lima',
        arquivado: false,
        cadastradoEm: '2026-09-03',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        atualizadoPor: 'a3f91c07',
      }))).toBe('permitido')
  })
})

describe('clients — campos obrigatórios', () => {
  const obrigatorios = [
    'numero',
    'nome',
    'nomeBusca',
    'cadastradoEm',
    'criadoEm',
    'atualizadoEm',
    'atualizadoPor',
  ]

  for (const campo of obrigatorios) {
    it(`recusa criação sem ${campo}`, async () => {
      const dados = clienteValido() as Record<string, unknown>
      delete dados[campo]
      expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), dados))).toBe('negado')
    })
  }
})

describe('clients — tipos', () => {
  it('recusa numero como string', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ numero: '7' })))).toBe('negado')
  })

  it('recusa numero fracionário', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ numero: 7.5 })))).toBe('negado')
  })

  it('recusa numero zero ou negativo', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ numero: 0 })))).toBe('negado')
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c2')), clienteValido({ numero: -1 })))).toBe('negado')
  })

  it('recusa nome vazio', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ nome: '' })))).toBe('negado')
  })

  it('recusa nome absurdamente longo', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ nome: 'x'.repeat(121) })))).toBe('negado')
  })

  it('recusa nome que não é string', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ nome: 12345 })))).toBe('negado')
  })

  it('recusa arquivado como string', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ arquivado: 'sim' })))).toBe('negado')
  })

  it('recusa cpfDigits com mais de 11 caracteres', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ cpfDigits: '123456789090' }),
      ))).toBe('negado')
  })
})

describe('clients — cadastradoEm', () => {
  it('aceita datas de calendário bem formadas', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ cadastradoEm: '2026-01-01' }),
      ))).toBe('permitido')
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c2')),
        clienteValido({ cadastradoEm: '2026-12-31' }),
      ))).toBe('permitido')
  })

  it('recusa cadastradoEm que não é string', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ cadastradoEm: new Date('2026-09-03') }),
      ))).toBe('negado')
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c2')),
        clienteValido({ cadastradoEm: serverTimestamp() }),
      ))).toBe('negado')
  })

  const malFormadas = [
    '',
    '2026-9-3',
    '03/09/2026',
    '2026/09/03',
    '2026-09-03T00:00:00Z',
    '2026-09-03 ',
    '26-09-03',
  ]

  for (const valor of malFormadas) {
    it(`recusa cadastradoEm fora do formato: ${JSON.stringify(valor)}`, async () => {
      expect(await veredito(setDoc(
          doc(bancoDono(), caminhoCliente('c1')),
          clienteValido({ cadastradoEm: valor }),
        ))).toBe('negado')
    })
  }

  const foraDoCalendario = ['2026-00-10', '2026-13-01', '2026-01-00', '2026-01-32', '9999-99-99']

  for (const valor of foraDoCalendario) {
    it(`recusa cadastradoEm impossível: ${valor}`, async () => {
      expect(await veredito(setDoc(
          doc(bancoDono(), caminhoCliente('c1')),
          clienteValido({ cadastradoEm: valor }),
        ))).toBe('negado')
    })
  }

  it('aceita 30 de fevereiro — a regra não tem calendário, o dono disso é o formulário', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ cadastradoEm: '2026-02-30' }),
      ))).toBe('permitido')
  })
})

describe('clients — campos desconhecidos', () => {
  it('recusa um campo que ninguém declarou', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ nomeCompleto: 'Maria' })))).toBe('negado')
  })

  it('recusa valor monetário gravado como string em campo não declarado', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ valorPrincipal: '1.234,56' }),
      ))).toBe('negado')
  })
})

describe('clients — carimbos de tempo', () => {
  it('recusa atualizadoEm escolhido pelo dispositivo', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ atualizadoEm: new Date('2020-01-01') }),
      ))).toBe('negado')
  })

  it('recusa criadoEm escolhido pelo dispositivo', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ criadoEm: new Date('2020-01-01') }),
      ))).toBe('negado')
  })
})

describe('clients — edição', () => {
  async function semearValido(clientId: string) {
    await semear(clientId, {
      numero: 7,
      nome: 'Maria Aparecida Santos',
      nomeBusca: 'maria aparecida santos',
      cadastradoEm: '2026-01-01',
      criadoEm: new Date('2026-01-01'),
      atualizadoEm: new Date('2026-01-01'),
      atualizadoPor: 'importacao',
    })
  }

  it('aceita alterar o nome mantendo numero, criadoEm e cadastradoEm', async () => {
    await semearValido('c1')
    expect(await veredito(updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        nome: 'Maria A. Santos',
        nomeBusca: 'maria a. santos',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: 'celular-do-dono',
      }))).toBe('permitido')
  })

  it('recusa alterar o numero', async () => {
    await semearValido('c1')
    expect(await veredito(updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        numero: 8,
        atualizadoEm: serverTimestamp(),
      }))).toBe('negado')
  })

  it('recusa reescrever criadoEm', async () => {
    await semearValido('c1')
    expect(await veredito(updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      }))).toBe('negado')
  })

  it('recusa reescrever cadastradoEm', async () => {
    await semearValido('c1')
    expect(await veredito(updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        cadastradoEm: '2026-09-03',
        atualizadoEm: serverTimestamp(),
      }))).toBe('negado')
  })

  it('recusa edição que não atualiza atualizadoEm', async () => {
    await semearValido('c1')
    expect(await veredito(updateDoc(doc(bancoDono(), caminhoCliente('c1')), { nome: 'Maria A. Santos' }))).toBe('negado')
  })

  it('aceita arquivar em vez de apagar', async () => {
    await semearValido('c1')
    expect(await veredito(updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        arquivado: true,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: 'celular-do-dono',
      }))).toBe('permitido')
  })

  it('aceita desarquivar — o toggle é reversível nos dois sentidos', async () => {
    await semear('c1', {
      numero: 7,
      nome: 'Maria Aparecida Santos',
      nomeBusca: 'maria aparecida santos',
      arquivado: true,
      cadastradoEm: '2026-01-01',
      criadoEm: new Date('2026-01-01'),
      atualizadoEm: new Date('2026-01-01'),
      atualizadoPor: 'importacao',
    })
    expect(await veredito(updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        arquivado: false,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: 'celular-do-dono',
      }))).toBe('permitido')
  })

  it('recusa edição de documento sem cadastradoEm', async () => {
    await semear('c1', {
      numero: 7,
      nome: 'Maria Aparecida Santos',
      nomeBusca: 'maria aparecida santos',
      criadoEm: new Date('2026-01-01'),
      atualizadoEm: new Date('2026-01-01'),
      atualizadoPor: 'importacao',
    })
    expect(await veredito(updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        nome: 'Maria A. Santos',
        nomeBusca: 'maria a. santos',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: 'celular-do-dono',
      }))).toBe('negado')
  })
})

describe('clients — exclusão', () => {
  it('nega delete até para o dono', async () => {
    await semear('c1', {
      numero: 7,
      nome: 'Maria',
      nomeBusca: 'maria',
      cadastradoEm: '2026-01-01',
      criadoEm: new Date('2026-01-01'),
      atualizadoEm: new Date('2026-01-01'),
      atualizadoPor: 'importacao',
    })
    expect(await veredito(deleteDoc(doc(bancoDono(), caminhoCliente('c1'))))).toBe('negado')
  })
})
