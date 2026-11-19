import { useEffect, useRef, useState } from 'react'
import { Check, CircleCheck, Copy, MessageCircle } from 'lucide-react'
import { mensagemDeAcesso, primeiroNome } from '@/lib/equipe'

type ContaCriadaProps = Readonly<{ nome: string; email: string; senha: string }>

type Copiavel = 'email' | 'senha' | 'mensagem'

const TEMPO_DO_COPIADO = 2000

function useCopiar() {
  const [copiado, setCopiado] = useState<Copiavel | null>(null)
  const [falhou, setFalhou] = useState(false)
  const temporizador = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  function copiar(qual: Copiavel, texto: string) {
    // Fora de https (ou localhost) o navegador nem oferece a área de transferência.
    if (typeof navigator.clipboard?.writeText !== 'function') {
      setCopiado(null)
      setFalhou(true)
      return
    }

    navigator.clipboard.writeText(texto).then(
      () => {
        setFalhou(false)
        setCopiado(qual)
        window.clearTimeout(temporizador.current)
        temporizador.current = window.setTimeout(() => setCopiado(null), TEMPO_DO_COPIADO)
      },
      () => {
        setCopiado(null)
        setFalhou(true)
      },
    )
  }

  return { copiado, falhou, copiar }
}

function LinhaCopiavel({
  rotulo,
  valor,
  rotuloDoBotao,
  copiado,
  separada = false,
  aoCopiar,
}: Readonly<{
  rotulo: string
  valor: string
  rotuloDoBotao: string
  copiado: boolean
  separada?: boolean
  aoCopiar: () => void
}>) {
  return (
    <div className={`flex items-center gap-3 px-3.5 py-3 ${separada ? 'border-t border-slate-100' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-500">{rotulo}</div>
        <div className="mt-0.5 select-all truncate text-[15px] font-semibold tracking-wide text-slate-900">
          {valor}
        </div>
      </div>
      <button
        type="button"
        aria-label={rotuloDoBotao}
        onClick={aoCopiar}
        className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-brand-600 transition-colors hover:bg-slate-50"
      >
        {copiado ? (
          <>
            <Check size={16} aria-hidden />
            Copiado
          </>
        ) : (
          <Copy size={18} aria-hidden />
        )}
      </button>
    </div>
  )
}

/**
 * O miolo do card depois de criar a conta. A senha só vive aqui, no estado de quem abriu o
 * card: nada é gravado nem guardado no navegador, e fechar o card a perde. Todo botão é
 * `type="button"`, porque o miolo fica dentro do `<form>` do `ModalDeFormulario`.
 */
export function ContaCriada({ nome, email, senha }: ContaCriadaProps) {
  const { copiado, falhou, copiar } = useCopiar()
  // O endereço de quem está usando: sai certo no treino e na produção.
  const mensagem = mensagemDeAcesso({ nome, email, senha, endereco: window.location.origin })

  return (
    <>
      <div className="flex flex-col items-center gap-2.5 py-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CircleCheck size={28} aria-hidden />
        </span>
        <h3 className="text-xl font-semibold text-slate-900">A conta de {primeiroNome(nome)} está pronta</h3>
        <p className="max-w-[300px] text-sm text-slate-500">
          Mande o acesso agora. Esta é a única vez que a senha aparece.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <LinhaCopiavel
          rotulo="E-mail"
          valor={email}
          rotuloDoBotao="Copiar o e-mail"
          copiado={copiado === 'email'}
          aoCopiar={() => copiar('email', email)}
        />
        <LinhaCopiavel
          rotulo="Senha"
          valor={senha}
          rotuloDoBotao="Copiar a senha"
          copiado={copiado === 'senha'}
          separada
          aoCopiar={() => copiar('senha', senha)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-[13px] font-semibold text-slate-600">Mensagem pronta</div>
        <div className="select-all whitespace-pre-line rounded-xl bg-slate-100 px-3.5 py-3 text-sm leading-relaxed text-slate-700">
          {mensagem}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <a
          href={'https://wa.me/?text=' + encodeURIComponent(mensagem)}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <MessageCircle size={18} aria-hidden />
          Enviar pelo WhatsApp
        </a>
        <button
          type="button"
          onClick={() => copiar('mensagem', mensagem)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-brand-600 transition-colors hover:bg-slate-50"
        >
          {copiado === 'mensagem' ? <Check size={17} aria-hidden /> : <Copy size={17} aria-hidden />}
          {copiado === 'mensagem' ? 'Copiado' : 'Copiar mensagem'}
        </button>
        {falhou ? (
          <p role="alert" className="text-center text-sm font-medium text-danger">
            Não deu para copiar. Selecione o texto e copie.
          </p>
        ) : null}
      </div>
    </>
  )
}
