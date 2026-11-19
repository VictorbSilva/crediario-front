import { createContext } from 'react'
import type { Acesso } from '@/lib/acesso'

export type AcessoContextValue = Acesso

export const AcessoContext = createContext<AcessoContextValue | null>(null)
