export type EstadoSync =
  | 'sincronizado'
  | 'sincronizando'
  | 'pendente'
  | 'offline'
  | 'erro'
  | 'nao-configurado'

export type SinaisDeSync = {
  carregando: boolean
  erro: boolean
  pendentes: number
  doCache: boolean
}

export function estadoDeSync({ carregando, erro, pendentes, doCache }: SinaisDeSync): EstadoSync {
  if (carregando) return 'sincronizando'
  if (erro) return 'erro'
  if (doCache) return 'offline'
  if (pendentes > 0) return 'pendente'
  return 'sincronizado'
}

export type ConfiancaDaLista = 'desconhecida' | 'parcial' | 'confiavel'

export type SinaisDaLista = {
  carregando: boolean
  doCache: boolean
  jaSincronizouNesteAparelho: boolean
}

export function confiancaDaLista({
  carregando,
  doCache,
  jaSincronizouNesteAparelho,
}: SinaisDaLista): ConfiancaDaLista {
  if (carregando) return 'desconhecida'
  if (!doCache) return 'confiavel'
  return jaSincronizouNesteAparelho ? 'confiavel' : 'parcial'
}

export function avisoDeConferencia(confianca: ConfiancaDaLista): string | null {
  switch (confianca) {
    case 'desconhecida':
      return 'Esperando a lista de clientes carregar para poder conferir o número.'
    case 'parcial':
      return 'Este aparelho ainda não sincronizou a lista de clientes. Dá para cadastrar, mas a conferência de número repetido não vale nada até a primeira sincronização.'
    case 'confiavel':
      return null
  }
}
