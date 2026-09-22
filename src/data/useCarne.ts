import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { useAuth } from '@/auth/useAuth'
import { dataLocalISO } from '@/lib/data'
import { identificarDispositivo } from '@/lib/dispositivo'
import { db } from '@/lib/firebase'
import { montarCarne, saldoDoCliente } from '@/lib/parcelas'
import type { ResumoDaVenda, VendaComCarne } from '@/lib/parcelas'
import { estadoDeSync } from '@/lib/sync'
import type { EstadoSync } from '@/lib/sync'
import { montarCamposPagamento, montarCamposVenda } from '@/lib/venda'
import type { EntradaPagamento, EntradaVenda } from '@/lib/venda'
import type { Pagamento, Parcela, Venda } from '@/types/venda'

type Documento = QueryDocumentSnapshot<DocumentData>

const COLECOES = ['sales', 'installments', 'payments'] as const

type Colecao = (typeof COLECOES)[number]

function chaveDe(clienteId: string | null, colecao: Colecao): string {
  return `${clienteId ?? ''}:${colecao}`
}

function marcarPronto(atual: string[], clienteId: string, colecao: Colecao): string[] {
  const chave = chaveDe(clienteId, colecao)
  const doCliente = atual.filter((item) => item.startsWith(`${clienteId}:`))

  return doCliente.includes(chave) ? atual : [...doCliente, chave]
}

function paraVenda(documento: Documento): Venda {
  const dados = documento.data()

  return {
    id: documento.id,
    clientId: dados.clientId,
    dataVenda: dados.dataVenda,
    valorTotalCentavos: dados.valorTotalCentavos,
    numeroParcelas: dados.numeroParcelas,
    valorParcelaCentavos: dados.valorParcelaCentavos,
    diaVencimento: dados.diaVencimento,
    multaTipo: dados.multaTipo,
    multaPercentual: dados.multaPercentual,
    multaFixaCentavos: dados.multaFixaCentavos,
    jurosPercentualDia: dados.jurosPercentualDia,
    observacao: dados.observacao,
    versaoCalculo: dados.versaoCalculo,
    criadoEm: dados.criadoEm ?? null,
    atualizadoEm: dados.atualizadoEm ?? null,
    atualizadoPor: dados.atualizadoPor,
    pendente: documento.metadata.hasPendingWrites,
  }
}

function paraParcela(documento: Documento): Parcela {
  const dados = documento.data()

  return {
    id: documento.id,
    clientId: dados.clientId,
    saleId: dados.saleId,
    numero: dados.numero,
    total: dados.total,
    vencimento: dados.vencimento,
    valorCentavos: dados.valorCentavos,
    multaTipo: dados.multaTipo,
    multaPercentual: dados.multaPercentual,
    multaFixaCentavos: dados.multaFixaCentavos,
    jurosPercentualDia: dados.jurosPercentualDia,
    criadoEm: dados.criadoEm ?? null,
    atualizadoEm: dados.atualizadoEm ?? null,
    atualizadoPor: dados.atualizadoPor,
    pendente: documento.metadata.hasPendingWrites,
  }
}

function paraPagamento(documento: Documento): Pagamento {
  const dados = documento.data()

  return {
    id: documento.id,
    clientId: dados.clientId,
    saleId: dados.saleId,
    data: dados.data,
    valorCentavos: dados.valorCentavos,
    encargoCentavos: dados.encargoCentavos,
    forma: dados.forma,
    cancelado: dados.cancelado,
    canceladoEm: dados.canceladoEm,
    observacao: dados.observacao,
    criadoEm: dados.criadoEm ?? null,
    atualizadoEm: dados.atualizadoEm ?? null,
    atualizadoPor: dados.atualizadoPor,
    pendente: documento.metadata.hasPendingWrites,
  }
}

export type CarneDoCliente = {
  carnes: VendaComCarne<Venda>[]
  pagamentos: Pagamento[]
  saldo: ResumoDaVenda
  /** A data usada no cálculo, para a tela não ler o relógio por conta própria. */
  hoje: string
  carregando: boolean
  erro: string | null
  estadoSync: EstadoSync
  pendentes: number
  falhas: FalhaDeEscrita[]
  descartarFalha: (id: string) => void
  registrarVenda: (entrada: EntradaVenda) => void
  registrarPagamento: (saleId: string, entrada: EntradaPagamento) => void
  cancelarPagamento: (pagamento: Pagamento, quando: string) => void
}

export type FalhaDeEscrita = {
  id: string
  mensagem: string
  quando: Date
}

