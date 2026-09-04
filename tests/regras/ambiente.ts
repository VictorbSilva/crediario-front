import { readFileSync } from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { serverTimestamp } from 'firebase/firestore'

export const PROJETO = 'demo-crediario'

export const EMPRESA = 'loja-principal'
export const OUTRA_EMPRESA = 'loja-do-vizinho'

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

export function clienteValido(extra: Record<string, unknown> = {}) {
  return {
    numero: 7,
    nome: 'Maria Aparecida Santos',
    nomeBusca: 'maria aparecida santos',
    cadastradoEm: '2026-09-03',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    atualizadoPor: 'dispositivo-de-teste',
    ...extra,
  }
}

export function clienteComoOAppEscreve(extra: Record<string, unknown> = {}) {
  return {
    numero: 137,
    nome: 'Maria Aparecida Santos',
    nomeBusca: 'maria aparecida santos',
    telefone: '(11) 98421-0075',
    telefoneDigits: '11984210075',
    cpf: '123.456.789-09',
    cpfDigits: '12345678909',
    endereco: 'Rua das Flores 120, Centro',
    observacao: 'Prefere ser cobrada de manhã.',
    arquivado: false,
    cadastradoEm: '2026-09-03',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    atualizadoPor: 'a3f91c07',
    ...extra,
  }
}
