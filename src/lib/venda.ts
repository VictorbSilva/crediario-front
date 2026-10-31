import { dataLocalISO, ehDataCivil, vencimentoDaParcela } from './data'
import { parseReaisParaCentavos } from './dinheiro'
import { VERSAO_CALCULO, gerarParcelas } from './parcelas'
import type { FormaDePagamento, ItemDaVenda, TipoDeMulta } from '@/types/venda'

export const LIMITES_VENDA = {
  /** O teto vem da regra do Firestore, que recusa acima disso. */
  numeroParcelas: 120,
  diaVencimento: 31,
  taxa: 100,
  observacao: 500,
  /** Teto da regra. Quantidade e descrição a regra não confere: o teto é só daqui. */
  itens: 30,
  quantidadeItem: 999,
  descricaoItem: 120,
} as const

export type ContextoEscrita = {
  agora: Date
  dispositivo: string
}

export type EntradaItem = {
  quantidade: string
  descricao: string
  valorUnitario: string
}

export type ErrosItem = Partial<Record<keyof EntradaItem, string>>

export type ErrosItens = {
  porItem: ErrosItem[]
  geral?: string
}

export type EntradaVenda = {
  dataVenda: string
  itens: EntradaItem[]
  numeroParcelas: string
  diaVencimento: string
  cobrarTaxas: boolean
  multaTipo: TipoDeMulta
  multaPercentual: string
  multaFixa: string
  jurosPercentualDia: string
  observacao: string
}

export type ErrosVenda = Partial<Record<keyof EntradaVenda, string>>

export type CamposVenda = {
  clientId: string
  dataVenda: string
  valorTotalCentavos: number
  numeroParcelas: number
  valorParcelaCentavos: number
  diaVencimento: number
  multaTipo?: TipoDeMulta
  multaPercentual?: number
  multaFixaCentavos?: number
  jurosPercentualDia?: number
  observacao?: string
  itens: ItemDaVenda[]
  versaoCalculo: number
  atualizadoPor: string
}

export type CamposParcela = {
  clientId: string
  saleId: string
  numero: number
  total: number
  vencimento: string
  valorCentavos: number
  atualizadoPor: string
}

export function entradaItemVazia(): EntradaItem {
  return { quantidade: '1', descricao: '', valorUnitario: '' }
}

export function entradaVendaVazia(agora: Date): EntradaVenda {
  const hoje = dataLocalISO(agora)

  return {
    dataVenda: hoje,
    itens: [entradaItemVazia()],
    numeroParcelas: '',
    // O dia do vencimento nasce igual ao dia da venda; a primeira parcela cai
    // no mês seguinte. É sugestão de valor padrão, não regra — o dono troca.
    diaVencimento: String(Number(hoje.slice(8, 10))),
    cobrarTaxas: false,
    multaTipo: 'percentual',
    multaPercentual: '',
    multaFixa: '',
    jurosPercentualDia: '',
    observacao: '',
  }
}

/** Inteiro digitado, sem aceitar lixo à direita nem sinal. */
export function parseInteiro(entrada: string): number | null {
  const limpo = entrada.trim()
  if (!/^\d+$/.test(limpo)) return null

  const valor = Number(limpo)
  return Number.isSafeInteger(valor) ? valor : null
}

/**
 * Taxa em percentual, aceitando vírgula: `0,1` e `0.1` são o mesmo 0,1% ao dia.
 * Devolve `null` para entrada inválida e `0` para campo vazio — taxa não
 * informada é taxa zero, não erro.
 */
export function parseTaxa(entrada: string): number | null {
  const limpo = entrada.trim().replace(',', '.').replace('%', '').trim()
  if (limpo === '') return 0
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null

  const valor = Number(limpo)
  return Number.isFinite(valor) ? valor : null
}

