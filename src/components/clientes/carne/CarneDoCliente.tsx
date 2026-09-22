import { useState } from 'react'
import { VendaExpansivel } from '@/components/clientes/carne/VendaExpansivel'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kpi } from '@/components/ui/Kpi'
import { Nota } from '@/components/ui/Nota'
import type { CarneDoCliente as DadosDoCarne } from '@/data/useCarne'
import { formatarCentavos } from '@/lib/dinheiro'

type CarneDoClienteProps = Readonly<{
  dados: DadosDoCarne
}>

export function CarneDoCliente({ dados }: CarneDoClienteProps) {
  const { carnes, saldo, carregando, erro, hoje } = dados

  const [abertaId, setAbertaId] = useState<string | null>(null)
  const [simulando, setSimulando] = useState(false)

  if (erro) {
    return (
      <Nota tom="alerta" titulo="Não foi possível carregar o carnê">
        {erro}
      </Nota>
    )
  }

  if (carregando) {
    return <EmptyState>Carregando o carnê deste cliente…</EmptyState>
  }

  if (carnes.length === 0) {
    return <EmptyState>Nenhuma venda registrada para este cliente ainda.</EmptyState>
  }

  const emAberto = carnes.filter((carne) => !carne.resumo.quitada).length

  return (
    <div className="flex flex-col gap-3.5">
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

      <div className="flex flex-col gap-2.5">
        {carnes.map((carne) => (
          <VendaExpansivel
            key={carne.venda.id}
            carne={carne}
            hoje={hoje}
            simulando={simulando}
            aberta={abertaId === carne.venda.id}
            aoAlternar={() =>
              setAbertaId((atual) => (atual === carne.venda.id ? null : carne.venda.id))
            }
          />
        ))}
      </div>
    </div>
  )
}
