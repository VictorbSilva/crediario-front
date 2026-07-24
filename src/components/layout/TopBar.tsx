import { BrandMark } from '@/components/BrandMark'

/**
 * Cabeçalho apenas para telas pequenas. É o lugar previsto para o indicador
 * de sincronização (offline-first) e o menu da conta — ainda não implementados.
 */
export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-4 md:hidden">
      <BrandMark className="h-6 w-6 text-brand-600" />
      <span className="text-base font-semibold tracking-tight text-slate-900">
        Crediário
      </span>
    </header>
  )
}
