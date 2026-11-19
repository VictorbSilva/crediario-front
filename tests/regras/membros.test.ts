import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import {
  EMPRESA,
  EMPRESA_TREINO,
  UID_DONO,
  UID_INTRUSO,
  UID_TESTE,
  caminhoMembro,
  criarAmbiente,
  membroValido,
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

const UID_FUNCIONARIO = 'funcionario-1'
const UID_COLEGA = 'funcionario-2'

function bancoDe(uid: string): Firestore {
  return ambiente.authenticatedContext(uid).firestore() as unknown as Firestore
}

const equipe = (empresa = EMPRESA) => `businesses/${empresa}/membros`

async function semearMembro(uid: string, empresa = EMPRESA, extra: Record<string, unknown> = {}) {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    const banco = contexto.firestore() as unknown as Firestore
    await setDoc(doc(banco, caminhoMembro(uid, empresa)), {
      ...membroValido(),
      criadoEm: new Date('2026-11-01T12:00:00Z'),
      atualizadoEm: new Date('2026-11-01T12:00:00Z'),
      ...extra,
    })
  })
}

function edicao(extra: Record<string, unknown> = {}) {
  return { atualizadoEm: serverTimestamp(), atualizadoPor: 'a1b2c3d4', ...extra }
}

describe('membros — o dono gere a equipe', () => {
  it('cria um membro', async () => {
    expect(await veredito(setDoc(doc(bancoDe(UID_DONO), caminhoMembro(UID_FUNCIONARIO)), membroValido()))).toBe('permitido')
  })

  it('lê um membro', async () => {
    await semearMembro(UID_FUNCIONARIO)
    expect(await veredito(getDoc(doc(bancoDe(UID_DONO), caminhoMembro(UID_FUNCIONARIO))))).toBe('permitido')
  })

  it('lista a equipe', async () => {
    await semearMembro(UID_FUNCIONARIO)
    await semearMembro(UID_COLEGA)
    expect(await veredito(getDocs(collection(bancoDe(UID_DONO), equipe())))).toBe('permitido')
  })

  it('atualiza um membro — desativar é ativo: false', async () => {
    await semearMembro(UID_FUNCIONARIO)
    expect(await veredito(updateDoc(doc(bancoDe(UID_DONO), caminhoMembro(UID_FUNCIONARIO)), edicao({ ativo: false })))).toBe('permitido')
  })

  it('atualiza nome e permissões', async () => {
    await semearMembro(UID_FUNCIONARIO)
    const mudanca = edicao({
      nome: 'João B. Lima',
      permissoes: { financeiro: true, caixaDoDia: true, exportar: true },
    })
    expect(await veredito(updateDoc(doc(bancoDe(UID_DONO), caminhoMembro(UID_FUNCIONARIO)), mudanca))).toBe('permitido')
  })

  it('gere a equipe da loja-treino também', async () => {
    expect(await veredito(setDoc(doc(bancoDe(UID_DONO), caminhoMembro(UID_FUNCIONARIO, EMPRESA_TREINO)), membroValido()))).toBe('permitido')
  })
})

describe('membros — a conta de testes', () => {
  it('cria, lê, lista e atualiza na loja-treino', async () => {
    const banco = bancoDe(UID_TESTE)
    const caminho = caminhoMembro(UID_FUNCIONARIO, EMPRESA_TREINO)
    expect(await veredito(setDoc(doc(banco, caminho), membroValido()))).toBe('permitido')
    expect(await veredito(getDoc(doc(banco, caminho)))).toBe('permitido')
    expect(await veredito(getDocs(collection(banco, equipe(EMPRESA_TREINO))))).toBe('permitido')
    expect(await veredito(updateDoc(doc(banco, caminho), edicao({ ativo: false })))).toBe('permitido')
  })

  it('não cria membro na loja-principal', async () => {
    expect(await veredito(setDoc(doc(bancoDe(UID_TESTE), caminhoMembro(UID_FUNCIONARIO)), membroValido()))).toBe('negado')
  })

  it('não lê nem lista membro da loja-principal', async () => {
    await semearMembro(UID_FUNCIONARIO)
    const banco = bancoDe(UID_TESTE)
    expect(await veredito(getDoc(doc(banco, caminhoMembro(UID_FUNCIONARIO))))).toBe('negado')
    expect(await veredito(getDocs(collection(banco, equipe())))).toBe('negado')
  })

  it('não atualiza membro da loja-principal', async () => {
    await semearMembro(UID_FUNCIONARIO)
    expect(await veredito(updateDoc(doc(bancoDe(UID_TESTE), caminhoMembro(UID_FUNCIONARIO)), edicao({ ativo: false })))).toBe('negado')
  })
})

