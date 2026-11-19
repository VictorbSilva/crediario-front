import type { Permissoes } from './acesso'

// Os limites de `tiposValidos()` em `match /membros/{uid}` do firestore.rules. A senha
// não vai para o Firestore: o mínimo de 6 é o do Firebase Auth.
export const LIMITES_MEMBRO = { nome: 80, email: 254, senhaMinima: 6 } as const

// O mesmo padrão da regra: um `@` só, sem espaço. O `\s` do JS recusa mais espaços
// que o do RE2 da regra, então o que passa aqui passa lá.
const PADRAO_EMAIL = /^[^@\s]+@[^@\s]+$/

const CHAVES_DE_PERMISSOES = ['financeiro', 'caixaDoDia', 'exportar'] as const

export type GrupoDePermissao = 'ver' | 'fazer'

export type DescricaoDePermissao = {
  chave: keyof Permissoes
  rotulo: string
  descricao: string
  grupo: GrupoDePermissao
  /** Pinta a linha no tom de perigo. Nenhuma permissão de hoje usa. */
  risco?: true
}

/**
 * As permissões na ordem da tela. Permissão nova entra aqui, com grupo, e ganha ícone em
 * src/components/equipe/iconesDePermissoes.ts; os perfis se montam a partir desta lista.
 * Ver docs/padrao-ui.md, seção Equipe.
 */
export const DESCRICAO_DAS_PERMISSOES: readonly DescricaoDePermissao[] = [
  {
    chave: 'financeiro',
    rotulo: 'Financeiro geral',
    descricao: 'Total a receber, vencidos e clientes em atraso',
    grupo: 'ver',
  },
  {
    chave: 'caixaDoDia',
    rotulo: 'Caixa do dia',
    descricao: 'Quanto entrou em cada dia, por Pix, dinheiro e cartão',
    grupo: 'ver',
  },
  {
    chave: 'exportar',
    rotulo: 'Exportar dados',
    descricao: 'Planilha de clientes e backup completo',
    grupo: 'fazer',
  },
]

export type Perfil = 'cobrador' | 'gerente' | 'personalizado'

/** Cobrador desliga tudo e Gerente liga tudo. Personalizado não tem permissões próprias. */
export function permissoesDoPerfil(perfil: Exclude<Perfil, 'personalizado'>): Permissoes {
  const valor = perfil === 'gerente'
  return Object.fromEntries(
    DESCRICAO_DAS_PERMISSOES.map(({ chave }) => [chave, valor]),
  ) as Permissoes
}

export function perfilDe(permissoes: Permissoes): Perfil {
  const valores = DESCRICAO_DAS_PERMISSOES.map(({ chave }) => permissoes[chave])
  if (valores.every((valor) => !valor)) return 'cobrador'
  if (valores.every((valor) => valor)) return 'gerente'
  return 'personalizado'
}

export type EntradaNovoMembro = {
  nome: string
  email: string
  senha: string
  permissoes: Permissoes
}

export type ErrosNovoMembro = Partial<Record<keyof EntradaNovoMembro, string>>

export type CamposMembro = {
  nome: string
  email: string
  ativo: true
  permissoes: Permissoes
  atualizadoPor: string
}

export type Membro = {
  uid: string
  nome: string
  email: string
  ativo: boolean
  permissoes: Permissoes
  pendente: boolean
}

/** O e-mail como vai para o documento e para a conta: sem espaço em volta, minúsculo. */
function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Só as três chaves, que é o que a regra aceita: `hasOnly` e `hasAll` juntos. */
export function copiarPermissoes(permissoes: Permissoes): Permissoes {
  return {
    financeiro: permissoes.financeiro,
    caixaDoDia: permissoes.caixaDoDia,
    exportar: permissoes.exportar,
  }
}

function erroDoNome(valor: string): string | undefined {
  const nome = valor.trim()

  if (!nome) return 'Digite o nome do funcionário.'
  if (nome.length > LIMITES_MEMBRO.nome) {
    return `Nome muito longo: máximo ${LIMITES_MEMBRO.nome} caracteres.`
  }
  return undefined
}

function erroDoEmail(valor: string): string | undefined {
  const email = normalizarEmail(valor)

  if (!email) return 'Digite o e-mail do funcionário.'
  if (email.length > LIMITES_MEMBRO.email) {
    return `E-mail muito longo: máximo ${LIMITES_MEMBRO.email} caracteres.`
  }
  if (!PADRAO_EMAIL.test(email)) return 'E-mail inválido.'
  return undefined
}

function erroDaSenha(senha: string): string | undefined {
  return senha.length < LIMITES_MEMBRO.senhaMinima
    ? 'Senha fraca: use 6 caracteres ou mais.'
    : undefined
}

function erroDasPermissoes(valor: unknown): string | undefined {
  if (typeof valor !== 'object' || valor === null) return 'Permissões inválidas.'

  const mapa = valor as Record<string, unknown>
  const chaves = Object.keys(mapa)
  const exatas =
    chaves.length === CHAVES_DE_PERMISSOES.length &&
    CHAVES_DE_PERMISSOES.every((chave) => typeof mapa[chave] === 'boolean')

  return exatas ? undefined : 'Permissões inválidas.'
}

export function validarNovoMembro(entrada: EntradaNovoMembro): ErrosNovoMembro {
  const candidatos: ErrosNovoMembro = {
    nome: erroDoNome(entrada.nome),
    email: erroDoEmail(entrada.email),
    senha: erroDaSenha(entrada.senha),
    permissoes: erroDasPermissoes(entrada.permissoes),
  }

  const erros: ErrosNovoMembro = {}
  for (const [campo, erro] of Object.entries(candidatos)) {
    if (erro) erros[campo as keyof EntradaNovoMembro] = erro
  }

  return erros
}

/** Sem `criadoEm` e `atualizadoEm`: os carimbos do servidor são do hook. A senha nunca entra. */
export function montarCamposMembro(
  entrada: EntradaNovoMembro,
  { dispositivo }: { dispositivo: string },
): CamposMembro {
  return {
    nome: entrada.nome.trim(),
    email: normalizarEmail(entrada.email),
    ativo: true,
    permissoes: copiarPermissoes(entrada.permissoes),
    atualizadoPor: dispositivo,
  }
}

export function mensagemDoErroDeCadastro(codigo: string): string {
  switch (codigo) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já tem conta.'
    case 'auth/invalid-email':
      return 'E-mail inválido.'
    case 'auth/weak-password':
      return 'Senha fraca: use 6 caracteres ou mais.'
    case 'auth/network-request-failed':
      return 'Sem internet. Criar a conta precisa de conexão.'
    // A opção "Ativar criação (inscrição)" desligada no console. Ver docs/armadilhas.md,
    // src/data/criarContaDeFuncionario.ts.
    case 'auth/admin-restricted-operation':
      return 'A criação de contas está desligada no Firebase. Ligue em Authentication → Configurações → Ações do usuário.'
    default:
      return 'Não foi possível criar a conta.'
  }
}
