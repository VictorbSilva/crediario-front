import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { useAuth } from '@/auth/useAuth'
import type { CarneExportavel, DocumentoExportavel } from '@/lib/exportacao'
import { db } from '@/lib/firebase'
import { confiancaDaLista } from '@/lib/sync'
import type { ConfiancaDaLista } from '@/lib/sync'

export type ColecaoDoCarne = 'sales' | 'installments' | 'payments'

export const CARNE_COMPLETO: readonly ColecaoDoCarne[] = ['sales', 'installments', 'payments']

export type CarneDaEmpresa = CarneExportavel & {
  carregando: boolean
  pendentes: number
  confianca: ConfiancaDaLista
  erro: string | null
}

type EstadoDaColecao = {
  documentos: DocumentoExportavel[]
  pendentes: number
  doCache: boolean
}

type Estado = {
  chave: string
  colecoes: Partial<Record<ColecaoDoCarne, EstadoDaColecao>>
  erro: string | null
}

const PREFIXO_SINCRONIZOU = 'crediario:carne-sincronizou:'

const NENHUM: DocumentoExportavel[] = []

function leuDoServidorAlgumaVez(chave: string): boolean {
  try {
    return localStorage.getItem(PREFIXO_SINCRONIZOU + chave) === '1'
  } catch {
    return false
  }
}

function marcarLeituraDoServidor(chave: string): void {
  try {
    localStorage.setItem(PREFIXO_SINCRONIZOU + chave, '1')
  } catch {
    return
  }
}

/**
 * Ouve as coleções do carnê da empresa INTEIRAS, sem filtro nem ordenação.
 * `colecoes` precisa ser uma constante de módulo (como `CARNE_COMPLETO`):
 * uma lista nova a cada render derruba e refaz os listeners em laço.
 */
export function useCarneDaEmpresa(colecoes: readonly ColecaoDoCarne[]): CarneDaEmpresa {
  const { businessId } = useAuth()
  const chave = `${businessId ?? ''}:${colecoes.join(',')}`

  const [estado, setEstado] = useState<Estado>({ chave: '', colecoes: {}, erro: null })
  const [sincronizada, setSincronizada] = useState<string | null>(() =>
    businessId && leuDoServidorAlgumaVez(chave) ? chave : null,
  )

  useEffect(() => {
    if (!businessId) return

    const doServidor = new Set<ColecaoDoCarne>()
    let marcou = false

    const guardar = (nome: ColecaoDoCarne, colecao: EstadoDaColecao) =>
      setEstado((atual) => ({
        chave,
        colecoes: { ...(atual.chave === chave ? atual.colecoes : {}), [nome]: colecao },
        erro: atual.chave === chave ? atual.erro : null,
      }))

    const inscricoes = colecoes.map((nome) =>
      onSnapshot(
        collection(db, 'businesses', businessId, nome),
        { includeMetadataChanges: true },
        (instantaneo) => {
          guardar(nome, {
            documentos: instantaneo.docs.map((d) => ({ id: d.id, dados: d.data() })),
            pendentes: instantaneo.docs.filter((d) => d.metadata.hasPendingWrites).length,
            doCache: instantaneo.metadata.fromCache,
          })

          if (!instantaneo.metadata.fromCache) doServidor.add(nome)

          if (!marcou && colecoes.every((c) => doServidor.has(c))) {
            marcou = true
            marcarLeituraDoServidor(chave)
            setSincronizada(chave)
          }
        },
        () => {
          setEstado((atual) => {
            const anteriores = atual.chave === chave ? atual.colecoes : {}
            const todas = { ...anteriores }

            for (const c of colecoes) {
              todas[c] ??= { documentos: [], pendentes: 0, doCache: true }
            }

            return { chave, colecoes: todas, erro: 'Não foi possível carregar o carnê da empresa.' }
          })
        },
      ),
    )

    return () => {
      for (const cancelar of inscricoes) cancelar()
    }
  }, [businessId, colecoes, chave])

  return useMemo(() => {
    const deste: Estado = estado.chave === chave ? estado : { chave, colecoes: {}, erro: null }
    const pedidas = colecoes.map((nome) => deste.colecoes[nome])

    const carregando = pedidas.some((colecao) => colecao === undefined)
    const pendentes = pedidas.reduce((soma, colecao) => soma + (colecao?.pendentes ?? 0), 0)
    const doCache = pedidas.some((colecao) => colecao?.doCache === true)

    return {
      vendas: deste.colecoes.sales?.documentos ?? NENHUM,
      parcelas: deste.colecoes.installments?.documentos ?? NENHUM,
      pagamentos: deste.colecoes.payments?.documentos ?? NENHUM,
      carregando,
      pendentes,
      confianca: confiancaDaLista({
        carregando,
        doCache,
        jaSincronizouNesteAparelho: sincronizada === chave,
      }),
      erro: deste.erro,
    }
  }, [estado, chave, colecoes, sincronizada])
}
