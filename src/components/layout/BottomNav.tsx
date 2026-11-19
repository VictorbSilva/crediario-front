import { NavLink } from 'react-router-dom'
import { useAcesso } from '@/data/useAcesso'
import { itensDeNavegacao } from './navItems'

export function BottomNav() {
  const itens = itensDeNavegacao(useAcesso())

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {itens.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
              isActive ? 'text-brand-600' : 'text-slate-500'
            }`
          }
        >
          <Icon size={22} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
