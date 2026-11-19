import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '@/auth/useAuth'
import { PERMISSOES_DO_DONO, acessoDoMembro, ehDonoNoApp } from '@/lib/acesso'
import type { Acesso } from '@/lib/acesso'
import { db } from '@/lib/firebase'
import { AcessoContext } from './acesso-context'

type Lido = { chave: string; acesso: Acesso }

const CARREGANDO: Acesso = { estado: 'carregando' }
const DONO: Acesso = { estado: 'liberado', dono: true, permissoes: PERMISSOES_DO_DONO }

export function AcessoProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { usuario, businessId } = useAuth()
  const uid = usuario?.uid ?? null
  const dono = uid !== null && businessId !== null && ehDonoNoApp(uid, businessId)
  const chave = uid !== null && businessId !== null && !dono ? `${businessId}/${uid}` : null

  const [lido, setLido] = useState<Lido | null>(null)

  useEffect(() => {
    if (dono || uid === null || businessId === null) return

    const chaveDoEfeito = `${businessId}/${uid}`

    return onSnapshot(
      doc(db, 'businesses', businessId, 'membros', uid),
      { includeMetadataChanges: true },
      (instantaneo) => {
        setLido({
          chave: chaveDoEfeito,
          acesso: acessoDoMembro({
            existe: instantaneo.exists(),
            doCache: instantaneo.metadata.fromCache,
            dados: instantaneo.data(),
          }),
        })
      },
      () => {
        setLido({ chave: chaveDoEfeito, acesso: { estado: 'sem-acesso', motivo: 'erro' } })
      },
    )
  }, [dono, uid, businessId])

  const valor = useMemo<Acesso>(() => {
    if (dono) return DONO
    if (lido !== null && lido.chave === chave) return lido.acesso
    return CARREGANDO
  }, [dono, lido, chave])

  return <AcessoContext.Provider value={valor}>{children}</AcessoContext.Provider>
}