describe('membros — o funcionário', () => {
  it('lê o próprio documento', async () => {
    await semearMembro(UID_FUNCIONARIO)
    expect(await veredito(getDoc(doc(bancoDe(UID_FUNCIONARIO), caminhoMembro(UID_FUNCIONARIO))))).toBe('permitido')
  })

  it('lê o próprio documento mesmo desativado', async () => {
    await semearMembro(UID_FUNCIONARIO, EMPRESA, { ativo: false })
    expect(await veredito(getDoc(doc(bancoDe(UID_FUNCIONARIO), caminhoMembro(UID_FUNCIONARIO))))).toBe('permitido')
  })

  it('não lê o documento de outro membro', async () => {
    await semearMembro(UID_FUNCIONARIO)
    await semearMembro(UID_COLEGA)
    expect(await veredito(getDoc(doc(bancoDe(UID_FUNCIONARIO), caminhoMembro(UID_COLEGA))))).toBe('negado')
  })

  it('não lista a equipe', async () => {
    await semearMembro(UID_FUNCIONARIO)
    await semearMembro(UID_COLEGA)
    expect(await veredito(getDocs(collection(bancoDe(UID_FUNCIONARIO), equipe())))).toBe('negado')
  })

  it('não cria outro membro', async () => {
    await semearMembro(UID_FUNCIONARIO)
    expect(await veredito(setDoc(doc(bancoDe(UID_FUNCIONARIO), caminhoMembro(UID_COLEGA)), membroValido()))).toBe('negado')
  })

  it('não cria o próprio documento', async () => {
    expect(await veredito(setDoc(doc(bancoDe(UID_FUNCIONARIO), caminhoMembro(UID_FUNCIONARIO)), membroValido()))).toBe('negado')
  })

  it('não atualiza o próprio documento para se dar permissão', async () => {
    await semearMembro(UID_FUNCIONARIO)
    const mudanca = edicao({ permissoes: { financeiro: true, caixaDoDia: true, exportar: true } })
    expect(await veredito(updateDoc(doc(bancoDe(UID_FUNCIONARIO), caminhoMembro(UID_FUNCIONARIO)), mudanca))).toBe('negado')
  })

  it('não se reativa depois de desativado', async () => {
    await semearMembro(UID_FUNCIONARIO, EMPRESA, { ativo: false })
    expect(await veredito(updateDoc(doc(bancoDe(UID_FUNCIONARIO), caminhoMembro(UID_FUNCIONARIO)), edicao({ ativo: true })))).toBe('negado')
  })

  it('não atualiza o documento de outro membro', async () => {
    await semearMembro(UID_FUNCIONARIO)
    await semearMembro(UID_COLEGA)
    expect(await veredito(updateDoc(doc(bancoDe(UID_FUNCIONARIO), caminhoMembro(UID_COLEGA)), edicao({ ativo: false })))).toBe('negado')
  })
})

describe('membros — o intruso e quem não entrou', () => {
  it('o intruso não lê, não lista, não cria e não atualiza', async () => {
    await semearMembro(UID_FUNCIONARIO)
    const banco = bancoDe(UID_INTRUSO)
    expect(await veredito(getDoc(doc(banco, caminhoMembro(UID_FUNCIONARIO))))).toBe('negado')
    expect(await veredito(getDocs(collection(banco, equipe())))).toBe('negado')
    expect(await veredito(setDoc(doc(banco, caminhoMembro(UID_INTRUSO)), membroValido()))).toBe('negado')
    expect(await veredito(updateDoc(doc(banco, caminhoMembro(UID_FUNCIONARIO)), edicao({ ativo: false })))).toBe('negado')
  })

  it('sem autenticação não lê nem cria', async () => {
    await semearMembro(UID_FUNCIONARIO)
    const banco = ambiente.unauthenticatedContext().firestore() as unknown as Firestore
    expect(await veredito(getDoc(doc(banco, caminhoMembro(UID_FUNCIONARIO))))).toBe('negado')
    expect(await veredito(setDoc(doc(banco, caminhoMembro(UID_COLEGA)), membroValido()))).toBe('negado')
  })
})

