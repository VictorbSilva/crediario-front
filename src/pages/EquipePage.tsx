import { useEffect, useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Plus, Wifi } from 'lucide-react'
import { CabecalhoDoMembro } from '@/components/equipe/CabecalhoDoMembro'
import { CampoDeSenha } from '@/components/equipe/CampoDeSenha'
import { ContaCriada } from '@/components/equipe/ContaCriada'
import { EtiquetasDePermissoes } from '@/components/equipe/EtiquetasDePermissoes'
import { SeletorDePermissoes } from '@/components/equipe/SeletorDePermissoes'
import { Avatar } from '@/components/ui/Avatar'
import { Campo } from '@/components/ui/Campo'
import { EmptyState } from '@/components/ui/EmptyState'
import { ModalDeFormulario } from '@/components/ui/ModalDeFormulario'
import { Nota } from '@/components/ui/Nota'
import { StatusPill } from '@/components/ui/StatusPill'
import { useEquipe } from '@/data/useEquipe'
import type { Equipe } from '@/data/useEquipe'
import { useEstaOnline } from '@/data/useEstaOnline'
import type { Permissoes } from '@/lib/acesso'
import { LIMITES_MEMBRO, mesmasPermissoes, normalizarEmail, primeiroNome, validarNovoMembro } from '@/lib/equipe'
import type { EntradaNovoMembro, Membro } from '@/lib/equipe'
import { iniciaisDe } from '@/lib/texto'

const ENTRADA_VAZIA: EntradaNovoMembro = {
  nome: '',
  email: '',
  senha: '',
  permissoes: { financeiro: false, caixaDoDia: false, exportar: false },
}

type CampoDeTexto = 'nome' | 'email' | 'senha'

const BOTAO_SECUNDARIO =
  'min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50'

function FormularioNovoFuncionario({
  cadastrar,
  aoFechar,
}: Readonly<{ cadastrar: Equipe['cadastrar']; aoFechar: () => void }>) {
  const base = useId()
  const [entrada, setEntrada] = useState<EntradaNovoMembro>(ENTRADA_VAZIA)
  const [tocados, setTocados] = useState<Partial<Record<CampoDeTexto, boolean>>>({})
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  // A senha fica só aqui, enquanto o card está aberto: fechar o card a perde.
  const [criada, setCriada] = useState<{ nome: string; email: string; senha: string } | null>(null)
  // Só evita a tentativa: `cadastrar` já recusa sem internet.
  const online = useEstaOnline()

  const erros = validarNovoMembro(entrada)

  function mostrar(campo: CampoDeTexto): string | undefined {
    return tentouSalvar || tocados[campo] ? erros[campo] : undefined
  }

  function mudar(campo: CampoDeTexto) {
    return (valor: string) => setEntrada((atual) => ({ ...atual, [campo]: valor }))
  }

  function sair(campo: CampoDeTexto) {
    return () => setTocados((atual) => ({ ...atual, [campo]: true }))
  }

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    setTentouSalvar(true)
    if (Object.keys(erros).length > 0) return

    // A única ação do app que espera o servidor: sem a conta criada, não há uid onde
    // gravar o membro. A mensagem de erro volta para cá e o formulário fica aberto.
    setEnviando(true)
    setFalha(null)
    void cadastrar(entrada).then((mensagem) => {
      setEnviando(false)
      if (mensagem) {
        setFalha(mensagem)
        return
      }
      // Nome e e-mail como a conta foi criada (`montarCamposMembro`); a senha, como digitada.
      setCriada({ nome: entrada.nome.trim(), email: normalizarEmail(entrada.email), senha: entrada.senha })
    })
  }

  // O mesmo `ModalDeFormulario` na mesma posição: o React reaproveita o `<dialog>` aberto e
  // só troca o conteúdo.
  if (criada) {
    return (
      <ModalDeFormulario
        titulo="Conta criada"
        subtitulo={criada.nome}
        rotuloDeEnvio="Concluir"
        idDoTitulo={base + '-titulo'}
        rotuloDeFechar="Fechar"
        acoes={
          <button type="button" onClick={aoFechar} className={BOTAO_SECUNDARIO + ' w-full'}>
            Concluir
          </button>
        }
        aoEnviar={(evento) => evento.preventDefault()}
        aoFechar={aoFechar}
      >
        <ContaCriada {...criada} />
      </ModalDeFormulario>
    )
  }

  return (
    <ModalDeFormulario
      titulo="Novo funcionário"
      subtitulo="Cria a conta com que o funcionário entra no app."
      rotuloDeEnvio={!online ? 'Sem internet' : enviando ? 'Criando conta…' : 'Criar conta'}
      idDoTitulo={base + '-titulo'}
      envioDesabilitado={!online}
      rodape={
        <p aria-live="polite" className="flex items-center gap-2 text-[13px] text-slate-500">
          <Wifi size={16} aria-hidden className="shrink-0" />
          {online ? 'Criar a conta precisa de internet.' : 'Sem internet agora. Conecte para criar a conta.'}
        </p>
      }
      aoEnviar={enviar}
      aoFechar={aoFechar}
    >
      {falha ? <Nota tom="alerta">{falha}</Nota> : null}

      <section aria-labelledby={base + '-acesso'} className="flex flex-col gap-4">
        <h3 id={base + '-acesso'} className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Acesso
        </h3>
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <Campo
            id={base + '-nome'}
            rotulo="Nome"
            valor={entrada.nome}
            maxLength={LIMITES_MEMBRO.nome}
            focoInicial
            obrigatorio
            erro={mostrar('nome')}
            aoMudar={mudar('nome')}
            aoSair={sair('nome')}
          />

          <Campo
            id={base + '-email'}
            rotulo="E-mail"
            valor={entrada.email}
            maxLength={LIMITES_MEMBRO.email}
            inputMode="email"
            obrigatorio
            erro={mostrar('email')}
            aoMudar={mudar('email')}
            aoSair={sair('email')}
          />

          <CampoDeSenha
            id={base + '-senha'}
            valor={entrada.senha}
            erro={mostrar('senha')}
            aoMudar={mudar('senha')}
            aoSair={sair('senha')}
          />
        </div>
      </section>

      <SeletorDePermissoes
        permissoes={entrada.permissoes}
        aoMudar={(permissoes) => setEntrada((atual) => ({ ...atual, permissoes }))}
      />
    </ModalDeFormulario>
  )
}

