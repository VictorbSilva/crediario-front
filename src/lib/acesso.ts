// Os mesmos literais de `ehDono()` e `ehTesteNoTreino()` no firestore.rules e de
// tests/regras/ambiente.ts. Trocar um é trocar os três; ver docs/armadilhas.md.
export const UID_DONO = 'zQKH3lJ6mtYu5uE32PeHcUGZEEs1'
export const UID_TESTE = 'B3HGx0RggpXWzy400742432aLw72'
export const EMPRESA_TREINO = 'loja-treino'

export type Permissoes = { financeiro: boolean; caixaDoDia: boolean; exportar: boolean }

export const PERMISSOES_DO_DONO: Permissoes = { financeiro: true, caixaDoDia: true, exportar: true }

export type Acesso =
  | { estado: 'carregando' }
  | { estado: 'liberado'; dono: boolean; permissoes: Permissoes }
  | { estado: 'sem-acesso'; motivo: 'desativado' | 'sem-cadastro' | 'erro' }

export function ehDonoNoApp(uid: string, businessId: string): boolean {
  return uid === UID_DONO || (uid === UID_TESTE && businessId === EMPRESA_TREINO)
}

function permissoesLidas(valor: unknown): Permissoes {
  const mapa = typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : {}
  return {
    financeiro: mapa.financeiro === true,
    caixaDoDia: mapa.caixaDoDia === true,
    exportar: mapa.exportar === true,
  }
}

export function acessoDoMembro({
  existe,
  doCache,
  dados,
}: {
  existe: boolean
  doCache: boolean
  dados: Record<string, unknown> | undefined
}): Acesso {
  if (!existe) {
    return doCache ? { estado: 'carregando' } : { estado: 'sem-acesso', motivo: 'sem-cadastro' }
  }
  if (dados?.ativo !== true) return { estado: 'sem-acesso', motivo: 'desativado' }
  return { estado: 'liberado', dono: false, permissoes: permissoesLidas(dados.permissoes) }
}
