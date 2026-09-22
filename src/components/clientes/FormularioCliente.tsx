import { useEffect, useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { X } from 'lucide-react'
import { Nota } from '@/components/ui/Nota'
import { useClientes } from '@/data/useClientes'
import { ENTRADA_CLIENTE_VAZIA, LIMITES_CLIENTE, validarCliente } from '@/lib/cliente'
import type { EntradaCliente } from '@/lib/cliente'
import { avisoDeConferencia } from '@/lib/sync'

type CampoProps = Readonly<{
  id: string
  rotulo: string
  valor: string
  maxLength: number
  erro?: string
  dica?: string
  obrigatorio?: boolean
  multilinha?: boolean
  inputMode?: 'numeric' | 'tel' | 'text'
  focoInicial?: boolean
  aoMudar: (valor: string) => void
  aoSair: () => void
}>

function Campo({
  id,
  rotulo,
  valor,
  maxLength,
  erro,
  dica,
  obrigatorio = false,
  multilinha = false,
  inputMode = 'text',
  focoInicial = false,
  aoMudar,
  aoSair,
}: CampoProps) {
  const idErro = id + '-erro'
  const idDica = id + '-dica'
  const descrito = [erro ? idErro : null, dica ? idDica : null].filter(Boolean).join(' ')

  const comum =
    'w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:ring-1 '
  const cor = erro
    ? 'border-danger focus:border-danger focus:ring-danger'
    : 'border-slate-200 focus:border-brand-600 focus:ring-brand-600'

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {rotulo}
        {obrigatorio ? null : <span className="ml-1.5 text-xs text-slate-400">opcional</span>}
      </label>

      {multilinha ? (
        <textarea
          id={id}
          value={valor}
          rows={3}
          maxLength={maxLength}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descrito || undefined}
          onChange={(evento) => aoMudar(evento.target.value)}
          onBlur={aoSair}
          className={comum + cor + ' py-2'}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={valor}
          inputMode={inputMode}
          maxLength={maxLength}
          autoFocus={focoInicial}
          autoComplete="off"
          aria-invalid={erro ? true : undefined}
          aria-describedby={descrito || undefined}
          onChange={(evento) => aoMudar(evento.target.value)}
          onBlur={aoSair}
          className={comum + cor + ' h-11'}
        />
      )}

      {dica ? (
        <p id={idDica} className="mt-1 text-xs text-slate-500">
          {dica}
        </p>
      ) : null}

      {erro ? (
        <p id={idErro} role="alert" className="mt-1 text-xs font-medium text-danger">
          {erro}
        </p>
      ) : null}
    </div>
  )
}

export function FormularioCliente({ aoFechar }: Readonly<{ aoFechar: () => void }>) {
  const { clientes, confianca, criarCliente } = useClientes()

  const [entrada, setEntrada] = useState<EntradaCliente>(ENTRADA_CLIENTE_VAZIA)
  const [tocados, setTocados] = useState<Partial<Record<keyof EntradaCliente, boolean>>>({})
  const [tentouSalvar, setTentouSalvar] = useState(false)

  const dialogo = useRef<HTMLDialogElement>(null)
  const base = useId()

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  const erros = validarCliente(entrada, clientes, confianca)
  const aviso = avisoDeConferencia(confianca)

  function mostrar(campo: keyof EntradaCliente): string | undefined {
    const erro = erros[campo]
    if (!erro) return undefined
    if (tentouSalvar || tocados[campo]) return erro
    if (campo === 'numero' && entrada.numero.trim() !== '') return erro
    return undefined
  }

  function mudar(campo: keyof EntradaCliente) {
    return (valor: string) => setEntrada((atual) => ({ ...atual, [campo]: valor }))
  }

  function sair(campo: keyof EntradaCliente) {
    return () => setTocados((atual) => ({ ...atual, [campo]: true }))
  }

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    setTentouSalvar(true)
    if (Object.keys(erros).length > 0) return

    criarCliente(entrada)
    aoFechar()
  }

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby={base + '-titulo'}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-slate-50 p-0 backdrop:bg-slate-900/40 md:m-auto md:h-auto md:max-h-[90dvh] md:w-[34rem] md:rounded-2xl md:bg-white"
    >
      <form onSubmit={enviar} className="flex h-full flex-col md:max-h-[90dvh]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white p-4 md:rounded-t-2xl">
          <div>
            <h2 id={base + '-titulo'} className="text-lg font-semibold text-slate-900">
              Novo cliente
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">O número é o mesmo da lista de papel.</p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar sem salvar"
            className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {aviso ? <Nota tom="alerta">{aviso}</Nota> : null}

          <Campo
            id={base + '-numero'}
            rotulo="Número"
            valor={entrada.numero}
            maxLength={9}
            inputMode="numeric"
            focoInicial
            obrigatorio
            erro={mostrar('numero')}
            dica="Conferido contra a lista deste aparelho, não contra o servidor."
            aoMudar={mudar('numero')}
            aoSair={sair('numero')}
          />

          <Campo
            id={base + '-nome'}
            rotulo="Nome"
            valor={entrada.nome}
            maxLength={LIMITES_CLIENTE.nome}
            obrigatorio
            erro={mostrar('nome')}
            aoMudar={mudar('nome')}
            aoSair={sair('nome')}
          />

          <Campo
            id={base + '-telefone'}
            rotulo="Telefone"
            valor={entrada.telefone}
            maxLength={LIMITES_CLIENTE.telefone}
            inputMode="tel"
            erro={mostrar('telefone')}
            aoMudar={mudar('telefone')}
            aoSair={sair('telefone')}
          />

          <Campo
            id={base + '-cpf'}
            rotulo="CPF"
            valor={entrada.cpf}
            maxLength={LIMITES_CLIENTE.cpf}
            inputMode="numeric"
            erro={mostrar('cpf')}
            dica="Se preencher, precisa ser um CPF válido. Em branco também serve."
            aoMudar={mudar('cpf')}
            aoSair={sair('cpf')}
          />

          <Campo
            id={base + '-endereco'}
            rotulo="Endereço"
            valor={entrada.endereco}
            maxLength={LIMITES_CLIENTE.endereco}
            erro={mostrar('endereco')}
            aoMudar={mudar('endereco')}
            aoSair={sair('endereco')}
          />

          <Campo
            id={base + '-observacao'}
            rotulo="Observação"
            valor={entrada.observacao}
            maxLength={LIMITES_CLIENTE.observacao}
            multilinha
            erro={mostrar('observacao')}
            aoMudar={mudar('observacao')}
            aoSair={sair('observacao')}
          />
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-b-2xl md:pb-4">
          <button
            type="button"
            onClick={aoFechar}
            className="min-h-11 flex-1 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 md:flex-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Salvar cliente
          </button>
        </div>
      </form>
    </dialog>
  )
}
