import { Ban, CalendarDays, Download, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Permissoes } from '@/lib/acesso'

// Um `Record` de todas as chaves: permissão nova não compila sem ícone.
export const ICONES_DAS_PERMISSOES: Record<keyof Permissoes, LucideIcon> = {
  financeiro: Wallet,
  caixaDoDia: CalendarDays,
  exportar: Download,
  cancelar: Ban,
}
