import { Fragment, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { Announcements, DragEndEvent, ScreenReaderInstructions } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ParadaDaRota } from '@/components/rotas/ParadaDaRota'
import { SeletorDoDia } from '@/components/rotas/SeletorDoDia'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kpi } from '@/components/ui/Kpi'
import { Nota } from '@/components/ui/Nota'
import { useClientes } from '@/data/useClientes'
import { dataBonita, dataLocalISO } from '@/lib/data'
import {
  arrasteNaRotaDaData,
  arrasteNaRotaDeHoje,
  contagemPorData,
  dataDaVisita,
  mesSeguinte,
  rotaDaData,
  rotaDeHoje,
} from '@/lib/rotas'
import type { ItemDaRota } from '@/lib/rotas'
import type { Cliente } from '@/types/cliente'

const INSTRUCOES: ScreenReaderInstructions = {
  draggable:
    'Para mover este cliente na ordem da rota, pressione espaço ou enter. Use as setas para cima ou para baixo para escolher a posição, espaço ou enter para soltar, ou escape para cancelar.',
}

// Mesmo critério de `src/lib/rotas.ts` para o atrasado "solto": sem posição gravada para hoje.
// É o início desse bloco que o separador marca.
function ehAtrasadoSolto(item: ItemDaRota<Cliente>, hoje: string): boolean {
  const posicao = item.cliente.ordemDoDia
  return item.estado.atrasado && (posicao?.data !== hoje || !Number.isFinite(posicao?.valor))
}

type Mes = { ano: number; mes: number }

function mesDaData(data: string): Mes {
  return { ano: Number(data.slice(0, 4)), mes: Number(data.slice(5, 7)) }
}

function mesmoMes(a: Mes, b: Mes): boolean {
  return a.ano === b.ano && a.mes === b.mes
}

