import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { FieldPath, deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import {
  UID_DONO,
  UID_INTRUSO,
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
  it('aceita a edição com remoção dos opcionais e preserva rotaId e os campos fixos', async () => {
    const antes = {
      ...clienteComoOAppEscreve(),
      rotaId: 'rota-centro',
      criadoEm: new Date('2026-09-03'),
      atualizadoEm: new Date('2026-09-03'),
    }
    await semear('c1', antes)
    const referencia = doc(bancoDono(), caminhoCliente('c1'))
    expect(await veredito(updateDoc(referencia, {
      nome: 'Maria Cláudia Santos',
      nomeBusca: 'maria claudia santos',
      telefone: deleteField(),
      telefoneDigits: deleteField(),
      cpf: deleteField(),
      cpfDigits: deleteField(),
      endereco: deleteField(),
      observacao: deleteField(),
      atualizadoPor: 'celular-do-dono',
      atualizadoEm: serverTimestamp(),
    }))).toBe('permitido')
    const depois = (await getDoc(referencia)).data()!
    expect(depois).toMatchObject({
      nome: 'Maria Cláudia Santos', nomeBusca: 'maria claudia santos',
      numero: antes.numero, cadastradoEm: antes.cadastradoEm, arquivado: antes.arquivado,
      rotaId: 'rota-centro', atualizadoPor: 'celular-do-dono',
    })
    expect(depois.criadoEm.toDate()).toEqual(antes.criadoEm)
    for (const campo of ['telefone', 'telefoneDigits', 'cpf', 'cpfDigits', 'endereco', 'observacao']) {
      expect(depois).not.toHaveProperty(campo)
    }
  })

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

describe('clients — rota', () => {
  const rotaCompleta = {
    diasDeVisita: [5, 20],
    rotaDesde: '2026-10-14',
    ordemPorDia: { '5': 1000, '20': 2500.5 },
    ordemDoDia: { data: '2026-10-14', valor: 1500 },
    ultimaMarca: 'ausente',
    ultimaMarcaEm: '2026-10-14',
    ultimoVisitado: '2026-10-05',
    visitadoAnterior: '2026-09-20',
  }

  function bancoIntruso(): Firestore {
    return ambiente.authenticatedContext(UID_INTRUSO).firestore() as unknown as Firestore
  }

  async function semearSemRota(clientId: string, extra: Record<string, unknown> = {}) {
    await semear(clientId, {
      numero: 7,
      nome: 'Maria Aparecida Santos',
      nomeBusca: 'maria aparecida santos',
      cadastradoEm: '2026-01-01',
      criadoEm: new Date('2026-01-01'),
      atualizadoEm: new Date('2026-01-01'),
      atualizadoPor: 'importacao',
      ...extra,
    })
  }

  it('aceita todos os campos de rota preenchidos', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido(rotaCompleta)))).toBe('permitido')
  })

  it('aceita diasDeVisita vazio', async () => {
    expect(await veredito(setDoc(doc(bancoDono(), caminhoCliente('c1')), clienteValido({ diasDeVisita: [] })))).toBe('permitido')
  })

  const diasInvalidos: Array<[string, unknown]> = [
    ['com o dia 0', [0]],
    ['com o dia 32', [32]],
    ['com dia repetido', [5, 5]],
    ['com dia em string', ['5']],
    ['que não é lista', 5],
  ]

  for (const [caso, valor] of diasInvalidos) {
    it(`recusa diasDeVisita ${caso}`, async () => {
      expect(await veredito(setDoc(
          doc(bancoDono(), caminhoCliente('c1')),
          clienteValido({ diasDeVisita: valor }),
        ))).toBe('negado')
    })
  }

  it('recusa rotaDesde fora do formato de data civil', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ rotaDesde: '14/10/2026' }),
      ))).toBe('negado')
  })

  const ordensPorDiaInvalidas: Array<[string, unknown]> = [
    ["com a chave '32'", { '32': 1000 }],
    ["com a chave 'cinco'", { cinco: 1000 }],
    ['que não é mapa', [1000, 2500.5]],
  ]

  for (const [caso, valor] of ordensPorDiaInvalidas) {
    it(`recusa ordemPorDia ${caso}`, async () => {
      expect(await veredito(setDoc(
          doc(bancoDono(), caminhoCliente('c1')),
          clienteValido({ ordemPorDia: valor }),
        ))).toBe('negado')
    })
  }

  const ordensDoDiaInvalidas: Array<[string, unknown]> = [
    ['sem valor', { data: '2026-10-14' }],
    ['com chave extra', { data: '2026-10-14', valor: 1500, dia: 14 }],
    ['com data inválida', { data: '14/10/2026', valor: 1500 }],
    ['com valor em string', { data: '2026-10-14', valor: '1' }],
  ]

  for (const [caso, valor] of ordensDoDiaInvalidas) {
    it(`recusa ordemDoDia ${caso}`, async () => {
      expect(await veredito(setDoc(
          doc(bancoDono(), caminhoCliente('c1')),
          clienteValido({ ordemDoDia: valor }),
        ))).toBe('negado')
    })
  }

  it('recusa ultimaMarca fora de visitado e ausente', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ ultimaMarca: 'pago', ultimaMarcaEm: '2026-10-14' }),
      ))).toBe('negado')
  })

  it('recusa ultimaMarca sem ultimaMarcaEm', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ ultimaMarca: 'visitado' }),
      ))).toBe('negado')
  })

  it('recusa ultimaMarcaEm sem ultimaMarca', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ ultimaMarcaEm: '2026-10-14' }),
      ))).toBe('negado')
  })

  it('recusa visitadoAnterior sem ultimoVisitado', async () => {
    expect(await veredito(setDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        clienteValido({ visitadoAnterior: '2026-09-20' }),
      ))).toBe('negado')
  })

  it('aceita gravar um dia de ordemPorDia por FieldPath em cliente sem rota', async () => {
    await semearSemRota('c1')
    const referencia = doc(bancoDono(), caminhoCliente('c1'))
    expect(await veredito(updateDoc(
        referencia,
        new FieldPath('ordemPorDia', '5'), 1500,
        'atualizadoEm', serverTimestamp(),
      ))).toBe('permitido')
    expect((await getDoc(referencia)).data()!.ordemPorDia).toEqual({ '5': 1500 })
  })

  it('recusa gravar por FieldPath um dia de ordemPorDia que não existe', async () => {
    await semearSemRota('c1')
    expect(await veredito(updateDoc(
        doc(bancoDono(), caminhoCliente('c1')),
        new FieldPath('ordemPorDia', '40'), 1500,
        'atualizadoEm', serverTimestamp(),
      ))).toBe('negado')
  })

  it('aceita remover ultimaMarca e ultimaMarcaEm juntos', async () => {
    await semearSemRota('c1', { ultimaMarca: 'visitado', ultimaMarcaEm: '2026-10-05' })
    expect(await veredito(updateDoc(doc(bancoDono(), caminhoCliente('c1')), {
        ultimaMarca: deleteField(),
        ultimaMarcaEm: deleteField(),
        atualizadoEm: serverTimestamp(),
      }))).toBe('permitido')
  })

  it('recusa intruso gravando diasDeVisita', async () => {
    await semearSemRota('c1')
    expect(await veredito(updateDoc(doc(bancoIntruso(), caminhoCliente('c1')), {
        diasDeVisita: [5],
        atualizadoEm: serverTimestamp(),
      }))).toBe('negado')
  })
})