function erroDaDataVenda(entrada: EntradaVenda): string | undefined {
  if (!ehDataCivil(entrada.dataVenda)) return 'Data inválida'

  const numero = parseInteiro(entrada.numeroParcelas)
  const dia = parseInteiro(entrada.diaVencimento)
  if (
    numero !== null && numero >= 1 && numero <= LIMITES_VENDA.numeroParcelas &&
    dia !== null && dia >= 1 && dia <= 31
  ) {
    const ultimo = vencimentoDaParcela(entrada.dataVenda, numero, dia)
    if (!ehDataCivil(ultimo)) {
      return 'Confira o ano: a última parcela passaria do ano 9999.'
    }
  }

  return undefined
}

function erroDaQuantidade(entrada: string): string | undefined {
  if (entrada.trim() === '') return 'Informe a quantidade'

  const quantidade = parseInteiro(entrada)
  if (quantidade === null) return 'Só número inteiro'
  if (quantidade < 1) return 'Pelo menos 1'
  if (quantidade > LIMITES_VENDA.quantidadeItem) return `No máximo ${LIMITES_VENDA.quantidadeItem}`

  return undefined
}

function erroDaDescricao(entrada: string): string | undefined {
  const descricao = entrada.trim()
  if (descricao === '') return 'Informe a descrição'
  if (descricao.length > LIMITES_VENDA.descricaoItem) {
    return `No máximo ${LIMITES_VENDA.descricaoItem} caracteres`
  }

  return undefined
}

function erroDoValorUnitario(entrada: string): string | undefined {
  const centavos = parseReaisParaCentavos(entrada)
  if (centavos === null) return 'Informe o valor'
  if (centavos <= 0) return 'O valor precisa ser maior que zero'

  return undefined
}

function errosDoItem(item: EntradaItem): ErrosItem {
  return compactar<keyof EntradaItem>({
    quantidade: erroDaQuantidade(item.quantidade),
    descricao: erroDaDescricao(item.descricao),
    valorUnitario: erroDoValorUnitario(item.valorUnitario),
  })
}

/** O item como vai para o documento, ou `null` se algum campo não passa. */
function lerItem(item: EntradaItem): ItemDaVenda | null {
  const quantidade = parseInteiro(item.quantidade)
  const valorUnitarioCentavos = parseReaisParaCentavos(item.valorUnitario)
  if (quantidade === null || valorUnitarioCentavos === null) return null
  if (Object.keys(errosDoItem(item)).length > 0) return null

  return { quantidade, descricao: item.descricao.trim(), valorUnitarioCentavos }
}

/** Os itens como vão para o documento, ou `null` se a lista não passa inteira. */
function lerItens(itens: readonly EntradaItem[]): ItemDaVenda[] | null {
  if (itens.length < 1 || itens.length > LIMITES_VENDA.itens) return null

  const lidos: ItemDaVenda[] = []
  for (const item of itens) {
    const lido = lerItem(item)
    if (!lido) return null
    lidos.push(lido)
  }

  return lidos
}

function somar(itens: readonly ItemDaVenda[]): number | null {
  const total = itens.reduce(
    (soma, item) => soma + item.quantidade * item.valorUnitarioCentavos,
    0,
  )

  // A regra não confere a soma; o que garante que ela seja exata é isto.
  return Number.isSafeInteger(total) ? total : null
}

/**
 * O total da venda, em centavos: a soma de `quantidade × valor unitário`.
 * `null` quando algum item não passa, a lista está vazia ou acima do teto, ou
 * a soma não é um inteiro exato.
 */
export function totalDosItens(itens: readonly EntradaItem[]): number | null {
  const lidos = lerItens(itens)
  return lidos ? somar(lidos) : null
}

export function validarItens(itens: readonly EntradaItem[]): ErrosItens {
  const porItem = itens.map(errosDoItem)

  if (itens.length < 1) return { porItem, geral: 'Inclua pelo menos um item' }
  if (itens.length > LIMITES_VENDA.itens) {
    return { porItem, geral: `No máximo ${LIMITES_VENDA.itens} itens` }
  }
  if (porItem.every((erros) => Object.keys(erros).length === 0) && totalDosItens(itens) === null) {
    return { porItem, geral: 'Total grande demais' }
  }

  return { porItem }
}

