import { useState } from 'react'
import { Plus } from 'lucide-react'
import { FormularioPagamento } from '@/components/clientes/carne/FormularioPagamento'
import { FormularioVenda } from '@/components/clientes/carne/FormularioVenda'
import { VendaExpansivel } from '@/components/clientes/carne/VendaExpansivel'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kpi } from '@/components/ui/Kpi'
import { Nota } from '@/components/ui/Nota'
import type { CarneDoCliente as DadosDoCarne } from '@/data/useCarne'
import { formatarCentavos } from '@/lib/dinheiro'
import type { ParcelaComEstado } from '@/lib/parcelas'
import type { Venda } from '@/types/venda'

type Cobranca = {
  venda: Venda
  item: ParcelaComEstado
  abertoDaVendaCentavos: number
}

type CarneDoClienteProps = Readonly<{
  dados: DadosDoCarne
  /** Só a página escreve; o painel lateral é leitura. */
  permiteEscrita?: boolean
}>

export function CarneDoCliente({ dados, permiteEscrita = false }: CarneDoClienteProps) {
  const {
    carnes,
    pagamentos,
    saldo,
    carregando,
    erro,
    hoje,
    falhas,
    descartarFalha,
    registrarVenda,
    registrarPagamento,
    cancelarPagamento,
  } = dados

  const [abertaId, setAbertaId] = useState<string | null>(null)
  const [simulando, setSimulando] = useState(false)
  const [lancandoVenda, setLancandoVenda] = useState(false)
  const [cobranca, setCobranca] = useState<Cobranca | null>(null)

  if (erro) {
    return (
      <Nota tom="alerta" titulo="Não foi possível carregar o carnê">
        {erro}
      </Nota>
    )
  }

  const emAberto = carnes.filter((carne) => !carne.resumo.quitada).length

  const avisos = falhas.length > 0 && (
    <div className="flex flex-col gap-2">
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
  )

  const botaoDeVenda = permiteEscrita && (
    <button
      type="button"
      onClick={() => setLancandoVenda(true)}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
    >
      <Plus size={17} aria-hidden />
      Nova venda
    </button>
  )

  const formularios = (
    <>
      {lancandoVenda ? (
        <FormularioVenda aoSalvar={registrarVenda} aoFechar={() => setLancandoVenda(false)} />
      ) : null}

      {cobranca ? (
        <FormularioPagamento
          item={cobranca.item}
          totalDeParcelas={cobranca.venda.numeroParcelas}
          abertoDaVendaCentavos={cobranca.abertoDaVendaCentavos}
          aoSalvar={(entrada) => registrarPagamento(cobranca.venda.id, entrada)}
          aoFechar={() => setCobranca(null)}
        />
      ) : null}
    </>
  )

  if (carregando) {
    return (
      <div className="flex flex-col gap-3.5">
        {avisos}
        <EmptyState>Carregando o carnê deste cliente…</EmptyState>
      </div>
    )
  }

  if (carnes.length === 0) {
    return (
      <div className="flex flex-col gap-3.5">
        {avisos}
        <EmptyState>Nenhuma venda registrada para este cliente ainda.</EmptyState>
        {botaoDeVenda ? <div className="flex">{botaoDeVenda}</div> : null}
        {formularios}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {avisos}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi
          rotulo="Saldo devedor"
          valor={formatarCentavos(
            simulando ? saldo.totalComEncargosCentavos : saldo.abertoCentavos,
          )}
          tom={simulando ? 'alerta' : 'neutro'}
        />
        <Kpi rotulo="Vendas em aberto" valor={String(emAberto)} />
        <Kpi
          rotulo="Parcelas vencidas"
          valor={String(saldo.parcelasVencidas)}
          tom={saldo.parcelasVencidas > 0 ? 'perigo' : 'neutro'}
        />
      </div>

      {saldo.parcelasVencidas > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={simulando}
              onChange={(evento) => setSimulando(evento.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-warning focus:ring-warning"
            />
            <span>
              <span className="font-semibold">Simular multa e juros</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {simulando
                  ? `O combinado continua sendo ${formatarCentavos(saldo.abertoCentavos)} — a simulação acrescenta ${formatarCentavos(saldo.encargosCentavos)} e não é cobrança.`
                  : 'Mostra quanto a dívida daria com os encargos. Não é o valor a cobrar.'}
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {botaoDeVenda ? <div className="flex">{botaoDeVenda}</div> : null}

      <div className="flex flex-col gap-2.5">
        {carnes.map((carne) => (
          <VendaExpansivel
            key={carne.venda.id}
            carne={carne}
            pagamentos={pagamentos}
            hoje={hoje}
            simulando={simulando}
            aberta={abertaId === carne.venda.id}
            aoAlternar={() =>
              setAbertaId((atual) => (atual === carne.venda.id ? null : carne.venda.id))
            }
            aoRegistrarPagamento={
              permiteEscrita
                ? (venda, item) =>
                    setCobranca({
                      venda,
                      item,
                      abertoDaVendaCentavos: carne.resumo.abertoCentavos,
                    })
                : undefined
            }
            aoCancelarPagamento={permiteEscrita ? cancelarPagamento : undefined}
          />
        ))}
      </div>

      {formularios}
    </div>
  )
}
