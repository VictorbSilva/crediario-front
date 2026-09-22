import { diferencaEmDias } from './data'
import { formatarCentavos } from './dinheiro'
import type { ParcelaComEstado, ResumoDaVenda, TaxasDeSimulacao } from './parcelas'

export type SituacaoVenda = 'quitada' | 'atrasada' | 'em-dia'

export type Janela = {
  visiveis: ParcelaComEstado[]
  /** Faixa que ficou de fora depois da janela, `null` quando tudo coube. */
  resto: { de: number; ate: number } | null
}

function plural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`
}

export function situacaoDaVenda(resumo: ResumoDaVenda): SituacaoVenda {
  if (resumo.quitada) return 'quitada'

  return resumo.parcelasVencidas > 0 ? 'atrasada' : 'em-dia'
}

/**
 * A janela de parcelas do protótipo validado: a última paga, a primeira em
 * aberto e as duas seguintes.
 *
 * Um carnê de 12 parcelas não cabe na tela do celular na porta do cliente, e
 * as parcelas antigas já pagas não são o que se olha lá. A numeração (`3/12`)
 * é o que denuncia as que ficaram de fora.
 */
export function janelaDeParcelas(parcelas: readonly ParcelaComEstado[]): Janela {
  const ordenadas = [...parcelas].sort((a, b) => a.parcela.numero - b.parcela.numero)
  const total = ordenadas.length
  if (total === 0) return { visiveis: [], resto: null }

  const encontrada = ordenadas.findIndex((item) => item.estado.restanteCentavos > 0)
  const primeiraAberta = encontrada === -1 ? total : encontrada

  const de = Math.max(0, primeiraAberta - 1)
  const ate = Math.min(total - 1, primeiraAberta + 2)

  return {
    visiveis: ordenadas.slice(de, ate + 1),
    resto:
      ate < total - 1
        ? { de: ordenadas[ate + 1].parcela.numero, ate: ordenadas[total - 1].parcela.numero }
        : null,
  }
}

export function textoDaSituacao(item: ParcelaComEstado, hoje: string): string {
  const { estado, parcela } = item

  if (estado.situacao === 'paga') return 'Paga'
  if (estado.situacao === 'vencida') return `Vencida há ${plural(estado.diasDeAtraso, 'dia', 'dias')}`

  const faltam = diferencaEmDias(hoje, parcela.vencimento)
  const quando = faltam <= 0 ? 'Vence hoje' : `Vence em ${plural(faltam, 'dia', 'dias')}`

  return estado.situacao === 'parcial' ? `Parcial · ${quando.toLowerCase()}` : quando
}

export function textoDoPlano(numeroParcelas: number, valorParcelaCentavos: number): string {
  return `${plural(numeroParcelas, 'parcela', 'parcelas')} de ${formatarCentavos(valorParcelaCentavos)}`
}

/**
 * `total` vem do plano da venda, não de `parcelas.length`: se o cache ainda não
 * entregou todas as parcelas, o tamanho da lista diria "2/3" para um carnê de 12.
 */
export function textoDasPagas(parcelas: readonly ParcelaComEstado[], total: number): string {
  const pagas = parcelas.filter((item) => item.estado.situacao === 'paga').length

  return `${pagas}/${total} pagas`
}

/** A frase curta do painel lateral, que tem 340px e não comporta o valor da parcela. */
export function textoDoPlanoCurto(
  numeroParcelas: number,
  parcelas: readonly ParcelaComEstado[],
): string {
  const pagas = parcelas.filter((item) => item.estado.situacao === 'paga').length

  return `${plural(numeroParcelas, 'parcela', 'parcelas')} · ${pagas} pagas`
}

export function textoDoResto(resto: NonNullable<Janela['resto']>, total: number): string {
  return `${resto.de}/${total} a ${resto.ate}/${total} · mesmas condições, nada vencido`
}

export function textoDaMulta(taxas: TaxasDeSimulacao): string {
  if (taxas.multaTipo === 'fixo') return `Multa ${formatarCentavos(taxas.multaFixaCentavos ?? 0)}`

  return `Multa ${taxas.multaPercentual ?? 0}%`
}

/** Só existe juros por dia — ver a resposta do dono em 21/09/2026. */
export function textoDoJuros(taxas: TaxasDeSimulacao): string {
  return `Juros ${taxas.jurosPercentualDia ?? 0}% ao dia`
}