function erroDosItens(itens: readonly EntradaItem[]): string | undefined {
  const { porItem, geral } = validarItens(itens)
  if (geral) return geral
  if (porItem.some((erros) => Object.keys(erros).length > 0)) return 'Confira os itens'

  return undefined
}

function erroDasParcelas(entrada: string, centavos: number | null): string | undefined {
  const numero = parseInteiro(entrada)
  if (numero === null) return 'Informe em quantas parcelas'
  if (numero < 1) return 'Pelo menos uma parcela'
  if (numero > LIMITES_VENDA.numeroParcelas) {
    return `No máximo ${LIMITES_VENDA.numeroParcelas} parcelas`
  }

  // Cada parcela precisa valer ao menos um centavo: a regra do Firestore exige
  // `valorCentavos > 0`. Sem esta checagem, R$ 0,03 em 12 parcelas geraria onze
  // parcelas de zero — aceitas no cache, **recusadas em silêncio** na hora de
  // sincronizar, que é quando ninguém está olhando.
  if (centavos !== null && numero > centavos) {
    return 'Parcelas demais para este valor — cada uma ficaria em zero'
  }

  return undefined
}

function erroDoDia(entrada: string): string | undefined {
  const dia = parseInteiro(entrada)
  if (dia === null) return 'Informe o dia do vencimento'
  if (dia < 1 || dia > LIMITES_VENDA.diaVencimento) return 'Entre 1 e 31'

  return undefined
}

function erroDaTaxa(entrada: string): string | undefined {
  const taxa = parseTaxa(entrada)
  if (taxa === null) return 'Número inválido'
  if (taxa > LIMITES_VENDA.taxa) return 'No máximo 100%'

  return undefined
}

function erroDaMultaFixa(entrada: string): string | undefined {
  if (entrada.trim() === '') return undefined
  if (parseReaisParaCentavos(entrada) === null) return 'Valor inválido'

  return undefined
}

function erroDeTamanho(texto: string, limite: number, mensagem: string): string | undefined {
  return texto.trim().length > limite ? mensagem : undefined
}

function compactar<T extends string>(candidatos: Record<T, string | undefined>) {
  const erros: Partial<Record<T, string>> = {}
  for (const [campo, erro] of Object.entries(candidatos)) {
    if (erro) erros[campo as T] = erro as string
  }

  return erros
}

export function validarVenda(entrada: EntradaVenda): ErrosVenda {
  return compactar<keyof EntradaVenda>({
    dataVenda: erroDaDataVenda(entrada),
    itens: erroDosItens(entrada.itens),
    numeroParcelas: erroDasParcelas(entrada.numeroParcelas, totalDosItens(entrada.itens)),
    diaVencimento: erroDoDia(entrada.diaVencimento),
    cobrarTaxas: undefined,
    multaTipo: undefined,
    multaPercentual:
      entrada.cobrarTaxas && entrada.multaTipo === 'percentual'
        ? erroDaTaxa(entrada.multaPercentual)
        : undefined,
    multaFixa:
      entrada.cobrarTaxas && entrada.multaTipo === 'fixo'
        ? erroDaMultaFixa(entrada.multaFixa)
        : undefined,
    jurosPercentualDia: entrada.cobrarTaxas
      ? erroDaTaxa(entrada.jurosPercentualDia)
      : undefined,
    observacao: erroDeTamanho(
      entrada.observacao,
      LIMITES_VENDA.observacao,
      'Observação muito longa',
    ),
  })
}