export function useCarne(clienteId: string | null): CarneDoCliente {
  const { businessId } = useAuth()

  const [vendas, setVendas] = useState<Venda[]>([])
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [prontos, setProntos] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [doCache, setDoCache] = useState(true)
  const [falhas, setFalhas] = useState<FalhaDeEscrita[]>([])

  const proximaFalha = useRef(0)

  useEffect(() => {
    if (!businessId || !clienteId) return

    const assinar = <T,>(
      nome: Colecao,
      converter: (documento: Documento) => T,
      guardar: (itens: T[]) => void,
    ) =>
      onSnapshot(
        query(collection(db, 'businesses', businessId, nome), where('clientId', '==', clienteId)),
        { includeMetadataChanges: true },
        (instantaneo) => {
          guardar(instantaneo.docs.map(converter))
          setDoCache(instantaneo.metadata.fromCache)
          setProntos((atual) => marcarPronto(atual, clienteId, nome))
        },
        () => {
          setErro('Não foi possível carregar o carnê deste cliente.')
          setProntos((atual) => COLECOES.reduce((lista, c) => marcarPronto(lista, clienteId, c), atual))
        },
      )

    const inscricoes = [
      assinar('sales', paraVenda, setVendas),
      assinar('installments', paraParcela, setParcelas),
      assinar('payments', paraPagamento, setPagamentos),
    ]

    return () => {
      for (const cancelar of inscricoes) cancelar()
    }
  }, [businessId, clienteId])

  const registrarFalha = useCallback((mensagem: string, causa: unknown) => {
    console.error('[carne]', mensagem, causa)
    proximaFalha.current += 1
    const id = `falha-${proximaFalha.current}`
    setFalhas((anteriores) => [...anteriores, { id, mensagem, quando: new Date() }])
  }, [])

  const descartarFalha = useCallback((id: string) => {
    setFalhas((anteriores) => anteriores.filter((falha) => falha.id !== id))
  }, [])

  /**
   * A venda e as parcelas dela vão num lote só. Meia venda gravada — o
   * cabeçalho sem as parcelas, ou o contrário — é pior do que venda nenhuma:
   * a tela mostraria um carnê que não fecha e não haveria como saber disso
   * olhando. Offline o lote fica na fila e sobe inteiro quando a rede volta.
   */
  const registrarVenda = useCallback(
    (entrada: EntradaVenda) => {
      if (!businessId || !clienteId) return

      const dispositivo = identificarDispositivo()
      const { venda, parcelas } = montarCamposVenda(clienteId, entrada, {
        agora: new Date(),
        dispositivo,
      })

      const vendas = collection(db, 'businesses', businessId, 'sales')
      const referenciaDaVenda = doc(vendas)

      const lote = writeBatch(db)
      lote.set(referenciaDaVenda, {
        ...venda,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      })

      for (const parcela of parcelas) {
        lote.set(doc(collection(db, 'businesses', businessId, 'installments')), {
          ...parcela,
          saleId: referenciaDaVenda.id,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        })
      }

      lote.commit().catch((causa: unknown) => {
        registrarFalha(
          'A venda foi recusada pelo servidor e saiu da lista. Lance de novo.',
          causa,
        )
      })
    },
    [businessId, clienteId, registrarFalha],
  )

  const registrarPagamento = useCallback(
    (saleId: string, entrada: EntradaPagamento) => {
      if (!businessId || !clienteId) return

      const campos = montarCamposPagamento(clienteId, saleId, entrada, {
        agora: new Date(),
        dispositivo: identificarDispositivo(),
      })

      const referencia = doc(collection(db, 'businesses', businessId, 'payments'))

      setDoc(referencia, {
        ...campos,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      }).catch((causa: unknown) => {
        registrarFalha('O pagamento foi recusado pelo servidor e saiu do carnê.', causa)
      })
    },
    [businessId, clienteId, registrarFalha],
  )

  /**
   * Cancelar é um evento novo, nunca um `delete`: a regra do Firestore recusa
   * remoção e só aceita `cancelado` indo de `false` para `true`. A parcela
   * volta a vencida contando do vencimento **original**, porque a situação é
   * derivada e nada dela foi gravado.
   */
  const cancelarPagamento = useCallback(
    (pagamento: Pagamento, quando: string) => {
      if (!businessId) return

      const referencia = doc(db, 'businesses', businessId, 'payments', pagamento.id)

      updateDoc(referencia, {
        cancelado: true,
        canceladoEm: quando,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: identificarDispositivo(),
      }).catch((causa: unknown) => {
        registrarFalha('Não foi possível cancelar este pagamento.', causa)
      })
    },
    [businessId, registrarFalha],
  )

  return useMemo(() => {
    const deste = <T extends { clientId: string }>(itens: T[]) =>
      clienteId ? itens.filter((item) => item.clientId === clienteId) : []

    const vendasDele = deste(vendas)
    const parcelasDele = deste(parcelas)
    const pagamentosDele = deste(pagamentos)

    const hoje = dataLocalISO(new Date())
    const carnes = montarCarne(vendasDele, parcelasDele, pagamentosDele, hoje)
    const carregando = COLECOES.some((nome) => !prontos.includes(chaveDe(clienteId, nome)))
    const pendentes = [...vendasDele, ...parcelasDele, ...pagamentosDele].filter(
      (item) => item.pendente,
    ).length

    return {
      carnes,
      pagamentos: pagamentosDele,
      saldo: saldoDoCliente(carnes),
      hoje,
      carregando,
      erro,
      estadoSync: estadoDeSync({ carregando, erro: erro !== null, pendentes, doCache }),
      pendentes,
      falhas,
      descartarFalha,
      registrarVenda,
      registrarPagamento,
      cancelarPagamento,
    }
  }, [
    clienteId,
    vendas,
    parcelas,
    pagamentos,
    prontos,
    erro,
    doCache,
    falhas,
    descartarFalha,
    registrarVenda,
    registrarPagamento,
    cancelarPagamento,
  ])
}
