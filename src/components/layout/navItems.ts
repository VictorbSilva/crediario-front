import { Route as RouteIcon, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { veFinanceiro } from '@/lib/acesso'
import type { Acesso } from '@/lib/acesso'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  exigeFinanceiro?: boolean
}

export const navItems: NavItem[] = [
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/rotas', label: 'Rotas', icon: RouteIcon },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, exigeFinanceiro: true },
]

export function itensDeNavegacao(acesso: Acesso): NavItem[] {
  const financeiro = veFinanceiro(acesso)
  return navItems.filter((item) => !item.exigeFinanceiro || financeiro)
}
