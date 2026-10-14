import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  FieldPath,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { useAuth } from '@/auth/useAuth'
import { entradaDoCliente, montarCamposCliente, montarEdicaoCliente } from '@/lib/cliente'
import type { EntradaCliente } from '@/lib/cliente'
import { dataLocalISO } from '@/lib/data'
import { identificarDispositivo } from '@/lib/dispositivo'
import { db } from '@/lib/firebase'
import { desmarcar, marcarAusente, marcarVisitado } from '@/lib/rotas'
import type { Reordenacao } from '@/lib/rotas'
import { confiancaDaLista, estadoDeSync } from '@/lib/sync'
import type { Cliente } from '@/types/cliente'
import { ClientesContext } from './clientes-context'
import type { AcaoNaRota, ClientesContextValue, FalhaDeEscrita } from './clientes-context'

const PREFIXO_SINCRONIZOU = 'crediario:sincronizou:'

function leuDoServidorAlgumaVez(businessId: string): boolean {
  try {
    return localStorage.getItem(PREFIXO_SINCRONIZOU + businessId) === '1'
  } catch {
    return false
  }
}

function marcarLeituraDoServidor(businessId: string): void {
  try {
    localStorage.setItem(PREFIXO_SINCRONIZOU + businessId, '1')
  } catch {
    return
  }
}

function paraCliente(documento: QueryDocumentSnapshot<DocumentData>): Cliente {
  const dados = documento.data()

  return {
    id: documento.id,
    numero: dados.numero,
    nome: dados.nome,
    nomeBusca: dados.nomeBusca,
    telefone: dados.telefone,
    telefoneDigits: dados.telefoneDigits,
    cpf: dados.cpf,
    cpfDigits: dados.cpfDigits,
    endereco: dados.endereco,
    rotaId: dados.rotaId,
    diasDeVisita: dados.diasDeVisita,
    rotaDesde: dados.rotaDesde,
    ordemPorDia: dados.ordemPorDia,
    ordemDoDia: dados.ordemDoDia,
    ultimaMarca: dados.ultimaMarca,
    ultimaMarcaEm: dados.ultimaMarcaEm,
    ultimoVisitado: dados.ultimoVisitado,
    visitadoAnterior: dados.visitadoAnterior,
    observacao: dados.observacao,
    arquivado: dados.arquivado,
    cadastradoEm: dados.cadastradoEm,
    criadoEm: dados.criadoEm ?? null,
    atualizadoEm: dados.atualizadoEm ?? null,
    atualizadoPor: dados.atualizadoPor,
    pendente: documento.metadata.hasPendingWrites,
  }
}

const alteracaoDaMarca = { visitado: marcarVisitado, ausente: marcarAusente, desmarcar }

// A ordem de um dia mora num mapa (`ordemPorDia`) compartilhado por todos os dias do
// cliente: gravar o mapa inteiro faria dois aparelhos sobrescreverem um ao outro. Já
// `ordemDoDia` é gravado inteiro, porque a regra exige `data` e `valor` juntos.
function campoEValor(reordenacao: Reordenacao): [string | FieldPath, unknown] {
  if (reordenacao.tipo === 'dia') {
    return [new FieldPath('ordemPorDia', String(reordenacao.dia)), reordenacao.valor]
  }
  return ['ordemDoDia', { data: reordenacao.data, valor: reordenacao.valor }]
}

function codigoDoErro(falha: unknown): string {
  if (typeof falha !== 'object' || falha === null || !('code' in falha)) return ''
  return typeof falha.code === 'string' ? falha.code : ''
}

function mensagemDeLeitura(falha: unknown): string {
  const codigo = codigoDoErro(falha)

  if (codigo === 'permission-denied') {
    return 'Sem permissão para ler os clientes. Confira se as regras do Firestore foram publicadas.'
  }
  return 'Não foi possível carregar a lista de clientes.'
}

