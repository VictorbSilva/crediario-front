import { NavLink } from 'react-router-dom'
import { BrandMark } from '@/components/BrandMark'
import { navItems } from './navItems'

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <BrandMark className="h-7 w-7 text-brand-600" />
        <span className="text-lg font-semibold tracking-tight text-slate-900">
          Crediário
        </span>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon size={20} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
