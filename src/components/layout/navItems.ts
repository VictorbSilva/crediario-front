import { Route as RouteIcon, UserCog, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { veFinanceiro } from '@/lib/acesso'
import type { Acesso } from '@/lib/acesso'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  exigeFinanceiro?: boolean
  somenteDono?: boolean
}

export const navItems: NavItem[] = [
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/rotas', label: 'Rotas', icon: RouteIcon },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, exigeFinanceiro: true },
  { to: '/equipe', label: 'Equipe', icon: UserCog, somenteDono: true },
]

export function itensDeNavegacao(acesso: Acesso): NavItem[] {
  const financeiro = veFinanceiro(acesso)
  const dono = acesso.estado === 'liberado' && acesso.dono
  return navItems.filter(
    (item) => (!item.exigeFinanceiro || financeiro) && (!item.somenteDono || dono),
  )
}