export function ClientesProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { businessId } = useAuth()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [doCache, setDoCache] = useState(true)
  const [jaSincronizou, setJaSincronizou] = useState(() =>
    businessId ? leuDoServidorAlgumaVez(businessId) : false,
  )
  const [falhas, setFalhas] = useState<FalhaDeEscrita[]>([])

  const marcou = useRef(false)
  const proximaFalha = useRef(0)

  useEffect(() => {
    if (!businessId) return

    marcou.current = false

    const consulta = query(
      collection(db, 'businesses', businessId, 'clients'),
      orderBy('numero'),
    )

    return onSnapshot(
      consulta,
      { includeMetadataChanges: true },
      (instantaneo) => {
        setClientes(instantaneo.docs.map(paraCliente))
        setDoCache(instantaneo.metadata.fromCache)
        setCarregando(false)
        setErro(null)

        if (!instantaneo.metadata.fromCache && !marcou.current) {
          marcou.current = true
          marcarLeituraDoServidor(businessId)
          setJaSincronizou(true)
        }
      },
      (falha) => {
        setErro(mensagemDeLeitura(falha))
        setCarregando(false)
      },
    )
  }, [businessId])

  const registrarFalha = useCallback((mensagem: string, causa: unknown) => {
    console.error('[clientes]', mensagem, causa)
    proximaFalha.current += 1
    const id = `falha-${proximaFalha.current}`
    setFalhas((anteriores) => [...anteriores, { id, mensagem, quando: new Date() }])
  }, [])

  const descartarFalha = useCallback((id: string) => {
    setFalhas((anteriores) => anteriores.filter((falha) => falha.id !== id))
  }, [])

  const criarCliente = useCallback(
    (entrada: EntradaCliente) => {
      if (!businessId) return

      const campos = montarCamposCliente(entrada, {
        agora: new Date(),
        dispositivo: identificarDispositivo(),
      })
      const referencia = doc(collection(db, 'businesses', businessId, 'clients'))

      setDoc(referencia, {
        ...campos,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      }).catch((causa: unknown) => {
        registrarFalha(
          `O cliente ${campos.numero} — ${campos.nome} foi recusado pelo servidor e saiu da lista.`,
          causa,
        )
      })
    },
    [businessId, registrarFalha],
  )

  const editarCliente = useCallback(
    (cliente: Cliente, entrada: EntradaCliente) => {
      if (!businessId) return false

      const { definir, remover } = montarEdicaoCliente(
        entrada,
        { agora: new Date(), dispositivo: identificarDispositivo() },
        entradaDoCliente(cliente),
      )
      if (Object.keys(definir).length === 1 && remover.length === 0) return true
      const referencia = doc(db, 'businesses', businessId, 'clients', cliente.id)

      updateDoc(referencia, {
        ...definir,
        ...Object.fromEntries(remover.map((campo) => [campo, deleteField()])),
        atualizadoEm: serverTimestamp(),
      }).catch((causa: unknown) => {
        registrarFalha(`Não foi possível salvar as alterações de ${cliente.nome}.`, causa)
      })
      return true
    },
    [businessId, registrarFalha],
  )

  const alternarArquivo = useCallback(
    (cliente: Cliente) => {
      if (!businessId) return

      const arquivando = cliente.arquivado !== true
      const referencia = doc(db, 'businesses', businessId, 'clients', cliente.id)

      updateDoc(referencia, {
        arquivado: arquivando,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: identificarDispositivo(),
      }).catch((causa: unknown) => {
        registrarFalha(
          `Não foi possível ${arquivando ? 'arquivar' : 'desarquivar'} ${cliente.nome}.`,
          causa,
        )
      })
    },
    [businessId, registrarFalha],
  )

  const marcarNaRota = useCallback(
    (cliente: Cliente, acao: AcaoNaRota) => {
      if (!businessId) return

      const { definir, remover } = alteracaoDaMarca[acao](cliente, dataLocalISO(new Date()))
      if (Object.keys(definir).length === 0 && remover.length === 0) return
      const referencia = doc(db, 'businesses', businessId, 'clients', cliente.id)

      updateDoc(referencia, {
        ...definir,
        ...Object.fromEntries(remover.map((campo) => [campo, deleteField()])),
        atualizadoEm: serverTimestamp(),
        atualizadoPor: identificarDispositivo(),
      }).catch((causa: unknown) => {
        registrarFalha(`Não foi possível marcar a visita de ${cliente.nome}.`, causa)
      })
    },
    [businessId, registrarFalha],
  )

  const reordenarRota = useCallback(
    (reordenacoes: Reordenacao[]) => {
      if (!businessId || reordenacoes.length === 0) return

      const dispositivo = identificarDispositivo()
      const referenciaDe = (clienteId: string) =>
        doc(db, 'businesses', businessId, 'clients', clienteId)
      const falhou = (causa: unknown) => {
        registrarFalha('Não foi possível salvar a nova ordem da rota.', causa)
      }

      if (reordenacoes.length === 1) {
        const [reordenacao] = reordenacoes
        const [campo, valor] = campoEValor(reordenacao)

        updateDoc(
          referenciaDe(reordenacao.clienteId),
          campo,
          valor,
          'atualizadoEm',
          serverTimestamp(),
          'atualizadoPor',
          dispositivo,
        ).catch(falhou)
        return
      }

      const lote = writeBatch(db)
      for (const reordenacao of reordenacoes) {
        const [campo, valor] = campoEValor(reordenacao)

        lote.update(
          referenciaDe(reordenacao.clienteId),
          campo,
          valor,
          'atualizadoEm',
          serverTimestamp(),
          'atualizadoPor',
          dispositivo,
        )
      }
      lote.commit().catch(falhou)
    },
    [businessId, registrarFalha],
  )

  const valor = useMemo<ClientesContextValue>(() => {
    const ativos = clientes.filter((cliente) => cliente.arquivado !== true)
    const arquivados = clientes.filter((cliente) => cliente.arquivado === true)
    const pendentes = clientes.filter((cliente) => cliente.pendente).length

    return {
      clientes,
      ativos,
      arquivados,
      carregando,
      erro,
      pendentes,
      doCache,
      estadoSync: estadoDeSync({ carregando, erro: erro !== null, pendentes, doCache }),
      confianca: confiancaDaLista({
        carregando,
        doCache,
        jaSincronizouNesteAparelho: jaSincronizou,
      }),
      falhas,
      descartarFalha,
      criarCliente,
      editarCliente,
      alternarArquivo,
      marcarNaRota,
      reordenarRota,
    }
  }, [
    clientes,
    carregando,
    erro,
    doCache,
    jaSincronizou,
    falhas,
    descartarFalha,
    criarCliente,
    editarCliente,
    alternarArquivo,
    marcarNaRota,
    reordenarRota,
  ])

  return <ClientesContext.Provider value={valor}>{children}</ClientesContext.Provider>
}