/**
 * Monta a venda e as parcelas que vão para o Firestore.
 *
 * As entradas (`valorTotalCentavos`, `numeroParcelas`, `diaVencimento`) e as
 * saídas (cada parcela) são gravadas as duas, mais o `versaoCalculo`: uma
 * mudança futura na regra gera vendas novas em vez de migrar as antigas, que é
 * o comportamento correto de qualquer forma — carnê já entregue não se reescreve.
 *
 * `valorTotalCentavos` é sempre a soma exata dos `itens` gravados junto: o
 * total não se digita, sai deles.
 */
export function montarCamposVenda(
  clientId: string,
  entrada: EntradaVenda,
  { dispositivo }: ContextoEscrita,
): { venda: CamposVenda; parcelas: Omit<CamposParcela, 'saleId'>[] } {
  const itens = lerItens(entrada.itens)
  const valorTotalCentavos = itens ? somar(itens) : null
  const numeroParcelas = parseInteiro(entrada.numeroParcelas)
  const diaVencimento = parseInteiro(entrada.diaVencimento)

  // Item nenhum inválido chega ao lote: a regra só confere o tamanho da lista.
  if (itens === null || valorTotalCentavos === null) {
    throw new TypeError('montarCamposVenda recebeu itens que não passaram na validação')
  }
  if (numeroParcelas === null || numeroParcelas < 1) {
    throw new TypeError('montarCamposVenda recebeu parcelas que não passaram na validação')
  }
  if (diaVencimento === null || diaVencimento < 1 || diaVencimento > 31) {
    throw new TypeError('montarCamposVenda recebeu um dia que não passou na validação')
  }

  const geradas = gerarParcelas({
    dataVenda: entrada.dataVenda,
    numeroParcelas,
    valorTotalCentavos,
    diaVencimento,
  })

  const venda: CamposVenda = {
    clientId,
    dataVenda: entrada.dataVenda,
    valorTotalCentavos,
    numeroParcelas,
    // A parcela comum, não a última: a sobra da divisão vai para a última, e
    // gravar aquela aqui faria o resumo da tela mentir por alguns centavos.
    valorParcelaCentavos: geradas[0].valorCentavos,
    diaVencimento,
    itens,
    versaoCalculo: VERSAO_CALCULO,
    atualizadoPor: dispositivo,
  }

  if (entrada.cobrarTaxas) {
    venda.multaTipo = entrada.multaTipo

    if (entrada.multaTipo === 'fixo') {
      venda.multaFixaCentavos = parseReaisParaCentavos(entrada.multaFixa) ?? 0
    } else {
      venda.multaPercentual = parseTaxa(entrada.multaPercentual) ?? 0
    }

    venda.jurosPercentualDia = parseTaxa(entrada.jurosPercentualDia) ?? 0
  }

  const observacao = entrada.observacao.trim()
  if (observacao) venda.observacao = observacao

  const parcelas = geradas.map((parcela) => ({
    clientId,
    numero: parcela.numero,
    total: parcela.total,
    vencimento: parcela.vencimento,
    valorCentavos: parcela.valorCentavos,
    atualizadoPor: dispositivo,
  }))

  return { venda, parcelas }
}

export function podeCancelarVenda(venda: { cancelada?: boolean }): boolean {
  return venda.cancelada !== true
}

export type CamposCancelamentoVenda = {
  cancelada: true
  canceladaEm: string
  atualizadoPor: string
}

/**
 * `canceladaEm` sai de `agora`, o momento da escrita — nunca de uma data que
 * a tela calculou antes. Com a página aberta atravessando a meia-noite, o
 * "hoje" da tela ainda é ontem, e a regra não deixa corrigir `canceladaEm`
 * depois de gravado.
 */
export function montarCancelamentoVenda({
  agora,
  dispositivo,
}: ContextoEscrita): CamposCancelamentoVenda {
  const quando = dataLocalISO(agora)
  if (!ehDataCivil(quando)) {
    throw new TypeError('montarCancelamentoVenda recebeu uma data que não passou na validação')
  }

  return { cancelada: true, canceladaEm: quando, atualizadoPor: dispositivo }
}