describe('membros — campos e tipos', () => {
  const criar = (dados: Record<string, unknown>) =>
    veredito(setDoc(doc(bancoDe(UID_DONO), caminhoMembro(UID_FUNCIONARIO)), dados))

  it('recusa campo que não está na lista fechada', async () => {
    expect(await criar(membroValido({ papel: 'gerente' }))).toBe('negado')
  })

  it('recusa membro sem campo obrigatório', async () => {
    const semAtivo: Record<string, unknown> = membroValido()
    delete semAtivo.ativo
    expect(await criar(semAtivo)).toBe('negado')
  })

  it('recusa chave extra em permissoes', async () => {
    const permissoes = { financeiro: false, caixaDoDia: false, exportar: false, apagar: true }
    expect(await criar(membroValido({ permissoes }))).toBe('negado')
  })

  it('recusa chave faltando em permissoes', async () => {
    expect(await criar(membroValido({ permissoes: { financeiro: false, caixaDoDia: false } }))).toBe('negado')
  })

  it('recusa permissoes que não é mapa', async () => {
    expect(await criar(membroValido({ permissoes: ['financeiro'] }))).toBe('negado')
  })

  it('recusa valor de permissão que não é bool', async () => {
    expect(await criar(membroValido({ permissoes: { financeiro: 'sim', caixaDoDia: false, exportar: false } }))).toBe('negado')
    expect(await criar(membroValido({ permissoes: { financeiro: false, caixaDoDia: 1, exportar: false } }))).toBe('negado')
    expect(await criar(membroValido({ permissoes: { financeiro: false, caixaDoDia: false, exportar: null } }))).toBe('negado')
  })

  it('recusa ativo que não é bool', async () => {
    expect(await criar(membroValido({ ativo: 'sim' }))).toBe('negado')
  })

  it('recusa nome vazio, longo demais ou que não é string', async () => {
    expect(await criar(membroValido({ nome: '' }))).toBe('negado')
    expect(await criar(membroValido({ nome: 'a'.repeat(81) }))).toBe('negado')
    expect(await criar(membroValido({ nome: 42 }))).toBe('negado')
  })

  it('aceita nome com 80 caracteres', async () => {
    expect(await criar(membroValido({ nome: 'a'.repeat(80) }))).toBe('permitido')
  })

  it('recusa e-mail sem "@"', async () => {
    expect(await criar(membroValido({ email: 'joao.lima.example.com' }))).toBe('negado')
  })

  it('recusa e-mail que não é string', async () => {
    expect(await criar(membroValido({ email: 123 }))).toBe('negado')
  })

  it('recusa atualizadoPor vazio', async () => {
    expect(await criar(membroValido({ atualizadoPor: '' }))).toBe('negado')
  })
})

describe('membros — imutáveis e exclusão', () => {
  it('recusa trocar o email no update', async () => {
    await semearMembro(UID_FUNCIONARIO)
    const mudanca = edicao({ email: 'outro.endereco@example.com' })
    expect(await veredito(updateDoc(doc(bancoDe(UID_DONO), caminhoMembro(UID_FUNCIONARIO)), mudanca))).toBe('negado')
  })

  it('recusa trocar criadoEm no update', async () => {
    await semearMembro(UID_FUNCIONARIO)
    const mudanca = edicao({ criadoEm: serverTimestamp() })
    expect(await veredito(updateDoc(doc(bancoDe(UID_DONO), caminhoMembro(UID_FUNCIONARIO)), mudanca))).toBe('negado')
  })

  it('nega delete, até para o dono', async () => {
    await semearMembro(UID_FUNCIONARIO)
    expect(await veredito(deleteDoc(doc(bancoDe(UID_DONO), caminhoMembro(UID_FUNCIONARIO))))).toBe('negado')
  })

  it('nega delete para a conta de testes na loja-treino', async () => {
    await semearMembro(UID_FUNCIONARIO, EMPRESA_TREINO)
    expect(await veredito(deleteDoc(doc(bancoDe(UID_TESTE), caminhoMembro(UID_FUNCIONARIO, EMPRESA_TREINO))))).toBe('negado')
  })
})