const TITULO_DE_SECAO = 'text-xs font-bold uppercase tracking-wider'

function GerenciarFuncionario({
  membro,
  aoSalvar,
  aoDefinirAtivo,
  aoFechar,
}: Readonly<{
  membro: Membro
  aoSalvar: (permissoes: Permissoes) => void
  aoDefinirAtivo: (ativo: boolean) => void
  aoFechar: () => void
}>) {
  const base = useId()
  const [permissoes, setPermissoes] = useState<Permissoes>(() => ({ ...membro.permissoes }))
  const [confirmando, setConfirmando] = useState(false)

  const semMudanca = mesmasPermissoes(permissoes, membro.permissoes)

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (semMudanca) return
    aoSalvar(permissoes)
    aoFechar()
  }

  // A confirmação fica ao lado do card, não dentro: o `onClose` de um `<dialog>` dentro
  // do outro subiria pela árvore do React e fecharia o card junto.
  return (
    <>
      <ModalDeFormulario
        titulo="Gerenciar funcionário"
        cabecalho={<CabecalhoDoMembro membro={membro} />}
        rotuloDeEnvio="Salvar alterações"
        idDoTitulo={base + '-titulo'}
        envioDesabilitado={semMudanca}
        rodape={
          <p aria-live="polite" className="text-xs text-slate-500">
            {semMudanca ? 'Nenhuma alteração para salvar.' : 'Alterações não salvas.'}
          </p>
        }
        aoEnviar={enviar}
        aoFechar={aoFechar}
      >
        <SeletorDePermissoes permissoes={permissoes} aoMudar={setPermissoes} />

        {membro.ativo ? (
          <section aria-labelledby={base + '-risco'} className="flex flex-col gap-2.5">
            <h3 id={base + '-risco'} className={TITULO_DE_SECAO + ' text-danger'}>
              Zona de risco
            </h3>
            <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white p-3.5">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Desativar o acesso de {primeiroNome(membro.nome)}
                </div>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Fica sem acesso aos dados da loja na hora. A conta não é apagada e dá para reativar
                  depois.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="min-h-11 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
              >
                Desativar acesso
              </button>
            </div>
          </section>
        ) : (
          <section aria-labelledby={base + '-desativado'} className="flex flex-col gap-2.5">
            <h3 id={base + '-desativado'} className={TITULO_DE_SECAO + ' text-slate-600'}>
              Acesso desativado
            </h3>
            <button
              type="button"
              onClick={() => {
                aoDefinirAtivo(true)
                aoFechar()
              }}
              className={BOTAO_SECUNDARIO}
            >
              Reativar acesso
            </button>
          </section>
        )}
      </ModalDeFormulario>

      {confirmando ? (
        <ConfirmarDesativacao
          membro={membro}
          aoConfirmar={() => {
            aoDefinirAtivo(false)
            aoFechar()
          }}
          aoFechar={() => setConfirmando(false)}
        />
      ) : null}
    </>
  )
}

