export type SituacaoCliente = 'em-dia' | 'atrasado' | 'sem-rota'

export type ClienteDemo = {
  id: string
  nome: string
  iniciais: string
  telefone: string
  endereco: string
  rota: string | null
  emAbertoCentavos: number
  situacao: SituacaoCliente
}

export type SituacaoParada = 'cobrar' | 'pago' | 'ausente' | 'atrasado'

export type ParadaDemo = {
  id: string
  clienteNome: string
  endereco: string
  valorCentavos: number
  situacao: SituacaoParada
}

export type RotaDemo = {
  id: string
  nome: string
  visitas: number
  concluidas: number
  previstoCentavos: number
  pendentesSync: number
  paradas: ParadaDemo[]
}

export type SituacaoParcela = 'atrasada' | 'vence-hoje' | 'a-vencer' | 'paga'

export type ParcelaDemo = {
  id: string
  clienteNome: string
  descricao: string
  valorCentavos: number
  situacao: SituacaoParcela
}

export const clientesDemo: ClienteDemo[] = [
  {
    id: 'c1',
    nome: 'Maria Aparecida Santos',
    iniciais: 'MA',
    telefone: '(11) 98421-0075',
    endereco: 'Rua das Flores 120, Centro',
    rota: 'Rota Centro',
    emAbertoCentavos: 32000,
    situacao: 'atrasado',
  },
  {
    id: 'c2',
    nome: 'João Batista Lima',
    iniciais: 'JB',
    telefone: '(11) 99640-3312',
    endereco: 'Av. Brasil 455, Bairro Alto',
    rota: 'Rota Bairro Alto',
    emAbertoCentavos: 18000,
    situacao: 'em-dia',
  },
  {
    id: 'c3',
    nome: 'Ana Paula Ferreira',
    iniciais: 'AP',
    telefone: '(11) 97155-8890',
    endereco: 'Sítio Boa Vista, Interior',
    rota: null,
    emAbertoCentavos: 0,
    situacao: 'sem-rota',
  },
  {
    id: 'c4',
    nome: 'Mercado São José',
    iniciais: 'MS',
    telefone: '(11) 3312-4400',
    endereco: 'Praça Central 22, Centro',
    rota: 'Rota Centro',
    emAbertoCentavos: 26000,
    situacao: 'em-dia',
  },
  {
    id: 'c5',
    nome: 'Carlos Roberto',
    iniciais: 'CR',
    telefone: '(11) 98800-1122',
    endereco: 'Rua Projetada 8, Centro',
    rota: 'Rota Centro',
    emAbertoCentavos: 9000,
    situacao: 'atrasado',
  },
  {
    id: 'c6',
    nome: 'Dona Lúcia',
    iniciais: 'DL',
    telefone: '(11) 99012-7745',
    endereco: 'Travessa Azul 45, Bairro Alto',
    rota: 'Rota Bairro Alto',
    emAbertoCentavos: 18000,
    situacao: 'atrasado',
  },
]

export const rotasDemo: RotaDemo[] = [
  {
    id: 'r1',
    nome: 'Centro',
    visitas: 18,
    concluidas: 11,
    previstoCentavos: 184000,
    pendentesSync: 3,
    paradas: [
      {
        id: 'p1',
        clienteNome: 'Maria Aparecida Santos',
        endereco: 'Rua das Flores 120',
        valorCentavos: 12000,
        situacao: 'cobrar',
      },
      {
        id: 'p2',
        clienteNome: 'Mercado São José',
        endereco: 'Praça Central 22',
        valorCentavos: 26000,
        situacao: 'pago',
      },
      {
        id: 'p3',
        clienteNome: 'Carlos Roberto',
        endereco: 'Rua Projetada 8',
        valorCentavos: 9000,
        situacao: 'ausente',
      },
    ],
  },
  {
    id: 'r2',
    nome: 'Bairro Alto',
    visitas: 12,
    concluidas: 4,
    previstoCentavos: 96000,
    pendentesSync: 0,
    paradas: [
      {
        id: 'p4',
        clienteNome: 'João Batista Lima',
        endereco: 'Av. Brasil 455',
        valorCentavos: 18000,
        situacao: 'cobrar',
      },
      {
        id: 'p5',
        clienteNome: 'Dona Lúcia',
        endereco: 'Travessa Azul 45',
        valorCentavos: 18000,
        situacao: 'atrasado',
      },
    ],
  },
  {
    id: 'r3',
    nome: 'Interior',
    visitas: 7,
    concluidas: 0,
    previstoCentavos: 54000,
    pendentesSync: 0,
    paradas: [
      {
        id: 'p6',
        clienteNome: 'Ana Paula Ferreira',
        endereco: 'Sítio Boa Vista',
        valorCentavos: 0,
        situacao: 'cobrar',
      },
    ],
  },
  {
    id: 'r4',
    nome: 'Sábado manhã',
    visitas: 9,
    concluidas: 9,
    previstoCentavos: 72000,
    pendentesSync: 1,
    paradas: [
      {
        id: 'p7',
        clienteNome: 'Mercado São José',
        endereco: 'Praça Central 22',
        valorCentavos: 26000,
        situacao: 'pago',
      },
    ],
  },
]

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
