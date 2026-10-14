// Dados falsos para a única tela que ainda não persiste: o Financeiro. Este arquivo e o
// `DemoBanner` saem juntos, no commit em que os dados reais do Financeiro entrarem.
//
// ⚠️ NÃO usar este arquivo como referência do modelo de domínio. Ele foi escrito
// em 08/08/2026 e decisões posteriores o contradizem. Os clientes de demonstração saíram
// em 21/09/2026, quando a tela de Clientes passou a ler o Firestore, e as rotas de
// demonstração (que eram nomeadas por bairro, não por dia do mês) saíram em 14/10/2026,
// quando a tela de Rotas passou a ler e gravar.
//
// O modelo válido está em `firestore.rules` (campos de `clients`) e na seção 6 do
// documento de progresso.

export type SituacaoParcela = 'atrasada' | 'vence-hoje' | 'a-vencer' | 'paga'

export type ParcelaDemo = {
  id: string
  clienteNome: string
  descricao: string
  valorCentavos: number
  situacao: SituacaoParcela
}

export const parcelasDemo: ParcelaDemo[] = [
  {
    id: 'i1',
    clienteNome: 'Maria Aparecida Santos',
    descricao: 'Parcela 3/10 · vence 24/07/2026',
    valorCentavos: 12000,
    situacao: 'atrasada',
  },
  {
    id: 'i2',
    clienteNome: 'João Batista Lima',
    descricao: 'Parcela 2/6 · vence 25/07/2026',
    valorCentavos: 18000,
    situacao: 'a-vencer',
  },
  {
    id: 'i3',
    clienteNome: 'Mercado São José',
    descricao: 'Parcela 5/8 · pago em 23/07/2026',
    valorCentavos: 26000,
    situacao: 'paga',
  },
  {
    id: 'i4',
    clienteNome: 'Carlos Roberto',
    descricao: 'Parcela 1/4 · vence hoje',
    valorCentavos: 9000,
    situacao: 'vence-hoje',
  },
  {
    id: 'i5',
    clienteNome: 'Dona Lúcia',
    descricao: 'Parcela 7/12 · vence 28/07/2026',
    valorCentavos: 18000,
    situacao: 'a-vencer',
  },
]
