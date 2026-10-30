import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusPill } from '@/components/ui/StatusPill'
import type { AcaoNaRota } from '@/data/clientes-context'
import { dataBonita } from '@/lib/data'
import type { EstadoNaRota } from '@/lib/rotas'
import type { Cliente } from '@/types/cliente'

type ParadaDaRotaProps = Readonly<{
  cliente: Cliente
  // Só a rota de hoje tem marcas de visita; no planejamento de outro dia os dois ficam de fora.
  estado?: EstadoNaRota
  aoMarcar?: (cliente: Cliente, acao: AcaoNaRota) => void
  // No calendário de outra data não há `estado`: só isto diz que o cliente é de cobrança.
  cobrancaMarcada?: boolean
}>

type PropsDoLi = Readonly<{
  ref?: (elemento: HTMLElement | null) => void
  style?: CSSProperties
  arrastando?: boolean
}>

type CorpoDaParadaProps = ParadaDaRotaProps &
  Readonly<{
    alca: ReactNode
    liProps?: PropsDoLi
  }>

const botaoBase =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'
const botaoNeutro = `${botaoBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`

function CorpoDaParada({ cliente, estado, aoMarcar, cobrancaMarcada, alca, liProps }: CorpoDaParadaProps) {
  const visitado = estado?.situacao === 'visitado'
  const pendente = estado?.situacao === 'pendente'
  const ausenteHoje = estado?.ausenteHoje === true
  // `=== null`, nunca `== null`: no calendário `estado` é undefined e não diz nada da cobrança.
  const deCobranca = cobrancaMarcada === true || estado?.diaAgendado === null

  return (
    <li
      ref={liProps?.ref}
      style={liProps?.style}
      className={`relative rounded-xl border bg-white ${
        liProps?.arrastando ? 'z-10 border-brand-600 shadow-lg ring-1 ring-brand-600' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-1 p-2">
        {alca ?? <div aria-hidden className="min-w-11 shrink-0" />}

        <div className={`min-w-0 flex-1 py-1.5 pr-1 ${visitado ? 'opacity-60' : ''}`}>
          <div className="truncate text-sm font-semibold text-slate-900">
            <span className="text-brand-700">#{cliente.numero}</span> · {cliente.nome}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500">
            {cliente.endereco ?? 'Sem endereço'}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 empty:hidden">
            {estado?.atrasado && estado.agendadoPara ? (
              <StatusPill tom="perigo">
                {deCobranca ? 'Cobrança' : 'Visita'} pendente desde {dataBonita(estado.agendadoPara)}
              </StatusPill>
            ) : deCobranca ? (
              <StatusPill tom="neutro">Cobrança marcada</StatusPill>
            ) : null}
            {ausenteHoje ? <StatusPill tom="alerta">Ausente</StatusPill> : null}
            {visitado ? <StatusPill tom="sucesso">Visitado</StatusPill> : null}
            {cliente.pendente ? <StatusPill tom="marca">Pendente</StatusPill> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2">
        {aoMarcar && pendente ? (
          <button
            type="button"
            onClick={() => aoMarcar(cliente, 'visitado')}
            className={`${botaoBase} bg-success text-white hover:opacity-90`}
          >
            Visitado
          </button>
        ) : null}
        {aoMarcar && pendente && !ausenteHoje ? (
          <button type="button" onClick={() => aoMarcar(cliente, 'ausente')} className={botaoNeutro}>
            Ausente
          </button>
        ) : null}
        {aoMarcar && (visitado || ausenteHoje) ? (
          <button type="button" onClick={() => aoMarcar(cliente, 'desmarcar')} className={botaoNeutro}>
            Desmarcar
          </button>
        ) : null}
        <Link to={`/clientes/${cliente.id}`} className={`${botaoNeutro} ml-auto`}>
          Carnê
        </Link>
      </div>
    </li>
  )
}

export function ParadaDaRota({ cliente, estado, aoMarcar, cobrancaMarcada }: ParadaDaRotaProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cliente.id })

  return (
    <CorpoDaParada
      cliente={cliente}
      estado={estado}
      aoMarcar={aoMarcar}
      cobrancaMarcada={cobrancaMarcada}
      liProps={{
        ref: setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        arrastando: isDragging,
      }}
      alca={
        // O arrasto nasce só aqui. `touch-none` (touch-action: none) vale só para a alça:
        // o resto do item continua deixando o dedo rolar a lista.
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Arrastar ${cliente.nome}`}
          className="flex min-h-11 min-w-11 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={20} aria-hidden />
        </button>
      }
    />
  )
}

// Sem `useSortable` e sem alça: fica fora do SortableContext, e o espaço da alça mantém o
// texto alinhado com o dos itens arrastáveis.
export function ParadaFixa({ cliente, estado, aoMarcar, cobrancaMarcada }: ParadaDaRotaProps) {
  return (
    <CorpoDaParada
      cliente={cliente}
      estado={estado}
      aoMarcar={aoMarcar}
      cobrancaMarcada={cobrancaMarcada}
      alca={null}
    />
  )
}