/** Mesmo padrão do `ConfirmarCancelamentoVenda`: um `<dialog>` aberto pelo `ref`, nada de `window.confirm`. */
function ConfirmarDesativacao({
  membro,
  aoConfirmar,
  aoFechar,
}: Readonly<{ membro: Membro; aoConfirmar: () => void; aoFechar: () => void }>) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const base = useId()

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby={base + '-titulo'}
      aria-describedby={base + '-descricao'}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-2xl bg-white p-5 backdrop:bg-slate-900/40"
    >
      <h2 id={base + '-titulo'} className="text-lg font-semibold text-slate-900">
        Desativar {membro.nome}?
      </h2>
      <p id={base + '-descricao'} className="mt-1 text-sm text-slate-600">
        {membro.nome} deixa de acessar os dados da loja. A conta não é apagada: dá para
        reativar depois.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <button type="button" autoFocus onClick={aoFechar} className={BOTAO_SECUNDARIO}>
          Voltar
        </button>
        <button
          type="button"
          onClick={() => {
            aoConfirmar()
            aoFechar()
          }}
          className="min-h-11 rounded-lg bg-danger px-4 text-sm font-semibold text-white"
        >
          Desativar
        </button>
      </div>
    </dialog>
  )
}

export function EquipePage() {
  const { membros, carregando, erro, cadastrar, alterarPermissoes, definirAtivo } = useEquipe()

  const [cadastrando, setCadastrando] = useState(false)
  const [editando, setEditando] = useState<Membro | null>(null)

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Equipe</h1>
          <p className="mt-1 text-sm text-slate-500">Funcionários que entram no app da loja.</p>
        </div>
        <button
          type="button"
          onClick={() => setCadastrando(true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus size={17} aria-hidden />
          Novo funcionário
        </button>
      </div>

      {erro ? (
        <div className="mb-4">
          <Nota tom="alerta">{erro}</Nota>
        </div>
      ) : null}

      {carregando ? (
        <EmptyState>Carregando a equipe…</EmptyState>
      ) : membros.length === 0 ? (
        <EmptyState>Nenhum funcionário cadastrado ainda. Comece pelo botão “Novo funcionário”.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {membros.map((membro) => (
            <li key={membro.uid} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-center gap-3">
                <Avatar iniciais={iniciaisDe(membro.nome)} destacado={membro.ativo} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[15px] font-semibold ${membro.ativo ? 'text-slate-900' : 'text-slate-600'}`}
                    >
                      {membro.nome}
                    </span>
                    <StatusPill tom={membro.ativo ? 'sucesso' : 'neutro'}>
                      {membro.ativo ? 'Ativo' : 'Desativado'}
                    </StatusPill>
                    {membro.pendente ? <StatusPill tom="marca">Pendente</StatusPill> : null}
                  </div>
                  <div className="mt-0.5 truncate text-[13px] text-slate-500">{membro.email}</div>
                </div>
              </div>

              {membro.ativo ? <EtiquetasDePermissoes permissoes={membro.permissoes} /> : null}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditando(membro)}
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-brand-600 transition-colors hover:bg-slate-50"
                >
                  Gerenciar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {cadastrando ? (
        <FormularioNovoFuncionario cadastrar={cadastrar} aoFechar={() => setCadastrando(false)} />
      ) : null}
      {editando ? (
        <GerenciarFuncionario
          membro={editando}
          aoSalvar={(permissoes) => alterarPermissoes(editando.uid, permissoes)}
          aoDefinirAtivo={(ativo) => definirAtivo(editando.uid, ativo)}
          aoFechar={() => setEditando(null)}
        />
      ) : null}
    </>
  )
}
