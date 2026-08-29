import { readFileSync } from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { serverTimestamp } from 'firebase/firestore'

/**
 * Projeto com prefixo `demo-`: o SDK reconhece esse prefixo como projeto de
 * emulador e recusa qualquer chamada de rede para produção. É a garantia de
 * que um teste de regra nunca escreve na base real.
 */
export const PROJETO = 'demo-crediario'

export const EMPRESA = 'loja-principal'
export const OUTRA_EMPRESA = 'loja-do-vizinho'

/** UID real do dono, o mesmo que está literal em firestore.rules. */
export const UID_DONO = 'B3HGx0RggpXWzy400742432aLw72'
export const UID_INTRUSO = 'intruso-sem-vinculo-nenhum'

export function criarAmbiente(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJETO,
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
}

export function caminhoCliente(clientId: string, empresa = EMPRESA): string {
  return `businesses/${empresa}/clients/${clientId}`
}

/**
 * Documento de cliente que passa em todas as validações. Os testes de schema
 * partem daqui e estragam um campo por vez — assim a causa da recusa é sempre
 * o campo em questão, e não uma segunda coisa errada que ninguém percebeu.
 */
export function clienteValido(extra: Record<string, unknown> = {}) {
  return {
    numero: 7,
    nome: 'Maria Aparecida Santos',
    nomeBusca: 'maria aparecida santos',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    atualizadoPor: 'dispositivo-de-teste',
    ...extra,
  }
}