// ---------------------------------------------------------------------------
// Pagamento
//
// Um pagamento é um valor qualquer **contra a venda** — nunca "a parcela N foi
// paga". A tela oferece o botão por parcela e pré-preenche o que falta nela,
// porque é assim que o dono pensa e é o que o caderno dele tem; mas o que vai
// para o Firestore é um lançamento contra a venda, e a situação de cada parcela
// continua sendo derivada por `alocarPagamentos`, da mais antiga para a mais
// nova. As duas leituras gravam exatamente a mesma coisa.
// ---------------------------------------------------------------------------

export type EntradaPagamento = {
  data: string
  valor: string
  forma: FormaDePagamento
  observacao: string
}

export type ErrosPagamento = Partial<Record<keyof EntradaPagamento, string>>

export type CamposPagamento = {
  clientId: string
  saleId: string
  data: string
  valorCentavos: number
  forma: FormaDePagamento
  cancelado: false
  observacao?: string
  atualizadoPor: string
}

export function entradaPagamentoVazia(
  agora: Date,
  restanteCentavos: number,
): EntradaPagamento {
  return {
    data: dataLocalISO(agora),
    // Pré-preenche o que falta na parcela. É sugestão: o dono apaga e digita
    // outro valor quando o cliente paga metade, que é o caso comum.
    valor: restanteCentavos > 0 ? formatarParaCampo(restanteCentavos) : '',
    forma: 'dinheiro',
    observacao: '',
  }
}

/** Centavos no formato que o campo de texto aceita de volta: `1234` → `12,34`. */
export function formatarParaCampo(centavos: number): string {
  const inteiros = Math.floor(centavos / 100)
  const resto = String(centavos % 100).padStart(2, '0')

  return `${inteiros},${resto}`
}

export function validarPagamento(entrada: EntradaPagamento): ErrosPagamento {
  return compactar<keyof EntradaPagamento>({
    data: ehDataCivil(entrada.data) ? undefined : 'Data inválida',
    valor: erroDoValorPago(entrada.valor),
    forma: undefined,
    observacao: erroDeTamanho(
      entrada.observacao,
      LIMITES_VENDA.observacao,
      'Observação muito longa',
    ),
  })
}

function erroDoValorPago(valor: string): string | undefined {
  const centavos = parseReaisParaCentavos(valor)
  if (centavos === null) return 'Informe o valor recebido'
  if (centavos <= 0) return 'O valor precisa ser maior que zero'

  return undefined
}

/**
 * Aviso que **não bloqueia**: o dono pode receber mais do que deve, e isso não
 * é erro de regra. Mas R$ 1.000,00 no lugar de R$ 100,00 é o erro de digitação
 * que ninguém percebe na hora — o mesmo argumento que decidiu o CPF em 21/09.
 */
export function avisoDeValorAlto(
  valor: string,
  abertoDaVendaCentavos: number,
): string | undefined {
  const centavos = parseReaisParaCentavos(valor)
  if (centavos === null || centavos <= abertoDaVendaCentavos) return undefined

  return 'Valor maior do que o saldo desta venda. Confira antes de lançar.'
}

export function montarCamposPagamento(
  clientId: string,
  saleId: string,
  entrada: EntradaPagamento,
  { dispositivo }: ContextoEscrita,
): CamposPagamento {
  const valorCentavos = parseReaisParaCentavos(entrada.valor)
  if (valorCentavos === null || valorCentavos <= 0) {
    throw new TypeError('montarCamposPagamento recebeu um valor que não passou na validação')
  }

  const campos: CamposPagamento = {
    clientId,
    saleId,
    data: entrada.data,
    valorCentavos,
    forma: entrada.forma,
    // Nasce por cancelar, e a regra do Firestore recusa qualquer outra coisa.
    // `canceladoEm` precisa estar **ausente** aqui, não nulo.
    cancelado: false,
    atualizadoPor: dispositivo,
  }

  const observacao = entrada.observacao.trim()
  if (observacao) campos.observacao = observacao

  return campos
}
