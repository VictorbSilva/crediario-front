import { CalendarDays, Download, Wallet } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { DESCRICAO_DAS_PERMISSOES } from '@/lib/equipe'
import { ICONES_DAS_PERMISSOES } from './iconesDePermissoes'

describe('ICONES_DAS_PERMISSOES', () => {
  it('Wallet para o Financeiro geral, CalendarDays para o Caixa do dia e Download para Exportar', () => {
    expect(ICONES_DAS_PERMISSOES).toEqual({ financeiro: Wallet, caixaDoDia: CalendarDays, exportar: Download })
  })

  it('toda permissão descrita tem ícone', () => {
    for (const { chave } of DESCRICAO_DAS_PERMISSOES) {
      expect(ICONES_DAS_PERMISSOES[chave]).toBeDefined()
    }
  })
})