export function RotasPage() {
  const { clientes, carregando, erro, falhas, descartarFalha, marcarNaRota, reordenarRota } =
    useClientes()

  const hoje = dataLocalISO(new Date())

  // `null` segue o dia de hoje, mesmo que o app fique aberto durante a virada da meia-noite.
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [mesVisivel, setMesVisivel] = useState<Mes>(() => mesDaData(hoje))

  const dataEscolhida = escolhida ?? hoje
  const ehHoje = dataEscolhida === hoje
  const mesAtual = mesDaData(hoje)
  const podeVoltar = mesmoMes(mesVisivel, mesSeguinte(mesAtual.ano, mesAtual.mes))
  const podeAvancar = mesmoMes(mesVisivel, mesAtual)

  const contagem = useMemo(
    () => contagemPorData(clientes, mesVisivel.ano, mesVisivel.mes),
    [clientes, mesVisivel],
  )
  const itensHoje = useMemo(
    () => (ehHoje ? rotaDeHoje(clientes, hoje) : []),
    [clientes, hoje, ehHoje],
  )
  const itensData = useMemo(
    () => (ehHoje ? [] : rotaDaData(clientes, dataEscolhida)),
    [clientes, dataEscolhida, ehHoje],
  )
  const ids = useMemo(
    () => (ehHoje ? itensHoje : itensData).map((item) => item.cliente.id),
    [ehHoje, itensHoje, itensData],
  )
  const nomes = useMemo(
    () => new Map(clientes.map((cliente) => [cliente.id, cliente.nome])),
    [clientes],
  )

  // Mouse com distância e toque com atraso: o mesmo gesto não pode ser ao mesmo tempo
  // rolar a lista e arrastar um item. PointerSensor fica de fora de propósito.
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const nomeDe = (id: string | number) => nomes.get(String(id)) ?? 'Cliente'
  const posicaoDe = (id: string | number) => `${ids.indexOf(String(id)) + 1} de ${ids.length}`
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Pegou ${nomeDe(active.id)}. Posição ${posicaoDe(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nomeDe(active.id)} está na posição ${posicaoDe(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nomeDe(active.id)} foi solto na posição ${posicaoDe(over.id)}.`
        : `${nomeDe(active.id)} foi solto no mesmo lugar.`,
    onDragCancel: ({ active }) => `Arrasto cancelado. ${nomeDe(active.id)} ficou onde estava.`,
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const de = ids.indexOf(String(active.id))
    const para = ids.indexOf(String(over.id))
    if (de === -1 || para === -1) return

    reordenarRota(
      ehHoje
        ? arrasteNaRotaDeHoje(itensHoje, de, para, hoje, clientes)
        : arrasteNaRotaDaData(itensData, de, para, dataEscolhida, clientes),
    )
  }

  function escolher(data: string) {
    setEscolhida(data === hoje ? null : data)
  }

  // Só dois meses: o atual e o seguinte. Avançar abre o dia 1; voltar retorna à rota de hoje.
  function trocarMes(direcao: -1 | 1) {
    if (direcao === 1 && podeAvancar) {
      const proximo = mesSeguinte(mesAtual.ano, mesAtual.mes)
      setMesVisivel(proximo)
      setEscolhida(dataDaVisita(proximo.ano, proximo.mes, 1))
    } else if (direcao === -1 && podeVoltar) {
      setMesVisivel(mesAtual)
      setEscolhida(null)
    }
  }

  const inicioDosAtrasados = itensHoje.findIndex((item) => ehAtrasadoSolto(item, hoje))
  const visitados = itensHoje.filter((item) => item.estado.situacao === 'visitado').length
  const ausentes = itensHoje.filter((item) => item.estado.ausenteHoje).length
  const atrasados = itensHoje.filter((item) => item.estado.atrasado).length

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Rotas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Veja a rota de hoje e ajuste a ordem de visita de qualquer dia do mês.
        </p>
      </div>

      {erro ? (
        <div className="mb-4">
          <Nota tom="alerta" titulo="Não foi possível carregar">
            {erro}
          </Nota>
        </div>
      ) : null}

      {falhas.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          {falhas.map((falha) => (
            <Nota key={falha.id} tom="alerta" titulo="Uma escrita foi recusada">
              <span>{falha.mensagem}</span>
              <button
                type="button"
                onClick={() => descartarFalha(falha.id)}
                className="ml-2 font-semibold underline underline-offset-2"
              >
                Entendi
              </button>
            </Nota>
          ))}
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
        <section aria-labelledby="titulo-dia-do-mes">
          <h2 id="titulo-dia-do-mes" className="mb-2 text-sm font-semibold text-slate-900">
            Dia do mês
          </h2>
          <SeletorDoDia
            ano={mesVisivel.ano}
            mes={mesVisivel.mes}
            hoje={hoje}
            escolhida={dataEscolhida}
            contagem={contagem}
            podeVoltar={podeVoltar}
            podeAvancar={podeAvancar}
            aoEscolher={escolher}
            aoTrocarMes={trocarMes}
          />
        </section>

        <section aria-labelledby="titulo-da-rota">
          {ehHoje ? (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi rotulo="Na rota" valor={String(itensHoje.length)} />
              <Kpi rotulo="Visitados" valor={String(visitados)} tom="sucesso" />
              <Kpi rotulo="Ausentes" valor={String(ausentes)} tom="alerta" />
              <Kpi rotulo="Visitas atrasadas" valor={String(atrasados)} tom="perigo" />
            </div>
          ) : (
            <div className="mb-4">
              <Nota tom="info">
                Aqui você ajusta a ordem de visita. A ordem vale para este dia em todos os meses.
                As marcas de visita ficam na rota de hoje.
              </Nota>
            </div>
          )}

          <h2 id="titulo-da-rota" className="mb-3 text-sm font-semibold text-slate-900">
            {ehHoje ? `Rota de hoje · ${dataBonita(hoje)}` : `Rota de ${dataBonita(dataEscolhida)}`}
          </h2>

          {carregando ? (
            <EmptyState>Carregando os clientes deste aparelho…</EmptyState>
          ) : ids.length === 0 ? (
            <EmptyState>
              Nenhum cliente neste dia. Escolha os dias de visita no cadastro do cliente.
            </EmptyState>
          ) : (
            <DndContext
              sensors={sensores}
              collisionDetection={closestCenter}
              // Só na vertical e sem sair do <ul>: o item não passa por cima dos KPIs nem do seletor.
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              accessibility={{ announcements: anuncios, screenReaderInstructions: INSTRUCOES }}
              onDragEnd={aoSoltar}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul className="flex max-w-3xl flex-col gap-2.5">
                  {ehHoje
                    ? itensHoje.map((item, indice) => (
                        <Fragment key={item.cliente.id}>
                          {indice === inicioDosAtrasados ? (
                            <li className="px-1 pt-2 text-xs font-semibold text-danger">
                              Visitas de dias anteriores · da mais antiga para a mais nova
                            </li>
                          ) : null}
                          <ParadaDaRota
                            cliente={item.cliente}
                            estado={item.estado}
                            aoMarcar={marcarNaRota}
                          />
                        </Fragment>
                      ))
                    : itensData.map((item) => (
                        <ParadaDaRota key={item.cliente.id} cliente={item.cliente} />
                      ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </div>
    </div>
  )
}
