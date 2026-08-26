import { Route as RouteIcon, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/rotas', label: 'Rotas', icon: RouteIcon },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet },
]
