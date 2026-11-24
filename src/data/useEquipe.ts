import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { useAuth } from '@/auth/useAuth'
import type { Permissoes } from '@/lib/acesso'
import { identificarDispositivo } from '@/lib/dispositivo'
import { copiarPermissoes, mensagemDoErroDeCadastro, montarCamposMembro } from '@/lib/equipe'
import type { EntradaNovoMembro, Membro } from '@/lib/equipe'
import { db } from '@/lib/firebase'
import { criarContaDeFuncionario } from './criarContaDeFuncionario'

export type Equipe = {
  membros: Membro[]
  carregando: boolean
  erro: string | null
  /** Resolve com a mensagem de erro, ou `null` quando a conta foi criada e o membro foi para a fila. */
  cadastrar: (entrada: EntradaNovoMembro) => Promise<string | null>
  alterarPermissoes: (uid: string, permissoes: Permissoes) => void
  definirAtivo: (uid: string, ativo: boolean) => void
}

type Lido = { chave: string; membros: Membro[]; erro: string | null }

const NENHUM: Membro[] = []

const SEM_INTERNET = mensagemDoErroDeCadastro('auth/network-request-failed')

function paraMembro(documento: QueryDocumentSnapshot<DocumentData>): Membro {
  const dados = documento.data()
  const permissoes: Record<string, unknown> =
    typeof dados.permissoes === 'object' && dados.permissoes !== null ? dados.permissoes : {}

  // `=== true`, como `acessoDoMembro()` lê o próprio documento: o que não é bool vale false.
  return {
    uid: documento.id,
    nome: dados.nome,
    email: dados.email,
    ativo: dados.ativo === true,
    permissoes: {
      financeiro: permissoes.financeiro === true,
      caixaDoDia: permissoes.caixaDoDia === true,
      exportar: permissoes.exportar === true,
      cancelar: permissoes.cancelar === true,
    },
    pendente: documento.metadata.hasPendingWrites,
  }
}

function codigoDoErro(falha: unknown): string {
  if (typeof falha !== 'object' || falha === null || !('code' in falha)) return ''
  return typeof falha.code === 'string' ? falha.code : ''
}

/**
 * A equipe da loja, para a tela do dono. O listener vive enquanto o consumidor estiver
 * montado: só a tela de equipe chama este hook.
 */
export function useEquipe(): Equipe {
  const { businessId } = useAuth()

  const [lido, setLido] = useState<Lido | null>(null)
  const [erroDeGravacao, setErroDeGravacao] = useState<string | null>(null)

  useEffect(() => {
    if (!businessId) return

    const chave = businessId

    return onSnapshot(
      query(collection(db, 'businesses', businessId, 'membros'), orderBy('nome')),
      { includeMetadataChanges: true },
      (instantaneo) => {
        setLido((atual) => ({
          chave,
          membros: instantaneo.docs.map(paraMembro),
          erro: atual?.chave === chave ? atual.erro : null,
        }))
      },
      () => {
        setLido((atual) => ({
          chave,
          membros: atual?.chave === chave ? atual.membros : NENHUM,
          erro: 'Não foi possível carregar a equipe.',
        }))
      },
    )
  }, [businessId])

  const registrarFalha = useCallback((mensagem: string, causa: unknown) => {
    console.error('[equipe]', mensagem, causa)
    setErroDeGravacao(mensagem)
  }, [])

  const cadastrar = useCallback(
    async (entrada: EntradaNovoMembro): Promise<string | null> => {
      if (!businessId) return mensagemDoErroDeCadastro('')
      if (navigator.onLine === false) return SEM_INTERNET

      const campos = montarCamposMembro(entrada, { dispositivo: identificarDispositivo() })

      let uid: string
      try {
        uid = await criarContaDeFuncionario(campos.email, entrada.senha)
      } catch (falha) {
        console.error('[equipe] A conta não foi criada.', falha)
        return mensagemDoErroDeCadastro(codigoDoErro(falha))
      }

      // Sem `await`, como toda gravação do projeto. Se a regra recusar, a conta já
      // existe e fica sem acesso: apaga-se no console do Firebase.
      setDoc(doc(db, 'businesses', businessId, 'membros', uid), {
        ...campos,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      }).catch((causa: unknown) => {
        registrarFalha(
          `O cadastro de ${campos.nome} foi recusado pelo servidor. A conta ficou criada sem ` +
            'acesso; apague-a no console do Firebase antes de cadastrar de novo.',
          causa,
        )
      })

      return null
    },
    [businessId, registrarFalha],
  )

  const alterarPermissoes = useCallback(
    (uid: string, permissoes: Permissoes) => {
      if (!businessId) return

      updateDoc(doc(db, 'businesses', businessId, 'membros', uid), {
        permissoes: copiarPermissoes(permissoes),
        atualizadoEm: serverTimestamp(),
        atualizadoPor: identificarDispositivo(),
      }).catch((causa: unknown) => {
        registrarFalha('Não foi possível alterar as permissões deste funcionário.', causa)
      })
    },
    [businessId, registrarFalha],
  )

  const definirAtivo = useCallback(
    (uid: string, ativo: boolean) => {
      if (!businessId) return

      updateDoc(doc(db, 'businesses', businessId, 'membros', uid), {
        ativo,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: identificarDispositivo(),
      }).catch((causa: unknown) => {
        registrarFalha(
          ativo
            ? 'Não foi possível reativar este funcionário.'
            : 'Não foi possível desativar este funcionário.',
          causa,
        )
      })
    },
    [businessId, registrarFalha],
  )

  return useMemo(() => {
    const deste = lido !== null && lido.chave === businessId ? lido : null

    return {
      membros: deste?.membros ?? NENHUM,
      carregando: deste === null,
      erro: erroDeGravacao ?? deste?.erro ?? null,
      cadastrar,
      alterarPermissoes,
      definirAtivo,
    }
  }, [lido, businessId, erroDeGravacao, cadastrar, alterarPermissoes, definirAtivo])
}
