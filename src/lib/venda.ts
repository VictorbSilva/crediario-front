import { dataLocalISO, ehDataCivil } from './data'
import { parseReaisParaCentavos } from './dinheiro'
import { VERSAO_CALCULO, gerarParcelas } from './parcelas'
import type { FormaDePagamento, TipoDeMulta } from '@/types/venda'

export const LIMITES_VENDA = {
  /** O teto vem da regra do Firestore, que recusa acima disso. */
  numeroParcelas: 120,
  diaVencimento: 31,
  taxa: 100,
  observacao: 500,
} as const

export type ContextoEscrita = {
  agora: Date
  dispositivo: string
}

export type EntradaVenda = {
  dataVenda: string
  valor: string
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

export function entradaVendaVazia(agora: Date): EntradaVenda {
  const hoje = dataLocalISO(agora)

  return {
    dataVenda: hoje,
    valor: '',
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

function erroDoValor(valor: string): string | undefined {
  const centavos = parseReaisParaCentavos(valor)
  if (centavos === null) return 'Informe o valor da venda'
  if (centavos <= 0) return 'O valor precisa ser maior que zero'

  return undefined
}

function erroDasParcelas(entrada: string, valor: string): string | undefined {
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
  const centavos = parseReaisParaCentavos(valor)
  if (centavos !== null && centavos > 0 && numero > centavos) {
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
    dataVenda: ehDataCivil(entrada.dataVenda) ? undefined : 'Data inválida',
    valor: erroDoValor(entrada.valor),
    numeroParcelas: erroDasParcelas(entrada.numeroParcelas, entrada.valor),
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
 */
export function montarCamposVenda(
  clientId: string,
  entrada: EntradaVenda,
  { dispositivo }: ContextoEscrita,
): { venda: CamposVenda; parcelas: Omit<CamposParcela, 'saleId'>[] } {
  const valorTotalCentavos = parseReaisParaCentavos(entrada.valor)
  const numeroParcelas = parseInteiro(entrada.numeroParcelas)
  const diaVencimento = parseInteiro(entrada.diaVencimento)

  if (valorTotalCentavos === null || valorTotalCentavos <= 0) {
    throw new TypeError('montarCamposVenda recebeu um valor que não passou na validação')
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
