import type { DadosDaLoja } from './ambiente'
import { enderecoDoCliente } from './cliente'
import { dataBonita, diferencaEmDias } from './data'
import { formatarCentavos } from './dinheiro'
import type { ParcelaComEstado, Periodicidade, ResumoDaVenda, TaxasDeSimulacao } from './parcelas'
import type { Cliente } from '@/types/cliente'
import type { Pagamento, Venda } from '@/types/venda'

export type EntradaDocumentoDaVenda = {
  loja: DadosDaLoja
  cliente: Pick<Cliente, 'numero' | 'nome' | 'cpf' | 'telefone' | 'rua' | 'bairro' | 'cidade' | 'endereco' | 'referencia'>
  venda: Pick<Venda, 'dataVenda' | 'valorTotalCentavos' | 'itens' | 'numeroParcelas' | 'valorParcelaCentavos' | 'periodicidade'>
  parcelas: readonly ParcelaComEstado[]
}

export function montarDocumentoDaVenda({ loja, cliente, venda, parcelas }: EntradaDocumentoDaVenda) {
  return {
    titulo: 'Comprovante de venda',
    nomeDaLoja: loja.nome,
    cnpj: loja.cnpj ? `CNPJ: ${loja.cnpj}` : undefined,
    telefone: loja.telefone ? `Telefone: ${loja.telefone}` : undefined,
    cliente: `#${cliente.numero} · ${cliente.nome}`,
    cpf: cliente.cpf ? `CPF: ${cliente.cpf}` : undefined,
    contato: cliente.telefone ? `Contato: ${cliente.telefone}` : undefined,
    endereco: enderecoDoCliente(cliente),
    referencia: cliente.referencia ? `Ref.: ${cliente.referencia}` : undefined,
    dataVenda: dataBonita(venda.dataVenda),
    itens: venda.itens?.map((item) => ({
      quantidade: item.quantidade,
      descricao: item.descricao,
      unitario: formatarCentavos(item.valorUnitarioCentavos),
      subtotal: formatarCentavos(item.quantidade * item.valorUnitarioCentavos),
    })),
    total: formatarCentavos(venda.valorTotalCentavos),
    plano: textoDoPlano(venda.numeroParcelas, venda.valorParcelaCentavos, venda.periodicidade),
    vencimentos: parcelas.length < venda.numeroParcelas ? null : [...parcelas]
      .sort((a, b) => a.parcela.numero - b.parcela.numero)
      .map(({ parcela }) => ({
        parcela: `${parcela.numero}/${venda.numeroParcelas}`,
        data: dataBonita(parcela.vencimento),
        valor: formatarCentavos(parcela.valorCentavos),
      })),
  }
}

export type EntradaRecibo = {
  loja: DadosDaLoja
  cliente: Pick<Cliente, 'numero' | 'nome'>
  venda: Pick<Venda, 'dataVenda' | 'valorTotalCentavos' | 'itens'>
  entrada: Pick<Pagamento, 'data' | 'valorCentavos' | 'encargoCentavos' | 'forma'>
  abertoAntesCentavos: number
  proximaCobranca?: string
}

export function montarRecibo({ loja, cliente, venda, entrada, abertoAntesCentavos, proximaCobranca }: EntradaRecibo) {
  const abatimento = Math.max(0, entrada.valorCentavos - (entrada.encargoCentavos ?? 0))
  const restante = Math.max(0, abertoAntesCentavos - abatimento)
  const formas = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }

  return {
    titulo: 'Recibo de pagamento',
    nomeDaLoja: loja.nome,
    cnpj: loja.cnpj ? `CNPJ: ${loja.cnpj}` : undefined,
    telefone: loja.telefone ? `Telefone: ${loja.telefone}` : undefined,
    cliente: `#${cliente.numero} · ${cliente.nome}`,
    recebimento: `Recebemos ${formatarCentavos(entrada.valorCentavos)} em ${dataBonita(entrada.data)} · ${formas[entrada.forma]}`,
    venda: `Venda de ${dataBonita(venda.dataVenda)} · ${formatarCentavos(venda.valorTotalCentavos)}`,
    itens: venda.itens?.map((item) => item.descricao).join(' · '),
    restante: `Restante desta venda: ${formatarCentavos(restante)}`,
    proximaCobranca: proximaCobranca ? `Próxima cobrança: ${dataBonita(proximaCobranca)}` : undefined,
  }
}

export type SituacaoVenda = 'quitada' | 'atrasada' | 'em-dia' | 'cancelada' | 'incompleta'

export type Janela = {
  visiveis: ParcelaComEstado[]
  /** Faixa que ficou de fora depois da janela, `null` quando tudo coube. */
  resto: { de: number; ate: number } | null
}

function plural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`
}

/**
 * `completa` falso quer dizer que parte das parcelas ainda não chegou neste
 * aparelho: o resumo foi somado sobre o que chegou e não serve para dizer
 * "quitada" nem "em dia". A cancelada já está fora do saldo e não entra no aviso.
 */
export function situacaoDaVenda(
  resumo: ResumoDaVenda,
  cancelada = false,
  completa = true,
): SituacaoVenda {
  if (cancelada) return 'cancelada'
  if (!completa) return 'incompleta'
  if (resumo.quitada) return 'quitada'

  return resumo.parcelasVencidas > 0 ? 'atrasada' : 'em-dia'
}

export function pagamentosAtivos(
  pagamentos: readonly { saleId: string; valorCentavos: number; cancelado?: boolean }[],
  saleId: string,
): { quantidade: number; totalCentavos: number } {
  return pagamentos
    .filter((pagamento) => pagamento.saleId === saleId && pagamento.cancelado !== true)
    .reduce(
      (soma, pagamento) => ({
        quantidade: soma.quantidade + 1,
        totalCentavos: soma.totalCentavos + pagamento.valorCentavos,
      }),
      { quantidade: 0, totalCentavos: 0 },
    )
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

/** "10 parcelas" na mensal, que é o padrão; "10 parcelas semanais" na semanal. */
function quantasParcelas(numeroParcelas: number, periodicidade?: Periodicidade): string {
  return periodicidade === 'semanal'
    ? plural(numeroParcelas, 'parcela semanal', 'parcelas semanais')
    : plural(numeroParcelas, 'parcela', 'parcelas')
}

export function textoDoPlano(
  numeroParcelas: number,
  valorParcelaCentavos: number,
  periodicidade?: Periodicidade,
): string {
  return `${quantasParcelas(numeroParcelas, periodicidade)} de ${formatarCentavos(valorParcelaCentavos)}`
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
  periodicidade?: Periodicidade,
): string {
  const pagas = parcelas.filter((item) => item.estado.situacao === 'paga').length

  return `${quantasParcelas(numeroParcelas, periodicidade)} · ${pagas} pagas`
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
